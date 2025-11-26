import 'react-native-url-polyfill/auto';
import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from './lib/supabase';
import { View, ActivityIndicator, Linking as RNLinking } from 'react-native';
import * as Linking from 'expo-linking';
import { colors, typography } from './theme';

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
import LinkTenantScreen from './screens/LinkTenantScreen';
import LinkPropertyScreen from './screens/LinkPropertyScreen';
import AddContractScreen from './screens/AddContractScreen';

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
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: 'gray',
        tabBarLabelStyle: {
          ...typography.caption,
          fontSize: 11,
          marginBottom: 5,
        },
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === 'Início') iconName = 'view-dashboard-outline';
          else if (route.name === 'Imóveis') iconName = 'home-outline';
          else if (route.name === 'Inquilinos') iconName = 'account-group-outline';
          else if (route.name === 'Finanças') iconName = 'finance';
          else if (route.name === 'Configurações') iconName = 'cog-outline';
          return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
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
    const handleUrl = (event) => {
      const url = typeof event === 'string' ? event : event.url;
      console.log('Linking URL received:', url);
      handleDeepLink(url);
    };

    const linkingSubscription = RNLinking.addEventListener('url', handleUrl);

    // Verifica se o app foi aberto com uma URL
    RNLinking.getInitialURL().then((url) => {
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
  const handleDeepLink = async (url) => {
    if (!url) return;

    console.log('Deep link received:', url);

    // Faz o parse da URL para extrair tokens e tipo de operação.
    // O Supabase está mandando os parâmetros no fragmento (#...), então usamos
    // Linking.parse e, se necessário, fazemos um parse manual.
    const { queryParams: parsedParams } = Linking.parse(url);

    let queryParams = parsedParams;

    if (!queryParams || Object.keys(queryParams).length === 0) {
      const hashIndex = url.indexOf('#');
      if (hashIndex !== -1 && hashIndex + 1 < url.length) {
        const hash = url.substring(hashIndex + 1);
        const searchParams = new URLSearchParams(hash);
        queryParams = Object.fromEntries(searchParams.entries());
      }
    }

    const access_token = queryParams?.access_token;
    const refresh_token = queryParams?.refresh_token;
    const type = queryParams?.type;

    // Se for um link de recuperação de senha do Supabase, cria a sessão
    if (type === 'recovery' && access_token && refresh_token) {
      console.log('Setting session from recovery link');
      const { error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      if (error) {
        console.log('Error setting session from recovery link', error);
        return;
      }

      // Após criar a sessão de recuperação, navega para a tela de reset.
      // Usamos reset para garantir que a navegação funcione mesmo se a pilha mudar
      // quando a sessão for atualizada.
      console.log('Navigating to ResetPassword screen after recovery session set');
      navigationRef.current?.reset({
        index: 0,
        routes: [{ name: 'ResetPassword' }],
      });
      return;
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
            <Stack.Screen name="LinkTenant" component={LinkTenantScreen} />
            <Stack.Screen name="LinkProperty" component={LinkPropertyScreen} />
            <Stack.Screen name="AddContract" component={AddContractScreen} />
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