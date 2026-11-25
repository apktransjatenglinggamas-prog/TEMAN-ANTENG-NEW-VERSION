import {
  KategoriCounts,
  KategoriKey,
  LostItemDisplay,
  MasterHalteItem,
  MasterJadwalMap,
  MasterPramudiItem,
  MasterRitMap,
  PramujasaRecord,
  UserLoginRecord,
} from '../types/anteng';

export const API_TIMER =
  'https://script.google.com/macros/s/AKfycbxqSjF9Skyr6fwDFQijUj4JbnnE2XHedI25u5FxOsCdCel9WR4rAUsxMbB-GeA4HQMu3w/exec';
export const API_PPA =
  'https://script.google.com/macros/s/AKfycbzw5uzwemAKd7VeJudTWqmxKU2fJ7PPtIvr-foo40TOsEf4OtEX6pJhb75keZOuDN_q/exec';
export const API_PRAMUJASA =
  'https://script.google.com/macros/s/AKfycbzo5PDy8sVg0jIjbQrIO_W-j_OuedTyJ6aH87lJHwEUT9v65uiyF4w87IR0sN7A-ZfN/exec';
export const API_KASIR =
  'https://script.google.com/macros/s/AKfycbwEDQ1co4qBw3b1sYAh8GxFiktvU1Jdt6Q6xq_AQiggdan1UEnqEuNZndXMUCOHY0sEDQ/exec';

export const MASTER_SHEET_ID = '1YV4mBF9uswh2YC5ZLM5aMR_xHS1CzFhFaryTZ-xP8zA';
export const LOGO_URL = 'https://i.ibb.co.com/xq9KTq7D/IMG-20261116-WA0038.jpg';

export const STORAGE_TIMER_KEY = 'anteng_riwayat';
export const STORAGE_PPA_KEY = 'anteng_riwayat_ppa';
export const STORAGE_PRAM_KEY = 'anteng_riwayat_pramujasa';
export const STORAGE_KASIR_KEY = 'anteng_riwayat_kasir';

export const IDS_TIMER_KEY = 'anteng_saved_ids_timer';
export const IDS_PPA_KEY = 'anteng_saved_ids_ppa';
export const IDS_PRAM_KEY = 'anteng_saved_ids_pramujasa';
export const IDS_KASIR_KEY = 'anteng_saved_ids_kasir';

export const LIST_KORIDOR = ['KOR01'];
export const LIST_RIT = ['R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'R07', 'R08'];
export const LIST_LB: string[] = [
  ...Array.from({ length: 14 }, (_, i) => `LB${String(i + 1).padStart(2, '0')}`),
  'LBC01',
];

export const LIST_HALTE = [
  { id: 'HT01', label: '1. Halte Bukateja', value: 'Halte Bukateja' },
  { id: 'HT02', label: '2. Halte SMA Bukateja', value: 'Halte SMA Bukateja' },
  { id: 'HT03', label: '3. Halte Yuro', value: 'Halte Yuro' },
  { id: 'HT04', label: '4. Halte T. Purbalingga', value: 'Halte T. Purbalingga' },
];

export const LIST_POS_PPA = [
  { value: 'JOMPO_BK_BP', label: '1. JOMPO (BK-BP)' },
  { value: 'JOMPO_BP_BK', label: '2. JOMPO (BP-BK)' },
  { value: 'PURBALINGGA_BK_BP', label: '3. Purbalingga (BK-BP)' },
  { value: 'PURBALINGGA_BP_BK', label: '4. Purbalingga (BP-BK)' },
];

export const KATEGORI_LIST: { key: KategoriKey; label: string; tarif: number }[] = [
  { key: 'umum', label: 'Umum', tarif: 5000 },
  { key: 'buruh', label: 'Buruh', tarif: 1000 },
  { key: 'pelajar', label: 'Pelajar', tarif: 1000 },
  { key: 'lansia', label: 'Lansia', tarif: 1000 },
  { key: 'disabilitas', label: 'Disabilitas', tarif: 1000 },
  { key: 'veteran', label: 'Veteran', tarif: 1000 },
];

export function emptyKategoriCounts(): KategoriCounts {
  return {
    umum: 0,
    buruh: 0,
    pelajar: 0,
    lansia: 0,
    disabilitas: 0,
    veteran: 0,
  };
}

export function pad2(n: number | string): string {
  const num = parseInt(String(n), 10) || 0;
  return (num < 10 ? '0' : '') + num;
}

export function tglHariIni(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function jamSekarangHHMM(): string {
  const n = new Date();
  return `${pad2(n.getHours())}:${pad2(n.getMinutes())}`;
}

export function timestampSekarang(): string {
  const n = new Date();
  return `${n.getFullYear()}-${pad2(n.getMonth() + 1)}-${pad2(n.getDate())} ${pad2(n.getHours())}:${pad2(n.getMinutes())}:${pad2(n.getSeconds())}`;
}

export function normalisasiJamHHMM(j: string | undefined | null): string {
  if (!j) return '';
  const cleaned = String(j).trim().replace(/\./g, ':');
  const match = cleaned.match(/(\d{1,2})\s*:\s*(\d{1,2})/);
  if (!match) return '';
  const hh = parseInt(match[1], 10);
  const mm = parseInt(match[2], 10);
  if (isNaN(hh) || isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return '';
  return `${pad2(hh)}:${pad2(mm)}`;
}

export function jamKeMenit(j: string | undefined | null): number | null {
  if (!j) return null;
  const cleaned = String(j).trim().replace(/\./g, ':');
  const match = cleaned.match(/(\d{1,2})\s*:\s*(\d{1,2})/);
  if (!match) return null;
  const jam = parseInt(match[1], 10);
  const menit = parseInt(match[2], 10);
  if (isNaN(jam) || isNaN(menit) || jam < 0 || jam > 29 || menit < 0 || menit > 59) return null;
  return jam * 60 + menit;
}

export function hitungSelisihMenit(jamAwal: string, jamAkhir: string): number | null {
  const m1 = jamKeMenit(jamAwal);
  const m2 = jamKeMenit(jamAkhir);
  if (m1 === null || m2 === null) return null;
  let diff = m2 - m1;
  if (diff < 0) diff += 1440;
  return diff;
}

/**
 * Normalisasi kunci armada-rit sambil mempertahankan prefix LBC (bus cadangan)
 * agar LBC01-R01 tidak tertimpa dengan LB01-R01.
 */
export function normalKunciJS(teks: string | undefined | null): string {
  if (!teks) return '';
  const s = String(teks).toUpperCase();
  const mLBC = s.match(/LB\s*C\s*0*(\d+)/);
  const mLB = mLBC ? null : s.match(/LB\s*0*(\d+)/);
  const mR = s.match(/R\s*0*(\d+)/);
  if ((!mLBC && !mLB) || !mR) return '';
  const prefix = mLBC ? 'LBC' : 'LB';
  const noLB = parseInt((mLBC || mLB)![1], 10);
  const noR = parseInt(mR[1], 10);
  return `${prefix}${pad2(noLB)}-R${pad2(noR)}`;
}

export function formatRupiah(angka: number): string {
  const n = Math.round(Number(angka) || 0);
  return 'Rp ' + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

const MEM_STORAGE: Record<string, unknown[]> = {};
export const MEM_PHOTO_CACHE: Record<string, string> = {};

export function bacaStorage<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        MEM_STORAGE[key] = parsed.slice();
        return parsed.slice() as T[];
      }
    }
  } catch {
    // ignore storage errors
  }
  const mem = MEM_STORAGE[key];
  return Array.isArray(mem) ? (mem.slice() as T[]) : [];
}

