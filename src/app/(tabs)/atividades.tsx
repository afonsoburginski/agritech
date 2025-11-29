import React, { useState } from 'react';
import { ScrollView, StyleSheet, View as RNView } from 'react-native';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useColor } from '@/hooks/useColor';
import { Icon } from '@/components/ui/icon';
import { palette } from '@/theme/colors';
import { 
  ClipboardList, 
  Search, 
  Plus,
  Filter,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Edit,
  Trash2
} from 'lucide-react-native';

export default function AtividadesScreen() {
  const backgroundColor = useColor({}, 'background');
  const textColor = useColor({}, 'text');
  const mutedColor = useColor({}, 'textMuted');
  const borderColor = useColor({}, 'border');
  const primaryColor = useColor({}, 'primary');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pendente' | 'concluida'>('all');

  // Mock data - será substituído quando store estiver implementado
  const atividades: any[] = [
    { id: '1', nome: 'Colheita de Soja', status: 'pendente', descricao: 'Talhão 1, Safra 2023/2024', dataInicio: '2024-03-10', dataFim: null },
    { id: '2', nome: 'Adubação NPK', status: 'concluida', descricao: 'Talhão 2', dataInicio: '2024-03-05', dataFim: '2024-03-06' },
    { id: '3', nome: 'Pulverização Herbicida', status: 'pendente', descricao: 'Talhão 3', dataInicio: '2024-03-12', dataFim: null },
  ];

  const filteredAtividades = atividades.filter((atividade) => {
    const matchesSearch = atividade.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         atividade.descricao?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === 'all' || atividade.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="heading" style={{ color: textColor }}>
          Atividades
        </Text>
        <Button
          variant="default"
          size="sm"
          onPress={() => {
            // TODO: Navegar para tela de criar atividade
          }}
        >
          <Icon name={Plus} size={16} color={useColor({}, 'primaryForeground')} />
          <Text style={{ color: useColor({}, 'primaryForeground'), marginLeft: 6 }}>
            Nova
          </Text>
        </Button>
      </View>

      {/* Busca e Filtros */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Icon name={Search} size={20} color={mutedColor} />
          <Input
            variant="default"
            placeholder="Buscar atividades..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            inputStyle={styles.searchInput}
            containerStyle={{ flex: 1, marginLeft: 8 }}
          />
        </View>
        <View style={styles.filterContainer}>
          <Button
            variant={filterStatus === 'all' ? 'default' : 'outline'}
            size="sm"
            onPress={() => setFilterStatus('all')}
            style={styles.filterButton}
          >
            <Text style={{ fontSize: 12 }}>Todas</Text>
          </Button>
          <Button
            variant={filterStatus === 'pendente' ? 'default' : 'outline'}
            size="sm"
            onPress={() => setFilterStatus('pendente')}
            style={styles.filterButton}
          >
            <Text style={{ fontSize: 12 }}>Pendentes</Text>
          </Button>
          <Button
            variant={filterStatus === 'concluida' ? 'default' : 'outline'}
            size="sm"
            onPress={() => setFilterStatus('concluida')}
            style={styles.filterButton}
          >
            <Text style={{ fontSize: 12 }}>Concluídas</Text>
          </Button>
        </View>
      </View>

      {/* Lista de Atividades */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredAtividades.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Icon name={ClipboardList} size={48} color={mutedColor} />
            <Text variant="body" style={{ color: mutedColor, marginTop: 16, textAlign: 'center' }}>
              {searchQuery || filterStatus !== 'all' 
                ? 'Nenhuma atividade encontrada' 
                : 'Nenhuma atividade registrada'}
            </Text>
            {!searchQuery && filterStatus === 'all' && (
              <Button
                variant="default"
                style={{ marginTop: 16 }}
                onPress={() => {
                  // TODO: Navegar para tela de criar atividade
                }}
              >
                <Icon name={Plus} size={16} color={useColor({}, 'primaryForeground')} />
                <Text style={{ color: useColor({}, 'primaryForeground'), marginLeft: 6 }}>
                  Criar primeira atividade
                </Text>
              </Button>
            )}
          </Card>
        ) : (
          filteredAtividades.map((atividade) => (
            <Card key={atividade.id} style={styles.activityCard}>
              <View style={styles.activityHeader}>
                <View style={{ flex: 1 }}>
                  <Text variant="title" style={{ color: textColor }}>
                    {atividade.nome}
                  </Text>
                  {atividade.descricao && (
                    <Text variant="caption" style={{ color: mutedColor, marginTop: 4 }}>
                      {atividade.descricao}
                    </Text>
                  )}
                </View>
                <Badge variant={atividade.status === 'concluida' ? 'success' : 'outline'}>
                  {atividade.status === 'concluida' ? 'Concluída' : 'Pendente'}
                </Badge>
              </View>

              <View style={styles.activityInfo}>
                <View style={styles.activityInfoItem}>
                  <Icon name={Calendar} size={14} color={mutedColor} />
                  <Text variant="caption" style={{ color: mutedColor, marginLeft: 4 }}>
                    Início: {atividade.dataInicio ? new Date(atividade.dataInicio).toLocaleDateString('pt-BR') : 'Não definida'}
                  </Text>
                </View>
                {atividade.dataFim && (
                  <View style={styles.activityInfoItem}>
                    <Icon name={CheckCircle2} size={14} color={mutedColor} />
                    <Text variant="caption" style={{ color: mutedColor, marginLeft: 4 }}>
                      Fim: {new Date(atividade.dataFim).toLocaleDateString('pt-BR')}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.activityActions}>
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => {
                    // TODO: Navegar para tela de editar atividade
                  }}
                >
                  <Icon name={Edit} size={14} color={textColor} />
                  <Text style={{ color: textColor, marginLeft: 4, fontSize: 12 }}>
                    Editar
                  </Text>
                </Button>
                {atividade.status === 'pendente' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={() => {
                      // TODO: Excluir atividade (apenas se estiver em cache local)
                    }}
                  >
                    <Icon name={Trash2} size={14} color={palette.brown} />
                    <Text style={{ color: palette.brown, marginLeft: 4, fontSize: 12 }}>
                      Excluir
                    </Text>
                  </Button>
                )}
              </View>
            </Card>
          ))
        )}
      </ScrollView>
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
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  searchContainer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
    minHeight: 300,
  },
  activityCard: {
    marginBottom: 12,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  activityInfo: {
    marginBottom: 12,
    gap: 6,
  },
  activityInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
});
