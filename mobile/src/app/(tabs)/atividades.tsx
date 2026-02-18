import { useState, useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BottomSheet, useBottomSheet } from '@/components/ui/bottom-sheet-simple';
import { useAtividades } from '@/hooks/use-atividades';
import { useSupabaseActivities, useSupabasePlots, useScoutsByPlot, fetchTalhaoMonitoramentoDetail, type AtividadeTipo } from '@/hooks/use-supabase-data';
import { useColor } from '@/hooks/useColor';
import { Icon } from '@/components/ui/icon';
import { palette } from '@/theme/colors';
import { useAvatarUri, useAppStore } from '@/stores/app-store';
import { useAuthFazendaPadrao } from '@/stores/auth-store';
import { supabase, isSupabaseConfigured } from '@/services/supabase';
import { logger } from '@/services/logger';
import { 
  ClipboardList, 
  Search, 
  Plus,
  Calendar,
  CheckCircle2,
  MoreVertical,
  MapPin,
  Edit3,
  Trash2,
  X,
  Clock,
  Layers,
  AlertCircle,
  FlaskConical
} from 'lucide-react-native';

interface AtividadeDetalhes {
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

type TabType = 'todas' | 'pendentes' | 'concluidas';

export default function AtividadesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const avatarUri = useAvatarUri();
  const backgroundColor = useColor({}, 'background');
  const cardColor = useColor({}, 'card');
  const textColor = useColor({}, 'text');
  const mutedColor = useColor({}, 'textMuted');
  const borderColor = useColor({}, 'border');
  const primaryColor = useColor({}, 'primary');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('todas');
  
  // Hooks
  const { isOnline } = useAppStore();
  const fazenda = useAuthFazendaPadrao();
  const { atividades: localAtividades, create, refresh, concluir, remove } = useAtividades();
  const { activities: supabaseActivities, isLoading, refresh: refreshSupabase } = useSupabaseActivities();
  const { plots } = useSupabasePlots();
  const { isVisible, open, close } = useBottomSheet();
  const { isVisible: isDetailVisible, open: openDetail, close: closeDetail } = useBottomSheet();
  const { isVisible: isEditVisible, open: openEdit, close: closeEdit } = useBottomSheet();
  
  // Estado para tarefa selecionada
  const [selectedTask, setSelectedTask] = useState<AtividadeDetalhes | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  
  // Estado para edição
  const [editNome, setEditNome] = useState('');
  const [editDescricao, setEditDescricao] = useState('');
  const [editTipo, setEditTipo] = useState<AtividadeTipo>('OUTROS');
  const [editPlotId, setEditPlotId] = useState<number | string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Estado para formulário de criação
  const [formPlotId, setFormPlotId] = useState<number | string | null>(null);

  // Recomendações Embrapa do talhão vinculado à tarefa (para exibir no detalhe)
  const [talhaoRecomendacoes, setTalhaoRecomendacoes] = useState<Array<{ pragaNome: string; recomendacao?: string }>>([]);
  const [loadingTalhaoRecomendacoes, setLoadingTalhaoRecomendacoes] = useState(false);
  
  // Buscar scouts do talhão da tarefa selecionada
  const { scouts: taskScouts, isLoading: scoutsLoading } = useScoutsByPlot(selectedTask?.plotId);
  
  // Usar dados do Supabase se online, senão usar dados locais
  const atividades = useMemo(() => {
    if (isOnline && supabaseActivities.length > 0) {
      return supabaseActivities.map(a => {
        const firstTalhaoId = a.talhaoIds?.length ? a.talhaoIds[0] : undefined;
        return {
          id: String(a.id),
          nome: a.titulo,
          descricao: a.descricao,
          tipo: a.tipo || 'OUTROS',
          status: (a.situacao || 'PENDENTE').toLowerCase(),
          plotId: firstTalhaoId != null ? String(firstTalhaoId) : undefined,
          talhaoNome: firstTalhaoId != null ? plots.find(p => p.id === firstTalhaoId)?.nome : undefined,
          dataInicio: a.dataInicio || a.createdAt,
          createdAt: a.createdAt,
          updatedAt: a.createdAt,
          synced: true,
        };
      });
    }
    return localAtividades;
  }, [isOnline, supabaseActivities, localAtividades, plots]);
  
  // Abrir sheet automaticamente se vier da home screen
  useEffect(() => {
    if (params.openForm === 'true') {
      open();
      // Limpar o parâmetro da URL
      router.setParams({ openForm: undefined });
    }
  }, [params.openForm, open, router]);

