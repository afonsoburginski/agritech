import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { generateReportHTML, type ReportData } from '@/lib/report-templates';

/**
 * POST /api/reports/generate
 * 
 * Generates a PDF report from real Supabase data.
 * Returns the HTML that can be converted to PDF client-side or server-side.
 * 
 * Body: { type: 'technical' | 'pest-disease', fazendaId: number, responsavel?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, fazendaId, responsavel } = body;

    if (!type || !['technical', 'pest-disease'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Use "technical" or "pest-disease".' },
        { status: 400 }
      );
    }

    if (!fazendaId) {
      return NextResponse.json(
        { error: 'fazendaId is required.' },
        { status: 400 }
      );
    }

    // Fetch data from Supabase
    const supabaseAdmin = getSupabaseAdmin();
    const [fazendaRes, talhoesRes, scoutsRes] = await Promise.all([
      supabaseAdmin.from('fazendas').select('*').eq('id', fazendaId).single(),
      supabaseAdmin.from('talhoes').select('*').eq('fazenda_id', fazendaId),
      supabaseAdmin
        .from('scouts')
        .select('*, scout_pragas(*, embrapa_recomendacoes(nome_praga, nome_cientifico, tipo, descricao))')
        .eq('fazenda_id', fazendaId)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    const fazenda = fazendaRes.data;
    const talhoes = talhoesRes.data ?? [];

    const allPragas: any[] = [];
    if (scoutsRes.data) {
      for (const scout of scoutsRes.data) {
        const pragas = (scout as any).scout_pragas ?? [];
        allPragas.push(...pragas);
      }
    }

    const pragasByName = new Map<string, any[]>();
    for (const p of allPragas) {
      const er = p.embrapa_recomendacoes ?? {};
      const name = er.nome_praga ?? 'Desconhecida';
      if (!pragasByName.has(name)) pragasByName.set(name, []);
      pragasByName.get(name)!.push(p);
    }

    const pragaItems = Array.from(pragasByName.entries()).map(([nome, items]) => {
      const totalCount = items.reduce((s: number, i: any) => s + (i.contagem ?? 1), 0);
      const highPriority = items.some((i: any) => i.prioridade === 'ALTA');
      const firstEr = items[0]?.embrapa_recomendacoes ?? {};

      return {
        nome,
        nomeCientifico: firstEr.nome_cientifico ?? undefined,
        taxaOcorrencia: `${totalCount} ocorrência(s)`,
        pontosCriticos: items.map((i: any) => `Scout #${i.scout_id}`).slice(0, 3).join(', '),
        estadioPredominante: 'Não determinado',
        riscoLavoura: highPriority ? 'Alto' : 'Médio',
        recomendacao: firstEr.descricao ?? undefined,
        boasPraticas: [
          'Monitorar continuamente a área afetada',
          'Registrar aplicações no sistema Fox Fieldcore',
          'Respeitar intervalo de segurança',
        ],
      };
    });

    const principaisPragas = pragaItems.map(p => p.nome).slice(0, 5);
    const nivelInfestacao = allPragas.length === 0 ? 'Baixo' :
      allPragas.filter((p: any) => p.prioridade === 'ALTA').length > allPragas.length * 0.3 ? 'Alto' : 'Moderado';

    const now = new Date();
    const reportData: ReportData = {
      fazendaNome: fazenda?.nome ?? 'Fazenda não especificada',
      areaMonitorada: String(fazenda?.area_total ?? talhoes.reduce((s: number, t: any) => s + (Number(t.area) || 0), 0)),
      dataRelatorio: now.toLocaleDateString('pt-BR'),
      responsavelTecnico: responsavel ?? 'Não informado',
      resumoExecutivo: {
        nivelInfestacao,
        principaisPragas: principaisPragas.length > 0 ? principaisPragas : ['Nenhuma detectada'],
        principaisDoencas: ['Nenhuma detectada'],
        areasCriticas: talhoes.slice(0, 3).map((t: any) => t.nome),
        acoesImediatas: allPragas.length === 0
          ? 'Manter monitoramento regular.'
          : `Intensificar monitoramento. Priorizar controle de ${principaisPragas[0] ?? 'pragas detectadas'}.`,
      },
      pragas: pragaItems,
      doencas: [],
      comparativoHistorico: [
        { periodo: type === 'technical' ? 'Último monitoramento' : 'Semana Atual', infestacaoGeral: `${allPragas.length} ocorrência(s)`, variacao: '—', comentario: 'Situação atual' },
        { periodo: type === 'technical' ? 'Monitoramento anterior' : 'Semana Anterior', infestacaoGeral: '—', variacao: '—', comentario: 'Dados insuficientes' },
        { periodo: type === 'technical' ? 'Média do período' : 'Média do Mês', infestacaoGeral: '—', variacao: '—', comentario: 'Dados insuficientes' },
      ],
      recomendacoes: [
        'Intensificar monitoramento nas áreas com maior incidência',
        'Ajustar calendário de aplicação conforme resultados',
        'Aumentar frequência de inspeções em áreas com reincidência',
        'Revisar condições de irrigação para mitigar propagação',
        'Realizar limpeza de equipamentos entre talhões',
        'Documentar todas as aplicações realizadas no Fox Fieldcore',
      ],
      conclusao: allPragas.length === 0
        ? `Monitoramento em ${now.toLocaleDateString('pt-BR')}: nenhum foco crítico detectado em ${fazenda?.nome ?? 'a propriedade'}. Manter calendário regular.`
        : `Monitoramento em ${now.toLocaleDateString('pt-BR')}: ${allPragas.length} ocorrência(s) em ${fazenda?.nome ?? 'a propriedade'}. Principais: ${principaisPragas.join(', ')}. Seguir recomendações e reagendar em 7 dias.`,
    };

    const html = generateReportHTML(reportData, type);

    // Return HTML (client can render or convert to PDF)
    const format = request.nextUrl.searchParams.get('format');

    if (format === 'html') {
      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Default: return JSON with HTML and metadata
    return NextResponse.json({
      success: true,
      type,
      fazendaId,
      generatedAt: now.toISOString(),
      html,
      data: reportData,
    });
  } catch (error: any) {
    console.error('Report generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate report', message: error.message },
      { status: 500 }
    );
  }
}
