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

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Analytics & Messaging conditionally for SSR/Environment compatibility
export const analytics = isAnalyticsSupported().then(yes => yes ? getAnalytics(app) : null);
export const messaging = isMessagingSupported().then(yes => yes ? getMessaging(app) : null);

export default app;
