/**
 * Conteúdo compartilhado do bottom sheet de detalhes (Monitoramento e Início).
 * Um único componente: ponto de monitoramento (várias pragas) ou talhão (pragas agregadas).
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Icon } from '@/components/ui/icon';
import { useColor } from '@/hooks/useColor';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { palette } from '@/theme/colors';
import {
  Bug,
  MapPin,
  Navigation,
  CheckCircle,
  AlertTriangle,
  FlaskConical,
} from 'lucide-react-native';

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critica': return '#DC2626';
    case 'alta': return '#EA580C';
    case 'media': return '#F59E0B';
    case 'baixa': return '#10B981';
    default: return '#6B7280';
  }
}

function getSeverityLabel(severity: string): string {
  switch (severity) {
    case 'critica': return 'Crítica';
    case 'alta': return 'Alta';
    case 'media': return 'Média';
    case 'baixa': return 'Baixa';
    default: return severity;
  }
}

export interface MonitoramentoDetailPraga {
  pragaNome: string;
  contagem: number;
  prioridade?: string;
  pragaNomeCientifico?: string;
  tipoPraga?: string;
  observacao?: string;
  recomendacao?: string;
}

export interface MonitoramentoDetailSheetProps {
  /** Área (ha) e cultura: exibem seção Talhão */
  talhaoArea?: number;
  talhaoCulturaAtual?: string;
  /** Percentual de infestação do talhão no mês atual (0–100) */
  percentualInfestacao?: number;
  /** Coordenadas: exibem seção Localização (omitir ou 0 = não mostrar / "não disponíveis") */
  latitude?: number;
  longitude?: number;
  /** Status do ponto: exibe card Visitado/Pendente e data (omitir = não mostrar) */
  visitado?: boolean;
  dataVisita?: string;
  /** Lista de pragas (detalhe por ponto ou agregada por talhão) */
  pragas: MonitoramentoDetailPraga[];
  pestsLoading?: boolean;
  /** Observações do scout (omitir = não mostrar) */
  observacoes?: string;
  /** Sincronizado (omitir = não mostrar badge) */
  synced?: boolean;
  onClose: () => void;
}