const MEM_SAVED_IDS: Record<string, Record<string, boolean>> = {};

export function readSavedIdSet(idsKey: string): Record<string, boolean> {
  const merged: Record<string, boolean> = { ...(MEM_SAVED_IDS[idsKey] || {}) };
  try {
    const raw = localStorage.getItem(idsKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const id of parsed) {
          if (typeof id === 'string' && id) merged[id] = true;
        }
      } else if (parsed && typeof parsed === 'object') {
        for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
          if (v && k) merged[k] = true;
        }
      }
    }
  } catch {
    // ignore storage errors
  }
  MEM_SAVED_IDS[idsKey] = merged;
  return merged;
}

export function hasSavedIdPerjalanan(idsKey: string, idPerjalanan: string): boolean {
  if (!idPerjalanan) return false;
  return Boolean(readSavedIdSet(idsKey)[idPerjalanan]);
}

export function markSavedIdPerjalanan(idsKey: string, idPerjalanan: string): void {
  if (!idPerjalanan) return;
  const set = readSavedIdSet(idsKey);
  set[idPerjalanan] = true;
  MEM_SAVED_IDS[idsKey] = set;
  try {
    localStorage.setItem(idsKey, JSON.stringify(Object.keys(set)));
  } catch {
    // ignore storage quota errors
  }
}

const SESSION_PHOTO_PREFIX = 'anteng_lf_foto_';

export function cacheLfPhoto(keyId: string, slot: 1 | 2, url: string | undefined | null): void {
  if (!keyId || !url || url === '-' || url === '[Tersimpan di Sesi]') return;
  const cacheKey = `${keyId}_${slot}`;
  MEM_PHOTO_CACHE[cacheKey] = url;
  try {
    sessionStorage.setItem(`${SESSION_PHOTO_PREFIX}${cacheKey}`, url);
  } catch {
    // ignore session quota
  }
}

export function clearLfPhotoCache(keyId: string, slot: 1 | 2): void {
  if (!keyId) return;
  const cacheKey = `${keyId}_${slot}`;
  delete MEM_PHOTO_CACHE[cacheKey];
  try {
    sessionStorage.removeItem(`${SESSION_PHOTO_PREFIX}${cacheKey}`);
  } catch {
    // ignore storage errors
  }
}

export function resolveLfPhotoUrl(
  keyId: string | undefined | null,
  slot: 1 | 2,
  rawUrl?: string | null
): string {
  if (rawUrl === '-') return '';
  const clean = normalizeImgUrl(rawUrl);
  if (clean) return clean;
  if (!keyId) return '';
  const cacheKey = `${keyId}_${slot}`;
  const mem = normalizeImgUrl(MEM_PHOTO_CACHE[cacheKey]);
  if (mem) return mem;
  try {
    const sess = normalizeImgUrl(sessionStorage.getItem(`${SESSION_PHOTO_PREFIX}${cacheKey}`));
    if (sess) {
      MEM_PHOTO_CACHE[cacheKey] = sess;
      return sess;
    }
  } catch {
    // ignore storage errors
  }
  return '';
}

function stripLfPhotosFromRecord(item: unknown): unknown {
  if (item && typeof item === 'object' && 'lostFoundData' in item) {
    const rec = item as Record<string, unknown>;
    const lf = rec.lostFoundData as Record<string, unknown> | null;
    if (lf && typeof lf === 'object') {
      const idBrg = String(lf.ID_BARANG || '');
      const f1 = typeof lf.FOTO_1 === 'string' ? lf.FOTO_1 : '';
      const f2 = typeof lf.FOTO_2 === 'string' ? lf.FOTO_2 : '';
      if (idBrg && f1.startsWith('data:image/')) {
        cacheLfPhoto(idBrg, 1, f1);
      }
      if (idBrg && f2.startsWith('data:image/')) {
        cacheLfPhoto(idBrg, 2, f2);
      }
      return {
        ...rec,
        lostFoundData: {
          ...lf,
          FOTO_1: f1.startsWith('data:image/') ? '[Tersimpan di Sesi]' : lf.FOTO_1,
          FOTO_2: f2.startsWith('data:image/') ? '[Tersimpan di Sesi]' : lf.FOTO_2,
          foto1: f1.startsWith('data:image/') ? '[Tersimpan di Sesi]' : lf.foto1,
          foto2: f2.startsWith('data:image/') ? '[Tersimpan di Sesi]' : lf.foto2,
        },
      };
    }
  }
  return item;
}

/**
 * Simpan array ke localStorage dengan proteksi QuotaExceededError.
 * Jika penuh, pangkas foto Base64 dari data lama terlebih dahulu agar data terbaru tetap utuh.
 */
export function tulisStorage<T>(key: string, val: T[]): boolean {
  const arrCopy = Array.isArray(val) ? val.slice() : [];
  MEM_STORAGE[key] = arrCopy;
  try {
    localStorage.setItem(key, JSON.stringify(arrCopy));
    return true;
  } catch {
    // Coba pangkas foto data lama (indeks >= 1), pertahankan data terbaru (indeks 0)
    try {
      const stripOlderOnly = arrCopy.map((item, idx) =>
        idx === 0 ? item : stripLfPhotosFromRecord(item)
      );
      localStorage.setItem(key, JSON.stringify(stripOlderOnly));
      return true;
    } catch {
      // Fallback: pangkas semua foto Base64 ke MEM_PHOTO_CACHE
      try {
        const strippedAll = arrCopy.map((item) => stripLfPhotosFromRecord(item));
        localStorage.setItem(key, JSON.stringify(strippedAll));
        return true;
      } catch {
        return false;
      }
    }
  }
}

interface GvizCell {
  v?: string | number | boolean | null;
  f?: string | null;
}

interface GvizTable {
  cols?: { id?: string; label?: string }[];
  rows?: { c?: (GvizCell | null)[] }[];
}

interface GvizResponse {
  table?: GvizTable;
}

export function parseGvizJson(txt: string): GvizResponse | null {
  if (!txt) return null;
  const m = txt.match(/setResponse\(([\s\S]+)\)\s*;?\s*$/);
  if (m && m[1]) {
    try {
      return JSON.parse(m[1]) as GvizResponse;
    } catch {
      // fall through
    }
  }
  const start = txt.indexOf('{');
  const end = txt.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(txt.substring(start, end + 1)) as GvizResponse;
    } catch {
      return null;
    }
  }
  return null;
}

