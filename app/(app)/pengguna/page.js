'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { KeyRound, Loader2, UserPlus } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { PageHeader } from '@/components/page-header';
import { AccessDenied } from '@/components/access-denied';
import { DataTable } from '@/components/data-table';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/toast';
import { useAuth } from '@/lib/auth-context';
import { ROLES } from '@/lib/constants';
import { createUserAccount, setUserRole } from '@/lib/actions';
import { fmtDateTime } from '@/lib/utils';

const ROLE_BADGE = { admin: 'default', staff: 'info', viewer: 'muted', nonaktif: 'danger' };

const AUTH_ERRORS = {
  'auth/email-already-in-use': 'Email sudah terdaftar.',
  'auth/invalid-email': 'Format email tidak valid.',
  'auth/weak-password': 'Password terlalu lemah (minimal 6 karakter).',
  'auth/operation-not-allowed': 'Metode Email/Password belum diaktifkan di Firebase Authentication.',
};

const blank = { nama: '', email: '', password: '', role: 'staff' };

export default function PenggunaPage() {
  const { isAdmin, actor, user } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!db || !isAdmin) return undefined;
    return onSnapshot(
      collection(db, 'users'),
      (snap) => {
        setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setLoading(false);
      }
    );
  }, [isAdmin]);

  if (!isAdmin) return <AccessDenied />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.nama.trim() || !form.email.trim()) return setError('Nama dan email wajib diisi.');
    if (form.password.length < 6) return setError('Password minimal 6 karakter.');
    setSaving(true);
    try {
      await createUserAccount({ ...form, nama: form.nama.trim(), email: form.email.trim().toLowerCase() }, actor);
      toast({ title: 'Pengguna dibuat', description: `${form.email} (${ROLES[form.role]})`, variant: 'success' });
      setForm(blank);
      setOpen(false);
    } catch (err) {
      console.error(err);
      setError(AUTH_ERRORS[err.code] || err.message || 'Gagal membuat pengguna.');
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (u, role) => {
    try {
      await setUserRole(u.id, u.email, role, actor);
      toast({ title: 'Role diperbarui', description: `${u.email} → ${ROLES[role]}`, variant: 'success' });
    } catch (e) {
      toast({ title: 'Gagal mengubah role', description: e.message, variant: 'error' });
    }
  };

  const resetPassword = async (u) => {
    try {
      await sendPasswordResetEmail(auth, u.email);
      toast({ title: 'Email reset password dikirim', description: u.email, variant: 'success' });
    } catch (e) {
      toast({ title: 'Gagal mengirim email', description: e.message, variant: 'error' });
    }
  };

  const columns = [
    { key: 'nama', header: 'Nama', cell: (u) => <span className="font-medium">{u.nama || '-'}</span> },
    { key: 'email', header: 'Email' },
    {
      key: 'role',
      header: 'Role',
      accessor: (u) => ROLES[u.role] || u.role,
      cell: (u) =>
        u.id === user?.uid ? (
          <Badge variant={ROLE_BADGE[u.role]}>{ROLES[u.role]} (Anda)</Badge>
        ) : (
          <Select value={u.role || 'viewer'} onChange={(e) => changeRole(u, e.target.value)} className="h-9 w-36">
            {Object.entries(ROLES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        ),
    },
    { key: 'createdAt', header: 'Dibuat', className: 'hidden md:table-cell', accessor: (u) => u.createdAt?.seconds || 0, cell: (u) => <span className="text-xs">{fmtDateTime(u.createdAt)}</span> },
    {
      key: 'aksi',
      header: 'Aksi',
      align: 'right',
      cell: (u) => (
        <Button variant="ghost" size="sm" onClick={() => resetPassword(u)} title="Kirim email reset password">
          <KeyRound className="h-4 w-4" /> Reset Password
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Pengguna"
        description="Kelola akun dan hak akses staff."
        actions={
          <Button onClick={() => setOpen(true)}>
            <UserPlus className="h-4 w-4" /> Tambah Pengguna
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="grid gap-3 pt-5 text-sm sm:grid-cols-3">
          <div>
            <Badge variant="default">Admin</Badge>
            <p className="mt-1.5 text-muted-foreground">Akses penuh: master barang, import, stock opname, pengguna.</p>
          </div>
          <div>
            <Badge variant="info">Staff</Badge>
            <p className="mt-1.5 text-muted-foreground">Input transaksi (masuk, terpakai, rusak, hilang) dan stock opname.</p>
          </div>
          <div>
            <Badge variant="muted">Viewer</Badge>
            <p className="mt-1.5 text-muted-foreground">Hanya melihat data dan laporan. “Nonaktif” = akun diblokir.</p>
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={users}
        loading={loading}
        searchText={(u) => `${u.nama || ''} ${u.email || ''} ${ROLES[u.role] || ''}`}
        searchPlaceholder="Cari nama / email..."
        emptyText="Belum ada pengguna."
      />

      <Modal
        open={open}
        onClose={saving ? undefined : () => setOpen(false)}
        title="Tambah Pengguna"
        description="Akun baru dapat langsung login dengan email & password ini."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Batal
            </Button>
            <Button type="submit" form="form-user" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Simpan
            </Button>
          </>
        }
      >
        <form id="form-user" onSubmit={submit} className="space-y-4">
          <Field label="Nama lengkap" required>
            <Input value={form.nama} onChange={set('nama')} autoComplete="off" />
          </Field>
          <Field label="Email" required>
            <Input type="email" value={form.email} onChange={set('email')} autoComplete="off" />
          </Field>
          <Field label="Password awal" required hint="Minimal 6 karakter. Pengguna dapat meresetnya lewat email.">
            <Input type="password" value={form.password} onChange={set('password')} autoComplete="new-password" />
          </Field>
          <Field label="Role" required>
            <Select value={form.role} onChange={set('role')}>
              <option value="admin">Admin</option>
              <option value="staff">Staff</option>
              <option value="viewer">Viewer</option>
            </Select>
          </Field>
          {error && <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
        </form>
      </Modal>
    </div>
  );
}
