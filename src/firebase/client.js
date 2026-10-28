import { getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const requiredConfig = ['apiKey', 'authDomain', 'projectId', 'appId'];

export function initializeFirebase() {
  const missing = requiredConfig.filter(key => !config[key]);
  if (missing.length) {
    throw new Error(`Falta configurar Firebase: ${missing.join(', ')}.`);
  }

  const app = getApps().find(existing => existing.name === '[DEFAULT]')
    ?? initializeApp(config);

  return {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
  };
}
