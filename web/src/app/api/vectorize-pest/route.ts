import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? ''

async function getSupabaseClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch { /* Server Component context */ }
        },
      },
    }
  )
}

/**
 * POST /api/vectorize-pest
 *
 * - ?preview=true: only analyze image with ChatGPT Vision, return suggested data (no save).
 *   Body: multipart/form-data with "image" (File).
 *
 * - No query: save to DB. Body: multipart/form-data with:
 *   - image: File (required)
 *   - nome_praga, nome_cientifico, tipo, descricao_visual, caracteristicas_chave (JSON string)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const imageFile = formData.get('image') as File | null
    const preview = request.nextUrl.searchParams.get('preview') === 'true'

    if (!imageFile) {
      return NextResponse.json({ error: 'image is required' }, { status: 400 })
    }

    const buffer = await imageFile.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const mimeType = imageFile.type || 'image/jpeg'

    const systemPrompt = `Você é um entomologista especialista em pragas agrícolas brasileiras. Analise a imagem (foto ou ilustração de inseto, praga, erva daninha ou doença) e forneça dados para referência. Responda SOMENTE em JSON válido:
{
  "descricao_visual": "Descrição visual detalhada: cores, formatos, padrões, texturas e características morfológicas distintas",
  "caracteristicas_chave": ["lista", "de", "características", "visuais", "para", "identificação"],
  "nome_sugerido": "Nome popular em português",
  "nome_cientifico_sugerido": "Nome científico se identificável, senão null",
  "tipo_sugerido": "INSETO | ERVA_DANINHA | DOENCA",
  "confianca": 0.85
}`

    const userPrompt = preview
      ? 'Analise esta imagem e identifique: nome popular, nome científico (se possível), tipo (inseto, erva daninha ou doença), descrição visual detalhada e lista de características-chave para identificação.'
      : `Analise esta imagem. Dados informados pelo usuário: "${formData.get('nome_praga') || ''}" ${formData.get('nome_cientifico') ? `(${formData.get('nome_cientifico')})` : ''}. Tipo: ${formData.get('tipo') || 'INSETO'}. Gere descrição visual e características-chave.`

    const visionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
            ],
          },
        ],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    })

    if (!visionResponse.ok) {
      const errText = await visionResponse.text()
      console.error('OpenAI Vision error:', errText)
      return NextResponse.json(
        { error: 'OpenAI Vision analysis failed', details: errText },
        { status: 502 }
      )
    }

    const visionData = await visionResponse.json()
    const aiContent = visionData.choices?.[0]?.message?.content ?? '{}'
    let parsed: any = {}
    try {
      const cleaned = aiContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      parsed = JSON.parse(cleaned)
    } catch {
      parsed = {
        descricao_visual: aiContent,
        caracteristicas_chave: [],
        nome_sugerido: 'Praga não identificada',
        nome_cientifico_sugerido: null,
        tipo_sugerido: 'INSETO',
        confianca: 0.5,
      }
    }

    if (preview) {
      return NextResponse.json({
        success: true,
        preview: true,
        analysis: {
          nome_praga: parsed.nome_sugerido ?? parsed.nome_praga ?? 'Praga identificada',
          nome_cientifico: parsed.nome_cientifico_sugerido ?? parsed.nome_cientifico ?? null,
          tipo: parsed.tipo_sugerido ?? 'INSETO',
          descricao_visual: parsed.descricao_visual ?? null,
          caracteristicas_chave: Array.isArray(parsed.caracteristicas_chave) ? parsed.caracteristicas_chave : [],
          confianca: parsed.confianca ?? 0.5,
        },
      })
    }

    const nomePraga = (formData.get('nome_praga') as string) || parsed.nome_sugerido || 'Praga'
    const nomeCientifico = (formData.get('nome_cientifico') as string) || parsed.nome_cientifico_sugerido || null
    const tipo = (formData.get('tipo') as string) || parsed.tipo_sugerido || 'INSETO'
    const descricaoVisual = (formData.get('descricao_visual') as string) || parsed.descricao_visual || null
    let caracteristicasChave: string[] = []
    try {
      const raw = formData.get('caracteristicas_chave') as string
      caracteristicasChave = raw ? JSON.parse(raw) : (parsed.caracteristicas_chave || [])
    } catch {
      caracteristicasChave = parsed.caracteristicas_chave || []
    }

    const storagePath = `vectorization/${Date.now()}_${imageFile.name}`
    const { error: uploadError } = await supabase.storage
      .from('pest-images')
      .upload(storagePath, Buffer.from(buffer), { contentType: mimeType })

    let imagemUrl: string | null = null
    if (!uploadError) {
      const { data: urlData } = supabase.storage.from('pest-images').getPublicUrl(storagePath)
      imagemUrl = urlData.publicUrl
    }

    let embedding: number[] | null = null
    try {
      const embeddingText = `${nomePraga}. ${descricaoVisual ?? ''}. ${caracteristicasChave.join(', ')}`
      const embResponse = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({ model: 'text-embedding-3-small', input: embeddingText }),
      })
      if (embResponse.ok) {
        const embData = await embResponse.json()
        embedding = embData.data?.[0]?.embedding ?? null
      }
    } catch (e) {
      console.warn('Embedding generation failed (non-critical):', e)
    }

    const { data: inserted, error: insertError } = await supabase
      .from('pest_reference_vectors')
      .insert({
        nome_praga: nomePraga,
        nome_cientifico: nomeCientifico,
        tipo,
        descricao_visual: descricaoVisual,
        caracteristicas_chave: caracteristicasChave,
        imagem_referencia_url: imagemUrl,
        embedding: embedding ? `[${embedding.join(',')}]` : null,
        fonte: 'CHATGPT',
        confianca: parsed.confianca ?? null,
        created_by: user.id,
      })
      .select()
      .single()

    if (insertError) {
      console.error('DB insert error:', insertError)
      return NextResponse.json(
        { error: 'Failed to save vectorization', details: insertError.message },
        { status: 500 }
      )
    }

    // Ícone = mesma imagem de referência (sem bucket extra)
    if (imagemUrl && inserted.id) {
      await supabase
        .from('pest_reference_vectors')
        .update({ icone_url: imagemUrl, updated_at: new Date().toISOString() })
        .eq('id', inserted.id)
    }

    return NextResponse.json({
      success: true,
      data: { ...inserted, icone_url: imagemUrl ?? inserted.icone_url },
    })
  } catch (error: any) {
    console.error('Vectorize-pest error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}
