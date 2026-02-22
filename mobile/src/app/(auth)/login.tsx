import * as React from 'react';
import { useState } from 'react';
import {
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { Image } from 'react-native';
import { useAuthStore } from '@/stores/auth-store';
import { Text } from '@/components/ui/text';
import { View } from '@/components/ui/view';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { palette } from '@/theme/colors';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const signIn = useAuthStore((state) => state.signIn);
  const router = useRouter();

  const backgroundColor = palette.darkGreen;

  const handleLogin = async () => {
    if (!email.trim()) {
      Alert.alert('Erro', 'Informe seu e-mail');
      return;
    }
    if (!senha.trim()) {
      Alert.alert('Erro', 'Informe sua senha');
      return;
    }

    setLoading(true);
    try {
      await signIn(email.trim(), senha);
      // Redirecionamento explícito após login (garante funcionar no Android/Expo Go)
      const pendingChoice = useAuthStore.getState().pendingFazendaChoice;
      if (pendingChoice) {
        router.replace('/(auth)/escolher-fazenda');
      } else {
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      Alert.alert('Erro no Login', error.message || 'Não foi possível fazer login');
    } finally {
      setLoading(false);
    }
  };

  const logoSource = require('../../../assets/images/logo.png');

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
              resizeMode="contain"
            />
            <Text variant="body" style={{ color: '#FFFFFF', marginTop: 16, fontWeight: '600' }}>
              <Text style={{ color: palette.gold, fontWeight: '600' }}>FOX</Text>
              <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>FIELDCORE</Text>
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
              style={[styles.loginButton, { borderRadius: 10, backgroundColor: '#FFFFFF' }]}
              textStyle={{ color: '#1F2937' }}
            >
              Entrar
            </Button>

            <View style={styles.linksContainer}>
              <Link href="/(auth)/forgot-password" asChild>
                <TouchableOpacity>
                  <Text style={styles.linkText}>Esqueci minha senha</Text>
                </TouchableOpacity>
              </Link>

              <Link href="/(auth)/signup" asChild>
                <TouchableOpacity>
                  <Text style={styles.linkText}>
                    Não tem conta? <Text style={styles.linkBold}>Cadastre-se</Text>
                  </Text>
                </TouchableOpacity>
              </Link>
            </View>
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
  linksContainer: {
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  linkText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
  linkBold: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
