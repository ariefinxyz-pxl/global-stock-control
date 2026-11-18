export const APP_NAME = 'GLOBAL STOCK CONTROL';
export const HOTEL_NAME = 'BISNIS HOTEL';

// 6 kategori inventory (wajib)
export const CATEGORIES = [
  {
    key: 'cafe',
    label: 'Inventory Cafe',
    short: 'Cafe',
    prefix: 'CAF',
    color: '#D4AF37',
    hint: 'Khusus alat, aksesoris & perlengkapan cafe. BUKAN bahan baku / food cost (kopi, susu, gula, dll).',
  },
  {
    key: 'daily-hk',
    label: 'Inventory Daily Housekeeping',
    short: 'Daily HK',
    prefix: 'DHK',
    color: '#38BDF8',
    hint: 'Chemical harian, amenities, tissue, sapu, dll.',
  },
  {
    key: 'linen',
    label: 'Inventory Housekeeping - Linen',
    short: 'Linen',
    prefix: 'LIN',
    color: '#34D399',
    hint: 'Handuk, sprei, selimut, sarung bantal.',
  },
  {
    key: 'engineering',
    label: 'Inventory Engineering',
    short: 'Engineering',
    prefix: 'ENG',
    color: '#FB923C',
    hint: 'Lampu, baut, obeng, sparepart, alat teknik.',
  },
  {
    key: 'meeting',
    label: 'Inventory Meeting Room',
    short: 'Meeting Room',
    prefix: 'MTG',
    color: '#A78BFA',
    hint: 'ATK, proyektor, mic, kabel, kursi, meja.',
  },
  {
    key: 'uniform',
    label: 'Inventory Uniform',
    short: 'Uniform',
    prefix: 'UNF',
    color: '#FB7185',
    hint: 'Seragam staff, apron, name tag, topi.',
  },
];

export const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));

export const SATUAN = ['Pcs', 'Box', 'Set', 'Unit'];
export const KONDISI = ['Baik', 'Cukup Baik', 'Rusak Ringan', 'Rusak Berat'];

export const JENIS = {
  masuk: { label: 'Stok Masuk', short: 'Masuk', field: 'totalMasuk', sign: 1 },
  terpakai: { label: 'Stok Terpakai', short: 'Terpakai', field: 'totalTerpakai', sign: -1 },
  rusak: { label: 'Stok Rusak', short: 'Rusak', field: 'totalRusak', sign: -1 },
  hilang: { label: 'Stok Hilang', short: 'Hilang', field: 'totalHilang', sign: -1 },
};

export const ROLES = { admin: 'Admin', staff: 'Staff', viewer: 'Viewer', nonaktif: 'Nonaktif' };
