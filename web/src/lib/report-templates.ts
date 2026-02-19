/**
 * Shared report HTML templates for server-side PDF generation
 * Same templates used by the mobile app, adapted for the web API
 */

export interface ReportData {
  fazendaNome: string;
  areaMonitorada: string;
  dataRelatorio: string;
  responsavelTecnico: string;
  resumoExecutivo: {
    nivelInfestacao: string;
    principaisPragas: string[];
    principaisDoencas: string[];
    areasCriticas: string[];
    acoesImediatas: string;
  };
  pragas: Array<{
    nome: string;
    nomeCientifico?: string;
    taxaOcorrencia: string;
    pontosCriticos: string;
    estadioPredominante: string;
    riscoLavoura: string;
    manejoQuimico?: { produto: string; dose: string; intervalo: string };
    manejoBiologico?: { agente: string; dosagem: string };
    boasPraticas: string[];
  }>;
  doencas: Array<{
    nome: string;
    nomeCientifico?: string;
    nivelSeveridade: string;
    condicoesFavoraveis: string;
    talhoesAfetados: string;
    fungicida?: { nome: string; dose: string; intervalo: string };
    frequenciaInspecao: string;
    focosObservacao: string;
    intervaloReentrada: string;
    epiRecomendados: string;
  }>;
  comparativoHistorico: Array<{
    periodo: string;
    infestacaoGeral: string;
    variacao: string;
    comentario: string;
  }>;
  recomendacoes: string[];
  conclusao: string;
}

function buildPragasHTML(pragas: ReportData['pragas']): string {
  return pragas.map((p) => `
    <div style="margin-bottom:16px; padding:12px; background:#fafafa; border-radius:6px; border-left:3px solid __ACCENT__;">
      <h3 style="font-size:13px; margin-bottom:8px;">${p.nome} ${p.nomeCientifico ? `<em>(${p.nomeCientifico})</em>` : ''}</h3>
      <table style="width:100%; border-collapse:collapse; margin-bottom:8px;">
        <tr><td style="padding:4px 8px; border-bottom:1px solid #e5e7eb; font-weight:600; width:40%; font-size:10px;">Taxa de ocorrência</td><td style="padding:4px 8px; border-bottom:1px solid #e5e7eb; font-size:10px;">${p.taxaOcorrencia}</td></tr>
        <tr><td style="padding:4px 8px; border-bottom:1px solid #e5e7eb; font-weight:600; font-size:10px;">Pontos críticos</td><td style="padding:4px 8px; border-bottom:1px solid #e5e7eb; font-size:10px;">${p.pontosCriticos}</td></tr>
        <tr><td style="padding:4px 8px; border-bottom:1px solid #e5e7eb; font-weight:600; font-size:10px;">Risco à lavoura</td><td style="padding:4px 8px; border-bottom:1px solid #e5e7eb; font-size:10px;">${p.riscoLavoura}</td></tr>
      </table>
      ${p.manejoQuimico ? `<p style="font-size:10px;"><strong>Manejo Químico:</strong> ${p.manejoQuimico.produto} — Dose: ${p.manejoQuimico.dose}</p>` : ''}
      ${p.boasPraticas.length > 0 ? `<p style="font-size:10px; margin-top:4px;"><strong>Boas Práticas:</strong> ${p.boasPraticas.join('; ')}</p>` : ''}
    </div>`).join('');
}

function buildDoencasHTML(doencas: ReportData['doencas']): string {
  return doencas.map((d) => `
    <div style="margin-bottom:16px; padding:12px; background:#fafafa; border-radius:6px; border-left:3px solid __ACCENT__;">
      <h3 style="font-size:13px; margin-bottom:8px;">${d.nome} ${d.nomeCientifico ? `<em>(${d.nomeCientifico})</em>` : ''}</h3>
      <table style="width:100%; border-collapse:collapse; margin-bottom:8px;">
        <tr><td style="padding:4px 8px; border-bottom:1px solid #e5e7eb; font-weight:600; width:40%; font-size:10px;">Severidade</td><td style="padding:4px 8px; border-bottom:1px solid #e5e7eb; font-size:10px;">${d.nivelSeveridade}</td></tr>
        <tr><td style="padding:4px 8px; border-bottom:1px solid #e5e7eb; font-weight:600; font-size:10px;">Condições favoráveis</td><td style="padding:4px 8px; border-bottom:1px solid #e5e7eb; font-size:10px;">${d.condicoesFavoraveis}</td></tr>
        <tr><td style="padding:4px 8px; border-bottom:1px solid #e5e7eb; font-weight:600; font-size:10px;">Talhões afetados</td><td style="padding:4px 8px; border-bottom:1px solid #e5e7eb; font-size:10px;">${d.talhoesAfetados}</td></tr>
      </table>
      ${d.fungicida ? `<p style="font-size:10px;"><strong>Fungicida:</strong> ${d.fungicida.nome} — Dose: ${d.fungicida.dose}</p>` : ''}
    </div>`).join('');
}

