// FR-04 (cari makanan), FR-05 (catat), FR-13 (pengenalan dari foto).
import { useEffect, useMemo, useRef, useState } from 'react';
import db, { dataErrorMessage } from '../lib/db.js';
import {
  CATEGORIES,
  searchFoods,
  scaleNutrients,
  validateJumlah,
  todayStr,
  fmtKkal,
  fmtGram,
} from '../lib/nutrition.js';
import { validateImageFile, recognizeFood, isSimulatedAI, CONFIDENCE_THRESHOLD } from '../lib/ai.js';
import { Alert, Disclaimer, Field, NutrientBoxes } from './ui.jsx';

// ------------------------------------------------------------------ form jumlah (KP-05.1, KP-05.2)
function EntryForm({ food, busy, onSave, onCancel }) {
  const [jumlah, setJumlah] = useState(String(food.basis.jumlah));
  const [touched, setTouched] = useState(false);
  const error = validateJumlah(jumlah);
  const preview = error ? null : scaleNutrients(food, jumlah);

  return (
    <form
      className="card"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (!error) onSave(Number(jumlah));
      }}
    >
      <h2>{food.nama}</h2>
      <p className="muted">
        Nilai gizi per {food.basis.jumlah} {food.basis.satuan}. Sumber: {food.sumber || '-'}
      </p>
      <Field id="jumlah" label={`Jumlah (${food.basis.satuan})`} error={touched || jumlah !== String(food.basis.jumlah) ? error : null} hint="Isi angka antara 1 dan 5000.">
        <input
          id="jumlah"
          inputMode="decimal"
          value={jumlah}
          onChange={(e) => setJumlah(e.target.value.replace(',', '.'))}
          aria-describedby="jumlah-err"
        />
      </Field>
      <h3>Perkiraan gizi</h3>
      {preview ? <NutrientBoxes nilai={preview} /> : <p className="muted">Isi jumlah yang valid untuk melihat perkiraan.</p>}
      <div className="row">
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Menyimpan...' : 'Simpan catatan'}
        </button>
        <button className="btn secondary" type="button" onClick={onCancel}>
          Batal
        </button>
      </div>
    </form>
  );
}

