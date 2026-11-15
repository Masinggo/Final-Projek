// =====================================================================
// Logika hitung gizi (PRD bagian 8). Fungsi di sini MURNI: tidak menyentuh
// tampilan, database, atau jam sistem, sehingga mudah diuji otomatis (NFR-06).
// =====================================================================

export const NUTRIENTS = ['kkal', 'proteinG', 'lemakG', 'karboG'];

// Faktor energi: protein dan karbohidrat 4 kkal/g, lemak 9 kkal/g.
export const KCAL_PER_GRAM = { proteinG: 4, karboG: 4, lemakG: 9 };

// Tingkat aktivitas dan faktornya (usulan PRD, perlu verifikasi).
export const ACTIVITY = {
  sangat_ringan: { label: 'Sangat ringan (hampir tidak berolahraga)', faktor: 1.2 },
  ringan: { label: 'Ringan (olahraga 1-3 hari per minggu)', faktor: 1.375 },
  sedang: { label: 'Sedang (olahraga 3-5 hari per minggu)', faktor: 1.55 },
  berat: { label: 'Berat (olahraga 6-7 hari per minggu)', faktor: 1.725 },
};

// Rentang acuan makro dalam persen energi, dewasa (AMDR).
export const AMDR = {
  proteinG: { label: 'Protein', min: 10, max: 35 },
  lemakG: { label: 'Lemak', min: 20, max: 35 },
  karboG: { label: 'Karbohidrat', min: 45, max: 65 },
};

// Batas wajar input (usulan PRD KP-02.1 dan KP-05.2).
export const LIMITS = {
  beratKg: [20, 300],
  tinggiCm: [100, 250],
  jumlah: [1, 5000],
  targetKkal: [1, 10000],
};

export const DEFAULT_TARGET_KKAL = 2000;
export const MIN_ADULT_AGE = 18;

// ---------------------------------------------------------------- tanggal
const pad = (n) => String(n).padStart(2, '0');

/** Tanggal lokal format YYYY-MM-DD (bukan UTC, supaya tidak meleset di zona WIB/WITA). */
export function dateStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export const todayStr = () => dateStr(new Date());

/** Daftar n tanggal berakhir di `end` (termasuk), urut dari yang terlama. */
export function lastNDays(n, end = todayStr()) {
  const [y, m, d] = end.split('-').map(Number);
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(dateStr(new Date(y, m - 1, d - i)));
  return out;
}

/** Usia (tahun penuh) dari tanggal lahir YYYY-MM-DD terhadap `today`. */
export function ageFromBirth(tglLahir, today = new Date()) {
  const [y, m, d] = String(tglLahir).split('-').map(Number);
  if (!y || !m || !d) return null;
  let age = today.getFullYear() - y;
  const hadBirthday =
    today.getMonth() + 1 > m || (today.getMonth() + 1 === m && today.getDate() >= d);
  if (!hadBirthday) age -= 1;
  return age;
}

// ---------------------------------------------------------------- pembulatan
/** Kalori ke bilangan bulat. */
export const roundKkal = (n) => Math.round(n);
/** Gram ke satu desimal. */
export const roundGram = (n) => Math.round(n * 10) / 10;

const nf0 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
export const fmtKkal = (n) => nf0.format(roundKkal(n));
export const fmtGram = (n) => nf1.format(roundGram(n));

// ---------------------------------------------------------------- nilai gizi
export const emptyNutrients = () => ({ kkal: 0, proteinG: 0, lemakG: 0, karboG: 0 });

/**
 * Nilai gizi untuk jumlah `a` dari sebuah makanan.
 * food: { basis: { jumlah, satuan }, kkal, proteinG, lemakG, karboG }
 * Rumus: nilai = nilai basis x a / basis.jumlah. TIDAK dibulatkan di sini.
 */
export function scaleNutrients(food, jumlah) {
  const faktor = Number(jumlah) / food.basis.jumlah;
  const out = {};
  for (const k of NUTRIENTS) out[k] = (Number(food[k]) || 0) * faktor;
  return out;
}

