// screens/LoginScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { radii } from '../theme';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleResendConfirmation = async () => {
    if (!email) {
      Alert.alert('Erro', 'Por favor, insira seu email primeiro.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
    });

    if (error) {
      Alert.alert('Erro', error.message);
    } else {
      Alert.alert(
        'Email enviado',
        'Verifique sua caixa de entrada e a pasta de spam. O email pode levar alguns minutos para chegar.'
      );
    }
    setLoading(false);
  };

  const handleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      // Verifica se é erro de email não confirmado
      if (error.message.includes('Email not confirmed') || error.message.includes('email not confirmed')) {
        Alert.alert(
          'Email não confirmado',
          'Por favor, verifique seu email e confirme sua conta antes de fazer login. Não recebeu o email?',
          [
            {
              text: 'Cancelar',
              style: 'cancel',
            },
            {
              text: 'Reenviar email',
              onPress: handleResendConfirmation,
              style: 'default',
            },
          ]
        );
      }
      // Verifica se é erro de credenciais inválidas
      else if (error.message.includes('Invalid login credentials') || error.message.includes('invalid credentials')) {
        Alert.alert(
          'Cadastro não encontrado',
          'Clique em cadastre-se para continuar',
          [
            {
              text: 'Cancelar',
              style: 'cancel',
            },
            {
              text: 'Cadastre-se',
              onPress: () => navigation.navigate('SignUp'),
              style: 'default',
            },
          ]
        );
      } else {
        Alert.alert('Erro', error.message);
      }
    }
    setLoading(false);
  };


  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <Image source={require('../assets/logo.png')} style={styles.logo} />
      <Text style={styles.title}>Entrar</Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Senha</Text>
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
      </View>

      <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
        <Text style={styles.forgotPassword}>Esqueceu a senha?</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.loginButtonText}>Entrar</Text>
        )}
      </TouchableOpacity>

      <View style={styles.signUpContainer}>
        <Text style={styles.signUpText}>Não tem uma conta? </Text>
        <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
          <Text style={styles.signUpLink}>Cadastre-se</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.faqButton}
        onPress={() => navigation.navigate('FAQ')}
      >
        <Text style={styles.faqButtonText}>Perguntas Frequentes (FAQ)</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 25,
    backgroundColor: '#fafafa',
  },
  logo: {
    width: 100,
    height: 100,
    alignSelf: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 15,
  },
  label: {
    marginBottom: 5,
  },
  input: {
    height: 50,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  forgotPassword: {
    color: '#4a86e8',
    textAlign: 'right',
    marginBottom: 20,
  },
  loginButton: {
    backgroundColor: '#4a86e8',
    padding: 15,
    borderRadius: radii.pill,
    alignItems: 'center',
    marginBottom: 20,
  },
  loginButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  signUpText: {
    color: '#666',
  },
  signUpLink: {
    color: '#4a86e8',
    fontWeight: 'bold',
  },
  faqButton: {
    marginTop: 20,
    padding: 12,
    alignItems: 'center',
  },
  faqButtonText: {
    color: '#4a86e8',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});

export default LoginScreen;