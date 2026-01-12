// screens/SettingsScreen.js 
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Switch, Linking } from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import ScreenHeader from '../components/ScreenHeader';
import { getUserSubscription, getActivePropertiesCount, getSubscriptionLimits } from '../lib/subscriptionService';
import { loadAccessibilitySettings, updateAccessibilitySetting } from '../lib/accessibilityService';
import { useAccessibilityTheme } from '../lib/useAccessibilityTheme';

const SettingsScreen = ({ navigation }) => {
  const { theme } = useAccessibilityTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userPhotoUrl, setUserPhotoUrl] = useState(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [subscription, setSubscription] = useState(null);
  const [propertyCount, setPropertyCount] = useState(0);
  const [fontScale, setFontScale] = useState(1.0);
  const [highContrast, setHighContrast] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email);
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, photo_url')
          .eq('id', user.id)
          .single();

        if (profile) {
          if (profile.full_name) {
            setUserName(profile.full_name);
          }
          if (profile.photo_url) {
            setUserPhotoUrl(profile.photo_url);
          }
        }

        // Carregar dados de assinatura
        const [subscriptionData, count] = await Promise.all([
          getUserSubscription(user.id),
          getActivePropertiesCount(user.id),
        ]);
        setSubscription(subscriptionData);
        setPropertyCount(count);
      }
    };
    fetchUser();

    // Carregar preferências de acessibilidade
    const loadAccessibility = async () => {
      const settings = await loadAccessibilitySettings();
      setFontScale(settings.fontScale);
      setHighContrast(settings.highContrast);
    };
    loadAccessibility();
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

  const deleteAccount = async () => {
    try {
      // Chama a RPC function para deletar a conta do usuário autenticado
      const { data, error } = await supabase.rpc('delete_user_account');

      if (error) {
        console.error('Erro ao deletar conta:', error);
        Alert.alert(
          'Erro',
          error.message || 'Não foi possível deletar a conta. Verifique se a função RPC está configurada corretamente.'
        );
        return;
      }

      // Verifica se a função retornou sucesso
      if (data && !data.success) {
        Alert.alert('Erro', data.error || 'Não foi possível deletar a conta.');
        return;
      }

      // Se chegou aqui, a exclusão foi bem-sucedida
      // Faz logout antes de redirecionar
      await supabase.auth.signOut();

      Alert.alert('Sucesso', 'Sua conta foi deletada com sucesso.', [
        {
          text: 'OK',
          onPress: () => {
            // Redireciona para tela de Login
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          },
        },
      ]);
    } catch (error) {
      console.error('Erro inesperado ao deletar conta:', error);
      Alert.alert('Erro', 'Ocorreu um erro inesperado ao tentar deletar a conta.');
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Deletar Conta",
      "Você tem certeza que deseja deletar sua conta? Esta ação é irreversível e todos os seus dados serão permanentemente removidos.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Deletar",
          style: "destructive",
          onPress: deleteAccount,
        },
      ]
    );
  };

  const handleEmailSupport = async () => {
    const email = 'design@kavicki.com';
    const url = `mailto:${email}`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Erro', 'Não foi possível abrir o cliente de email.');
      }
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível abrir o cliente de email.');
    }
  };

  const handleWebsiteSupport = async () => {
    const url = 'https://llord.kavicki.com/suporte.html';
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Erro', 'Não foi possível abrir o navegador.');
      }
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível abrir o navegador.');
    }
  };

  const handleWhatsAppSupport = async () => {
    const phoneNumber = '5521966087421';
    const message = 'Olá! Preciso de ajuda com o aplicativo llord.';

    try {
      // Tenta abrir o WhatsApp app diretamente primeiro
      const whatsappUrl = `whatsapp://send?phone=${phoneNumber}&text=${encodeURIComponent(message)}`;

      // Verifica se pode abrir (pode falhar em alguns dispositivos mesmo com WhatsApp instalado)
      const canOpen = await Linking.canOpenURL(whatsappUrl).catch(() => false);

      if (canOpen) {
        await Linking.openURL(whatsappUrl);
      } else {
        // Fallback: tenta abrir mesmo assim (pode funcionar mesmo se canOpenURL retornar false)
        try {
          await Linking.openURL(whatsappUrl);
        } catch {
          // Se falhar, usa WhatsApp Web como último recurso
          const webUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
          const canOpenWeb = await Linking.canOpenURL(webUrl).catch(() => true);
          if (canOpenWeb) {
            await Linking.openURL(webUrl);
          } else {
            Alert.alert(
              'Erro',
              'Não foi possível abrir o WhatsApp. Por favor, instale o aplicativo WhatsApp ou acesse https://wa.me/' + phoneNumber
            );
          }
        }
      }
    } catch (error) {
      console.error('Erro ao abrir WhatsApp:', error);
      // Última tentativa com WhatsApp Web
      try {
        const webUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
        await Linking.openURL(webUrl);
      } catch (webError) {
        Alert.alert(
          'Erro',
          'Não foi possível abrir o WhatsApp. Por favor, instale o aplicativo WhatsApp ou acesse https://wa.me/' + phoneNumber
        );
      }
    }
  };

  const handleFAQ = () => {
    navigation.navigate('FAQ');
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
          color={danger ? theme.colors.danger : iconColor || theme.colors.primary}
        />
        <View style={styles.itemTextContainer}>
          <Text style={[styles.itemTitle, danger && styles.itemTitleDanger]}>{title}</Text>
          {subtitle ? <Text style={styles.itemSubtitle}>{subtitle}</Text> : null}
        </View>
        {rightElement ? rightElement : onPress ? (
          <MaterialIcons name="chevron-right" size={24} color={theme.colors.textSecondary} />
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
                source={
                  userPhotoUrl
                    ? { uri: userPhotoUrl }
                    : require('../assets/avatar-placeholder.png')
                }
                style={styles.avatar}
                contentFit="cover"
                cachePolicy="memory-disk"
                placeholder={require('../assets/avatar-placeholder.png')}
                transition={200}
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
            <MaterialIcons name="edit" size={18} color={theme.colors.primary} />
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
          <SettingsItem
            iconName="card-membership"
            title="Assinatura"
            subtitle={
              subscription
                ? `${subscription.subscription_plan === 'free' ? 'Gratuito' : subscription.subscription_plan === 'basic' ? 'Básico' : 'Premium'} • ${propertyCount} imóveis`
                : 'Gerenciar assinatura'
            }
            onPress={() => navigation.navigate('Subscription')}
          />
        </SettingsSection>

        {/* Accessibility Settings */}
        <SettingsSection title="Acessibilidade">
          <SettingsItem
            iconName="contrast"
            title="Alto Contraste"
            subtitle="Facilita a leitura com cores mais contrastantes"
            rightElement={(
              <Switch
                value={highContrast}
                onValueChange={async (value) => {
                  setHighContrast(value);
                  await updateAccessibilitySetting('highContrast', value);
                }}
              />
            )}
          />
          <SettingsItem
            iconName="text-fields"
            title="Tamanho da Fonte"
            subtitle={
              fontScale === 1.0 ? 'Normal' :
                fontScale === 1.2 ? 'Grande' :
                  fontScale === 1.5 ? 'Extra Grande' : 'Normal'
            }
            onPress={() => {
              Alert.alert(
                'Tamanho da Fonte',
                'Escolha o tamanho da fonte:',
                [
                  {
                    text: 'Normal',
                    onPress: async () => {
                      setFontScale(1.0);
                      await updateAccessibilitySetting('fontScale', 1.0);
                    },
                  },
                  {
                    text: 'Grande',
                    onPress: async () => {
                      setFontScale(1.2);
                      await updateAccessibilitySetting('fontScale', 1.2);
                    },
                  },
                  {
                    text: 'Extra Grande',
                    onPress: async () => {
                      setFontScale(1.5);
                      await updateAccessibilitySetting('fontScale', 1.5);
                    },
                  },
                  { text: 'Cancelar', style: 'cancel' },
                ]
              );
            }}
          />
        </SettingsSection>

        {/* Support Section */}
        <SettingsSection title="Suporte">
          <SettingsItem
            iconName="help-outline"
            title="FAQ"
            subtitle="Perguntas frequentes"
            onPress={handleFAQ}
          />
          <SettingsItem
            iconName="email"
            title="Email de suporte"
            onPress={handleEmailSupport}
          />
          <SettingsItem
            iconName="language"
            title="Website de suporte"
            onPress={handleWebsiteSupport}
          />
          <SettingsItem
            iconName="support-agent"
            title="WhatsApp"
            onPress={handleWhatsAppSupport}
          />
        </SettingsSection>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
          <Text style={styles.logoutButtonText}>Sair</Text>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Delete Account Button */}
        <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount} activeOpacity={0.8}>
          <Text style={styles.deleteButtonText}>Deletar conta</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  userCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: 16,
    marginBottom: 16,
    ...(theme.isHighContrast ? {
      borderWidth: 2,
      borderColor: theme.colors.textPrimary,
      shadowOpacity: 0,
      elevation: 0,
    } : {
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    }),
  },
  userCardTitle: {
    ...theme.typography.sectionTitle,
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
    backgroundColor: theme.colors.primarySoft,
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
    ...theme.typography.bodyStrong,
  },
  userEmail: {
    ...theme.typography.body,
    marginTop: 2,
  },
  userSubtitle: {
    ...theme.typography.body,
    marginTop: 4,
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.primarySoft,
  },
  editProfileText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  section: {
    marginBottom: 16,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...(theme.isHighContrast && {
      borderWidth: 2,
      borderColor: theme.colors.textPrimary,
    }),
  },
  sectionTitle: {
    ...theme.typography.sectionTitle,
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: theme.radii.pill,
  },
  itemTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  itemTitle: {
    ...theme.typography.bodyStrong,
  },
  itemTitleDanger: {
    color: theme.colors.danger,
  },
  itemSubtitle: {
    ...theme.typography.caption,
    marginTop: 2,
  },
  logoutButton: {
    backgroundColor: 'transparent',
    paddingVertical: 14,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    marginTop: 8,
  },
  logoutButtonText: {
    ...theme.typography.button,
    color: theme.colors.primary,
  },
  deleteButton: {
    backgroundColor: 'transparent',
    paddingVertical: 14,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    marginTop: 8,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: 'normal',
    color: theme.colors.danger,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.borderSubtle || '#e5e7eb',
    marginVertical: 8,
  },
});

export default SettingsScreen;