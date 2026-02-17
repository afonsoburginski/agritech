/**
 * Report Service - Geração de relatórios PDF
 * 
 * Usa expo-print para gerar PDFs a partir de templates HTML
 * e expo-sharing para compartilhar os arquivos gerados.
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { logger } from './logger';
import { generateTechnicalReportHTML, type TechnicalReportData } from '@/templates/report-technical';
import { generatePestDiseaseReportHTML, type PestDiseaseReportData } from '@/templates/report-pest-disease';
import { supabase, isSupabaseConfigured } from './supabase';

export type ReportType = 'technical' | 'pest-disease';

interface ReportResult {
  uri: string;
  type: ReportType;
}

/**
 * Busca dados reais do Supabase para preencher os relatórios
 */
async function fetchReportData(fazendaId: number): Promise<{
  fazenda: any;
  talhoes: any[];
  scouts: any[];
  pragas: any[];
}> {
  if (!isSupabaseConfigured() || !supabase) {
    return { fazenda: null, talhoes: [], scouts: [], pragas: [] };
  }

  try {
    const [fazendaRes, talhoesRes, scoutsRes] = await Promise.all([
      supabase.from('fazendas').select('*').eq('id', fazendaId).single(),
      supabase.from('talhoes').select('*').eq('fazenda_id', fazendaId),
      supabase.from('scouts').select('*, scout_markers(*, scout_marker_pragas(*))').eq('fazenda_id', fazendaId).order('created_at', { ascending: false }).limit(20),
    ]);

    const allPragas: any[] = [];
    if (scoutsRes.data) {
      for (const scout of scoutsRes.data) {
        const markers = (scout as any).scout_markers ?? [];
        for (const marker of markers) {
          const pests = marker.scout_marker_pragas ?? [];
          allPragas.push(...pests);
        }
      }
    }

    return {
      fazenda: fazendaRes.data,
      talhoes: talhoesRes.data ?? [],
      scouts: scoutsRes.data ?? [],
      pragas: allPragas,
    };
  } catch (err: any) {
    logger.error('Erro ao buscar dados para relatório', { error: err.message });
    return { fazenda: null, talhoes: [], scouts: [], pragas: [] };
  }
}

/**
 * Transforma dados brutos em formato de relatório
 */
