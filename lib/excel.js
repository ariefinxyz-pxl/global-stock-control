// Baca / tulis Excel. Memakai "xlsx-js-style" = SheetJS (xlsx) dengan dukungan styling sel
// (warna header, border) yang tidak tersedia di edisi komunitas SheetJS.
import * as XLSX from 'xlsx-js-style';
import { CAT, CATEGORIES, HOTEL_NAME, JENIS } from './constants';
import { fmtDate, isBahanBaku, norm, STATUS_LABEL, statusStok } from './utils';
import { DUMMY } from './dummy';

/* ============================ SIMPAN FILE ============================ */

// Di browser / Electron: unduh biasa. Di aplikasi Android (Capacitor) unduhan lewat anchor tidak
// berjalan di WebView, jadi file ditulis ke cache lalu dibuka lewat menu Bagikan/Simpan Android.
async function saveWorkbook(wb, filename) {
  const cap = typeof window !== 'undefined' ? window.Capacitor : null;
  if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) {
    const data = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const res = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache });
    await Share.share({ title: filename, url: res.uri, dialogTitle: 'Simpan atau bagikan file Excel' });
    return;
  }
  XLSX.writeFile(wb, filename);
}

/* ============================== IMPORT ============================== */

export const FIELDS = [
  { key: 'nama', label: 'Nama Barang', required: true },
  { key: 'kode', label: 'Kode' },
  { key: 'satuan', label: 'Satuan' },
  { key: 'jumlah', label: 'Jumlah / Stok Awal' },
  { key: 'harga', label: 'Harga' },
  { key: 'lokasi', label: 'Lokasi' },
  { key: 'keterangan', label: 'Keterangan' },
  { key: 'stokMinimum', label: 'Stok Minimum' },
  { key: 'kondisi', label: 'Kondisi' },
];

// Alias nama kolom (sudah dinormalisasi: huruf kecil tanpa spasi/simbol)
const ALIASES = {
  nama: ['namabarang', 'nama', 'namaitem', 'item', 'barang', 'itemname', 'namaaset', 'namaperlengkapan', 'jenisbarang', 'namabrg'],
  kode: ['kode', 'kodebarang', 'kodeitem', 'code', 'sku', 'itemcode', 'kodebrg'],
  satuan: ['satuan', 'unit', 'uom', 'sat'],
  jumlah: ['jumlah', 'stok', 'stokawal', 'jumlahstokawal', 'qty', 'quantity', 'stock', 'jml', 'saldo', 'stockawal', 'jumlahawal', 'stokakhir', 'jumlahstok'],
  harga: ['harga', 'hargasatuan', 'price', 'hargabeli', 'unitprice', 'hargaperunit'],
  lokasi: ['lokasi', 'gudang', 'location', 'tempat', 'lokasigudang', 'penyimpanan', 'lokasipenyimpanan'],
  keterangan: ['keterangan', 'ket', 'catatan', 'remark', 'remarks', 'notes', 'deskripsi', 'description'],
  stokMinimum: ['stokminimum', 'minstok', 'minimum', 'min', 'stokmin', 'minimumstok', 'minstock', 'batasminimum', 'minimal'],
  kondisi: ['kondisi', 'condition'],
};

const ALL_ALIASES = new Set(Object.values(ALIASES).flat());

