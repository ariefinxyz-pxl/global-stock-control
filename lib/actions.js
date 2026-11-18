// Semua operasi tulis ke Firestore.
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { getApps, initializeApp } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { db, firebaseConfig } from './firebase';
import { CAT, CATEGORIES, JENIS } from './constants';
import { chunk, hitungSisa, norm } from './utils';
import { DUMMY } from './dummy';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Firestore menolak nilai undefined
const clean = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

/* ------------------------------ Audit log ------------------------------ */

export async function logAudit(actor, aksi, detail, extra = {}) {
  try {
    await addDoc(
      collection(db, 'auditLogs'),
      clean({
        aksi,
        detail,
        uid: actor?.uid,
        user: actor?.nama,
        email: actor?.email,
        createdAt: serverTimestamp(),
        ...extra,
      })
    );
  } catch (e) {
    console.error('Gagal menulis audit log', e);
  }
}

/* --------------------------- Kode barang otomatis ----------------------- */

export function maxNumber(items, kategori) {
  const prefix = CAT[kategori].prefix;
  const re = new RegExp(`^${prefix}-(\\d+)$`, 'i');
  let max = 0;
  items.forEach((i) => {
    if (i.kategori !== kategori) return;
    const m = re.exec(String(i.kode || '').trim());
    if (m) max = Math.max(max, Number(m[1]));
  });
  return max;
}

export function parseKodeNumber(kode, kategori) {
  const m = new RegExp(`^${CAT[kategori].prefix}-(\\d+)$`, 'i').exec(String(kode || '').trim());
  return m ? Number(m[1]) : null;
}

// Mengambil n kode berurutan (CAF-001, CAF-002, ...) memakai counter per kategori.
export async function nextCodes(kategori, n = 1, minLast = 0) {
  const prefix = CAT[kategori].prefix;
  const cref = doc(db, 'counters', kategori);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(cref);
    const last = Math.max(snap.exists() ? num(snap.data().last) : 0, minLast);
    tx.set(cref, { last: last + n });
    return Array.from({ length: n }, (_, i) => `${prefix}-${String(last + i + 1).padStart(3, '0')}`);
  });
}

/* ------------------------------ Master item ----------------------------- */

export async function createItem(data, actor, existingItems) {
  const kategori = data.kategori;
  const [kode] = await nextCodes(kategori, 1, maxNumber(existingItems, kategori));
  const stokAwal = num(data.stokAwal);
  await addDoc(
    collection(db, 'items'),
    clean({
      kode,
      nama: data.nama.trim(),
      kategori,
      satuan: data.satuan,
      stokMinimum: num(data.stokMinimum),
      harga: num(data.harga),
      lokasi: (data.lokasi || '').trim(),
      kondisi: data.kondisi,
      deskripsi: (data.deskripsi || '').trim(),
      stokAwal,
      totalMasuk: 0,
      totalTerpakai: 0,
      totalRusak: 0,
      totalHilang: 0,
      sisa: stokAwal,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  );
  await logAudit(actor, 'item-baru', `Menambah barang ${kode} - ${data.nama.trim()}`);
  return kode;
}

export async function updateItem(item, data, actor) {
  const stokAwal = num(data.stokAwal);
  const patch = {
    nama: data.nama.trim(),
    satuan: data.satuan,
    stokMinimum: num(data.stokMinimum),
    harga: num(data.harga),
    lokasi: (data.lokasi || '').trim(),
    kondisi: data.kondisi,
    deskripsi: (data.deskripsi || '').trim(),
    stokAwal,
    sisa: hitungSisa(stokAwal, item),
    updatedAt: serverTimestamp(),
  };
  await updateDoc(doc(db, 'items', item.id), patch);
  await logAudit(actor, 'item-ubah', `Mengubah barang ${item.kode} - ${patch.nama}`);
}

export async function deleteItem(item, actor) {
  await deleteDoc(doc(db, 'items', item.id));
  await logAudit(actor, 'item-hapus', `Menghapus barang ${item.kode} - ${item.nama}`);
}

/* ------------------------------- Transaksi ------------------------------ */

function susunKeterangan(jenis, d) {
  const p = [];
  if (jenis === 'masuk') {
    if (d.supplier) p.push(`Supplier: ${d.supplier}`);
    if (d.noInvoice) p.push(`Invoice: ${d.noInvoice}`);
  }
  if (jenis === 'terpakai') {
    if (d.keperluan) p.push(`Keperluan: ${d.keperluan}`);
    if (d.pemakai) p.push(`Pemakai: ${d.pemakai}`);
  }
  if (jenis === 'rusak' && d.penyebab) p.push(`Penyebab: ${d.penyebab}`);
  if (jenis === 'hilang') {
    if (d.kronologi) p.push(`Kronologi: ${d.kronologi}`);
    if (d.penanggungJawab) p.push(`PJ: ${d.penanggungJawab}`);
  }
  if (d.catatan) p.push(d.catatan);
  return p.join(' | ');
}

export async function addTransaction({ itemId, jenis, jumlah, tanggal, detail = {} }, actor) {
  const qty = num(jumlah);
  if (!(qty > 0)) throw new Error('Jumlah harus lebih dari 0.');
  const meta = JENIS[jenis];
  if (!meta) throw new Error('Jenis transaksi tidak dikenal.');

  const itemRef = doc(db, 'items', itemId);
  const txRef = doc(collection(db, 'transactions'));
  const auditRef = doc(collection(db, 'auditLogs'));

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(itemRef);
    if (!snap.exists()) throw new Error('Barang tidak ditemukan.');
    const it = snap.data();
    const totals = {
      totalMasuk: num(it.totalMasuk),
      totalTerpakai: num(it.totalTerpakai),
      totalRusak: num(it.totalRusak),
      totalHilang: num(it.totalHilang),
    };
    const sisaSebelum = hitungSisa(it.stokAwal, totals);
    totals[meta.field] += qty;
    const sisa = hitungSisa(it.stokAwal, totals);
    if (meta.sign < 0 && sisa < 0) {
      throw new Error(`Stok tidak cukup. Sisa saat ini ${sisaSebelum} ${it.satuan || ''}.`.trim());
    }
    const keterangan = susunKeterangan(jenis, detail);

    tx.update(itemRef, { ...totals, sisa, updatedAt: serverTimestamp() });
    tx.set(
      txRef,
      clean({
        itemId,
        kode: it.kode,
        nama: it.nama,
        kategori: it.kategori,
        satuan: it.satuan,
        harga: num(it.harga),
        jenis,
        jumlah: qty,
        sisaSebelum,
        sisaSetelah: sisa,
        tanggal,
        keterangan,
        supplier: detail.supplier,
        noInvoice: detail.noInvoice,
        keperluan: detail.keperluan,
        pemakai: detail.pemakai,
        penyebab: detail.penyebab,
        kronologi: detail.kronologi,
        penanggungJawab: detail.penanggungJawab,
        catatan: detail.catatan,
        petugas: actor.nama,
        petugasUid: actor.uid,
        petugasEmail: actor.email,
        createdAt: serverTimestamp(),
      })
    );
    tx.set(
      auditRef,
      clean({
        aksi: `transaksi-${jenis}`,
        detail: `${meta.label}: ${it.kode} - ${it.nama} x${qty} (sisa ${sisa})`,
        uid: actor.uid,
        user: actor.nama,
        email: actor.email,
        createdAt: serverTimestamp(),
      })
    );
    return { sisa, kode: it.kode, nama: it.nama };
  });
}

