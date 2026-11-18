import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const fmtNumber = (n) =>
  new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(Number(n) || 0);

export const fmtRupiah = (n) =>
  'Rp ' + new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.round(Number(n) || 0));

// Tanggal lokal (bukan UTC) dalam format YYYY-MM-DD
export function todayISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function monthStartISO() {
  return todayISO().slice(0, 8) + '01';
}

export function fmtDate(iso) {
  if (!iso || typeof iso !== 'string') return '-';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function fmtDateTime(ts) {
  const d = ts && typeof ts.toDate === 'function' ? ts.toDate() : ts ? new Date(ts) : null;
  if (!d || Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// RUMUS: Sisa Stok = Stok Awal + Total Masuk - Total Terpakai - Total Rusak - Total Hilang
export function hitungSisa(stokAwal, t = {}) {
  return (
    (Number(stokAwal) || 0) +
    (Number(t.totalMasuk) || 0) -
    (Number(t.totalTerpakai) || 0) -
    (Number(t.totalRusak) || 0) -
    (Number(t.totalHilang) || 0)
  );
}

// Aman (hijau) | Menipis (kuning, sisa <= stok minimum) | Habis (merah, sisa <= 0)
export function statusStok(item) {
  const sisa = Number(item.sisa) || 0;
  const min = Number(item.stokMinimum) || 0;
  if (sisa <= 0) return 'habis';
  if (sisa <= min) return 'menipis';
  return 'aman';
}

export const STATUS_LABEL = { aman: 'Aman', menipis: 'Menipis', habis: 'Habis' };

export const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Pengaman kategori Cafe: hanya alat/aksesoris/perlengkapan, bukan bahan baku.
// Nama ditandai bahan baku hanya jika memuat kata bahan (kopi, susu, gula, ...) DAN tidak memuat
// kata alat/wadah (tempat, gelas, teko, kursi, ...). Kata warna "coklat" sengaja tidak dihitung.
const BAHAN_BAKU = /\b(kopi|coffee|susu|milk|gula|sugar|sirup|syrup|creamer|krimer|teh|tea|bubuk|powder|whipping|es batu)\b/i;
const NAMA_ALAT = /\b(gelas|cangkir|mug|cup|sendok|sedok|garpu|mesin|machine|grinder|press|tray|nampan|napan|apron|teko|kettle|pitcher|tamper|filter|saringan|dripper|server|scale|timbangan|thermometer|termometer|piring|saucer|tatakan|toples|stoples|tempat|wadah|dispenser|blender|shaker|jug|stand|rak|lap|serbet|botol|knock|brush|sikat|maker|brewer|canister|holder|warmer|pot|poci|ceret|decanter|kursi|meja|tissue|cover|sarung|mangkok|bowl|alas|kain)/i;

export function isBahanBaku(nama) {
  const s = String(nama || '');
  return BAHAN_BAKU.test(s) && !NAMA_ALAT.test(s);
}
