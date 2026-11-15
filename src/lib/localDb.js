// Adapter data MODE DEMO: semua data disimpan di localStorage peramban ini saja.
// Dipakai saat Firebase belum dikonfigurasi, untuk demo cepat dan pengujian.
// Antarmuka fungsinya sama persis dengan firebaseDb.js.
//
// PERINGATAN: ini bukan untuk data sungguhan. Tidak ada keamanan server di sini.
import { FOODS_SEED } from './foodsSeed.js';

const KEY = 'pemantau-gizi-demo-v1';
const listeners = new Set();

const uuid = () =>
  globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const byCreated = (a, b) => String(a.dibuatPada).localeCompare(String(b.dibuatPada));

function load() {
  let s = null;
  try {
    s = JSON.parse(localStorage.getItem(KEY));
  } catch {
    s = null;
  }
  if (!s) {
    s = { session: null, users: {}, foods: FOODS_SEED.map((f) => ({ ...f })), logs: [], submissions: [], recognitions: [] };
    save(s);
  }
  return s;
}
function save(s) {
  localStorage.setItem(KEY, JSON.stringify(s));
}
const sessionUser = (s) =>
  s.session && s.users[s.session] ? { uid: s.session, email: s.users[s.session].email } : null;
const notify = () => {
  const u = sessionUser(load());
  listeners.forEach((cb) => cb(u));
};
const err = (code) => Object.assign(new Error(code), { code });

async function hash(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const localDb = {
  mode: 'local',

  // ------------------------------------------------------------ autentikasi
  onAuth(cb) {
    listeners.add(cb);
    Promise.resolve().then(() => cb(sessionUser(load())));
    return () => listeners.delete(cb);
  },
  async signUp(email, password) {
    if (!/^\S+@\S+\.\S+$/.test(email)) throw err('auth/invalid-email');
    if (password.length < 6) throw err('auth/weak-password');
    const s = load();
    if (Object.values(s.users).some((u) => u.email === email)) throw err('auth/email-already-in-use');
    const uid = uuid();
    s.users[uid] = { email, pw: await hash(password), role: 'user', profil: {}, dibuatPada: new Date().toISOString() };
    s.session = uid;
    save(s);
    notify();
    return { uid, email };
  },
  async signIn(email, password) {
    const s = load();
    const entry = Object.entries(s.users).find(([, u]) => u.email === email);
    if (!entry || entry[1].pw !== (await hash(password))) throw err('auth/invalid-credential');
    s.session = entry[0];
    save(s);
    notify();
    return { uid: entry[0], email };
  },
  async signOut() {
    const s = load();
    s.session = null;
    save(s);
    notify();
  },
  async getIdToken() {
    return null;
  },

  // ------------------------------------------------------------ akun / profil
  async ensureUserDoc(user) {
    const u = load().users[user.uid];
    return { id: user.uid, email: u.email, role: u.role, profil: u.profil || {}, dibuatPada: u.dibuatPada };
  },
  async saveProfile(uid, profil) {
    const s = load();
    s.users[uid].profil = profil;
    save(s);
  },
  async listUsers() {
    const s = load();
    return Object.entries(s.users).map(([id, u]) => ({ id, email: u.email, role: u.role, profil: u.profil, dibuatPada: u.dibuatPada }));
  },
  /** Khusus mode demo: jadikan akun ini admin supaya panel Admin dapat dicoba. */
  async makeAdminDemo(uid) {
    const s = load();
    s.users[uid].role = 'admin';
    save(s);
  },

  // ------------------------------------------------------------ katalog
  async listFoods() {
    return load().foods.filter((f) => f.status === 'aktif');
  },
  async saveFood(food) {
    const s = load();
    const i = s.foods.findIndex((f) => f.id === food.id);
    if (i >= 0) s.foods[i] = food;
    else s.foods.push(food);
    save(s);
    return food.id;
  },
  async seedFoods(foods) {
    const s = load();
    for (const food of foods) {
      const i = s.foods.findIndex((f) => f.id === food.id);
      if (i >= 0) s.foods[i] = { ...food };
      else s.foods.push({ ...food });
    }
    save(s);
  },

  // ------------------------------------------------------------ catatan makan
  async listLogs(uid) {
    return load().logs.filter((l) => l.uid === uid).sort(byCreated);
  },
  async listAllLogs() {
    return [...load().logs].sort(byCreated);
  },
  async addLog(log) {
    const s = load();
    const id = uuid();
    s.logs.push({ id, ...log });
    save(s);
    return id;
  },
  async updateLog(id, patch) {
    const s = load();
    const l = s.logs.find((x) => x.id === id);
    Object.assign(l, patch);
    save(s);
  },
  async deleteLog(id) {
    const s = load();
    s.logs = s.logs.filter((l) => l.id !== id);
    save(s);
  },

  // ------------------------------------------------------------ pengajuan
  async addSubmission(sub) {
    const s = load();
    const id = uuid();
    s.submissions.push({ id, ...sub });
    save(s);
    return id;
  },
  async updateSubmission(id, patch) {
    const s = load();
    const x = s.submissions.find((q) => q.id === id);
    Object.assign(x, patch);
    // Firestore menghapus field bila diganti undefined; samakan perilakunya.
    for (const k of Object.keys(x)) if (x[k] === undefined) delete x[k];
    save(s);
  },
  async listMySubmissions(uid) {
    return load().submissions.filter((q) => q.uid === uid).sort(byCreated).reverse();
  },
  async listSubmissionsByStatus(status) {
    return load().submissions.filter((q) => q.status === status).sort(byCreated);
  },

  // ------------------------------------------------------------ hasil pengenalan AI
  async addRecognition(rec) {
    const s = load();
    const id = uuid();
    s.recognitions.push({ id, ...rec });
    save(s);
    return id;
  },
  async listRecognitions() {
    return [...load().recognitions].sort(byCreated);
  },
};

export default localDb;
