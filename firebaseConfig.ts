
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, initializeFirestore, terminate } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAfv3SjVOWJCbS-RB_cuHKSrQ0uv4kJ__s",
  authDomain: "rizqdaan.firebaseapp.com",
  projectId: "rizqdaan",
  storageBucket: "rizqdaan.firebasestorage.app",
  messagingSenderId: "6770003964",
  appId: "1:6770003964:web:3e47e1d4e4ba724c446c79"
};

// 1. Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

/**
 * FIX: Firestore Connectivity Error
 * Using Long Polling and disabling fetch streams ensures 
 * stability in mobile environments where WebSockets are flaky.
 */
const db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    useFetchStreams: false
});

const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export const isFirebaseConfigured = () => !!firebaseConfig.apiKey;

console.log("Firebase initialized with stable mobile settings.");

export { auth, db, googleProvider };
