'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebase';

const AuthCtx = createContext({
  user: null,
  profile: null,
  role: null,
  loading: true,
  isAdmin: false,
  canWrite: false,
  canView: false,
  nama: '',
  actor: null,
  logout: () => {},
});

export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return undefined;
    }
    let unsubProfile = null;
    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }
      setUser(u);
      setProfile(null);
      if (!u) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const ref = doc(db, 'users', u.uid);
      try {
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          // Login pertama: dokumen profil dibuat dengan role "viewer".
          // Admin dapat menaikkan role dari menu Pengguna.
          await setDoc(ref, {
            email: u.email,
            nama: u.displayName || (u.email || '').split('@')[0],
            role: 'viewer',
            createdAt: serverTimestamp(),
          });
        }
      } catch (e) {
        console.error('Gagal memuat profil pengguna', e);
      }
      unsubProfile = onSnapshot(
        ref,
        (s) => {
          setProfile(s.exists() ? { id: s.id, ...s.data() } : null);
          setLoading(false);
        },
        () => setLoading(false)
      );
    });
    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  const value = useMemo(() => {
    const role = profile?.role || null;
    const nama = profile?.nama || user?.email || '';
    return {
      user,
      profile,
      role,
      loading,
      isAdmin: role === 'admin',
      canWrite: role === 'admin' || role === 'staff',
      canView: role === 'admin' || role === 'staff' || role === 'viewer',
      nama,
      actor: user ? { uid: user.uid, email: user.email, nama } : null,
      logout: () => signOut(auth),
    };
  }, [user, profile, loading]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
