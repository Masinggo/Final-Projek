// FR-08 (buat dan ajukan makanan dari bahan katalog) dan FR-09 (status pengajuan).
import { useEffect, useMemo, useState } from 'react';
import db, { dataErrorMessage } from '../lib/db.js';
import { CATEGORIES, perPortion, validateJumlah, fmtKkal, fmtGram } from '../lib/nutrition.js';
import { Alert, Field, NutrientBoxes, SubmissionBadge } from './ui.jsx';

const emptyIng = () => ({ foodId: '', jumlah: '' });

export default function Submit({ app }) {
  const { user, foods } = app;
  // Bahan hanya makanan bersatuan gram atau mililiter (KP-08.1)
  const ingredientFoods = useMemo(() => foods.filter((f) => f.status === 'aktif' && ['g', 'ml'].includes(f.basis.satuan)), [foods]);
  const byId = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);

  const [nama, setNama] = useState('');
  const [kategori, setKategori] = useState('Lauk');
  const [porsi, setPorsi] = useState('1');
  const [ings, setIngs] = useState([emptyIng()]);
  const [editingId, setEditingId] = useState(null);
  const [errors, setErrors] = useState([]);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mine, setMine] = useState([]);

  const loadMine = () => db.listMySubmissions(user.uid).then(setMine).catch(() => {});
  useEffect(() => { loadMine(); }, []); // eslint-disable-line

  // Validasi (KP-08.3)
  function validate() {
    const errs = [];
    if (!nama.trim()) errs.push('Nama makanan wajib diisi.');
    const p = Number(porsi);
    if (!Number.isFinite(p) || p <= 0) errs.push('Jumlah porsi resep harus bilangan positif.');
    const filled = ings.filter((i) => i.foodId || i.jumlah);
    if (filled.length === 0) errs.push('Tambahkan minimal satu bahan.');
    filled.forEach((i, idx) => {
      if (!i.foodId) errs.push(`Bahan ${idx + 1}: pilih bahan dari katalog.`);
      const jm = validateJumlah(i.jumlah);
      if (jm) errs.push(`Bahan ${idx + 1}: ${jm}`);
    });
    return { errs, filled };
  }

  // Estimasi per porsi diperbarui seketika saat input berubah (KP-08.2)
  const estimate = useMemo(() => {
    const p = Number(porsi);
    const filled = ings.filter((i) => i.foodId && !validateJumlah(i.jumlah));
    if (!Number.isFinite(p) || p <= 0 || filled.length === 0) return null;
    return perPortion(filled.map((i) => ({ food: byId.get(i.foodId), jumlah: Number(i.jumlah) })), p);
  }, [ings, porsi, byId]);

  function reset() {
    setNama(''); setKategori('Lauk'); setPorsi('1'); setIngs([emptyIng()]); setEditingId(null); setErrors([]);
  }

  async function submit(e) {
    e.preventDefault();
    setMsg(null);
    const { errs, filled } = validate();
    setErrors(errs);
    if (errs.length) return; // pengajuan tidak terkirim
    setBusy(true);
    const payload = {
      nama: nama.trim(),
      kategori,
      porsi: Number(porsi),
      bahan: filled.map((i) => ({ foodId: i.foodId, nama: byId.get(i.foodId).nama, jumlah: Number(i.jumlah), satuan: byId.get(i.foodId).basis.satuan })),
      estimasiPerPorsi: estimate,
    };
    try {
      if (editingId) {
        // KP-09.3: perbaiki dan kirim ulang -> kembali ke Menunggu
        await db.updateSubmission(editingId, { ...payload, status: 'Menunggu', alasan: '' });
        setMsg({ kind: 'success', text: 'Pengajuan diperbaiki dan dikirim ulang. Statusnya kembali Menunggu.' });
      } else {
        await db.addSubmission({ ...payload, uid: user.uid, status: 'Menunggu', dibuatPada: new Date().toISOString() }); // KP-08.4
        setMsg({ kind: 'success', text: 'Pengajuan terkirim dengan status Menunggu. Makanan baru masuk katalog setelah disetujui admin.' });
      }
      reset();
      await loadMine();
    } catch (err) {
      setMsg({ kind: 'error', text: dataErrorMessage(err) }); // isian tetap ada
    } finally {
      setBusy(false);
    }
  }

  function loadForFix(s) {
    setEditingId(s.id);
    setNama(s.nama);
    setKategori(s.kategori);
    setPorsi(String(s.porsi));
    setIngs(s.bahan.map((b) => ({ foodId: b.foodId, jumlah: String(b.jumlah) })));
    setErrors([]);
    setMsg(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const setIng = (idx, patch) => setIngs(ings.map((x, i) => (i === idx ? { ...x, ...patch } : x)));

  return (
    <>
      <h1>Ajukan makanan baru</h1>
      <p className="muted">Susun makanan dari bahan yang sudah ada di katalog. Admin akan meninjau sebelum makanan masuk katalog bersama.</p>
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}

      <form className="card" onSubmit={submit} noValidate>
        <h2>{editingId ? 'Perbaiki pengajuan' : 'Data makanan'}</h2>
        {errors.length > 0 && (
          <Alert kind="error">
            <strong>Pengajuan belum terkirim:</strong>
            <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1.2rem' }}>{errors.map((m) => <li key={m}>{m}</li>)}</ul>
          </Alert>
        )}
        <div className="grid2">
          <Field id="nama" label="Nama makanan"><input id="nama" value={nama} onChange={(e) => setNama(e.target.value)} /></Field>
          <Field id="kategori" label="Kategori">
            <select id="kategori" value={kategori} onChange={(e) => setKategori(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field id="porsi" label="Jumlah porsi resep" hint="Resep ini menghasilkan berapa porsi?">
            <input id="porsi" inputMode="decimal" value={porsi} onChange={(e) => setPorsi(e.target.value.replace(',', '.'))} />
          </Field>
        </div>

        <h3>Bahan (dari katalog)</h3>
        {ings.map((ing, idx) => {
          const f = byId.get(ing.foodId);
          return (
            <div className="ing-row" key={idx}>
              <div>
                <label className="sr-only" htmlFor={`bahan-${idx}`}>Bahan {idx + 1}</label>
                <select id={`bahan-${idx}`} value={ing.foodId} onChange={(e) => setIng(idx, { foodId: e.target.value })}>
                  <option value="">Pilih bahan...</option>
                  {ingredientFoods.map((x) => <option key={x.id} value={x.id}>{x.nama}</option>)}
                </select>
              </div>
              <div>
                <label className="sr-only" htmlFor={`jml-${idx}`}>Jumlah bahan {idx + 1} ({f ? f.basis.satuan : 'g atau ml'})</label>
                <input id={`jml-${idx}`} inputMode="decimal" placeholder={f ? f.basis.satuan : 'g / ml'} value={ing.jumlah} onChange={(e) => setIng(idx, { jumlah: e.target.value.replace(',', '.') })} />
              </div>
              <button type="button" className="btn danger small" aria-label={`Hapus bahan ${idx + 1}`} disabled={ings.length === 1} onClick={() => setIngs(ings.filter((_, i) => i !== idx))}>×</button>
            </div>
          );
        })}
        <button type="button" className="btn secondary small" onClick={() => setIngs([...ings, emptyIng()])}>+ Tambah bahan</button>

        <h3 style={{ marginTop: '1rem' }}>Estimasi per porsi (perkiraan)</h3>
        {estimate ? <NutrientBoxes nilai={estimate} /> : <p className="muted">Isi bahan dan jumlah yang valid untuk melihat estimasi.</p>}

        <div className="row">
          <button className="btn" type="submit" disabled={busy}>{busy ? 'Mengirim...' : editingId ? 'Kirim ulang' : 'Kirim pengajuan'}</button>
          {editingId && <button type="button" className="btn secondary" onClick={reset}>Batal perbaikan</button>}
        </div>
      </form>

      <section className="card" aria-labelledby="h-saya">
        <h2 id="h-saya">Pengajuan saya</h2>
        {mine.length === 0 ? (
          <p className="muted">Belum ada pengajuan.</p>
        ) : (
          <ul className="list">
            {mine.map((s) => (
              <li key={s.id}>
                <div className="spread">
                  <span><strong>{s.nama}</strong> <span className="muted">· {s.kategori} · {fmtGram(s.porsi)} porsi · ±{fmtKkal(s.estimasiPerPorsi.kkal)} kkal/porsi</span></span>
                  <SubmissionBadge status={s.status} />
                </div>
                {s.status === 'Perlu perbaikan' && (
                  <>
                    <Alert kind="warn"><strong>Alasan admin:</strong> {s.alasan}</Alert>
                    <button className="btn small" onClick={() => loadForFix(s)}>Perbaiki dan kirim ulang</button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
