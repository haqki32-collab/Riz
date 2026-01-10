
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAfv3SjVOWJCbS-RB_cuHKSrQ0uv4kJ__s",
  authDomain: "rizqdaan.firebaseapp.com",
  projectId: "rizqdaan",
  storageBucket: "rizqdaan.firebasestorage.app",
  messagingSenderId: "6770003964",
  appId: "1:6770003964:web:3e47e1d4e4ba724c446c79"
};

// 1. Initialize App immediately
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// 2. Initialize Services synchronously to avoid "not registered" errors
// Using initializeFirestore with specific settings for mobile stability
const db = initializeFirestore(app, {
    experimentalForceLongPolling: true
});

const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export const isFirebaseConfigured = () => !!firebaseConfig.apiKey;

console.log("Firebase initialized for project:", firebaseConfig.projectId);

export { auth, db, googleProvider };