function getGvizCellText(cell: GvizCell | null | undefined, preserveFormatted = false): string {
  if (!cell || cell.v === null || cell.v === undefined) return '';
  if (preserveFormatted && typeof cell.v === 'number' && cell.f) {
    return String(cell.f).trim();
  }
  return String(cell.v).trim();
}

export function normalRoleLogin(roleRaw: string): string {
  const s = String(roleRaw || '').toUpperCase().replace(/[^A-Z0-9_]/g, '');
  if (s === 'TIMER' || s === 'TMR') return 'TIMER';
  if (s === 'PPA') return 'PPA';
  if (s === 'PRAMUJASA' || s === 'PJS') return 'PRAMUJASA';
  if (s === 'KASIR' || s === 'KSR') return 'KASIR';
  return s;
}

export const USER_LOGIN_CACHE_KEY = 'anteng_user_login_cache';

export function readCachedUserLogin(): UserLoginRecord[] {
  try {
    const raw = localStorage.getItem(USER_LOGIN_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as UserLoginRecord[];
    }
  } catch {
    // ignore
  }
  return [];
}

export async function fetchUserLoginSheet(): Promise<UserLoginRecord[]> {
  const url = `https://docs.google.com/spreadsheets/d/${MASTER_SHEET_ID}/gviz/tq?tqx=out:json&sheet=USER_LOGIN&t=${Date.now()}`;
  const res = await fetch(url);
  const txt = await res.text();
  const g = parseGvizJson(txt);
  if (!g?.table?.rows) throw new Error('Data USER_LOGIN kosong atau tidak terbaca.');

  const cols = g.table.cols || [];
  const rows = g.table.rows || [];

  let idxUser = -1;
  let idxPass = -1;
  let idxRole = -1;
  let idxStatus = -1;
  let idxNama = -1;

  for (let c = 0; c < cols.length; c++) {
    const lbl = String(cols[c]?.label || cols[c]?.id || '').toUpperCase().trim();
    if (lbl === 'USERNAME' || lbl === 'USER_NAME' || lbl === 'USER') idxUser = c;
    else if (lbl === 'PASSWORD' || lbl === 'PASS' || lbl === 'SANDI') idxPass = c;
    else if (lbl === 'ROLE' || lbl === 'JABATAN' || lbl === 'HAK_AKSES') idxRole = c;
    else if (lbl === 'STATUS') idxStatus = c;
    else if (lbl === 'NAMA' || lbl === 'NAMA_PETUGAS' || lbl === 'NAMA_LENGKAP' || lbl === 'FULL_NAME') idxNama = c;
  }

  let dataStartRow = 0;
  // Fallback: jika cols[].label kosong karena gviz membaca header sebagai baris pertama
  if (idxUser === -1 && rows.length > 0) {
    const firstCells = rows[0]?.c || [];
    for (let c = 0; c < firstCells.length; c++) {
      const lbl = getGvizCellText(firstCells[c]).toUpperCase();
      if (lbl === 'USERNAME' || lbl === 'USER_NAME' || lbl === 'USER') idxUser = c;
      else if (lbl === 'PASSWORD' || lbl === 'PASS' || lbl === 'SANDI') idxPass = c;
      else if (lbl === 'ROLE' || lbl === 'JABATAN' || lbl === 'HAK_AKSES') idxRole = c;
      else if (lbl === 'STATUS') idxStatus = c;
      else if (lbl === 'NAMA' || lbl === 'NAMA_PETUGAS' || lbl === 'NAMA_LENGKAP' || lbl === 'FULL_NAME') idxNama = c;
    }
    if (idxUser !== -1) dataStartRow = 1;
  }

  if (idxUser === -1) idxUser = 0;
  if (idxPass === -1) idxPass = 1;
  if (idxRole === -1) idxRole = 2;
  if (idxStatus === -1) idxStatus = 3;

  const parsed: UserLoginRecord[] = [];
  for (let i = dataStartRow; i < rows.length; i++) {
    const cells = rows[i]?.c || [];
    const uname = getGvizCellText(cells[idxUser]);
    if (!uname || uname.toUpperCase() === 'USERNAME') continue;
    const upass = getGvizCellText(cells[idxPass], true);
    const urole = getGvizCellText(cells[idxRole]);
    const ustatus = getGvizCellText(cells[idxStatus]) || 'AKTIF';
    let unama = idxNama >= 0 ? getGvizCellText(cells[idxNama]) : '';
    if (!unama) {
      for (let extra = 4; extra < cells.length; extra++) {
        const cand = getGvizCellText(cells[extra]);
        if (
          cand &&
          !cand.includes('@') &&
          isNaN(Number(cand)) &&
          !['AKTIF', 'ONLINE', 'OFFLINE'].includes(cand.toUpperCase())
        ) {
          unama = cand;
          break;
        }
      }
    }
    parsed.push({
      username: uname,
      password: upass,
      role: urole,
      status: ustatus,
      nama: unama || uname,
    });
  }

  if (!parsed.length) throw new Error('Daftar akun USER_LOGIN kosong.');
  try {
    localStorage.setItem(USER_LOGIN_CACHE_KEY, JSON.stringify(parsed));
  } catch {
    // ignore
  }
  return parsed;
}

/**
 * Aturan baku Terminal Awal dan Akhir sesuai Sheet MASTER_RIT:
 * - LB01-LB07: Ganjil (R01, R03, R05, R07) = BUKATEJA, Genap (R02, R04, R06, R08) = BULUPITU
 * - LB08-LB14 & LBC01: Ganjil = BULUPITU, Genap = BUKATEJA
 */
export function getTerminalAwalFromMasterRit(lb: string, rit: string): string {
  const bNum = parseInt(String(lb || '').replace(/\D/g, ''), 10);
  const rNum = parseInt(String(rit || '').replace(/\D/g, ''), 10);
  const isCadangan = String(lb || '').toUpperCase().includes('LBC');
  if (isCadangan || (!isNaN(bNum) && bNum >= 8)) {
    return (rNum % 2 === 1) ? 'BULUPITU' : 'BUKATEJA';
  } else {
    return (rNum % 2 === 1) ? 'BUKATEJA' : 'BULUPITU';
  }
}

export function getTerminalAkhirFromMasterRit(lb: string, rit: string): string {
  const awal = getTerminalAwalFromMasterRit(lb, rit);
  return awal === 'BUKATEJA' ? 'BULUPITU' : 'BUKATEJA';
}

