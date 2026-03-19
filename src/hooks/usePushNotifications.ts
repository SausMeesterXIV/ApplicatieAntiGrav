import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { Device } from '@capacitor/device';
import { messaging } from '../lib/firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { savePushToken } from '../lib/supabaseService';
import { User } from '../types';

const ENABLE_NOTIFICATIONS = false; // Zet op 'true' om push-meldingen te activeren

export function usePushNotifications(currentUser: User | null) {
  useEffect(() => {
    if (!ENABLE_NOTIFICATIONS || !currentUser || !currentUser.id) return;

    if (Capacitor.isNativePlatform()) {
      setupNativePush(currentUser.id);
    } else {
      setupWebPush(currentUser);
    }
  }, [currentUser]);
}

async function setupNativePush(userId: string) {
  try {
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt') {
      perm = await PushNotifications.requestPermissions();
    }

    if (perm.receive === 'granted') {
      await PushNotifications.register();

      PushNotifications.addListener('registration', async (token) => {
        const info = await Device.getInfo();
        console.log('Native Push Token:', token.value);
        await savePushToken(userId, token.value, info.platform);
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.error('Push registration error:', error);
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push received (foreground):', notification);
        const event = new CustomEvent('app-notification', { 
          detail: { 
            title: notification.title, 
            message: notification.body, 
            type: 'info' 
          } 
        });
        window.dispatchEvent(event);
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('Push action performed:', action);
      });
    }
  } catch (error) {
    console.error('Error setting up native push notifications:', error);
  }
}

async function setupWebPush(currentUser: User) {
  try {
    const messagingInstance = await messaging;
    if (!messagingInstance) {
      console.warn('Firebase Messaging not supported');
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const token = await getToken(messagingInstance, {
      vapidKey: 'BIsy-S5f_...', // Replace with real VAPID key
    });

    if (token) {
      console.log('Web FCM Token:', token);
      await savePushToken(currentUser.id, token, 'web');
    }

    onMessage(messagingInstance, (payload) => {
      console.log('Web foreground message:', payload);
      if (payload.notification) {
        const event = new CustomEvent('app-notification', { 
          detail: { 
            title: payload.notification.title, 
            message: payload.notification.body, 
            type: 'info' 
          } 
        });
        window.dispatchEvent(event);
      }
    });
  } catch (error) {
    console.error('Error setting up web push notifications:', error);
  }
}
