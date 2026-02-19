import { useState, useEffect } from 'react';
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Text,
} from 'react-native';
import { View } from '@/components/ui/view';
import { Icon } from '@/components/ui/icon';
import { BottomSheet } from '@/components/ui/bottom-sheet-simple';
import { useColor } from '@/hooks/useColor';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useScoutsByPlot, fetchTalhaoMonitoramentoDetail } from '@/hooks/use-supabase-data';
import { palette } from '@/theme/colors';
import type { AtividadeTipo } from '@/hooks/use-supabase-data';
import {
  ClipboardList,
  Calendar,
  CheckCircle2,
  MapPin,
  Clock,
  Layers,
  Edit3,
  Trash2,
  FlaskConical,
} from 'lucide-react-native';

export interface AtividadeDetalhes {
  id: string | number;
  nome: string;
  descricao?: string;
  tipo: AtividadeTipo;
  status: string;
  plotId?: string;
  talhaoNome?: string;
  dataInicio?: string;
  createdAt: string;
  synced: boolean;
}

const TIPOS: { value: AtividadeTipo; label: string }[] = [
  { value: 'MONITORAMENTO', label: 'Monitoramento' },
  { value: 'APLICACAO', label: 'Aplicação' },
  { value: 'CONTROLE_PRAGAS', label: 'Controle de Pragas' },
  { value: 'VERIFICACAO', label: 'Verificação' },
  { value: 'PLANTIO', label: 'Plantio' },
  { value: 'COLHEITA', label: 'Colheita' },
  { value: 'OUTROS', label: 'Outros' },
];

function getSeverityColor(severity: string): string {
  const s = (severity || '').toLowerCase();
  switch (s) {
    case 'baixa': return '#10B981';
    case 'media': return '#F59E0B';
    case 'alta': return '#F97316';
    case 'critica': return '#EF4444';
    default: return '#94a3b8';
  }
}

export interface TaskDetailSheetProps {
  isVisible: boolean;
  onClose: () => void;
  task: AtividadeDetalhes | null;
  onToggleStatus: () => void | Promise<void>;
  onEdit: () => void;
  onDelete: () => void;
  isToggling?: boolean;
  isDeleting?: boolean;
}