export async function fetchMasterData(): Promise<{
  jadwal: MasterJadwalMap;
  rit: MasterRitMap;
}> {
  const jadwal: MasterJadwalMap = {};
  const rit: MasterRitMap = {};

  // Pre-seed rit dengan data baku sesuai Sheet MASTER_RIT untuk semua armada & rit
  for (const b of LIST_LB) {
    for (const r of LIST_RIT) {
      const nk = `${b}-${r}`;
      const awal = getTerminalAwalFromMasterRit(b, r);
      const akhir = getTerminalAkhirFromMasterRit(b, r);
      const arah = awal === 'BUKATEJA' ? 'BK-BP' : 'BP-BK';
      rit[nk] = {
        koridor: 'KOR01',
        pola: 'REGULER',
        arah,
        terminal: awal,
        terminalAkhir: akhir,
      };
    }
  }

  // 1. Ambil MASTER_RIT langsung dari Google Sheet MASTER_RIT (Sumber Utama & Otoritatif)
  try {
    const urlRit = `https://docs.google.com/spreadsheets/d/${MASTER_SHEET_ID}/gviz/tq?tqx=out:json&sheet=MASTER_RIT&t=${Date.now()}`;
    const resRit = await fetch(urlRit);
    const txtRit = await resRit.text();
    const g = parseGvizJson(txtRit);
    if (g?.table?.rows) {
      const cols = g.table.cols || [];
      const rows = g.table.rows || [];
      let idxKor = -1;
      let idxIdRit = -1;
      let idxBus = -1;
      let idxRit = -1;
      let idxArah = -1;
      let idxAwal = -1;
      let idxAkhir = -1;

      for (let c = 0; c < cols.length; c++) {
        const lbl = String(cols[c]?.label || cols[c]?.id || '').toUpperCase().trim();
        if (lbl === 'ID_KORIDOR' || lbl === 'KORIDOR') idxKor = c;
        else if (lbl === 'ID_RIT') idxIdRit = c;
        else if (lbl === 'KODE_BUS' || lbl === 'ID_ARMADA') idxBus = c;
        else if (lbl === 'RIT' || lbl === 'ID_RIT_KE') idxRit = c;
        else if (lbl === 'ARAH') idxArah = c;
        else if (lbl === 'TERMINAL_AWAL') idxAwal = c;
        else if (lbl === 'TERMINAL_AKHIR') idxAkhir = c;
      }

      let startRow = 0;
      if (idxIdRit === -1 && rows.length > 0) {
        const fc = rows[0]?.c || [];
        for (let c = 0; c < fc.length; c++) {
          const lbl = getGvizCellText(fc[c]).toUpperCase();
          if (lbl === 'ID_KORIDOR' || lbl === 'KORIDOR') idxKor = c;
          else if (lbl === 'ID_RIT') idxIdRit = c;
          else if (lbl === 'KODE_BUS' || lbl === 'ID_ARMADA') idxBus = c;
          else if (lbl === 'RIT' || lbl === 'ID_RIT_KE') idxRit = c;
          else if (lbl === 'ARAH') idxArah = c;
          else if (lbl === 'TERMINAL_AWAL') idxAwal = c;
          else if (lbl === 'TERMINAL_AKHIR') idxAkhir = c;
        }
        if (idxIdRit !== -1 || idxBus !== -1) startRow = 1;
      }

      if (idxKor === -1) idxKor = 0;
      if (idxIdRit === -1) idxIdRit = 1;
      if (idxBus === -1) idxBus = 2;
      if (idxRit === -1) idxRit = 3;
      if (idxArah === -1) idxArah = 4;
      if (idxAwal === -1) idxAwal = 5;
      if (idxAkhir === -1) idxAkhir = 6;

      for (let i = startRow; i < rows.length; i++) {
        const cells = rows[i]?.c || [];
        const idRitRaw = getGvizCellText(cells[idxIdRit]);
        const busRaw = getGvizCellText(cells[idxBus]);
        const ritRaw = getGvizCellText(cells[idxRit]);
        const nk = normalKunciJS(idRitRaw || `${busRaw}-${ritRaw}`);
        if (!nk) continue;
        const korVal = getGvizCellText(cells[idxKor]).toUpperCase();
        const arahRaw = getGvizCellText(cells[idxArah]).toUpperCase();
        const tAwal = getGvizCellText(cells[idxAwal]);
        let tAkhir = getGvizCellText(cells[idxAkhir]);
        if (!tAkhir && tAwal) {
          const upA = tAwal.toUpperCase();
          if (upA === 'BUKATEJA') tAkhir = 'BULUPITU';
          else if (upA === 'BULUPITU') tAkhir = 'BUKATEJA';
        }
        let arahVal = arahRaw;
        if (!arahVal && tAkhir) {
          const upAk = tAkhir.toUpperCase();
          if (upAk.includes('BULUPITU')) arahVal = 'BP';
          else if (upAk.includes('BUKATEJA')) arahVal = 'BK';
        }
        if (!rit[nk]) rit[nk] = { pola: 'REGULER' };
        if (korVal) rit[nk].koridor = korVal;
        if (arahVal) rit[nk].arah = arahVal;
        // Tetapkan Terminal Awal persis sesuai Sheet MASTER_RIT
        if (tAwal) rit[nk].terminal = tAwal;
        if (tAkhir) rit[nk].terminalAkhir = tAkhir;
      }
    }
  } catch {
    // Tetap menggunakan pre-seed baku jika fetch sheet terhambat
  }

  // 2. Ambil master jadwal dari API_TIMER (Jadwal TimeTable)
  try {
    const res = await fetch(`${API_TIMER}?action=master&t=${Date.now()}`);
    const txt = await res.text();
    const j = JSON.parse(txt) as {
      error?: string;
      jadwal?: Record<string, string | Record<string, string>>;
      polaList?: string[];
      rit?: Record<string, Record<string, string>>;
    };
    if (!j.error && j.jadwal && Object.keys(j.jadwal).length > 0) {
      for (const [k, v] of Object.entries(j.jadwal)) {
        if (v && typeof v === 'object') {
          const pola = String(k).toUpperCase().trim();
          if (!jadwal[pola]) jadwal[pola] = {};
          for (const [k2, jamRaw] of Object.entries(v)) {
            const nk = normalKunciJS(k2);
            if (!nk) continue;
            jadwal[pola][nk] = normalisasiJamHHMM(jamRaw) || String(jamRaw || '');
          }
        } else {
          const nk = normalKunciJS(k);
          if (!nk) continue;
          const daftarPola = j.polaList?.length
            ? j.polaList
            : ['REGULER', 'WEEKEND', 'LIBUR1', 'LIBUR2'];
          for (const p of daftarPola) {
            const pp = String(p).toUpperCase().trim();
            if (!jadwal[pp]) jadwal[pp] = {};
            jadwal[pp][nk] = normalisasiJamHHMM(v) || String(v || '');
          }
        }
      }

      // JANGAN PERNAH menimpa terminal awal dari sheet MASTER_RIT
      if (j.rit) {
        for (const [kr, rObj] of Object.entries(j.rit)) {
          const nkR = normalKunciJS(kr);
          if (!nkR || !rObj) continue;
          if (!rit[nkR]) {
            rit[nkR] = { pola: 'REGULER' };
          }
          // Hanya isi jika rit[nkR].terminal belum ada sama sekali
          if (!rit[nkR].terminal) {
            const tAwal =
              rObj.terminal || rObj.terminalAwal || rObj['Terminal Awal'] || rObj.TERMINAL_AWAL || '';
            if (tAwal) rit[nkR].terminal = tAwal;
          }
          if (!rit[nkR].terminalAkhir) {
            const tAkhir =
              rObj.terminalAkhir ||
              rObj['Terminal Akhir'] ||
              rObj.TERMINAL_AKHIR ||
              rObj.tujuan ||
              rObj['Terminal Tujuan'] ||
              '';
            if (tAkhir) rit[nkR].terminalAkhir = tAkhir;
          }
        }
      }
    }
  } catch {
    // ignore
  }

  return { jadwal, rit };
}

