/**
 * Template HTML - Relatório de Pragas e Doenças
 * Layout e estrutura idênticos ao modelo oficial (preto e branco).
 */

export interface PestDiseaseReportData {
  aplicativo: string;
  fazendaNome: string;
  areaMonitorada: string;
  dataRelatorio: string;
  responsavelTecnico: string;
  periodoDatas: string;
  resumoExecutivo: {
    nivelInfestacao: string;
    principaisPragas: string[];
    principaisDoencas: string[];
    areasCriticas: string[];
    acoesImediatas: string;
  };
  observacoesTecnicas: {
    areaMaiorIncidencia: string;
    tendencia48h: string;
    condicoesClimaticas: string;
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
  conclusaoParagrafo2: string;
  dataProximoRelatorio: string;
  /** SVG do mapa de calor (fallback) */
  heatmapSvg?: string;
  /** Imagem base64 (data:image/jpeg;base64,...) do heatmap real capturado do app */
  heatmapImage?: string;
  /** Logo do sistema em base64 para o header do relatório */
  reportLogoBase64?: string | null;
  /** Métricas do mapa de calor para cards ao lado do mapa */
  heatmapSummary?: {
    totalFocos: string;
    talhoesAfetados: string;
    nivelRiscoPredominante: string;
    areaMaiorIncidencia: string;
  };
}

export function generatePestDiseaseReportHTML(data: PestDiseaseReportData): string {
  const pragasHTML = data.pragas.map((p, i) => `
    <div class="section-block">
      <h3>3.${i + 1} ${p.nome}${p.nomeCientifico ? ` — ${p.nomeCientifico}` : ''}</h3>
      <table class="data-table">
        <tr><td class="label">Taxa de ocorrência</td><td>${p.taxaOcorrencia}</td></tr>
        <tr><td class="label">Pontos críticos</td><td>${p.pontosCriticos}</td></tr>
        <tr><td class="label">Estágio predominante</td><td>${p.estadioPredominante}</td></tr>
        <tr><td class="label">Risco à lavoura</td><td>${p.riscoLavoura}</td></tr>
      </table>
      <p class="subtitle">Recomendações do ${data.aplicativo}</p>
      ${p.manejoQuimico ? `
      <p><strong>Manejo Químico:</strong></p>
      <ul>
        <li>Produto: ${p.manejoQuimico.produto}</li>
        <li>Dose: ${p.manejoQuimico.dose}</li>
        <li>Intervalo de aplicação: ${p.manejoQuimico.intervalo}</li>
      </ul>` : '<p><strong>Manejo Químico:</strong> Não aplicável ou consultar técnico.</p>'}
      ${p.manejoBiologico ? `
      <p><strong>Manejo Biológico:</strong></p>
      <ul>
        <li>Agente de controle: ${p.manejoBiologico.agente}</li>
        <li>Dosagem: ${p.manejoBiologico.dosagem}</li>
      </ul>` : '<p><strong>Manejo Biológico:</strong> Não aplicável ou consultar técnico.</p>'}
      <p><strong>Boas Práticas:</strong></p>
      <ul>${(p.boasPraticas.length > 0 ? p.boasPraticas : ['Monitorar área afetada', 'Registrar aplicações', 'Respeitar intervalo de segurança']).map(bp => `<li>${bp}</li>`).join('')}</ul>
    </div>
  `).join('');

  const doencasHTML = data.doencas.map((d, i) => `
    <div class="section-block">
      <h3>4.${i + 1} ${d.nome}${d.nomeCientifico ? ` — ${d.nomeCientifico}` : ''}</h3>
      <table class="data-table">
        <tr><td class="label">Nível de severidade</td><td>${d.nivelSeveridade}</td></tr>
        <tr><td class="label">Condições favoráveis</td><td>${d.condicoesFavoraveis}</td></tr>
        <tr><td class="label">Talhões afetados</td><td>${d.talhoesAfetados}</td></tr>
      </table>
      <p class="subtitle">Ações Recomendadas</p>
      <ul>
        ${d.fungicida ? `<li>Fungicida: ${d.fungicida.nome}</li><li>Dose: ${d.fungicida.dose}</li><li>Intervalo entre reaplicações: ${d.fungicida.intervalo}</li>` : ''}
        <li>Frequência de inspeção: ${d.frequenciaInspecao}</li>
        <li>Focos de observação: ${d.focosObservacao}</li>
        <li>Intervalo de Reentrada: ${d.intervaloReentrada}</li>
        <li>Equipamentos de proteção recomendados: ${d.epiRecomendados}</li>
      </ul>
    </div>
  `).join('');

  const comparativoHTML = data.comparativoHistorico.map((c) => `
    <tr>
      <td>${c.periodo}</td>
      <td>${c.infestacaoGeral}</td>
      <td>${c.variacao}</td>
      <td>${c.comentario}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório Técnico: Monitoramento de Pragas e Doenças</title>
  <style>
    @page { margin-top: 12mm; margin-bottom: 12mm; margin-left: 12mm; margin-right: 12mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #000; font-size: 11px; line-height: 1.5; background: #fff; padding: 12px 24px 12px 24px; }
    .doc-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #1e3a5f; }
    .doc-header-left { display: flex; align-items: center; gap: 12px; }
    .doc-header-logo { height: 48px; width: auto; max-width: 140px; object-fit: contain; display: block; }
    .doc-header-brand { font-size: 18px; font-weight: 600; letter-spacing: 0.02em; }
    .doc-header-brand-fox { color: #eab203; }
    .doc-header-brand-fieldcore { color: #1e3a5f; }
    .doc-header-title { font-size: 14px; font-weight: 700; color: #1e3a5f; text-transform: uppercase; letter-spacing: 0.02em; }
    .header-block { margin-bottom: 10px; }
    .header-block p { margin-bottom: 4px; font-size: 11px; color: #000; }
    .intro { margin-bottom: 8px; text-align: justify; }
    .map-section-bar { font-size: 12px; font-weight: 700; color: #000; padding: 6px 0; margin: 8px 0 8px 0; border-bottom: 1px solid #e2e8f0; }
    .map-and-data { display: flex; gap: 16px; margin: 12px 0 20px; align-items: flex-start; }
    .map-column { flex: 1; min-width: 0; }
    .data-column { width: 220px; flex-shrink: 0; }
    .data-card { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 10px; }
    .data-card-title { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
    .data-card-value { font-size: 13px; font-weight: 700; color: #0f172a; }
    .data-card-note { font-size: 9px; color: #64748b; margin-top: 4px; }
    .map-container { width: 100%; border: 1px solid #000; background: #000; overflow: hidden; border-radius: 4px; }
    .map-container img { width: 100%; height: auto; display: block; min-height: 200px; }
    .map-container svg { width: 100%; height: 200px; display: block; }
    .map-placeholder { width: 100%; height: 180px; border: 1px solid #000; background: #fff; display: flex; align-items: center; justify-content: center; margin: 0; font-size: 11px; color: #000; }
    .map-legend-box { margin-top: 8px; font-size: 9px; color: #333; }
    .map-legend-box .legend-title { font-weight: 700; margin-bottom: 4px; }
    .map-legend-box .legend-item { display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }
    .map-legend-box .legend-swatch { width: 14px; height: 10px; border-radius: 2px; }
    .map-legend { display: flex; align-items: center; gap: 8px; margin: 8px 0 0 0; font-size: 9px; color: #333; }
    .map-legend-bar { height: 10px; flex: 1; border-radius: 5px; background: linear-gradient(to right, #0000FF, #0050FF, #00B4FF, #00FFB4, #00FF00, #C8FF00, #FFC800, #FF7800, #FF3200, #FF0000); }
    .map-legend span { white-space: nowrap; font-weight: 600; }
    .doc-title { font-size: 14px; font-weight: 700; text-align: center; margin: 0 0 16px 0; }
    .section { margin-bottom: 10px; page-break-inside: avoid; }
    .section.section-first { margin-bottom: 6px; }
    .section h2 { font-size: 12px; font-weight: 700; color: #000; margin-bottom: 6px; }
    .section h3 { font-size: 11px; font-weight: 700; color: #000; margin: 12px 0 6px; }
    .subtitle { font-size: 10px; font-weight: 600; margin: 8px 0 4px; color: #000; }
    .section-block { margin-bottom: 14px; }
    .section-block h3 { font-size: 11px; font-weight: 700; margin-bottom: 6px; }
    .data-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    .data-table td { padding: 4px 8px; border: 1px solid #000; font-size: 10px; color: #000; }
    .data-table .label { font-weight: 600; width: 38%; background: #fff; }
    .historico-table { width: 100%; border-collapse: collapse; }
    .historico-table th, .historico-table td { padding: 6px 8px; border: 1px solid #000; font-size: 10px; text-align: left; color: #000; background: #fff; }
    .historico-table th { font-weight: 700; }
    .assinatura-table { width: 100%; margin-top: 16px; border-collapse: collapse; }
    .assinatura-table td { padding: 8px; border: 1px solid #000; font-size: 11px; color: #000; background: #fff; }
    .assinatura-table .label-cell { font-weight: 600; width: 32%; }
    .resumo-list { list-style: none; margin-left: 0; }
    .resumo-list li { margin-bottom: 4px; padding-left: 14px; position: relative; }
    .resumo-list li::before { content: "•"; position: absolute; left: 0; }
    .legend-list { list-style: none; margin-left: 0; }
    .legend-list li { margin-bottom: 2px; padding-left: 14px; position: relative; }
    .legend-list li::before { content: "•"; position: absolute; left: 0; }
    .conclusao p { margin-bottom: 8px; text-align: justify; }
    .recomendacoes ol { margin-left: 18px; }
    .recomendacoes li { margin-bottom: 4px; }
    ul { margin-left: 18px; }
    li { margin-bottom: 2px; }
    @media print { body { padding: 12px 24px; } .section { page-break-inside: avoid; } .map-and-data { break-inside: avoid; } }
  </style>
</head>
<body>
  <div class="doc-header">
    <div class="doc-header-left">
      ${data.reportLogoBase64 ? `<img class="doc-header-logo" src="data:image/png;base64,${data.reportLogoBase64}" alt="Logo" />` : ''}
      <span class="doc-header-brand"><span class="doc-header-brand-fox">FOX</span><span class="doc-header-brand-fieldcore">FIELDCORE</span></span>
    </div>
    <div class="doc-header-title">Relatório de Pragas e Doenças</div>
  </div>

  <div class="header-block">
    <p><strong>Propriedade:</strong> ${data.fazendaNome}</p>
    <p><strong>Área Monitorada:</strong> ${data.areaMonitorada} ha</p>
    <p><strong>Data do Relatório:</strong> ${data.dataRelatorio}</p>
    <p><strong>Responsável Técnico:</strong> ${data.responsavelTecnico}</p>
  </div>

  <p class="intro">
    Este relatório apresenta a análise do monitoramento de pragas e doenças realizado pelo sistema ${data.aplicativo} no
    período de ${data.periodoDatas}. A plataforma utilizou sensores, armadilhas inteligentes e registro georreferenciado para gerar mapas
    de calor, identificar focos e recomendar ações corretivas.
  </p>

  <div class="section section-first">
    <h2>1. Resumo Executivo</h2>
    <p style="margin-bottom: 4px;"><strong>Principais Destaques</strong></p>
    <ul class="resumo-list">
      <li>Nível de infestação geral: ${data.resumoExecutivo.nivelInfestacao}</li>
      <li>Principais pragas detectadas: ${data.resumoExecutivo.principaisPragas.join(', ') || 'Nenhuma'}</li>
      <li>Principais doenças identificadas: ${data.resumoExecutivo.principaisDoencas.join(', ') || 'Nenhuma'}</li>
      <li>Áreas críticas: ${data.resumoExecutivo.areasCriticas.join(', ') || 'Nenhuma'}</li>
      <li>Ações imediatas recomendadas: ${data.resumoExecutivo.acoesImediatas}</li>
    </ul>
  </div>

  <div class="section">
    <h2 class="map-section-bar">2. Mapa de Calor: Distribuição das Infestações</h2>
    <div class="map-and-data">
      <div class="map-column">
        <p style="margin-bottom: 8px; font-size: 10px;">O mapa indica a intensidade de ocorrência de pragas e doenças detectadas pelo ${data.aplicativo}. Cores mais quentes (vermelho) indicam maior concentração.</p>
        <div class="map-container">${
      data.heatmapImage
        ? `<img src="${data.heatmapImage}" alt="Mapa de calor" />`
        : data.heatmapSvg
          ? data.heatmapSvg
          : '<div class="map-placeholder">[Inserir mapa de calor gerado pelo aplicativo]</div>'
    }</div>
        <div class="map-legend-box">
          <div class="legend-title">Legenda</div>
          <div class="map-legend">
            <span>Baixa incidência</span>
            <div class="map-legend-bar"></div>
            <span>Alta incidência</span>
          </div>
          <div class="legend-item"><span class="legend-swatch" style="background: #0000FF;"></span> Baixo risco</div>
          <div class="legend-item"><span class="legend-swatch" style="background: #FFC800;"></span> Médio risco</div>
          <div class="legend-item"><span class="legend-swatch" style="background: #FF0000;"></span> Alto risco</div>
        </div>
      </div>
      <div class="data-column">${data.heatmapSummary ? `
        <div class="data-card">
          <div class="data-card-title">Total de focos detectados</div>
          <div class="data-card-value">${data.heatmapSummary.totalFocos}</div>
          <div class="data-card-note">Período do relatório</div>
        </div>
        <div class="data-card">
          <div class="data-card-title">Talhões com detecção</div>
          <div class="data-card-value">${data.heatmapSummary.talhoesAfetados}</div>
          <div class="data-card-note">Áreas monitoradas</div>
        </div>
        <div class="data-card">
          <div class="data-card-title">Nível de risco predominante</div>
          <div class="data-card-value">${data.heatmapSummary.nivelRiscoPredominante}</div>
        </div>
        <div class="data-card">
          <div class="data-card-title">Área de maior incidência</div>
          <div class="data-card-value">${data.heatmapSummary.areaMaiorIncidencia}</div>
          <div class="data-card-note">Recomenda-se atenção prioritária</div>
        </div>
      ` : ''}</div>
    </div>
    <p style="margin-top: 12px; margin-bottom: 4px;"><strong>Observações Técnicas</strong></p>
    <ul class="legend-list">
      <li>Área de maior incidência: ${data.observacoesTecnicas.areaMaiorIncidencia}</li>
      <li>Tendência nas últimas 48h: ${data.observacoesTecnicas.tendencia48h}</li>
      <li>Condições climáticas: ${data.observacoesTecnicas.condicoesClimaticas}</li>
    </ul>
  </div>

  <div class="section">
    <h2>3. Detalhamento por Praga</h2>
    ${pragasHTML || '<p>Nenhuma praga identificada no período.</p>'}
  </div>

  <div class="section">
    <h2>4. Detalhamento por Doença</h2>
    ${doencasHTML || '<p>Nenhuma doença identificada no período.</p>'}
  </div>

  <div class="section">
    <h2>5. Comparativo Histórico</h2>
    <table class="historico-table">
      <thead>
        <tr>
          <th>Período</th>
          <th>Infestação Geral</th>
          <th>Variação</th>
          <th>Comentário</th>
        </tr>
      </thead>
      <tbody>
        ${comparativoHTML || '<tr><td colspan="4">Sem dados históricos</td></tr>'}
      </tbody>
    </table>
  </div>

  <div class="section recomendacoes">
    <h2>6. Recomendações de Manejo Geral</h2>
    <ol>
      ${data.recomendacoes.map(r => `<li>${r}</li>`).join('')}
    </ol>
  </div>

  <div class="section">
    <h2>7. Conclusão</h2>
    <div class="conclusao">
      <p>${data.conclusao}</p>
      <p>${data.conclusaoParagrafo2}</p>
      <p>O monitoramento continuará ativo em tempo real, e um novo relatório será gerado automaticamente em ${data.dataProximoRelatorio}. Recomenda-se acompanhamento contínuo das áreas críticas identificadas para assegurar a eficácia das ações implementadas.</p>
    </div>
  </div>

  <div class="section">
    <h2>8. Assinatura e Validação</h2>
    <table class="assinatura-table">
      <tr><td class="label-cell">Responsável Técnico</td><td>&nbsp;</td></tr>
      <tr><td class="label-cell">Engenheiro Agrônomo</td><td>&nbsp;</td></tr>
      <tr><td class="label-cell">CREA / Registro Profissional</td><td>&nbsp;</td></tr>
      <tr><td class="label-cell">Data da Assinatura</td><td>&nbsp;</td></tr>
    </table>
  </div>
</body>
</html>`;
}
