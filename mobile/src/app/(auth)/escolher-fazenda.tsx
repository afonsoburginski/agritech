/**
 * Tela de seleção de fazenda (estilo passo de wizard/onboarding).
 * Mesmo nível que login: autentica → escolher fazenda (se >1) → home (tabs).
 * Sem bottom tabs.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { useColor } from '@/hooks/useColor';
import { Building2, Check, ChevronRight } from 'lucide-react-native';
import { useAuthStore, useAuthFazendaPadrao, usePendingFazendaChoice } from '@/stores/auth-store';

export default function EscolherFazendaScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const backgroundColor = useColor({}, 'background');
  const cardColor = useColor({}, 'card');
  const textColor = useColor({}, 'text');
  const mutedColor = useColor({}, 'textMuted');
  const borderColor = useColor({}, 'border');
  const primaryColor = useColor({}, 'primary');

  const loadFazendas = useAuthStore((s) => s.loadFazendas);
  const setFazendaPadrao = useAuthStore((s) => s.setFazendaPadrao);
  const clearPendingFazendaChoice = useAuthStore((s) => s.clearPendingFazendaChoice);
  const fazendaAtual = useAuthFazendaPadrao();
  const pendingChoice = usePendingFazendaChoice();

  const [fazendas, setFazendas] = useState<{ id: number; nome: string; role?: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    loadFazendas().then((list) => {
      if (mounted) {
        setFazendas(list);
        setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, [loadFazendas]);

  const handleSelect = (fazenda: { id: number; nome: string; role?: string }) => {
    setFazendaPadrao(fazenda);
    clearPendingFazendaChoice();
    router.replace('/(tabs)');
  };

  // Se não está mais pendente (ex.: só tem uma fazenda), redireciona para tabs em efeito (nunca durante render)
  useEffect(() => {
    if (!pendingChoice && !loading) {
      router.replace('/(tabs)');
    }
  }, [pendingChoice, loading, router]);

  if (!pendingChoice && !loading) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor, paddingTop: insets.top + 24 }]}>
      <View style={styles.header}>
        <View style={[styles.stepBadge, { backgroundColor: primaryColor + '25' }]}>
          <Text style={[styles.stepText, { color: primaryColor }]}>Passo 1</Text>
        </View>
        <Text style={[styles.title, { color: textColor }]}>Escolha sua fazenda</Text>
        <Text style={[styles.subtitle, { color: mutedColor }]}>
          Selecione qual fazenda deseja usar no app. Você pode trocar depois pelo perfil.
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={primaryColor} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {fazendas.map((f) => {
            const isSelected = fazendaAtual?.id === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                style={[
                  styles.card,
                  { backgroundColor: cardColor, borderColor },
                  isSelected && { borderColor: primaryColor, backgroundColor: primaryColor + '18' },
                ]}
                activeOpacity={0.8}
                onPress={() => handleSelect(f)}
              >
                <View style={[styles.iconWrap, { backgroundColor: primaryColor + '25' }]}>
                  <Icon name={Building2} size={28} color={primaryColor} />
                </View>
                <Text style={[styles.cardTitle, { color: textColor }]} numberOfLines={1}>
                  {f.nome}
                </Text>
                {isSelected ? (
                  <Icon name={Check} size={22} color={primaryColor} />
                ) : (
                  <Icon name={ChevronRight} size={22} color={mutedColor} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  stepBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 12,
  },
  stepText: {
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 14,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
  },
});