export function toNumber(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  let s = String(v ?? '').trim();
  if (s === '') return 0;
  s = s.replace(/rp\.?/gi, '').replace(/\s/g, '');
  if (!/^-?[\d.,]+$/.test(s)) return NaN;
  const hasDot = s.includes('.');
  const hasComma = s.includes(',');
  if (hasDot && hasComma) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (hasDot) {
    if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  } else if (hasComma) {
    s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

const SATUAN_MAP = {
  pcs: 'Pcs', pc: 'Pcs', buah: 'Pcs', biji: 'Pcs', lembar: 'Pcs', piece: 'Pcs', pieces: 'Pcs',
  box: 'Box', dus: 'Box', kotak: 'Box', karton: 'Box',
  set: 'Set', unit: 'Unit',
};

function normalizeSatuan(v) {
  const s = String(v ?? '').trim();
  if (!s) return 'Pcs';
  return SATUAN_MAP[s.toLowerCase()] || s.charAt(0).toUpperCase() + s.slice(1);
}

const KONDISI_MAP = {
  baik: 'Baik',
  bagus: 'Baik',
  'cukup baik': 'Cukup Baik',
  cukup: 'Cukup Baik',
  'rusak ringan': 'Rusak Ringan',
  'rusak berat': 'Rusak Berat',
  rusak: 'Rusak Berat',
};

function normalizeKondisi(v) {
  const s = String(v ?? '').trim();
  if (!s) return 'Baik';
  return KONDISI_MAP[s.toLowerCase()] || s;
}

function detectHeaderRow(aoa) {
  let best = 0;
  let bestScore = -1;
  for (let i = 0; i < Math.min(aoa.length, 15); i++) {
    const score = aoa[i].reduce((s, c) => s + (ALL_ALIASES.has(norm(c)) ? 1 : 0), 0);
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : 0;
}

export async function readWorkbookFile(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  for (const name of wb.SheetNames) {
    if (/petunjuk|readme|panduan/i.test(name)) continue;
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets[name], {
      header: 1,
      defval: '',
      raw: true,
      blankrows: false,
    });
    if (aoa.length >= 1) {
      const hi = detectHeaderRow(aoa);
      const width = Math.max(1, ...aoa.slice(hi).map((r) => r.length));
      const headers = Array.from({ length: width }, (_, i) => {
        const h = String(aoa[hi][i] ?? '').trim();
        return h || `Kolom ${i + 1}`;
      });
      const rows = aoa
        .slice(hi + 1)
        .map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ''))
        .filter((r) => r.some((c) => String(c).trim() !== ''));
      return { sheetName: name, headers, rows };
    }
  }
  throw new Error('Tidak ada data yang terbaca di file ini.');
}

// Mapping kolom otomatis: { namaField: indexKolom | -1 }
export function autoMap(headers) {
  const normH = headers.map(norm);
  const used = new Set();
  const mapping = {};
  FIELDS.forEach((f) => {
    mapping[f.key] = -1;
  });
  FIELDS.forEach((f) => {
    const idx = normH.findIndex((h, i) => !used.has(i) && ALIASES[f.key].includes(h));
    if (idx >= 0) {
      mapping[f.key] = idx;
      used.add(idx);
    }
  });
  FIELDS.forEach((f) => {
    if (mapping[f.key] >= 0) return;
    const idx = normH.findIndex(
      (h, i) => !used.has(i) && h && ALIASES[f.key].some((a) => a.length >= 4 && h.includes(a))
    );
    if (idx >= 0) {
      mapping[f.key] = idx;
      used.add(idx);
    }
  });
  // File sederhana: judul kolom pertama sering berupa nama kategori (mis. "INVENTORY - CAFÉ"),
  // bukan "Nama Barang". Jika Nama Barang belum ketemu, pakai kolom pertama yang belum terpakai.
  if (mapping.nama < 0) {
    const first = headers.findIndex((_, i) => !used.has(i));
    if (first >= 0) mapping.nama = first;
  }
  return mapping;
}

export const ACTION_LABEL = { create: 'Buat Baru', update: 'Update Stok', skip: 'Lewati' };

