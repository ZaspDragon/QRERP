import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyAnAhzrwU1w4ecGQ90oaRMJRi9YbcDq8vU',
  authDomain: 'warehouseflows-3df45.firebaseapp.com',
  projectId: 'warehouseflows-3df45',
  storageBucket: 'warehouseflows-3df45.firebasestorage.app',
  messagingSenderId: '704540642853',
  appId: '1:704540642853:web:b7af28fc8b0d34c5d1f9cc',
  measurementId: 'G-PJ95J468WZ',
} as const;

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export function isFirebaseConfigured() {
  return true;
}

export function getFirebaseConfigError() {
  return '';
}

export function getFirebaseApp() {
  return app;
}

export function getFirebaseAuth() {
  return auth;
}

export function getFirestoreDb() {
  return db;
}
