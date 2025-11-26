// screens/SettingsScreen.js 
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Switch, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import ScreenHeader from '../components/ScreenHeader';
import { colors, typography, radii } from '../theme';

const SettingsScreen = ({ navigation }) => {
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email);
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();

        if (profile && profile.full_name) {
          setUserName(profile.full_name);
        }
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

  const SettingsItem = ({ iconName, iconColor, title, subtitle, onPress, rightElement, danger }) => {
    return (
      <TouchableOpacity
        style={styles.itemRow}
        onPress={onPress}
        activeOpacity={onPress ? 0.7 : 1}
        disabled={!onPress && !rightElement}
      >
        <MaterialIcons
          name={iconName}
          size={24}
          color={danger ? colors.danger : iconColor || colors.textSecondary}
        />
        <View style={styles.itemTextContainer}>
          <Text style={[styles.itemTitle, danger && styles.itemTitleDanger]}>{title}</Text>
          {subtitle ? <Text style={styles.itemSubtitle}>{subtitle}</Text> : null}
        </View>
        {rightElement ? rightElement : onPress ? (
          <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
        ) : null}
      </TouchableOpacity>
    );
  };

  const SettingsSection = ({ title, children }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader title="Configurações" />
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
        {/* User card destacado no topo */}
        <View style={styles.userCard}>
          <Text style={styles.userCardTitle}>Conta do usuário</Text>
          <View style={styles.userInfoRow}>
            <View style={styles.avatarContainer}>
              <Image
                source={require('../assets/avatar-placeholder.png')}
                style={styles.avatar}
              />
            </View>
            <View style={styles.userTextContainer}>
              <Text style={styles.userName} numberOfLines={1}>
                {userName || 'Usuário autenticado'}
              </Text>
              {userEmail ? (
                <Text style={styles.userEmail} numberOfLines={1}>
                  {userEmail}
                </Text>
              ) : null}
            </View>
          </View>
          <TouchableOpacity
            style={styles.editProfileButton}
            onPress={() => navigation.navigate('EditProfile')}
            activeOpacity={0.7}
          >
            <MaterialIcons name="edit" size={18} color={colors.primary} />
            <Text style={styles.editProfileText}>Editar perfil</Text>
          </TouchableOpacity>
        </View>

        {/* App Settings */}
        <SettingsSection title="Configurações do app">
          <SettingsItem
            iconName="notifications"
            title="Notificações"
            subtitle="Controle se você deseja receber notificações"
            rightElement={(
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
              />
            )}
          />
        </SettingsSection>

        {/* Account Actions */}
        <SettingsSection title="Ações da conta">
          <SettingsItem
            iconName="delete-forever"
            title="Deletar conta"
            subtitle="Função ainda não implementada"
            onPress={handleDeleteAccount}
            danger
          />
        </SettingsSection>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
          <Text style={styles.logoutButtonText}>Sair</Text>
        </TouchableOpacity>
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
    padding: 16,
    paddingBottom: 32,
  },
  userCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  userCardTitle: {
    ...typography.sectionTitle,
    marginBottom: 12,
  },
  userInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    marginRight: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    resizeMode: 'cover',
  },
  userTextContainer: {
    flex: 1,
  },
  userName: {
    ...typography.bodyStrong,
  },
  userEmail: {
    ...typography.body,
    marginTop: 2,
  },
  userSubtitle: {
    ...typography.body,
    marginTop: 4,
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
  },
  editProfileText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  section: {
    marginBottom: 16,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    ...typography.sectionTitle,
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  itemTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  itemTitle: {
    ...typography.bodyStrong,
  },
  itemTitleDanger: {
    color: colors.danger,
  },
  itemSubtitle: {
    ...typography.caption,
    marginTop: 2,
  },
  logoutButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radii.pill,
    alignItems: 'center',
    marginTop: 8,
  },
  logoutButtonText: {
    ...typography.button,
  },
});

export default SettingsScreen;