export function generateReportHTML(data: ReportData, type: 'technical' | 'pest-disease'): string {
  const accent = type === 'technical' ? '#166534' : '#9333ea';
  const bgLight = type === 'technical' ? '#f0fdf4' : '#faf5ff';
  const subtitle = type === 'technical' ? 'Monitoramento Manual' : 'Monitoramento Automatizado — Sensores + IA';
  const mapSection = type === 'technical'
    ? '<div style="width:100%;height:180px;background:#e5e7eb;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:12px;">[Mapa de distribuição]</div>'
    : '<div style="width:100%;height:180px;background:linear-gradient(135deg,#22c55e 0%,#eab308 30%,#f97316 60%,#dc2626 100%);border-radius:8px;display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:600;">[Mapa de calor]</div>';

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Relatório</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;font-size:11px;line-height:1.5;padding:24px}</style></head><body>
<div style="border-bottom:3px solid ${accent};padding-bottom:16px;margin-bottom:20px;display:flex;justify-content:space-between;">
  <div><h1 style="font-size:18px;color:${accent}">Relatório Técnico</h1><h2 style="font-size:13px;color:#4b5563;font-weight:400">${subtitle}</h2></div>
  <div style="text-align:right;font-size:10px;color:#6b7280"><div style="font-size:14px;font-weight:700;color:${accent}">Fox Fieldcore</div></div>
</div>

<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-bottom:20px;padding:12px;background:${bgLight};border-radius:8px;">
  <div><div style="font-size:9px;color:#6b7280;text-transform:uppercase">Propriedade</div><div style="font-size:12px;font-weight:600">${data.fazendaNome}</div></div>
  <div><div style="font-size:9px;color:#6b7280;text-transform:uppercase">Área</div><div style="font-size:12px;font-weight:600">${data.areaMonitorada} ha</div></div>
  <div><div style="font-size:9px;color:#6b7280;text-transform:uppercase">Data</div><div style="font-size:12px;font-weight:600">${data.dataRelatorio}</div></div>
  <div><div style="font-size:9px;color:#6b7280;text-transform:uppercase">Responsável</div><div style="font-size:12px;font-weight:600">${data.responsavelTecnico}</div></div>
</div>

<h2 style="font-size:14px;color:${accent};border-bottom:1px solid #d1d5db;padding-bottom:6px;margin-bottom:12px">1. Resumo Executivo</h2>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
  <div style="padding:10px;background:${bgLight};border-radius:6px"><div style="font-size:9px;color:#6b7280;text-transform:uppercase">Nível de infestação</div><div style="font-size:11px;font-weight:500">${data.resumoExecutivo.nivelInfestacao}</div></div>
  <div style="padding:10px;background:${bgLight};border-radius:6px"><div style="font-size:9px;color:#6b7280;text-transform:uppercase">Principais pragas</div><div style="font-size:11px;font-weight:500">${data.resumoExecutivo.principaisPragas.join(', ')}</div></div>
  <div style="padding:10px;background:${bgLight};border-radius:6px"><div style="font-size:9px;color:#6b7280;text-transform:uppercase">Principais doenças</div><div style="font-size:11px;font-weight:500">${data.resumoExecutivo.principaisDoencas.join(', ')}</div></div>
  <div style="padding:10px;background:${bgLight};border-radius:6px"><div style="font-size:9px;color:#6b7280;text-transform:uppercase">Áreas críticas</div><div style="font-size:11px;font-weight:500">${data.resumoExecutivo.areasCriticas.join(', ')}</div></div>
</div>

