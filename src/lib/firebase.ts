import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
} as const;

const requiredConfigKeys = Object.keys(firebaseConfig) as Array<keyof typeof firebaseConfig>;

export function isFirebaseConfigured() {
  return requiredConfigKeys.every((key) => Boolean(firebaseConfig[key]));
}

export function getFirebaseConfigError() {
  if (isFirebaseConfigured()) {
    return '';
  }

  const missing = requiredConfigKeys.filter((key) => !firebaseConfig[key]);
  return `Firebase is not configured. Add ${missing.join(', ')} to your Vite environment.`;
}

export function getFirebaseApp() {
  if (!isFirebaseConfigured()) {
    throw new Error(getFirebaseConfigError());
  }

  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export function getFirebaseAuth() {
  return getAuth(getFirebaseApp());
}

export function getFirestoreDb() {
  return getFirestore(getFirebaseApp());
}
