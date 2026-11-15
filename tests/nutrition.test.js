import { describe, it, expect } from 'vitest';
import {
  scaleNutrients,
  sumNutrients,
  perPortion,
  macroBreakdown,
  maintenanceKcal,
  resolveTarget,
  validateJumlah,
  validateProfile,
  ageFromBirth,
  lastNDays,
  rescaleLogValues,
  roundKkal,
  roundGram,
  searchFoods,
  STATUS,
} from '../src/lib/nutrition.js';
import { FOODS_SEED } from '../src/lib/foodsSeed.js';

const food100 = { basis: { jumlah: 100, satuan: 'g' }, kkal: 200, proteinG: 10, lemakG: 5, karboG: 30 };

describe('Nilai gizi makanan (PRD bagian 8)', () => {
  it('150 g makanan basis 100 g bernilai 200 kkal menghasilkan 300 kkal', () => {
    expect(scaleNutrients(food100, 150).kkal).toBe(300);
  });
  it('basis 1 porsi: 2 porsi menggandakan nilai', () => {
    const f = { basis: { jumlah: 1, satuan: 'porsi' }, kkal: 300, proteinG: 15, lemakG: 15, karboG: 25 };
    expect(scaleNutrients(f, 2).kkal).toBe(600);
  });
  it('penjumlahan memakai nilai belum dibulatkan, pembulatan hanya di tampilan', () => {
    const a = { kkal: 0.4, proteinG: 0.04, lemakG: 0, karboG: 0 };
    const total = sumNutrients([a, a, a]);
    expect(roundKkal(total.kkal)).toBe(1); // 1,2 -> 1 (bukan 0+0+0)
    expect(roundGram(total.proteinG)).toBe(0.1);
  });
  it('pembulatan: kalori bulat, gram satu desimal', () => {
    expect(roundKkal(299.5)).toBe(300);
    expect(roundGram(12.345)).toBe(12.3);
  });
});

describe('Estimasi per porsi resep', () => {
  it('3 bahan total 900 kkal untuk 3 porsi menghasilkan 300 kkal per porsi', () => {
    const ing = [
      { food: { basis: { jumlah: 100, satuan: 'g' }, kkal: 100, proteinG: 0, lemakG: 0, karboG: 0 }, jumlah: 300 },
      { food: { basis: { jumlah: 100, satuan: 'g' }, kkal: 200, proteinG: 0, lemakG: 0, karboG: 0 }, jumlah: 150 },
      { food: { basis: { jumlah: 100, satuan: 'ml' }, kkal: 100, proteinG: 0, lemakG: 0, karboG: 0 }, jumlah: 300 },
    ];
    expect(perPortion(ing, 3).kkal).toBe(300);
  });
});

describe('Estimasi energi pemeliharaan (Mifflin-St Jeor)', () => {
  // Hari acuan tetap supaya tes tidak bergantung jam sistem.
  const today = new Date(2026, 10, 15); // 15 Nov 2026
  const base = { beratKg: 70, tinggiCm: 170, tglLahir: '2006-06-01', jenisKelamin: 'laki-laki', aktivitas: 'ringan' };

  it('laki-laki 70 kg, 170 cm, usia 20, faktor 1,375 = 2293 kkal', () => {
    // (700 + 1062,5 - 100 + 5) x 1,375 = 2292,8125 -> 2293.
    // Catatan: PRD v1.2 menulis 2291; itu salah hitung, hasil yang benar 2293.
    const r = maintenanceKcal(base, today);
    expect(r.available).toBe(true);
    expect(r.age).toBe(20);
    expect(r.value).toBe(2293);
  });
  it('perempuan memakai konstanta -161', () => {
    const r = maintenanceKcal({ ...base, jenisKelamin: 'perempuan' }, today);
    // (700 + 1062,5 - 100 - 161) x 1,375 = 2064,9375 -> 2065
    expect(r.value).toBe(2065);
  });
  it('di bawah 18 tahun: tidak ada angka, ada alasan', () => {
    const r = maintenanceKcal({ ...base, tglLahir: '2012-01-01' }, today);
    expect(r.available).toBe(false);
    expect(r.reason).toMatch(/18 tahun/);
    expect(r.value).toBeUndefined();
  });
  it('data kurang lengkap: alasan menyebut apa yang kurang', () => {
    const r = maintenanceKcal({ beratKg: 60 }, today);
    expect(r.available).toBe(false);
    expect(r.reason).toMatch(/tinggi badan/);
  });
  it('usia dihitung dari tanggal lahir, termasuk sebelum ulang tahun', () => {
    expect(ageFromBirth('2006-11-16', today)).toBe(19);
    expect(ageFromBirth('2006-11-15', today)).toBe(20);
  });
});

