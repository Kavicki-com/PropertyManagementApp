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
    
    // Navega baseado no tipo de notificação
    if (navigationRef?.current && data) {
      if (data.tenant_id) {
        // Navega para detalhes do inquilino
        navigationRef.current.navigate('TenantDetails', { 
          tenantId: data.tenant_id 
        });
      } else if (data.property_id) {
        // Navega para detalhes do imóvel
        navigationRef.current.navigate('PropertyDetails', { 
          propertyId: data.property_id 
        });
      } else if (data.contract_id) {
        // Navega para contratos (via inquilino ou propriedade)
        if (data.tenant_id) {
          navigationRef.current.navigate('TenantDetails', { 
            tenantId: data.tenant_id 
          });
        } else if (data.property_id) {
          navigationRef.current.navigate('PropertyDetails', { 
            propertyId: data.property_id 
          });
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
 * Chama a Edge Function para enviar push notification
 */
async function sendPushNotification(notificationId) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.warn('Usuário não autenticado. Push não será enviado.');
      return;
    }

    const functionUrl = `${supabaseUrl}/functions/v1/send-push-notification`;

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify({ notification_id: notificationId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro ao enviar push:', errorText);
    }
  } catch (error) {
    console.error('Erro ao chamar Edge Function:', error);
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

