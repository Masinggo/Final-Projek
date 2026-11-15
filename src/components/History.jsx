// FR-07: grafik 7 hari, ubah jumlah, dan hapus catatan.
import { useState } from 'react';
import db, { dataErrorMessage } from '../lib/db.js';
import { lastNDays, sumNutrients, resolveTarget, validateJumlah, rescaleLogValues, fmtKkal, fmtGram, todayStr } from '../lib/nutrition.js';
import { Alert, BarChart } from './ui.jsx';

const dayLabel = (d) => `${d.slice(8)}/${d.slice(5, 7)}`;
const longDay = (d) =>
  new Date(`${d}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });

function LogItem({ log, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [jumlah, setJumlah] = useState(String(log.jumlah));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function saveEdit() {
    const problem = validateJumlah(jumlah);
    if (problem) return setError(problem);
    setBusy(true);
    try {
      // KP-07.2: nilai dihitung ulang dari snapshot nilai catatan itu sendiri
      const n = Number(jumlah);
      await db.updateLog(log.id, { jumlah: n, nilai: rescaleLogValues(log.nilai, log.jumlah, n) });
      setEditing(false);
      setError('');
      await onChanged();
    } catch (e) {
      setError(dataErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      await db.deleteLog(log.id); // KP-07.3
      await onChanged();
    } catch (e) {
      setError(dataErrorMessage(e));
      setBusy(false);
    }
  }

  return (
    <li>
      <div className="spread">
        <span>
          {log.namaMakanan}{' '}
          <span className="muted">
            ({fmtGram(log.jumlah)} {log.satuan}
            {log.sumberInput === 'foto' ? ', dari foto' : ''})
          </span>
        </span>
        <strong>{fmtKkal(log.nilai.kkal)} kkal</strong>
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      {editing ? (
        <div className="row" style={{ marginTop: '0.4rem' }}>
          <label className="sr-only" htmlFor={`j-${log.id}`}>Jumlah baru ({log.satuan})</label>
          <input id={`j-${log.id}`} style={{ width: 120 }} inputMode="decimal" value={jumlah} onChange={(e) => setJumlah(e.target.value.replace(',', '.'))} />
          <span className="muted">{log.satuan}</span>
          <button className="btn small" disabled={busy} onClick={saveEdit}>Simpan</button>
          <button className="btn secondary small" onClick={() => { setEditing(false); setError(''); setJumlah(String(log.jumlah)); }}>Batal</button>
        </div>
      ) : confirming ? (
        <div className="row" style={{ marginTop: '0.4rem' }}>
          <span>Hapus catatan ini?</span>
          <button className="btn danger small" disabled={busy} onClick={remove}>Ya, hapus</button>
          <button className="btn secondary small" onClick={() => setConfirming(false)}>Batal</button>
        </div>
      ) : (
        <div className="row" style={{ marginTop: '0.4rem' }}>
          <button className="btn secondary small" onClick={() => setEditing(true)}>Ubah jumlah</button>
          <button className="btn danger small" onClick={() => setConfirming(true)}>Hapus</button>
        </div>
      )}
    </li>
  );
}

export default function History({ app }) {
  const { account, logs, reloadLogs } = app;
  const days = lastNDays(7, todayStr());
  const target = resolveTarget(account.profil).value;
  // Hari tanpa catatan bernilai 0 (KP-07.1)
  const data = days.map((d) => ({
    label: dayLabel(d),
    value: sumNutrients(logs.filter((l) => l.tanggal === d).map((l) => l.nilai)).kkal,
  }));
  const shown = [...days].reverse().filter((d) => logs.some((l) => l.tanggal === d));

  return (
    <>
      <h1>Riwayat 7 hari</h1>
      <section className="card" aria-labelledby="h-grafik">
        <h2 id="h-grafik">Kalori per hari</h2>
        <BarChart data={data} target={target} />
        <p className="note">Batang oranye berarti melebihi target. Hari tanpa catatan bernilai 0. Semua angka adalah perkiraan.</p>
      </section>

      <section className="card" aria-labelledby="h-catatan">
        <h2 id="h-catatan">Catatan makan</h2>
        {shown.length === 0 ? (
          <p className="muted">Belum ada catatan dalam 7 hari terakhir.</p>
        ) : (
          shown.map((d) => {
            const dayLogs = logs.filter((l) => l.tanggal === d);
            const total = sumNutrients(dayLogs.map((l) => l.nilai)).kkal;
            return (
              <div key={d} style={{ marginBottom: '1rem' }}>
                <h3>
                  {longDay(d)} <span className="muted">· {fmtKkal(total)} kkal</span>
                </h3>
                <ul className="list">
                  {dayLogs.map((l) => (
                    <LogItem key={l.id} log={l} onChanged={reloadLogs} />
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </section>
    </>
  );
}
