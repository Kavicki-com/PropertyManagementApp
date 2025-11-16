import 'react-native-url-polyfill/auto';
import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from './lib/supabase';
import { View, ActivityIndicator, Linking } from 'react-native';

// Telas
import LoginScreen from './screens/LoginScreen';
import SignUpScreen from './screens/SignUpScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import ResetPasswordScreen from './screens/ResetPasswordScreen';
import DashboardScreen from './screens/DashboardScreen';
import PropertiesScreen from './screens/PropertiesScreen';
import PropertyDetailsScreen from './screens/PropertyDetailsScreen';
import AddPropertyScreen from './screens/AddPropertyScreen';
import EditPropertyScreen from './screens/EditPropertyScreen';
import TenantsScreen from './screens/TenantsScreen';
import TenantDetailsScreen from './screens/TenantDetailsScreen';
import AddTenantScreen from './screens/AddTenantScreen';
import EditTenantScreen from './screens/EditTenantScreen';
import FinancesScreen from './screens/FinancesScreen';
import AddTransactionScreen from './screens/AddTransactionScreen';
import EditProfileScreen from './screens/EditProfileScreen';
import SettingsScreen from './screens/SettingsScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const linking = {
  prefixes: ['llord://', 'exp://'],
  config: {
    screens: {
      ResetPassword: 'reset-password',
    },
  },
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#4a86e8',
        tabBarInactiveTintColor: 'gray',
        tabBarLabelStyle: { marginBottom: 5 },
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === 'Início') iconName = 'dashboard';
          else if (route.name === 'Imóveis') iconName = 'home';
          else if (route.name === 'Inquilinos') iconName = 'people';
          else if (route.name === 'Finanças') iconName = 'attach-money';
          else if (route.name === 'Configurações') iconName = 'settings';
          return <MaterialIcons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Início" component={DashboardScreen} />
      <Tab.Screen name="Imóveis" component={PropertiesScreen} />
      <Tab.Screen name="Inquilinos" component={TenantsScreen} />
      <Tab.Screen name="Finanças" component={FinancesScreen} />
      <Tab.Screen name="Configurações" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigationRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);

        if (event === 'PASSWORD_RECOVERY' && session) {
          // Usa um timeout para dar tempo à UI para re-renderizar com a nova sessão
          // antes de tentar navegar.
          setTimeout(() => {
            navigationRef.current?.navigate('ResetPassword');
          }, 100);
        }
      }
    );

    // Listener adicional para deep links
    const handleUrl = (url) => {
      console.log('Linking URL received:', url);
      handleDeepLink(url);
    };

    const linkingSubscription = Linking.addEventListener('url', handleUrl);

    // Verifica se o app foi aberto com uma URL
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('Initial URL:', url);
        handleDeepLink(url);
      }
    });

    return () => {
      subscription.unsubscribe();
      linkingSubscription?.remove();
    };
  }, []);

  // Função para lidar com deep linking
  const handleDeepLink = (url) => {
    console.log('Deep link received:', url);

    // Detecta se é um link de reset de senha (contém 'reset-password')
    if (url && url.includes('reset-password')) {
      console.log('Navigating to ResetPassword screen');

      // Para reset de senha, não precisamos definir sessão
      // O usuário deve estar deslogado para poder redefinir a senha
      // Navega diretamente para a tela de reset
      navigationRef.current?.navigate('ResetPassword');
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer 
      ref={navigationRef} 
      linking={{
        ...linking,
        getInitialURL: () => {
          // Retorna a URL inicial se houver
          return null;
        },
        subscribe: (listener) => {
          // Listener para deep links
          const handleUrl = (url) => {
            handleDeepLink(url);
            listener(url);
          };
          
          // Retorna função de limpeza
          return () => {};
        }
      }} 
      fallback={<ActivityIndicator />}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session && session.user ? (
          <Stack.Group>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
            <Stack.Screen name="PropertyDetails" component={PropertyDetailsScreen} />
            <Stack.Screen name="TenantDetails" component={TenantDetailsScreen} />
            <Stack.Screen name="AddProperty" component={AddPropertyScreen} />
            <Stack.Screen name="EditProperty" component={EditPropertyScreen} />
            <Stack.Screen name="AddTenant" component={AddTenantScreen} />
            <Stack.Screen name="EditTenant" component={EditTenantScreen} />
            <Stack.Screen name="AddTransaction" component={AddTransactionScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
          </Stack.Group>
        ) : (
          <Stack.Group>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
            <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}