export async function fetchMasterPramudi(): Promise<MasterPramudiItem[]> {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${MASTER_SHEET_ID}/gviz/tq?tqx=out:json&sheet=MASTER_PRAMUDI&t=${Date.now()}`;
    const res = await fetch(url);
    const txt = await res.text();
    const g = parseGvizJson(txt);
    if (!g?.table?.rows) return [];

    const cols = g.table.cols || [];
    const rows = g.table.rows || [];
    let idxId = -1;
    let idxNama = -1;
    let idxAwal = -1;
    let idxStatus = -1;

    for (let c = 0; c < cols.length; c++) {
      const lbl = String(cols[c]?.label || cols[c]?.id || '').toUpperCase().trim();
      if (lbl === 'ID_PRAMUDI') idxId = c;
      else if (lbl === 'NAMA_PRAMUDI' || lbl === 'NAMA') idxNama = c;
      else if (lbl === 'AWAL_OPERASIONAL') idxAwal = c;
      else if (lbl === 'STATUS') idxStatus = c;
    }

    let startRow = 0;
    if (idxId === -1 && idxNama === -1 && rows.length > 0) {
      const fc = rows[0]?.c || [];
      for (let c = 0; c < fc.length; c++) {
        const lbl = getGvizCellText(fc[c]).toUpperCase();
        if (lbl === 'ID_PRAMUDI') idxId = c;
        else if (lbl === 'NAMA_PRAMUDI' || lbl === 'NAMA') idxNama = c;
        else if (lbl === 'AWAL_OPERASIONAL') idxAwal = c;
        else if (lbl === 'STATUS') idxStatus = c;
      }
      if (idxId !== -1 || idxNama !== -1) startRow = 1;
    }

    if (idxId === -1) idxId = 0;
    if (idxNama === -1) idxNama = 1;
    if (idxAwal === -1) idxAwal = 2;
    if (idxStatus === -1) idxStatus = 3;

    const list: MasterPramudiItem[] = [];
    for (let i = startRow; i < rows.length; i++) {
      const cells = rows[i]?.c || [];
      const id = getGvizCellText(cells[idxId]);
      const nama = getGvizCellText(cells[idxNama]);
      if (!nama || nama.toUpperCase() === 'NAMA_PRAMUDI' || id.toUpperCase() === 'ID_PRAMUDI') {
        continue;
      }
      const status = (getGvizCellText(cells[idxStatus]) || 'AKTIF').toUpperCase();
      if (status && !['AKTIF', 'ACTIVE'].includes(status)) continue;
      list.push({
        id: id || nama,
        nama,
        awalOperasional: getGvizCellText(cells[idxAwal]),
        status,
      });
    }
    return list;
  } catch {
    return [];
  }
}

export async function fetchMasterHalte(): Promise<MasterHalteItem[]> {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${MASTER_SHEET_ID}/gviz/tq?tqx=out:json&sheet=MASTER_HALTE&t=${Date.now()}`;
    const res = await fetch(url);
    const txt = await res.text();
    const g = parseGvizJson(txt);
    if (!g?.table?.rows) return [];

    const cols = g.table.cols || [];
    const rows = g.table.rows || [];
    let idxId = -1;
    let idxKor = -1;
    let idxNama = -1;
    let idxArah = -1;
    let idxStatus = -1;

    for (let c = 0; c < cols.length; c++) {
      const lbl = String(cols[c]?.label || cols[c]?.id || '').toUpperCase().trim();
      if (lbl === 'ID_HALTE') idxId = c;
      else if (lbl === 'ID_KORIDOR' || lbl === 'KORIDOR') idxKor = c;
      else if (lbl === 'NAMA_HALTE' || lbl === 'NAMA') idxNama = c;
      else if (lbl === 'ARAH') idxArah = c;
      else if (lbl === 'STATUS') idxStatus = c;
    }

    let startRow = 0;
    if (idxId === -1 && idxNama === -1 && rows.length > 0) {
      const fc = rows[0]?.c || [];
      for (let c = 0; c < fc.length; c++) {
        const lbl = getGvizCellText(fc[c]).toUpperCase();
        if (lbl === 'ID_HALTE') idxId = c;
        else if (lbl === 'ID_KORIDOR' || lbl === 'KORIDOR') idxKor = c;
        else if (lbl === 'NAMA_HALTE' || lbl === 'NAMA') idxNama = c;
        else if (lbl === 'ARAH') idxArah = c;
        else if (lbl === 'STATUS') idxStatus = c;
      }
      if (idxId !== -1 || idxNama !== -1) startRow = 1;
    }

    if (idxId === -1) idxId = 0;
    if (idxKor === -1) idxKor = 1;
    if (idxNama === -1) idxNama = 2;
    if (idxArah === -1) idxArah = 3;
    if (idxStatus === -1) idxStatus = 4;

    const list: MasterHalteItem[] = [];
    for (let i = startRow; i < rows.length; i++) {
      const cells = rows[i]?.c || [];
      const id = getGvizCellText(cells[idxId]);
      const nama = getGvizCellText(cells[idxNama]);
      if (!id || !nama || id.toUpperCase() === 'ID_HALTE' || nama.toUpperCase() === 'NAMA_HALTE') {
        continue;
      }
      const status = (getGvizCellText(cells[idxStatus]) || 'AKTIF').toUpperCase();
      if (status && !['AKTIF', 'ACTIVE'].includes(status)) continue;
      list.push({
        id,
        koridor: getGvizCellText(cells[idxKor]).toUpperCase() || 'KOR01',
        nama,
        arah: getGvizCellText(cells[idxArah]).toUpperCase(),
        status: status || 'AKTIF',
      });
    }
    return list;
  } catch {
    return [];
  }
}

export function normalizeImgUrl(url: string | undefined | null): string {
  if (!url || url === '-' || url === '[Tersimpan di Sesi]') return '';
  const s = url.trim();
  if (
    s.startsWith('data:image/') ||
    s.startsWith('blob:') ||
    s.startsWith('http://') ||
    s.startsWith('https://')
  ) {
    const match = s.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://drive.google.com/uc?export=view&id=${match[1]}`;
    }
    return s;
  }
  return '';
}

