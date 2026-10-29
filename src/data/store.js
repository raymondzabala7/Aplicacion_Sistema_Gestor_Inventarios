import { createLocalStore } from './local-store.js';
import { createFirestoreStore } from './firestore-store.js';

// Con las variables VITE_FIREBASE_* en .env.local se usa Firestore; sin ellas, la demo local.
export function createStore() {
  return import.meta.env.VITE_FIREBASE_PROJECT_ID ? createFirestoreStore() : createLocalStore();
}
