// FR-10 (peninjauan), FR-11 (data pengelolaan), FR-14 (ringkasan AI). Hanya untuk role admin.
import { useEffect, useState } from 'react';
import db, { dataErrorMessage } from '../lib/db.js';
import { FOODS_SEED } from '../lib/foodsSeed.js';
import { fmtKkal, fmtGram } from '../lib/nutrition.js';
import { Alert, Field, NutrientBoxes } from './ui.jsx';

function PendingItem({ s, admin, onDone }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const stamp = () => ({ ditinjauOleh: admin.uid, ditinjauPada: new Date().toISOString() }); // KP-10.5

  async function approve() {
    setBusy(true);
    setError('');
    try {
      // KP-10.3: Setujui dan terbitkan -> masuk katalog bersama (basis 1 porsi)
      await db.saveFood({
        id: `sub-${s.id}`,
        nama: s.nama,
        kategori: s.kategori,
        basis: { jumlah: 1, satuan: 'porsi' },
        kkal: s.estimasiPerPorsi.kkal,
        proteinG: s.estimasiPerPorsi.proteinG,
        lemakG: s.estimasiPerPorsi.lemakG,
        karboG: s.estimasiPerPorsi.karboG,
        sumber: 'Pengajuan pengguna (disetujui admin)',
        status: 'aktif',
      });
      await db.updateSubmission(s.id, { status: 'Disetujui', alasan: '', ...stamp() });
      await onDone(true);
    } catch (e) {
      setError(dataErrorMessage(e));
      setBusy(false);
    }
  }
  async function requestFix() {
    if (!reason.trim()) return setError('Alasan wajib diisi untuk meminta perbaikan.'); // KP-10.4
    setBusy(true);
    setError('');
    try {
      await db.updateSubmission(s.id, { status: 'Perlu perbaikan', alasan: reason.trim(), ...stamp() });
      await onDone(false);
    } catch (e) {
      setError(dataErrorMessage(e));
      setBusy(false);
    }
  }

  return (
    <li>
      <h3>{s.nama}</h3>
      <p className="muted">Kategori {s.kategori} · resep untuk {fmtGram(s.porsi)} porsi</p>
      <div className="tablewrap">
        <table>
          <thead><tr><th>Bahan</th><th>Takaran</th></tr></thead>
          <tbody>{s.bahan.map((b, i) => <tr key={i}><td>{b.nama}</td><td>{fmtGram(b.jumlah)} {b.satuan}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="muted" style={{ marginTop: '0.5rem' }}>Estimasi gizi per porsi (perkiraan):</p>
      <NutrientBoxes nilai={s.estimasiPerPorsi} />
      {error && <Alert kind="error">{error}</Alert>}
      <Field id={`alasan-${s.id}`} label="Alasan (wajib jika meminta perbaikan)">
        <textarea id={`alasan-${s.id}`} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <div className="row">
        <button className="btn" disabled={busy} onClick={approve}>Setujui dan terbitkan</button>
        <button className="btn secondary" disabled={busy} onClick={requestFix}>Minta perbaikan</button>
      </div>
    </li>
  );
}

export default function Admin({ app }) {
  const { user, reloadFoods } = app;
  const [pending, setPending] = useState([]);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [recs, setRecs] = useState([]);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const [p, u, l, r] = await Promise.all([db.listSubmissionsByStatus('Menunggu'), db.listUsers(), db.listAllLogs(), db.listRecognitions()]);
      setPending(p); setUsers(u); setLogs(l); setRecs(r);
    } catch (e) {
      setMsg({ kind: 'error', text: dataErrorMessage(e) });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line

  async function seed() {
    try {
      await db.seedFoods(FOODS_SEED);
      await reloadFoods();
      setMsg({ kind: 'success', text: `Katalog awal diisi: ${FOODS_SEED.length} makanan. Pastikan nilai gizinya sudah diverifikasi ke TKPI 2017.` });
    } catch (e) {
      setMsg({ kind: 'error', text: dataErrorMessage(e) });
    }
  }

  const emailOf = (uid) => users.find((u) => u.id === uid)?.email || uid;
  const count = (k) => recs.filter((r) => r.keputusan === k).length; // KP-14.3

  if (loading) return <p>Memuat...</p>;
  return (
    <>
      <h1>Admin</h1>
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}

      <section className="card" aria-labelledby="h-tinjau">
        <h2 id="h-tinjau">Pengajuan menunggu ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="muted">Tidak ada pengajuan yang menunggu.</p>
        ) : (
          <ul className="list">
            {pending.map((s) => (
              <PendingItem
                key={s.id}
                s={s}
                admin={user}
                onDone={async (approved) => {
                  if (approved) await reloadFoods();
                  setMsg({ kind: 'success', text: approved ? `"${s.nama}" disetujui dan masuk katalog.` : `Permintaan perbaikan untuk "${s.nama}" dikirim.` });
                  await load();
                }}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="card" aria-labelledby="h-ai">
        <h2 id="h-ai">Ringkasan pengenalan AI</h2>
        <div className="tablewrap">
          <table>
            <thead><tr><th>Keputusan pengguna</th><th>Jumlah</th></tr></thead>
            <tbody>
              <tr><td>Dikonfirmasi (kandidat teratas dipilih)</td><td>{count('dikonfirmasi')}</td></tr>
              <tr><td>Diganti (kandidat lain atau cari manual)</td><td>{count('diganti')}</td></tr>
              <tr><td>Tidak dikenali</td><td>{count('tidak dikenali')}</td></tr>
              <tr><th>Total pengenalan</th><th>{recs.length}</th></tr>
            </tbody>
          </table>
        </div>
        <p className="note" style={{ marginTop: '0.6rem' }}>
          Ini ukuran pemakaian nyata, bukan akurasi pada set uji. Akurasi top-1 dan top-3 dihitung dari set uji foto tim (lihat README).
        </p>
      </section>

      <section className="card" aria-labelledby="h-katalog">
        <h2 id="h-katalog">Katalog</h2>
        <p className="muted">Isi atau perbarui katalog awal ({FOODS_SEED.length} makanan) dari <code>src/lib/foodsSeed.js</code>. Aman dijalankan berulang.</p>
        <button className="btn secondary" onClick={seed}>Isi katalog awal</button>
      </section>

      <section className="card" aria-labelledby="h-user">
        <h2 id="h-user">Pengguna ({users.length})</h2>
        <div className="tablewrap">
          <table>
            <thead><tr><th>Email</th><th>Role</th><th>Berat/Tinggi</th><th>Target</th><th>Catatan</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{u.profil?.beratKg ? `${u.profil.beratKg} kg / ${u.profil.tinggiCm ?? '-'} cm` : '-'}</td>
                  <td>{u.profil?.targetKkal ? `${fmtKkal(u.profil.targetKkal)} kkal` : '-'}</td>
                  <td>{logs.filter((l) => l.uid === u.id).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card" aria-labelledby="h-log">
        <h2 id="h-log">Catatan makan terbaru</h2>
        {logs.length === 0 ? (
          <p className="muted">Belum ada catatan.</p>
        ) : (
          <div className="tablewrap">
            <table>
              <thead><tr><th>Tanggal</th><th>Pengguna</th><th>Makanan</th><th>Jumlah</th><th>kkal</th></tr></thead>
              <tbody>
                {[...logs].reverse().slice(0, 30).map((l) => (
                  <tr key={l.id}>
                    <td>{l.tanggal}</td>
                    <td>{emailOf(l.uid)}</td>
                    <td>{l.namaMakanan}</td>
                    <td>{fmtGram(l.jumlah)} {l.satuan}</td>
                    <td>{fmtKkal(l.nilai.kkal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
