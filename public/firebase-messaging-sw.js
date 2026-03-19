/* eslint-disable no-undef */
// firebase-messaging-sw.js

// Give the service worker access to Firebase Messaging.
// Note that you can only use Firebase Messaging here, other Firebase libraries are not available in the service worker.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getMessaging, onBackgroundMessage } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-messaging-sw.js";

const firebaseConfig = {
  apiKey: "AIzaSyAPGTVjdJ3ymPe7cK42HVN-397fX4fPxIM",
  authDomain: "applicatieantigrav.firebaseapp.com",
  projectId: "applicatieantigrav",
  storageBucket: "applicatieantigrav.firebasestorage.app",
  messagingSenderId: "1087733351864",
  appId: "1:1087733351864:web:bdcb3464166d174e2a3b4d",
  measurementId: "G-S0ZKXHQJF7"
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

onBackgroundMessage(messaging, (payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  if (payload.notification) {
    const notificationTitle = payload.notification.title || 'KSA Notificatie';
    const notificationOptions = {
      body: payload.notification.body,
      icon: '/pwa-192x192.png'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  }
});
