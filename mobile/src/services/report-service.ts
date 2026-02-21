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
import { getHeatmapSVG } from '@/components/maps/heatmap';
import { parseTalhaoCoordinates } from '@/hooks/use-supabase-data';
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
      supabase.from('scouts').select('*, scout_pragas(*, embrapa_recomendacoes(nome_praga, nome_cientifico, tipo, descricao))').eq('fazenda_id', fazendaId).order('created_at', { ascending: false }).limit(20),
    ]);

    const allPragas: any[] = [];
    if (scoutsRes.data) {
      for (const scout of scoutsRes.data) {
        const pragas = (scout as any).scout_pragas ?? [];
        allPragas.push(...pragas);
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
    const er = p.embrapa_recomendacoes ?? {};
    const name = er.nome_praga ?? 'Desconhecida';
    if (!pragasByName.has(name)) pragasByName.set(name, []);
    pragasByName.get(name)!.push(p);
  }

  const pragaItems = Array.from(pragasByName.entries()).map(([nome, items]) => {
    const totalCount = items.reduce((s: number, i: any) => s + (i.contagem ?? 1), 0);
    const highPriority = items.some((i: any) => i.prioridade === 'ALTA');
    const firstEr = items[0]?.embrapa_recomendacoes ?? {};
    const recomendacao = firstEr.descricao ?? undefined;

    return {
      nome,
      nomeCientifico: firstEr.nome_cientifico ?? undefined,
      taxaOcorrencia: `${totalCount} ocorrência(s)`,
      pontosCriticos: items.map((i: any) => `Scout #${i.scout_id}`).slice(0, 3).join(', '),
      estadioPredominante: 'Não determinado',
      riscoLavoura: highPriority ? 'Alto' : 'Médio',
      recomendacao,
      boasPraticas: [
        'Monitorar continuamente a área afetada',
        'Registrar aplicações no sistema Fox Fieldcore',
        'Respeitar intervalo de segurança',
      ],
    };
  });

  const pragaNome = (x: any) => (x.embrapa_recomendacoes ?? {}).nome_praga;
  const pragasList = pragaItems.filter(p => pragas.find((x: any) => pragaNome(x) === p.nome && (x.tipo_praga ?? (x.embrapa_recomendacoes ?? {}).tipo) === 'PRAGA'));
  const doencasList = pragaItems.filter(p => pragas.find((x: any) => pragaNome(x) === p.nome && (x.tipo_praga ?? (x.embrapa_recomendacoes ?? {}).tipo) === 'DOENCA'));

  const principaisPragas = pragasList.map(p => p.nome).slice(0, 5);
  const principaisDoencas = doencasList.map(d => d.nome).slice(0, 5);
  const areasCriticas = talhoes.filter(t => {
    return pragas.some((p: any) => p.prioridade === 'ALTA');
  }).map(t => t.nome).slice(0, 3);

  const nivelInfestacao = pragas.length === 0 ? 'Baixo' :
    pragas.filter((p: any) => p.prioridade === 'ALTA').length > pragas.length * 0.3 ? 'Alto' :
    pragas.filter((p: any) => p.prioridade === 'MEDIA' || p.prioridade === 'ALTA').length > pragas.length * 0.3 ? 'Moderado' : 'Baixo';

  const aplicativo = 'FOX-FIELDCORE';
  const areaMaiorIncidencia = areasCriticas.length > 0 ? areasCriticas[0] : 'Nenhuma área com incidência relevante';
  const dataProximo = new Date(now);
  dataProximo.setDate(dataProximo.getDate() + 7);
  const dataProximoRelatorio = dataProximo.toLocaleDateString('pt-BR');
  const periodoDatas = `${new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR')} a ${dataRelatorio}`;

  const heatMapPoints = pragas
    .filter((p: any) => p.coordinates?.type === 'Point' && Array.isArray(p.coordinates?.coordinates) && p.coordinates.coordinates.length >= 2)
    .map((p: any) => {
      const [lng, lat] = p.coordinates.coordinates;
      const contagem = p.contagem ?? 1;
      const intensity = contagem <= 0 ? 0.05 : Math.min(1, 1 - Math.exp(-contagem / 4));
      return {
        lat: Number(lat),
        lng: Number(lng),
        intensity,
      };
    });
  const talhoesForSvg = (talhoes ?? []).map((t: any) => {
    const coords = parseTalhaoCoordinates(t.coordinates);
    return { nome: t.nome ?? '', color: t.color ?? undefined, coords };
  }).filter((t: { coords: number[][] }) => t.coords.length >= 3);

  return {
    aplicativo,
    fazendaNome: fazenda?.nome ?? 'Fazenda não especificada',
    areaMonitorada: String(fazenda?.area_total ?? talhoes.reduce((s: number, t: any) => s + (Number(t.area) || 0), 0)),
    dataRelatorio,
    responsavelTecnico: responsavel || 'Não informado',
    periodoDatas,
    resumoExecutivo: {
      nivelInfestacao,
      principaisPragas: principaisPragas.length > 0 ? principaisPragas : ['Nenhuma detectada'],
      principaisDoencas: principaisDoencas.length > 0 ? principaisDoencas : ['Nenhuma detectada'],
      areasCriticas: areasCriticas.length > 0 ? areasCriticas : ['Nenhuma área crítica'],
      acoesImediatas: pragas.length === 0
        ? 'Manter monitoramento regular conforme calendário.'
        : `Intensificar monitoramento nas áreas com detecção de pragas. ${principaisPragas.length > 0 ? `Priorizar controle de ${principaisPragas[0]}.` : ''}`,
    },
    observacoesTecnicas: {
      areaMaiorIncidencia,
      tendencia48h: pragas.length === 0 ? 'Estabilidade' : 'Acompanhar evolução (dados em tempo real)',
      condicoesClimaticas: 'Umidade, temperatura e precipitação conforme estações do aplicativo',
    },
    pragas: pragasList.length > 0 ? pragasList : pragaItems,
    doencas: doencasList.map(d => ({
      nome: d.nome,
      nomeCientifico: d.nomeCientifico,
      nivelSeveridade: d.riscoLavoura === 'Alto' ? 'Severo' : 'Moderado',
      condicoesFavoraveis: 'Alta umidade, temperatura amena',
      talhoesAfetados: d.pontosCriticos,
      fungicida: undefined,
      frequenciaInspecao: 'A cada 2 dias',
      focosObservacao: d.pontosCriticos,
      intervaloReentrada: '24 horas',
      epiRecomendados: 'Luvas, máscara, óculos, macacão impermeável',
    })),
    comparativoHistorico: [
      { periodo: 'Semana Atual', infestacaoGeral: pragas.length > 0 ? `${pragas.length} ocorrência(s)` : '0%', variacao: '—', comentario: 'Situação atual' },
      { periodo: 'Semana Anterior', infestacaoGeral: '—', variacao: '—', comentario: 'Tendência' },
      { periodo: 'Média do Mês', infestacaoGeral: '—', variacao: '—', comentario: 'Estabilidade' },
    ],
    recomendacoes: [
      'Intensificar monitoramento em ' + (areasCriticas.length > 0 ? areasCriticas[0] : 'áreas de maior incidência'),
      `Ajustar calendário de aplicação para ${dataProximoRelatorio}`,
      'Aumentar uso de controle biológico em áreas com reincidência',
      'Revisar condições de irrigação para evitar ambiente favorável a pragas e doenças',
      'Realizar limpeza de equipamentos entre talhões',
      'Documentar todas as aplicações realizadas',
    ],
    conclusao: pragas.length === 0
      ? `O monitoramento realizado em ${dataRelatorio} não identificou focos críticos de pragas ou doenças na propriedade ${fazenda?.nome ?? ''}. Recomenda-se manter o calendário regular de monitoramento.`
      : `O sistema ${aplicativo} detectou pontos críticos que exigem atenção imediata, principalmente em ${areaMaiorIncidencia}. Seguindo as recomendações acima, a tendência é reduzir significativamente o risco nas próximas 48 a 72 horas.`,
    conclusaoParagrafo2: pragas.length === 0
      ? 'Nenhum foco crítico identificado. Manter monitoramento de rotina.'
      : `O monitoramento realizado em ${dataRelatorio} identificou ${pragas.length} ocorrência(s) de pragas/doenças na propriedade ${fazenda?.nome ?? ''}. ${principaisPragas.length > 0 ? `Principais pragas: ${principaisPragas.join(', ')}.` : ''} Recomenda-se seguir as ações de manejo indicadas e agendar novo monitoramento em 7 dias.`,
    dataProximoRelatorio,
    heatmapSvg: getHeatmapSVG(heatMapPoints, talhoesForSvg),
  } as TechnicalReportData | PestDiseaseReportData;
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
 * Gera PDF de Relatório de Pragas e Doenças (monitoramento automatizado).
 * Se `heatmapImageBase64` for fornecido (data:image/…), usa a imagem real do heatmap
 * capturada pelo componente HeatmapCapture; caso contrário, usa SVG estático.
 */
export async function generatePestDiseaseReport(
  fazendaId: number,
  responsavel: string,
  heatmapImageBase64?: string,
): Promise<ReportResult> {
  logger.info('Gerando Relatório de Pragas e Doenças', { fazendaId, hasImage: !!heatmapImageBase64 });

  const rawData = await fetchReportData(fazendaId);
  const reportData = buildReportData(rawData, responsavel) as PestDiseaseReportData;

  if (heatmapImageBase64) {
    reportData.heatmapImage = heatmapImageBase64;
  }

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