function buildReportData(
  rawData: Awaited<ReturnType<typeof fetchReportData>>,
  responsavel: string,
): TechnicalReportData | PestDiseaseReportData {
  const { fazenda, talhoes, pragas } = rawData;
  const now = new Date();
  const dataRelatorio = now.toLocaleDateString('pt-BR');

  const pragasByName = new Map<string, any[]>();
  for (const p of pragas) {
    const name = p.praga_nome ?? 'Desconhecida';
    if (!pragasByName.has(name)) pragasByName.set(name, []);
    pragasByName.get(name)!.push(p);
  }

  const pragaItems = Array.from(pragasByName.entries()).map(([nome, items]) => {
    const totalCount = items.reduce((s: number, i: any) => s + (i.contagem ?? 1), 0);
    const avgConfidence = items.reduce((s: number, i: any) => s + (i.openai_confidence ?? 0), 0) / items.length;
    const highPriority = items.some((i: any) => i.prioridade === 'ALTA');
    const embrapaProds = items.find((i: any) => i.embrapa_produtos_recomendados)?.embrapa_produtos_recomendados ?? [];

    return {
      nome,
      nomeCientifico: items[0]?.praga_nome_cientifico ?? undefined,
      taxaOcorrencia: `${totalCount} ocorrência(s) | Confiança IA: ${(avgConfidence * 100).toFixed(0)}%`,
      pontosCriticos: items.map((i: any) => `Marker #${i.marker_id}`).slice(0, 3).join(', '),
      estadioPredominante: items[0]?.estadio_fenologico ?? 'Não determinado',
      riscoLavoura: highPriority ? 'Alto' : 'Médio',
      manejoQuimico: embrapaProds[0] ? {
        produto: embrapaProds[0].nome ?? 'Consultar AGROFIT',
        dose: 'Conforme bula',
        intervalo: 'Conforme bula',
      } : undefined,
      boasPraticas: [
        'Monitorar continuamente a área afetada',
        'Registrar aplicações no sistema AGROV',
        'Respeitar intervalo de segurança',
      ],
    };
  });

  const pragasList = pragaItems.filter(p => pragas.find((x: any) => x.praga_nome === p.nome && x.tipo_praga === 'PRAGA'));
  const doencasList = pragaItems.filter(p => pragas.find((x: any) => x.praga_nome === p.nome && x.tipo_praga === 'DOENCA'));

  const principaisPragas = pragasList.map(p => p.nome).slice(0, 5);
  const principaisDoencas = doencasList.map(d => d.nome).slice(0, 5);
  const areasCriticas = talhoes.filter(t => {
    return pragas.some((p: any) => p.prioridade === 'ALTA');
  }).map(t => t.nome).slice(0, 3);

  const nivelInfestacao = pragas.length === 0 ? 'Baixo' :
    pragas.filter((p: any) => p.prioridade === 'ALTA').length > pragas.length * 0.3 ? 'Alto' :
    pragas.filter((p: any) => p.prioridade === 'MEDIA' || p.prioridade === 'ALTA').length > pragas.length * 0.3 ? 'Moderado' : 'Baixo';

  return {
    fazendaNome: fazenda?.nome ?? 'Fazenda não especificada',
    areaMonitorada: String(fazenda?.area_total ?? talhoes.reduce((s: number, t: any) => s + (Number(t.area) || 0), 0)),
    dataRelatorio,
    responsavelTecnico: responsavel || 'Não informado',
    resumoExecutivo: {
      nivelInfestacao,
      principaisPragas: principaisPragas.length > 0 ? principaisPragas : ['Nenhuma detectada'],
      principaisDoencas: principaisDoencas.length > 0 ? principaisDoencas : ['Nenhuma detectada'],
      areasCriticas: areasCriticas.length > 0 ? areasCriticas : ['Nenhuma área crítica'],
      acoesImediatas: pragas.length === 0
        ? 'Manter monitoramento regular conforme calendário.'
        : `Intensificar monitoramento nas áreas com detecção de pragas. ${principaisPragas.length > 0 ? `Priorizar controle de ${principaisPragas[0]}.` : ''}`,
    },
    pragas: pragasList.length > 0 ? pragasList : pragaItems,
    doencas: doencasList.map(d => ({
      nome: d.nome,
      nomeCientifico: d.nomeCientifico,
      nivelSeveridade: d.riscoLavoura === 'Alto' ? 'Severo' : 'Moderado',
      condicoesFavoraveis: 'Alta umidade, temperatura amena',
      talhoesAfetados: d.pontosCriticos,
      fungicida: d.manejoQuimico ? {
        nome: d.manejoQuimico.produto,
        dose: d.manejoQuimico.dose,
        intervalo: d.manejoQuimico.intervalo,
      } : undefined,
      frequenciaInspecao: 'A cada 2 dias',
      focosObservacao: d.pontosCriticos,
      intervaloReentrada: '24 horas',
      epiRecomendados: 'Luvas, máscara, óculos, macacão impermeável',
    })),
    comparativoHistorico: [
      { periodo: 'Último monitoramento', infestacaoGeral: `${pragas.length} ocorrência(s)`, variacao: '—', comentario: 'Situação atual' },
      { periodo: 'Monitoramento anterior', infestacaoGeral: '—', variacao: '—', comentario: 'Dados insuficientes' },
      { periodo: 'Média do período', infestacaoGeral: '—', variacao: '—', comentario: 'Dados insuficientes' },
    ],
    recomendacoes: [
      `Intensificar monitoramento nas áreas com maior incidência`,
      'Ajustar calendário de aplicação conforme resultados',
      'Aumentar frequência de inspeções em áreas com reincidência',
      'Revisar condições de irrigação para mitigar propagação de doenças',
      'Realizar limpeza de equipamentos entre talhões para evitar contaminação cruzada',
      'Documentar todas as aplicações realizadas no AGROV',
    ],
    conclusao: pragas.length === 0
      ? `O monitoramento realizado em ${dataRelatorio} não identificou focos críticos de pragas ou doenças na propriedade ${fazenda?.nome ?? ''}. Recomenda-se manter o calendário regular de monitoramento.`
      : `O monitoramento realizado em ${dataRelatorio} identificou ${pragas.length} ocorrência(s) de pragas/doenças na propriedade ${fazenda?.nome ?? ''}. ${principaisPragas.length > 0 ? `As principais pragas detectadas foram: ${principaisPragas.join(', ')}.` : ''} Recomenda-se seguir as ações de manejo indicadas neste relatório e agendar novo monitoramento em 7 dias.`,
  };
}

/**
 * Gera PDF de Relatório Técnico (monitoramento manual)
 */
export async function generateTechnicalReport(
  fazendaId: number,
  responsavel: string,
): Promise<ReportResult> {
  logger.info('Gerando Relatório Técnico', { fazendaId });

  const rawData = await fetchReportData(fazendaId);
  const reportData = buildReportData(rawData, responsavel) as TechnicalReportData;
  const html = generateTechnicalReportHTML(reportData);

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  logger.info('Relatório Técnico gerado', { uri });

  return { uri, type: 'technical' };
}

/**
 * Gera PDF de Relatório de Pragas e Doenças (monitoramento automatizado)
 */
export async function generatePestDiseaseReport(
  fazendaId: number,
  responsavel: string,
): Promise<ReportResult> {
  logger.info('Gerando Relatório de Pragas e Doenças', { fazendaId });

  const rawData = await fetchReportData(fazendaId);
  const reportData = buildReportData(rawData, responsavel) as PestDiseaseReportData;
  const html = generatePestDiseaseReportHTML(reportData);

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  logger.info('Relatório de Pragas e Doenças gerado', { uri });

  return { uri, type: 'pest-disease' };
}

/**
 * Visualiza PDF usando o visualizador nativo
 */
export async function previewReport(uri: string): Promise<void> {
  await Print.printAsync({ uri });
}

/**
 * Compartilha PDF gerado
 */
export async function shareReport(uri: string): Promise<void> {
  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Compartilhar Relatório',
      UTI: 'com.adobe.pdf',
    });
  } else {
    throw new Error('Compartilhamento não disponível neste dispositivo');
  }
}