// ------------------------------------------------------------------ pencarian manual (FR-04)
function ManualSearch({ foods, onPick, goTab }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('Semua');
  const results = useMemo(() => searchFoods(foods, q, cat), [foods, q, cat]);

  return (
    <section className="card" aria-labelledby="h-cari">
      <h2 id="h-cari">Cari makanan</h2>
      <Field id="cari" label="Nama makanan">
        <input id="cari" type="search" placeholder="Contoh: nasi, ayam, tempe" value={q} onChange={(e) => setQ(e.target.value)} />
      </Field>
      <div className="chips" role="group" aria-label="Filter kategori">
        {['Semua', ...CATEGORIES].map((c) => (
          <button key={c} className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>
      {results.length === 0 ? (
        <Alert kind="info">
          Makanan tidak ditemukan.{' '}
          <button className="btn secondary small" onClick={() => goTab('ajukan')}>
            Ajukan makanan baru
          </button>
        </Alert>
      ) : (
        <ul className="list" aria-label="Hasil pencarian">
          {results.map((f) => (
            <li key={f.id}>
              <button className="food-btn" onClick={() => onPick(f)}>
                <span>
                  {f.nama} <span className="muted">· {f.kategori}</span>
                </span>
                <span className="muted">
                  {fmtKkal(f.kkal)} kkal / {f.basis.jumlah} {f.basis.satuan}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ foto + AI (FR-13)
function PhotoRecognizer({ app, onPick, goManual }) {
  const { foods, user, goTab } = app;
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [state, setState] = useState('idle'); // idle | loading | done | error
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const urlRef = useRef('');

  useEffect(() => () => urlRef.current && URL.revokeObjectURL(urlRef.current), []);

  async function onFile(e) {
    const f = e.target.files?.[0];
    setResult(null);
    setError('');
    const problem = validateImageFile(f); // KP-13.2: berkas salah ditolak sebelum dikirim
    if (problem) {
      setFile(null);
      setPreviewUrl('');
      setState('error');
      setError(problem);
      return;
    }
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = URL.createObjectURL(f);
    setFile(f);
    setPreviewUrl(urlRef.current);
    setState('loading');
    try {
      const res = await recognizeFood(f, foods);
      const top = res.kandidat[0];
      const low = !top || top.keyakinan < CONFIDENCE_THRESHOLD;
      setResult({ ...res, low });
      setState('done');
      if (low) {
        // KP-14.2: catat keputusan "tidak dikenali" (tanpa foto)
        db.addRecognition({
          uid: user.uid,
          tanggal: todayStr(),
          kandidat: res.kandidat.map((c) => ({ foodId: c.food.id, keyakinan: c.keyakinan })),
          keputusan: 'tidak dikenali',
          logId: null,
          dibuatPada: new Date().toISOString(),
        }).catch(() => {});
      }
    } catch (err) {
      // KP-13.7: gagal -> arahkan ke pencarian manual, yang tetap tersedia penuh
      setState('error');
      setError(`${err?.message || 'Pengenalan gagal.'} Gunakan pencarian manual.`);
    }
  }

  function choose(c, index) {
    onPick(c.food, {
      kandidat: result.kandidat.map((k) => ({ foodId: k.food.id, keyakinan: k.keyakinan })),
      keputusan: index === 0 ? 'dikonfirmasi' : 'diganti',
    });
  }

  function noneMatch() {
    db.addRecognition({
      uid: user.uid,
      tanggal: todayStr(),
      kandidat: result.kandidat.map((k) => ({ foodId: k.food.id, keyakinan: k.keyakinan })),
      keputusan: 'diganti', // pengguna mengganti hasil AI dengan pencarian manual
      logId: null,
      dibuatPada: new Date().toISOString(),
    }).catch(() => {});
    goManual();
  }

  return (
    <section className="card" aria-labelledby="h-foto">
      <h2 id="h-foto">Catat dengan foto (AI)</h2>
      {isSimulatedAI() && (
        <Alert kind="warn">
          <strong>Mode simulasi AI.</strong> Hasil di bawah dipilih otomatis dari katalog dan <strong>bukan</strong> pengenalan sungguhan.
          Hubungkan penyedia AI di server untuk pengenalan nyata.
        </Alert>
      )}
      <p className="muted">
        Ambil foto makanan atau unggah berkas (JPG, PNG, WebP, maksimal 5 MB). Foto dipakai hanya untuk dikenali dan <strong>tidak
        disimpan</strong>.
      </p>
      <Field id="foto" label="Foto makanan">
        <input id="foto" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={onFile} />
      </Field>

      {previewUrl && <img className="photo-preview" src={previewUrl} alt="Foto makanan yang dipilih" />}
      {state === 'loading' && <Alert kind="info">Mengenali makanan...</Alert>}
      {state === 'error' && <Alert kind="error">{error}</Alert>}

      {state === 'done' && result && result.low && (
        <Alert kind="warn">
          <strong>Makanan tidak dikenali.</strong> Keyakinan terlalu rendah atau tidak ada kandidat yang cocok di katalog.
          <div className="row" style={{ marginTop: '0.5rem' }}>
            <button className="btn small" onClick={goManual}>Cari manual</button>
            <button className="btn secondary small" onClick={() => goTab('ajukan')}>Ajukan makanan baru</button>
          </div>
        </Alert>
      )}

      {state === 'done' && result && !result.low && (
        <>
          <h3>Perkiraan makanan di foto</h3>
          <p className="muted">Pengenalan dapat keliru. Pilih yang paling sesuai; tidak ada yang tersimpan sebelum Anda mengonfirmasi.</p>
          <div>
            {result.kandidat.map((c, i) => (
              <div className="cand" key={c.food.id}>
                <span>
                  <strong>{c.food.nama}</strong> <span className="muted">· keyakinan perkiraan {Math.round(c.keyakinan * 100)}%</span>
                </span>
                <button className="btn small" onClick={() => choose(c, i)}>
                  Pilih
                </button>
              </div>
            ))}
          </div>
          <div className="row" style={{ marginTop: '0.5rem' }}>
            <button className="btn secondary small" onClick={noneMatch}>
              Tidak ada yang cocok, cari manual
            </button>
          </div>
        </>
      )}
      <Disclaimer />
    </section>
  );
}

// ------------------------------------------------------------------ layar Catat
export default function Log({ app }) {
  const { user, foods, reloadLogs, goTab } = app;
  const [mode, setMode] = useState('cari'); // 'cari' | 'foto'
  const [sel, setSel] = useState(null); // { food, sumber, recog? }
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function save(jumlah) {
    setBusy(true);
    setMsg(null);
    const now = new Date().toISOString();
    try {
      const logId = await db.addLog({
        uid: user.uid,
        tanggal: todayStr(), // KP-05.3
        foodId: sel.food.id,
        namaMakanan: sel.food.nama,
        jumlah,
        satuan: sel.food.basis.satuan,
        nilai: scaleNutrients(sel.food, jumlah), // KP-05.4: salinan nilai saat pencatatan
        sumberInput: sel.sumber, // 'manual' | 'foto'
        dibuatPada: now,
      });
      if (sel.recog) {
        try {
          await db.addRecognition({
            uid: user.uid,
            tanggal: todayStr(),
            kandidat: sel.recog.kandidat,
            keputusan: sel.recog.keputusan,
            logId,
            dibuatPada: now,
          });
        } catch {
          /* catatan sudah tersimpan; gagal mencatat statistik AI tidak boleh membatalkannya */
        }
      }
      await reloadLogs();
      setMsg({
        kind: 'success',
        text: `Tersimpan: ${sel.food.nama}, ${fmtGram(jumlah)} ${sel.food.basis.satuan} (sekitar ${fmtKkal(scaleNutrients(sel.food, jumlah).kkal)} kkal).`,
      });
      setSel(null);
    } catch (e) {
      setMsg({ kind: 'error', text: dataErrorMessage(e) }); // NFR-05: input tidak hilang
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Catat makanan</h1>
      {msg && (
        <Alert kind={msg.kind}>
          {msg.text}{' '}
          {msg.kind === 'success' && (
            <button className="btn secondary small" onClick={() => goTab('beranda')}>
              Lihat ringkasan
            </button>
          )}
        </Alert>
      )}

      {sel ? (
        <EntryForm food={sel.food} busy={busy} onSave={save} onCancel={() => setSel(null)} />
      ) : (
        <>
          <div className="chips" role="group" aria-label="Cara mencatat">
            <button className="chip" aria-pressed={mode === 'cari'} onClick={() => setMode('cari')}>
              Cari makanan
            </button>
            <button className="chip" aria-pressed={mode === 'foto'} onClick={() => setMode('foto')}>
              Foto (AI)
            </button>
          </div>
          {mode === 'cari' ? (
            <ManualSearch foods={foods} goTab={goTab} onPick={(food) => { setMsg(null); setSel({ food, sumber: 'manual' }); }} />
          ) : (
            <PhotoRecognizer
              app={app}
              goManual={() => setMode('cari')}
              onPick={(food, recog) => { setMsg(null); setSel({ food, sumber: 'foto', recog }); }}
            />
          )}
        </>
      )}
    </>
  );
}
