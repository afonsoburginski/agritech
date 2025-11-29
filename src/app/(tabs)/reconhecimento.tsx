import React, { useState } from 'react';
import { ScrollView, StyleSheet, View as RNView, TouchableOpacity } from 'react-native';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useColor } from '@/hooks/useColor';
import { Icon } from '@/components/ui/icon';
import { palette } from '@/theme/colors';
import { 
  Camera, 
  Image as ImageIcon,
  Calendar,
  CheckCircle2,
  AlertCircle,
  X
} from 'lucide-react-native';

export default function ReconhecimentoScreen() {
  const backgroundColor = useColor({}, 'background');
  const textColor = useColor({}, 'text');
  const mutedColor = useColor({}, 'textMuted');
  const primaryColor = useColor({}, 'primary');

  // Mock data - será substituído quando store estiver implementado
  const reconhecimentos: any[] = [
    { id: 'r1', praga: 'Lagarta-do-cartucho', confianca: 0.95, data: '2024-03-10', imagem: null },
    { id: 'r2', praga: 'Pulgão', confianca: 0.87, data: '2024-03-12', imagem: null },
  ];

  const handleTakePhoto = () => {
    // TODO: Implementar abertura da câmera para reconhecimento
    console.log('Abrir câmera para reconhecimento');
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="heading" style={{ color: textColor }}>
          Reconhecimento de Praga
        </Text>
      </View>

      {/* Área de Câmera */}
      <Card style={styles.cameraCard}>
        <View style={[styles.cameraIconContainer, { backgroundColor: primaryColor + '20' }]}>
          <Icon name={Camera} size={64} color={primaryColor} />
        </View>
        <Text variant="title" style={{ color: textColor, marginTop: 24, textAlign: 'center' }}>
          Identificar Praga
        </Text>
        <Text variant="body" style={{ color: mutedColor, marginTop: 8, textAlign: 'center', paddingHorizontal: 24 }}>
          Tire uma foto da praga para identificação automática usando inteligência artificial
        </Text>
        <Button
          variant="default"
          style={{ marginTop: 24 }}
          onPress={handleTakePhoto}
        >
          <Icon name={Camera} size={20} color={useColor({}, 'primaryForeground')} />
          <Text style={{ color: useColor({}, 'primaryForeground'), marginLeft: 8, fontWeight: '600' }}>
            Tirar Foto
          </Text>
        </Button>
      </Card>

      {/* Histórico */}
      <View style={styles.historySection}>
        <Text variant="subtitle" style={{ color: textColor, marginBottom: 16, paddingHorizontal: 24 }}>
          Histórico de Reconhecimentos
        </Text>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {reconhecimentos.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Icon name={Camera} size={48} color={mutedColor} />
              <Text variant="body" style={{ color: mutedColor, marginTop: 16, textAlign: 'center' }}>
                Nenhum reconhecimento realizado
              </Text>
              <Text variant="caption" style={{ color: mutedColor, marginTop: 8, textAlign: 'center' }}>
                Tire uma foto para começar
              </Text>
            </Card>
          ) : (
            reconhecimentos.map((reconhecimento) => (
              <Card key={reconhecimento.id} style={styles.reconhecimentoCard}>
                <View style={styles.reconhecimentoHeader}>
                  <View style={styles.reconhecimentoInfo}>
                    <Text variant="title" style={{ color: textColor }}>
                      {reconhecimento.praga}
                    </Text>
                    <View style={styles.confiancaContainer}>
                      <Badge variant="secondary">
                        <Text style={{ fontSize: 12, fontWeight: '600' }}>
                          {Math.round(reconhecimento.confianca * 100)}% confiança
                        </Text>
                      </Badge>
                    </View>
                  </View>
                  {reconhecimento.confianca >= 0.9 ? (
                    <Icon name={CheckCircle2} size={24} color={palette.darkGreen} />
                  ) : (
                    <Icon name={AlertCircle} size={24} color={palette.gold} />
                  )}
                </View>

                {reconhecimento.imagem && (
                  <View style={styles.imageContainer}>
                    <Icon name={ImageIcon} size={32} color={mutedColor} />
                    <Text variant="caption" style={{ color: mutedColor, marginTop: 8 }}>
                      Imagem capturada
                    </Text>
                  </View>
                )}

                <View style={styles.reconhecimentoFooter}>
                  <View style={styles.reconhecimentoDate}>
                    <Icon name={Calendar} size={14} color={mutedColor} />
                    <Text variant="caption" style={{ color: mutedColor, marginLeft: 4 }}>
                      {reconhecimento.data ? new Date(reconhecimento.data).toLocaleDateString('pt-BR') : 'Data não disponível'}
                    </Text>
                  </View>
                  <Button
                    variant="outline"
                    size="sm"
                    onPress={() => {
                      // TODO: Ver detalhes do reconhecimento
                    }}
                  >
                    <Text style={{ fontSize: 12 }}>Ver Detalhes</Text>
                  </Button>
                </View>
              </Card>
            ))
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  cameraCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginHorizontal: 24,
    marginBottom: 24,
    minHeight: 280,
  },
  cameraIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historySection: {
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
    minHeight: 200,
  },
  reconhecimentoCard: {
    marginBottom: 12,
  },
  reconhecimentoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  reconhecimentoInfo: {
    flex: 1,
  },
  confiancaContainer: {
    marginTop: 8,
  },
  imageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: palette.darkGreen + '10',
    borderRadius: 8,
    marginBottom: 12,
  },
  reconhecimentoFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  reconhecimentoDate: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

