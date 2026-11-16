// Sisi peramban untuk pengenalan makanan dari foto (FR-13).
import db from './db.js';

export const MAX_BYTES = 5 * 1024 * 1024; // 5 MB (KP-13.1, usulan)
export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const CONFIDENCE_THRESHOLD = 0.5; // di bawah ini = "tidak dikenali" (KP-13.6, usulan)

/** Pemeriksaan berkas sebelum dikirim ke mana pun (KP-13.2). Mengembalikan pesan atau null. */
export function validateImageFile(file) {
  if (!file) return 'Pilih foto terlebih dahulu.';
  if (!ALLOWED_TYPES.includes(file.type)) return 'Berkas harus berupa gambar JPG, PNG, atau WebP.';
  if (file.size > MAX_BYTES) return 'Ukuran foto melebihi 5 MB. Pilih foto yang lebih kecil.';
  return null;
}

/** Kecilkan foto ke sisi terpanjang 1024 px dan ubah ke JPEG, agar kiriman ringan dan cepat. */
export function downscaleToJpegDataUrl(file, maxSide = 1024, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Foto tidak dapat dibaca.'));
    };
    img.src = url;
  });
}

/** True bila pengenalan hanya disimulasikan (mode demo atau VITE_AI_MODE=mock). */
export const isSimulatedAI = () => db.mode === 'local' || import.meta.env.VITE_AI_MODE === 'mock';

/**
 * SIMULASI untuk demo tanpa server AI: memilih 3 makanan dari katalog secara deterministik
 * dari nama dan ukuran berkas. BUKAN hasil pengenalan sungguhan; antarmuka menandainya.
 */
function simulate(file, foods) {
  let h = 7;
  for (const ch of `${file.name}|${file.size}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const pool = foods.filter((f) => f.status === 'aktif');
  const picks = [];
  for (let i = 0; i < Math.min(3, pool.length); i++) {
    const idx = (h + i * 7) % pool.length;
    const f = pool.find((x, j) => j >= idx && !picks.includes(x)) || pool.find((x) => !picks.includes(x));
    picks.push(f);
  }
  const base = [0.62, 0.21, 0.09];
  return picks.map((f, i) => ({ id: f.id, keyakinan: base[i] }));
}

/**
 * Kenali makanan dari foto. Mengembalikan { kandidat:[{food, keyakinan}], simulated }.
 * Foto tidak disimpan di mana pun (NFR-10).
 */
export async function recognizeFood(file, foods) {
  const active = foods.filter((f) => f.status === 'aktif');
  let raw;
  const simulated = isSimulatedAI();
  if (simulated) {
    await new Promise((r) => setTimeout(r, 900)); // meniru waktu tunggu jaringan
    raw = simulate(file, active);
  } else {
    const image = await downscaleToJpegDataUrl(file);
    const token = await db.getIdToken();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 50_000); // server boleh mencoba ulang saat Gemini sibuk
    try {
      const res = await fetch('/api/recognize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ image, classes: active.map((f) => ({ id: f.id, nama: f.nama })) }),
        signal: ctrl.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data?.error || 'Pengenalan gagal.') + (data?.detail ? ` [${data.detail}]` : ''));
      raw = data.kandidat || [];
    } catch (e) {
      if (e?.name === 'AbortError' || /abort/i.test(e?.message || '')) {
        throw new Error('Layanan AI terlalu lama menjawab (kemungkinan sedang sibuk). Coba lagi sebentar lagi. Gunakan pencarian manual.');
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }
  const byId = new Map(active.map((f) => [f.id, f]));
  const kandidat = raw
    .filter((c) => byId.has(c.id)) // hanya makanan katalog (KP-13.3)
    .map((c) => ({ food: byId.get(c.id), keyakinan: c.keyakinan }))
    .sort((a, b) => b.keyakinan - a.keyakinan)
    .slice(0, 3);
  return { kandidat, simulated };
}