describe('Target kalori (KP-02.3)', () => {
  const today = new Date(2026, 10, 15);
  const full = { beratKg: 70, tinggiCm: 170, tglLahir: '2006-06-01', jenisKelamin: 'laki-laki', aktivitas: 'ringan' };
  it('target pribadi dipakai jika diisi', () => {
    expect(resolveTarget({ ...full, targetKkal: 1800 }, today)).toEqual({ value: 1800, sumber: 'pribadi' });
  });
  it('jika kosong, dipakai perkiraan pemeliharaan', () => {
    expect(resolveTarget(full, today)).toEqual({ value: 2293, sumber: 'perkiraan' });
  });
  it('jika keduanya tidak ada, dipakai 2000 kkal bawaan', () => {
    expect(resolveTarget({}, today)).toEqual({ value: 2000, sumber: 'bawaan' });
  });
});

describe('Makro dan rentang acuan (KP-06)', () => {
  it('menghitung persen energi dan status teks', () => {
    // 100 g protein (400) + 250 g karbo (1000) + 50 g lemak (450) = 1850 kkal
    const rows = macroBreakdown({ kkal: 1850, proteinG: 100, lemakG: 50, karboG: 250 });
    const by = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect(by.proteinG.persen).toBeCloseTo(21.6, 1);
    expect(by.proteinG.status).toBe(STATUS.within);
    expect(by.lemakG.persen).toBeCloseTo(24.3, 1);
    expect(by.lemakG.status).toBe(STATUS.within);
    expect(by.karboG.persen).toBeCloseTo(54.1, 1);
    expect(by.karboG.status).toBe(STATUS.within);
  });
  it('status di bawah dan di atas rentang', () => {
    // hanya lemak: 100% lemak -> di atas rentang lemak, protein dan karbo di bawah
    const rows = macroBreakdown({ kkal: 900, proteinG: 0, lemakG: 100, karboG: 0 });
    const by = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect(by.lemakG.status).toBe(STATUS.above);
    expect(by.proteinG.status).toBe(STATUS.below);
    expect(by.karboG.status).toBe(STATUS.below);
  });
  it('belum ada catatan: status "Belum ada catatan" dan tanpa pembagian nol', () => {
    const rows = macroBreakdown({ kkal: 0, proteinG: 0, lemakG: 0, karboG: 0 }, false);
    for (const r of rows) {
      expect(r.status).toBe(STATUS.none);
      expect(r.persen).toBeNull();
    }
    // catatan ada tetapi semua makro nol: tetap tidak error
    const rows2 = macroBreakdown({ kkal: 0, proteinG: 0, lemakG: 0, karboG: 0 }, true);
    expect(rows2.every((r) => r.persen === null)).toBe(true);
  });
});

