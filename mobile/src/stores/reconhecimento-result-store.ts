import { create } from 'zustand';
import type { ReconhecimentoResult } from '@/hooks/use-pragas';
import type { BoundingBox } from '@/services/openai-service';

export type PlotOption = { id: number | string; nome: string; culturaAtual?: string; area?: string | number };

export interface DetectedPestEntry {
  name: string;
  popularName?: string;
  scientificName?: string;
  confidence: number;
  severity: 'baixa' | 'media' | 'alta' | 'critica';
  pestType?: string;
  recommendation?: string;
  boundingBox?: BoundingBox;
  contagem: number;
  recomendacao?: string;
}

type RecognitionPayload = {
  result: ReconhecimentoResult;
  pests: DetectedPestEntry[];
  imageUri: string;
  location: { latitude: number; longitude: number };
  plots: PlotOption[];
  fazendaId: number | undefined;
  isOnline: boolean;
  onConfirm: (selectedPlotId: number | string, pests: DetectedPestEntry[]) => Promise<void>;
  onCancel: () => void;
};

type ReconhecimentoResultStore = {
  payload: RecognitionPayload | null;
  setPayload: (p: RecognitionPayload) => void;
  clearPayload: () => void;
};

export const useReconhecimentoResultStore = create<ReconhecimentoResultStore>((set) => ({
  payload: null,
  setPayload: (payload) => set({ payload }),
  clearPayload: () => set({ payload: null }),
}));
