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
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/auth-store';
import { Text } from '@/components/ui/text';
import { View } from '@/components/ui/view';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { palette } from '@/theme/colors';
import { ArrowLeft, Mail } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const resetPassword = useAuthStore((state) => state.resetPassword);
  const router = useRouter();

  const backgroundColor = palette.darkGreen;

  const handleReset = async () => {
    if (!email.trim()) {
      Alert.alert('Erro', 'Informe seu e-mail');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Não foi possível enviar o e-mail de recuperação');
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

          {sent ? (
            <View style={styles.successContainer}>
              <View style={styles.iconCircle}>
                <Icon name={Mail} size={40} color={palette.gold} />
              </View>
              <Text style={styles.title}>E-mail Enviado</Text>
              <Text style={styles.subtitle}>
                Enviamos um link de recuperação para{'\n'}
                <Text style={styles.emailHighlight}>{email}</Text>
              </Text>
              <Text style={styles.instructions}>
                Verifique sua caixa de entrada e spam.{'\n'}
                O link expira em 1 hora.
              </Text>
              <Button
                onPress={() => router.back()}
                variant="secondary"
                style={[styles.backToLoginButton, { borderRadius: 10, backgroundColor: '#FFFFFF' }]}
                textStyle={{ color: '#1F2937' }}
              >
                Voltar ao Login
              </Button>
            </View>
          ) : (
            <>
              <View style={styles.headerContainer}>
                <Text style={styles.title}>Recuperar Senha</Text>
                <Text style={styles.subtitle}>
                  Informe seu e-mail e enviaremos um link para redefinir sua senha
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

                <Button
                  onPress={handleReset}
                  disabled={loading}
                  loading={loading}
                  variant="secondary"
                  style={[styles.resetButton, { borderRadius: 10, backgroundColor: '#FFFFFF' }]}
                  textStyle={{ color: '#1F2937' }}
                >
                  Enviar Link de Recuperação
                </Button>

                <View style={styles.linksContainer}>
                  <TouchableOpacity onPress={() => router.back()}>
                    <Text style={styles.linkText}>
                      Lembrou a senha? <Text style={styles.linkBold}>Voltar ao Login</Text>
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
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
    lineHeight: 22,
  },
  form: {
    gap: 20,
  },
  resetButton: {
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
  successContainer: {
    alignItems: 'center',
    paddingTop: 40,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emailHighlight: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  instructions: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 16,
  },
  backToLoginButton: {
    marginTop: 32,
    width: '100%',
  },
});