describe('Validasi input', () => {
  it('jumlah makanan: batas 1 sampai 5000', () => {
    expect(validateJumlah('150')).toBeNull();
    expect(validateJumlah('1')).toBeNull();
    expect(validateJumlah('5000')).toBeNull();
    expect(validateJumlah('0')).toMatch(/lebih dari 0/);
    expect(validateJumlah('-5')).toMatch(/lebih dari 0/);
    expect(validateJumlah('0,5')).not.toBeNull();
    expect(validateJumlah('5001')).toMatch(/antara/);
    expect(validateJumlah('')).toMatch(/angka/);
    expect(validateJumlah('abc')).toMatch(/angka/);
  });
  it('profil: batas berat dan tinggi (KP-02.1)', () => {
    expect(validateProfile({ beratKg: 19, tinggiCm: 170 }).errors.beratKg).toBeTruthy();
    expect(validateProfile({ beratKg: 301 }).errors.beratKg).toBeTruthy();
    expect(validateProfile({ tinggiCm: 99 }).errors.tinggiCm).toBeTruthy();
    expect(validateProfile({ tinggiCm: 251 }).errors.tinggiCm).toBeTruthy();
    expect(validateProfile({ beratKg: 20, tinggiCm: 250 }).ok).toBe(true);
    expect(validateProfile({ beratKg: -5 }).errors.beratKg).toBeTruthy();
  });
  it('profil: tanggal lahir tidak boleh di masa depan (KP-02.2)', () => {
    const today = new Date(2026, 10, 15);
    expect(validateProfile({ tglLahir: '2026-11-16' }, today).errors.tglLahir).toMatch(/masa depan/);
    expect(validateProfile({ tglLahir: '2026-11-15' }, today).ok).toBe(true);
  });
  it('profil kosong dianggap valid (field boleh kosong)', () => {
    expect(validateProfile({}).ok).toBe(true);
  });
});

describe('Riwayat dan catatan', () => {
  it('7 hari terakhir termasuk hari ini, urut terlama ke terbaru', () => {
    const d = lastNDays(7, '2026-11-15');
    expect(d).toHaveLength(7);
    expect(d[0]).toBe('2026-11-09');
    expect(d[6]).toBe('2026-11-15');
  });
  it('7 hari melewati pergantian bulan', () => {
    expect(lastNDays(3, '2026-12-01')).toEqual(['2026-11-29', '2026-11-30', '2026-12-01']);
  });
  it('ubah jumlah menghitung ulang dari snapshot nilai lama (KP-07.2)', () => {
    const nilai = { kkal: 300, proteinG: 15, lemakG: 7.5, karboG: 45 };
    const baru = rescaleLogValues(nilai, 150, 300);
    expect(baru.kkal).toBe(600);
    expect(baru.proteinG).toBe(30);
  });
});

describe('Pencarian katalog (KP-04)', () => {
  it('tidak peka huruf besar-kecil dan cocok sebagian nama', () => {
    expect(searchFoods(FOODS_SEED, 'NASI').map((f) => f.id)).toEqual(
      expect.arrayContaining(['nasi-putih', 'nasi-goreng']),
    );
    expect(searchFoods(FOODS_SEED, 'goreng').length).toBeGreaterThan(3);
  });
  it('filter kategori', () => {
    const r = searchFoods(FOODS_SEED, '', 'Minuman');
    expect(r.length).toBe(2);
    expect(r.every((f) => f.kategori === 'Minuman')).toBe(true);
  });
  it('hanya makanan berstatus aktif yang dapat dicari (KP-04.4)', () => {
    const foods = [{ ...FOODS_SEED[0], status: 'nonaktif' }, FOODS_SEED[1]];
    expect(searchFoods(foods, '').map((f) => f.id)).toEqual(['nasi-goreng']);
  });
  it('tidak ada hasil: daftar kosong', () => {
    expect(searchFoods(FOODS_SEED, 'xyzxyz')).toEqual([]);
  });
});

describe('Katalog awal', () => {
  it('berisi 20 makanan dengan id unik dan nilai gizi lengkap', () => {
    expect(FOODS_SEED).toHaveLength(20);
    expect(new Set(FOODS_SEED.map((f) => f.id)).size).toBe(20);
    for (const f of FOODS_SEED) {
      expect(f.basis.jumlah).toBeGreaterThan(0);
      expect(['g', 'ml', 'porsi']).toContain(f.basis.satuan);
      expect(f.kkal).toBeGreaterThanOrEqual(0);
    }
  });
});
