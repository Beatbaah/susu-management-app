import { useEffect } from 'react';
import { isFirestoreReady } from '../services/firestoreSync';
import { getCurrentUser, setCurrentUser, signOut as authSignOut, onAuthChange } from '../services/authService';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../utils/firebase';

export function useAuthSync({ authUser, authUserRef, setAuthUser, setAuthUserState, setAppReady }) {
    useEffect(() => {
        if (!isFirestoreReady() || !authUser?.id || !db) return;
        let canceled = false;
        const fetchRole = async (attempt = 0) => {
            try {
                const snap = await getDoc(doc(db, 'users', authUser.id));
                if (canceled) return;
                if (!snap.exists()) return;
                const { role: freshRole, status: freshStatus } = snap.data();
                if (freshStatus === 'suspended') {
                    authSignOut().catch(() => {});
                    setAuthUserState(null);
                    return;
                }
                const validRoles = new Set(['admin', 'manager', 'collector', 'member']);
                if (freshRole && validRoles.has(freshRole) && freshRole !== authUser.role) {
                    setCurrentUser({ ...authUser, role: freshRole });
                    setAuthUserState(prev => prev ? { ...prev, role: freshRole } : prev);
                }
            } catch {
                if (!canceled && attempt < 3) {
                    await new Promise(r => setTimeout(r, (attempt + 1) * 3000));
                    if (!canceled) fetchRole(attempt + 1);
                }
            }
        };
        fetchRole();
        return () => { canceled = true; };
    }, [authUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!isFirestoreReady() || !db) return;
        const unsub = onAuthChange(async (firebaseUser) => {
            if (!firebaseUser) return;
            const uid = firebaseUser.uid;
            if (authUserRef.current?.id === uid && authUserRef.current?.role !== 'member') return;
            try {
                const snap = await getDoc(doc(db, 'users', uid));
                if (!snap.exists()) return;
                const data = snap.data();
                const validRoles = ['admin', 'manager', 'collector', 'member'];
                if (!data.role || !validRoles.includes(data.role)) return;
                if (data.status === 'suspended') return;
                const profile = { ...data, id: uid };
                setCurrentUser(profile);
                setAuthUserState(profile);
            } catch { /* non-fatal — normal role-refresh will retry */ }
        });
        return unsub;
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