export function MonitoramentoDetailSheet({
  talhaoArea,
  talhaoCulturaAtual,
  percentualInfestacao,
  latitude,
  longitude,
  visitado,
  dataVisita,
  pragas,
  pestsLoading,
  observacoes,
  synced,
  onClose,
}: MonitoramentoDetailSheetProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const sheetAccent = isDark ? '#fff' : palette.darkGreen;
  const cardColor = useColor({}, 'card');
  const textColor = useColor({}, 'text');
  const mutedColor = useColor({}, 'textMuted');
  const borderColor = useColor({}, 'border');
  const primaryColor = useColor({}, 'primary');

  const showLocation = latitude != null && longitude != null && (latitude !== 0 || longitude !== 0);
  const isScout = visitado !== undefined;

  return (
    <View style={styles.detailContainer}>
      {/* Card topo: sempre "Resumo" (do ponto ou do talhão), nunca Visitado/Pendente */}
      <View style={[styles.detailStatusCard, { backgroundColor: '#6B728015' }]}>
        <Icon name={MapPin} size={24} color="#6B7280" />
        <View style={styles.detailStatusInfo}>
          <Text style={[styles.detailStatusLabel, { color: mutedColor }]}>
            {isScout ? 'Resumo do ponto' : 'Resumo do talhão'}
          </Text>
          {isScout && dataVisita && (
            <Text style={[styles.detailStatusDate, { color: mutedColor }]}>
              {new Date(dataVisita).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </Text>
          )}
        </View>
      </View>

      {/* Talhão: mesma seção sempre; área/cultura/infestation % ou "—" */}
      <View style={[styles.detailSection, { borderColor }]}>
        <View style={styles.detailSectionHeader}>
          <Icon name={MapPin} size={16} color={primaryColor} />
          <Text style={[styles.detailSectionTitle, { color: textColor }]}>Talhão</Text>
        </View>
        <View style={styles.detailCoords}>
          <View style={styles.detailCoordRow}>
            <Text style={[styles.detailCoordLabel, { color: mutedColor }]}>Área</Text>
            <Text style={[styles.detailCoordValue, { color: textColor }]}>
              {talhaoArea != null ? `${Number(talhaoArea).toLocaleString('pt-BR')} ha` : '—'}
            </Text>
          </View>
          <View style={styles.detailCoordRow}>
            <Text style={[styles.detailCoordLabel, { color: mutedColor }]}>Cultura atual</Text>
            <Text style={[styles.detailCoordValue, { color: textColor }]}>
              {talhaoCulturaAtual || '—'}
            </Text>
          </View>
          {percentualInfestacao != null && (
            <View style={styles.detailCoordRow}>
              <Text style={[styles.detailCoordLabel, { color: mutedColor }]}>Infestação (mês atual)</Text>
              <Text style={[styles.detailCoordValue, { color: percentualInfestacao > 0 ? '#F59E0B' : textColor, fontWeight: percentualInfestacao > 0 ? '600' : '400' }]}>
                {Number(percentualInfestacao).toFixed(1)}%
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Localização: sempre a mesma seção (coords ou "não disponíveis") */}
      <View style={[styles.detailSection, { borderColor }]}>
        <View style={styles.detailSectionHeader}>
          <Icon name={Navigation} size={16} color={primaryColor} />
          <Text style={[styles.detailSectionTitle, { color: textColor }]}>Localização</Text>
        </View>
        <View style={styles.detailCoords}>
          {showLocation ? (
            <>
              <View style={styles.detailCoordRow}>
                <Text style={[styles.detailCoordLabel, { color: mutedColor }]}>Latitude</Text>
                <Text style={[styles.detailCoordValue, { color: textColor }]}>
                  {Number(latitude).toFixed(6)}
                </Text>
              </View>
              <View style={styles.detailCoordRow}>
                <Text style={[styles.detailCoordLabel, { color: mutedColor }]}>Longitude</Text>
                <Text style={[styles.detailCoordValue, { color: textColor }]}>
                  {Number(longitude).toFixed(6)}
                </Text>
              </View>
            </>
          ) : (
            <Text style={[styles.detailCoordValue, { color: mutedColor }]}>
              Coordenadas não disponíveis
            </Text>
          )}
        </View>
      </View>

      {/* Pragas */}
      <View style={[styles.detailSection, { borderColor }]}>
        <View style={styles.detailSectionHeader}>
          <Icon name={Bug} size={16} color={palette.gold} />
          <Text style={[styles.detailSectionTitle, { color: textColor }]}>
            Pragas Identificadas
          </Text>
          {pragas.length > 0 && (
            <View style={[styles.pestCountBadge, { backgroundColor: palette.gold + '20' }]}>
              <Text style={[styles.pestCountText, { color: palette.gold }]}>{pragas.length}</Text>
            </View>
          )}
        </View>

        {pestsLoading ? (
          <View style={styles.loadingPests}>
            <Text style={[styles.loadingText, { color: mutedColor }]}>Carregando pragas...</Text>
          </View>
        ) : pragas.length > 0 ? (
          <View style={styles.pestsList}>
            {pragas.map((pest, i) => (
              <View
                key={`${pest.pragaNome}-${i}`}
                style={[styles.pestCard, { backgroundColor: cardColor, borderColor }]}
              >
                <View style={styles.pestHeader}>
                  <View style={styles.pestNameRow}>
                    <Text style={[styles.pestName, { color: textColor }]} numberOfLines={1}>
                      {pest.pragaNome || 'Desconhecida'}
                    </Text>
                    <View style={[
                      styles.severityBadge,
                      {
                        backgroundColor: pest.prioridade != null
                          ? getSeverityColor(pest.prioridade.toLowerCase()) + '20'
                          : '#6B728020',
                      },
                    ]}>
                      <Text style={[
                        styles.severityText,
                        {
                          color: pest.prioridade != null
                            ? getSeverityColor(pest.prioridade.toLowerCase())
                            : mutedColor,
                        },
                      ]}>
                        {pest.prioridade != null
                          ? getSeverityLabel(pest.prioridade.toLowerCase())
                          : '—'}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.pestScientificName, { color: mutedColor }]}>
                    {pest.pragaNomeCientifico && pest.pragaNomeCientifico.trim() !== ''
                      ? pest.pragaNomeCientifico
                      : '—'}
                  </Text>
                </View>
                <View style={styles.pestDetails}>
                  <View style={styles.pestDetailItem}>
                    <Text style={[styles.pestDetailLabel, { color: mutedColor }]}>Quantidade</Text>
                    <Text style={[styles.pestDetailValue, { color: textColor }]}>
                      {pest.contagem ?? 0} {(pest.contagem ?? 0) === 1 ? 'indivíduo' : 'indivíduos'}
                    </Text>
                  </View>
                  <View style={styles.pestDetailItem}>
                    <Text style={[styles.pestDetailLabel, { color: mutedColor }]}>Tipo</Text>
                    <Text style={[styles.pestDetailValue, { color: textColor }]}>
                      {pest.tipoPraga && pest.tipoPraga.trim() !== '' ? pest.tipoPraga : '—'}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.pestNotes, { color: mutedColor }]}>
                  {pest.observacao && pest.observacao.trim() !== '' ? pest.observacao : '—'}
                </Text>

                {pest.recomendacao && pest.recomendacao.trim() !== '' && (
                  <View style={[styles.embrapaSection, { borderColor }]}>
                    <View style={styles.embrapaSectionHeader}>
                      <Icon name={FlaskConical} size={13} color="#16A34A" />
                      <Text style={[styles.embrapaSectionTitle, { color: textColor }]}>
                        Recomendação
                      </Text>
                    </View>
                    <Text style={[styles.recomendacaoText, { color: textColor }]}>
                      {pest.recomendacao}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        ) : (
          <View style={[styles.noPragasCard, { backgroundColor: '#10B98115' }]}>
            <Icon name={CheckCircle} size={18} color="#10B981" />
            <Text style={[styles.noPragasText, { color: '#10B981' }]}>
              Nenhuma praga identificada
            </Text>
          </View>
        )}
      </View>

      {/* Observações: mesma seção sempre */}
      <View style={[styles.detailSection, { borderColor }]}>
        <View style={styles.detailSectionHeader}>
          <Icon name={AlertTriangle} size={16} color={mutedColor} />
          <Text style={[styles.detailSectionTitle, { color: textColor }]}>Observações</Text>
        </View>
        <Text style={[styles.detailObservations, { color: observacoes ? textColor : mutedColor }]}>
          {observacoes && observacoes.trim() !== '' ? observacoes : '—'}
        </Text>
      </View>

      {/* Sync: mesma linha sempre */}
      <View style={styles.detailSyncRow}>
        <View style={[
          styles.syncBadge,
          {
            backgroundColor:
              synced === true ? '#10B98120' : synced === false ? '#F59E0B20' : '#6B728020',
          },
        ]}>
          <View style={[
            styles.syncDot,
            {
              backgroundColor:
                synced === true ? '#10B981' : synced === false ? '#F59E0B' : '#6B7280',
            },
          ]} />
          <Text style={[
            styles.syncText,
            {
              color: synced === true ? '#10B981' : synced === false ? '#F59E0B' : mutedColor,
            },
          ]}>
            {synced === true
              ? 'Sincronizado'
              : synced === false
                ? 'Aguardando sincronização'
                : '—'}
          </Text>
        </View>
      </View>

      <View style={styles.detailActions}>
        <TouchableOpacity
          style={[styles.detailCloseButton, { borderColor: sheetAccent }]}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <Text style={[styles.detailCloseButtonText, { color: sheetAccent }]}>Fechar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  detailContainer: {
    gap: 16,
  },
  detailStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  detailStatusInfo: { flex: 1 },
  detailStatusLabel: { fontSize: 16, fontWeight: '700' },
  detailStatusDate: { fontSize: 13, marginTop: 2 },
  detailSection: {
    borderTopWidth: 1,
    paddingTop: 16,
  },
  detailSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  detailSectionTitle: { fontSize: 14, fontWeight: '600' },
  detailCoords: { gap: 8 },
  detailCoordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailCoordLabel: { fontSize: 13 },
  detailCoordValue: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  noPragasCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    gap: 10,
  },
  noPragasText: { fontSize: 14, fontWeight: '600' },
  detailObservations: { fontSize: 14, lineHeight: 20 },
  detailSyncRow: { alignItems: 'flex-start', marginTop: 4 },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  syncDot: { width: 6, height: 6, borderRadius: 3 },
  syncText: { fontSize: 12, fontWeight: '600' },
  detailActions: { marginTop: 8 },
  detailCloseButton: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  detailCloseButtonText: { fontSize: 15, fontWeight: '600' },
  pestCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 'auto',
  },
  pestCountText: { fontSize: 12, fontWeight: '700' },
  loadingPests: { padding: 20, alignItems: 'center' },
  loadingText: { fontSize: 13 },
  pestsList: { gap: 10 },
  pestCard: { padding: 12, borderRadius: 10, borderWidth: 1 },
  pestHeader: { marginBottom: 8 },
  pestNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  pestName: { fontSize: 15, fontWeight: '600', flex: 1 },
  pestScientificName: { fontSize: 12, fontStyle: 'italic', marginTop: 2 },
  severityBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  severityText: { fontSize: 11, fontWeight: '700' },
  pestDetails: { flexDirection: 'row', gap: 16 },
  pestDetailItem: { gap: 2 },
  pestDetailLabel: { fontSize: 11 },
  pestDetailValue: { fontSize: 13, fontWeight: '600' },
  pestNotes: { fontSize: 12, marginTop: 8, fontStyle: 'italic' },
  recomendacaoText: {
    fontSize: 13,
    lineHeight: 20,
  },
  embrapaSection: {
    marginTop: 10,
    borderTopWidth: 1,
    paddingTop: 8,
  },
  embrapaSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  embrapaSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
});
