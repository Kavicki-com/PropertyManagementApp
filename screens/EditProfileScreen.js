import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView
} from 'react-native';
import { supabase } from '../lib/supabase';

const EditProfileScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();

        if (error) {
          Alert.alert('Error', 'Could not fetch profile.');
        } else if (profile) {
          setFullName(profile.full_name);
        }
      }
      setLoading(false);
    };
    fetchProfile();
  }, []);

  const handleUpdateProfile = async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Error', 'User not found.');
      setLoading(false);
      return;
    }

    // Update Full Name in profiles table
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', user.id);

    if (profileError) {
      Alert.alert('Error', profileError.message);
      setLoading(false);
      return;
    }

    // Update password if a new one is provided
    if (newPassword) {
      if (newPassword !== confirmPassword) {
        Alert.alert('Erro', 'As senhas não coincidem.');
        setLoading(false);
        return;
      }
      if (newPassword.length < 6) {
        Alert.alert('Erro', 'A nova senha deve ter pelo menos 6 caracteres.');
        setLoading(false);
        return;
      }

      const { error: passwordError } = await supabase.auth.updateUser({ password: newPassword });

      if (passwordError) {
        Alert.alert('Error', passwordError.message);
        setLoading(false);
        return;
      }
    }

    Alert.alert('Sucesso', 'Perfil atualizado com sucesso!');
    setNewPassword('');
    setConfirmPassword('');
    navigation.goBack();
    setLoading(false);
  };

  return (
    <ScrollView style={styles.container}>
        <View style={styles.header}>
            <Text style={styles.headerTitle}>Editar Perfil</Text>
        </View>
        <View style={styles.formContainer}>
            <View style={styles.inputGroup}>
                <Text style={styles.label}>Nome Completo</Text>
                <TextInput
                    style={styles.input}
                    value={fullName}
                    onChangeText={setFullName}
                />
            </View>

            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>Alterar Senha</Text>
            <View style={styles.inputGroup}>
                <Text style={styles.label}>Nova Senha</Text>
                <TextInput
                    style={styles.input}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                    placeholder="Deixe em branco para não alterar"
                />
            </View>
            <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirmar Nova Senha</Text>
                <TextInput
                    style={styles.input}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                />
            </View>

            <TouchableOpacity style={styles.updateButton} onPress={handleUpdateProfile} disabled={loading}>
            {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Salvar Alterações</Text>}
            </TouchableOpacity>
        </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    header: { backgroundColor: '#fff', padding: 20, paddingTop: 50, borderBottomWidth: 1, borderBottomColor: '#ddd' },
    headerTitle: { fontSize: 24, fontWeight: 'bold', textAlign: 'center' },
    formContainer: { padding: 20 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 20, color: '#333' },
    inputGroup: { marginBottom: 20 },
    label: { marginBottom: 8, fontWeight: '500', fontSize: 16 },
    input: { height: 50, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 15, fontSize: 16, backgroundColor: '#fff' },
    updateButton: { backgroundColor: '#4a86e8', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
    buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    divider: { height: 1, backgroundColor: '#ddd', marginVertical: 30 },
});

export default EditProfileScreen;

