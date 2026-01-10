
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import { getMessaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyAfv3SjVOWJCbS-RB_cuHKSrQ0uv4kJ__s",
  authDomain: "rizqdaan.firebaseapp.com",
  projectId: "rizqdaan",
  storageBucket: "rizqdaan.firebasestorage.app",
  messagingSenderId: "6770003964",
  appId: "1:6770003964:web:3e47e1d4e4ba724c446c79"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
});

const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Messaging setup (Browser environment check)
const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;

export const isFirebaseConfigured = () => !!firebaseConfig.apiKey;
export { auth, db, googleProvider, messaging };
