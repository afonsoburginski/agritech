import { useState, useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AppHeader } from '@/components/app-header';
import { BottomSheet, useBottomSheet } from '@/components/ui/bottom-sheet-simple';
import { TaskDetailSheet, type AtividadeDetalhes } from '@/components/task-detail-sheet';
import { useAtividades } from '@/hooks/use-atividades';
import { useSupabaseActivities, useSupabasePlots, type AtividadeTipo } from '@/hooks/use-supabase-data';
import { useColor } from '@/hooks/useColor';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Icon } from '@/components/ui/icon';
import { palette } from '@/theme/colors';
import { useAppStore } from '@/stores/app-store';
import { useEffectiveAvatarUri } from '@/stores/auth-store';
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
  X,
  AlertCircle,
} from 'lucide-react-native';

type TabType = 'todas' | 'pendentes' | 'concluidas';

export default function AtividadesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const avatarUri = useEffectiveAvatarUri();
  const backgroundColor = useColor({}, 'background');
  const cardColor = useColor({}, 'card');
  const textColor = useColor({}, 'text');
  const mutedColor = useColor({}, 'textMuted');
  const borderColor = useColor({}, 'border');
  const primaryColor = useColor({}, 'primary');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('todas');
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const sheetAccent = isDark ? '#fff' : palette.darkGreen;
  const sheetConfirmStyle = isDark
    ? { backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' }
    : { backgroundColor: palette.darkGreen + '20', borderWidth: 1, borderColor: palette.darkGreen };
  const sheetConfirmTextColor = isDark ? '#fff' : palette.darkGreen;

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
  const [formPrioridade, setFormPrioridade] = useState<'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA'>('MEDIA');

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
          prioridade: a.prioridade,
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
    setFormPrioridade('MEDIA');
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
            prioridade: formPrioridade,
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
      setFormPrioridade('MEDIA');
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

  const prioridades: { value: 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA'; label: string }[] = [
    { value: 'BAIXA', label: 'Baixa' },
    { value: 'MEDIA', label: 'Média' },
    { value: 'ALTA', label: 'Alta' },
    { value: 'CRITICA', label: 'Crítica' },
  ];

  const getPrioridadeColor = (p: string) => {
    switch ((p || '').toUpperCase()) {
      case 'CRITICA': return '#DC2626';
      case 'ALTA': return '#EA580C';
      case 'MEDIA': return '#F59E0B';
      case 'BAIXA': return '#10B981';
      default: return mutedColor;
    }
  };
  const getPrioridadeBg = (p: string) => {
    const c = getPrioridadeColor(p);
    return (c === mutedColor ? '#6B7280' : c) + '20';
  };

  const handlePerfil = () => {
    router.push('/(tabs)/perfil');
  };

  const pendentesCount = atividades.filter((a) => a.status === 'pendente').length;
  const concluidasCount = atividades.filter((a) => a.status === 'concluida').length;

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <AppHeader
        title="Tarefas"
        avatarUri={avatarUri}
        onAvatarPress={handlePerfil}
        isOnline={isOnline}
        showDuvidasButton
      >
        <Text style={styles.headerDescription}>
          Crie e acompanhe as atividades da fazenda: monitoramento, aplicações e tarefas do dia a dia.
        </Text>
      </AppHeader>

      <View style={[styles.summaryCard, { backgroundColor: cardColor, borderColor }]}>
        <View style={[styles.summaryCardIcon, { backgroundColor: primaryColor + '20' }]}>
          <Icon name={ClipboardList} size={20} color={primaryColor} />
        </View>
        <View style={styles.summaryCardContent}>
          <Text style={[styles.summaryCardTitle, { color: textColor }]}>Resumo</Text>
          <Text style={[styles.summaryCardText, { color: mutedColor }]}>
            {pendentesCount} pendente{pendentesCount !== 1 ? 's' : ''} · {concluidasCount} concluída{concluidasCount !== 1 ? 's' : ''}
          </Text>
        </View>
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
                    {'prioridade' in atividade && atividade.prioridade && (
                      <View style={[styles.prioridadeBadge, { backgroundColor: getPrioridadeBg(atividade.prioridade) }]}>
                        <Text style={[styles.prioridadeText, { color: getPrioridadeColor(atividade.prioridade) }]}>
                          {prioridades.find(p => p.value === atividade.prioridade)?.label || atividade.prioridade}
                        </Text>
                      </View>
                    )}
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
                      backgroundColor: formTipo === tipo.value ? sheetAccent : cardColor,
                      borderColor: formTipo === tipo.value ? sheetAccent : borderColor,
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
                          ? (isDark ? '#000' : '#fff') 
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
              <Icon name={AlertCircle} size={16} color={mutedColor} />
              <Text style={[styles.label, { color: textColor }]}>Prioridade</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tipoContainer}
              contentContainerStyle={styles.tipoContent}
            >
              {prioridades.map((p) => (
                <TouchableOpacity
                  key={p.value}
                  style={[
                    styles.tipoButton,
                    {
                      backgroundColor: formPrioridade === p.value ? sheetAccent : cardColor,
                      borderColor: formPrioridade === p.value ? sheetAccent : borderColor,
                    },
                  ]}
                  onPress={() => setFormPrioridade(p.value)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.tipoButtonText,
                      {
                        color: formPrioridade === p.value ? (isDark ? '#000' : '#fff') : textColor,
                        fontWeight: formPrioridade === p.value ? '600' : '400',
                      },
                    ]}
                  >
                    {p.label}
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
            <TouchableOpacity
              style={[styles.sheetCancelBtn, { borderColor: sheetAccent }]}
              onPress={close}
              activeOpacity={0.7}
            >
              <Text style={[styles.sheetCancelText, { color: sheetAccent }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.sheetConfirmBtn,
                sheetConfirmStyle,
                (!formNome.trim() || !formPlotId || isSubmitting) && { opacity: 0.5 },
              ]}
              onPress={handleSubmit}
              activeOpacity={0.7}
              disabled={isSubmitting || !formNome.trim() || !formPlotId}
            >
              <Text style={[styles.sheetConfirmText, { color: sheetConfirmTextColor }]}>
                {isSubmitting ? 'Salvando...' : 'Criar Tarefa'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </BottomSheet>

      <TaskDetailSheet
        isVisible={isDetailVisible}
        onClose={() => { closeDetail(); setSelectedTask(null); }}
        task={selectedTask}
        onToggleStatus={handleToggleStatus}
        onEdit={handleOpenEdit}
        onDelete={handleDelete}
        isToggling={isToggling}
        isDeleting={isDeleting}
      />

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
  container: { flex: 1 },
  headerDescription: {
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 8,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: -28,
    marginBottom: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  summaryCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCardContent: { flex: 1 },
  summaryCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  summaryCardText: {
    fontSize: 13,
    lineHeight: 18,
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
  sheetCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  sheetCancelText: { fontSize: 15, fontWeight: '600' },
  sheetConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  sheetConfirmText: { fontSize: 15, fontWeight: '600' },
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
  prioridadeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  prioridadeText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
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
});