  // Buscar pragas com recomendações Embrapa do talhão quando abrir o detalhe da tarefa
  useEffect(() => {
    if (!isDetailVisible || !selectedTask?.plotId) {
      setTalhaoRecomendacoes([]);
      return;
    }
    const talhaoId = Number(selectedTask.plotId);
    if (!Number.isFinite(talhaoId)) return;

    let cancelled = false;
    setLoadingTalhaoRecomendacoes(true);
    fetchTalhaoMonitoramentoDetail(talhaoId, selectedTask.talhaoNome ?? 'Talhão', undefined, undefined)
      .then((payload) => {
        if (cancelled || !payload?.pragas) return;
        const withRec = payload.pragas.filter(
          (p) => p.recomendacao && p.recomendacao.trim() !== ''
        );
        setTalhaoRecomendacoes(
          withRec.map((p) => ({
            pragaNome: p.pragaNome,
            recomendacao: p.recomendacao,
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setTalhaoRecomendacoes([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingTalhaoRecomendacoes(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isDetailVisible, selectedTask?.plotId, selectedTask?.talhaoNome]);
  
  // Form state
  const [formNome, setFormNome] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formTipo, setFormTipo] = useState<AtividadeTipo>('OUTROS');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handlers
  const handleNova = () => {
    setFormNome('');
    setFormDescricao('');
    setFormTipo('OUTROS');
    setFormPlotId(null);
    open();
  };
  
  // Abrir detalhes da tarefa
  const handleTaskPress = (task: AtividadeDetalhes) => {
    setSelectedTask(task);
    openDetail();
  };
  
  // Alternar status (concluída/pendente)
  const handleToggleStatus = async () => {
    if (!selectedTask) return;
    
    try {
      setIsToggling(true);
      
      const newStatus = selectedTask.status === 'concluida' ? 'pendente' : 'concluida';
      
      if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase
          .from('atividades')
          .update({ 
            situacao: newStatus === 'concluida' ? 'CONCLUIDA' : 'PENDENTE', 
            updated_at: new Date().toISOString() 
          })
          .eq('id', Number(selectedTask.id));
        
        if (error) {
          logger.error('Erro ao atualizar status', { error });
          throw error;
        }
        
        await refreshSupabase();
      } else {
        await concluir(String(selectedTask.id));
        await refresh();
      }
      
      closeDetail();
      setSelectedTask(null);
      Alert.alert('Sucesso', newStatus === 'concluida' ? 'Tarefa concluída!' : 'Tarefa reaberta!');
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Erro ao atualizar tarefa');
    } finally {
      setIsToggling(false);
    }
  };
  
  // Abrir edição
  const handleOpenEdit = () => {
    if (!selectedTask) return;
    setEditNome(selectedTask.nome);
    setEditDescricao(selectedTask.descricao || '');
    setEditTipo(selectedTask.tipo);
    setEditPlotId(selectedTask.plotId || null);
    closeDetail();
    setTimeout(() => openEdit(), 300);
  };
  
  // Salvar edição
  const handleSaveEdit = async () => {
    if (!selectedTask || !editNome.trim()) {
      Alert.alert('Erro', 'Nome é obrigatório');
      return;
    }
    
    if (!editPlotId) {
      Alert.alert('Erro', 'Selecione um talhão');
      return;
    }
    
    try {
      setIsEditing(true);
      
      if (isSupabaseConfigured() && supabase) {
        const { error } = await supabase
          .from('atividades')
          .update({ 
            titulo: editNome.trim(),
            descricao: editDescricao.trim() || null,
            tipo: editTipo,
            talhao_ids: editPlotId != null ? [Number(editPlotId)] : [],
            updated_at: new Date().toISOString() 
          })
          .eq('id', Number(selectedTask.id));
        
        if (error) {
          logger.error('Erro ao editar tarefa', { error });
          throw error;
        }
        
        await refreshSupabase();
      }
      
      closeEdit();
      setSelectedTask(null);
      Alert.alert('Sucesso', 'Tarefa atualizada!');
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Erro ao editar tarefa');
    } finally {
      setIsEditing(false);
    }
  };
  
  // Excluir tarefa
  const handleDelete = () => {
    if (!selectedTask) return;
    
    Alert.alert(
      'Excluir Tarefa',
      `Tem certeza que deseja excluir "${selectedTask.nome}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Excluir', 
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              
              if (isSupabaseConfigured() && supabase) {
                const { error } = await supabase
                  .from('atividades')
                  .update({ 
                    deleted_at: new Date().toISOString(),
                    updated_at: new Date().toISOString() 
                  })
                  .eq('id', Number(selectedTask.id));
                
                if (error) throw error;
                await refreshSupabase();
              } else {
                await remove(String(selectedTask.id));
                await refresh();
              }
              
              closeDetail();
              setSelectedTask(null);
              Alert.alert('Sucesso', 'Tarefa excluída!');
            } catch (error: any) {
              Alert.alert('Erro', error.message || 'Erro ao excluir');
            } finally {
              setIsDeleting(false);
            }
          }
        }
      ]
    );
  };
  
  // Cor por severidade
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'baixa': return '#10B981';
      case 'media': return '#F59E0B';
      case 'alta': return '#F97316';
      case 'critica': return '#EF4444';
      default: return mutedColor;
    }
  };
  
  // Toggle rápido de status (pelo checkbox)
  const handleQuickToggle = async (task: AtividadeDetalhes) => {
    try {
      const newStatus = task.status === 'concluida' ? 'pendente' : 'concluida';
      
      if (isSupabaseConfigured() && supabase) {
        await supabase
          .from('atividades')
          .update({ situacao: newStatus === 'concluida' ? 'CONCLUIDA' : 'PENDENTE', updated_at: new Date().toISOString() })
          .eq('id', Number(task.id));
        await refreshSupabase();
      } else {
        await concluir(String(task.id));
        await refresh();
      }
    } catch (error) {
      logger.error('Erro ao alternar status rápido', { error });
    }
  };

  const handleSubmit = async () => {
    if (!formNome.trim()) {
      Alert.alert('Erro', 'Nome da atividade é obrigatório');
      return;
    }
    
    if (!formPlotId) {
      Alert.alert('Erro', 'Selecione um talhão para a tarefa');
      return;
    }

    try {
      setIsSubmitting(true);
      
      if (isSupabaseConfigured() && supabase && fazenda?.id) {
        const { error } = await supabase
          .from('atividades')
          .insert({
            fazenda_id: fazenda.id,
            titulo: formNome.trim(),
            descricao: formDescricao.trim() || null,
            tipo: formTipo,
            situacao: 'PENDENTE' as const,
            prioridade: 'MEDIA' as const,
            talhao_ids: formPlotId != null ? [Number(formPlotId)] : [],
          });
        
        if (error) throw error;
        await refreshSupabase();
      } else {
        await create({
          nome: formNome.trim(),
          descricao: formDescricao.trim() || undefined,
          tipo: formTipo,
          talhaoNome: plots.find(p => String(p.id) === String(formPlotId))?.nome,
        });
        refresh();
      }
      
      close();
      setFormNome('');
      setFormDescricao('');
      setFormPlotId(null);
      Alert.alert('Sucesso', 'Atividade criada com sucesso!');
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Erro ao criar atividade');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredAtividades = atividades.filter((atividade) => {
    const matchesSearch = atividade.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         atividade.descricao?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeTab === 'todas' || 
                         (activeTab === 'pendentes' && atividade.status === 'pendente') ||
                         (activeTab === 'concluidas' && atividade.status === 'concluida');
    return matchesSearch && matchesFilter;
  });

  const tabs: { key: TabType; label: string; count: number }[] = [
    { key: 'todas', label: 'Todas', count: atividades.length },
    { key: 'pendentes', label: 'Pendentes', count: atividades.filter(a => a.status === 'pendente').length },
    { key: 'concluidas', label: 'Concluídas', count: atividades.filter(a => a.status === 'concluida').length },
  ];

  const tipos: { value: AtividadeTipo; label: string }[] = [
    { value: 'MONITORAMENTO', label: 'Monitoramento' },
    { value: 'APLICACAO', label: 'Aplicação' },
    { value: 'CONTROLE_PRAGAS', label: 'Controle de Pragas' },
    { value: 'VERIFICACAO', label: 'Verificação' },
    { value: 'PLANTIO', label: 'Plantio' },
    { value: 'COLHEITA', label: 'Colheita' },
    { value: 'OUTROS', label: 'Outros' },
  ];

  const handlePerfil = () => {
    router.push('/(tabs)/perfil');
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: textColor }]}>Tarefas</Text>
          <Text style={[styles.headerSubtitle, { color: mutedColor }]}>
            {atividades.length} atividades registradas
          </Text>
        </View>
        <TouchableOpacity 
          onPress={handlePerfil}
          activeOpacity={0.7}
          style={styles.avatarContainer}
        >
          <Image
            source={avatarUri ? { uri: avatarUri } : require('../../../assets/images/avatar.jpg')}
            style={styles.avatar}
            resizeMode="cover"
          />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchSection}>
        <View style={[styles.searchContainer, { backgroundColor: cardColor, borderColor }]}>
          <Icon name={Search} size={18} color={mutedColor} />
          <TextInput
            style={[styles.searchInput, { color: textColor }]}
            placeholder="Buscar tarefas..."
            placeholderTextColor={mutedColor}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <View style={[styles.tabsRow, { borderBottomColor: borderColor }]}>
          <View style={styles.tabsList}>
            {tabs.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={styles.tab}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
              >
                <Text 
                  style={[
                    styles.tabLabel, 
                    { color: activeTab === tab.key ? primaryColor : mutedColor }
                  ]}
                >
                  {tab.label}
                </Text>
                <Text 
                  style={[
                    styles.tabCount, 
                    { 
                      color: activeTab === tab.key ? primaryColor : mutedColor,
                      opacity: activeTab === tab.key ? 1 : 0.6
                    }
                  ]}
                >
                  {tab.count}
                </Text>
                {activeTab === tab.key && (
                  <View style={[styles.tabIndicator, { backgroundColor: primaryColor }]} />
                )}
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity 
            style={[styles.addButton, { borderColor: primaryColor }]}
            activeOpacity={0.7}
            onPress={handleNova}
          >
            <Icon name={Plus} size={16} color={primaryColor} />
            <Text style={[styles.addButtonText, { color: primaryColor }]}>Nova</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Lista */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredAtividades.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: cardColor }]}>
              <Icon name={ClipboardList} size={32} color={mutedColor} />
            </View>
            <Text style={[styles.emptyTitle, { color: textColor }]}>
              Nenhuma tarefa encontrada
            </Text>
            <Text style={[styles.emptySubtitle, { color: mutedColor }]}>
              {searchQuery ? 'Tente buscar por outro termo' : 'Crie sua primeira tarefa'}
            </Text>
          </View>
        ) : (
          filteredAtividades.map((atividade) => (
            <TouchableOpacity 
              key={atividade.id} 
              style={[styles.taskCard, { backgroundColor: cardColor }]}
              activeOpacity={0.7}
              onPress={() => handleTaskPress(atividade as AtividadeDetalhes)}
            >
              <View style={styles.taskLeft}>
                <TouchableOpacity 
                  style={styles.checkButton}
                  onPress={() => handleQuickToggle(atividade as AtividadeDetalhes)}
                >
                  {atividade.status === 'concluida' ? (
                    <Icon name={CheckCircle2} size={22} color={palette.gold} />
                  ) : (
                    <View style={[styles.emptyCheck, { borderColor: mutedColor }]} />
                  )}
                </TouchableOpacity>
                <View style={styles.taskInfo}>
                  <Text 
                    style={[
                      styles.taskName, 
                      { 
                        color: textColor,
                        textDecorationLine: atividade.status === 'concluida' ? 'line-through' : 'none',
                        opacity: atividade.status === 'concluida' ? 0.6 : 1
                      }
                    ]}
                  >
                    {atividade.nome}
                  </Text>
                  {atividade.talhaoNome && (
                    <View style={styles.talhaoTag}>
                      <Icon name={MapPin} size={11} color={primaryColor} />
                      <Text style={[styles.talhaoText, { color: primaryColor }]}>
                        {atividade.talhaoNome}
                      </Text>
                    </View>
                  )}
                  {atividade.descricao && (
                    <Text style={[styles.taskDescription, { color: mutedColor }]} numberOfLines={1}>
                      {atividade.descricao}
                    </Text>
                  )}
                  <View style={styles.taskMeta}>
                    <Icon name={Calendar} size={12} color={mutedColor} />
                    <Text style={[styles.taskDate, { color: mutedColor }]}>
                      {atividade.dataInicio ? new Date(atividade.dataInicio).toLocaleDateString('pt-BR') : 'Sem data'}
                    </Text>
                    <View style={[styles.tipoBadge, { backgroundColor: palette.gold + '15' }]}>
                      <Text style={[styles.tipoText, { color: palette.gold }]}>
                        {tipos.find(t => t.value === atividade.tipo)?.label || atividade.tipo}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
              <TouchableOpacity 
                style={styles.moreButton}
                onPress={() => handleTaskPress(atividade as AtividadeDetalhes)}
              >
                <Icon name={MoreVertical} size={18} color={mutedColor} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Modal de Nova Atividade */}
      <BottomSheet
        isVisible={isVisible}
        onClose={close}
        title="Nova Tarefa"
      >
        <View style={styles.formContainer}>
          <View style={styles.formField}>
            <View style={styles.labelContainer}>
              <Icon name={ClipboardList} size={16} color={mutedColor} />
              <Text style={[styles.label, { color: textColor }]}>Nome da Tarefa *</Text>
            </View>
            <Input
              placeholder="Ex: Monitoramento Talhão A"
              value={formNome}
              onChangeText={setFormNome}
              containerStyle={styles.input}
            />
          </View>

          <View style={styles.formField}>
            <View style={styles.labelContainer}>
              <Icon name={Calendar} size={16} color={mutedColor} />
              <Text style={[styles.label, { color: textColor }]}>Descrição</Text>
            </View>
            <Input
              placeholder="Ex: Verificar presença de lagartas e percevejos"
              value={formDescricao}
              onChangeText={setFormDescricao}
              containerStyle={{ ...styles.input, ...styles.textArea }}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.formField}>
            <View style={styles.labelContainer}>
              <Icon name={CheckCircle2} size={16} color={mutedColor} />
              <Text style={[styles.label, { color: textColor }]}>Tipo de Atividade</Text>
            </View>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              style={styles.tipoContainer}
              contentContainerStyle={styles.tipoContent}
            >
              {tipos.map((tipo) => (
                <TouchableOpacity
                  key={tipo.value}
                  style={[
                    styles.tipoButton,
                    {
                      backgroundColor: formTipo === tipo.value ? palette.gold : cardColor,
                      borderColor: formTipo === tipo.value ? palette.gold : borderColor,
                    },
                  ]}
                  onPress={() => setFormTipo(tipo.value)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.tipoButtonText,
                      { 
                        color: formTipo === tipo.value 
                          ? '#000000' 
                          : textColor,
                        fontWeight: formTipo === tipo.value ? '600' : '400',
                      },
                    ]}
                  >
                    {tipo.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.formField}>
            <View style={styles.labelContainer}>
              <Icon name={MapPin} size={16} color={mutedColor} />
              <Text style={[styles.label, { color: textColor }]}>Talhão *</Text>
            </View>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              style={styles.tipoContainer}
              contentContainerStyle={styles.tipoContent}
            >
              {plots.map((plot) => (
                <TouchableOpacity
                  key={plot.id}
                  style={[
                    styles.plotButton,
                    {
                      backgroundColor: formPlotId === plot.id ? primaryColor : cardColor,
                      borderColor: formPlotId === plot.id ? primaryColor : borderColor,
                    },
                  ]}
                  onPress={() => setFormPlotId(plot.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.plotButtonText,
                      { 
                        color: formPlotId === plot.id ? '#FFFFFF' : textColor,
                        fontWeight: formPlotId === plot.id ? '600' : '400',
                      },
                    ]}
                  >
                    {plot.nome}
                  </Text>
                  <Text
                    style={[
                      styles.plotButtonSubtext,
                      { color: formPlotId === plot.id ? '#FFFFFF99' : mutedColor },
                    ]}
                  >
                    {plot.area || '?'}ha • {plot.culturaAtual || 'N/A'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.formActions}>
            <Button
              variant="outline"
              onPress={close}
              style={[styles.cancelButton, { flex: 1 }]}
            >
              Cancelar
            </Button>
            <Button
              variant="default"
              onPress={handleSubmit}
              style={[
                styles.submitButton, 
                { 
                  flex: 1,
                  backgroundColor: palette.gold,
                }
              ]}
              disabled={isSubmitting || !formNome.trim() || !formPlotId}
            >
              <Text style={{ color: '#000000', fontWeight: '600' }}>
                {isSubmitting ? 'Salvando...' : 'Criar Tarefa'}
              </Text>
            </Button>
          </View>
        </View>
      </BottomSheet>

      {/* Modal de Detalhes da Tarefa */}
      <BottomSheet
        isVisible={isDetailVisible}
        onClose={() => { closeDetail(); setSelectedTask(null); }}
        title={selectedTask?.nome ?? 'Detalhes da Tarefa'}
      >
        {selectedTask && (
          <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.detailContainer}>
              {/* Status da Tarefa */}
              <View style={[styles.detailStatusCard, { 
                backgroundColor: selectedTask.status === 'concluida' ? '#10B98115' : 
                                selectedTask.status === 'em_andamento' ? '#F59E0B15' : primaryColor + '15'
              }]}>
                <Icon 
                  name={selectedTask.status === 'concluida' ? CheckCircle2 : Clock} 
                  size={24} 
                  color={selectedTask.status === 'concluida' ? '#10B981' : 
                         selectedTask.status === 'em_andamento' ? '#F59E0B' : primaryColor} 
                />
                <View style={styles.detailStatusInfo}>
                  <Text style={[styles.detailStatusLabel, { 
                    color: selectedTask.status === 'concluida' ? '#10B981' : 
                           selectedTask.status === 'em_andamento' ? '#F59E0B' : primaryColor 
                  }]}>
                    {selectedTask.status === 'concluida' ? 'Concluída' : 
                     selectedTask.status === 'em_andamento' ? 'Em Andamento' : 'Pendente'}
                  </Text>
                  <Text style={[styles.detailStatusDate, { color: mutedColor }]}>
                    Criada em {new Date(selectedTask.createdAt).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
              </View>

              {/* Descrição */}
              <View style={[styles.detailSection, { borderColor }]}>
                <View style={styles.detailSectionHeader}>
                  <Icon name={ClipboardList} size={16} color={primaryColor} />
                  <Text style={[styles.detailSectionTitle, { color: textColor }]}>
                    Descrição
                  </Text>
                </View>
                {selectedTask.descricao ? (
                  <Text style={[styles.detailSectionContent, { color: textColor }]}>
                    {selectedTask.descricao}
                  </Text>
                ) : (
                  <Text style={[styles.detailSectionContent, { color: mutedColor }]}>
                    Nenhuma descrição informada
                  </Text>
                )}
              </View>

              {/* Tipo de Atividade */}
              <View style={[styles.detailSection, { borderColor }]}>
                <View style={styles.detailSectionHeader}>
                  <Icon name={CheckCircle2} size={16} color={palette.gold} />
                  <Text style={[styles.detailSectionTitle, { color: textColor }]}>
                    Tipo de Atividade
                  </Text>
                </View>
                <Text style={[styles.detailSectionContent, { color: textColor }]}>
                  {tipos.find(t => t.value === selectedTask.tipo)?.label || selectedTask.tipo}
                </Text>
              </View>

              {/* Talhão */}
              <View style={[styles.detailSection, { borderColor }]}>
                <View style={styles.detailSectionHeader}>
                  <Icon name={MapPin} size={16} color={primaryColor} />
                  <Text style={[styles.detailSectionTitle, { color: textColor }]}>
                    Talhão
                  </Text>
                </View>
                <Text style={[styles.detailSectionContent, { color: textColor }]}>
                  {selectedTask.talhaoNome || 'Não definido'}
                </Text>
              </View>

              {/* Datas */}
              <View style={[styles.detailSection, { borderColor }]}>
                <View style={styles.detailSectionHeader}>
                  <Icon name={Calendar} size={16} color={mutedColor} />
                  <Text style={[styles.detailSectionTitle, { color: textColor }]}>
                    Datas
                  </Text>
                </View>
                <View style={styles.detailDatesList}>
                  <View style={styles.detailDateRow}>
                    <Text style={[styles.detailDateLabel, { color: mutedColor }]}>Criada em</Text>
                    <Text style={[styles.detailDateValue, { color: textColor }]}>
                      {new Date(selectedTask.createdAt).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>
                  {selectedTask.dataInicio && (
                    <View style={styles.detailDateRow}>
                      <Text style={[styles.detailDateLabel, { color: mutedColor }]}>Início previsto</Text>
                      <Text style={[styles.detailDateValue, { color: textColor }]}>
                        {new Date(selectedTask.dataInicio).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

            {/* Scouts do talhão vinculado à atividade (atividade é por talhão, não por scout) */}
            {selectedTask.plotId && (
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
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    style={styles.scoutsScroll}
                  >
                    {taskScouts.map((scout) => (
                      <View 
                        key={scout.id} 
                        style={[styles.scoutCard, { backgroundColor: cardColor }]}
                      >
                        <View style={styles.scoutCardHeader}>
                          <View style={[
                            styles.scoutStatusDot, 
                            { backgroundColor: scout.status === 'CONCLUIDO' ? '#10B981' : '#F59E0B' }
                          ]} />
                          <Text style={[styles.scoutCardTitle, { color: textColor }]}>
                            {scout.nome}
                          </Text>
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
                                  { backgroundColor: getSeverityColor(pest.prioridade || 'BAIXA') }
                                ]} />
                                <Text 
                                  style={[styles.scoutPestName, { color: textColor }]}
                                  numberOfLines={1}
                                >
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
                          <Text style={[styles.noPestsText, { color: '#10B981' }]}>
                            Sem pragas identificadas
                          </Text>
                        )}
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}

            {/* Recomendações para o talhão desta tarefa */}
            {selectedTask.plotId && (
              <View style={[styles.detailSection, { borderColor }]}>
                <View style={styles.detailSectionHeader}>
                  <Icon name={FlaskConical} size={16} color="#16A34A" />
                  <Text style={[styles.detailSectionTitle, { color: textColor }]}>
                    Recomendações (este talhão)
                  </Text>
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

              {/* Status de sincronização */}
              <View style={styles.detailSyncRow}>
                <View style={[
                  styles.syncBadge, 
                  { backgroundColor: selectedTask.synced ? '#10B98120' : '#F59E0B20' }
                ]}>
                  <View style={[
                    styles.syncDot,
                    { backgroundColor: selectedTask.synced ? '#10B981' : '#F59E0B' }
                  ]} />
                  <Text style={[styles.syncText, { 
                    color: selectedTask.synced ? '#10B981' : '#F59E0B' 
                  }]}>
                    {selectedTask.synced ? 'Sincronizado' : 'Aguardando sincronização'}
                  </Text>
                </View>
              </View>

              {/* Ações */}
              <View style={styles.detailActions}>
              <TouchableOpacity 
                style={[styles.detailActionBtn, { backgroundColor: '#10B98115' }]}
                onPress={handleToggleStatus}
                disabled={isToggling}
              >
                <Icon name={CheckCircle2} size={20} color="#10B981" />
                <Text style={[styles.detailActionText, { color: '#10B981' }]}>
                  {isToggling ? 'Atualizando...' : 
                   selectedTask.status === 'concluida' ? 'Reabrir' : 'Concluir'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.detailActionBtn, { backgroundColor: primaryColor + '15' }]}
                onPress={handleOpenEdit}
              >
                <Icon name={Edit3} size={20} color={primaryColor} />
                <Text style={[styles.detailActionText, { color: primaryColor }]}>Editar</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.detailActionBtn, { backgroundColor: '#EF444415' }]}
                onPress={handleDelete}
                disabled={isDeleting}
              >
                <Icon name={Trash2} size={20} color="#EF4444" />
                <Text style={[styles.detailActionText, { color: '#EF4444' }]}>
                  {isDeleting ? 'Excluindo...' : 'Excluir'}
                </Text>
              </TouchableOpacity>
            </View>

              <Button
                variant="outline"
                onPress={() => { closeDetail(); setSelectedTask(null); }}
                style={styles.closeDetailBtn}
              >
                <Text>Fechar</Text>
              </Button>
            </View>
          </ScrollView>
        )}
      </BottomSheet>

      {/* Modal de Edição */}
      <BottomSheet
        isVisible={isEditVisible}
        onClose={closeEdit}
        title="Editar Tarefa"
      >
        <View style={styles.formContainer}>
          <View style={styles.formField}>
            <View style={styles.labelContainer}>
              <Icon name={ClipboardList} size={16} color={mutedColor} />
              <Text style={[styles.label, { color: textColor }]}>Nome da Tarefa *</Text>
            </View>
            <Input
              placeholder="Ex: Monitoramento Talhão A"
              value={editNome}
              onChangeText={setEditNome}
              containerStyle={styles.input}
            />
          </View>

          <View style={styles.formField}>
            <View style={styles.labelContainer}>
              <Icon name={Calendar} size={16} color={mutedColor} />
              <Text style={[styles.label, { color: textColor }]}>Descrição</Text>
            </View>
            <Input
              placeholder="Ex: Verificar presença de lagartas"
              value={editDescricao}
              onChangeText={setEditDescricao}
              containerStyle={{ ...styles.input, ...styles.textArea }}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.formField}>
            <View style={styles.labelContainer}>
              <Icon name={CheckCircle2} size={16} color={mutedColor} />
              <Text style={[styles.label, { color: textColor }]}>Tipo</Text>
            </View>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              style={styles.tipoContainer}
              contentContainerStyle={styles.tipoContent}
            >
              {tipos.map((tipo) => (
                <TouchableOpacity
                  key={tipo.value}
                  style={[
                    styles.tipoButton,
                    {
                      backgroundColor: editTipo === tipo.value ? palette.gold : cardColor,
                      borderColor: editTipo === tipo.value ? palette.gold : borderColor,
                    },
                  ]}
                  onPress={() => setEditTipo(tipo.value)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.tipoButtonText,
                      { color: editTipo === tipo.value ? '#000' : textColor },
                    ]}
                  >
                    {tipo.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.formField}>
            <View style={styles.labelContainer}>
              <Icon name={MapPin} size={16} color={mutedColor} />
              <Text style={[styles.label, { color: textColor }]}>Talhão *</Text>
            </View>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              style={styles.tipoContainer}
              contentContainerStyle={styles.tipoContent}
            >
              {plots.map((plot) => (
                <TouchableOpacity
                  key={plot.id}
                  style={[
                    styles.plotButton,
                    {
                      backgroundColor: editPlotId === plot.id ? primaryColor : cardColor,
                      borderColor: editPlotId === plot.id ? primaryColor : borderColor,
                    },
                  ]}
                  onPress={() => setEditPlotId(plot.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.plotButtonText,
                      { 
                        color: editPlotId === plot.id ? '#FFFFFF' : textColor,
                        fontWeight: editPlotId === plot.id ? '600' : '400',
                      },
                    ]}
                  >
                    {plot.nome}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.formActions}>
            <Button
              variant="outline"
              onPress={closeEdit}
              style={styles.cancelButton}
            >
              <Text>Cancelar</Text>
            </Button>
            <Button
              variant="default"
              onPress={handleSaveEdit}
              style={[styles.submitButton, { backgroundColor: palette.gold }]}
              disabled={isEditing || !editNome.trim() || !editPlotId}
            >
              <Text style={{ color: '#000000', fontWeight: '600' }}>
                {isEditing ? 'Salvando...' : 'Salvar'}
              </Text>
            </Button>
          </View>
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    gap: 4,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  searchSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  tabsContainer: {
    paddingHorizontal: 16,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  tabsList: {
    flexDirection: 'row',
  },
  tab: {
    paddingVertical: 12,
    marginRight: 16,
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  tabCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  taskLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: 12,
  },
  checkButton: {
    paddingTop: 2,
  },
  emptyCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
  },
  taskInfo: {
    flex: 1,
  },
  taskName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  taskDescription: {
    fontSize: 13,
    marginBottom: 8,
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  taskDate: {
    fontSize: 12,
  },
  moreButton: {
    padding: 4,
  },
  formContainer: {
    gap: 24,
    paddingTop: 8,
  },
  formField: {
    gap: 10,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    marginTop: 0,
  },
  textArea: {
    minHeight: 80,
    paddingTop: 12,
  },
  tipoContainer: {
    marginTop: 4,
  },
  tipoContent: {
    paddingRight: 16,
  },
  tipoButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    marginRight: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  tipoButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    paddingTop: 8,
  },
  cancelButton: {
    flex: 1,
  },
  submitButton: {
    flex: 1,
  },
  // Estilos para tags na lista
  talhaoTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  talhaoText: {
    fontSize: 12,
    fontWeight: '500',
  },
  tipoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  tipoText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  // Estilos para modal de detalhes
  detailScroll: {
    maxHeight: '100%',
  },
  detailContainer: {
    gap: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  detailStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  detailStatusInfo: {
    flex: 1,
  },
  detailStatusLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  detailStatusDate: {
    fontSize: 12,
    marginTop: 2,
  },
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
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  detailSectionCount: {
    fontSize: 12,
  },
  detailSectionContent: {
    fontSize: 14,
    lineHeight: 20,
  },
  detailDatesList: {
    gap: 8,
  },
  detailDateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailDateLabel: {
    fontSize: 13,
  },
  detailDateValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  detailSyncRow: {
    alignItems: 'flex-start',
    marginTop: 4,
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  syncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  syncText: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  detailDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  detailInfoGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  detailInfoItem: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    gap: 6,
  },
  detailInfoLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  detailInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  detailActions: {
    flexDirection: 'row',
    gap: 10,
  },
  detailActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 10,
    gap: 8,
  },
  detailActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  closeDetailBtn: {
    marginTop: 8,
  },
  // Estilos para seletor de talhão
  plotButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    marginRight: 10,
    minWidth: 100,
  },
  plotButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  plotButtonSubtext: {
    fontSize: 10,
    marginTop: 2,
  },
  // Estilos para seção de scouts nos detalhes
  scoutsSection: {
    paddingTop: 16,
    borderTopWidth: 1,
  },
  scoutsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  scoutsSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  scoutsSectionCount: {
    fontSize: 12,
  },
  scoutsScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  scoutCard: {
    width: 180,
    padding: 12,
    borderRadius: 10,
    marginRight: 12,
  },
  scoutCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  scoutStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  scoutCardTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  scoutCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  scoutCardText: {
    fontSize: 12,
  },
  scoutPestsList: {
    gap: 4,
  },
  scoutPestsTitle: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  scoutPestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  severityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  scoutPestName: {
    fontSize: 12,
    flex: 1,
  },
  scoutPestQty: {
    fontSize: 11,
  },
  morePests: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 4,
  },
  noScoutsText: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 16,
  },
  noPestsText: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
  },
  embrapaEmptyText: {
    fontSize: 13,
    lineHeight: 20,
    paddingVertical: 8,
  },
  embrapaProductsList: {
    gap: 12,
  },
  embrapaPragaBlock: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  embrapaPragaNome: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  embrapaRecText: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  embrapaProductRow: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  embrapaProductNome: {
    fontSize: 12,
    fontWeight: '600',
  },
  embrapaProductIngrediente: {
    fontSize: 11,
    marginTop: 2,
  },
});
