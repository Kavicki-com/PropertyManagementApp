// screens/SettingsScreen.js 
//comentário novo
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Switch } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

const SettingsScreen = ({ navigation }) => {
  const [userEmail, setUserEmail] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email);
      }
    };
    fetchUser();
  }, []);

  const handleLogout = async () => {
    Alert.alert(
      "Sair",
      "Você tem certeza que quer sair?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sair",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase.auth.signOut();
            if (error) {
              Alert.alert('Erro', 'Não foi possível sair.');
            } else {
              // Reset navigation to the Login screen
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
        "Ação Perigosa",
        "A exclusão de conta é uma ação que deve ser tratada com segurança no servidor e não pode ser feita diretamente do aplicativo. Esta função ainda será implementada.",
        [{ text: "OK" }]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Configurações</Text>
      </View>

      {/* User Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Conta do Usuário</Text>
        <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('EditProfile')}>
          <MaterialIcons name="person" size={24} color="#555" />
          <View style={styles.rowTextContainer}>
            <Text style={styles.rowLabel}>Editar Perfil</Text>
            <Text style={styles.rowValue}>{userEmail}</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color="#999" />
        </TouchableOpacity>
      </View>

      {/* App Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Configurações do App</Text>
        <View style={styles.row}>
          <MaterialIcons name="notifications" size={24} color="#555" />
          <View style={styles.rowTextContainer}>
            <Text style={styles.rowLabel}>Notificações</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
          />
        </View>
      </View>

      {/* Account Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ações da Conta</Text>
        <TouchableOpacity style={styles.row} onPress={handleDeleteAccount}>
          <MaterialIcons name="delete-forever" size={24} color="#F44336" />
          <Text style={[styles.rowLabel, styles.destructiveText]}>Deletar Conta</Text>
        </TouchableOpacity>
      </View>
      
      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Sair</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'left',
  },
  section: {
    marginTop: 20,
    marginHorizontal: 15,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
  },
  rowTextContainer: {
    flex: 1,
    marginLeft: 15,
  },
  rowLabel: {
    fontSize: 16,
    color: '#333',
  },
  rowValue: {
    fontSize: 14,
    color: '#888',
  },
  destructiveText: {
    color: '#F44336',
    marginLeft: 15,
    fontWeight: 'bold'
  },
  logoutButton: {
    margin: 15,
    marginTop: 30,
    backgroundColor: '#4a86e8',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default SettingsScreen;

