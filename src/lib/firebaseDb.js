// Adapter data berbasis Firebase (Authentication + Cloud Firestore).
// Antarmuka fungsinya HARUS sama dengan localDb.js, supaya tampilan tidak peduli
// data disimpan di mana. Hak akses sebenarnya ditegakkan oleh firestore.rules.
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getFirebase } from './firebase.js';

const fs = () => getFirebase().firestore;
const au = () => getFirebase().auth;

/** Firestore menolak nilai undefined, jadi buang dulu. */
const clean = (obj) => JSON.parse(JSON.stringify(obj));
const withId = (d) => ({ id: d.id, ...d.data() });
const byCreated = (a, b) => String(a.dibuatPada).localeCompare(String(b.dibuatPada));
const toUser = (u) => (u ? { uid: u.uid, email: u.email } : null);

const firebaseDb = {
  mode: 'firebase',

  // ------------------------------------------------------------ autentikasi
  onAuth(cb) {
    return onAuthStateChanged(au(), (u) => cb(toUser(u)));
  },
  async signUp(email, password) {
    const cred = await createUserWithEmailAndPassword(au(), email, password);
    await firebaseDb.ensureUserDoc(toUser(cred.user));
    return toUser(cred.user);
  },
  async signIn(email, password) {
    const cred = await signInWithEmailAndPassword(au(), email, password);
    return toUser(cred.user);
  },
  signOut: () => fbSignOut(au()),
  async getIdToken() {
    return au().currentUser ? au().currentUser.getIdToken() : null;
  },

  // ------------------------------------------------------------ akun / profil
  /** Pastikan dokumen users/{uid} ada (KP-01.4: akun lama tanpa profil). Role selalu 'user'. */
  async ensureUserDoc(user) {
    const ref = doc(fs(), 'users', user.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) return { id: snap.id, ...snap.data() };
    const data = { email: user.email, role: 'user', profil: {}, dibuatPada: new Date().toISOString() };
    await setDoc(ref, data);
    return { id: user.uid, ...data };
  },
  /** Simpan profil saja; role tidak pernah dikirim sehingga tidak berubah. */
  async saveProfile(uid, profil) {
    await updateDoc(doc(fs(), 'users', uid), { profil: clean(profil) });
  },
  async listUsers() {
    const snap = await getDocs(collection(fs(), 'users'));
    return snap.docs.map(withId);
  },

  // ------------------------------------------------------------ katalog
  async listFoods() {
    const snap = await getDocs(collection(fs(), 'foods'));
    return snap.docs.map(withId).filter((f) => f.status === 'aktif');
  },
  /** Hanya admin (aturan Firestore). Id tetap, sehingga aman dijalankan berulang. */
  async saveFood(food) {
    const { id, ...rest } = food;
    await setDoc(doc(fs(), 'foods', id), clean(rest));
    return id;
  },
  async seedFoods(foods) {
    const batch = writeBatch(fs());
    for (const { id, ...rest } of foods) batch.set(doc(fs(), 'foods', id), clean(rest));
    await batch.commit();
  },

  // ------------------------------------------------------------ catatan makan
  // Query hanya memakai satu filter (uid) supaya tidak perlu membuat indeks komposit.
  async listLogs(uid) {
    const snap = await getDocs(query(collection(fs(), 'logs'), where('uid', '==', uid)));
    return snap.docs.map(withId).sort(byCreated);
  },
  async listAllLogs() {
    const snap = await getDocs(collection(fs(), 'logs'));
    return snap.docs.map(withId).sort(byCreated);
  },
  async addLog(log) {
    const ref = await addDoc(collection(fs(), 'logs'), clean(log));
    return ref.id;
  },
  async updateLog(id, patch) {
    await updateDoc(doc(fs(), 'logs', id), clean(patch));
  },
  async deleteLog(id) {
    await deleteDoc(doc(fs(), 'logs', id));
  },

  // ------------------------------------------------------------ pengajuan
  async addSubmission(sub) {
    const ref = await addDoc(collection(fs(), 'submissions'), clean(sub));
    return ref.id;
  },
  async updateSubmission(id, patch) {
    await updateDoc(doc(fs(), 'submissions', id), clean(patch));
  },
  async listMySubmissions(uid) {
    const snap = await getDocs(query(collection(fs(), 'submissions'), where('uid', '==', uid)));
    return snap.docs.map(withId).sort(byCreated).reverse();
  },
  async listSubmissionsByStatus(status) {
    const snap = await getDocs(query(collection(fs(), 'submissions'), where('status', '==', status)));
    return snap.docs.map(withId).sort(byCreated);
  },

  // ------------------------------------------------------------ hasil pengenalan AI
  async addRecognition(rec) {
    const ref = await addDoc(collection(fs(), 'recognitions'), clean(rec));
    return ref.id;
  },
  async listRecognitions() {
    const snap = await getDocs(collection(fs(), 'recognitions'));
    return snap.docs.map(withId).sort(byCreated);
  },
};

export default firebaseDb;
