import React from 'react';
import { ScrollView, StyleSheet, View as RNView, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useColor } from '@/hooks/useColor';
import { Icon } from '@/components/ui/icon';
import { palette } from '@/theme/colors';
import { useAuthUser, useAuthFazendaPadrao, useAuthStore } from '@/stores/auth-store';
import { 
  User, 
  Settings,
  LogOut,
  Wifi,
  WifiOff,
  RefreshCw,
  Building2,
  Mail,
  Phone
} from 'lucide-react-native';

export default function PerfilScreen() {
  const backgroundColor = useColor({}, 'background');
  const textColor = useColor({}, 'text');
  const mutedColor = useColor({}, 'textMuted');
  const borderColor = useColor({}, 'border');
  const user = useAuthUser();
  const fazenda = useAuthFazendaPadrao();
  const logout = useAuthStore((state) => state.logout);
  const isOnline = true; // TODO: usar syncStore.isOnline
  const pendingSync: number = 0; // TODO: usar syncStore.pendingCount

  const handleLogout = async () => {
    await logout();
  };

  const handleSync = () => {
    // TODO: Implementar sincronização manual
    console.log('Sincronizar dados');
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Header com Avatar */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <Image
            source={require('../../../assets/images/avatar.jpg')}
            style={styles.avatar}
            contentFit="cover"
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
        </View>
        <Text variant="heading" style={{ color: textColor, marginTop: 16, textAlign: 'center' }}>
          {user?.nome || 'Usuário'}
        </Text>
        {user?.email && (
          <Text variant="body" style={{ color: mutedColor, marginTop: 4, textAlign: 'center' }}>
            {user.email}
          </Text>
        )}
      </View>

      {/* Fazenda */}
      {fazenda && (
        <Card style={styles.fazendaCard}>
          <View style={styles.fazendaHeader}>
            <Icon name={Building2} size={20} color={palette.darkGreen} />
            <Text variant="subtitle" style={{ color: textColor, marginLeft: 8 }}>
              Fazenda Atual
            </Text>
          </View>
          <Text variant="body" style={{ color: textColor, marginTop: 8 }}>
            {fazenda.nome}
          </Text>
        </Card>
      )}

      {/* Status de Sincronização */}
      <Card style={styles.syncCard}>
        <View style={styles.syncHeader}>
          <View style={styles.syncStatus}>
            <Icon 
              name={isOnline ? Wifi : WifiOff} 
              size={20} 
              color={isOnline ? palette.darkGreen : palette.brown} 
            />
            <Text variant="body" style={{ color: textColor, marginLeft: 8, fontWeight: '600' }}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
          {pendingSync > 0 && (
            <Text variant="caption" style={{ color: palette.gold }}>
              {pendingSync} pendente{pendingSync !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
        {pendingSync > 0 && (
          <Button
            variant="default"
            style={{ marginTop: 12 }}
            onPress={handleSync}
          >
            <Icon name={RefreshCw} size={16} color={useColor({}, 'primaryForeground')} />
            <Text style={{ color: useColor({}, 'primaryForeground'), marginLeft: 6 }}>
              Sincronizar Agora
            </Text>
          </Button>
        )}
      </Card>

      {/* Configurações */}
      <View style={styles.section}>
        <Text variant="subtitle" style={{ color: textColor, marginBottom: 12, paddingHorizontal: 24 }}>
          Configurações
        </Text>
        <Card style={styles.settingsCard}>
          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => {
              // TODO: Navegar para configurações
            }}
          >
            <Icon name={Settings} size={20} color={mutedColor} />
            <Text variant="body" style={{ color: textColor, marginLeft: 12, flex: 1 }}>
              Configurações
            </Text>
            <Icon name={Settings} size={16} color={mutedColor} />
          </TouchableOpacity>
        </Card>
      </View>

      {/* Logout */}
      <View style={styles.logoutSection}>
        <Button
          variant="outline"
          style={[styles.logoutButton, { borderColor: palette.brown }]}
          onPress={handleLogout}
        >
          <Icon name={LogOut} size={18} color={palette.brown} />
          <Text style={{ color: palette.brown, marginLeft: 8, fontWeight: '600' }}>
            Sair
          </Text>
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: palette.darkGreen + '20',
  },
  statusDot: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
  },
  offlineBar: {
    width: 10,
    height: 2,
    borderRadius: 1,
  },
  fazendaCard: {
    marginHorizontal: 24,
    marginBottom: 16,
  },
  fazendaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncCard: {
    marginHorizontal: 24,
    marginBottom: 24,
  },
  syncHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  syncStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  section: {
    marginBottom: 24,
  },
  settingsCard: {
    marginHorizontal: 24,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  logoutSection: {
    paddingHorizontal: 24,
    marginTop: 8,
  },
  logoutButton: {
    borderWidth: 1,
  },
});
