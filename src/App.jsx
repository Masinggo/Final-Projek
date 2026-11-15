// Kerangka aplikasi: gerbang login (KP-01.3), tab navigasi, dan data bersama.
import { useCallback, useEffect, useState } from 'react';
import db, { dataErrorMessage } from './lib/db.js';
import Auth from './components/Auth.jsx';
import Home from './components/Home.jsx';
import Log from './components/Log.jsx';
import History from './components/History.jsx';
import Submit from './components/Submit.jsx';
import Profile from './components/Profile.jsx';
import Admin from './components/Admin.jsx';
import { Alert } from './components/ui.jsx';

const TABS = [
  ['beranda', 'Beranda'],
  ['catat', 'Catat'],
  ['riwayat', 'Riwayat'],
  ['ajukan', 'Ajukan'],
  ['profil', 'Profil'],
];

export default function App() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [account, setAccount] = useState(null);
  const [foods, setFoods] = useState([]);
  const [logs, setLogs] = useState([]);
  const [tab, setTab] = useState('beranda');
  const [loadError, setLoadError] = useState('');

  useEffect(
    () =>
      db.onAuth(async (u) => {
        setUser(u);
        if (!u) {
          setAccount(null);
          setFoods([]);
          setLogs([]);
          setTab('beranda');
          setReady(true);
          return;
        }
        try {
          const acc = await db.ensureUserDoc(u); // KP-01.4: akun lama tanpa profil tetap bisa masuk
          const [f, l] = await Promise.all([db.listFoods(), db.listLogs(u.uid)]);
          setAccount(acc);
          setFoods(f);
          setLogs(l);
          setLoadError('');
        } catch (e) {
          setLoadError(dataErrorMessage(e));
        }
        setReady(true);
      }),
    [],
  );

  const reloadLogs = useCallback(async () => setLogs(await db.listLogs(user.uid)), [user]);
  const reloadFoods = useCallback(async () => setFoods(await db.listFoods()), []);
  const reloadAccount = useCallback(async () => setAccount(await db.ensureUserDoc(user)), [user]);

  if (!ready) return <p style={{ padding: '1rem' }}>Memuat...</p>;
  if (!user) return <Auth />; // KP-01.3
  if (!account) {
    return (
      <main>
        <Alert kind="error">{loadError || 'Memuat akun...'}</Alert>
        <button className="btn secondary" onClick={() => db.signOut()}>Keluar</button>
      </main>
    );
  }

  const isAdmin = account.role === 'admin'; // KP-10.1: tab Admin hanya untuk admin
  const tabs = isAdmin ? [...TABS, ['admin', 'Admin']] : TABS;
  const app = { user, account, foods, logs, reloadLogs, reloadFoods, reloadAccount, goTab: setTab };

  return (
    <>
      <header className="app-header">
        <span className="brand">Pemantau Gizi</span>
        <span className="who">
          {db.mode === 'local' && <span title="Data hanya di peramban ini">Mode demo</span>}
          <span>{account.email}</span>
          <button className="btn secondary small" onClick={() => db.signOut()}>Keluar</button>
        </span>
      </header>
      <nav className="tabs" aria-label="Menu utama">
        {tabs.map(([key, label]) => (
          <button key={key} aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </nav>
      <main>
        {loadError && <Alert kind="error">{loadError}</Alert>}
        {tab === 'beranda' && <Home app={app} />}
        {tab === 'catat' && <Log app={app} />}
        {tab === 'riwayat' && <History app={app} />}
        {tab === 'ajukan' && <Submit app={app} />}
        {tab === 'profil' && <Profile app={app} />}
        {tab === 'admin' && isAdmin && <Admin app={app} />}
      </main>
    </>
  );
}
