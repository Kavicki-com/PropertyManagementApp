import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { useIsFocused } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import ScreenHeader from '../components/ScreenHeader';
import { colors, typography, radii } from '../theme';

const EditProfileScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);

  const isFocused = useIsFocused();

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email);
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('full_name, phone')
          .eq('id', user.id)
          .single();
        
        if (error) {
          Alert.alert('Error', 'Could not fetch profile.');
        } else if (profile) {
          setFullName(profile.full_name || '');
          setPhone(profile.phone || '');
        }
      }
      setLoading(false);
    };

    if(isFocused){
        fetchProfile();
    }
  }, [isFocused]);

  const handleUpdateProfile = async () => {
    setIsSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

    // 1. Update Name and Phone in the 'profiles' table
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ full_name: fullName, phone: phone, updated_at: new Date() })
      .eq('id', user.id);

    if (profileError) {
      Alert.alert('Error', profileError.message);
      setIsSaving(false);
      return;
    }

    // 2. Update Email if it has changed
    if (email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email: email });
        if (emailError) {
            Alert.alert('Error updating email', emailError.message);
            setIsSaving(false);
            return;
        }
        Alert.alert('Success', 'Please check your new email address to confirm the change.');
    }

    // 3. Update Password if a new one is provided
    if (newPassword) {
      if (newPassword !== confirmPassword) {
        Alert.alert('Error', 'Passwords do not match.');
        setIsSaving(false);
        return;
      }
      if (newPassword.length < 6) {
        Alert.alert('Error', 'Password must be at least 6 characters long.');
        setIsSaving(false);
        return;
      }
      const { error: passwordError } = await supabase.auth.updateUser({ password: newPassword });
      if (passwordError) {
        Alert.alert('Error updating password', passwordError.message);
        setIsSaving(false);
        return;
      }
    }

    setIsSaving(false);
    Alert.alert('Success', 'Profile updated successfully!');
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Editar perfil" onBack={() => navigation.goBack()} />
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {loading ? (
          <ActivityIndicator style={styles.loader} />
        ) : (
          <View style={styles.formContainer}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Informações pessoais</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nome completo</Text>
                <TextInput
                  style={styles.input}
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Telefone</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>E-mail</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Alterar senha</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nova senha</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Deixe em branco para não alterar"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirmar nova senha</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Deixe em branco para não alterar"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleUpdateProfile}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.buttonText}>Salvar alterações</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 32,
  },
  loader: {
    marginTop: 24,
  },
  formContainer: {
    flex: 1,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    ...typography.sectionTitle,
    marginBottom: 15,
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    ...typography.label,
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.sm,
    paddingHorizontal: 15,
    fontSize: 16,
    backgroundColor: colors.surface,
  },
  saveButton: {
    backgroundColor: colors.primary,
    padding: 15,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  buttonText: {
    ...typography.button,
    fontSize: 16,
  },
});

export default EditProfileScreen;