export async function fetchLostFoundSheet(): Promise<LostItemDisplay[]> {
  const sheetNames = ['DATA_LOST_FOUND', 'DB_LOST_FOUND', 'Lost_found'];
  for (const sheetName of sheetNames) {
    try {
      const url = `https://docs.google.com/spreadsheets/d/${MASTER_SHEET_ID}/gviz/tq?tqx=out:json&sheet=${sheetName}&t=${Date.now()}`;
      const res = await fetch(url);
      const txt = await res.text();
      const g = parseGvizJson(txt);
      if (!g?.table?.rows) continue;
      const cols = g.table.cols || [];
      const rows = g.table.rows || [];
      const idxMap: Record<string, number> = {};
      for (let c = 0; c < cols.length; c++) {
        const lbl = String(cols[c]?.label || cols[c]?.id || '').toUpperCase().trim();
        if (lbl) idxMap[lbl] = c;
      }
      let startRow = 0;
      if (
        idxMap['NMA_BARANG'] === undefined &&
        idxMap['NAMA_BARANG'] === undefined &&
        rows.length > 0
      ) {
        const fc = rows[0]?.c || [];
        for (let c = 0; c < fc.length; c++) {
          const lbl = getGvizCellText(fc[c]).toUpperCase();
          if (lbl) idxMap[lbl] = c;
        }
        if (idxMap['NMA_BARANG'] !== undefined || idxMap['NAMA_BARANG'] !== undefined) {
          startRow = 1;
        }
      }
      if (
        idxMap['ID_BARANG'] === undefined ||
        (idxMap['NMA_BARANG'] === undefined && idxMap['NAMA_BARANG'] === undefined)
      ) {
        continue;
      }
      const items: LostItemDisplay[] = [];
      for (let rIdx = startRow; rIdx < rows.length; rIdx++) {
        const cells = rows[rIdx]?.c || [];
        const nama = getGvizCellText(cells[idxMap['NMA_BARANG'] ?? idxMap['NAMA_BARANG'] ?? 8]);
        if (!nama || nama.toUpperCase() === 'NMA_BARANG' || nama.toUpperCase() === 'NAMA_BARANG') continue;
        const tglRaw = getGvizCellText(cells[idxMap['TANGGAL'] ?? 1], true);
        const tglFmt = tglRaw.includes('-') && tglRaw.split('-')[0].length === 4
          ? tglRaw.split('-').reverse().join('-')
          : tglRaw;
        const foto1 = normalizeImgUrl(getGvizCellText(cells[idxMap['FOTO_1'] ?? idxMap['FOTO1'] ?? 13]));
        const foto2 = normalizeImgUrl(getGvizCellText(cells[idxMap['FOTO_2'] ?? idxMap['FOTO2'] ?? 14]));
        items.push({
          id: getGvizCellText(cells[idxMap['ID_BARANG'] ?? 0]),
          barang: nama,
          lambung: getGvizCellText(cells[idxMap['ID_ARMADA'] ?? 4]) || '-',
          tgl: tglFmt || '-',
          status: getGvizCellText(cells[idxMap['STATUS'] ?? 17]) || 'DI_KANTOR',
          lokasi: getGvizCellText(cells[idxMap['LOKASI_DITEMUKAN'] ?? 7]) || '-',
          kategori: getGvizCellText(cells[idxMap['KATEGORI'] ?? 9]) || 'Lainnya',
          foto: foto1 || foto2 || '',
          foto2: foto2 && foto1 ? foto2 : undefined,
        });
      }
      if (items.length > 0) return items;
    } catch {
      // try next sheet name
    }
  }
  return [];
}

export function normalizePramRecord(item: PramujasaRecord): {
  tunai: KategoriCounts;
  nonTunai: KategoriCounts;
  totalTunai: number;
  totalNonTunai: number;
  totalHalte: number;
} {
  if (item.tunai && item.nonTunai) {
    const totalTunai = KATEGORI_LIST.reduce((acc, k) => acc + (Number(item.tunai[k.key]) || 0), 0);
    const totalNonTunai = KATEGORI_LIST.reduce((acc, k) => acc + (Number(item.nonTunai[k.key]) || 0), 0);
    return {
      tunai: item.tunai,
      nonTunai: item.nonTunai,
      totalTunai,
      totalNonTunai,
      totalHalte: totalTunai + totalNonTunai,
    };
  }

  // Backward compatibility untuk data lama berbasis dropdown metodeBayar
  const counts: KategoriCounts = {
    umum: Number(item.umum) || 0,
    buruh: Number(item.buruh) || 0,
    pelajar: Number(item.pelajar) || 0,
    lansia: Number(item.lansia) || 0,
    disabilitas: Number(item.disabilitas) || 0,
    veteran: Number(item.veteran) || 0,
  };
  const sum = KATEGORI_LIST.reduce((acc, k) => acc + counts[k.key], 0);
  const isNT = String(item.metodeBayar || '').toUpperCase().includes('NON TUNAI');
  return {
    tunai: isNT ? emptyKategoriCounts() : counts,
    nonTunai: isNT ? counts : emptyKategoriCounts(),
    totalTunai: isNT ? 0 : sum,
    totalNonTunai: isNT ? sum : 0,
    totalHalte: sum,
  };
}

export function hitungRingkasanRitPram(
  riw: PramujasaRecord[],
  tgl: string,
  lb: string,
  rit: string,
  idp: string
) {
  const tunai = emptyKategoriCounts();
  const nonTunai = emptyKategoriCounts();
  let totalTunai = 0;
  let totalNonTunai = 0;
  let totalRit = 0;
  let totalTurunRit = 0;
  let totalTransitRit = 0;
  let totalPPTRit = 0;

  const normRit = (r: string) => {
    const s = String(r || '').toUpperCase().replace(/[^0-9]/g, '');
    return s ? String(parseInt(s, 10)) : String(r || '').toUpperCase();
  };

  for (const item of riw) {
    if (!item) continue;
    let cocok = false;
    if (idp && item.idPerjalanan) {
      cocok = item.idPerjalanan === idp;
    } else {
      const samaLb = !lb || !item.noLambung || item.noLambung === lb;
      const samaRit = !rit || !item.rit || item.rit === rit || normRit(item.rit) === normRit(rit);
      const samaTgl = !tgl || !item.tanggal || item.tanggal === tgl;
      cocok = samaTgl && samaLb && samaRit;
    }
    if (!cocok) continue;

    const norm = normalizePramRecord(item);
    for (const k of KATEGORI_LIST) {
      tunai[k.key] += norm.tunai[k.key];
      nonTunai[k.key] += norm.nonTunai[k.key];
    }
    totalTunai += norm.totalTunai;
    totalNonTunai += norm.totalNonTunai;
    totalRit += norm.totalHalte;
    totalTurunRit += Number(item.penumpangTurun) || 0;
    totalTransitRit += Number(item.penumpangTransit) || 0;
    totalPPTRit += Number(item.penumpangPPT) || 0;
  }

  return {
    tunai,
    nonTunai,
    totalTunai,
    totalNonTunai,
    totalRit,
    totalTurunRit,
    totalTransitRit,
    totalPPTRit,
  };
}