<h2 style="font-size:14px;color:${accent};border-bottom:1px solid #d1d5db;padding-bottom:6px;margin-bottom:12px">2. ${type === 'technical' ? 'Mapa de Distribuição' : 'Mapa de Calor'}</h2>
${mapSection}
<div style="margin:12px 0 20px">
  <span style="font-size:9px;margin-right:12px">&#9632; <span style="color:#dc2626">Alto risco</span></span>
  <span style="font-size:9px;margin-right:12px">&#9632; <span style="color:#f97316">Médio risco</span></span>
  <span style="font-size:9px;margin-right:12px">&#9632; <span style="color:#eab308">Baixo risco</span></span>
  <span style="font-size:9px">&#9632; <span style="color:#22c55e">Estável</span></span>
</div>

<h2 style="font-size:14px;color:${accent};border-bottom:1px solid #d1d5db;padding-bottom:6px;margin-bottom:12px">3. Detalhamento por Praga</h2>
${buildPragasHTML(data.pragas).replace(/__ACCENT__/g, accent) || '<p style="color:#6b7280">Nenhuma praga identificada.</p>'}

<h2 style="font-size:14px;color:${accent};border-bottom:1px solid #d1d5db;padding-bottom:6px;margin-bottom:12px">4. Detalhamento por Doença</h2>
${buildDoencasHTML(data.doencas).replace(/__ACCENT__/g, accent) || '<p style="color:#6b7280">Nenhuma doença identificada.</p>'}

<h2 style="font-size:14px;color:${accent};border-bottom:1px solid #d1d5db;padding-bottom:6px;margin-bottom:12px">5. Comparativo Histórico</h2>
<table style="width:100%;border-collapse:collapse;margin-bottom:20px">
  <thead><tr style="background:${accent};color:white"><th style="padding:6px 8px;font-size:10px;text-align:left">Período</th><th style="padding:6px 8px;font-size:10px;text-align:left">Infestação</th><th style="padding:6px 8px;font-size:10px;text-align:left">Variação</th><th style="padding:6px 8px;font-size:10px;text-align:left">Comentário</th></tr></thead>
  <tbody>${data.comparativoHistorico.map(c => `<tr><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:10px">${c.periodo}</td><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:10px">${c.infestacaoGeral}</td><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:10px">${c.variacao}</td><td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;font-size:10px">${c.comentario}</td></tr>`).join('')}</tbody>
</table>

<h2 style="font-size:14px;color:${accent};border-bottom:1px solid #d1d5db;padding-bottom:6px;margin-bottom:12px">6. Recomendações</h2>
<ol style="margin:0 0 20px 16px">${data.recomendacoes.map(r => `<li style="margin-bottom:4px;font-size:11px">${r}</li>`).join('')}</ol>

<h2 style="font-size:14px;color:${accent};border-bottom:1px solid #d1d5db;padding-bottom:6px;margin-bottom:12px">7. Conclusão</h2>
<div style="padding:12px;background:${bgLight};border-radius:8px;margin-bottom:20px"><p style="font-size:11px">${data.conclusao}</p></div>

<h2 style="font-size:14px;color:${accent};border-bottom:1px solid #d1d5db;padding-bottom:6px;margin-bottom:12px">8. Assinatura</h2>
<table style="width:100%;margin-top:20px">
  <tr><td style="padding:12px 8px;border-bottom:1px solid #d1d5db;font-weight:600;width:30%;font-size:11px">Responsável Técnico</td><td style="padding:12px 8px;border-bottom:1px solid #d1d5db;font-size:11px">____________________________</td></tr>
  <tr><td style="padding:12px 8px;border-bottom:1px solid #d1d5db;font-weight:600;font-size:11px">Engenheiro Agrônomo</td><td style="padding:12px 8px;border-bottom:1px solid #d1d5db;font-size:11px">____________________________</td></tr>
  <tr><td style="padding:12px 8px;border-bottom:1px solid #d1d5db;font-weight:600;font-size:11px">CREA</td><td style="padding:12px 8px;border-bottom:1px solid #d1d5db;font-size:11px">____________________________</td></tr>
  <tr><td style="padding:12px 8px;border-bottom:1px solid #d1d5db;font-weight:600;font-size:11px">Data</td><td style="padding:12px 8px;border-bottom:1px solid #d1d5db;font-size:11px">____________________________</td></tr>
</table>

<div style="text-align:center;font-size:9px;color:#9ca3af;margin-top:20px;padding-top:8px;border-top:1px solid #e5e7eb">
  Fox Fieldcore — Relatório gerado em ${data.dataRelatorio}
</div>
</body></html>`;

  return html;
}