/** Jumlahkan banyak objek nilai gizi (pada nilai yang belum dibulatkan). */
export function sumNutrients(list) {
  const total = emptyNutrients();
  for (const n of list) for (const k of NUTRIENTS) total[k] += Number(n?.[k]) || 0;
  return total;
}

/** Hitung ulang nilai catatan saat jumlah diubah, dari snapshot nilai lamanya (KP-07.2). */
export function rescaleLogValues(oldNilai, oldJumlah, newJumlah) {
  const faktor = Number(newJumlah) / Number(oldJumlah);
  const out = {};
  for (const k of NUTRIENTS) out[k] = (Number(oldNilai[k]) || 0) * faktor;
  return out;
}

/** Estimasi per porsi resep = jumlah nilai semua bahan / jumlah porsi (KP-08.2). */
export function perPortion(ingredients, porsi) {
  const total = sumNutrients(
    ingredients.map((ing) => scaleNutrients(ing.food, ing.jumlah)),
  );
  const out = {};
  for (const k of NUTRIENTS) out[k] = total[k] / Number(porsi);
  return out;
}

// ---------------------------------------------------------------- makro
/** Energi (kkal) yang berasal dari tiga makro. */
export function macroEnergy(total) {
  return (
    total.proteinG * KCAL_PER_GRAM.proteinG +
    total.karboG * KCAL_PER_GRAM.karboG +
    total.lemakG * KCAL_PER_GRAM.lemakG
  );
}

export const STATUS = {
  none: 'Belum ada catatan',
  below: 'Di bawah rentang',
  within: 'Dalam rentang',
  above: 'Di atas rentang',
};

/**
 * Rincian makro: gram, persen energi, rentang acuan, dan status TEKS (KP-06.2).
 * Jika belum ada catatan, status "Belum ada catatan" dan tidak ada pembagian nol (KP-06.3).
 */
export function macroBreakdown(total, hasLogs = true) {
  const energy = macroEnergy(total);
  return ['proteinG', 'lemakG', 'karboG'].map((key) => {
    const { label, min, max } = AMDR[key];
    const gram = total[key];
    if (!hasLogs || energy <= 0) {
      return { key, label, gram, persen: null, min, max, status: STATUS.none };
    }
    const persen = (gram * KCAL_PER_GRAM[key] / energy) * 100;
    const status = persen < min ? STATUS.below : persen > max ? STATUS.above : STATUS.within;
    return { key, label, gram, persen, min, max, status };
  });
}

// ---------------------------------------------------------------- validasi
const isNum = (v) => v !== '' && v !== null && v !== undefined && Number.isFinite(Number(v));

/** Validasi jumlah makanan (KP-05.2). Mengembalikan pesan error atau null. */
export function validateJumlah(v) {
  const [min, max] = LIMITS.jumlah;
  if (!isNum(v)) return 'Jumlah harus berupa angka.';
  const n = Number(v);
  if (n <= 0) return 'Jumlah harus lebih dari 0.';
  if (n < min || n > max) return `Jumlah harus antara ${min} dan ${max}.`;
  return null;
}

/**
 * Validasi profil (KP-02.1, KP-02.2). Field boleh kosong; jika diisi harus valid.
 * Mengembalikan { ok, errors: { field: pesan } }.
 */