export function kompresGambarFile(
  file: File,
  maxDim = 360,
  kualitas = 0.42,
  maxChars = 9000
): Promise<{ dataUrl: string; width: number; height: number; kb: number }> {
  return new Promise((resolve, reject) => {
    const HARD_SHEET_CELL_LIMIT = 45000;
    const renderAdaptive = (img: HTMLImageElement) => {
      const origW = img.naturalWidth || img.width || 800;
      const origH = img.naturalHeight || img.height || 800;
      const attempts: [number, number][] = [
        [maxDim, kualitas],
        [400, 0.44],
        [320, 0.36],
        [240, 0.28],
        [180, 0.22],
        [150, 0.2],
        [120, 0.16],
        [96, 0.14],
        [72, 0.12],
      ];

      let bestUrl = '';
      let bestW = origW;
      let bestH = origH;

      for (const [dimLimit, q] of attempts) {
        let w = origW;
        let h = origH;
        if (w > dimLimit || h > dimLimit) {
          if (w >= h) {
            h = Math.max(1, Math.round((h * dimLimit) / w));
            w = dimLimit;
          } else {
            w = Math.max(1, Math.round((w * dimLimit) / h));
            h = dimLimit;
          }
        }
        try {
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            const candidate = canvas.toDataURL('image/jpeg', q);
            if (candidate.startsWith('data:image/')) {
              if (!bestUrl || candidate.length < bestUrl.length) {
                bestUrl = candidate;
                bestW = w;
                bestH = h;
              }
              if (candidate.length <= maxChars && candidate.length <= HARD_SHEET_CELL_LIMIT) {
                const kb = Math.max(1, Math.round((candidate.length * 3) / 4 / 1024));
                return { dataUrl: candidate, width: w, height: h, kb };
              }
            }
          }
        } catch {
          // continue trying smaller target
        }
      }

      if (bestUrl && bestUrl.length <= HARD_SHEET_CELL_LIMIT) {
        const kb = Math.max(1, Math.round((bestUrl.length * 3) / 4 / 1024));
        return { dataUrl: bestUrl, width: bestW, height: bestH, kb };
      }
      return null;
    };

    const compressFromSrc = (srcUrl: string, shouldRevoke: boolean, isFallback: boolean) => {
      const img = new Image();
      img.onload = () => {
        const result = renderAdaptive(img);
        if (shouldRevoke) {
          try {
            URL.revokeObjectURL(srcUrl);
          } catch {
            // ignore
          }
        }
        if (result) {
          resolve(result);
          return;
        }
        if (!isFallback) {
          readWithFileReader();
        } else {
          reject(new Error('Gagal mengompres gambar agar muat di database.'));
        }
      };
      img.onerror = () => {
        if (shouldRevoke) {
          try {
            URL.revokeObjectURL(srcUrl);
          } catch {
            // ignore
          }
        }
        if (!isFallback) {
          readWithFileReader();
        } else {
          reject(new Error('Terjadi kesalahan saat memuat gambar.'));
        }
      };
      img.src = srcUrl;
    };

    const readWithFileReader = () => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const rawUrl = String(evt.target?.result || '');
        if (!rawUrl) {
          reject(new Error('Gagal membaca file gambar.'));
          return;
        }
        compressFromSrc(rawUrl, false, true);
      };
      reader.onerror = () => reject(new Error('Terjadi kesalahan saat memuat gambar.'));
      reader.readAsDataURL(file);
    };

    try {
      if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        const objUrl = URL.createObjectURL(file);
        compressFromSrc(objUrl, true, false);
        return;
      }
    } catch {
      // fall through to FileReader
    }
    readWithFileReader();
  });
}

function escapeBackupHtml(val: unknown): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface AntengBackupStats {
  timer: number;
  ppa: number;
  pramujasa: number;
  kasir: number;
  total: number;
}

export function getLocalBackupStats(): AntengBackupStats {
  const timer = bacaStorage<Record<string, unknown>>(STORAGE_TIMER_KEY).length;
  const ppa = bacaStorage<Record<string, unknown>>(STORAGE_PPA_KEY).length;
  const pramujasa = bacaStorage<Record<string, unknown>>(STORAGE_PRAM_KEY).length;
  const kasir = bacaStorage<Record<string, unknown>>(STORAGE_KASIR_KEY).length;
  return {
    timer,
    ppa,
    pramujasa,
    kasir,
    total: timer + ppa + pramujasa + kasir,
  };
}

export function downloadHtmlBackupData(): { filename: string; stats: AntengBackupStats } {
  const timerData = bacaStorage<Record<string, unknown>>(STORAGE_TIMER_KEY);
  const ppaData = bacaStorage<Record<string, unknown>>(STORAGE_PPA_KEY);
  const pramData = bacaStorage<PramujasaRecord>(STORAGE_PRAM_KEY);
  const kasirData = bacaStorage<Record<string, unknown>>(STORAGE_KASIR_KEY);

  const now = new Date();
  const stamp = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}-${pad2(now.getHours())}${pad2(now.getMinutes())}`;
  const waktuLabel = timestampSekarang();
  const filename = `backup-data-teman-anteng-${stamp}.html`;

  const snapshot = {
    app: 'TEMAN ANTENG - Teknologi Manajemen Transjateng',
    exportedAt: waktuLabel,
    version: 1,
    data: {
      [STORAGE_TIMER_KEY]: timerData,
      [STORAGE_PPA_KEY]: ppaData,
      [STORAGE_PRAM_KEY]: pramData,
      [STORAGE_KASIR_KEY]: kasirData,
    },
  };

  const jsonEmbedded = JSON.stringify(snapshot).replace(/<\/script/gi, '<\\/script');

  const timerRows = timerData
    .map(
      (d) =>
        `<tr><td>${escapeBackupHtml(d.tanggal)}</td><td>${escapeBackupHtml(d.idPerjalanan)}</td><td>${escapeBackupHtml(d.noLambung)} / ${escapeBackupHtml(d.rit)}</td><td>${escapeBackupHtml(d.jadwal)} → ${escapeBackupHtml(d.aktual)}</td><td>${escapeBackupHtml(d.pnpNaik)} / Tr:${escapeBackupHtml(d.pnpTransit)} / Tur:${escapeBackupHtml(d.pnpTurun)}</td><td>${escapeBackupHtml(d.petugas)}</td><td>${escapeBackupHtml(d.status)}</td></tr>`
    )
    .join('');

  const ppaRows = ppaData
    .map(
      (d) =>
        `<tr><td>${escapeBackupHtml(d.tanggal)}</td><td>${escapeBackupHtml(d.idPerjalanan)}</td><td>${escapeBackupHtml(d.pos)}</td><td>${escapeBackupHtml(d.jamTiba)}</td><td>All:${escapeBackupHtml(d.all)} | Naik:${escapeBackupHtml(d.naik)} | Turun:${escapeBackupHtml(d.turun)}</td><td>${escapeBackupHtml(d.headwayPos)}</td><td>${escapeBackupHtml(d.status)}</td></tr>`
    )
    .join('');

  const pramRows = pramData
    .map((d) => {
      const n = normalizePramRecord(d);
      return `<tr><td>${escapeBackupHtml(d.tanggal)}</td><td>${escapeBackupHtml(d.idPerjalanan)}</td><td>${escapeBackupHtml(d.namaHalte)} (${escapeBackupHtml(d.idHalte)})</td><td>${escapeBackupHtml(d.namaPramudi || '-')}</td><td>Tunai ${n.totalTunai} (U:${n.tunai.umum}, B:${n.tunai.buruh}, P:${n.tunai.pelajar}, L:${n.tunai.lansia}, D:${n.tunai.disabilitas}, V:${n.tunai.veteran})</td><td>Non-Tunai ${n.totalNonTunai} (U:${n.nonTunai.umum}, B:${n.nonTunai.buruh}, P:${n.nonTunai.pelajar}, L:${n.nonTunai.lansia}, D:${n.nonTunai.disabilitas}, V:${n.nonTunai.veteran})</td><td>Naik:${n.totalHalte} | Turun:${escapeBackupHtml(d.penumpangTurun)}</td><td>${escapeBackupHtml(d.status)}</td></tr>`;
    })
    .join('');

  const kasirRows = kasirData
    .map(
      (d) =>
        `<tr><td>${escapeBackupHtml(d.tanggal)}</td><td>${escapeBackupHtml(d.idPerjalanan)}</td><td>${escapeBackupHtml(d.noLambung)} / ${escapeBackupHtml(d.rit)}</td><td>Tunai: ${escapeBackupHtml(formatRupiah(Number(d.setoranTunai) || 0))}</td><td>Non-Tunai: ${escapeBackupHtml(formatRupiah(Number(d.setoranNonTunai) || 0))}</td><td>${escapeBackupHtml(formatRupiah(Number(d.totalPendapatan) || 0))} (${escapeBackupHtml(d.totalPenumpang)} pnp)</td><td>${escapeBackupHtml(d.statusKirim)}</td></tr>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Backup Data TEMAN ANTENG (${escapeBackupHtml(stamp)})</title>
