// =====================================================================
// Katalog awal 20 makanan lokal (PRD keputusan 5).
//
// PERHATIAN: nilai gizi di bawah adalah PERKIRAAN AWAL yang ditulis dari
// pengetahuan umum, BELUM diambil dari buku TKPI 2017. Tim WAJIB
// memverifikasi tiap baris ke TKPI 2017 sebelum angka dipakai di laporan.
// Cukup ubah angka di file ini, lalu tekan "Isi katalog awal" di tab Admin
// (atau hapus data demo di peramban) agar katalog diperbarui.
//
// basis: nilai gizi dihitung per `basis.jumlah` `basis.satuan`
//        (100 g, 100 ml, atau 1 porsi).
// =====================================================================

const SUMBER = 'Perkiraan awal (verifikasi ke TKPI 2017)';

const f = (id, nama, kategori, jumlah, satuan, kkal, proteinG, lemakG, karboG) => ({
  id,
  nama,
  kategori,
  basis: { jumlah, satuan },
  kkal,
  proteinG,
  lemakG,
  karboG,
  sumber: SUMBER,
  status: 'aktif',
});

export const FOODS_SEED = [
  // ----- Pokok
  f('nasi-putih', 'Nasi putih', 'Pokok', 100, 'g', 130, 2.7, 0.3, 28.2),
  f('nasi-goreng', 'Nasi goreng', 'Pokok', 100, 'g', 168, 4.6, 6.3, 23),
  f('mie-goreng', 'Mie goreng', 'Pokok', 100, 'g', 180, 4.5, 7, 25),
  f('mie-instan', 'Mie instan rebus (1 bungkus)', 'Pokok', 1, 'porsi', 380, 8, 14, 54),
  f('roti-tawar', 'Roti tawar', 'Pokok', 100, 'g', 265, 9, 3.2, 49),
  // ----- Lauk
  f('ayam-goreng', 'Ayam goreng', 'Lauk', 100, 'g', 260, 25, 16, 6),
  f('telur-dadar', 'Telur dadar', 'Lauk', 100, 'g', 190, 11, 15, 1),
  f('telur-rebus', 'Telur rebus', 'Lauk', 100, 'g', 155, 12.6, 10.6, 1.1),
  f('tempe-goreng', 'Tempe goreng', 'Lauk', 100, 'g', 320, 19, 22, 11),
  f('tahu-goreng', 'Tahu goreng', 'Lauk', 100, 'g', 270, 16, 20, 6),
  f('ikan-goreng', 'Ikan goreng', 'Lauk', 100, 'g', 230, 22, 15, 3),
  f('bakso', 'Bakso (1 porsi)', 'Lauk', 1, 'porsi', 300, 15, 15, 25),
  f('soto-ayam', 'Soto ayam (1 porsi, tanpa nasi)', 'Lauk', 1, 'porsi', 200, 15, 8, 14),
  // ----- Sayur
  f('bayam-rebus', 'Bayam rebus', 'Sayur', 100, 'g', 23, 3, 0.3, 3.6),
  f('tumis-kangkung', 'Tumis kangkung', 'Sayur', 100, 'g', 60, 2.5, 4, 4),
  f('gado-gado', 'Gado-gado (1 porsi)', 'Sayur', 1, 'porsi', 300, 12, 17, 25),
  // ----- Camilan
  f('pisang', 'Pisang', 'Camilan', 100, 'g', 89, 1.1, 0.3, 22.8),
  f('pisang-goreng', 'Pisang goreng', 'Camilan', 100, 'g', 240, 2, 12, 31),
  // ----- Minuman
  f('es-teh-manis', 'Es teh manis', 'Minuman', 100, 'ml', 40, 0, 0, 10),
  f('susu-uht', 'Susu UHT', 'Minuman', 100, 'ml', 61, 3.2, 3.3, 4.8),
];
