import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported as isAnalyticsSupported } from "firebase/analytics";
import { getMessaging, isSupported as isMessagingSupported } from "firebase/messaging";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY, 
  authDomain: "applicatieantigrav.firebaseapp.com",
  projectId: "applicatieantigrav",
  storageBucket: "applicatieantigrav.firebasestorage.app",
  messagingSenderId: "1087733351864",
  appId: "1:1087733351864:web:bdcb3464166d174e2a3b4d",
  measurementId: "G-S0ZKXHQJF7"
};

// Zonder VITE_FIREBASE_API_KEY (bv. lokaal) slaan we Firebase over: geen push/analytics, geen console-fouten
const app = firebaseConfig.apiKey ? initializeApp(firebaseConfig) : null;

// Initialize Analytics & Messaging conditionally for SSR/Environment compatibility
export const analytics = app ? isAnalyticsSupported().then(yes => yes ? getAnalytics(app) : null) : Promise.resolve(null);
export const messaging = app ? isMessagingSupported().then(yes => yes ? getMessaging(app) : null) : Promise.resolve(null);

export default app;