<style>
  body{font-family:Segoe UI,Arial,sans-serif;background:#f8fafc;color:#0f172a;margin:0;padding:20px}
  .wrap{max-width:1100px;margin:0 auto;background:#fff;border:1px solid #cbd5e1;border-radius:16px;padding:24px}
  h1{margin:0 0 6px;font-size:22px;color:#b91c1c}
  .meta{color:#475569;font-size:13px;margin-bottom:18px}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:20px}
  .card{background:#f1f5f9;border:1px solid #cbd5e1;border-radius:12px;padding:12px;text-align:center}
  .card b{display:block;font-size:22px;color:#0f172a}
  .card span{font-size:12px;color:#475569;font-weight:700}
  h2{font-size:16px;margin:22px 0 8px;padding-bottom:6px;border-bottom:2px solid #e2e8f0}
  .tbl-wrap{overflow-x:auto}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th,td{border:1px solid #cbd5e1;padding:7px 9px;text-align:left;vertical-align:top}
  th{background:#f8fafc;font-weight:800}
  .empty{color:#64748b;font-style:italic;font-size:13px;padding:10px 0}
</style>
</head>
<body>
<div class="wrap">
  <h1>BACKUP DATA OPERASIONAL - TEMAN ANTENG</h1>
  <div class="meta">Waktu Ekspor: <b>${escapeBackupHtml(waktuLabel)}</b> · File HTML ini dapat dibuka kapan saja sebagai arsip dan juga bisa di-restore kembali di layar Login TEMAN ANTENG.</div>
  <div class="cards">
    <div class="card"><b>${timerData.length}</b><span>Data Timer</span></div>
    <div class="card"><b>${ppaData.length}</b><span>Data PPA</span></div>
    <div class="card"><b>${pramData.length}</b><span>Data Pramujasa</span></div>
    <div class="card"><b>${kasirData.length}</b><span>Data Kasir</span></div>
  </div>
  <h2>1. Riwayat Timer</h2>
  ${timerRows ? `<div class="tbl-wrap"><table><thead><tr><th>Tanggal</th><th>ID Perjalanan</th><th>Bus / Rit</th><th>Jadwal → Aktual</th><th>Penumpang</th><th>Petugas</th><th>Status</th></tr></thead><tbody>${timerRows}</tbody></table></div>` : `<div class="empty">Belum ada data Timer di perangkat ini.</div>`}
  <h2>2. Riwayat PPA</h2>
  ${ppaRows ? `<div class="tbl-wrap"><table><thead><tr><th>Tanggal</th><th>ID Perjalanan</th><th>POS</th><th>Jam Tiba</th><th>Penumpang</th><th>Headway</th><th>Status</th></tr></thead><tbody>${ppaRows}</tbody></table></div>` : `<div class="empty">Belum ada data PPA di perangkat ini.</div>`}
  <h2>3. Riwayat Pramujasa (Termasuk Draft Sementara Per Halte)</h2>
  ${pramRows ? `<div class="tbl-wrap"><table><thead><tr><th>Tanggal</th><th>ID Perjalanan</th><th>Halte</th><th>Pramudi</th><th>Tunai</th><th>Non-Tunai</th><th>Total</th><th>Status</th></tr></thead><tbody>${pramRows}</tbody></table></div>` : `<div class="empty">Belum ada data Pramujasa di perangkat ini.</div>`}
  <h2>4. Riwayat Setoran Kasir</h2>
  ${kasirRows ? `<div class="tbl-wrap"><table><thead><tr><th>Tanggal</th><th>ID Perjalanan</th><th>Bus / Rit</th><th>Setoran Tunai</th><th>Setoran Non-Tunai</th><th>Total</th><th>Status</th></tr></thead><tbody>${kasirRows}</tbody></table></div>` : `<div class="empty">Belum ada data Kasir di perangkat ini.</div>`}
</div>
<script id="anteng-backup-json" type="application/json">${jsonEmbedded}</script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return {
    filename,
    stats: {
      timer: timerData.length,
      ppa: ppaData.length,
      pramujasa: pramData.length,
      kasir: kasirData.length,
      total: timerData.length + ppaData.length + pramData.length + kasirData.length,
    },
  };
}

export function restoreBackupFromFileText(fileText: string): AntengBackupStats {
  let jsonText = fileText.trim();
  const match = fileText.match(/<script[^>]*id=["']anteng-backup-json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (match && match[1]) {
    jsonText = match[1].trim();
  }
  const parsed = JSON.parse(jsonText) as {
    data?: Record<string, unknown[]>;
  };
  if (!parsed || typeof parsed !== 'object' || !parsed.data) {
    throw new Error('Format file backup tidak valid.');
  }
  const keys = [STORAGE_TIMER_KEY, STORAGE_PPA_KEY, STORAGE_PRAM_KEY, STORAGE_KASIR_KEY] as const;
  for (const k of keys) {
    const arr = parsed.data[k];
    if (Array.isArray(arr)) {
      tulisStorage(k, arr);
    }
  }
  return getLocalBackupStats();
}

export function buildWhatsAppSendUrl(message: string): string {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
}

export function triggerWhatsAppSend(message: string): void {
  const url = buildWhatsAppSendUrl(message);
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function salinTeksClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback below
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
