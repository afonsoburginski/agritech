import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const EDGE_FUNCTION_URL = process.env.EDGE_FUNCTION_URL ?? 'https://rlkwdgyzbvpodteyyuqk.supabase.co/functions/v1';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * POST /api/identify-pest
 *
 * Identificação de pragas por imagem. Autenticação via Supabase: envie
 * Authorization: Bearer <access_token> (session do app web ou mobile).
 *
 * Body: multipart/form-data (campo "image") ou application/json ({ imageBase64 }).
 * Headers opcionais: X-Fazenda-ID, X-Talhao-ID, X-Camera-ID.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization') ?? request.headers.get('authorization');
    const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!bearer) {
      return NextResponse.json(
        { error: 'Unauthorized. Envie Authorization: Bearer <seu_access_token> (sessão Supabase).' },
        { status: 401 }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { user }, error: authError } = await supabase.auth.getUser(bearer);
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Token inválido ou expirado. Faça login novamente no app.' },
        { status: 401 }
      );
    }

    // Extract metadata from headers
    const fazendaId = request.headers.get('X-Fazenda-ID');
    const talhaoId = request.headers.get('X-Talhao-ID');
    const cameraId = request.headers.get('X-Camera-ID');

    let imageBase64: string;

    const contentType = request.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('image') as File | null;

      if (!file) {
        return NextResponse.json(
          { error: 'No image file provided. Send as "image" field in multipart/form-data.' },
          { status: 400 }
        );
      }

      const buffer = await file.arrayBuffer();
      imageBase64 = Buffer.from(buffer).toString('base64');
    } else if (contentType.includes('application/json')) {
      const body = await request.json();
      imageBase64 = body.imageBase64;

      if (!imageBase64) {
        return NextResponse.json(
          { error: 'imageBase64 field is required in JSON body.' },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Unsupported content type. Use multipart/form-data or application/json.' },
        { status: 415 }
      );
    }

    // Forward to Supabase Edge Function (passa o token do usuário para o Edge)
    const edgeResponse = await fetch(`${EDGE_FUNCTION_URL}/identify-pest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${bearer}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        imageBase64,
        fazendaId: fazendaId ? parseInt(fazendaId) : undefined,
        talhaoId: talhaoId ? parseInt(talhaoId) : undefined,
        cameraId: cameraId ?? undefined,
      }),
    });

    if (!edgeResponse.ok) {
      const errorText = await edgeResponse.text();
      console.error('Edge Function error:', edgeResponse.status, errorText);
      return NextResponse.json(
        { error: 'Pest identification failed', details: errorText },
        { status: edgeResponse.status }
      );
    }

    const result = await edgeResponse.json();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      cameraId: cameraId ?? null,
      ...result,
    });
  } catch (error: any) {
    console.error('identify-pest API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    service: 'AGROV Pest Identification API',
    version: '1.0.0',
    endpoints: {
      'POST /api/identify-pest': {
        description: 'Identificação de pragas por imagem. Autenticação Supabase.',
        headers: {
          'Authorization': 'Bearer <access_token> (sessão Supabase)',
          'X-Fazenda-ID': 'Opcional. ID da fazenda',
          'X-Talhao-ID': 'Opcional. ID do talhão',
          'X-Camera-ID': 'Opcional. Identificador da câmera',
        },
        body: {
          multipart: 'Campo "image" em multipart/form-data',
          json: 'Objeto { imageBase64: "string" }',
        },
      },
    },
  });
}
