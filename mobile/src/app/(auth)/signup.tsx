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
import { useAuthStore } from '@/stores/auth-store';
import { Text } from '@/components/ui/text';
import { View } from '@/components/ui/view';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { palette } from '@/theme/colors';
import { ArrowLeft } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';

export default function SignUpScreen() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const signUp = useAuthStore((state) => state.signUp);
  const router = useRouter();

  const backgroundColor = palette.darkGreen;

  const handleSignUp = async () => {
    if (!nome.trim()) {
      Alert.alert('Erro', 'Informe seu nome');
      return;
    }
    if (!email.trim()) {
      Alert.alert('Erro', 'Informe seu e-mail');
      return;
    }
    if (!senha.trim() || senha.length < 6) {
      Alert.alert('Erro', 'A senha deve ter no mínimo 6 caracteres');
      return;
    }
    if (senha !== confirmarSenha) {
      Alert.alert('Erro', 'As senhas não conferem');
      return;
    }

    setLoading(true);
    try {
      await signUp(email.trim(), senha, nome.trim());
      Alert.alert(
        'Conta Criada',
        'Verifique seu e-mail para confirmar o cadastro.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      Alert.alert('Erro no Cadastro', error.message || 'Não foi possível criar a conta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Icon name={ArrowLeft} size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerContainer}>
            <Text style={styles.title}>Criar Conta</Text>
            <Text style={styles.subtitle}>
              Preencha os dados para criar sua conta
            </Text>
          </View>

          <View style={styles.form}>
            <Input
              placeholder="Nome completo"
              value={nome}
              onChangeText={setNome}
              autoCapitalize="words"
              autoComplete="name"
              variant="outline"
              inputStyle={{ paddingLeft: 0 }}
              containerStyle={{ borderRadius: 10 }}
            />

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
              placeholder="Senha (mín. 6 caracteres)"
              value={senha}
              onChangeText={setSenha}
              secureTextEntry
              autoCapitalize="none"
              variant="outline"
              inputStyle={{ paddingLeft: 0 }}
              containerStyle={{ borderRadius: 10 }}
            />

            <Input
              placeholder="Confirmar senha"
              value={confirmarSenha}
              onChangeText={setConfirmarSenha}
              secureTextEntry
              autoCapitalize="none"
              variant="outline"
              inputStyle={{ paddingLeft: 0 }}
              containerStyle={{ borderRadius: 10 }}
            />

            <Button
              onPress={handleSignUp}
              disabled={loading}
              loading={loading}
              variant="secondary"
              style={[styles.signUpButton, { borderRadius: 10, backgroundColor: '#FFFFFF' }]}
              textStyle={{ color: '#1F2937' }}
            >
              Criar Conta
            </Button>

            <View style={styles.linksContainer}>
              <Link href="/(auth)/login" asChild>
                <TouchableOpacity>
                  <Text style={styles.linkText}>
                    Já tem conta? <Text style={styles.linkBold}>Entrar</Text>
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
  backButton: {
    position: 'absolute',
    top: 20,
    left: 24,
    zIndex: 10,
    padding: 8,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 36,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  signUpButton: {
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