/* ------------------------------ Stock Opname ---------------------------- */

export async function saveOpname({ sesi, tanggal, rows, apply }, actor) {
  const sessionId = `SO-${tanggal.replace(/-/g, '')}-${Date.now().toString(36).toUpperCase()}`;
  let totalSelisih = 0;
  let totalNilai = 0;

  for (const part of chunk(rows, 200)) {
    const batch = writeBatch(db);
    part.forEach((r) => {
      const it = r.item;
      const stokSistem = num(it.sisa);
      const selisih = r.fisik - stokSistem;
      const nilai = selisih * num(it.harga);
      totalSelisih += selisih;
      totalNilai += nilai;
      batch.set(
        doc(collection(db, 'opnames')),
        clean({
          sessionId,
          sesi,
          tanggal,
          itemId: it.id,
          kode: it.kode,
          nama: it.nama,
          kategori: it.kategori,
          satuan: it.satuan,
          harga: num(it.harga),
          stokSistem,
          stokFisik: r.fisik,
          selisih,
          nilaiSelisih: nilai,
          catatan: r.catatan || '',
          diterapkan: Boolean(apply),
          petugas: actor.nama,
          petugasUid: actor.uid,
          createdAt: serverTimestamp(),
        })
      );
      if (apply && selisih !== 0) {
        const stokAwal = num(it.stokAwal) + selisih;
        batch.update(doc(db, 'items', it.id), {
          stokAwal,
          sisa: hitungSisa(stokAwal, it),
          updatedAt: serverTimestamp(),
        });
      }
    });
    await batch.commit();
  }
  await logAudit(
    actor,
    'stock-opname',
    `${sesi}: ${rows.length} barang dihitung, total selisih ${totalSelisih}${apply ? ' (diterapkan ke stok sistem)' : ''}`
  );
  return { sessionId, totalSelisih, totalNilai };
}

/* --------------------------------- Import ------------------------------- */

