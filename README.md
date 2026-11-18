# GLOBAL STOCK CONTROL — BISNIS HOTEL

Aplikasi web kontrol aset & perlengkapan hotel: 6 kategori inventory, transaksi stok (masuk / terpakai / rusak / hilang),
stock opname, laporan + export Excel, dan **import data dari 6 file Excel**.

**Teknologi:** Next.js 14 (App Router) · React 18 · Tailwind CSS · komponen gaya shadcn/ui · Firebase (Firestore + Authentication, **tanpa Storage**) ·
SheetJS (`xlsx-js-style`) · Lucide Icons · Recharts.

> Catatan: library Excel yang dipakai adalah **`xlsx-js-style`**, yaitu SheetJS dengan dukungan styling sel
> (warna header, border) yang tidak tersedia di edisi komunitas `xlsx`. Cara pakainya sama dengan SheetJS.

---

## 1. Menjalankan di komputer

Butuh **Node.js 18.17 atau lebih baru**.

```bash
npm install
cp .env.local.example .env.local     # lalu isi nilainya (langkah 2)
npm run dev                          # buka http://localhost:3000
```

## 2. Setup Firebase (sekali saja)

1. Buka <https://console.firebase.google.com> → **Add project** (mis. `bisnis-hotel-stock`).
2. **Authentication** → *Get started* → tab *Sign-in method* → aktifkan **Email/Password**.
3. **Firestore Database** → *Create database* → pilih lokasi terdekat (mis. `asia-southeast2` Jakarta) → mode **Production**.
4. **Storage tidak dipakai** — lewati saja (tidak perlu paket berbayar). Aplikasi ini tidak memakai fitur foto.
5. **Project settings** (ikon roda gigi) → *Your apps* → ikon **Web `</>`** → daftarkan aplikasi → salin nilai konfigurasinya.
6. Isi file `.env.local` dengan nilai tersebut:

   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   NEXT_PUBLIC_FIREBASE_APP_ID=...
   ```

   File konfigurasinya ada di `lib/firebase.js` (membaca nilai dari `.env.local`).

### Pasang Security Rules (WAJIB)

**Cara mudah (copy–paste):**
- Firestore Database → tab **Rules** → ganti isinya dengan isi file `firestore.rules` → **Publish**.

**Atau lewat Firebase CLI:**
```bash
npm install -g firebase-tools
firebase login
firebase use --add            # pilih project
firebase deploy --only firestore:rules
```

### Membuat Admin pertama

1. Firebase Console → **Authentication → Users → Add user** → isi email & password Anda.
2. Jalankan aplikasi, **login** dengan akun itu. Pada login pertama aplikasi membuat profil dengan role `viewer`.
3. Firebase Console → **Firestore Database → koleksi `users` →** dokumen milik Anda → ubah field **`role`** dari `viewer` menjadi **`admin`**.
4. Muat ulang aplikasi. Sekarang menu **Pengguna** dan **Import Data** tersedia. Akun Staff/Viewer berikutnya dibuat dari menu **Pengguna**.

## 3. Import 6 file Excel (fitur utama)

Menu **Import Data** (khusus Admin):

1. Ada 6 kotak: Cafe, Daily HK, Linen, Engineering, Meeting Room, Uniform. Unggah satu file `.xlsx` per kategori
   (boleh semua sekaligus).
2. Sistem membaca file dan **mencocokkan kolom otomatis** (Nama Barang, Kode, Satuan, Jumlah/Stok Awal, Harga, Lokasi, Keterangan,
   plus Stok Minimum & Kondisi bila ada). Judul kolom boleh berbeda — misalnya “Nama Item” — dan baris judul tidak harus di baris 1.
   Jika ada yang salah cocok, pilih kolom yang benar lewat dropdown.
3. **Preview** tampil sebelum disimpan. Data duplikat (Nama Barang sama) diberi peringatan dengan pilihan
   **Skip / Update Stok / Buat Baru** — bisa per baris, atau sekaligus untuk semua duplikat.
   - *Update Stok* menyamakan Sisa Stok dengan jumlah di Excel.
   - Di kategori **Cafe**, baris yang terlihat seperti bahan baku (kopi, susu, gula, dll.) ditandai dan **dilewati secara default**.
4. Klik **Import** (per kategori) atau **Import Semua**. Data langsung masuk Firestore dan muncul di **Inventory**.
5. Tombol **Download Template Excel** tersedia di tiap kategori agar format ke depan seragam.

Data contoh (dummy) bisa dimuat untuk mencoba aplikasi, lalu dihapus dengan tombol **Hapus Data Contoh** sebelum memakai data asli.

## 4. Ringkasan fitur

| Menu | Isi |
|------|-----|
| Dashboard | Total Item, Masuk, Terpakai, Rusak, Hilang, Sisa Stok; grafik bar per kategori; donut 6 kategori; tabel stok menipis |
| Inventory | Tabel dengan pencarian, filter, sort, pagination, badge status (Aman hijau / Menipis kuning / Habis merah); master item |
| Transaksi | Stok Masuk, Terpakai, Rusak, Hilang lengkap dengan isian khusus tiap jenis (supplier & invoice, keperluan & pemakai, penyebab, kronologi & penanggung jawab) |
| Stock Opname | Input stok fisik, Selisih & Nilai Selisih otomatis, opsi menyesuaikan stok sistem (Admin), export Excel |
| Laporan | Filter tanggal / kategori / jenis; **Export ke Excel 4 sheet**; **Print ke PDF** |
| Import Data | Lihat bagian 3 |
| Riwayat | Audit log: siapa, kapan, apa, berapa jumlahnya |
| Pengguna | Tambah akun, ubah role (Admin / Staff / Viewer / Nonaktif), reset password |

**Rumus:** `Sisa Stok = Stok Awal + Total Masuk − Total Terpakai − Total Rusak − Total Hilang`

**Status:** Habis bila Sisa ≤ 0; Menipis bila Sisa ≤ Stok Minimum; selain itu Aman. Notifikasi lonceng di topbar muncul otomatis.

**Kode barang otomatis:** CAF-001, DHK-001, LIN-001, ENG-001, MTG-001, UNF-001 (nomor berlanjut per kategori).

**Export Excel (menu Laporan):** Sheet 1 Ringkasan Stok Akhir · Sheet 2 Detail Transaksi · Sheet 3 Rekap Rusak & Hilang ·
Sheet 4 Hasil Stock Opname. Setiap sheet memuat nama BISNIS HOTEL, judul laporan, tanggal cetak, header berwarna, border, dan baris total.

**Print ke PDF:** tombol *Print ke PDF* membuka dialog cetak browser → pilih **Save as PDF**.

## 5. Struktur data Firestore

| Koleksi | Isi |
|---------|-----|
| `users/{uid}` | `email, nama, role` |
| `items/{id}` | `kode, nama, kategori, satuan, stokMinimum, harga, lokasi, kondisi, deskripsi, stokAwal, totalMasuk, totalTerpakai, totalRusak, totalHilang, sisa` |
| `transactions/{id}` | `itemId, kode, nama, kategori, jenis, jumlah, sisaSetelah, tanggal, keterangan, petugas, …` |
| `opnames/{id}` | `sesi, tanggal, kode, nama, stokSistem, stokFisik, selisih, nilaiSelisih, petugas, …` |
| `auditLogs/{id}` | `aksi, detail, user, createdAt` |
| `counters/{kategori}` | `last` (nomor kode terakhir) |

Tidak ada query gabungan yang butuh composite index. Laporan memakai filter rentang pada satu field (`tanggal`).

## 6. Deploy

Cara termudah: **Vercel** — import repository, isi *Environment Variables* yang sama dengan `.env.local`, lalu deploy.
Setelah itu tambahkan domain Vercel Anda di Firebase Console → Authentication → Settings → **Authorized domains**.

## 7. Catatan keamanan

- Seluruh data hanya bisa dibaca pengguna yang login dengan role aktif; Viewer tidak bisa menulis; Staff tidak bisa mengubah data master.
- Transaksi, hasil opname, dan audit log **tidak bisa diubah atau dihapus** dari aplikasi (hanya ditambah).
- Perhitungan stok dilakukan di sisi aplikasi (dalam *Firestore transaction* agar tidak bentrok antar pengguna). Rules membatasi
  field apa yang boleh diubah Staff, tetapi tidak memverifikasi angka stoknya. Jika kelak butuh jaminan lebih ketat,
  pindahkan penghitungan ke Cloud Functions.
- Jangan membagikan file `.env.local` dan aktifkan hanya akun yang dibutuhkan.

## 8. Build APK (Android) dan EXE (Windows) lewat GitHub

Tutorial lengkap langkah demi langkah ada di dokumen "Tutorial Lengkap: Firebase sampai Build APK & EXE di GitHub".
Ringkasnya: unggah proyek ke GitHub, buat 5 Secrets (`NEXT_PUBLIC_FIREBASE_*`), lalu buat tag versi
(`git tag v1.0.0 && git push origin v1.0.0`) atau jalankan **Actions > Build APK dan EXE > Run workflow**.
File: `.github/workflows/build.yml`, `capacitor.config.json`, `desktop/`.