// Menganalisis baris Excel: validasi, deteksi duplikat (berdasarkan Nama Barang) & aksi default.
export function analyzeRows(rows, mapping, kategori, existingItems, defaultDup = 'skip') {
  const existingByName = new Map();
  existingItems.forEach((i) => {
    const k = norm(i.nama);
    if (k && !existingByName.has(k)) existingByName.set(k, i);
  });
  const seen = new Set();
  const get = (r, f) => (mapping[f] != null && mapping[f] >= 0 ? r[mapping[f]] : '');

  return rows.map((r, idx) => {
    const rowNo = idx + 1;
    const nama = String(get(r, 'nama') ?? '').trim();
    if (!nama) {
      return { rowNo, data: { nama: '' }, issues: ['Nama Barang kosong'], status: 'error', action: 'skip', options: ['skip'] };
    }
    const issues = [];
    const jumlah = toNumber(get(r, 'jumlah'));
    const harga = toNumber(get(r, 'harga'));
    const min = toNumber(get(r, 'stokMinimum'));
    let stokAwal = jumlah;
    if (Number.isNaN(jumlah)) {
      stokAwal = 0;
      issues.push('Jumlah tidak valid, dianggap 0');
    } else if (jumlah < 0) {
      stokAwal = 0;
      issues.push('Jumlah negatif, dianggap 0');
    }
    let hargaOk = harga;
    if (Number.isNaN(harga) || harga < 0) {
      hargaOk = 0;
      issues.push('Harga tidak valid, dianggap 0');
    }
    let minOk = min;
    if (Number.isNaN(min) || min < 0) minOk = 0;

    const data = {
      kode: String(get(r, 'kode') ?? '').trim(),
      nama,
      satuan: normalizeSatuan(get(r, 'satuan')),
      stokAwal,
      stokMinimum: minOk,
      harga: hargaOk,
      lokasi: String(get(r, 'lokasi') ?? '').trim(),
      kondisi: normalizeKondisi(get(r, 'kondisi')),
      deskripsi: String(get(r, 'keterangan') ?? '').trim(),
    };

    const key = norm(nama);
    const existing = existingByName.get(key);
    const dupInFile = seen.has(key);
    seen.add(key);

    if (existing) {
      return {
        rowNo, data, issues, status: 'duplikat', existing,
        action: defaultDup, options: ['skip', 'update', 'create'],
      };
    }
    if (dupInFile) {
      issues.push('Nama sama dengan baris sebelumnya di file ini');
      return {
        rowNo, data, issues, status: 'duplikat-file',
        action: defaultDup === 'create' ? 'create' : 'skip', options: ['skip', 'create'],
      };
    }
    let action = 'create';
    if (kategori === 'cafe' && isBahanBaku(nama)) {
      issues.push('Terlihat seperti bahan baku. Kategori Cafe hanya untuk alat/perlengkapan');
      action = 'skip';
    }
    return { rowNo, data, issues, status: 'baru', action, options: ['create', 'skip'] };
  });
}

export function guessCategory(fileName) {
  const n = String(fileName || '').toLowerCase().replace(/[_\-.]+/g, ' ');
  if (/daily|dhk|harian|amenities|amenity/.test(n)) return 'daily-hk';
  if (/linen|handuk|sprei/.test(n)) return 'linen';
  if (/engineering|\beng\b|teknik/.test(n)) return 'engineering';
  if (/meeting|mtg|\bmr\b/.test(n)) return 'meeting';
  if (/uniform|seragam|\bunf\b/.test(n)) return 'uniform';
  if (/cafe|café|kafe|\bcaf\b/.test(n)) return 'cafe';
  return null;
}

/* ============================== STYLE ============================== */

const C = { navy: '0B1F3A', gold: 'D4AF37', goldSoft: 'FFF2CC', zebra: 'F5F7FB', line: 'B8C2D3' };
const thin = { style: 'thin', color: { rgb: C.line } };
const BORDER = { top: thin, bottom: thin, left: thin, right: thin };
const FMT_INT = '#,##0';
const FMT_RP = '"Rp" #,##0';

