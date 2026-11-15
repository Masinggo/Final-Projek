// FR-01: daftar dan masuk dengan email + kata sandi.
import { useState } from 'react';
import db, { authErrorMessage } from '../lib/db.js';
import { Alert, Field } from './ui.jsx';

export default function Auth() {
  const [mode, setMode] = useState('masuk'); // 'masuk' | 'daftar'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Format email tidak valid.');
    if (password.length < 6) return setError('Kata sandi minimal 6 karakter.');
    setBusy(true);
    try {
      if (mode === 'masuk') await db.signIn(email.trim(), password);
      else await db.signUp(email.trim(), password);
    } catch (err) {
      setError(authErrorMessage(err)); // KP-01.2: pesan jelas tanpa membuka data apa pun
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 440 }}>
      <h1>Pemantau Gizi</h1>
      <p className="muted">Catat makanan dan pantau perkiraan asupan kalori harian Anda.</p>
      {db.mode === 'local' && (
        <Alert kind="warn">
          <strong>Mode demo.</strong> Firebase belum dikonfigurasi, jadi data hanya tersimpan di peramban ini dan tidak aman untuk data
          sungguhan.
        </Alert>
      )}
      <form className="card" onSubmit={submit} noValidate>
        <h2>{mode === 'masuk' ? 'Masuk' : 'Daftar akun baru'}</h2>
        {error && <Alert kind="error">{error}</Alert>}
        <Field id="email" label="Email">
          <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field id="password" label="Kata sandi" hint="Minimal 6 karakter.">
          <input
            id="password"
            type="password"
            autoComplete={mode === 'masuk' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <div className="row">
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Memproses...' : mode === 'masuk' ? 'Masuk' : 'Daftar'}
          </button>
          <button
            className="btn secondary"
            type="button"
            onClick={() => {
              setMode(mode === 'masuk' ? 'daftar' : 'masuk');
              setError('');
            }}
          >
            {mode === 'masuk' ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}
          </button>
        </div>
      </form>
    </main>
  );
}
