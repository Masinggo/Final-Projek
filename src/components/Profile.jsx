// FR-02 (profil dan target) dan FR-03 (estimasi kebutuhan energi).
import { useState } from 'react';
import db, { dataErrorMessage } from '../lib/db.js';
import { ACTIVITY, validateProfile, maintenanceKcal, resolveTarget, fmtKkal, TARGET_SOURCE_LABEL } from '../lib/nutrition.js';
import { Alert, Disclaimer, Field } from './ui.jsx';

export default function Profile({ app }) {
  const { user, account, reloadAccount } = app;
  const p = account.profil || {};
  const [form, setForm] = useState({
    beratKg: p.beratKg ?? '',
    tinggiCm: p.tinggiCm ?? '',
    tglLahir: p.tglLahir ?? '',
    jenisKelamin: p.jenisKelamin ?? '',
    aktivitas: p.aktivitas ?? '',
    targetKkal: p.targetKkal ?? '',
  });
  const [errors, setErrors] = useState({});
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value.replace(',', '.') });

  // Estimasi memakai data yang tersimpan, bukan yang sedang diketik.
  const maint = maintenanceKcal(account.profil);
  const target = resolveTarget(account.profil);

  async function save(e) {
    e.preventDefault();
    setMsg(null);
    const v = validateProfile(form);
    setErrors(v.errors);
    if (!v.ok) return setMsg({ kind: 'error', text: 'Periksa kembali isian yang ditandai.' });
    setBusy(true);
    try {
      const profil = {};
      for (const [k, val] of Object.entries(form)) {
        if (val === '' || val == null) continue;
        profil[k] = ['beratKg', 'tinggiCm', 'targetKkal'].includes(k) ? Number(val) : val;
      }
      await db.saveProfile(user.uid, profil);
      await reloadAccount();
      setMsg({ kind: 'success', text: 'Profil tersimpan.' });
    } catch (err) {
      setMsg({ kind: 'error', text: dataErrorMessage(err) }); // isian tidak dihapus
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Profil</h1>
      <section className="card" aria-labelledby="h-estimasi">
        <h2 id="h-estimasi">Perkiraan kebutuhan energi</h2>
        {maint.available ? (
          <>
            <p style={{ fontSize: '1.4rem', margin: 0 }}>
              <strong>{fmtKkal(maint.value)} kkal</strong> <span className="muted">per hari (perkiraan)</span>
            </p>
            <p className="muted">
              Dihitung dengan rumus Mifflin-St Jeor dikali faktor aktivitas. Hasil aktual bisa berbeda dari perkiraan ini.
            </p>
          </>
        ) : (
          <Alert kind="info">{maint.reason}</Alert>
        )}
        <p className="muted">
          Target kalori yang dipakai: <strong>{fmtKkal(target.value)} kkal</strong>, dari {TARGET_SOURCE_LABEL[target.sumber]}.
        </p>
        <Disclaimer />
      </section>

      <form className="card" onSubmit={save} noValidate>
        <h2>Data diri</h2>
        <p className="muted">Akun: {account.email}. Estimasi hanya tersedia untuk usia 18 tahun ke atas.</p>
        {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
        <div className="grid2">
          <Field id="beratKg" label="Berat badan (kg)" error={errors.beratKg} hint="20 sampai 300 kg.">
            <input id="beratKg" inputMode="decimal" value={form.beratKg} onChange={set('beratKg')} />
          </Field>
          <Field id="tinggiCm" label="Tinggi badan (cm)" error={errors.tinggiCm} hint="100 sampai 250 cm.">
            <input id="tinggiCm" inputMode="decimal" value={form.tinggiCm} onChange={set('tinggiCm')} />
          </Field>
          <Field id="tglLahir" label="Tanggal lahir" error={errors.tglLahir}>
            <input id="tglLahir" type="date" value={form.tglLahir} onChange={(e) => setForm({ ...form, tglLahir: e.target.value })} />
          </Field>
          <Field id="jenisKelamin" label="Jenis kelamin biologis" hint="Hanya dipakai untuk rumus estimasi.">
            <select id="jenisKelamin" value={form.jenisKelamin} onChange={(e) => setForm({ ...form, jenisKelamin: e.target.value })}>
              <option value="">Pilih...</option>
              <option value="laki-laki">Laki-laki</option>
              <option value="perempuan">Perempuan</option>
            </select>
          </Field>
          <Field id="aktivitas" label="Tingkat aktivitas">
            <select id="aktivitas" value={form.aktivitas} onChange={(e) => setForm({ ...form, aktivitas: e.target.value })}>
              <option value="">Pilih...</option>
              {Object.entries(ACTIVITY).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </Field>
          <Field id="targetKkal" label="Target kalori pribadi (opsional)" error={errors.targetKkal} hint="Jika diisi, dipakai di seluruh aplikasi.">
            <input id="targetKkal" inputMode="numeric" value={form.targetKkal} onChange={set('targetKkal')} />
          </Field>
        </div>
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Menyimpan...' : 'Simpan profil'}</button>
      </form>

      <section className="card">
        <details>
          <summary>Kebijakan privasi singkat</summary>
          <p className="muted" style={{ marginTop: '0.5rem' }}>
            Data profil dan catatan makan hanya dapat dibaca oleh Anda dan admin pengelola. Foto makanan hanya dikirim ke layanan AI
            untuk dikenali dan tidak disimpan. Aplikasi ini tidak memberi diagnosis medis.
          </p>
        </details>
      </section>

      {db.mode === 'local' && account.role !== 'admin' && (
        <section className="card">
          <h3>Alat mode demo</h3>
          <p className="muted">Hanya ada di mode demo lokal: jadikan akun ini admin agar tab Admin dapat dicoba.</p>
          <button
            className="btn secondary small"
            onClick={async () => {
              await db.makeAdminDemo(user.uid);
              await reloadAccount();
            }}
          >
            Jadikan saya admin (demo)
          </button>
        </section>
      )}
    </>
  );
}
