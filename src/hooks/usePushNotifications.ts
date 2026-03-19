import { useEffect } from 'react';
import { messaging } from '../lib/firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { updateUserFcmToken } from '../lib/supabaseService';
import { User } from '../types';

const ENABLE_NOTIFICATIONS = false; // Zet op 'true' om push-meldingen te activeren

export function usePushNotifications(currentUser: User | null) {
  useEffect(() => {
    if (!ENABLE_NOTIFICATIONS || !currentUser || !currentUser.id) return;

    const setupNotifications = async () => {
      try {
        const messagingInstance = await messaging;
        if (!messagingInstance) {
          console.warn('Firebase Messaging not supported in this browser/environment');
          return;
        }

        // Request permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.warn('Notification permission not granted');
          return;
        }

        // Get token
        // Note: You need a VAPID key from Firebase Console -> Project Settings -> Cloud Messaging -> Web Push certificates
        const token = await getToken(messagingInstance, {
          vapidKey: 'BIsy-S5f_...', // Placeholder, will need real VAPID key if web push is used
        });

        if (token) {
          console.log('FCM Token:', token);
          if (currentUser.fcm_token !== token) {
            await updateUserFcmToken(currentUser.id, token);
          }
        }

        // Handle foreground messages
        onMessage(messagingInstance, (payload) => {
          console.log('Message received. ', payload);
          // Show a custom toast or notification UI here if desired
          if (payload.notification) {
            const { title, body } = payload.notification;
            // You can use your showToast function here if you export it or via a custom event
            const event = new CustomEvent('app-notification', { 
                detail: { title, message: body, type: 'info' } 
            });
            window.dispatchEvent(event);
          }
        });

      } catch (error) {
        console.error('Error setting up push notifications:', error);
      }
    };

    setupNotifications();
  }, [currentUser]);
}
