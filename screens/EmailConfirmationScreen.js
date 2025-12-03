// screens/EmailConfirmationScreen.js
import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors, typography, radii } from '../theme';

const EmailConfirmationScreen = ({ navigation }) => {
  // Auto-redirect para login após 5 segundos
  useEffect(() => {
    const timer = setTimeout(async () => {
      // Faz logout para garantir que o usuário precise fazer login novamente
      await supabase.auth.signOut();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    }, 5000);

    return () => clearTimeout(timer);
  }, [navigation]);

  const handleGoToLogin = async () => {
    // Faz logout para garantir que o usuário precise fazer login novamente
    await supabase.auth.signOut();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Login' }],
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.contentContainer}>
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons
            name="check-circle"
            size={80}
            color={colors.income}
          />
        </View>

        <Text style={styles.title}>Conta Confirmada!</Text>

        <Text style={styles.message}>
          Sua conta foi confirmada com sucesso. Agora você pode fazer login e começar a usar o LLord.
        </Text>

        <TouchableOpacity
          style={styles.loginButton}
          onPress={handleGoToLogin}
        >
          <Text style={styles.loginButtonText}>Ir para Login</Text>
        </TouchableOpacity>

        <Text style={styles.autoRedirectText}>
          Redirecionando automaticamente em alguns segundos...
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    flex: 1,
    padding: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 30,
  },
  title: {
    ...typography.screenTitle,
    textAlign: 'center',
    marginBottom: 20,
  },
  message: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: 40,
    paddingHorizontal: 20,
    lineHeight: 24,
  },
  loginButton: {
    backgroundColor: colors.primary,
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    marginBottom: 20,
    minWidth: 200,
  },
  loginButtonText: {
    ...typography.button,
    fontSize: 16,
  },
  autoRedirectText: {
    ...typography.caption,
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: 10,
  },
});

export default EmailConfirmationScreen;

