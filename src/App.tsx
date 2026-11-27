import { useCallback, useEffect, useRef, useState } from 'react';
import { KasirScreen } from './components/KasirScreen';
import { LoginScreen } from './components/LoginScreen';
import { LostFoundScreen } from './components/LostFoundScreen';
import { PpaScreen } from './components/PpaScreen';
import { PramujasaScreen } from './components/PramujasaScreen';
import { OfflineIndicator } from './components/PwaHelpers';
import { TimerScreen } from './components/TimerScreen';
import {
  MasterHalteItem,
  MasterJadwalMap,
  MasterPramudiItem,
  MasterRitMap,
  RoleType,
  ScreenId,
  ToastType,
  UserLoginRecord,
} from './types/anteng';
import {
  fetchMasterData,
  fetchMasterHalte,
  fetchMasterPramudi,
  fetchUserLoginSheet,
  normalRoleLogin,
  readCachedUserLogin,
  tglHariIni,
} from './utils/anteng';

const ACTIVE_SESSION_KEY = 'anteng_active_session';

interface SavedSession {
  screen: ScreenId;
  asalLost: ScreenId;
  petugasNama: string;
  tanggal: string;
}

function readSavedSession(): SavedSession | null {
  try {
    const raw =
      sessionStorage.getItem(ACTIVE_SESSION_KEY) || localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedSession>;
    if (
      parsed &&
      parsed.tanggal === tglHariIni() &&
      parsed.petugasNama &&
      parsed.screen &&
      parsed.screen !== 's1'
    ) {
      return {
        screen: parsed.screen,
        asalLost: parsed.asalLost || 's2',
        petugasNama: parsed.petugasNama,
        tanggal: parsed.tanggal,
      };
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

function writeSavedSession(session: SavedSession | null) {
  try {
    if (!session || session.screen === 's1' || !session.petugasNama) {
      sessionStorage.removeItem(ACTIVE_SESSION_KEY);
      localStorage.removeItem(ACTIVE_SESSION_KEY);
      return;
    }
    const serialized = JSON.stringify(session);
    sessionStorage.setItem(ACTIVE_SESSION_KEY, serialized);
    localStorage.setItem(ACTIVE_SESSION_KEY, serialized);
  } catch {
    // ignore storage errors
  }
}

export default function App() {
  const [initialSession] = useState<SavedSession | null>(() => readSavedSession());
  const [screen, setScreen] = useState<ScreenId>(() => initialSession?.screen || 's1');
  const [asalLost, setAsalLost] = useState<ScreenId>(() => initialSession?.asalLost || 's2');
  const [petugasNama, setPetugasNama] = useState(() => initialSession?.petugasNama || '');

  const [users, setUsers] = useState<UserLoginRecord[]>(() => readCachedUserLogin());
  const [usersLoaded, setUsersLoaded] = useState(() => readCachedUserLogin().length > 0);
  const [usersError, setUsersError] = useState<string | null>(null);

  const [masterJadwal, setMasterJadwal] = useState<MasterJadwalMap>({});
  const [masterRit, setMasterRit] = useState<MasterRitMap>({});
  const [masterPramudi, setMasterPramudi] = useState<MasterPramudiItem[]>([]);
  const [masterHalte, setMasterHalte] = useState<MasterHalteItem[]>([]);

  const [globalLoading, setGlobalLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    writeSavedSession(
      screen !== 's1' && petugasNama
        ? { screen, asalLost, petugasNama, tanggal: tglHariIni() }
        : null
    );
  }, [screen, asalLost, petugasNama]);

  const showToast = useCallback((msg: string, type: ToastType = '') => {
    setToast({ msg, type });
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 3800);
  }, []);

  const loadUsers = useCallback(async (): Promise<UserLoginRecord[]> => {
    try {
      setUsersError(null);
      const list = await fetchUserLoginSheet();
      setUsers(list);
      setUsersLoaded(true);
      return list;
    } catch {
      const cached = readCachedUserLogin();
      if (cached.length === 0) {
        setUsersLoaded(false);
        setUsersError('Koneksi database USER_LOGIN tertunda. Klik MASUK atau Muat ulang.');
      }
      return [];
    }
  }, []);

  const loadMaster = useCallback(async () => {
    const [{ jadwal, rit }, pramudiList, halteList] = await Promise.all([
      fetchMasterData(),
      fetchMasterPramudi(),
      fetchMasterHalte(),
    ]);
    if (Object.keys(jadwal).length > 0) {
      setMasterJadwal(jadwal);
    }
    if (Object.keys(rit).length > 0) {
      setMasterRit(rit);
    }
    if (pramudiList.length > 0) {
      setMasterPramudi(pramudiList);
    }
    if (halteList.length > 0) {
      setMasterHalte(halteList);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
    void loadMaster();
  }, [loadUsers, loadMaster]);

  const handleLoginSuccess = (user: UserLoginRecord, roleSelected: RoleType) => {
    const nama = (user.nama || user.username).trim();
    const roleNorm = normalRoleLogin(roleSelected || user.role);
    setPetugasNama(nama);

    if (roleNorm === 'TIMER') {
      setAsalLost('s2');
      setScreen('s2');
      showToast(`Selamat bekerja, ${nama}!`, 'ok');
    } else if (roleNorm === 'PPA') {
      setAsalLost('s4');
      setScreen('s4');
      showToast(`Selamat bekerja, ${nama}!`, 'ok');
    } else if (roleNorm === 'PRAMUJASA') {
      setAsalLost('s5');
      setScreen('s5');
      showToast(`Selamat bekerja, ${nama}!`, 'ok');
    } else if (roleNorm === 'KASIR') {
      setAsalLost('s6');
      setScreen('s6');
      showToast(`Selamat bekerja, ${nama}!`, 'ok');
    } else {
      showToast(`Role ${roleSelected} belum tersedia di aplikasi.`, 'warn');
    }
  };

  const openLostFound = (from: ScreenId) => {
    setAsalLost(from);
    setScreen('s3');
    window.scrollTo({ top: 0 });
  };

  const backToLogin = () => {
    writeSavedSession(null);
    try {
      sessionStorage.removeItem('anteng_kasir_draft');
      localStorage.removeItem('anteng_kasir_draft');
    } catch {
      // ignore
    }
    setPetugasNama('');
    setScreen('s1');
    window.scrollTo({ top: 0 });
  };

  return (
    <>
      {screen === 's1' && (
        <LoginScreen
          users={users}
          usersLoaded={usersLoaded}
          usersError={usersError}
          onReloadUsers={loadUsers}
          onLoginSuccess={handleLoginSuccess}
          showToast={showToast}
        />
      )}

      {screen === 's2' && (
        <TimerScreen
          petugasNama={petugasNama}
          masterJadwal={masterJadwal}
          masterRit={masterRit}
          onReloadMaster={loadMaster}
          onBackToLogin={backToLogin}
          onOpenLostFound={() => openLostFound('s2')}
          showToast={showToast}
          setGlobalLoading={setGlobalLoading}
        />
      )}

      {screen === 's3' && (
        <LostFoundScreen
          onBack={() => {
            setScreen(asalLost);
            window.scrollTo({ top: 0 });
          }}
        />
      )}

      {screen === 's4' && (
        <PpaScreen
          petugasNama={petugasNama}
          masterRit={masterRit}
          onBackToLogin={backToLogin}
          onOpenLostFound={() => openLostFound('s4')}
          showToast={showToast}
          setGlobalLoading={setGlobalLoading}
        />
      )}

      {screen === 's5' && (
        <PramujasaScreen
          petugasNama={petugasNama}
          masterRit={masterRit}
          masterPramudi={masterPramudi}
          masterHalte={masterHalte}
          onBackToLogin={backToLogin}
          onOpenLostFound={() => openLostFound('s5')}
          showToast={showToast}
          setGlobalLoading={setGlobalLoading}
        />
      )}

      {screen === 's6' && (
        <KasirScreen
          petugasNama={petugasNama}
          onBackToLogin={backToLogin}
          onOpenLostFound={() => openLostFound('s6')}
          showToast={showToast}
        />
      )}

      {globalLoading && (
        <div className="fixed inset-0 z-50 bg-white/90 flex items-center justify-center font-extrabold text-lg text-slate-900">
          Mengirim ke Database...
        </div>
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed left-1/2 bottom-5 -translate-x-1/2 max-w-md w-[calc(100%-28px)] z-50 px-4 py-3.5 rounded-2xl text-sm font-bold text-center text-white shadow-xl border ${
            toast.type === 'ok'
              ? 'bg-emerald-900 border-emerald-400'
              : toast.type === 'warn'
              ? 'bg-amber-900 border-amber-400'
              : toast.type === 'err'
              ? 'bg-red-900 border-red-400'
              : 'bg-slate-900 border-slate-700'
          }`}
        >
          {toast.msg}
        </div>
      )}
      <footer className="py-3 text-center text-[11px] font-semibold text-slate-500 bg-slate-100">
        dibuat Oleh Ali Setiadi
      </footer>
      <OfflineIndicator />
    </>
  );
}
