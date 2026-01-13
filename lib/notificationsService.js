// lib/notificationsService.js
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase, supabaseUrl, supabaseAnonKey } from './supabase';
import Constants from 'expo-constants';

// Configuração de comportamento das notificações
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Solicita permissões de notificação e retorna o status
 */
export async function requestNotificationPermissions() {
  if (!Device.isDevice) {
    console.warn('Notificações só funcionam em dispositivos físicos');
    return false;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Permissão de notificação negada');
      return false;
    }

    // Configura canal para Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Padrão',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    return true;
  } catch (error) {
    console.error('Erro ao solicitar permissões:', error);
    return false;
  }
}

/**
 * Obtém o token Expo Push do dispositivo
 */
export async function getExpoPushToken() {
  try {
    if (!Device.isDevice) {
      console.warn('Token Expo Push só está disponível em dispositivos físicos');
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.warn('Project ID não encontrado. Certifique-se de que app.json está configurado corretamente.');
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId || 'd060a5f9-4d18-4a38-b02d-d354c0fd46ea', // fallback do eas.json
    });

    return tokenData.data;
  } catch (error) {
    console.error('Erro ao obter token Expo Push:', error);
    return null;
  }
}

/**
 * Registra o token Expo Push no Supabase
 */
export async function registerPushToken(expoPushToken, navigationRef = null) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.warn('Usuário não autenticado. Token não será registrado.');
      return false;
    }

    if (!expoPushToken) {
      console.warn('Token Expo Push não fornecido');
      return false;
    }

    // Gera um ID único para o dispositivo
    const deviceId = Device.modelName || `${Platform.OS}-${Device.brand}` || 'unknown';

    // Insere ou atualiza o token no banco
    const { error } = await supabase
      .from('user_push_tokens')
      .upsert(
        {
          user_id: user.id,
          expo_push_token: expoPushToken,
          device_id: deviceId,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,expo_push_token',
        }
      );

    if (error) {
      console.error('Erro ao registrar token:', error);
      return false;
    }

    console.log('Token de push registrado com sucesso');
    return true;
  } catch (error) {
    console.error('Erro ao registrar token:', error);
    return false;
  }
}

/**
 * Remove o token Expo Push do Supabase (logout)
 */
export async function unregisterPushToken(expoPushToken) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || !expoPushToken) {
      return false;
    }

    const { error } = await supabase
      .from('user_push_tokens')
      .delete()
      .eq('user_id', user.id)
      .eq('expo_push_token', expoPushToken);

    if (error) {
      console.error('Erro ao remover token:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Erro ao remover token:', error);
    return false;
  }
}

/**
 * Inicializa o serviço de notificações
 */
export async function initializeNotifications(navigationRef = null) {
  try {
    // Solicita permissões
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      return false;
    }

    // Obtém token
    const expoPushToken = await getExpoPushToken();
    if (!expoPushToken) {
      return false;
    }

    // Registra token no Supabase
    await registerPushToken(expoPushToken, navigationRef);

    return expoPushToken;
  } catch (error) {
    console.error('Erro ao inicializar notificações:', error);
    return null;
  }
}

/**
 * Configura listeners para notificações recebidas
 */
export function setupNotificationListeners(navigationRef) {
  // Listener para quando a notificação é recebida com o app em foreground
  const receivedListener = Notifications.addNotificationReceivedListener((notification) => {
    console.log('Notificação recebida:', notification);
  });

  // Listener para quando o usuário toca na notificação
  const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
    console.log('Usuário tocou na notificação:', response);

    const data = response.notification.request.content.data;

    // Navega baseado no tipo de notificação e dados
    if (navigationRef?.current && data) {
      const { screen, tenantId, propertyId, contractId } = data;

      console.log('Navegando para:', screen, data);

      if (screen === 'Dashboard') {
        // Navega para a aba Início
        navigationRef.current.navigate('Main', { screen: 'Início' });
      } else if (screen === 'TenantDetails' && tenantId) {
        // Navega para detalhes do inquilino
        // Se estiver dentro de uma stack, pode precisar navegar para a Stack Group
        navigationRef.current.navigate('TenantDetails', { tenantId });
      } else if (tenantId) {
        // Fallback para lógica antiga
        navigationRef.current.navigate('TenantDetails', { tenantId });
      } else if (propertyId) {
        navigationRef.current.navigate('PropertyDetails', { propertyId });
      } else if (contractId) {
        if (tenantId) {
          navigationRef.current.navigate('TenantDetails', { tenantId });
        } else if (propertyId) {
          navigationRef.current.navigate('PropertyDetails', { propertyId });
        }
      }
    }
  });

  // Retorna função de limpeza
  return () => {
    receivedListener.remove();
    responseListener.remove();
  };
}

/**
 * Verifica e cria notificações no backend (chama a função SQL)
 */
export async function checkAndCreateNotifications() {
  try {
    const { data, error } = await supabase.rpc('check_all_notifications');

    if (error) {
      console.error('Erro ao verificar notificações:', error);
      return { error };
    }

    // Para cada notificação criada, envia push
    if (data && data.length > 0) {
      for (const notification of data) {
        if (notification.notification_id) {
          // Chama a Edge Function para enviar push
          await sendPushNotification(notification.notification_id);
        }
      }
    }

    return { data };
  } catch (error) {
    console.error('Erro ao verificar e criar notificações:', error);
    return { error };
  }
}

/**
 * Envia push notification (Executado no Client-side para contornar erro na Edge Function)
 */
async function sendPushNotification(notificationId) {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      console.warn('Usuário não autenticado. Push não será enviado.');
      return;
    }

    // 1. Busca detalhes da notificação
    const { data: notification, error: notifError } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', notificationId)
      .single();

    if (notifError || !notification) {
      console.error('Erro ao buscar notificação para envio:', notifError);
      return;
    }

    // 2. Busca tokens do usuário
    const { data: tokens, error: tokenError } = await supabase
      .from('user_push_tokens')
      .select('expo_push_token')
      .eq('user_id', notification.user_id);

    if (tokenError || !tokens || tokens.length === 0) {
      console.log('Nenhum token de push encontrado para o usuário.');
      return;
    }

    // 3. Prepara mensagens para Expo
    const messages = tokens.map(t => ({
      to: t.expo_push_token,
      sound: 'default',
      title: notification.title,
      body: notification.body,
      data: {
        ...notification.data,
        notification_id: notification.id,
        type: notification.type,
      },
      priority: 'high',
    }));

    // 4. Envia para Expo Push API
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro ao enviar para Expo Push API:', errorText);
    } else {
      const result = await response.json();
      console.log('Push enviado com sucesso:', result);
    }

  } catch (error) {
    console.error('Erro ao enviar push notification (Client):', error);
  }
}

/**
 * Busca notificações não lidas do usuário
 */
export async function fetchUnreadNotifications(limit = 20) {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Erro ao buscar notificações:', error);
      return { data: [], error };
    }

    return { data: data || [], error: null };
  } catch (error) {
    console.error('Erro ao buscar notificações:', error);
    return { data: [], error };
  }
}

/**
 * Marca notificação como lida
 */
export async function markNotificationAsRead(notificationId) {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    if (error) {
      console.error('Erro ao marcar notificação como lida:', error);
      return { error };
    }

    return { error: null };
  } catch (error) {
    console.error('Erro ao marcar notificação como lida:', error);
    return { error };
  }
}

