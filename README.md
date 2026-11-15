# Pemantau Gizi

Aplikasi web untuk mencatat makanan, memantau **perkiraan** kalori dan makronutrien harian, mengenali makanan dari foto dengan AI, serta mengajukan makanan baru yang ditinjau admin.
Dibuat dari PRD v1.2 (Fase 5, metodologi 7-Phase Agent Loop).

> Semua nilai gizi dan kebutuhan energi adalah perkiraan acuan, bukan diagnosis medis.

**Stack:** Vite 5 + React 18 (JavaScript), Firebase Auth + Cloud Firestore, fungsi server `api/recognize.js` (Vercel), vitest.

## 1. Coba cepat (mode demo, tanpa Firebase)

```bash
npm install
npm run dev
```

Buka alamat yang tampil (biasanya http://localhost:5173). Bila `VITE_FIREBASE_*` kosong, aplikasi memakai penyimpanan peramban (localStorage) dan AI simulasi (ada banner kuning). Daftar akun bebas, lalu di tab **Profil** klik "Jadikan saya admin (demo)" untuk mencoba tab Admin.

Catatan: pada mode demo, pengenalan foto **bukan AI sungguhan**, hasilnya dipilih otomatis dari katalog.

## 2. Menjalankan tes

```bash
npm test          # 36 tes unit (logika gizi + parser keluaran AI)
npm run build     # memastikan build produksi lolos
```

## 3. Menyiapkan Firebase (mode sungguhan)

1. Buat proyek di https://console.firebase.google.com.
2. **Authentication** → Sign-in method → aktifkan *Email/Password*.
3. **Firestore Database** → buat database. Di tab *Rules*, tempel isi `firestore.rules`, lalu Publish.
4. Project settings → tambah *Web app* → salin konfigurasinya ke file `.env` (salin dari `.env.example`):
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.
5. Jalankan `npm run dev`, daftar akun pertama.
6. **Jadikan admin pertama:** di Firestore Console buka koleksi `users` → dokumen akun Anda → ubah field `role` dari `user` menjadi `admin`. Muat ulang aplikasi.
7. Di tab **Admin** klik **Isi katalog awal** (mengisi 20 makanan dari `src/lib/foodsSeed.js`).

## 4. Deploy ke Vercel + AI

1. Unggah proyek ke GitHub, impor di https://vercel.com (framework Vite terdeteksi otomatis).
2. Isi Environment Variables: semua `VITE_FIREBASE_*`, ditambah salah satu penyedia AI:
   - `AI_PROVIDER=gemini`, `GEMINI_API_KEY=...`, `GEMINI_MODEL=gemini-2.5-flash`; atau
   - `AI_PROVIDER=anthropic`, `ANTHROPIC_API_KEY=...`, `ANTHROPIC_MODEL=...`
3. Kunci API **hanya** ada di server (`api/recognize.js`), tidak pernah masuk ke kode peramban.
4. Menguji fungsi `/api` secara lokal: `npx vercel dev`.
5. Tambahkan domain Vercel ke Firebase Auth → Settings → Authorized domains.

## 5. Cara kerja pengenalan foto (FR-13, FR-14)

- Foto dikecilkan ke 1024 px JPEG di peramban, dikirim ke `/api/recognize` dengan token Firebase.
- Server memverifikasi token, membatasi 20 permintaan/menit/pengguna, lalu meminta model vision memilih **hanya dari katalog** (maks. 3 kandidat + keyakinan). Id di luar katalog dibuang oleh `parseCandidates`.
- Keyakinan tertinggi < 50% dianggap "tidak dikenali".
- Foto **tidak disimpan**. Tidak ada catatan makan dibuat sebelum pengguna menekan "Pilih".
- Setiap pengenalan dicatat di koleksi `recognitions`, dengan keputusan:
  - `dikonfirmasi`: pengguna memilih kandidat teratas;
  - `diganti`: memilih kandidat lain atau "Tidak ada yang cocok, cari manual";
  - `tidak dikenali`: keyakinan di bawah ambang.

### Mengukur akurasi (untuk laporan)

Angka di tab Admin adalah ukuran pemakaian, **bukan** akurasi. Untuk akurasi:
1. Kumpulkan ±60 foto makanan dari 20 item katalog (sekitar 3 foto per makanan), beri label benar.
2. Kirim tiap foto ke `/api/recognize`, catat kandidat yang keluar.
3. Top-1 = (jumlah foto yang kandidat pertamanya benar) / total. Top-3 = (jumlah foto yang benarnya ada di 3 kandidat) / total.

## 6. Keterlacakan PRD → kode

| Kebutuhan | Lokasi |
|---|---|
| FR-01 Daftar/masuk | `components/Auth.jsx`, `lib/db.js` |
| FR-02, FR-03 Profil, estimasi energi | `components/Profile.jsx`, `lib/nutrition.js` |
| FR-04–FR-07 Catat, riwayat, makro, ubah/hapus | `components/Log.jsx`, `History.jsx`, `Home.jsx` |
| FR-08, FR-09 Ajukan makanan, status | `components/Submit.jsx` |
| FR-10, FR-11 Tinjau, kelola | `components/Admin.jsx`, `firestore.rules` |
| FR-13, FR-14 Foto AI, ringkasan | `Log.jsx` (PhotoRecognizer), `lib/ai.js`, `api/recognize.js`, `server/parseCandidates.js` |
| NFR-06 Logika murni teruji | `lib/nutrition.js`, `tests/` |

## 7. Batasan yang diketahui (jujur)

- **Nilai gizi di `foodsSeed.js` adalah perkiraan awal dan belum diverifikasi ke TKPI 2017.** Wajib diperiksa tim sebelum dipakai atau dilaporkan.
- Pengujian otomatis (36 unit + 38 langkah e2e Playwright) dijalankan pada **mode demo lokal**. Adapter Firebase, aturan Firestore, `api/recognize.js` dengan penyedia AI nyata, dan deploy Vercel **belum diuji** di lingkungan nyata.
- Rate limit API bersifat in-memory (per instance), cukup untuk tugas kuliah, bukan produksi.
- Kasus uji PRD v1.2 menulis 2291 kkal untuk contoh estimasi; hitungan yang benar adalah **2293** (dipakai di tes).
- Bundle ±670 kB (Firebase ikut terbundel); belum dioptimalkan.
