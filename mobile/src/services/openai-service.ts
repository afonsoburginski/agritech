/**
 * OpenAI Service - Reconhecimento de Pragas via Edge Function
 *
 * Usa a Edge Function 'identify-pest' do Supabase que:
 * 1. Chama OpenAI Vision para identificar a praga (com RAG de referências)
 * 2. Cruza o resultado com a base AGROFIT da Embrapa
 * 3. Faz upload da imagem no Storage
 * 4. Retorna resultado enriquecido
 */

import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { logger } from './logger';
import { networkService } from './network-service';
import { supabase } from './supabase';


export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedPest {
  name: string;
  popularName?: string;
  scientificName?: string;
  confidence: number;
  severity: 'baixa' | 'media' | 'alta' | 'critica';
  pestType?: string;
  recommendation?: string;
  boundingBox?: BoundingBox;
}

export interface PestRecognitionResult {
  name: string;
  popularName?: string;
  scientificName?: string;
  confidence: number;
  severity: 'baixa' | 'media' | 'alta' | 'critica';
  pestType?: string;
  recommendation?: string;
  alternatives?: Array<{ name: string; confidence: number }>;
  pests: DetectedPest[];
  recomendacao?: string;
  image?: {
    url: string | null;
    path: string | null;
  };
}

/** Max dimension (pixels) for images sent to the API. Larger images are resized. */
const MAX_IMAGE_DIMENSION = 1280;
/** JPEG quality (0-1) for compressed images. 0.7 keeps good detail for pest ID. */
const JPEG_QUALITY = 0.7;

/**
 * Compresses and resizes an image URI before upload.
 * Returns a local file URI of the optimized image.
 */
async function compressImage(uri: string): Promise<string> {
  try {
    const result = await manipulateAsync(
      uri,
      [{ resize: { width: MAX_IMAGE_DIMENSION } }],
      { compress: JPEG_QUALITY, format: SaveFormat.JPEG },
    );
    return result.uri;
  } catch (error) {
    logger.warn('Compressão de imagem falhou, usando original', { error });
    return uri;
  }
}

/**
 * Converte URI de imagem para Base64
 */
export async function imageUriToBase64(uri: string): Promise<string> {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        const base64Data = base64.split(',')[1] || base64;
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    logger.error('Erro ao converter imagem para base64', { error });
    throw error;
  }
}

/**
 * Chama a Edge Function identify-pest para reconhecer praga via IA + Embrapa.
 * Exportado para uso pela fila de reconhecimento (recognition-queue-service).
 */
export async function callIdentifyPestEdgeFunction(
  imageBase64: string,
  metadata?: {
    fazendaId?: number;
    talhaoId?: number;
    latitude?: number;
    longitude?: number;
    cultura?: string;
  }
): Promise<PestRecognitionResult> {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase não configurado (URL ou KEY ausente)');
  }

  const url = `${supabaseUrl}/functions/v1/identify-pest`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'apikey': supabaseAnonKey,
    },
    body: JSON.stringify({
      imageBase64,
      fazendaId: metadata?.fazendaId,
      talhaoId: metadata?.talhaoId,
      latitude: metadata?.latitude,
      longitude: metadata?.longitude,
      cultura: metadata?.cultura,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Erro na Edge Function identify-pest', { status: response.status, body: errorText });
    throw new Error(`Erro na API (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  const pestsRaw: any[] = data.pests ?? [];
  const pests: DetectedPest[] = pestsRaw.map((p: any) => ({
    name: p.name,
    popularName: p.popularName ?? undefined,
    scientificName: p.scientificName ?? undefined,
    confidence: p.confidence,
    severity: p.severity,
    pestType: p.pestType ?? 'PRAGA',
    recommendation: p.recommendation ?? undefined,
    boundingBox: p.boundingBox ?? undefined,
  }));

  const primary = data.identification ?? pests[0];

  return {
    name: primary?.name ?? 'Não identificado',
    popularName: primary?.popularName ?? undefined,
    scientificName: primary?.scientificName ?? undefined,
    confidence: primary?.confidence ?? 0,
    severity: primary?.severity ?? 'baixa',
    pestType: primary?.pestType ?? 'PRAGA',
    recommendation: primary?.recommendation ?? undefined,
    alternatives: data.identification?.alternatives ?? [],
    pests,
    recomendacao: data.recomendacao ?? undefined,
    image: data.image,
  };
}

/**
 * Reconhece praga usando a Edge Function (OpenAI Vision + Embrapa AGROFIT).
 * Se offline, enfileira no SQLite para processar quando reconectar.
 */
export async function recognizePest(
  imageUri: string,
  metadata?: {
    fazendaId?: number;
    talhaoId?: number;
    latitude?: number;
    longitude?: number;
    cultura?: string;
  }
): Promise<PestRecognitionResult> {
  logger.info('Iniciando reconhecimento de praga via Edge Function', { imageUri: imageUri.substring(0, 50) });

  const isOnline = await networkService.getStatus();

  if (!isOnline) {
    logger.warn('Offline - adicionando à fila de reconhecimento (SQLite)');
    const { addToRecognitionQueue } = await import('@/services/recognition-queue-service');
    await addToRecognitionQueue(imageUri, {
      fazendaId: metadata?.fazendaId,
      talhaoId: metadata?.talhaoId,
      latitude: metadata?.latitude,
      longitude: metadata?.longitude,
    });
    throw new Error('Sem conexão. A foto foi salva e será analisada quando você estiver online.');
  }

  const compressedUri = await compressImage(imageUri);
  const imageBase64 = await imageUriToBase64(compressedUri);

  const result = await callIdentifyPestEdgeFunction(imageBase64, metadata);

  logger.info('Reconhecimento concluído com sucesso', {
    name: result.name,
    confidence: result.confidence,
    severity: result.severity,
    hasRecomendacao: !!result.recomendacao,
  });

  return result;
}
