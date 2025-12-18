// screens/ForgotPasswordScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { MaterialIcons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { radii } from '../theme';

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePasswordReset = async () => {
    if (!email) {
      Alert.alert('Erro', 'Por favor, insira seu e-mail.');
      return;
    }

    setLoading(true);

    // Detecta se está rodando no Expo Go (desenvolvimento) ou em app nativo
    const isExpoGo = Constants.appOwnership === 'expo';

    // Em desenvolvimento (Expo Go), usamos explicitamente a URL exp:// que abre o projeto local.
    // Ajuste o IP/porta se o Metro usar outro endereço.
    const devRedirectUrl = 'exp://10.0.1.118:8081/--/reset-password';

    // Em produção (app nativo / TestFlight), usamos o esquema llord:// registrado no app.
    const prodRedirectUrl = 'llord://reset-password';

    const redirectUrl = isExpoGo ? devRedirectUrl : prodRedirectUrl;

    console.log('Using redirect URL:', redirectUrl);
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    if (error) {
      Alert.alert('Erro', error.message);
    } else {
      Alert.alert('Sucesso', 'Verifique seu e-mail para o link de redefinição de senha.');
      navigation.goBack();
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
        <View style={styles.headerContainer}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <MaterialIcons name="arrow-back-ios" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.header}>Recuperar Senha</Text>
            <View style={{ width: 24 }} />
        </View>

        <View style={styles.formContainer}>
            <Text style={styles.instructions}>
                Digite o e-mail associado à sua conta e enviaremos um link para redefinir sua senha.
            </Text>

            <View style={styles.inputContainer}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                style={styles.input}
                placeholder="seuemail@exemplo.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                />
            </View>

            <TouchableOpacity style={styles.sendButton} onPress={handlePasswordReset} disabled={loading}>
                {loading ? (
                <ActivityIndicator color="white" />
                ) : (
                <Text style={styles.sendButtonText}>Enviar Link de Recuperação</Text>
                )}
            </TouchableOpacity>
        </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    paddingTop: 50,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  backButton: {
    padding: 5,
  },
  header: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    flex: 1,
  },
  formContainer: {
    flex: 1,
    padding: 25,
    justifyContent: 'center',
  },
  instructions: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 30,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    height: 50,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  sendButton: {
    backgroundColor: '#4a86e8',
    padding: 15,
    borderRadius: radii.pill,
    alignItems: 'center',
  },
  sendButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default ForgotPasswordScreen;