function printDate() {
  return new Date().toLocaleString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildSheet({ title, subtitle, headers, rows, totalRows = [], widths, formats = {}, headerFill = C.navy, headerFont = 'FFFFFF' }) {
  const cols = headers.length;
  const aoa = [[HOTEL_NAME], [title], [`Tanggal Cetak: ${printDate()}`], [subtitle || ''], []];
  const hr = aoa.length;
  aoa.push(headers);
  const hasRows = rows.length > 0;
  (hasRows ? rows : [['Tidak ada data untuk filter ini']]).forEach((r) => aoa.push(r));
  const totalStart = aoa.length;
  if (hasRows) totalRows.forEach((r) => aoa.push(r));

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const merges = [0, 1, 2, 3].map((r) => ({ s: { r, c: 0 }, e: { r, c: cols - 1 } }));
  if (!hasRows) merges.push({ s: { r: hr + 1, c: 0 }, e: { r: hr + 1, c: cols - 1 } });
  ws['!merges'] = merges;
  ws['!cols'] = widths.map((w) => ({ wch: w }));
  ws['!rows'] = [{ hpt: 28 }, { hpt: 22 }, { hpt: 16 }, { hpt: 16 }, { hpt: 8 }, { hpt: 32 }];

  const cell = (r, c) => {
    const a = XLSX.utils.encode_cell({ r, c });
    if (!ws[a]) ws[a] = { t: 's', v: '' };
    return ws[a];
  };

  cell(0, 0).s = { font: { bold: true, sz: 18, color: { rgb: C.navy } } };
  cell(1, 0).s = { font: { bold: true, sz: 14, color: { rgb: '8A6D00' } } };
  cell(2, 0).s = { font: { sz: 10, color: { rgb: '666666' } } };
  cell(3, 0).s = { font: { sz: 10, italic: true, color: { rgb: '666666' } } };

  for (let c = 0; c < cols; c++) {
    cell(hr, c).s = {
      font: { bold: true, sz: 11, color: { rgb: headerFont } },
      fill: { patternType: 'solid', fgColor: { rgb: headerFill } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: BORDER,
    };
  }

  if (hasRows) {
    rows.forEach((r, i) => {
      for (let c = 0; c < cols; c++) {
        const f = formats[c];
        const x = cell(hr + 1 + i, c);
        x.s = {
          border: BORDER,
          alignment: { vertical: 'top', horizontal: f ? 'right' : 'left', wrapText: !f },
          ...(i % 2 ? { fill: { patternType: 'solid', fgColor: { rgb: C.zebra } } } : {}),
        };
        if (f && x.t === 'n') x.z = f;
      }
    });
    totalRows.forEach((r, i) => {
      for (let c = 0; c < cols; c++) {
        const f = formats[c];
        const x = cell(totalStart + i, c);
        x.s = {
          font: { bold: true },
          fill: { patternType: 'solid', fgColor: { rgb: C.goldSoft } },
          border: { ...BORDER, top: { style: 'medium', color: { rgb: C.navy } } },
          alignment: { vertical: 'center', horizontal: f ? 'right' : 'left' },
        };
        if (f && x.t === 'n') x.z = f;
      }
    });
  } else {
    cell(hr + 1, 0).s = { font: { italic: true, color: { rgb: '666666' } }, border: BORDER };
  }
  return ws;
}

const sum = (arr, fn) => arr.reduce((s, x) => s + (Number(fn(x)) || 0), 0);

function orderOf(kategori) {
  return CATEGORIES.findIndex((c) => c.key === kategori);
}

/* ============================== TEMPLATE ============================== */

export function downloadTemplate(kategori) {
  const cat = CAT[kategori];
  const headers = ['Kode', 'Nama Barang', 'Satuan', 'Jumlah/Stok Awal', 'Stok Minimum', 'Harga', 'Lokasi', 'Kondisi', 'Keterangan'];
  const samples = (DUMMY[kategori] || [])
    .slice(0, 2)
    .map((d) => ['', d[0], d[1], d[2], d[3], d[4], d[5], d[6], 'CONTOH - hapus baris ini sebelum import']);
  const ws = buildSheet({
    title: `Template ${cat.label}`,
    subtitle: cat.hint,
    headers,
    rows: samples,
    widths: [14, 36, 10, 18, 14, 16, 24, 14, 40],
    formats: { 3: FMT_INT, 4: FMT_INT, 5: FMT_RP },
    headerFill: C.gold,
    headerFont: C.navy,
  });

  const guide = [
    ['PETUNJUK PENGISIAN'],
    [''],
    ['1. Isi data mulai di bawah baris judul kolom (baris berwarna emas). Hapus baris CONTOH.'],
    ['2. Kolom wajib: Nama Barang. Kolom lain boleh kosong.'],
    ['3. Kode: kosongkan agar dibuat otomatis (mis. ' + cat.prefix + '-001).'],
    ['4. Satuan: Pcs, Box, Set, atau Unit.'],
    ['5. Jumlah/Stok Awal dan Harga diisi angka (tanpa teks).'],
    ['6. Kategori ini: ' + cat.label + '. ' + cat.hint],
    ['7. Nama kolom boleh berbeda; saat import Anda bisa memilih pemetaan kolomnya.'],
  ];
  const wsGuide = XLSX.utils.aoa_to_sheet(guide);
  wsGuide['!cols'] = [{ wch: 110 }];
  wsGuide.A1.s = { font: { bold: true, sz: 14, color: { rgb: C.navy } } };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Petunjuk');
  saveWorkbook(wb, `Template_Import_${cat.short.replace(/\s+/g, '_')}.xlsx`).catch((e) => console.error('Gagal menyimpan Excel', e));
}

/* ============================== EXPORT ============================== */

export function exportLaporan({ items, tx, opnames, from, to, kategori, jenis }) {
  const katLabel = kategori === 'all' ? 'Semua Kategori' : CAT[kategori].label;
  const jenisLabel = jenis === 'all' ? 'Semua Jenis' : JENIS[jenis].label;
  const periode = `Periode: ${fmtDate(from)} s/d ${fmtDate(to)}  |  Kategori: ${katLabel}  |  Jenis: ${jenisLabel}`;

  // Sheet 1 - Ringkasan Stok Akhir per barang
  const itemsF = items
    .filter((i) => kategori === 'all' || i.kategori === kategori)
    .sort((a, b) => orderOf(a.kategori) - orderOf(b.kategori) || String(a.kode).localeCompare(String(b.kode), 'id', { numeric: true }));
  const rows1 = itemsF.map((i) => [
    i.kode, i.nama, CAT[i.kategori]?.label || i.kategori, i.satuan,
    Number(i.stokAwal) || 0, Number(i.totalMasuk) || 0, Number(i.totalTerpakai) || 0,
    Number(i.totalRusak) || 0, Number(i.totalHilang) || 0, Number(i.sisa) || 0,
    Number(i.stokMinimum) || 0, Number(i.harga) || 0, (Number(i.sisa) || 0) * (Number(i.harga) || 0),
    STATUS_LABEL[statusStok(i)], i.lokasi || '',
  ]);
  const ws1 = buildSheet({
    title: 'Ringkasan Stok Akhir per Barang',
    subtitle: `Posisi stok saat dicetak  |  Kategori: ${katLabel}`,
    headers: ['Kode', 'Nama Barang', 'Kategori', 'Satuan', 'Stok Awal', 'Total Masuk', 'Total Terpakai', 'Total Rusak', 'Total Hilang', 'Sisa Stok', 'Stok Min', 'Harga Satuan', 'Nilai Stok', 'Status', 'Lokasi'],
    rows: rows1,
    totalRows: [[
      'TOTAL', '', '', '',
      sum(itemsF, (i) => i.stokAwal), sum(itemsF, (i) => i.totalMasuk), sum(itemsF, (i) => i.totalTerpakai),
      sum(itemsF, (i) => i.totalRusak), sum(itemsF, (i) => i.totalHilang), sum(itemsF, (i) => i.sisa),
      '', '', sum(itemsF, (i) => (Number(i.sisa) || 0) * (Number(i.harga) || 0)), '', '',
    ]],
    widths: [12, 34, 28, 9, 11, 12, 13, 11, 11, 11, 10, 15, 17, 11, 22],
    formats: { 4: FMT_INT, 5: FMT_INT, 6: FMT_INT, 7: FMT_INT, 8: FMT_INT, 9: FMT_INT, 10: FMT_INT, 11: FMT_RP, 12: FMT_RP },
  });

  // Sheet 2 - Detail Transaksi
  const txSorted = [...tx].sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)));
  const txF = txSorted.filter((t) => jenis === 'all' || t.jenis === jenis);
  const rows2 = txF.map((t) => [
    fmtDate(t.tanggal), t.kode, t.nama, CAT[t.kategori]?.label || t.kategori, JENIS[t.jenis]?.label || t.jenis,
    Number(t.jumlah) || 0, Number(t.sisaSetelah) || 0, t.keterangan || '', t.petugas || '',
  ]);
  const totals2 = Object.keys(JENIS)
    .filter((k) => jenis === 'all' || jenis === k)
    .map((k) => [`Total ${JENIS[k].short}`, '', '', '', '', sum(txF.filter((t) => t.jenis === k), (t) => t.jumlah), '', '', '']);
  const ws2 = buildSheet({
    title: 'Detail Transaksi Stok',
    subtitle: periode,
    headers: ['Tanggal', 'Kode', 'Nama Barang', 'Kategori', 'Jenis Transaksi', 'Jumlah', 'Sisa Setelah Transaksi', 'Keterangan', 'Petugas'],
    rows: rows2,
    totalRows: totals2,
    widths: [12, 12, 34, 28, 16, 10, 16, 50, 20],
    formats: { 5: FMT_INT, 6: FMT_INT },
  });

  // Sheet 3 - Rekap Rusak & Hilang (tidak terpengaruh filter jenis)
  const rh = txSorted.filter((t) => t.jenis === 'rusak' || t.jenis === 'hilang');
  const rows3 = rh.map((t) => [
    fmtDate(t.tanggal), t.kode, t.nama, CAT[t.kategori]?.label || t.kategori, JENIS[t.jenis].label,
    Number(t.jumlah) || 0, Number(t.harga) || 0, (Number(t.jumlah) || 0) * (Number(t.harga) || 0),
    t.penyebab || t.kronologi || t.keterangan || '', t.penanggungJawab || t.petugas || '',
  ]);
  const ws3 = buildSheet({
    title: 'Rekap Barang Rusak & Hilang',
    subtitle: `Periode: ${fmtDate(from)} s/d ${fmtDate(to)}  |  Kategori: ${katLabel}`,
    headers: ['Tanggal', 'Kode', 'Nama Barang', 'Kategori', 'Jenis', 'Jumlah', 'Harga Satuan', 'Nilai Kerugian', 'Penyebab / Kronologi', 'Penanggung Jawab / Petugas'],
    rows: rows3,
    totalRows: [['TOTAL', '', '', '', '', sum(rh, (t) => t.jumlah), '', sum(rh, (t) => (Number(t.jumlah) || 0) * (Number(t.harga) || 0)), '', '']],
    widths: [12, 12, 34, 28, 14, 10, 15, 17, 46, 26],
    formats: { 5: FMT_INT, 6: FMT_RP, 7: FMT_RP },
  });

  // Sheet 4 - Hasil Stock Opname
  const ws4 = sheetOpname(opnames, `Periode: ${fmtDate(from)} s/d ${fmtDate(to)}  |  Kategori: ${katLabel}`);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, 'Ringkasan Stok Akhir');
  XLSX.utils.book_append_sheet(wb, ws2, 'Detail Transaksi');
  XLSX.utils.book_append_sheet(wb, ws3, 'Rekap Rusak & Hilang');
  XLSX.utils.book_append_sheet(wb, ws4, 'Hasil Stock Opname');
  saveWorkbook(wb, `Laporan_BISNIS_HOTEL_${from}_sd_${to}.xlsx`).catch((e) => console.error('Gagal menyimpan Excel', e));
}

