import React, { useState } from 'react';
import {
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { View } from '@/components/ui/view';
import { useColor } from '@/hooks/useColor';
import { storage } from '@/services/storage';
import { palette } from '@/theme/colors';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((state) => state.login);
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  
  // Usar a cor verde escura da paleta apenas no background da tela de login
  const backgroundColor = palette.darkGreen;
  const textColor = '#FFFFFF'; // Texto branco para contraste no fundo verde escuro

  // Preencher email se houver credenciais salvas
  React.useEffect(() => {
    const loadSavedEmail = async () => {
      try {
        const credentials = await storage.getCredentials();
        if (credentials.email) {
          setEmail(credentials.email);
        }
        if (credentials.senha) {
          setSenha(credentials.senha);
        }
      } catch (error) {
        console.error('Erro ao carregar email salvo:', error);
      }
    };
    loadSavedEmail();
  }, []);

  const handleLogin = async () => {
    // Durante desenvolvimento de layout, simular autenticação e ir para home
    setLoading(true);
    try {
      // Simular delay mínimo para feedback visual
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Simular autenticação no store para evitar redirecionamento
      useAuthStore.setState({
        user: {
          id: 1,
          nome: 'Usuário Demo',
          email: email || 'demo@agritech.com',
        },
        fazendaPadrao: null,
        token: 'demo-token-for-layout-development',
        isLoading: false,
        error: null,
      });
      
      // Navegar para home
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('Erro no handleLogin:', error);
      // Mesmo com erro, simular autenticação e navegar para home
      useAuthStore.setState({
        user: {
          id: 1,
          nome: 'Usuário Demo',
          email: email || 'demo@agritech.com',
        },
        fazendaPadrao: null,
        token: 'demo-token-for-layout-development',
        isLoading: false,
        error: null,
      });
      router.replace('/(tabs)');
    } finally {
      setLoading(false);
    }
  };

  // Usar logo para light mode e logo-2 para dark mode
  const logoSource = colorScheme === 'dark' 
    ? require('../../../assets/images/logo-2.png')
    : require('../../../assets/images/logo.png');

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <Image
              source={logoSource}
              style={styles.logo}
              contentFit="contain"
              transition={200}
            />
            <Text variant="body" style={{ color: textColor, marginTop: 16, fontWeight: '600' }}>
              <Text style={{ color: palette.gold, fontWeight: '600' }}>FOX</Text>
              <Text style={{ color: textColor, fontWeight: '600' }}>AGRITECH</Text>
            </Text>
          </View>

          <View style={styles.form}>
            <Input
              placeholder="E-mail"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              variant="outline"
              inputStyle={{ paddingLeft: 0 }}
              containerStyle={{ borderRadius: 10 }}
            />

            <Input
              placeholder="Senha"
              value={senha}
              onChangeText={setSenha}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              variant="outline"
              inputStyle={{ paddingLeft: 0 }}
              containerStyle={{ borderRadius: 10 }}
            />

            <Button
              onPress={handleLogin}
              disabled={loading}
              loading={loading}
              variant="secondary"
              style={[styles.loginButton, { borderRadius: 10 }]}
            >
              Entrar
            </Button>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    width: 200,
    height: 80,
  },
  form: {
    gap: 20,
  },
  loginButton: {
    marginTop: 8,
  },
});
