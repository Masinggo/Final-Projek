// Fungsi server Vercel: POST /api/recognize
//
// Alur: peramban kirim foto (sudah dikecilkan) -> fungsi ini memeriksa login pengguna
// -> memanggil model vision -> mengembalikan maksimal 3 kandidat dari katalog.
// Kunci API model hanya ada di sini (variabel environment), tidak pernah ke peramban.
// Foto TIDAK disimpan; hanya diteruskan ke penyedia model lalu dibuang (NFR-10).
import { parseCandidates, buildPrompt } from '../server/parseCandidates.js';

const MAX_IMAGE_CHARS = 3_500_000; // batas body Vercel 4,5 MB; foto dikecilkan di peramban
const MAX_CLASSES = 100;
const RATE_LIMIT = 20; // permintaan per pengguna per menit (per instance server, upaya terbaik)
const hits = new Map();

function rateLimited(uid) {
  const now = Date.now();
  const arr = (hits.get(uid) || []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(uid, arr);
  return arr.length > RATE_LIMIT;
}

/** Verifikasi token Firebase tanpa admin SDK, lewat endpoint publik Identity Toolkit. */
async function verifyFirebaseToken(idToken) {
  const apiKey = process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY;
  if (!apiKey || !idToken) return null;
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!r.ok) return null;
  const data = await r.json();
  return data?.users?.[0]?.localId || null;
}

async function askGemini(prompt, mime, b64) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY belum diisi');
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const init = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: b64 } }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    }),
  };
  // Tiap panggilan dibatasi 15 detik dan dicoba maksimal 2 kali (total < 35 detik, di bawah batas fungsi 45 detik).
  let r;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      r = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
    } catch (e) {
      if (attempt === 1) throw new Error('Gemini terlalu lama menjawab (timeout)');
      continue;
    }
    if (r.ok || ![429, 500, 503].includes(r.status)) break;
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (!r.ok) throw new Error(`Gemini ${r.status}`);
  const data = await r.json();
  return data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
}

async function askAnthropic(prompt, mime, b64) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY belum diisi');
  const model = process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model,
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } },
            { type: 'text', text: prompt },
          ],
        },
      ],
    }),
  });
  if (!r.ok) throw new Error(`Anthropic ${r.status}`);
  const data = await r.json();
  return data?.content?.map((c) => c.text || '').join('') || '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metode tidak diizinkan.' });

  // 1) Hanya pengguna yang sudah masuk
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const uid = await verifyFirebaseToken(token).catch(() => null);
  if (!uid) return res.status(401).json({ error: 'Silakan masuk terlebih dahulu.' });
  if (rateLimited(uid)) return res.status(429).json({ error: 'Terlalu banyak permintaan. Coba lagi sebentar lagi.' });

  // 2) Validasi masukan (KP-13.2): hanya gambar, dan tidak melebihi batas
  const { image, classes } = req.body || {};
  const m = typeof image === 'string' ? image.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/) : null;
  if (!m) return res.status(400).json({ error: 'Berkas harus berupa gambar JPG, PNG, atau WebP.' });
  if (image.length > MAX_IMAGE_CHARS) return res.status(413).json({ error: 'Ukuran gambar terlalu besar.' });
  if (!Array.isArray(classes) || classes.length === 0 || classes.length > MAX_CLASSES)
    return res.status(400).json({ error: 'Daftar makanan tidak valid.' });
  const safe = classes
    .filter((c) => typeof c?.id === 'string' && typeof c?.nama === 'string')
    .map((c) => ({ id: c.id.slice(0, 80), nama: c.nama.slice(0, 80) }));
  if (safe.length === 0) return res.status(400).json({ error: 'Daftar makanan tidak valid.' });

  // 3) Tanya model vision
  try {
    const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
    const prompt = buildPrompt(safe);
    const [, mime, b64] = m;
    const text = provider === 'anthropic' ? await askAnthropic(prompt, mime, b64) : await askGemini(prompt, mime, b64);
    const kandidat = parseCandidates(text, safe.map((c) => c.id), 3);
    return res.status(200).json({ kandidat });
  } catch (e) {
    console.error('recognize gagal:', e?.message);
    // Detail teknis hanya dikirim saat dijalankan lokal (bukan di Vercel), untuk memudahkan pencarian masalah.
    const detail = process.env.VERCEL ? undefined : e?.message;
    return res.status(502).json({ error: 'Layanan pengenalan sedang tidak tersedia. Gunakan pencarian manual.', detail });
  }
}