export function TaskDetailSheet({
  isVisible,
  onClose,
  task,
  onToggleStatus,
  onEdit,
  onDelete,
  isToggling = false,
  isDeleting = false,
}: TaskDetailSheetProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const sheetAccent = isDark ? '#fff' : palette.darkGreen;
  const primaryColor = useColor({}, 'primary');
  const textColor = useColor({}, 'text');
  const mutedColor = useColor({}, 'textMuted');
  const borderColor = useColor({}, 'border');
  const cardColor = useColor({}, 'card');

  const { scouts: taskScouts, isLoading: scoutsLoading } = useScoutsByPlot(task?.plotId);
  const [talhaoRecomendacoes, setTalhaoRecomendacoes] = useState<Array<{ pragaNome: string; recomendacao?: string }>>([]);
  const [loadingTalhaoRecomendacoes, setLoadingTalhaoRecomendacoes] = useState(false);

  useEffect(() => {
    if (!isVisible || !task?.plotId) {
      setTalhaoRecomendacoes([]);
      return;
    }
    const talhaoId = Number(task.plotId);
    if (!Number.isFinite(talhaoId)) return;
    let cancelled = false;
    setLoadingTalhaoRecomendacoes(true);
    fetchTalhaoMonitoramentoDetail(talhaoId, task.talhaoNome ?? 'Talhão', undefined, undefined)
      .then((payload) => {
        if (cancelled || !payload?.pragas) return;
        const withRec = payload.pragas.filter((p) => p.recomendacao && p.recomendacao.trim() !== '');
        setTalhaoRecomendacoes(withRec.map((p) => ({ pragaNome: p.pragaNome, recomendacao: p.recomendacao })));
      })
      .catch(() => { if (!cancelled) setTalhaoRecomendacoes([]); })
      .finally(() => { if (!cancelled) setLoadingTalhaoRecomendacoes(false); });
    return () => { cancelled = true; };
  }, [isVisible, task?.plotId, task?.talhaoNome]);

  if (!task) return null;

  return (
    <BottomSheet
      isVisible={isVisible}
      onClose={onClose}
      title={task.nome ?? 'Detalhes da Tarefa'}
    >
      <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.detailContainer}>
          <View style={[styles.detailStatusCard, {
            backgroundColor: task.status === 'concluida' ? '#10B98115' :
              task.status === 'em_andamento' ? '#F59E0B15' : primaryColor + '15',
          }]}>
            <Icon
              name={task.status === 'concluida' ? CheckCircle2 : Clock}
              size={24}
              color={task.status === 'concluida' ? '#10B981' :
                task.status === 'em_andamento' ? '#F59E0B' : primaryColor}
            />
            <View style={styles.detailStatusInfo}>
              <Text style={[styles.detailStatusLabel, {
                color: task.status === 'concluida' ? '#10B981' :
                  task.status === 'em_andamento' ? '#F59E0B' : primaryColor,
              }]}>
                {task.status === 'concluida' ? 'Concluída' :
                  task.status === 'em_andamento' ? 'Em Andamento' : 'Pendente'}
              </Text>
              <Text style={[styles.detailStatusDate, { color: mutedColor }]}>
                Criada em {new Date(task.createdAt).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
            </View>
          </View>

          <View style={[styles.detailSection, { borderColor }]}>
            <View style={styles.detailSectionHeader}>
              <Icon name={ClipboardList} size={16} color={primaryColor} />
              <Text style={[styles.detailSectionTitle, { color: textColor }]}>Descrição</Text>
            </View>
            {task.descricao ? (
              <Text style={[styles.detailSectionContent, { color: textColor }]}>{task.descricao}</Text>
            ) : (
              <Text style={[styles.detailSectionContent, { color: mutedColor }]}>Nenhuma descrição informada</Text>
            )}
          </View>

          <View style={[styles.detailSection, { borderColor }]}>
            <View style={styles.detailSectionHeader}>
              <Icon name={CheckCircle2} size={16} color="#16A34A" />
              <Text style={[styles.detailSectionTitle, { color: textColor }]}>Tipo de Atividade</Text>
            </View>
            <Text style={[styles.detailSectionContent, { color: textColor }]}>
              {TIPOS.find((t) => t.value === task.tipo)?.label || task.tipo}
            </Text>
          </View>

          <View style={[styles.detailSection, { borderColor }]}>
            <View style={styles.detailSectionHeader}>
              <Icon name={MapPin} size={16} color={primaryColor} />
              <Text style={[styles.detailSectionTitle, { color: textColor }]}>Talhão</Text>
            </View>
            <Text style={[styles.detailSectionContent, { color: textColor }]}>
              {task.talhaoNome || 'Não definido'}
            </Text>
          </View>

          <View style={[styles.detailSection, { borderColor }]}>
            <View style={styles.detailSectionHeader}>
              <Icon name={Calendar} size={16} color={mutedColor} />
              <Text style={[styles.detailSectionTitle, { color: textColor }]}>Datas</Text>
            </View>
            <View style={styles.detailDatesList}>
              <View style={styles.detailDateRow}>
                <Text style={[styles.detailDateLabel, { color: mutedColor }]}>Criada em</Text>
                <Text style={[styles.detailDateValue, { color: textColor }]}>
                  {new Date(task.createdAt).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
              </View>
              {task.dataInicio && (
                <View style={styles.detailDateRow}>
                  <Text style={[styles.detailDateLabel, { color: mutedColor }]}>Início previsto</Text>
                  <Text style={[styles.detailDateValue, { color: textColor }]}>
                    {new Date(task.dataInicio).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {task.plotId && (
            <View style={[styles.detailSection, { borderColor }]}>
              <View style={styles.detailSectionHeader}>
                <Icon name={Layers} size={16} color={primaryColor} />
                <Text style={[styles.detailSectionTitle, { color: textColor }]}>
                  Pontos de monitoramento (deste talhão)
                </Text>
                {!scoutsLoading && (
                  <Text style={[styles.detailSectionCount, { color: mutedColor }]}>
                    {taskScouts.length} ponto{taskScouts.length !== 1 ? 's' : ''}
                  </Text>
                )}
              </View>
              {scoutsLoading ? (
                <ActivityIndicator size="small" color={primaryColor} style={{ marginVertical: 16 }} />
              ) : taskScouts.length === 0 ? (
                <Text style={[styles.noScoutsText, { color: mutedColor }]}>
                  Nenhum ponto de monitoramento neste talhão
                </Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scoutsScroll}>
                  {taskScouts.map((scout) => (
                    <View key={scout.id} style={[styles.scoutCard, { backgroundColor: cardColor }]}>
                      <View style={styles.scoutCardHeader}>
                        <View style={[
                          styles.scoutStatusDot,
                          { backgroundColor: scout.status === 'CONCLUIDO' ? '#10B981' : '#F59E0B' },
                        ]} />
                        <Text style={[styles.scoutCardTitle, { color: textColor }]}>{scout.nome}</Text>
                      </View>
                      <View style={styles.scoutCardRow}>
                        <Icon name={Calendar} size={12} color={mutedColor} />
                        <Text style={[styles.scoutCardText, { color: mutedColor }]}>
                          {new Date(scout.createdAt).toLocaleDateString('pt-BR')}
                        </Text>
                      </View>
                      {scout.pests.length > 0 ? (
                        <View style={styles.scoutPestsList}>
                          <Text style={[styles.scoutPestsTitle, { color: '#EF4444' }]}>
                            {scout.pests.length} praga{scout.pests.length > 1 ? 's' : ''}:
                          </Text>
                          {scout.pests.slice(0, 3).map((pest) => (
                            <View key={pest.id} style={styles.scoutPestItem}>
                              <View style={[
                                styles.severityDot,
                                { backgroundColor: getSeverityColor(pest.prioridade || 'BAIXA') },
                              ]} />
                              <Text style={[styles.scoutPestName, { color: textColor }]} numberOfLines={1}>
                                {pest.pragaNome || 'Desconhecida'}
                              </Text>
                              <Text style={[styles.scoutPestQty, { color: mutedColor }]}>
                                ({pest.contagem || 0})
                              </Text>
                            </View>
                          ))}
                          {scout.pests.length > 3 && (
                            <Text style={[styles.morePests, { color: mutedColor }]}>
                              +{scout.pests.length - 3} mais...
                            </Text>
                          )}
                        </View>
                      ) : (
                        <Text style={[styles.noPestsText, { color: '#10B981' }]}>Sem pragas identificadas</Text>
                      )}
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {task.plotId && (
            <View style={[styles.detailSection, { borderColor }]}>
              <View style={styles.detailSectionHeader}>
                <Icon name={FlaskConical} size={16} color="#16A34A" />
                <Text style={[styles.detailSectionTitle, { color: textColor }]}>Recomendações (este talhão)</Text>
              </View>
              {loadingTalhaoRecomendacoes ? (
                <ActivityIndicator size="small" color="#16A34A" style={{ marginVertical: 12 }} />
              ) : talhaoRecomendacoes.length === 0 ? (
                <Text style={[styles.embrapaEmptyText, { color: mutedColor }]}>
                  Nenhuma recomendação registrada para as pragas deste talhão. Faça um monitoramento com identificação por IA para gerar recomendações.
                </Text>
              ) : (
                <View style={styles.embrapaProductsList}>
                  {talhaoRecomendacoes.map((p, idx) => (
                    <View key={`${p.pragaNome}-${idx}`} style={[styles.embrapaPragaBlock, { borderColor: borderColor + '80' }]}>
                      <Text style={[styles.embrapaPragaNome, { color: textColor }]}>{p.pragaNome}</Text>
                      {p.recomendacao ? (
                        <Text style={[styles.embrapaRecText, { color: mutedColor }]}>{p.recomendacao}</Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          <View style={styles.detailSyncRow}>
            <View style={[styles.syncBadge, { backgroundColor: task.synced ? '#10B98120' : '#F59E0B20' }]}>
              <View style={[styles.syncDot, { backgroundColor: task.synced ? '#10B981' : '#F59E0B' }]} />
              <Text style={[styles.syncText, { color: task.synced ? '#10B981' : '#F59E0B' }]}>
                {task.synced ? 'Sincronizado' : 'Aguardando sincronização'}
              </Text>
            </View>
          </View>

          <View style={styles.detailActions}>
            <TouchableOpacity
              style={[styles.detailActionBtn, { backgroundColor: '#10B98115' }]}
              onPress={onToggleStatus}
              disabled={isToggling}
            >
              <Icon name={CheckCircle2} size={20} color="#10B981" />
              <Text style={[styles.detailActionText, { color: '#10B981' }]}>
                {isToggling ? 'Atualizando...' : task.status === 'concluida' ? 'Reabrir' : 'Concluir'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.detailActionBtn, { backgroundColor: primaryColor + '15' }]}
              onPress={onEdit}
            >
              <Icon name={Edit3} size={20} color={primaryColor} />
              <Text style={[styles.detailActionText, { color: primaryColor }]}>Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.detailActionBtn, { backgroundColor: '#EF444415' }]}
              onPress={onDelete}
              disabled={isDeleting}
            >
              <Icon name={Trash2} size={20} color="#EF4444" />
              <Text style={[styles.detailActionText, { color: '#EF4444' }]}>
                {isDeleting ? 'Excluindo...' : 'Excluir'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.closeDetailBtn, { borderColor: sheetAccent }]}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={[styles.closeDetailBtnText, { color: sheetAccent }]}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  detailScroll: { maxHeight: '100%' },
  detailContainer: { gap: 16, paddingTop: 8, paddingBottom: 24 },
  detailStatusCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, gap: 12 },
  detailStatusInfo: { flex: 1 },
  detailStatusLabel: { fontSize: 16, fontWeight: '700' },
  detailStatusDate: { fontSize: 12, marginTop: 2 },
  detailSection: { borderTopWidth: 1, paddingTop: 16 },
  detailSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  detailSectionTitle: { fontSize: 14, fontWeight: '600', flex: 1 },
  detailSectionCount: { fontSize: 12 },
  detailSectionContent: { fontSize: 14, lineHeight: 20 },
  detailDatesList: { gap: 8 },
  detailDateRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailDateLabel: { fontSize: 13 },
  detailDateValue: { fontSize: 14, fontWeight: '600' },
  detailSyncRow: { alignItems: 'flex-start', marginTop: 4 },
  syncBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, gap: 6 },
  syncDot: { width: 6, height: 6, borderRadius: 3 },
  syncText: { fontSize: 12, fontWeight: '600' },
  detailActions: { flexDirection: 'row', gap: 10 },
  detailActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 10, gap: 8 },
  detailActionText: { fontSize: 13, fontWeight: '600' },
  closeDetailBtn: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  closeDetailBtnText: { fontSize: 15, fontWeight: '600' },
  scoutsScroll: { marginHorizontal: -16, paddingHorizontal: 16 },
  scoutCard: { width: 180, padding: 12, borderRadius: 10, marginRight: 12 },
  scoutCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  scoutStatusDot: { width: 8, height: 8, borderRadius: 4 },
  scoutCardTitle: { fontSize: 14, fontWeight: '600' },
  scoutCardRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  scoutCardText: { fontSize: 12 },
  scoutPestsList: { gap: 4 },
  scoutPestsTitle: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  scoutPestItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  severityDot: { width: 6, height: 6, borderRadius: 3 },
  scoutPestName: { fontSize: 12, flex: 1 },
  scoutPestQty: { fontSize: 11 },
  morePests: { fontSize: 11, fontStyle: 'italic', marginTop: 4 },
  noScoutsText: { fontSize: 13, textAlign: 'center', paddingVertical: 16 },
  noPestsText: { fontSize: 11, fontWeight: '500', marginTop: 4 },
  embrapaEmptyText: { fontSize: 13, lineHeight: 20, paddingVertical: 8 },
  embrapaProductsList: { gap: 12 },
  embrapaPragaBlock: { padding: 10, borderRadius: 8, borderWidth: 1, gap: 6 },
  embrapaPragaNome: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  embrapaRecText: { fontSize: 12, lineHeight: 18, marginTop: 4 },
});