function sheetOpname(opnames, subtitle) {
  const sorted = [...opnames].sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)));
  const rows = sorted.map((o) => [
    fmtDate(o.tanggal), o.sesi || '', o.kode, o.nama, CAT[o.kategori]?.label || o.kategori,
    Number(o.stokSistem) || 0, Number(o.stokFisik) || 0, Number(o.selisih) || 0,
    Number(o.harga) || 0, Number(o.nilaiSelisih) || 0, o.catatan || '', o.petugas || '',
  ]);
  return buildSheet({
    title: 'Hasil Stock Opname',
    subtitle,
    headers: ['Tanggal', 'Sesi SO', 'Kode', 'Nama Barang', 'Kategori', 'Stok Sistem', 'Stok Fisik', 'Selisih', 'Harga Satuan', 'Nilai Selisih', 'Catatan', 'Petugas'],
    rows,
    totalRows: [['TOTAL', '', '', '', '', sum(sorted, (o) => o.stokSistem), sum(sorted, (o) => o.stokFisik), sum(sorted, (o) => o.selisih), '', sum(sorted, (o) => o.nilaiSelisih), '', '']],
    widths: [12, 24, 12, 34, 28, 12, 12, 10, 15, 17, 30, 20],
    formats: { 5: FMT_INT, 6: FMT_INT, 7: FMT_INT, 8: FMT_RP, 9: FMT_RP },
  });
}

export function exportOpname(opnames, label = 'Semua Sesi') {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetOpname(opnames, `Sesi: ${label}`), 'Hasil Stock Opname');
  const stamp = new Date().toISOString().slice(0, 10);
  saveWorkbook(wb, `Hasil_Stock_Opname_BISNIS_HOTEL_${stamp}.xlsx`).catch((e) => console.error('Gagal menyimpan Excel', e));
}
