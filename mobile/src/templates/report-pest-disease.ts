/**
 * Template HTML - Relatório de Pragas e Doenças (Monitoramento Automatizado)
 * Baseado no modelo com sensores, armadilhas inteligentes e mapas de calor
 */

export interface PestDiseaseReportData {
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

export function generatePestDiseaseReportHTML(data: PestDiseaseReportData): string {
  const pragasHTML = data.pragas.map((p) => `
    <div class="section-block">
      <h3>${p.nome} ${p.nomeCientifico ? `<em>(${p.nomeCientifico})</em>` : ''}</h3>
      <table class="data-table">
        <tr><td class="label">Taxa de ocorrência</td><td>${p.taxaOcorrencia}</td></tr>
        <tr><td class="label">Pontos críticos</td><td>${p.pontosCriticos}</td></tr>
        <tr><td class="label">Estágio predominante</td><td>${p.estadioPredominante}</td></tr>
        <tr><td class="label">Risco à lavoura</td><td><span class="badge badge-${p.riscoLavoura.toLowerCase()}">${p.riscoLavoura}</span></td></tr>
      </table>
      <h4>Recomendações AGROFIT</h4>
      ${p.manejoQuimico ? `
      <div class="manejo-block">
        <strong>Manejo Químico</strong>
        <ul>
          <li>Produto: ${p.manejoQuimico.produto}</li>
          <li>Dose: ${p.manejoQuimico.dose}</li>
          <li>Intervalo de aplicação: ${p.manejoQuimico.intervalo}</li>
        </ul>
      </div>` : ''}
      ${p.manejoBiologico ? `
      <div class="manejo-block">
        <strong>Manejo Biológico</strong>
        <ul>
          <li>Agente de controle: ${p.manejoBiologico.agente}</li>
          <li>Dosagem: ${p.manejoBiologico.dosagem}</li>
        </ul>
      </div>` : ''}
      ${p.boasPraticas.length > 0 ? `
      <div class="manejo-block">
        <strong>Boas Práticas</strong>
        <ul>${p.boasPraticas.map(bp => `<li>${bp}</li>`).join('')}</ul>
      </div>` : ''}
    </div>
  `).join('');

  const doencasHTML = data.doencas.map((d) => `
    <div class="section-block">
      <h3>${d.nome} ${d.nomeCientifico ? `<em>(${d.nomeCientifico})</em>` : ''}</h3>
      <table class="data-table">
        <tr><td class="label">Nível de severidade</td><td>${d.nivelSeveridade}</td></tr>
        <tr><td class="label">Condições favoráveis</td><td>${d.condicoesFavoraveis}</td></tr>
        <tr><td class="label">Talhões afetados</td><td>${d.talhoesAfetados}</td></tr>
      </table>
      <h4>Ações Recomendadas</h4>
      <ul>
        ${d.fungicida ? `<li>Fungicida: ${d.fungicida.nome} | Dose: ${d.fungicida.dose} | Reaplicação: ${d.fungicida.intervalo}</li>` : ''}
        <li>Frequência de inspeção: ${d.frequenciaInspecao}</li>
        <li>Focos de observação: ${d.focosObservacao}</li>
        <li>Intervalo de Reentrada: ${d.intervaloReentrada}</li>
        <li>EPI recomendados: ${d.epiRecomendados}</li>
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
  <title>Relatório de Pragas e Doenças</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; font-size: 11px; line-height: 1.5; padding: 24px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #9333ea; padding-bottom: 16px; margin-bottom: 20px; }
    .header-left h1 { font-size: 18px; color: #9333ea; margin-bottom: 4px; }
    .header-left h2 { font-size: 13px; color: #4b5563; font-weight: 400; }
    .header-right { text-align: right; font-size: 10px; color: #6b7280; }
    .header-right .app-name { font-size: 14px; font-weight: 700; color: #9333ea; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px; padding: 12px; background: #faf5ff; border-radius: 8px; }
    .info-item label { font-size: 9px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
    .info-item p { font-size: 12px; font-weight: 600; color: #1a1a1a; }
    .section { margin-bottom: 20px; page-break-inside: avoid; }
    .section h2 { font-size: 14px; color: #9333ea; border-bottom: 1px solid #d1d5db; padding-bottom: 6px; margin-bottom: 12px; }
    .section-block { margin-bottom: 16px; padding: 12px; background: #fafafa; border-radius: 6px; border-left: 3px solid #9333ea; }
    .section-block h3 { font-size: 13px; color: #1a1a1a; margin-bottom: 8px; }
    .section-block h4 { font-size: 11px; color: #9333ea; margin: 8px 0 4px; }
    .data-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    .data-table td { padding: 4px 8px; border-bottom: 1px solid #e5e7eb; font-size: 10px; }
    .data-table .label { font-weight: 600; width: 40%; color: #374151; }
    .badge { padding: 2px 8px; border-radius: 4px; font-size: 9px; font-weight: 600; }
    .badge-alto, .badge-alta { background: #fef2f2; color: #dc2626; }
    .badge-medio, .badge-media, .badge-médio { background: #fffbeb; color: #d97706; }
    .badge-baixo, .badge-baixa { background: #f0fdf4; color: #16a34a; }
    .manejo-block { margin: 6px 0; padding: 6px 8px; background: #fff; border-radius: 4px; }
    .manejo-block strong { font-size: 10px; color: #9333ea; }
    .manejo-block ul { margin: 4px 0 0 16px; }
    .manejo-block li { font-size: 10px; margin-bottom: 2px; }
    .historico-table { width: 100%; border-collapse: collapse; }
    .historico-table th { background: #9333ea; color: white; padding: 6px 8px; font-size: 10px; text-align: left; }
    .historico-table td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; font-size: 10px; }
    .historico-table tr:nth-child(even) { background: #f9fafb; }
    .resumo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .resumo-item { padding: 10px; background: #faf5ff; border-radius: 6px; }
    .resumo-item label { font-size: 9px; color: #6b7280; text-transform: uppercase; }
    .resumo-item p { font-size: 11px; font-weight: 500; }
    .recomendacoes ol { margin-left: 16px; }
    .recomendacoes li { margin-bottom: 4px; font-size: 11px; }
    .assinatura-table { width: 100%; margin-top: 40px; }
    .assinatura-table td { padding: 12px 8px; border-bottom: 1px solid #d1d5db; font-size: 11px; }
    .assinatura-table .label-cell { font-weight: 600; width: 30%; }
    .conclusao { padding: 12px; background: #faf5ff; border-radius: 8px; border: 1px solid #e9d5ff; }
    .heatmap-placeholder { width: 100%; height: 200px; background: linear-gradient(135deg, #22c55e 0%, #eab308 30%, #f97316 60%, #dc2626 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: 600; text-shadow: 0 1px 3px rgba(0,0,0,0.3); margin-bottom: 12px; }
    .legend { display: flex; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
    .legend-item { display: flex; align-items: center; gap: 4px; font-size: 9px; }
    .legend-dot { width: 12px; height: 12px; border-radius: 3px; }
    .sensor-badge { display: inline-block; padding: 2px 6px; background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 4px; font-size: 9px; color: #9333ea; font-weight: 500; margin-left: 6px; }
    .footer { text-align: center; font-size: 9px; color: #9ca3af; margin-top: 20px; padding-top: 8px; border-top: 1px solid #e5e7eb; }
    ul { margin-left: 16px; }
    li { margin-bottom: 2px; }
    @media print { body { padding: 16px; } .section { page-break-inside: avoid; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>Relatório Técnico</h1>
      <h2>Monitoramento de Pragas e Doenças <span class="sensor-badge">Sensores + IA</span></h2>
    </div>
    <div class="header-right">
      <div class="app-name">AGROV</div>
      <div>Monitoramento Automatizado</div>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-item"><label>Propriedade</label><p>${data.fazendaNome}</p></div>
    <div class="info-item"><label>Área Monitorada</label><p>${data.areaMonitorada} ha</p></div>
    <div class="info-item"><label>Data do Relatório</label><p>${data.dataRelatorio}</p></div>
    <div class="info-item"><label>Responsável</label><p>${data.responsavelTecnico}</p></div>
  </div>

  <p style="margin-bottom: 20px; font-size: 11px; color: #4b5563;">
    Este relatório apresenta os resultados do monitoramento automatizado de pragas e doenças, utilizando sensores, 
    câmeras com inteligência artificial e registros georreferenciados para a geração de mapas de calor em tempo real.
  </p>

  <div class="section">
    <h2>1. Resumo Executivo</h2>
    <div class="resumo-grid">
      <div class="resumo-item"><label>Nível geral de infestação</label><p>${data.resumoExecutivo.nivelInfestacao}</p></div>
      <div class="resumo-item"><label>Principais pragas</label><p>${data.resumoExecutivo.principaisPragas.join(', ') || 'Nenhuma detectada'}</p></div>
      <div class="resumo-item"><label>Principais doenças</label><p>${data.resumoExecutivo.principaisDoencas.join(', ') || 'Nenhuma detectada'}</p></div>
      <div class="resumo-item"><label>Áreas críticas</label><p>${data.resumoExecutivo.areasCriticas.join(', ') || 'Nenhuma'}</p></div>
    </div>
    <p style="margin-top: 8px; font-size: 11px;"><strong>Ações imediatas:</strong> ${data.resumoExecutivo.acoesImediatas}</p>
  </div>

  <div class="section">
    <h2>2. Mapa de Calor: Distribuição das Infestações</h2>
    <div class="legend">
      <div class="legend-item"><div class="legend-dot" style="background:#dc2626;"></div> Alto risco</div>
      <div class="legend-item"><div class="legend-dot" style="background:#f97316;"></div> Médio risco</div>
      <div class="legend-item"><div class="legend-dot" style="background:#eab308;"></div> Baixo risco</div>
      <div class="legend-item"><div class="legend-dot" style="background:#22c55e;"></div> Área estável</div>
    </div>
    <div class="heatmap-placeholder">[Mapa de calor gerado automaticamente pelo sistema]</div>
  </div>

  <div class="section">
    <h2>3. Detalhamento por Praga</h2>
    ${pragasHTML || '<p style="color: #6b7280;">Nenhuma praga identificada no período.</p>'}
  </div>

  <div class="section">
    <h2>4. Detalhamento por Doença</h2>
    ${doencasHTML || '<p style="color: #6b7280;">Nenhuma doença identificada no período.</p>'}
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
        ${comparativoHTML || '<tr><td colspan="4" style="text-align:center; color:#9ca3af;">Sem dados históricos</td></tr>'}
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
    </div>
  </div>

  <div class="section">
    <h2>8. Assinatura e Validação</h2>
    <table class="assinatura-table">
      <tr><td class="label-cell">Responsável Técnico</td><td>____________________________</td></tr>
      <tr><td class="label-cell">Engenheiro Agrônomo</td><td>____________________________</td></tr>
      <tr><td class="label-cell">CREA / Registro Profissional</td><td>____________________________</td></tr>
      <tr><td class="label-cell">Data da Assinatura</td><td>____________________________</td></tr>
    </table>
  </div>

  <div class="footer">
    <p>AGROV — Relatório automatizado gerado em ${data.dataRelatorio} | Monitoramento contínuo em tempo real</p>
  </div>
</body>
</html>`;
}