// rows: [{ action: 'create'|'update'|'skip', data, existing }]
export async function importCategory(kategori, rows, actor, existingItems, onProgress) {
  const cat = CAT[kategori];
  const toCreate = rows.filter((r) => r.action === 'create');
  const toUpdate = rows.filter((r) => r.action === 'update' && r.existing);
  const skipped = rows.length - toCreate.length - toUpdate.length;

  // Kode eksplisit dari Excel dipakai selama belum terpakai; selain itu dibuat otomatis.
  const used = new Set(existingItems.map((i) => String(i.kode || '').toLowerCase()));
  toCreate.forEach((r) => {
    const k = String(r.data.kode || '').trim();
    if (k && !used.has(k.toLowerCase())) {
      used.add(k.toLowerCase());
      r.kodeFinal = k.toUpperCase();
    } else {
      r.kodeFinal = '';
    }
  });
  const explicitNums = toCreate
    .map((r) => (r.kodeFinal ? parseKodeNumber(r.kodeFinal, kategori) : null))
    .filter((n) => n != null);
  const minLast = Math.max(maxNumber(existingItems, kategori), 0, ...explicitNums);
  const needAuto = toCreate.filter((r) => !r.kodeFinal);
  if (needAuto.length) {
    const codes = await nextCodes(kategori, needAuto.length, minLast);
    needAuto.forEach((r, i) => {
      r.kodeFinal = codes[i];
    });
  }

  const ops = [];
  toCreate.forEach((r) => {
    const d = r.data;
    const ref = doc(collection(db, 'items'));
    ops.push((b) =>
      b.set(ref, {
        kode: r.kodeFinal,
        nama: d.nama,
        kategori,
        satuan: d.satuan,
        stokMinimum: num(d.stokMinimum),
        harga: num(d.harga),
        lokasi: d.lokasi || '',
        kondisi: d.kondisi || 'Baik',
        deskripsi: d.deskripsi || '',
        stokAwal: num(d.stokAwal),
        totalMasuk: 0,
        totalTerpakai: 0,
        totalRusak: 0,
        totalHilang: 0,
        sisa: num(d.stokAwal),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });
  // "Update Stok": Stok Awal ditimpa dengan jumlah dari Excel, sisa dihitung ulang dengan rumus.
  toUpdate.forEach((r) => {
    const it = r.existing;
    const stokAwal = num(r.data.stokAwal);
    const patch = { stokAwal, sisa: hitungSisa(stokAwal, it), updatedAt: serverTimestamp() };
    if (num(r.data.harga) > 0) patch.harga = num(r.data.harga);
    if (r.data.lokasi) patch.lokasi = r.data.lokasi;
    ops.push((b) => b.update(doc(db, 'items', it.id), patch));
  });

  let done = 0;
  for (const part of chunk(ops, 450)) {
    const batch = writeBatch(db);
    part.forEach((fn) => fn(batch));
    await batch.commit();
    done += part.length;
    if (onProgress) onProgress(done, ops.length);
  }

  await logAudit(
    actor,
    'import',
    `Import ${cat.label}: ${toCreate.length} baru, ${toUpdate.length} update stok, ${skipped} dilewati`
  );
  return { created: toCreate.length, updated: toUpdate.length, skipped };
}

export async function seedDummy(actor, existingItems) {
  let total = 0;
  for (const c of CATEGORIES) {
    const rows = (DUMMY[c.key] || []).map((d) => ({
      action: 'create',
      data: {
        kode: '',
        nama: d[0],
        satuan: d[1],
        stokAwal: d[2],
        stokMinimum: d[3],
        harga: d[4],
        lokasi: d[5],
        kondisi: d[6],
        deskripsi: 'Data contoh (dummy)',
      },
    }));
    const r = await importCategory(c.key, rows, actor, existingItems);
    total += r.created;
  }
  return total;
}

/* -------------------------------- Pengguna ------------------------------ */

// Membuat akun login baru lewat aplikasi Firebase kedua, supaya admin tidak ikut logout.
export async function createUserAccount({ nama, email, password, role }, actor) {
  const name = 'secondary-auth';
  const secondary = getApps().find((a) => a.name === name) || initializeApp(firebaseConfig, name);
  const secAuth = getAuth(secondary);
  const cred = await createUserWithEmailAndPassword(secAuth, email, password);
  const uid = cred.user.uid;
  await signOut(secAuth);
  await setDoc(doc(db, 'users', uid), {
    email,
    nama,
    role,
    createdAt: serverTimestamp(),
  });
  await logAudit(actor, 'user-baru', `Membuat akun ${email} (${role})`);
  return uid;
}

export async function setUserRole(uid, email, role, actor) {
  await updateDoc(doc(db, 'users', uid), { role });
  await logAudit(actor, 'user-role', `Mengubah role ${email} menjadi ${role}`);
}

export { norm };

/* ------------------------------- Data contoh ---------------------------- */

export const isDummyItem = (i) => i.deskripsi === 'Data contoh (dummy)';

// Menghapus barang dummy lalu menyesuaikan counter kode agar kode asli mulai dari nomor yang wajar.
export async function deleteDummyItems(items, actor) {
  const dummy = items.filter(isDummyItem);
  for (const part of chunk(dummy, 400)) {
    const batch = writeBatch(db);
    part.forEach((i) => batch.delete(doc(db, 'items', i.id)));
    await batch.commit();
  }
  const rest = items.filter((i) => !isDummyItem(i));
  for (const c of CATEGORIES) {
    await setDoc(doc(db, 'counters', c.key), { last: maxNumber(rest, c.key) });
  }
  await logAudit(actor, 'hapus-contoh', `Menghapus ${dummy.length} data contoh (dummy)`);
  return dummy.length;
}
