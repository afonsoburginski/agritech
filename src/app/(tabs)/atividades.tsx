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
import { useSupabaseActivities } from '@/hooks/use-supabase-data';
import { useColor } from '@/hooks/useColor';
import { Icon } from '@/components/ui/icon';
import { palette } from '@/theme/colors';
import { useAvatarUri, useAppStore } from '@/stores/app-store';
import { 
  ClipboardList, 
  Search, 
  Plus,
  Calendar,
  CheckCircle2,
  MoreVertical,
  MapPin
} from 'lucide-react-native';

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
  const { atividades: localAtividades, create, refresh } = useAtividades();
  const { activities: supabaseActivities, isLoading, refresh: refreshSupabase } = useSupabaseActivities();
  const { isVisible, open, close } = useBottomSheet();
  
  // Usar dados do Supabase se online, senão usar dados locais
  const atividades = useMemo(() => {
    if (isOnline && supabaseActivities.length > 0) {
      return supabaseActivities.map(a => ({
        id: a.id,
        nome: a.name,
        descricao: a.description,
        tipo: a.type,
        status: a.status,
        talhaoNome: a.plotName,
        dataInicio: a.createdAt,
        createdAt: a.createdAt,
        updatedAt: a.createdAt,
        synced: true,
      }));
    }
    return localAtividades;
  }, [isOnline, supabaseActivities, localAtividades]);
  
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
  const [formTipo, setFormTipo] = useState('outros');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handlers
  const handleNova = () => {
    setFormNome('');
    setFormDescricao('');
    setFormTipo('outros');
    open();
  };

  const handleSubmit = async () => {
    if (!formNome.trim()) {
      Alert.alert('Erro', 'Nome da atividade é obrigatório');
      return;
    }

    try {
      setIsSubmitting(true);
      await create({
        nome: formNome.trim(),
        descricao: formDescricao.trim() || undefined,
        tipo: formTipo,
      });
      close();
      setFormNome('');
      setFormDescricao('');
      refresh();
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

  const tipos = [
    { value: 'monitoramento', label: 'Monitoramento' },
    { value: 'scout', label: 'Scout de Campo' },
    { value: 'amostragem', label: 'Amostragem' },
    { value: 'identificacao', label: 'Identificação de Praga' },
    { value: 'controle', label: 'Controle de Praga' },
    { value: 'avaliacao', label: 'Avaliação de Danos' },
    { value: 'relatorio', label: 'Relatório' },
    { value: 'outros', label: 'Outros' },
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
            >
              <View style={styles.taskLeft}>
                <TouchableOpacity style={styles.checkButton}>
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
                  <Text style={[styles.taskDescription, { color: mutedColor }]}>
                    {atividade.descricao}
                  </Text>
                  <View style={styles.taskMeta}>
                    <Icon name={Calendar} size={12} color={mutedColor} />
                    <Text style={[styles.taskDate, { color: mutedColor }]}>
                      {atividade.dataInicio ? new Date(atividade.dataInicio).toLocaleDateString('pt-BR') : 'Sem data'}
                    </Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity style={styles.moreButton}>
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
              autoFocus
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
              disabled={isSubmitting || !formNome.trim()}
            >
              <Text style={{ color: '#000000', fontWeight: '600' }}>
                {isSubmitting ? 'Salvando...' : 'Criar Tarefa'}
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
});
