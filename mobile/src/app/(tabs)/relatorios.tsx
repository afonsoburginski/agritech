import { useState } from 'react';
import { StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { useColor } from '@/hooks/useColor';
import { useAuthFazendaPadrao } from '@/stores/auth-store';
import { Icon } from '@/components/ui/icon';
import { palette } from '@/theme/colors';
import {
  FileText,
  Bug,
  Download,
  Share2,
  Eye,
  ChevronRight,
  Leaf,
  BarChart3,
} from 'lucide-react-native';
import {
  generateTechnicalReport,
  generatePestDiseaseReport,
  previewReport,
  shareReport,
  type ReportType,
} from '@/services/report-service';
import { logger } from '@/services/logger';

interface GeneratedReport {
  uri: string;
  type: ReportType;
  generatedAt: string;
}

export default function RelatoriosScreen() {
  const backgroundColor = useColor({}, 'background');
  const cardColor = useColor({}, 'card');
  const textColor = useColor({}, 'text');
  const mutedColor = useColor({}, 'textMuted');
  const primaryColor = useColor({}, 'primary');
  const borderColor = useColor({}, 'border');

  const fazenda = useAuthFazendaPadrao();
  const [isGenerating, setIsGenerating] = useState<ReportType | null>(null);
  const [reports, setReports] = useState<GeneratedReport[]>([]);

  const handleGenerate = async (type: ReportType) => {
    if (!fazenda?.id) {
      Alert.alert('Erro', 'Nenhuma fazenda selecionada. Configure sua fazenda primeiro.');
      return;
    }

    try {
      setIsGenerating(type);

      const result = type === 'technical'
        ? await generateTechnicalReport(Number(fazenda.id), 'Responsável Técnico')
        : await generatePestDiseaseReport(Number(fazenda.id), 'Responsável Técnico');

      setReports(prev => [{
        ...result,
        generatedAt: new Date().toLocaleString('pt-BR'),
      }, ...prev]);

      Alert.alert(
        'Relatório Gerado',
        'O que deseja fazer?',
        [
          { text: 'Visualizar', onPress: () => previewReport(result.uri) },
          { text: 'Compartilhar', onPress: () => shareReport(result.uri).catch(() => Alert.alert('Erro', 'Não foi possível compartilhar')) },
          { text: 'OK', style: 'cancel' },
        ]
      );
    } catch (error: any) {
      logger.error('Erro ao gerar relatório', { error: error.message, type });
      Alert.alert('Erro', `Erro ao gerar relatório: ${error.message}`);
    } finally {
      setIsGenerating(null);
    }
  };

  const handlePreview = async (uri: string) => {
    try {
      await previewReport(uri);
    } catch (error: any) {
      Alert.alert('Erro', 'Não foi possível visualizar o relatório');
    }
  };

  const handleShare = async (uri: string) => {
    try {
      await shareReport(uri);
    } catch (error: any) {
      Alert.alert('Erro', error.message);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor }]} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: textColor }]}>Relatórios</Text>
        <Text style={[styles.headerSubtitle, { color: mutedColor }]}>
          Gere relatórios técnicos em PDF
        </Text>
      </View>

      {/* Report Types */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>Gerar Novo Relatório</Text>

        {/* Technical Report Card */}
        <TouchableOpacity
          style={[styles.reportCard, { backgroundColor: cardColor, borderColor: borderColor }]}
          onPress={() => handleGenerate('technical')}
          activeOpacity={0.7}
          disabled={isGenerating !== null}
        >
          <View style={[styles.reportIconBg, { backgroundColor: '#166534' + '15' }]}>
            <Icon name={FileText} size={28} color="#166534" />
          </View>
          <View style={styles.reportCardContent}>
            <Text style={[styles.reportCardTitle, { color: textColor }]}>
              Relatório Técnico
            </Text>
            <Text style={[styles.reportCardDesc, { color: mutedColor }]}>
              Monitoramento manual com inspeções visuais, mapa de distribuição e recomendações AGROFIT
            </Text>
            <View style={styles.reportCardTags}>
              <View style={[styles.tag, { backgroundColor: '#166534' + '15' }]}>
                <Icon name={Leaf} size={10} color="#166534" />
                <Text style={[styles.tagText, { color: '#166534' }]}>Embrapa</Text>
              </View>
              <View style={[styles.tag, { backgroundColor: palette.gold + '20' }]}>
                <Icon name={BarChart3} size={10} color={palette.gold} />
                <Text style={[styles.tagText, { color: palette.gold }]}>Comparativo</Text>
              </View>
            </View>
          </View>
          {isGenerating === 'technical' ? (
            <ActivityIndicator size="small" color={primaryColor} />
          ) : (
            <Icon name={ChevronRight} size={20} color={mutedColor} />
          )}
        </TouchableOpacity>

        {/* Pest & Disease Report Card */}
        <TouchableOpacity
          style={[styles.reportCard, { backgroundColor: cardColor, borderColor: borderColor }]}
          onPress={() => handleGenerate('pest-disease')}
          activeOpacity={0.7}
          disabled={isGenerating !== null}
        >
          <View style={[styles.reportIconBg, { backgroundColor: '#9333ea' + '15' }]}>
            <Icon name={Bug} size={28} color="#9333ea" />
          </View>
          <View style={styles.reportCardContent}>
            <Text style={[styles.reportCardTitle, { color: textColor }]}>
              Pragas e Doenças
            </Text>
            <Text style={[styles.reportCardDesc, { color: mutedColor }]}>
              Monitoramento automatizado com sensores e IA, mapa de calor e produtos recomendados
            </Text>
            <View style={styles.reportCardTags}>
              <View style={[styles.tag, { backgroundColor: '#9333ea' + '15' }]}>
                <Icon name={Bug} size={10} color="#9333ea" />
                <Text style={[styles.tagText, { color: '#9333ea' }]}>Sensores + IA</Text>
              </View>
              <View style={[styles.tag, { backgroundColor: '#dc2626' + '15' }]}>
                <Text style={[styles.tagText, { color: '#dc2626' }]}>Mapa de calor</Text>
              </View>
            </View>
          </View>
          {isGenerating === 'pest-disease' ? (
            <ActivityIndicator size="small" color={primaryColor} />
          ) : (
            <Icon name={ChevronRight} size={20} color={mutedColor} />
          )}
        </TouchableOpacity>
      </View>

      {/* Generated Reports History */}
      {reports.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Relatórios Gerados</Text>
          {reports.map((report, index) => (
            <View
              key={index}
              style={[styles.historyCard, { backgroundColor: cardColor, borderColor: borderColor }]}
            >
              <View style={styles.historyHeader}>
                <Icon
                  name={report.type === 'technical' ? FileText : Bug}
                  size={18}
                  color={report.type === 'technical' ? '#166534' : '#9333ea'}
                />
                <View style={styles.historyInfo}>
                  <Text style={[styles.historyTitle, { color: textColor }]}>
                    {report.type === 'technical' ? 'Relatório Técnico' : 'Pragas e Doenças'}
                  </Text>
                  <Text style={[styles.historyDate, { color: mutedColor }]}>
                    {report.generatedAt}
                  </Text>
                </View>
              </View>
              <View style={styles.historyActions}>
                <TouchableOpacity
                  style={[styles.historyButton, { backgroundColor: primaryColor + '15' }]}
                  onPress={() => handlePreview(report.uri)}
                >
                  <Icon name={Eye} size={16} color={primaryColor} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.historyButton, { backgroundColor: '#10B981' + '15' }]}
                  onPress={() => handleShare(report.uri)}
                >
                  <Icon name={Share2} size={16} color="#10B981" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Info Section */}
      <View style={[styles.infoBox, { backgroundColor: cardColor, borderColor: borderColor }]}>
        <Icon name={Download} size={18} color={mutedColor} />
        <Text style={[styles.infoText, { color: mutedColor }]}>
          Os relatórios são gerados em PDF com dados reais do monitoramento e referência cruzada com a base Embrapa AGROFIT.
        </Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  reportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    gap: 14,
  },
  reportIconBg: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportCardContent: {
    flex: 1,
    gap: 4,
  },
  reportCardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  reportCardDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  reportCardTags: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '600',
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  historyInfo: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  historyDate: {
    fontSize: 11,
    marginTop: 2,
  },
  historyActions: {
    flexDirection: 'row',
    gap: 8,
  },
  historyButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
});