export function validateProfile(p, today = new Date()) {
  const errors = {};
  const range = (key, label, unit) => {
    if (p[key] === '' || p[key] == null) return;
    const [min, max] = LIMITS[key];
    if (!isNum(p[key]) || Number(p[key]) <= 0) errors[key] = `${label} harus bilangan positif.`;
    else if (Number(p[key]) < min || Number(p[key]) > max)
      errors[key] = `${label} harus antara ${min} dan ${max} ${unit}.`;
  };
  range('beratKg', 'Berat badan', 'kg');
  range('tinggiCm', 'Tinggi badan', 'cm');
  if (p.tglLahir) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.tglLahir) || ageFromBirth(p.tglLahir, today) === null) {
      errors.tglLahir = 'Tanggal lahir tidak valid.';
    } else if (p.tglLahir > dateStr(today)) {
      errors.tglLahir = 'Tanggal lahir tidak boleh di masa depan.';
    }
  }
  if (p.targetKkal !== '' && p.targetKkal != null) {
    const [, max] = LIMITS.targetKkal;
    if (!isNum(p.targetKkal) || Number(p.targetKkal) <= 0)
      errors.targetKkal = 'Target kalori harus bilangan positif.';
    else if (Number(p.targetKkal) > max) errors.targetKkal = `Target kalori maksimal ${max} kkal.`;
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

// ---------------------------------------------------------------- energi
/**
 * Estimasi energi pemeliharaan (Mifflin-St Jeor x faktor aktivitas), FR-03.
 * Hanya tersedia jika usia >= 18 dan berat, tinggi, tanggal lahir, jenis kelamin,
 * dan aktivitas terisi. Jika tidak, mengembalikan alasan (KP-03.2), bukan angka.
 */
export function maintenanceKcal(profil = {}, today = new Date()) {
  const missing = [];
  if (!isNum(profil.beratKg)) missing.push('berat badan');
  if (!isNum(profil.tinggiCm)) missing.push('tinggi badan');
  if (!profil.tglLahir) missing.push('tanggal lahir');
  if (!profil.jenisKelamin) missing.push('jenis kelamin');
  if (!profil.aktivitas || !ACTIVITY[profil.aktivitas]) missing.push('tingkat aktivitas');
  if (missing.length) {
    return { available: false, reason: `Lengkapi ${missing.join(', ')} untuk melihat estimasi.` };
  }
  const age = ageFromBirth(profil.tglLahir, today);
  if (age === null || age < MIN_ADULT_AGE) {
    return {
      available: false,
      reason: `Estimasi kebutuhan energi hanya tersedia untuk usia ${MIN_ADULT_AGE} tahun ke atas.`,
    };
  }
  const base =
    10 * Number(profil.beratKg) +
    6.25 * Number(profil.tinggiCm) -
    5 * age +
    (profil.jenisKelamin === 'laki-laki' ? 5 : -161);
  return { available: true, value: Math.round(base * ACTIVITY[profil.aktivitas].faktor), age };
}

/**
 * Target kalori yang dipakai di seluruh aplikasi (KP-02.3):
 * target pribadi > perkiraan pemeliharaan > nilai bawaan 2000 kkal.
 */
export function resolveTarget(profil = {}, today = new Date()) {
  if (isNum(profil.targetKkal) && Number(profil.targetKkal) > 0) {
    return { value: Number(profil.targetKkal), sumber: 'pribadi' };
  }
  const m = maintenanceKcal(profil, today);
  if (m.available) return { value: m.value, sumber: 'perkiraan' };
  return { value: DEFAULT_TARGET_KKAL, sumber: 'bawaan' };
}

export const TARGET_SOURCE_LABEL = {
  pribadi: 'target pribadi Anda',
  perkiraan: 'perkiraan kebutuhan energi pemeliharaan',
  bawaan: 'nilai bawaan 2000 kkal (lengkapi profil untuk estimasi yang lebih sesuai)',
};

// ---------------------------------------------------------------- pencarian
/** Pencarian makanan: tidak peka huruf besar-kecil, cocok sebagian nama (KP-04.1/04.2/04.4). */
export function searchFoods(foods, query = '', kategori = 'Semua') {
  const q = query.trim().toLowerCase();
  return foods.filter(
    (f) =>
      f.status === 'aktif' &&
      (kategori === 'Semua' || f.kategori === kategori) &&
      (q === '' || f.nama.toLowerCase().includes(q)),
  );
}

export const CATEGORIES = ['Pokok', 'Lauk', 'Sayur', 'Camilan', 'Minuman'];
