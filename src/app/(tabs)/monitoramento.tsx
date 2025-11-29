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
  Bug, 
  Search, 
  Plus,
  MapPin,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Edit,
  Trash2,
  TrendingUp
} from 'lucide-react-native';

export default function MonitoramentoScreen() {
  const backgroundColor = useColor({}, 'background');
  const textColor = useColor({}, 'text');
  const mutedColor = useColor({}, 'textMuted');
  const borderColor = useColor({}, 'border');
  const primaryColor = useColor({}, 'primary');
  const [searchQuery, setSearchQuery] = useState('');

  // Mock data - será substituído quando store estiver implementado
  const scouts: any[] = [
    { id: 's1', talhao: 'Talhão 1', visitado: true, pragasCount: 5, dataVisita: '2024-03-10', dataCriacao: '2024-03-08' },
    { id: 's2', talhao: 'Talhão 2', visitado: false, pragasCount: 0, dataVisita: null, dataCriacao: '2024-03-09' },
    { id: 's3', talhao: 'Talhão 1', visitado: true, pragasCount: 2, dataVisita: '2024-03-12', dataCriacao: '2024-03-11' },
  ];

  const filteredScouts = scouts.filter((scout) => {
    return scout.talhao.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="heading" style={{ color: textColor }}>
          Monitoramento
        </Text>
        <Button
          variant="default"
          size="sm"
          onPress={() => {
            // TODO: Navegar para tela de criar scout
          }}
        >
          <Icon name={Plus} size={16} color={useColor({}, 'primaryForeground')} />
          <Text style={{ color: useColor({}, 'primaryForeground'), marginLeft: 6 }}>
            Novo
          </Text>
        </Button>
      </View>

      {/* Busca */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Icon name={Search} size={20} color={mutedColor} />
          <Input
            variant="default"
            placeholder="Buscar por talhão..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            inputStyle={styles.searchInput}
            containerStyle={{ flex: 1, marginLeft: 8 }}
          />
        </View>
      </View>

      {/* Lista de Scouts */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredScouts.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Icon name={Bug} size={48} color={mutedColor} />
            <Text variant="body" style={{ color: mutedColor, marginTop: 16, textAlign: 'center' }}>
              {searchQuery 
                ? 'Nenhum monitoramento encontrado' 
                : 'Nenhum monitoramento registrado'}
            </Text>
            {!searchQuery && (
              <Button
                variant="default"
                style={{ marginTop: 16 }}
                onPress={() => {
                  // TODO: Navegar para tela de criar scout
                }}
              >
                <Icon name={Plus} size={16} color={useColor({}, 'primaryForeground')} />
                <Text style={{ color: useColor({}, 'primaryForeground'), marginLeft: 6 }}>
                  Criar primeiro monitoramento
                </Text>
              </Button>
            )}
          </Card>
        ) : (
          filteredScouts.map((scout) => (
            <Card key={scout.id} style={styles.scoutCard}>
              <View style={styles.scoutHeader}>
                <View style={styles.scoutLocation}>
                  <Icon name={MapPin} size={18} color={palette.darkGreen} />
                  <Text variant="title" style={{ color: textColor, marginLeft: 8, flex: 1 }}>
                    {scout.talhao || 'Sem talhão'}
                  </Text>
                </View>
                <Badge variant={scout.visitado ? 'success' : 'outline'}>
                  {scout.visitado ? 'Visitado' : 'Pendente'}
                </Badge>
              </View>

              {scout.pragasCount > 0 && (
                <View style={styles.scoutPragas}>
                  <Icon name={AlertTriangle} size={16} color={palette.gold} />
                  <Text variant="body" style={{ color: textColor, marginLeft: 6, fontWeight: '600' }}>
                    {scout.pragasCount} {scout.pragasCount === 1 ? 'praga' : 'pragas'} detectada{scout.pragasCount > 1 ? 's' : ''}
                  </Text>
                </View>
              )}

              <View style={styles.scoutInfo}>
                <View style={styles.scoutInfoItem}>
                  <Icon name={Calendar} size={14} color={mutedColor} />
                  <Text variant="caption" style={{ color: mutedColor, marginLeft: 4 }}>
                    Criado: {scout.dataCriacao ? new Date(scout.dataCriacao).toLocaleDateString('pt-BR') : 'Não definida'}
                  </Text>
                </View>
                {scout.visitado && scout.dataVisita && (
                  <View style={styles.scoutInfoItem}>
                    <Icon name={CheckCircle2} size={14} color={mutedColor} />
                    <Text variant="caption" style={{ color: mutedColor, marginLeft: 4 }}>
                      Visitado: {new Date(scout.dataVisita).toLocaleDateString('pt-BR')}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.scoutActions}>
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => {
                    // TODO: Navegar para tela de editar scout
                  }}
                >
                  <Icon name={Edit} size={14} color={textColor} />
                  <Text style={{ color: textColor, marginLeft: 4, fontSize: 12 }}>
                    Editar
                  </Text>
                </Button>
                {!scout.visitado && (
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={() => {
                      // TODO: Excluir scout (apenas se estiver em cache local)
                    }}
                  >
                    <Icon name={Trash2} size={14} color={palette.brown} />
                    <Text style={{ color: palette.brown, marginLeft: 4, fontSize: 12 }}>
                      Excluir
                    </Text>
                  </Button>
                )}
                {scout.pragasCount > 0 && (
                  <Button
                    variant="default"
                    size="sm"
                    onPress={() => {
                      // TODO: Ver detalhes das pragas
                    }}
                  >
                    <Icon name={TrendingUp} size={14} color={useColor({}, 'primaryForeground')} />
                    <Text style={{ color: useColor({}, 'primaryForeground'), marginLeft: 4, fontSize: 12 }}>
                      Detalhes
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
  },
  searchInput: {
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
  scoutCard: {
    marginBottom: 12,
  },
  scoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  scoutLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  scoutPragas: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    padding: 8,
    backgroundColor: palette.gold + '15',
    borderRadius: 8,
  },
  scoutInfo: {
    marginBottom: 12,
    gap: 6,
  },
  scoutInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoutActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
});
