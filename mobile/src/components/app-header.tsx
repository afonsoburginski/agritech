import React, { useCallback, useState } from 'react';
import { Dimensions, Linking, Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { AvatarWithFallback } from '@/components/avatar-with-fallback';
import { useColor } from '@/hooks/useColor';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { palette } from '@/theme/colors';
import { HelpCircle, CheckCircle2 } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

const HEADER_GREEN = palette.darkGreen;
const CONTENT_PADDING = 20;
const WHATSAPP_NUMBER = '556681358930';

const DUVIDAS_OPCOES: { label: string; message: string }[] = [
  { label: 'Tarefas e Atividades', message: 'Olá! Tenho dúvida sobre o módulo de Tarefas e Atividades do app Fox Fieldcore.' },
  { label: 'Monitoramento de pragas', message: 'Olá! Tenho dúvida sobre o Monitoramento de pragas e pontos de coleta.' },
  { label: 'Reconhecimento de pragas (Scanner)', message: 'Olá! Tenho dúvida sobre o Reconhecimento de pragas pelo Scanner/IA.' },
  { label: 'Saúde da fazenda', message: 'Olá! Tenho dúvida sobre o indicador de Saúde da fazenda e como é calculado.' },
  { label: 'Relatórios', message: 'Olá! Tenho dúvida sobre a geração de Relatórios em PDF.' },
  { label: 'Mapa de calor', message: 'Olá! Tenho dúvida sobre o Mapa de calor de pragas.' },
  { label: 'Outra dúvida', message: 'Olá! Gostaria de tirar uma dúvida sobre o app Fox Fieldcore.' },
];

export type AppHeaderProps = {
  /** Título central (ex.: nome da fazenda) */
  title: string;
  /** URI do avatar; se não informado, usa imagem padrão */
  avatarUri?: string | null;
  /** Callback ao tocar no avatar (ex.: navegar para perfil) */
  onAvatarPress?: () => void;
  /** Indica conexão online para o indicador no avatar */
  isOnline?: boolean;
  /** Exibe ícone "?" que abre o modal de dúvidas (WhatsApp). Quando true, ignora rightIcon/onRightPress. */
  showDuvidasButton?: boolean;
  /** Ícone do canto direito (usado quando showDuvidasButton é false) */
  rightIcon?: LucideIcon;
  /** Callback ao tocar no ícone direito (usado quando showDuvidasButton é false) */
  onRightPress?: () => void;
  /** Conteúdo opcional abaixo da linha do título (ex.: saúde da fazenda + botões) */
  children?: React.ReactNode;
};

export function AppHeader({
  title,
  avatarUri,
  onAvatarPress,
  isOnline = true,
  showDuvidasButton = false,
  rightIcon,
  onRightPress,
  children,
}: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const [duvidasModalVisible, setDuvidasModalVisible] = useState(false);
  const [selectedDuvida, setSelectedDuvida] = useState<typeof DUVIDAS_OPCOES[0] | null>(null);

  const cardColor = useColor({}, 'card');
  const textColor = useColor({}, 'text');
  const borderColor = useColor({}, 'border');
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const modalOptionBg = isDark ? borderColor : '#f5f5f5';
  const modalAccent = isDark ? '#fff' : HEADER_GREEN;
  const modalConfirmBtnStyle = isDark
    ? { backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' }
    : { backgroundColor: HEADER_GREEN + '20', borderWidth: 1, borderColor: HEADER_GREEN };
  const modalConfirmTextColor = isDark ? '#fff' : HEADER_GREEN;

  const openWhatsApp = useCallback((message: string) => {
    setDuvidasModalVisible(false);
    setSelectedDuvida(null);
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => {});
  }, []);

  const handleConfirmarDuvida = useCallback(() => {
    if (selectedDuvida) openWhatsApp(selectedDuvida.message);
  }, [selectedDuvida, openWhatsApp]);

  const closeDuvidasModal = useCallback(() => {
    setDuvidasModalVisible(false);
    setSelectedDuvida(null);
  }, []);

  const showRightButton = showDuvidasButton || (rightIcon != null && onRightPress != null);
  const handleRightPress = showDuvidasButton ? () => setDuvidasModalVisible(true) : onRightPress;

  return (
    <>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.contentContainer}>
          <View style={styles.headerRow}>
            <View style={styles.headerSide}>
              {onAvatarPress != null ? (
                <TouchableOpacity onPress={onAvatarPress} activeOpacity={0.7} style={styles.avatarContainer}>
                  <AvatarWithFallback avatarUri={avatarUri} size={44} />
                  <View style={[styles.statusDot, { backgroundColor: isOnline ? '#10B981' : '#9CA3AF', borderColor: HEADER_GREEN }]}>
                    {!isOnline && <View style={[styles.offlineBar, { backgroundColor: HEADER_GREEN }]} />}
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={styles.avatarContainer}>
                  <AvatarWithFallback avatarUri={avatarUri} size={44} />
                  <View style={[styles.statusDot, { backgroundColor: isOnline ? '#10B981' : '#9CA3AF', borderColor: HEADER_GREEN }]}>
                    {!isOnline && <View style={[styles.offlineBar, { backgroundColor: HEADER_GREEN }]} />}
                  </View>
                </View>
              )}
            </View>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {title}
            </Text>
            <View style={styles.headerSide}>
              {showRightButton && handleRightPress != null ? (
                <TouchableOpacity
                  activeOpacity={0.7}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  onPress={handleRightPress}
                >
                  <Icon name={showDuvidasButton ? HelpCircle : rightIcon!} size={24} color="#fff" />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {children ? <View style={styles.heroSection}>{children}</View> : null}
        </View>
      </View>

      {showDuvidasButton && (
        <Modal
          visible={duvidasModalVisible}
          transparent
          animationType="fade"
          onRequestClose={closeDuvidasModal}
        >
          <Pressable style={styles.modalBackdrop} onPress={closeDuvidasModal}>
            <Pressable
              style={[styles.modalCard, { backgroundColor: cardColor, height: Dimensions.get('window').height * 0.72 }]}
              onPress={(e) => e.stopPropagation()}
            >
              <Text style={[styles.modalTitle, { color: textColor }]}>Em qual módulo você tem dúvida?</Text>
              <ScrollView style={styles.modalList} showsVerticalScrollIndicator={true} contentContainerStyle={styles.modalListContent}>
                {DUVIDAS_OPCOES.map((op) => {
                  const isSelected = selectedDuvida?.label === op.label;
                  return (
                    <TouchableOpacity
                      key={op.label}
                      style={[
                        styles.modalOption,
                        { backgroundColor: modalOptionBg },
                        isSelected && { backgroundColor: modalAccent + '18', borderWidth: 1.5, borderColor: modalAccent },
                      ]}
                      activeOpacity={0.7}
                      onPress={() => setSelectedDuvida(op)}
                    >
                      <Icon name={HelpCircle} size={18} color={modalAccent} />
                      <Text style={[styles.modalOptionText, { color: textColor }]}>{op.label}</Text>
                      {isSelected && <Icon name={CheckCircle2} size={20} color={modalAccent} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={[
                    styles.modalConfirmBtn,
                    styles.modalConfirmBtnBadge,
                    modalConfirmBtnStyle,
                    { opacity: selectedDuvida ? 1 : 0.5 },
                  ]}
                  activeOpacity={0.7}
                  onPress={handleConfirmarDuvida}
                  disabled={!selectedDuvida}
                >
                  <Text style={[styles.modalConfirmText, { color: modalConfirmTextColor }]}>Confirmar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalCancelBtn, { borderColor: modalAccent }]}
                  activeOpacity={0.7}
                  onPress={closeDuvidasModal}
                >
                  <Text style={[styles.modalCancelText, { color: modalAccent }]}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: HEADER_GREEN,
    paddingBottom: 56,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  contentContainer: {
    paddingHorizontal: CONTENT_PADDING,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerSide: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  statusDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineBar: {
    width: 6,
    height: 2,
    borderRadius: 1,
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 340,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalList: {
    flex: 1,
    minHeight: 280,
  },
  modalListContent: {
    paddingBottom: 12,
  },
  modalFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  modalOptionText: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  modalConfirmBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalConfirmBtnBadge: {
    borderRadius: 12,
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalCancelBtn: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, fontWeight: '600' },
});
