import { ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Image } from 'react-native';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useColor } from '@/hooks/useColor';
import { Icon } from '@/components/ui/icon';
import { palette } from '@/theme/colors';
import { useAuthUser, useAuthFazendaPadrao, useAuthStore } from '@/stores/auth-store';
import { useAppStore, useAvatarUri } from '@/stores/app-store';
import { useCamera } from '@/hooks/use-camera';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Switch } from '@/components/ui/switch';
import { Appearance } from 'react-native';
import { useSync } from '@/hooks/use-sync';
import { 
  User, 
  Settings,
  LogOut,
  Wifi,
  WifiOff,
  RefreshCw,
  Building2,
  Mail,
  Phone,
  ChevronRight,
  Camera,
  Image as ImageIcon,
  Moon,
  Sun
} from 'lucide-react-native';

export default function PerfilScreen() {
  const backgroundColor = useColor({}, 'background');
  const cardColor = useColor({}, 'card');
  const textColor = useColor({}, 'text');
  const mutedColor = useColor({}, 'textMuted');
  const borderColor = useColor({}, 'border');
  const primaryColor = useColor({}, 'primary');
  const user = useAuthUser();
  const fazenda = useAuthFazendaPadrao();
  const logout = useAuthStore((state) => state.logout);
  const avatarUri = useAvatarUri();
  const setAvatar = useAppStore((state) => state.setAvatar);
  const { takePhoto, pickFromGallery } = useCamera();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { isOnline, isSyncing, pendingCount, forceSync, getLastSyncText } = useSync();

  const handleToggleTheme = (value: boolean) => {
    Appearance.setColorScheme(value ? 'dark' : 'light');
  };

  const handleLogout = async () => {
    Alert.alert(
      'Confirmar Saída',
      'Tem certeza que deseja sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  const handleSync = async () => {
    const success = await forceSync();
    if (success) {
      Alert.alert('Sucesso', 'Sincronização concluída!');
    } else if (!isOnline) {
      Alert.alert('Offline', 'Conecte-se à internet para sincronizar.');
    }
  };

  const handleChangeAvatar = () => {
    Alert.alert(
      'Alterar Foto de Perfil',
      'Escolha uma opção',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Câmera',
          onPress: async () => {
            try {
              const photo = await takePhoto();
              if (photo?.uri) {
                await setAvatar(photo.uri);
              }
            } catch (error: any) {
              Alert.alert('Erro', error.message || 'Erro ao capturar foto');
            }
          },
        },
        {
          text: 'Galeria',
          onPress: async () => {
            try {
              const image = await pickFromGallery();
              if (image?.uri) {
                await setAvatar(image.uri);
              }
            } catch (error: any) {
              Alert.alert('Erro', error.message || 'Erro ao selecionar imagem');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.headerTitle, { color: textColor }]}>Perfil</Text>
          </View>
          <TouchableOpacity 
            onPress={handleChangeAvatar}
            activeOpacity={0.7}
            style={styles.avatarContainer}
          >
            <Image
              source={avatarUri ? { uri: avatarUri } : require('../../../assets/images/avatar.jpg')}
              style={styles.avatar}
              resizeMode="cover"
            />
            <View style={[
              styles.statusDot,
              {
                backgroundColor: isOnline ? '#10B981' : '#9CA3AF',
                borderColor: backgroundColor,
              }
            ]}>
              {!isOnline && (
                <View style={[styles.offlineBar, { backgroundColor: backgroundColor }]} />
              )}
            </View>
            <View style={[styles.editBadge, { backgroundColor: palette.gold, borderColor: backgroundColor }]}>
              <Icon name={Camera} size={12} color="#000000" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Informações do Usuário */}
        <View style={styles.section}>
          <Card style={{ ...styles.infoCard, backgroundColor: cardColor }}>
            <View style={styles.infoRow}>
              <View style={[styles.iconContainer, { backgroundColor: palette.gold + '20' }]}>
                <Icon name={User} size={20} color={palette.gold} />
              </View>
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: mutedColor }]}>Nome</Text>
                <Text style={[styles.infoValue, { color: textColor }]}>
                  {user?.nome || 'Não informado'}
                </Text>
              </View>
            </View>

            {user?.email && (
              <View style={[styles.infoRow, styles.infoRowSeparator, { borderColor: borderColor }]}>
                <View style={[styles.iconContainer, { backgroundColor: palette.gold + '20' }]}>
                  <Icon name={Mail} size={20} color={palette.gold} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: mutedColor }]}>Email</Text>
                  <Text style={[styles.infoValue, { color: textColor }]}>
                    {user.email}
                  </Text>
                </View>
              </View>
            )}

            {fazenda && (
              <View style={[styles.infoRow, styles.infoRowSeparator, { borderColor: borderColor }]}>
                <View style={[styles.iconContainer, { backgroundColor: palette.gold + '20' }]}>
                  <Icon name={Building2} size={20} color={palette.gold} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: mutedColor }]}>Fazenda</Text>
                  <Text style={[styles.infoValue, { color: textColor }]}>
                    {fazenda.nome}
                  </Text>
                </View>
              </View>
            )}
          </Card>
        </View>

        {/* Status de Sincronização */}
        <View style={styles.section}>
          <Card style={{ ...styles.syncCard, backgroundColor: cardColor }}>
            <View style={styles.syncHeader}>
              <View style={styles.syncStatus}>
                <Icon 
                  name={isOnline ? Wifi : WifiOff} 
                  size={20} 
                  color={isOnline ? '#10B981' : '#9CA3AF'} 
                />
                <Text style={[styles.syncStatusText, { color: textColor }]}>
                  {isOnline ? 'Online' : 'Offline'}
                </Text>
              </View>
              {pendingCount > 0 && (
                <View style={[styles.badge, { backgroundColor: palette.gold + '20' }]}>
                  <Text style={[styles.badgeText, { color: palette.gold }]}>
                    {pendingCount} pendente{pendingCount !== 1 ? 's' : ''}
                  </Text>
                </View>
              )}
            </View>
            {pendingCount > 0 && (
              <Button
                variant="default"
                style={[styles.syncButton, { backgroundColor: palette.gold }]}
                onPress={handleSync}
              >
                <Icon name={RefreshCw} size={16} color="#000000" />
                <Text style={{ color: '#000000', marginLeft: 6, fontWeight: '600' }}>
                  Sincronizar Agora
                </Text>
              </Button>
            )}
          </Card>
        </View>

        {/* Configurações */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            Configurações
          </Text>
          <Card style={{ ...styles.settingsCard, backgroundColor: cardColor }}>
            {/* Tema */}
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: palette.gold + '20' }]}>
                  <Icon name={isDark ? Moon : Sun} size={18} color={palette.gold} />
                </View>
                <View style={styles.settingContent}>
                  <Text style={[styles.settingText, { color: textColor }]}>
                    Modo Escuro
                  </Text>
                  <Text style={[styles.settingDescription, { color: mutedColor }]}>
                    {isDark ? 'Tema escuro ativado' : 'Tema claro ativado'}
                  </Text>
                </View>
              </View>
              <Switch
                value={isDark}
                onValueChange={handleToggleTheme}
              />
            </View>
          </Card>
        </View>

        {/* Logout */}
        <View style={styles.logoutSection}>
          <Button
            variant="outline"
            style={[styles.logoutButton, { borderColor: borderColor }]}
            onPress={handleLogout}
          >
            <Icon name={LogOut} size={18} color={textColor} />
            <Text style={{ color: textColor, marginLeft: 8, fontWeight: '600' }}>
              Sair da Conta
            </Text>
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
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
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineBar: {
    width: 8,
    height: 2,
    borderRadius: 1,
  },
  editBadge: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  infoCard: {
    padding: 16,
    borderRadius: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoRowSeparator: {
    borderTopWidth: 1,
    marginTop: 4,
    paddingTop: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  syncCard: {
    padding: 16,
    borderRadius: 12,
  },
  syncHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  syncStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  syncStatusText: {
    fontSize: 15,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  syncButton: {
    marginTop: 8,
  },
  settingsCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingContent: {
    flex: 1,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingText: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 12,
  },
  logoutSection: {
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 24,
  },
  logoutButton: {
    borderWidth: 1,
  },
});
