// App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';

// Screens
import LoginScreen from './screens/LoginScreen';
import SignUpScreen from './screens/SignUpScreen';
import DashboardScreen from './screens/DashboardScreen';
import PropertiesScreen from './screens/PropertiesScreen';
import PropertyDetailsScreen from './screens/PropertyDetailsScreen';
import AddPropertyScreen from './screens/AddPropertyScreen';
import EditPropertyScreen from './screens/EditPropertyScreen';
import TenantsScreen from './screens/TenantsScreen';
import TenantDetailsScreen from './screens/TenantDetailsScreen';
import AddTenantScreen from './screens/AddTenantScreen';
import EditTenantScreen from './screens/EditTenantScreen'; // Make sure this is imported
import FinancesScreen from './screens/FinancesScreen';
import AddTransactionScreen from './screens/AddTransactionScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#4a86e8',
        tabBarInactiveTintColor: 'gray',
        tabBarLabelStyle: {
          marginBottom: 5,
        },
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === 'Início') {
            iconName = 'dashboard';
          } else if (route.name === 'Imóveis') {
            iconName = 'home';
          } else if (route.name === 'Inquilinos') {
            iconName = 'people';
          } else if (route.name === 'Finanças') {
            iconName = 'attach-money';
          }
          return <MaterialIcons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Início" component={DashboardScreen} />
      <Tab.Screen name="Imóveis" component={PropertiesScreen} />
      <Tab.Screen name="Inquilinos" component={TenantsScreen} />
      <Tab.Screen name="Finanças" component={FinancesScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="SignUp" component={SignUpScreen} />
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="PropertyDetails" component={PropertyDetailsScreen} />
        <Stack.Screen name="TenantDetails" component={TenantDetailsScreen} />
        <Stack.Screen name="AddProperty" component={AddPropertyScreen} />
        <Stack.Screen name="EditProperty" component={EditPropertyScreen} />
        <Stack.Screen name="AddTenant" component={AddTenantScreen} />
        <Stack.Screen name="EditTenant" component={EditTenantScreen} />
        <Stack.Screen name="AddTransaction" component={AddTransactionScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}