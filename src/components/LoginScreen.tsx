import { FormEvent, useState } from 'react';
import { Eye, EyeOff, RefreshCw } from 'lucide-react';
import { RoleType, ToastType, UserLoginRecord } from '../types/anteng';
import { normalRoleLogin } from '../utils/anteng';
import { BrandLogo } from './BrandLogo';

interface LoginScreenProps {
  users: UserLoginRecord[];
  usersLoaded: boolean;
  usersError: string | null;
  onReloadUsers: () => Promise<UserLoginRecord[]>;
  onLoginSuccess: (user: UserLoginRecord, role: RoleType) => void;
  showToast: (msg: string, type?: ToastType) => void;
}

export function LoginScreen({
  users,
  usersLoaded,
  usersError,
  onReloadUsers,
  onLoginSuccess,
  showToast,
}: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<RoleType>('Timer');
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; tone: 'info' | 'ok' | 'err' } | null>(
    null
  );

  const checkCredentials = (
    daftar: UserLoginRecord[],
    u: string,
    p: string,
    rNorm: string
  ): { user?: UserLoginRecord; error?: string } => {
    const uLower = u.toLowerCase();
    let ketemuUserPass: UserLoginRecord | null = null;
    for (const row of daftar) {
      if (!row?.username) continue;
      const rowUserLower = String(row.username).trim().toLowerCase();
      const rowPass = String(row.password || '').trim();
      if (rowUserLower === uLower && rowPass === p) {
        const statusStr = String(row.status || 'AKTIF').toUpperCase().trim();
        if (statusStr && statusStr !== 'AKTIF' && statusStr !== 'ACTIVE') {
          return { error: `Akun ${row.username} berstatus ${statusStr} (tidak aktif).` };
        }
        if (normalRoleLogin(row.role) === rNorm) {
          return { user: row };
        }
        ketemuUserPass = row;
      }
    }
    if (ketemuUserPass) {
      const regRole = String(ketemuUserPass.role || '').trim();
      return {
        error: regRole
          ? `Role tidak sesuai. Akun ${ketemuUserPass.username} terdaftar sebagai role ${regRole}.`
          : `Akun ${ketemuUserPass.username} belum memiliki Role di sheet USER_LOGIN.`,
      };
    }
    return { error: 'Username atau Password salah.' };
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const u = username.trim();
    const p = password.trim();
    const rNorm = normalRoleLogin(role);

    if (!u || !p) {
      showToast('Isi username dan password terlebih dahulu.', 'warn');
      return;
    }

    setSubmitting(true);
    setStatusMsg({ text: 'Memverifikasi akun ke sheet USER_LOGIN...', tone: 'info' });
    const freshList = await onReloadUsers();
    setSubmitting(false);

    const daftar = freshList.length > 0 ? freshList : users;

    if (!daftar.length) {
      const errText = 'Gagal terhubung ke database USER_LOGIN. Periksa koneksi internet.';
      setStatusMsg({ text: errText, tone: 'err' });
      showToast(errText, 'err');
      return;
    }

    const hasil = checkCredentials(daftar, u, p, rNorm);
    if (hasil.user) {
      const displayNama = hasil.user.nama || hasil.user.username;
      setStatusMsg({
        text: `Login berhasil: ${displayNama} (${hasil.user.role})`,
        tone: 'ok',
      });
      onLoginSuccess(hasil.user, role);
    } else {
      const errText = hasil.error || 'Login gagal.';
      setStatusMsg({ text: errText, tone: 'err' });
      showToast(errText, 'err');
    }
  };

  const displayBanner = statusMsg
    ? statusMsg
    : usersError
    ? { text: usersError, tone: 'err' as const }
    : usersLoaded
    ? { text: 'Siap. Silakan masukkan Username, Password & Role.', tone: 'ok' as const }
    : { text: 'Memuat data USER_LOGIN dari database...', tone: 'info' as const };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-100">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-slate-200 p-6 sm:p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <BrandLogo className="w-24 h-24 p-1 border-2 border-slate-100 shadow-sm mb-3" />
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            TEMAN ANTENG
          </h1>
          <p className="text-sm font-bold text-slate-600 mt-1">
            Teknologi Manajemen Transjateng
          </p>
          <p className="text-xs font-medium text-slate-400">BRT Trans Jateng</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-1.5" htmlFor="login-user">
              User Name
            </label>
            <input
              id="login-user"
              type="text"
              autoComplete="username"
              placeholder="Masukkan Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3.5 border-2 border-slate-800 rounded-xl text-lg font-bold text-center text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-800 mb-1.5" htmlFor="login-pass">
              Password
            </label>
            <div className="relative">
              <input
                id="login-pass"
                type={showPass ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Masukkan Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-12 py-3.5 border-2 border-slate-800 rounded-xl text-lg font-bold text-center text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                aria-label={showPass ? 'Sembunyikan password' : 'Tampilkan password'}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-slate-500 hover:text-slate-900 rounded-lg"
              >
                {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-800 mb-1.5" htmlFor="login-role">
              Role
            </label>
            <select
              id="login-role"
              value={role}
              onChange={(e) => setRole(e.target.value as RoleType)}
              className="w-full px-4 py-3.5 border-2 border-slate-800 rounded-xl text-lg font-bold text-center text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="Timer">Timer</option>
              <option value="PPA">PPA</option>
              <option value="Pramujasa">Pramujasa</option>
              <option value="Kasir">Kasir</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 rounded-2xl bg-[#FF473A] hover:bg-red-600 active:scale-[0.99] text-white font-extrabold text-lg transition-colors disabled:opacity-60 cursor-pointer"
          >
            {submitting ? 'MEMVERIFIKASI...' : 'MASUK'}
          </button>
        </form>

        <div
          className={`mt-4 p-3 rounded-xl text-sm font-semibold text-center border ${
            displayBanner.tone === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : displayBanner.tone === 'err'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}
        >
          {displayBanner.text}
          {usersError && (
            <button
              type="button"
              onClick={() => void onReloadUsers()}
              className="inline-flex items-center gap-1 ml-2 underline font-bold cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Muat ulang
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


