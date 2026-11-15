// Inisialisasi Firebase. Konfigurasi dibaca dari variabel environment (NFR-01):
// jangan menulis kunci langsung di kode. Salin .env.example menjadi .env.
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** True jika konfigurasi Firebase lengkap dan mode demo lokal tidak dipaksa. */
export const isFirebaseConfigured =
  import.meta.env.VITE_USE_LOCAL !== 'true' &&
  Boolean(cfg.apiKey && cfg.projectId && cfg.appId && cfg.authDomain);

let services = null;
export function getFirebase() {
  if (!services) {
    const app = initializeApp(cfg);
    services = { app, auth: getAuth(app), firestore: getFirestore(app) };
  }
  return services;
}
