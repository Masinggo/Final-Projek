// Pintu tunggal akses data. Tampilan hanya mengimpor `db` dari sini.
// Firebase dipakai jika konfigurasinya lengkap; selain itu mode demo lokal.
import { isFirebaseConfigured } from './firebase.js';
import firebaseDb from './firebaseDb.js';
import localDb from './localDb.js';

const db = isFirebaseConfigured ? firebaseDb : localDb;
export default db;

/** Pesan error autentikasi dalam bahasa Indonesia (KP-01.2). */
export function authErrorMessage(e) {
  switch (e?.code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email atau kata sandi salah.';
    case 'auth/email-already-in-use':
      return 'Email ini sudah terdaftar. Silakan masuk.';
    case 'auth/weak-password':
      return 'Kata sandi terlalu lemah. Gunakan minimal 6 karakter.';
    case 'auth/invalid-email':
      return 'Format email tidak valid.';
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan. Coba lagi beberapa saat lagi.';
    case 'auth/network-request-failed':
      return 'Koneksi gagal. Periksa jaringan Anda lalu coba lagi.';
    default:
      return 'Terjadi kesalahan. Coba lagi.';
  }
}

/** Pesan umum untuk kegagalan jaringan atau Firestore; input pengguna tidak dihapus (NFR-05). */
export function dataErrorMessage(e) {
  if (e?.code === 'permission-denied') return 'Anda tidak memiliki izin untuk tindakan ini.';
  return 'Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi. Data yang Anda isi tidak hilang.';
}
