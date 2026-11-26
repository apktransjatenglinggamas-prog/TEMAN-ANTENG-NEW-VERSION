// KasirScreen.tsx — 4 JENIS (Tunai, Non-Tunai, Manual, PPT).
// Total Penumpang & Total Setoran = Tunai + Non-Tunai + Manual.
// PPT terpisah, Rp-nya 0, tidak masuk total.
// Manual & PPT per kategori disimpan di record (field rincianManualPnp / rincianPptPnp).
// BLOK JENIS BISA DILIPAT: tiap jenis punya tombol Lihat / Sembunyikan
// supaya halaman pendek di HP. Menutup blok TIDAK menghapus isi input.
import { ChangeEvent, Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bus,
  Camera,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Filter,
  Image as ImageIcon,
  Layers,
  PackageSearch,
  RotateCcw,
  Search,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react';
import { KasirRecord, KategoriCounts, KategoriKey, LostFoundData, ToastType } from '../types/anteng';
import {
  API_KASIR,
  IDS_KASIR_KEY,
  KATEGORI_LIST,
  LIST_KORIDOR,
  LIST_LB,
  LIST_RIT,
  STORAGE_KASIR_KEY,
  bacaStorage,
  cacheLfPhoto,
  clearLfPhotoCache,
  emptyKategoriCounts,
  formatRupiah,
  hasSavedIdPerjalanan,
  jamSekarangHHMM,
  kompresGambarFile,
  markSavedIdPerjalanan,
  resolveLfPhotoUrl,
  tglHariIni,
  timestampSekarang,
  tulisStorage,
  getTerminalAkhirFromMasterRit,
} from '../utils/anteng';
import { BrandLogo } from './BrandLogo';

const KASIR_DRAFT_KEY = 'anteng_kasir_draft';

interface KasirDraft {
  tanggal: string;
  koridor: string;
  lb: string;
  rit: string;
  shift?: string;
  tunaiPnp: KategoriCounts;
  nonTunaiPnp: KategoriCounts;
  manualPnp: KategoriCounts;
  pptPnp: KategoriCounts;
  ket: string;
  adaLF: boolean;
  lfJam: string;
  lfKategori: string;
  lfNamaBarang: string;
  lfWarna: string;
  lfMerek: string;
  lfLokasi: string;
  lfDetail: string;
  lfFoto1: { url: string; info: string };
  lfFoto2: { url: string; info: string };
  lfDitemukanOleh: string;
  lfPenerima: string;
  lfStatus: string;
  lfCatatan: string;
}

function readKasirDraft(today: string): Partial<KasirDraft> {
  try {
    const raw =
      sessionStorage.getItem(KASIR_DRAFT_KEY) || localStorage.getItem(KASIR_DRAFT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<KasirDraft>;
    if (parsed && parsed.tanggal === today) {
      const f1 = resolveLfPhotoUrl('kasir_draft', 1, parsed.lfFoto1?.url) || '-';
      const f2 = resolveLfPhotoUrl('kasir_draft', 2, parsed.lfFoto2?.url) || '-';
      return {
        ...parsed,
        lfFoto1: { url: f1, info: f1 !== '-' ? parsed.lfFoto1?.info || '' : '' },
        lfFoto2: { url: f2, info: f2 !== '-' ? parsed.lfFoto2?.info || '' : '' },
      };
    }
  } catch {
    // ignore
  }
  return {};
}

function writeKasirDraft(draft: KasirDraft | null) {
  try {
    if (!draft) {
      sessionStorage.removeItem(KASIR_DRAFT_KEY);
      localStorage.removeItem(KASIR_DRAFT_KEY);
      clearLfPhotoCache('kasir_draft', 1);
      clearLfPhotoCache('kasir_draft', 2);
      return;
    }
    if (draft.lfFoto1?.url && draft.lfFoto1.url !== '-') {
      cacheLfPhoto('kasir_draft', 1, draft.lfFoto1.url);
    } else {
      clearLfPhotoCache('kasir_draft', 1);
    }
    if (draft.lfFoto2?.url && draft.lfFoto2.url !== '-') {
      cacheLfPhoto('kasir_draft', 2, draft.lfFoto2.url);
    } else {
      clearLfPhotoCache('kasir_draft', 2);
    }
    const serialized = JSON.stringify(draft);
    let savedToSession = false;
    try {
      sessionStorage.setItem(KASIR_DRAFT_KEY, serialized);
      savedToSession = true;
    } catch {
      // ignore session quota
    }
    try {
      localStorage.setItem(KASIR_DRAFT_KEY, serialized);
    } catch {
      const compactDraft: KasirDraft = {
        ...draft,
        lfFoto1: {
          // PERBAIKAN BUILD: jangan pakai literal 'data:image/' di sini,
          // karena string itu bisa kepotong / kena sensor saat paste
          // dan membuat Vite gagal parse. Cek awalan 'data:' saja,
          // dan placeholder tanpa kurung siku.
          url: draft.lfFoto1.url.indexOf('data:') === 0 ? 'TERSIMPAN_DI_SESI' : draft.lfFoto1.url,
          info: draft.lfFoto1.info,
        },
        lfFoto2: {
          url: draft.lfFoto2.url.indexOf('data:') === 0 ? 'TERSIMPAN_DI_SESI' : draft.lfFoto2.url,
          info: draft.lfFoto2.info,
        },
      };
      const textSerialized = JSON.stringify(compactDraft);
      if (!savedToSession) {
        try {
          sessionStorage.setItem(KASIR_DRAFT_KEY, textSerialized);
        } catch {
          // ignore
        }
      }
      localStorage.setItem(KASIR_DRAFT_KEY, textSerialized);
    }
  } catch {
    // ignore storage errors
  }
}

export interface CategoryBreakdownRow {
  key: KategoriKey;
  label: string;
  tarif: number;
  tunaiPnp: number;
  tunaiRp: number;
  nonTunaiPnp: number;
  nonTunaiRp: number;
  manualPnp: number;
  manualRp: number;
  pptPnp: number;
  totalPnp: number;
  totalRp: number;
}

export function computeCategoryBreakdown(records: KasirRecord[]) {
  const rows: CategoryBreakdownRow[] = KATEGORI_LIST.map((kat) => {
    let tunaiPnp = 0;
    let tunaiRp = 0;
    let nonTunaiPnp = 0;
    let nonTunaiRp = 0;
    let manualPnp = 0;
    let manualRp = 0;
    let pptPnp = 0;

    for (const rec of records) {
      // Field Manual/PPT belum ada di KasirRecord lama -> baca lewat cast agar
      // record lama (tanpa field itu) tetap terbaca sebagai 0.
      const loose = rec as unknown as Record<
        string,
        Record<string, number> | undefined
      >;
      const tp = Number(rec.rincianTunaiPnp?.[kat.key]) || 0;
      const tr =
        rec.rincianTunaiRp?.[kat.key] !== undefined
          ? Number(rec.rincianTunaiRp[kat.key]) || 0
          : tp * kat.tarif;

      const ntp = Number(rec.rincianNonTunaiPnp?.[kat.key]) || 0;
      const ntr =
        rec.rincianNonTunaiRp?.[kat.key] !== undefined
          ? Number(rec.rincianNonTunaiRp[kat.key]) || 0
          : ntp * kat.tarif;

      const mp = Number(loose.rincianManualPnp?.[kat.key]) || 0;
      const mr =
        loose.rincianManualRp?.[kat.key] !== undefined
          ? Number(loose.rincianManualRp[kat.key]) || 0
          : mp * kat.tarif;

      const pp = Number(loose.rincianPptPnp?.[kat.key]) || 0;

      tunaiPnp += tp;
      tunaiRp += tr;
      nonTunaiPnp += ntp;
      nonTunaiRp += ntr;
      manualPnp += mp;
      manualRp += mr;
      pptPnp += pp;
    }

    return {
      key: kat.key,
      label: kat.label,
      tarif: kat.tarif,
      tunaiPnp,
      tunaiRp,
      nonTunaiPnp,
      nonTunaiRp,
      manualPnp,
      manualRp,
      pptPnp,
      // Total Pnp & Total Setoran HANYA Tunai + Non-Tunai + Manual.
      // PPT terpisah, tidak masuk total.
      totalPnp: tunaiPnp + nonTunaiPnp + manualPnp,
      totalRp: tunaiRp + nonTunaiRp + manualRp,
    };
  });

  const subtotalTunaiPnp = rows.reduce((acc, r) => acc + r.tunaiPnp, 0);
  const subtotalTunaiRp = rows.reduce((acc, r) => acc + r.tunaiRp, 0);
  const subtotalNonTunaiPnp = rows.reduce((acc, r) => acc + r.nonTunaiPnp, 0);
  const subtotalNonTunaiRp = rows.reduce((acc, r) => acc + r.nonTunaiRp, 0);
  const subtotalManualPnp = rows.reduce((acc, r) => acc + r.manualPnp, 0);
  const subtotalManualRp = rows.reduce((acc, r) => acc + r.manualRp, 0);
  const subtotalPptPnp = rows.reduce((acc, r) => acc + r.pptPnp, 0);
  const totalPnp = subtotalTunaiPnp + subtotalNonTunaiPnp + subtotalManualPnp;
  const totalRp = subtotalTunaiRp + subtotalNonTunaiRp + subtotalManualRp;

  return {
    rows,
    subtotalTunaiPnp,
    subtotalTunaiRp,
    subtotalNonTunaiPnp,
    subtotalNonTunaiRp,
    subtotalManualPnp,
    subtotalManualRp,
    subtotalPptPnp,
    totalPnp,
    totalRp,
  };
}

interface KasirScreenProps {
  petugasNama: string;
  onBackToLogin: () => void;
  onOpenLostFound: () => void;
  showToast: (msg: string, type?: ToastType) => void;
}

export function KasirScreen({
  petugasNama,
  onBackToLogin,
  onOpenLostFound,
  showToast,
}: KasirScreenProps) {
  const [tanggal, setTanggal] = useState(tglHariIni());
  const [initialDraft] = useState<Partial<KasirDraft>>(() => readKasirDraft(tglHariIni()));
  const [koridor, setKoridor] = useState(initialDraft.koridor || 'KOR01');
  const [lb, setLb] = useState(initialDraft.lb || 'LB01');
  const [rit, setRit] = useState(initialDraft.rit || 'R01');
  const [shift, setShift] = useState(
    initialDraft.shift ||
      (parseInt(String(initialDraft.rit || 'R01').replace(/\D/g, ''), 10) >= 5
        ? 'SHIFT 2'
        : 'SHIFT 1')
  );
  const [expandedLb, setExpandedLb] = useState<string | null>(null);
  const [filterHanyaSetor, setFilterHanyaSetor] = useState(false);
  const [selectedDetailTerminal, setSelectedDetailTerminal] = useState<string>('Semua');
  const [selectedDetailShift, setSelectedDetailShift] = useState<string>('Semua');
  const [selectedDetailLb, setSelectedDetailLb] = useState<string>('Semua');
  const [detailSubView, setDetailSubView] = useState<'kategori' | 'rekap'>('kategori');
  const [selectedSetoranTerminal, setSelectedSetoranTerminal] = useState<string>(() => {
    try {
      if (
        petugasNama.toLowerCase().includes('bulupitu') ||
        petugasNama.toLowerCase().includes('bp')
      ) {
        return 'Bulupitu';
      }
    } catch {}
    return 'Bukateja';
  });
  const [selectedSetoranShift, setSelectedSetoranShift] = useState<string>(() => {
    try {
      if (/shift\s*2|\bs2\b/i.test(petugasNama || '')) {
        return 'Shift 2';
      }
    } catch {}
    return 'Shift 1';
  });
  const [showRekap4Shift, setShowRekap4Shift] = useState<boolean>(false);
  const [showSetoranHariIni, setShowSetoranHariIni] = useState<boolean>(false);
  const [showDetailPerShift, setShowDetailPerShift] = useState<boolean>(false);
  const [showRiwayatSetoran, setShowRiwayatSetoran] = useState<boolean>(false);

  const [tunaiPnp, setTunaiPnp] = useState<KategoriCounts>(
    () => initialDraft.tunaiPnp || emptyKategoriCounts()
  );
  const [nonTunaiPnp, setNonTunaiPnp] = useState<KategoriCounts>(
    () => initialDraft.nonTunaiPnp || emptyKategoriCounts()
  );
  const [manualPnp, setManualPnp] = useState<KategoriCounts>(
    () => initialDraft.manualPnp || emptyKategoriCounts()
  );
  const [pptPnp, setPptPnp] = useState<KategoriCounts>(
    () => initialDraft.pptPnp || emptyKategoriCounts()
  );
  const [ket, setKet] = useState(initialDraft.ket || '');

  // === BARU: lipat/buka tiap blok jenis (biar halaman pendek di HP) ===
  // Default: hanya TUNAI terbuka, 3 lainnya tertutup.
  const [openJenis, setOpenJenis] = useState({
    tunai: true,
    nonTunai: false,
    manual: false,
    ppt: false,
  });
  const toggleJenis = (jenis: 'tunai' | 'nonTunai' | 'manual' | 'ppt') =>
    setOpenJenis((prev) => ({ ...prev, [jenis]: !prev[jenis] }));

  // Lost & Found state
  const [adaLF, setAdaLF] = useState(Boolean(initialDraft.adaLF));
  const [lfJam, setLfJam] = useState(initialDraft.lfJam || jamSekarangHHMM());
  const [lfKategori, setLfKategori] = useState(initialDraft.lfKategori || 'Lainnya');
  const [lfNamaBarang, setLfNamaBarang] = useState(initialDraft.lfNamaBarang || '');
  const [lfWarna, setLfWarna] = useState(initialDraft.lfWarna || '');
  const [lfMerek, setLfMerek] = useState(initialDraft.lfMerek || '');
  const [lfLokasi, setLfLokasi] = useState(initialDraft.lfLokasi || '');
  const [lfDetail, setLfDetail] = useState(initialDraft.lfDetail || '');
  const [lfFoto1, setLfFoto1] = useState<{ url: string; info: string }>(
    () => initialDraft.lfFoto1 || { url: '-', info: '' }
  );
  const [lfFoto2, setLfFoto2] = useState<{ url: string; info: string }>(
    () => initialDraft.lfFoto2 || { url: '-', info: '' }
  );
  const [lfDitemukanOleh, setLfDitemukanOleh] = useState(
    initialDraft.lfDitemukanOleh || petugasNama
  );
  const [lfPenerima, setLfPenerima] = useState(
    initialDraft.lfPenerima || 'Admin Kasir / Kantor Terminal'
  );
  const [lfStatus, setLfStatus] = useState(initialDraft.lfStatus || 'DI_KANTOR');
  const [lfCatatan, setLfCatatan] = useState(initialDraft.lfCatatan || '');

  useEffect(() => {
    writeKasirDraft({
      tanggal,
      koridor,
      lb,
      rit,
      shift,
      tunaiPnp,
      nonTunaiPnp,
      manualPnp,
      pptPnp,
      ket,
      adaLF,
      lfJam,
      lfKategori,
      lfNamaBarang,
      lfWarna,
      lfMerek,
      lfLokasi,
      lfDetail,
      lfFoto1,
      lfFoto2,
      lfDitemukanOleh,
      lfPenerima,
      lfStatus,
      lfCatatan,
    });
  }, [
    tanggal,
    koridor,
    lb,
    rit,
    shift,
    tunaiPnp,
    nonTunaiPnp,
    manualPnp,
    pptPnp,
    ket,
    adaLF,
    lfJam,
    lfKategori,
    lfNamaBarang,
    lfWarna,
    lfMerek,
    lfLokasi,
    lfDetail,
    lfFoto1,
    lfFoto2,
    lfDitemukanOleh,
    lfPenerima,
    lfStatus,
    lfCatatan,
  ]);

  const [riwayat, setRiwayat] = useState<KasirRecord[]>(() =>
    bacaStorage<KasirRecord>(STORAGE_KASIR_KEY)
  );
  const [filterHariIni, setFilterHariIni] = useState(true);
  const [sending, setSending] = useState(false);
  const [photoBusyCount, setPhotoBusyCount] = useState(0);
  const [showNextBtn, setShowNextBtn] = useState(false);

  const foto1CamRef = useRef<HTMLInputElement>(null);
  const foto1GalRef = useRef<HTMLInputElement>(null);
  const foto2CamRef = useRef<HTMLInputElement>(null);
  const foto2GalRef = useRef<HTMLInputElement>(null);

  const idPerjalanan = useMemo(
    () => `${koridor}-${lb}${rit}${tanggal.split('-').join('')}`,
    [koridor, lb, rit, tanggal]
  );

  const matriks = useMemo(() => {
    const tunaiRp = emptyKategoriCounts();
    const nonTunaiRp = emptyKategoriCounts();
    const manualRp = emptyKategoriCounts();
    let subTunaiPnp = 0;
    let subTunaiRp = 0;
    let subNonTunaiPnp = 0;
    let subNonTunaiRp = 0;
    let subManualPnp = 0;
    let subManualRp = 0;
    let subPptPnp = 0;

    for (const k of KATEGORI_LIST) {
      const tp = Math.max(0, tunaiPnp[k.key] || 0);
      const ntp = Math.max(0, nonTunaiPnp[k.key] || 0);
      const mp = Math.max(0, manualPnp[k.key] || 0);
      const pp = Math.max(0, pptPnp[k.key] || 0);
      const tr = tp * k.tarif;
      const ntr = ntp * k.tarif;
      const mr = mp * k.tarif;
      tunaiRp[k.key] = tr;
      nonTunaiRp[k.key] = ntr;
      manualRp[k.key] = mr;
      subTunaiPnp += tp;
      subTunaiRp += tr;
      subNonTunaiPnp += ntp;
      subNonTunaiRp += ntr;
      subManualPnp += mp;
      subManualRp += mr;
      subPptPnp += pp;
    }

    return {
      tunaiRp,
      nonTunaiRp,
      manualRp,
      subTunaiPnp,
      subTunaiRp,
      subNonTunaiPnp,
      subNonTunaiRp,
      subManualPnp,
      subManualRp,
      subPptPnp,
      // Total Pnp & Total Setoran = Tunai + Non-Tunai + Manual.
      // PPT terpisah, Rp-nya 0, tidak masuk total.
      totalPnp: subTunaiPnp + subNonTunaiPnp + subManualPnp,
      totalSetoran: subTunaiRp + subNonTunaiRp + subManualRp,
    };
  }, [tunaiPnp, nonTunaiPnp, manualPnp, pptPnp]);

  useEffect(() => {
    for (const r of riwayat) {
      if (r?.idPerjalanan && r.statusKirim !== 'GAGAL_KIRIM') {
        markSavedIdPerjalanan(IDS_KASIR_KEY, r.idPerjalanan);
      }
    }
  }, [riwayat]);

  const existingValidRecord = useMemo(
    () =>
      Boolean(
        riwayat.find((r) => r.idPerjalanan === idPerjalanan && r.statusKirim !== 'GAGAL_KIRIM') ||
          hasSavedIdPerjalanan(IDS_KASIR_KEY, idPerjalanan)
      ),
    [riwayat, idPerjalanan]
  );

  const existingFailedRecord = useMemo(
    () =>
      riwayat.find(
        (r) => r.idPerjalanan === idPerjalanan && r.statusKirim === 'GAGAL_KIRIM'
      ),
    [riwayat, idPerjalanan]
  );

  const displayedRiwayat = useMemo(
    () => (filterHariIni ? riwayat.filter((r) => !r.tanggal || r.tanggal === tanggal) : riwayat),
    [riwayat, filterHariIni, tanggal]
  );

  const handleRitChange = (newRit: string) => {
    setRit(newRit);
    const rNum = parseInt(String(newRit).replace(/\D/g, ''), 10);
    setShift(!isNaN(rNum) && rNum >= 5 ? 'SHIFT 2' : 'SHIFT 1');
  };

  const todayKasirRecords = useMemo(
    () => riwayat.filter((r) => !r.tanggal || r.tanggal === tanggal),
    [riwayat, tanggal]
  );

  const summaryHariIni = useMemo(() => {
    let totalSetoran = 0;
    let totalPnp = 0;
    let totalTunaiRp = 0;
    let totalTunaiPnp = 0;
    let totalNonTunaiRp = 0;
    let totalNonTunaiPnp = 0;
    let totalManualRp = 0;
    let totalManualPnp = 0;
    let totalPptPnp = 0;

    let shift1Rp = 0;
    let shift1Pnp = 0;
    let shift1Count = 0;

    let shift2Rp = 0;
    let shift2Pnp = 0;
    let shift2Count = 0;

    for (const r of todayKasirRecords) {
      const tot = Number(r.totalPendapatan) || 0;
      const pnp = Number(r.totalPenumpang) || 0;
      const tRp = Number(r.setoranTunai) || Number(r.subtotalTunaiRp) || 0;
      const tPnp = Number(r.subtotalTunaiPnp) || 0;
      const ntRp = Number(r.setoranNonTunai) || Number(r.subtotalNonTunaiRp) || 0;
      const ntPnp = Number(r.subtotalNonTunaiPnp) || 0;
      const loose = r as unknown as Record<string, number | undefined>;
      const mRp = Number(loose.setoranManual) || Number(loose.subtotalManualRp) || 0;
      const mPnp = Number(loose.subtotalManualPnp) || 0;
      const ppPnp = Number(loose.subtotalPptPnp) || 0;

      totalSetoran += tot;
      totalPnp += pnp;
      totalTunaiRp += tRp;
      totalTunaiPnp += tPnp;
      totalNonTunaiRp += ntRp;
      totalNonTunaiPnp += ntPnp;
      totalManualRp += mRp;
      totalManualPnp += mPnp;
      totalPptPnp += ppPnp;

      const rNum = parseInt(String(r.rit || '').replace(/\D/g, ''), 10);
      const isShift2 = r.shift?.toUpperCase().includes('2') || (!isNaN(rNum) && rNum >= 5);

      if (isShift2) {
        shift2Rp += tot;
        shift2Pnp += pnp;
        shift2Count += 1;
      } else {
        shift1Rp += tot;
        shift1Pnp += pnp;
        shift1Count += 1;
      }
    }

    return {
      totalSetoran,
      totalPnp,
      totalTunaiRp,
      totalTunaiPnp,
      totalNonTunaiRp,
      totalNonTunaiPnp,
      totalManualRp,
      totalManualPnp,
      totalPptPnp,
      totalRitCount: todayKasirRecords.length,
      shift1: { rp: shift1Rp, pnp: shift1Pnp, count: shift1Count },
      shift2: { rp: shift2Rp, pnp: shift2Pnp, count: shift2Count },
    };
  }, [todayKasirRecords]);

  const detailPerShiftPerLambung = useMemo(() => {
    const map: Record<
      string,
      {
        lb: string;
        shift1: {
          rp: number;
          pnp: number;
          rits: { rit: string; rp: number; pnp: number; status: string }[];
        };
        shift2: {
          rp: number;
          pnp: number;
          rits: { rit: string; rp: number; pnp: number; status: string }[];
        };
        totalRp: number;
        totalPnp: number;
        hasData: boolean;
      }
    > = {};

    for (const b of LIST_LB) {
      map[b] = {
        lb: b,
        shift1: { rp: 0, pnp: 0, rits: [] },
        shift2: { rp: 0, pnp: 0, rits: [] },
        totalRp: 0,
        totalPnp: 0,
        hasData: false,
      };
    }

    for (const r of todayKasirRecords) {
      const b = r.noLambung || 'LB01';
      if (!map[b]) {
        map[b] = {
          lb: b,
          shift1: { rp: 0, pnp: 0, rits: [] },
          shift2: { rp: 0, pnp: 0, rits: [] },
          totalRp: 0,
          totalPnp: 0,
          hasData: false,
        };
      }

      const tot = Number(r.totalPendapatan) || 0;
      const pnp = Number(r.totalPenumpang) || 0;
      const rNum = parseInt(String(r.rit || '').replace(/\D/g, ''), 10);
      const isShift2 = r.shift?.toUpperCase().includes('2') || (!isNaN(rNum) && rNum >= 5);

      const targetShift = isShift2 ? map[b].shift2 : map[b].shift1;
      targetShift.rp += tot;
      targetShift.pnp += pnp;
      targetShift.rits.push({
        rit: r.rit,
        rp: tot,
        pnp,
        status: r.statusKirim,
      });

      map[b].totalRp += tot;
      map[b].totalPnp += pnp;
      map[b].hasData = true;
    }

    return Object.values(map);
  }, [todayKasirRecords]);

  const filteredDetailPerShift = useMemo(() => {
    if (filterHanyaSetor) {
      return detailPerShiftPerLambung.filter((d) => d.hasData);
    }
    return detailPerShiftPerLambung;
  }, [detailPerShiftPerLambung, filterHanyaSetor]);

  const armadaSudahSetorCount = useMemo(
    () => detailPerShiftPerLambung.filter((d) => d.hasData).length,
    [detailPerShiftPerLambung]
  );

  const allowedDetailLambungs = useMemo(() => {
    if (selectedDetailTerminal === 'Bukateja') {
      return ['LB01', 'LB02', 'LB03', 'LB04', 'LB05', 'LB06', 'LB07', 'LBC01'];
    }
    if (selectedDetailTerminal === 'Bulupitu') {
      return ['LB08', 'LB09', 'LB10', 'LB11', 'LB12', 'LB13', 'LB14', 'LBC01'];
    }
    return LIST_LB;
  }, [selectedDetailTerminal]);

  const filteredDetailRecords = useMemo(() => {
    return todayKasirRecords.filter((r) => {
      const term = getTerminalAkhirFromMasterRit(r.noLambung, r.rit);
      const rNum = parseInt(String(r.rit || '').replace(/\D/g, ''), 10);
      const isShift2 = r.shift?.toUpperCase().includes('2') || (!isNaN(rNum) && rNum >= 5);
      const shiftName = isShift2 ? 'Shift 2' : 'Shift 1';

      const matchTerminal =
        selectedDetailTerminal === 'Semua' ||
        term.toLowerCase() === selectedDetailTerminal.toLowerCase();

      const matchShift =
        selectedDetailShift === 'Semua' ||
        shiftName.toLowerCase() === selectedDetailShift.toLowerCase();

      const matchLb =
        selectedDetailLb === 'Semua' ||
        r.noLambung.toUpperCase() === selectedDetailLb.toUpperCase() ||
        ((selectedDetailLb === 'LBC01' || selectedDetailLb === 'LBCO1') &&
          (r.noLambung.toUpperCase() === 'LBC01' || r.noLambung.toUpperCase() === 'LBCO1'));

      return matchTerminal && matchShift && matchLb;
    });
  }, [todayKasirRecords, selectedDetailTerminal, selectedDetailShift, selectedDetailLb]);

  const detailBreakdown = useMemo(() => {
    return computeCategoryBreakdown(filteredDetailRecords);
  }, [filteredDetailRecords]);

  const setoranHariIniFilteredRecords = useMemo(() => {
    return todayKasirRecords.filter((r) => {
      const term = getTerminalAkhirFromMasterRit(r.noLambung, r.rit);
      const isShift2 =
        r.shift?.toUpperCase().includes('2') ||
        (parseInt(String(r.rit || '').replace(/\D/g, ''), 10) >= 5);
      const shiftName = isShift2 ? 'Shift 2' : 'Shift 1';
      return (
        term.toUpperCase() === selectedSetoranTerminal.toUpperCase() &&
        shiftName.toLowerCase() === selectedSetoranShift.toLowerCase()
      );
    });
  }, [todayKasirRecords, selectedSetoranTerminal, selectedSetoranShift]);

  const setoranHariIniBreakdown = useMemo(() => {
    return computeCategoryBreakdown(setoranHariIniFilteredRecords);
  }, [setoranHariIniFilteredRecords]);

  const rekap4ShiftList = useMemo(() => {
    const combos = [
      { terminal: 'Bukateja', shift: 'Shift 1' },
      { terminal: 'Bukateja', shift: 'Shift 2' },
      { terminal: 'Bulupitu', shift: 'Shift 1' },
      { terminal: 'Bulupitu', shift: 'Shift 2' },
    ];
    return combos.map((c) => {
      const recs = todayKasirRecords.filter((r) => {
        const term = getTerminalAkhirFromMasterRit(r.noLambung, r.rit);
        const isShift2 =
          r.shift?.toUpperCase().includes('2') ||
          (parseInt(String(r.rit || '').replace(/\D/g, ''), 10) >= 5);
        const shiftName = isShift2 ? 'Shift 2' : 'Shift 1';
        return (
          term.toUpperCase() === c.terminal.toUpperCase() &&
          shiftName.toLowerCase() === c.shift.toLowerCase()
        );
      });
      const totalRp = recs.reduce((sum, r) => sum + (Number(r.totalPendapatan) || 0), 0);
      const totalPnp = recs.reduce((sum, r) => sum + (Number(r.totalPenumpang) || 0), 0);
      return {
        ...c,
        totalRp,
        totalPnp,
        count: recs.length,
      };
    });
  }, [todayKasirRecords]);

  const updatePnp = (
    jenis: 'tunai' | 'nonTunai' | 'manual' | 'ppt',
    key: KategoriKey,
    val: string
  ) => {
    const n = Math.max(0, parseInt(val, 10) || 0);
    if (jenis === 'tunai') setTunaiPnp((prev) => ({ ...prev, [key]: n }));
    else if (jenis === 'nonTunai') setNonTunaiPnp((prev) => ({ ...prev, [key]: n }));
    else if (jenis === 'manual') setManualPnp((prev) => ({ ...prev, [key]: n }));
    else setPptPnp((prev) => ({ ...prev, [key]: n }));
  };

  const handleFileChange = async (slot: 1 | 2, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isImageFile =
      !file.type ||
      file.type.startsWith('image/') ||
      /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(file.name || '');
    if (!isImageFile) {
      showToast('Pilih file gambar (JPG, PNG, WEBP, dll).', 'warn');
      return;
    }
    setPhotoBusyCount((c) => c + 1);
    try {
      const { dataUrl, width, height, kb } = await kompresGambarFile(file, 360, 0.42, 9000);
      cacheLfPhoto('kasir_draft', slot, dataUrl);
      const dim = width && height ? `${width}x${height} · ~${kb} KB` : `~${kb} KB`;
      const payload = { url: dataUrl, info: `${file.name || `Foto_${slot}`} (${dim})` };
      if (slot === 1) setLfFoto1(payload);
      else setLfFoto2(payload);
      showToast(`Foto ${slot} siap (${dim}).`, 'ok');
    } catch {
      showToast(`Gagal memuat Foto ${slot}.`, 'err');
    } finally {
      setPhotoBusyCount((c) => Math.max(0, c - 1));
      e.target.value = '';
    }
  };

  const handleToggleLF = (checked: boolean) => {
    setAdaLF(checked);
    if (checked) {
      if (!lfJam) setLfJam(jamSekarangHHMM());
      if (!lfDitemukanOleh.trim()) setLfDitemukanOleh(petugasNama);
    }
  };

  const buildKasirSheetRow = (rec: KasirRecord) => ({
    ID_KASIR_TRANSAKSI: rec.idKasirTransaksi,
    ID_PERJALANAN: rec.idPerjalanan,
    ID_LOKASI: rec.koridor || 'KOR01',
    TUNAI_UMUM: rec.rincianTunaiPnp?.umum || 0,
    TUNAI_PELAJAR: rec.rincianTunaiPnp?.pelajar || 0,
    TUNAI_BURUH: rec.rincianTunaiPnp?.buruh || 0,
    TUNAI_LANSIA: rec.rincianTunaiPnp?.lansia || 0,
    TUNAI_VETERAN: rec.rincianTunaiPnp?.veteran || 0,
    TUNAI_DISABILITAS: rec.rincianTunaiPnp?.disabilitas || 0,
    NONTUNAI_UMUM: rec.rincianNonTunaiPnp?.umum || 0,
    NONTUNAI_PELAJAR: rec.rincianNonTunaiPnp?.pelajar || 0,
    NONTUNAI_BURUH: rec.rincianNonTunaiPnp?.buruh || 0,
    NONTUNAI_LANSIA: rec.rincianNonTunaiPnp?.lansia || 0,
    NONTUNAI_VETERAN: rec.rincianNonTunaiPnp?.veteran || 0,
    NONTUNAI_DISABILITAS: rec.rincianNonTunaiPnp?.disabilitas || 0,
    NONTUNAI__LANSIA: rec.rincianNonTunaiPnp?.lansia || 0,
    NONTUNAI__VETERAN: rec.rincianNonTunaiPnp?.veteran || 0,
    NONTUNAI__DISABILITAS: rec.rincianNonTunaiPnp?.disabilitas || 0,
    MANUAL_UMUM: (rec as unknown as Record<string, Record<string, number> | undefined>).rincianManualPnp?.umum || 0,
    MANUAL_PELAJAR: (rec as unknown as Record<string, Record<string, number> | undefined>).rincianManualPnp?.pelajar || 0,
    MANUAL_BURUH: (rec as unknown as Record<string, Record<string, number> | undefined>).rincianManualPnp?.buruh || 0,
    MANUAL_LANSIA: (rec as unknown as Record<string, Record<string, number> | undefined>).rincianManualPnp?.lansia || 0,
    MANUAL_VETERAN: (rec as unknown as Record<string, Record<string, number> | undefined>).rincianManualPnp?.veteran || 0,
    MANUAL_DISABILITAS: (rec as unknown as Record<string, Record<string, number> | undefined>).rincianManualPnp?.disabilitas || 0,
    PPT_UMUM: (rec as unknown as Record<string, Record<string, number> | undefined>).rincianPptPnp?.umum || 0,
    PPT_PELAJAR: (rec as unknown as Record<string, Record<string, number> | undefined>).rincianPptPnp?.pelajar || 0,
    PPT_BURUH: (rec as unknown as Record<string, Record<string, number> | undefined>).rincianPptPnp?.buruh || 0,
    PPT_LANSIA: (rec as unknown as Record<string, Record<string, number> | undefined>).rincianPptPnp?.lansia || 0,
    PPT_VETERAN: (rec as unknown as Record<string, Record<string, number> | undefined>).rincianPptPnp?.veteran || 0,
    PPT_DISABILITAS: (rec as unknown as Record<string, Record<string, number> | undefined>).rincianPptPnp?.disabilitas || 0,
    TOTAL_PPT: (rec as unknown as Record<string, number | undefined>).subtotalPptPnp || 0,
    TOTAL_PENUMPANG: rec.totalPenumpang,
    TOTAL_PENDAPATAN: rec.totalPendapatan,
    STATUS_VALIDASI: 'TERVALIDASI',
    KETERANGAN: rec.keterangan || '-',
    CREATED_AT: rec.createdAt,
    CREATED_BY: rec.petugasKasir,
    UPDATED_AT: rec.createdAt,
    UPDATED_BY: rec.petugasKasir,
  });

  const kirimKasirKeServer = async (item: KasirRecord) => {
    let dataLF = item.lostFoundData;
    if (item.adaLostFound && dataLF) {
      const f1 = resolveLfPhotoUrl(dataLF.ID_BARANG, 1, dataLF.FOTO_1 || dataLF.foto1) || '-';
      const f2 = resolveLfPhotoUrl(dataLF.ID_BARANG, 2, dataLF.FOTO_2 || dataLF.foto2) || '-';
      dataLF = {
        ...dataLF,
        FOTO_1: f1,
        FOTO_2: f2,
      };
      if (f1 !== '-') cacheLfPhoto(dataLF.ID_BARANG, 1, f1);
      if (f2 !== '-') cacheLfPhoto(dataLF.ID_BARANG, 2, f2);
    }

    const kasirSheetRow = buildKasirSheetRow(item);
    const { lostFoundData: _omitLf, ...itemTanpaLfDuplikat } = item;
    const payload = {
      action: 'saveKasir',
      tanggal: item.tanggal,
      sheetKasir: 'DATA_KASIR',
      sheetKasirAlt: 'DB_KASIR',
      sheetLostFound: 'DATA_LOST_FOUND',
      sheetLostFoundAlt: 'DB_LOST_FOUND',
      kasirData: kasirSheetRow,
      data: { ...kasirSheetRow, ...itemTanpaLfDuplikat },
      lostFoundData: dataLF,
    };

    setSending(true);
    try {
      await fetch(API_KASIR, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload),
      });
      // Kunci ID_PERJALANAN agar tidak bisa disimpan ganda
      markSavedIdPerjalanan(IDS_KASIR_KEY, item.idPerjalanan);
      // Re-read storage terbaru agar tidak menimpa data lain (perbaikan race condition)
      const latest = bacaStorage<KasirRecord>(STORAGE_KASIR_KEY);
      const updated = latest.map((r) =>
        r.idKasirTransaksi === item.idKasirTransaksi
          ? { ...r, lostFoundData: dataLF, statusKirim: 'TERKIRIM' as const }
          : r
      );
      tulisStorage(STORAGE_KASIR_KEY, updated);
      setRiwayat(updated);
      writeKasirDraft(null);
      showToast(
        item.adaLostFound
          ? 'ID_PERJALANAN tersimpan! Setoran Kasir & Laporan Lost & Found (DATA_LOST_FOUND) berhasil dikirim ke database.'
          : 'ID_PERJALANAN tersimpan! Setoran Kasir (DATA_KASIR) berhasil dikirim ke database.',
        'ok'
      );
    } catch {
      const latest = bacaStorage<KasirRecord>(STORAGE_KASIR_KEY);
      const updated = latest.map((r) =>
        r.idKasirTransaksi === item.idKasirTransaksi ? { ...r, statusKirim: 'GAGAL_KIRIM' as const } : r
      );
      tulisStorage(STORAGE_KASIR_KEY, updated);
      setRiwayat(updated);
      showToast('Gagal terhubung ke server. Data tersimpan lokal.', 'err');
    } finally {
      setSending(false);
    }
  };

  const handleSimpan = async () => {
    if (sending) return;
    if (photoBusyCount > 0) {
      showToast('Foto sedang diproses, tunggu sebentar lalu klik Simpan lagi.', 'warn');
      return;
    }
    if (existingFailedRecord && matriks.totalPnp === 0 && matriks.subPptPnp === 0 && !adaLF) {
      await kirimKasirKeServer(existingFailedRecord);
      return;
    }
    const freshRiw = bacaStorage<KasirRecord>(STORAGE_KASIR_KEY);
    if (
      freshRiw.some((r) => r.idPerjalanan === idPerjalanan && r.statusKirim !== 'GAGAL_KIRIM') ||
      hasSavedIdPerjalanan(IDS_KASIR_KEY, idPerjalanan)
    ) {
      showToast('ID_PERJALANAN SUDAH ADA', 'err');
      return;
    }

    let dataLF: LostFoundData | null = null;
    let lfDetailText = '-';

    if (adaLF) {
      const namaBarang = lfNamaBarang.trim();
      if (!namaBarang) {
        showToast('Nama Barang Lost & Found wajib diisi jika Laporan L&F aktif!', 'warn');
        return;
      }
      const jamLF = lfJam || jamSekarangHHMM();
      const idBarang = `LF_${tanggal.split('-').join('')}_${jamLF.replace(':', '')}_${Math.floor(Math.random() * 9000) + 1000}`;
      const lokasiLF = lfLokasi.trim() || `Di Bus ${lb}`;
      const deskripsiLF = lfDetail.trim() || '-';
      const foto1Clean = resolveLfPhotoUrl('kasir_draft', 1, lfFoto1.url) || '-';
      const foto2Clean = resolveLfPhotoUrl('kasir_draft', 2, lfFoto2.url) || '-';
      if (foto1Clean !== '-') cacheLfPhoto(idBarang, 1, foto1Clean);
      if (foto2Clean !== '-') cacheLfPhoto(idBarang, 2, foto2Clean);

      lfDetailText = `${namaBarang} (${lfKategori}) - ${deskripsiLF}`;
      dataLF = {
        ID_BARANG: idBarang,
        TANGGAL: tanggal,
        JAM: jamLF,
        ID_PERJALANAN: idPerjalanan,
        ID_ARMADA: lb,
        RIT: rit,
        KORIDOR: koridor,
        LOKASI_DITEMUKAN: lokasiLF,
        NMA_BARANG: namaBarang,
        KATEGORI: lfKategori,
        WARNA: lfWarna.trim() || '-',
        MEREK: lfMerek.trim() || '-',
        DESKRIPSI: deskripsiLF,
        FOTO_1: foto1Clean,
        FOTO_2: foto2Clean,
        DITEMUKAN_OLEH: lfDitemukanOleh.trim() || petugasNama,
        PENERIMA: lfPenerima.trim() || 'Admin Kasir / Kantor Terminal',
        STATUS: lfStatus,
        NAMA_PEMILIK: '-',
        NO_HP: '-',
        NO_IDENTITAS: '-',
        TANGGAL_DIAMBIL: '-',
        JAM_DIAMBIL: '-',
        PENERIMA_BARANG: '-',
        CATATAN: lfCatatan.trim() || '-',
      };
    }

    const nowMs = Date.now();
    const nowTs = timestampSekarang();
    const idKasirTransaksi = `KSR_${nowMs}`;
    const ketVal = ket.trim() || '-';

    const item = {
      idKasirTransaksi,
      tanggal,
      koridor,
      noLambung: lb,
      rit,
      shift,
      idPerjalanan,
      petugasKasir: petugasNama,
      totalPenumpang: matriks.totalPnp,
      subtotalTunaiPnp: matriks.subTunaiPnp,
      subtotalNonTunaiPnp: matriks.subNonTunaiPnp,
      subtotalManualPnp: matriks.subManualPnp,
      subtotalPptPnp: matriks.subPptPnp,
      totalPnpRincian: matriks.totalPnp,
      setoranTunai: matriks.subTunaiRp,
      setoranNonTunai: matriks.subNonTunaiRp,
      setoranManual: matriks.subManualRp,
      subtotalTunaiRp: matriks.subTunaiRp,
      subtotalNonTunaiRp: matriks.subNonTunaiRp,
      subtotalManualRp: matriks.subManualRp,
      totalPendapatan: matriks.totalSetoran,
      rincianTunaiPnp: { ...tunaiPnp },
      rincianTunaiRp: { ...matriks.tunaiRp },
      rincianNonTunaiPnp: { ...nonTunaiPnp },
      rincianNonTunaiRp: { ...matriks.nonTunaiRp },
      rincianManualPnp: { ...manualPnp },
      rincianManualRp: { ...matriks.manualRp },
      rincianPptPnp: { ...pptPnp },
      adaLostFound: adaLF,
      rincianLostFound: lfDetailText,
      lostFoundData: dataLF,
      keterangan: ketVal,
      statusKirim: API_KASIR ? 'MENUNGGU_SYNC' : 'TERSIMPAN_LOKAL',
      waktuCatat: jamSekarangHHMM(),
      createdAt: nowTs,
    } as unknown as KasirRecord;

    const currentRiw = bacaStorage<KasirRecord>(STORAGE_KASIR_KEY).filter(
      (r) => r.idPerjalanan !== idPerjalanan
    );
    const initialRiw = [item, ...currentRiw];
    tulisStorage(STORAGE_KASIR_KEY, initialRiw);
    setRiwayat(initialRiw);
    setShowNextBtn(true);

    await kirimKasirKeServer(item);
  };

  const handleReset = () => {
    setTanggal(tglHariIni());
    setTunaiPnp(emptyKategoriCounts());
    setNonTunaiPnp(emptyKategoriCounts());
    setManualPnp(emptyKategoriCounts());
    setPptPnp(emptyKategoriCounts());
    setShift('SHIFT 1');
    setKet('');
    setAdaLF(false);
    setLfJam(jamSekarangHHMM());
    setLfKategori('Lainnya');
    setLfNamaBarang('');
    setLfWarna('');
    setLfMerek('');
    setLfLokasi('');
    setLfDetail('');
    setLfFoto1({ url: '-', info: '' });
    setLfFoto2({ url: '-', info: '' });
    setLfDitemukanOleh(petugasNama);
    setLfPenerima('Admin Kasir / Kantor Terminal');
    setLfStatus('DI_KANTOR');
    setLfCatatan('');
    setShowNextBtn(false);
    writeKasirDraft(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ===== Helper: 1 blok jenis (Tunai / Non-Tunai / Manual / PPT) =====
  // Tiap blok berisi 6 kategori di bawahnya. PPT Rp-nya selalu 0
  // (tidak masuk setoran), Manual Rp = pnp x tarif (masuk setoran).
  // BARU: header blok jadi TOMBOL Lihat / Sembunyikan. Kalau blok
  // tertutup, hanya header + subtotal yang kelihatan — halaman jadi pendek.
  // Menutup blok TIDAK menghapus isi input (data tetap di state & draft).
  const renderBlokJenis = (
    jenis: 'tunai' | 'nonTunai' | 'manual' | 'ppt',
    judul: string,
    headClass: string,
    inputClass: string,
    subtotalPnp: number,
    subtotalRp: number,
    terbuka: boolean,
    onToggle: () => void
  ) => {
    const pnpState =
      jenis === 'tunai' ? tunaiPnp : jenis === 'nonTunai' ? nonTunaiPnp : jenis === 'manual' ? manualPnp : pptPnp;
    const rpState =
      jenis === 'tunai'
        ? matriks.tunaiRp
        : jenis === 'nonTunai'
          ? matriks.nonTunaiRp
          : jenis === 'manual'
            ? matriks.manualRp
            : emptyKategoriCounts();
    return (
      <div className="border-2 border-slate-300 rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={onToggle}
          className={`w-full px-3 py-2 text-sm font-extrabold text-center flex justify-between items-center gap-2 cursor-pointer ${headClass}`}
        >
          <span>{judul}</span>
          <span className="flex items-center gap-2 text-xs font-extrabold shrink-0">
            <span className="font-mono-num">{subtotalPnp} org · {formatRupiah(subtotalRp)}</span>
            <span>{terbuka ? '▲ Sembunyikan' : '▼ Lihat'}</span>
          </span>
        </button>
        {terbuka && (
          <div className="p-2.5 space-y-2 bg-white">
            {KATEGORI_LIST.map((kat) => (
              <div key={kat.key} className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                <div className="flex justify-between items-center text-sm font-extrabold text-slate-800 mb-2">
                  <span>{kat.label}</span>
                  <span className="text-xs font-mono-num text-slate-500">
                    Tarif: {formatRupiah(jenis === 'ppt' ? 0 : kat.tarif)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-600 mb-1">
                      Jumlah Pnp {judul.replace('PNP ', '')}
                    </label>
                    <input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={pnpState[kat.key] || ''}
                      onChange={(e) => updatePnp(jenis, kat.key, e.target.value)}
                      className={`w-full px-2 py-2 rounded-xl border-2 border-slate-700 bg-white font-mono-num font-extrabold text-center text-sm ${inputClass}`}
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-500 mb-0.5">
                      Setoran {judul.replace('PNP ', '')}
                    </span>
                    <input
                      type="text"
                      readOnly
                      value={formatRupiah(rpState[kat.key])}
                      className="w-full px-2 py-1.5 rounded-lg border-2 border-emerald-600 bg-emerald-50 font-mono-num font-extrabold text-center text-xs text-emerald-800"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <div className="max-w-xl mx-auto bg-white min-h-screen shadow-sm border-x border-slate-200 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-br from-violet-600 to-violet-800 text-white p-5 rounded-b-3xl flex items-center gap-4 relative shadow-sm">
          <BrandLogo className="w-16 h-16 p-1 border-2 border-white/80" />
          <div className="pr-10">
            <h2 className="text-xl font-extrabold leading-tight">Selamat Bekerja {petugasNama}</h2>
            <p className="text-sm text-white/90 font-medium">
              Isi data setoran &amp; rekonsiliasi dengan teliti ya!
            </p>
          </div>
          <button
            type="button"
            onClick={onBackToLogin}
            className="absolute top-3 right-3 w-10 h-10 rounded-full bg-slate-900/90 text-white flex items-center justify-center hover:bg-slate-900 cursor-pointer"
            aria-label="Kembali ke Login"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="text-center">
            <h3 className="text-2xl font-extrabold text-slate-900">{petugasNama}</h3>
            <p className="text-sm font-bold text-slate-500">Petugas Admin Kasir</p>
          </div>

          <div>
            <label className="block text-xs font-extrabold uppercase text-slate-700 mb-1">
              Tanggal Operasional
            </label>
            <input
              type="date"
              value={tanggal}
              readOnly
              className="w-full px-3 py-3 rounded-xl border-2 border-slate-400 bg-slate-200 text-slate-700 font-bold text-center text-lg"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">Koridor</label>
              <select
                value={koridor}
                onChange={(e) => setKoridor(e.target.value)}
                className="w-full px-2 py-3 rounded-xl border-2 border-slate-800 font-bold text-center bg-slate-50"
              >
                {LIST_KORIDOR.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">No. Lambung</label>
              <select
                value={lb}
                onChange={(e) => setLb(e.target.value)}
                className="w-full px-2 py-3 rounded-xl border-2 border-slate-800 font-bold text-center bg-slate-50"
              >
                {LIST_LB.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">Rit Ke</label>
              <select
                value={rit}
                onChange={(e) => handleRitChange(e.target.value)}
                className="w-full px-2 py-3 rounded-xl border-2 border-slate-800 font-bold text-center bg-slate-50"
              >
                {LIST_RIT.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">Shift</label>
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value)}
                className="w-full px-2 py-3 rounded-xl border-2 border-slate-800 font-bold text-center bg-white"
              >
                <option value="SHIFT 1">Shift 1</option>
                <option value="SHIFT 2">Shift 2</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-extrabold text-center text-slate-700 mb-1">
              ID_PERJALANAN
            </label>
            <input
              type="text"
              value={idPerjalanan}
              readOnly
              className="w-full px-3 py-3 rounded-xl border-2 border-violet-600 bg-violet-50 font-mono-num font-extrabold text-center text-violet-950 text-lg"
            />
            {existingValidRecord && (
              <div className="mt-2 rounded-xl border-2 border-red-300 bg-red-50 px-3 py-2 text-center text-xs font-extrabold text-red-800">
                ID_PERJALANAN SUDAH ADA ({idPerjalanan})
              </div>
            )}
          </div>

          {/* Matriks Setoran Per Kategori */}
          <div className="bg-white border-2 border-slate-300 rounded-2xl p-3.5 space-y-2.5">
            <div className="text-center">
              <h4 className="text-sm font-extrabold text-slate-900">SETORAN PER KATEGORI (RP)</h4>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                Ketuk jenis untuk membuka / menutup isinya — isi jumlah penumpang per kategori; nominal setoran (Rp) dihitung otomatis
              </p>
            </div>

            {renderBlokJenis('tunai', 'PNP TUNAI', 'bg-emerald-600 text-white', '', matriks.subTunaiPnp, matriks.subTunaiRp, openJenis.tunai, () => toggleJenis('tunai'))}
            {renderBlokJenis('nonTunai', 'PNP NON-TUNAI', 'bg-sky-600 text-white', '', matriks.subNonTunaiPnp, matriks.subNonTunaiRp, openJenis.nonTunai, () => toggleJenis('nonTunai'))}
            {renderBlokJenis('manual', 'PNP MANUAL', 'bg-amber-500 text-white', '', matriks.subManualPnp, matriks.subManualRp, openJenis.manual, () => toggleJenis('manual'))}
            {renderBlokJenis('ppt', 'PNP PPT', 'bg-violet-600 text-white', '', matriks.subPptPnp, 0, openJenis.ppt, () => toggleJenis('ppt'))}

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs font-extrabold text-blue-900 space-y-1">
              <div className="flex justify-between">
                <span>Subtotal Pnp Tunai:</span>
                <span className="font-mono-num">{matriks.subTunaiPnp} org</span>
              </div>
              <div className="flex justify-between">
                <span>Subtotal Setoran Tunai:</span>
                <span className="font-mono-num">{formatRupiah(matriks.subTunaiRp)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-blue-200">
                <span>Subtotal Pnp Non-Tunai:</span>
                <span className="font-mono-num">{matriks.subNonTunaiPnp} org</span>
              </div>
              <div className="flex justify-between">
                <span>Subtotal Setoran Non-Tunai:</span>
                <span className="font-mono-num">{formatRupiah(matriks.subNonTunaiRp)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-blue-200">
                <span>Subtotal Pnp Manual:</span>
                <span className="font-mono-num">{matriks.subManualPnp} org</span>
              </div>
              <div className="flex justify-between">
                <span>Subtotal Setoran Manual:</span>
                <span className="font-mono-num">{formatRupiah(matriks.subManualRp)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-blue-200">
                <span>Subtotal Pnp PPT (tidak masuk setoran):</span>
                <span className="font-mono-num">{matriks.subPptPnp} org</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">
                Setoran Tunai (Rp)
              </label>
              <input
                type="text"
                readOnly
                value={formatRupiah(matriks.subTunaiRp)}
                className="w-full px-3 py-3 rounded-xl border-2 border-emerald-600 bg-emerald-50 font-mono-num font-extrabold text-center text-emerald-800"
              />
            </div>
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">
                Setoran Non-Tunai (Rp)
              </label>
              <input
                type="text"
                readOnly
                value={formatRupiah(matriks.subNonTunaiRp)}
                className="w-full px-3 py-3 rounded-xl border-2 border-emerald-600 bg-emerald-50 font-mono-num font-extrabold text-center text-emerald-800"
              />
            </div>
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">
                Setoran Manual (Rp)
              </label>
              <input
                type="text"
                readOnly
                value={formatRupiah(matriks.subManualRp)}
                className="w-full px-3 py-3 rounded-xl border-2 border-emerald-600 bg-emerald-50 font-mono-num font-extrabold text-center text-emerald-800"
              />
            </div>
          </div>

          <div className="bg-slate-50 border-2 border-slate-300 rounded-2xl p-3.5 text-sm space-y-1">
            <div className="flex justify-between font-bold text-slate-700">
              <span>Total Penumpang Terangkut</span>
              <span className="font-mono-num font-extrabold text-slate-900">
                {matriks.totalPnp} org
              </span>
            </div>
            <div className="flex justify-between font-bold text-slate-700">
              <span>Total Setoran (Tunai + Non-Tunai + Manual)</span>
              <span className="font-mono-num font-extrabold text-slate-900">
                {formatRupiah(matriks.totalSetoran)}
              </span>
            </div>
            <div className="flex justify-between font-bold text-slate-700">
              <span>Total Pnp PPT (terpisah, tidak masuk setoran)</span>
              <span className="font-mono-num font-extrabold text-slate-900">
                {matriks.subPptPnp} org
              </span>
            </div>
            <div className="mt-2 p-2.5 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-900 text-center font-extrabold text-xs">
              TOTAL SETORAN OTOMATIS: {formatRupiah(matriks.totalSetoran)} ({matriks.totalPnp} ORG)
            </div>
          </div>

          {/* Toggle Lost & Found */}
          <label className="bg-amber-100 border-2 border-amber-400 rounded-2xl p-3.5 flex items-center justify-between gap-3 cursor-pointer">
            <div>
              <div className="font-extrabold text-slate-900 text-sm">Laporan Lost &amp; Found?</div>
              <div className="text-xs font-semibold text-amber-900">
                Aktifkan jika ada barang tertinggal untuk dicatat ke DB_LOST_FOUND
              </div>
            </div>
            <input
              type="checkbox"
              checked={adaLF}
              onChange={(e) => handleToggleLF(e.target.checked)}
              className="w-6 h-6 accent-amber-600 shrink-0 cursor-pointer"
            />
          </label>

          {adaLF && (
            <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 space-y-3">
              <div className="text-center text-sm font-extrabold text-violet-800">
                FORMULIR LAPORAN LOST &amp; FOUND (DB_LOST_FOUND)
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    Jam Ditemukan
                  </label>
                  <input
                    type="time"
                    value={lfJam}
                    onChange={(e) => setLfJam(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border-2 border-slate-800 bg-white font-mono-num font-bold text-center text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    Kategori Barang
                  </label>
                  <select
                    value={lfKategori}
                    onChange={(e) => setLfKategori(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border-2 border-slate-800 bg-white font-bold text-sm"
                  >
                    <option value="Elektronik">Elektronik</option>
                    <option value="Dokumen/Kartu">Dokumen / Kartu</option>
                    <option value="Dompet/Uang">Dompet / Uang</option>
                    <option value="Pakaian/Tas">Pakaian / Tas</option>
                    <option value="Aksesoris">Aksesoris</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Nama Barang <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Cth: Dompet Coklat, HP 【entity-Samsung¦canonical_name=Samsung】, Tas Ransel..."
                  value={lfNamaBarang}
                  onChange={(e) => setLfNamaBarang(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-800 bg-white font-bold text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">Warna</label>
                  <input
                    type="text"
                    placeholder="Cth: Hitam, Biru"
                    value={lfWarna}
                    onChange={(e) => setLfWarna(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border-2 border-slate-800 bg-white font-bold text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    Merek / Brand
                  </label>
                  <input
                    type="text"
                    placeholder="Cth: 【entity-Samsung¦canonical_name=Samsung】, Eiger"
                    value={lfMerek}
                    onChange={(e) => setLfMerek(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border-2 border-slate-800 bg-white font-bold text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Lokasi Ditemukan
                </label>
                <input
                  type="text"
                  placeholder="Cth: Kursi Belakang Bus LB01 / Halte Bukateja"
                  value={lfLokasi}
                  onChange={(e) => setLfLokasi(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border-2 border-slate-800 bg-white font-bold text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Deskripsi Rinci Barang
                </label>
                <textarea
                  placeholder="Tuliskan ciri-ciri khusus, isi barang, kondisi fisik..."
                  value={lfDetail}
                  onChange={(e) => setLfDetail(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm font-medium"
                />
              </div>

              {/* Upload Foto 1 & 2 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  {
                    slot: 1 as const,
                    foto: lfFoto1,
                    setFoto: setLfFoto1,
                    camRef: foto1CamRef,
                    galRef: foto1GalRef,
                  },
                  {
                    slot: 2 as const,
                    foto: lfFoto2,
                    setFoto: setLfFoto2,
                    camRef: foto2CamRef,
                    galRef: foto2GalRef,
                  },
                ].map(({ slot, foto, setFoto, camRef, galRef }) => (
                  <div
                    key={slot}
                    className="bg-white border border-violet-200 rounded-xl p-2.5 space-y-2"
                  >
                    <div className="text-xs font-extrabold text-slate-800">
                      Foto {slot} (Kamera / Galeri)
                    </div>
                    <input
                      ref={camRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => void handleFileChange(slot, e)}
                    />
                    <input
                      ref={galRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => void handleFileChange(slot, e)}
                    />
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => camRef.current?.click()}
                        className="flex-1 py-2 px-2 rounded-lg bg-violet-600 text-white text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" /> Kamera
                      </button>
                      <button
                        type="button"
                        onClick={() => galRef.current?.click()}
                        className="flex-1 py-2 px-2 rounded-lg bg-sky-600 text-white text-xs font-extrabold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <ImageIcon className="w-3.5 h-3.5" /> Galeri
                      </button>
                      {foto.url !== '-' && (
                        <button
                          type="button"
                          onClick={() => setFoto({ url: '-', info: '' })}
                          className="p-2 rounded-lg border border-red-300 bg-red-50 text-red-700 cursor-pointer"
                          title={`Hapus Foto ${slot}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    {foto.url !== '-' && (
                      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-1.5">
                        <img
                          src={foto.url}
                          alt={`Preview Foto ${slot}`}
                          className="w-14 h-14 object-cover rounded-md shrink-0"
                        />
                        <span className="text-[11px] font-semibold text-slate-600 break-all">
                          {foto.info}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    Ditemukan Oleh
                  </label>
                  <input
                    type="text"
                    value={lfDitemukanOleh}
                    onChange={(e) => setLfDitemukanOleh(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border-2 border-slate-800 bg-white font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    Penerima di POS
                  </label>
                  <input
                    type="text"
                    value={lfPenerima}
                    onChange={(e) => setLfPenerima(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border-2 border-slate-800 bg-white font-bold text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    Status Barang
                  </label>
                  <select
                    value={lfStatus}
                    onChange={(e) => setLfStatus(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border-2 border-slate-800 bg-white font-bold text-xs"
                  >
                    <option value="DI_KANTOR">DI_KANTOR</option>
                    <option value="PROSES_VERIFIKASI">PROSES_VERIFIKASI</option>
                    <option value="SUDAH_DIAMBIL">SUDAH_DIAMBIL</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    Catatan L&amp;F
                  </label>
                  <input
                    type="text"
                    placeholder="Catatan tambahan..."
                    value={lfCatatan}
                    onChange={(e) => setLfCatatan(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border-2 border-slate-800 bg-white font-bold text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-extrabold text-slate-700 mb-1">
              Keterangan (Opsional)
            </label>
            <input
              type="text"
              placeholder="Catatan kasir / rekonsiliasi..."
              value={ket}
              onChange={(e) => setKet(e.target.value)}
              className="w-full px-3 py-3 rounded-xl border-2 border-slate-800 bg-white font-bold text-sm"
            />
          </div>

          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              disabled={sending}
              onClick={() => void handleSimpan()}
              className={`w-full py-4 rounded-2xl text-white font-extrabold text-lg cursor-pointer disabled:opacity-60 ${
                existingValidRecord
                  ? 'bg-red-700 hover:bg-red-800'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {sending
                ? 'MENYIMPAN...'
                : existingValidRecord
                ? 'ID_PERJALANAN SUDAH ADA'
                : existingFailedRecord
                ? 'KIRIM ULANG'
                : 'SIMPAN'}
            </button>

            {showNextBtn && (
              <button
                type="button"
                onClick={handleReset}
                className="w-full py-3.5 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-extrabold text-base cursor-pointer"
              >
                INPUT RIT / ARMADA BERIKUTNYA
              </button>
            )}

            <button
              type="button"
              onClick={onOpenLostFound}
              className="w-full py-3.5 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-extrabold text-base flex items-center justify-center gap-2 cursor-pointer"
            >
              <PackageSearch className="w-5 h-5" /> BARANG TERTINGGAL
            </button>
          </div>

          {/* 1. SETORAN HARI INI (DENGAN 2 DROPDOWN & 1 BLOK UTAMA) */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-4 shadow-md space-y-3.5 border border-slate-700">
            <button
              type="button"
              onClick={() => setShowSetoranHariIni((v) => !v)}
              className="w-full flex flex-wrap justify-between items-center gap-2 border-b border-slate-700 pb-2.5 cursor-pointer text-left"
            >
              <span className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-400" />
                <span className="font-extrabold text-base tracking-wide text-white">
                  SETORAN HARI INI
                </span>
                <span className="text-emerald-300 text-sm font-bold">
                  {showSetoranHariIni ? '▲' : '▼'}
                </span>
              </span>
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-slate-700 text-slate-200">
                {tanggal}
              </span>
            </button>
            {showSetoranHariIni && (
              <>

            {/* 2 Dropdown Filter */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-slate-800/90 p-3 rounded-xl border border-slate-700">
              <div>
                <label className="block text-[11px] font-extrabold text-slate-300 mb-1">
                  Terminal Akhir:
                </label>
                <select
                  value={selectedSetoranTerminal}
                  onChange={(e) => setSelectedSetoranTerminal(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-900 border border-slate-600 rounded-lg text-xs font-bold text-white focus:border-emerald-400 focus:outline-none"
                >
                  <option value="Bukateja">Bukateja</option>
                  <option value="Bulupitu">Bulupitu</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-extrabold text-slate-300 mb-1">
                  Shift:
                </label>
                <select
                  value={selectedSetoranShift}
                  onChange={(e) => setSelectedSetoranShift(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-900 border border-slate-600 rounded-lg text-xs font-bold text-white focus:border-emerald-400 focus:outline-none"
                >
                  <option value="Shift 1">Shift 1 (Rit 1 - 4)</option>
                  <option value="Shift 2">Shift 2 (Rit 5 - 8)</option>
                </select>
              </div>
            </div>

            {/* 1 Blok Setoran Sesuai Pilihan Dropdown */}
            <div className="bg-slate-900/90 border-2 border-emerald-500/50 rounded-2xl p-4 space-y-3">
              <div className="text-center pb-2 border-b border-slate-800">
                <div className="text-xs font-extrabold text-emerald-400 tracking-wider">
                  SETORAN HARI INI - {selectedSetoranTerminal.toUpperCase()} - {selectedSetoranShift.toUpperCase()}
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono-num mt-1">
                  {formatRupiah(setoranHariIniBreakdown.totalRp)}
                </div>
                <div className="text-xs font-bold text-slate-300 mt-1 flex items-center justify-center gap-1.5 flex-wrap">
                  <Users className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{setoranHariIniBreakdown.totalPnp} Penumpang Terangkut</span>
                  <span>•</span>
                  <span>{setoranHariIniFilteredRecords.length} Rit Disetor</span>
                </div>
              </div>

              {/* Ringkasan Tunai, Non-Tunai, Manual & PPT */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-emerald-950/60 border border-emerald-800/60 rounded-xl p-2.5">
                  <span className="block text-emerald-300 font-bold mb-0.5">Setoran Tunai:</span>
                  <b className="block text-sm sm:text-base font-extrabold text-white font-mono-num">
                    {formatRupiah(setoranHariIniBreakdown.subtotalTunaiRp)}
                  </b>
                  <span className="text-[11px] text-emerald-200 font-medium">
                    {setoranHariIniBreakdown.subtotalTunaiPnp} org penumpang
                  </span>
                </div>
                <div className="bg-sky-950/60 border border-sky-800/60 rounded-xl p-2.5">
                  <span className="block text-sky-300 font-bold mb-0.5">Setoran Non-Tunai:</span>
                  <b className="block text-sm sm:text-base font-extrabold text-white font-mono-num">
                    {formatRupiah(setoranHariIniBreakdown.subtotalNonTunaiRp)}
                  </b>
                  <span className="text-[11px] text-sky-200 font-medium">
                    {setoranHariIniBreakdown.subtotalNonTunaiPnp} org penumpang
                  </span>
                </div>
                <div className="bg-amber-950/60 border border-amber-800/60 rounded-xl p-2.5">
                  <span className="block text-amber-300 font-bold mb-0.5">Setoran Manual:</span>
                  <b className="block text-sm sm:text-base font-extrabold text-white font-mono-num">
                    {formatRupiah(setoranHariIniBreakdown.subtotalManualRp)}
                  </b>
                  <span className="text-[11px] text-amber-200 font-medium">
                    {setoranHariIniBreakdown.subtotalManualPnp} org penumpang
                  </span>
                </div>
                <div className="bg-violet-950/60 border border-violet-800/60 rounded-xl p-2.5">
                  <span className="block text-violet-300 font-bold mb-0.5">Pnp PPT (tidak masuk setoran):</span>
                  <b className="block text-sm sm:text-base font-extrabold text-white font-mono-num">
                    {setoranHariIniBreakdown.subtotalPptPnp} org
                  </b>
                  <span className="text-[11px] text-violet-200 font-medium">
                    {formatRupiah(0)}
                  </span>
                </div>
              </div>

              {/* Uraian per Kategori Penumpang */}
              <div className="overflow-x-auto rounded-xl border border-slate-700">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-800 text-slate-200 font-extrabold text-[11px]">
                      <th className="py-2 px-3">Kategori</th>
                      <th className="py-2 px-2 text-right">Tarif</th>
                      <th className="py-2 px-2 text-right">Pnp</th>
                      <th className="py-2 px-2 text-right">Tunai (Rp)</th>
                      <th className="py-2 px-2 text-right">Non-Tunai (Rp)</th>
                      <th className="py-2 px-2 text-right">Manual (Rp)</th>
                      <th className="py-2 px-2 text-right">PPT (Pnp)</th>
                      <th className="py-2 px-3 text-right">Total (Rp)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-medium text-slate-300">
                    {setoranHariIniBreakdown.rows.map((r) => (
                      <tr key={r.key} className="hover:bg-slate-800/50">
                        <td className="py-2 px-3 font-bold text-white">{r.label}</td>
                        <td className="py-2 px-2 text-right font-mono text-slate-400">{formatRupiah(r.tarif)}</td>
                        <td className="py-2 px-2 text-right font-mono">{r.totalPnp} org</td>
                        <td className="py-2 px-2 text-right font-mono text-emerald-400">{formatRupiah(r.tunaiRp)}</td>
                        <td className="py-2 px-2 text-right font-mono text-sky-400">{formatRupiah(r.nonTunaiRp)}</td>
                        <td className="py-2 px-2 text-right font-mono text-amber-400">{formatRupiah(r.manualRp)}</td>
                        <td className="py-2 px-2 text-right font-mono text-violet-400">{r.pptPnp} org</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-white">{formatRupiah(r.totalRp)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-800 font-extrabold text-white text-xs border-t border-slate-700">
                    <tr>
                      <td colSpan={2} className="py-2 px-3 uppercase text-[11px]">TOTAL:</td>
                      <td className="py-2 px-2 text-right font-mono">{setoranHariIniBreakdown.totalPnp} org</td>
                      <td className="py-2 px-2 text-right font-mono text-emerald-400">{formatRupiah(setoranHariIniBreakdown.subtotalTunaiRp)}</td>
                      <td className="py-2 px-2 text-right font-mono text-sky-400">{formatRupiah(setoranHariIniBreakdown.subtotalNonTunaiRp)}</td>
                      <td className="py-2 px-2 text-right font-mono text-amber-400">{formatRupiah(setoranHariIniBreakdown.subtotalManualRp)}</td>
                      <td className="py-2 px-2 text-right font-mono text-violet-400">{setoranHariIniBreakdown.subtotalPptPnp} org</td>
                      <td className="py-2 px-3 text-right font-mono text-emerald-400">{formatRupiah(setoranHariIniBreakdown.totalRp)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Tombol kecil Lihat Rekap 4 Shift */}
            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={() => setShowRekap4Shift((v) => !v)}
                className="text-xs font-bold text-emerald-300 hover:text-emerald-200 underline cursor-pointer"
              >
                {showRekap4Shift ? '▲ Sembunyikan Rekap 4 Shift' : '▼ Lihat Rekap 4 Shift'}
              </button>

              {showRekap4Shift && (
                <div className="mt-2.5 bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs space-y-2 text-left">
                  <div className="font-extrabold text-slate-200 pb-1 border-b border-slate-800">
                    Rekapitulasi 4 Shift Hari Ini:
                  </div>
                  <div className="space-y-1">
                    {rekap4ShiftList.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center py-1 border-b border-slate-800/60 last:border-b-0">
                        <span className="font-bold text-slate-300">
                          {item.terminal} — {item.shift}
                        </span>
                        <span className="font-mono-num text-slate-200">
                          {item.totalPnp} pnp · <b>{formatRupiah(item.totalRp)}</b> ({item.count} rit)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
              </>
            )}
          </div>

          {/* 2. DETAIL SETORAN PER SHIFT */}
          <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 shadow-sm space-y-3.5">
            <button
              type="button"
              onClick={() => setShowDetailPerShift((v) => !v)}
              className="w-full flex flex-wrap justify-between items-center gap-2 border-b border-slate-200 pb-2.5 cursor-pointer text-left"
            >
              <span className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-violet-700" />
                <span className="text-left">
                  <span className="block font-extrabold text-sm sm:text-base text-slate-900 leading-tight">
                    DETAIL SETORAN PER SHIFT
                  </span>
                  <span className="block text-[11px] font-semibold text-slate-500">
                    Pencarian data setoran via model dropdown &amp; rincian per kategori serta metode pembayaran
                  </span>
                </span>
                <span className="text-violet-700 text-sm font-bold">
                  {showDetailPerShift ? '▲' : '▼'}
                </span>
              </span>
            </button>
            {showDetailPerShift && (
              <>
            <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-200 pb-2.5">

              {/* View Switcher: Detail Kategori & Metode vs Tabel Rekap Shift */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setDetailSubView('kategori')}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    detailSubView === 'kategori'
                      ? 'bg-violet-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Detail Kategori &amp; Metode
                </button>
                <button
                  type="button"
                  onClick={() => setDetailSubView('rekap')}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    detailSubView === 'rekap'
                      ? 'bg-violet-700 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Rekap Shift Armada
                </button>
              </div>
            </div>

            {/* Model Dropdown Pencarian Data */}
            <div className="bg-violet-50/60 border border-violet-200 rounded-xl p-3 space-y-2.5">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <span className="text-xs font-extrabold text-violet-900 flex items-center gap-1.5">
                  <Search className="w-4 h-4 text-violet-700" />
                  PENCARIAN SETORAN (MODEL DROPDOWN)
                </span>
                {(selectedDetailTerminal !== 'Semua' || selectedDetailShift !== 'Semua' || selectedDetailLb !== 'Semua') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDetailTerminal('Semua');
                      setSelectedDetailShift('Semua');
                      setSelectedDetailLb('Semua');
                    }}
                    className="flex items-center gap-1 text-[11px] font-bold text-violet-700 hover:text-violet-900 hover:underline cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset Dropdown
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Dropdown 1: Pilih Terminal Akhir */}
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                    1. Pilih Terminal Akhir:
                  </label>
                  <select
                    value={selectedDetailTerminal}
                    onChange={(e) => {
                      setSelectedDetailTerminal(e.target.value);
                      setSelectedDetailLb('Semua');
                    }}
                    className="w-full h-10 px-3 bg-white border-2 border-violet-200 rounded-lg text-xs font-bold text-slate-800 focus:border-violet-600 focus:outline-none"
                  >
                    <option value="Semua">Semua</option>
                    <option value="Bulupitu">Bulupitu</option>
                    <option value="Bukateja">Bukateja</option>
                  </select>
                </div>

                {/* Dropdown 2: Pilih Shift */}
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                    2. Pilih Shift:
                  </label>
                  <select
                    value={selectedDetailShift}
                    onChange={(e) => setSelectedDetailShift(e.target.value)}
                    className="w-full h-10 px-3 bg-white border-2 border-violet-200 rounded-lg text-xs font-bold text-slate-800 focus:border-violet-600 focus:outline-none"
                  >
                    <option value="Semua">Semua</option>
                    <option value="Shift 1">Shift 1</option>
                    <option value="Shift 2">Shift 2</option>
                  </select>
                </div>

                {/* Dropdown 3: Pilih No. Lambung (Armada) */}
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                    3. Pilih No. Lambung (Armada):
                  </label>
                  <select
                    value={selectedDetailLb}
                    onChange={(e) => setSelectedDetailLb(e.target.value)}
                    className="w-full h-10 px-3 bg-white border-2 border-violet-200 rounded-lg text-xs font-bold text-slate-800 focus:border-violet-600 focus:outline-none"
                  >
                    <option value="Semua">Semua</option>
                    {allowedDetailLambungs.map((b) => {
                      const isCadangan = b === 'LBC01' || b === 'LBCO1';
                      const label = isCadangan ? 'LBCO1 (Cadangan / Pengganti Trouble)' : b;
                      return (
                        <option key={b} value={b}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            </div>

            {/* Konten Berdasarkan View: Kategori & Metode vs Rekap Shift */}
            {detailSubView === 'kategori' ? (
              <div className="space-y-3">
                {/* Status Bar Pencarian */}
                <div className="flex justify-end bg-slate-100 px-3 py-2 rounded-xl text-xs">
                  <span className="font-extrabold text-slate-700">
                    Ditemukan: <b className="text-violet-700 font-mono-num">{filteredDetailRecords.length}</b> data setoran
                  </span>
                </div>

                {filteredDetailRecords.length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <PackageSearch className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="text-sm font-bold text-slate-700">
                      Tidak ada data setoran yang cocok
                    </p>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Belum ada data setoran kasir untuk Terminal: <b>{selectedDetailTerminal}</b>, Shift: <b>{selectedDetailShift}</b>, Lambung: <b>{selectedDetailLb}</b> pada tanggal {tanggal}.
                    </p>
                    {(selectedDetailTerminal !== 'Semua' || selectedDetailShift !== 'Semua' || selectedDetailLb !== 'Semua') && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDetailTerminal('Semua');
                          setSelectedDetailShift('Semua');
                          setSelectedDetailLb('Semua');
                        }}
                        className="mt-2 px-3 py-1.5 bg-violet-700 text-white text-xs font-bold rounded-lg hover:bg-violet-800 cursor-pointer"
                      >
                        Reset Filter Pencarian
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {/* TABEL DETAIL PER KATEGORI & PER METODE PEMBAYARAN */}
                    <div className="overflow-x-auto rounded-xl border border-slate-300 shadow-2xs">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-800 text-white font-extrabold text-[11px]">
                            <th className="py-2.5 px-3">Kategori Penumpang</th>
                            <th className="py-2.5 px-2 text-right">Tarif</th>
                            <th className="py-2.5 px-3 text-center bg-emerald-900/60 border-l border-emerald-700/50">
                              Metode TUNAI
                            </th>
                            <th className="py-2.5 px-3 text-center bg-sky-900/60 border-l border-sky-700/50">
                              Metode NON-TUNAI
                            </th>
                            <th className="py-2.5 px-3 text-center bg-amber-900/60 border-l border-amber-700/50">
                              Metode MANUAL
                            </th>
                            <th className="py-2.5 px-3 text-center bg-violet-900/60 border-l border-violet-700/50">
                              PPT (Pnp)
                            </th>
                            <th className="py-2.5 px-3 text-right bg-slate-900 border-l border-slate-700">
                              TOTAL KATEGORI
                            </th>
                          </tr>
                          <tr className="bg-slate-100 text-slate-600 font-bold text-[10px] border-b border-slate-300">
                            <th className="py-1 px-3">Jenis Tiket</th>
                            <th className="py-1 px-2 text-right">Rp / Org</th>
                            <th className="py-1 px-3 text-right bg-emerald-50 text-emerald-900 border-l border-emerald-200">
                              Pnp &amp; Nominal
                            </th>
                            <th className="py-1 px-3 text-right bg-sky-50 text-sky-900 border-l border-sky-200">
                              Pnp &amp; Nominal
                            </th>
                            <th className="py-1 px-3 text-right bg-amber-50 text-amber-900 border-l border-amber-200">
                              Pnp &amp; Nominal
                            </th>
                            <th className="py-1 px-3 text-right bg-violet-50 text-violet-900 border-l border-violet-200">
                              Pnp
                            </th>
                            <th className="py-1 px-3 text-right bg-slate-200/70 text-slate-800 border-l border-slate-300">
                              Pnp &amp; Nominal
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 font-medium">
                          {detailBreakdown.rows.map((row) => (
                            <tr key={row.key} className="hover:bg-slate-50 transition-colors">
                              <td className="py-2 px-3 font-extrabold text-slate-800">
                                {row.label}
                              </td>
                              <td className="py-2 px-2 text-right font-mono-num text-slate-500">
                                {formatRupiah(row.tarif)}
                              </td>
                              {/* TUNAI */}
                              <td className="py-2 px-3 text-right bg-emerald-50/40 border-l border-emerald-100 font-mono-num">
                                <span className="font-bold text-slate-700">{row.tunaiPnp} org</span>
                                <span className="text-slate-400 mx-1">·</span>
                                <b className="text-emerald-700">{formatRupiah(row.tunaiRp)}</b>
                              </td>
                              {/* NON-TUNAI */}
                              <td className="py-2 px-3 text-right bg-sky-50/40 border-l border-sky-100 font-mono-num">
                                <span className="font-bold text-slate-700">{row.nonTunaiPnp} org</span>
                                <span className="text-slate-400 mx-1">·</span>
                                <b className="text-sky-700">{formatRupiah(row.nonTunaiRp)}</b>
                              </td>
                              {/* MANUAL */}
                              <td className="py-2 px-3 text-right bg-amber-50/40 border-l border-amber-100 font-mono-num">
                                <span className="font-bold text-slate-700">{row.manualPnp} org</span>
                                <span className="text-slate-400 mx-1">·</span>
                                <b className="text-amber-700">{formatRupiah(row.manualRp)}</b>
                              </td>
                              {/* PPT */}
                              <td className="py-2 px-3 text-right bg-violet-50/40 border-l border-violet-100 font-mono-num">
                                <span className="font-bold text-slate-700">{row.pptPnp} org</span>
                              </td>
                              {/* TOTAL KATEGORI */}
                              <td className="py-2 px-3 text-right bg-slate-50 border-l border-slate-200 font-mono-num font-bold">
                                <span className="text-slate-800">{row.totalPnp} org</span>
                                <span className="text-slate-400 mx-1">·</span>
                                <b className="text-violet-900">{formatRupiah(row.totalRp)}</b>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-100 font-extrabold border-t-2 border-slate-300 text-slate-900 text-xs">
                          <tr>
                            <td colSpan={2} className="py-2.5 px-3 uppercase text-[11px] tracking-wide">
                              JUMLAH / SUBTOTAL:
                            </td>
                            {/* SUBTOTAL TUNAI */}
                            <td className="py-2.5 px-3 text-right bg-emerald-100/70 border-l border-emerald-200 font-mono-num">
                              <span className="text-emerald-950 font-bold">
                                {detailBreakdown.subtotalTunaiPnp} org
                              </span>
                              <span className="text-emerald-500 mx-1">·</span>
                              <b className="text-emerald-800 text-sm">
                                {formatRupiah(detailBreakdown.subtotalTunaiRp)}
                              </b>
                            </td>
                            {/* SUBTOTAL NON-TUNAI */}
                            <td className="py-2.5 px-3 text-right bg-sky-100/70 border-l border-sky-200 font-mono-num">
                              <span className="text-sky-950 font-bold">
                                {detailBreakdown.subtotalNonTunaiPnp} org
                              </span>
                              <span className="text-sky-500 mx-1">·</span>
                              <b className="text-sky-800 text-sm">
                                {formatRupiah(detailBreakdown.subtotalNonTunaiRp)}
                              </b>
                            </td>
                            {/* SUBTOTAL MANUAL */}
                            <td className="py-2.5 px-3 text-right bg-amber-100/70 border-l border-amber-200 font-mono-num">
                              <span className="text-amber-950 font-bold">
                                {detailBreakdown.subtotalManualPnp} org
                              </span>
                              <span className="text-amber-500 mx-1">·</span>
                              <b className="text-amber-800 text-sm">
                                {formatRupiah(detailBreakdown.subtotalManualRp)}
                              </b>
                            </td>
                            {/* SUBTOTAL PPT */}
                            <td className="py-2.5 px-3 text-right bg-violet-100/70 border-l border-violet-200 font-mono-num">
                              <span className="text-violet-950 font-bold">
                                {detailBreakdown.subtotalPptPnp} org
                              </span>
                            </td>
                            {/* TOTAL AKHIR */}
                            <td className="py-2.5 px-3 text-right bg-violet-100 border-l border-violet-200 font-mono-num">
                              <span className="text-violet-950 font-bold">
                                {detailBreakdown.totalPnp} org
                              </span>
                              <span className="text-violet-400 mx-1">·</span>
                              <b className="text-violet-900 text-sm">
                                {formatRupiah(detailBreakdown.totalRp)}
                              </b>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Ringkasan Kartu 3 Kolom */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5">
                        <span className="block text-[11px] font-bold text-emerald-800">
                          Subtotal Tunai:
                        </span>
                        <b className="text-sm font-extrabold text-emerald-900 font-mono-num block">
                          {formatRupiah(detailBreakdown.subtotalTunaiRp)}
                        </b>
                        <span className="text-[10px] text-emerald-700">
                          {detailBreakdown.subtotalTunaiPnp} penumpang
                        </span>
                      </div>
                      <div className="bg-sky-50 border border-sky-200 rounded-xl p-2.5">
                        <span className="block text-[11px] font-bold text-sky-800">
                          Subtotal Non-Tunai:
                        </span>
                        <b className="text-sm font-extrabold text-sky-900 font-mono-num block">
                          {formatRupiah(detailBreakdown.subtotalNonTunaiRp)}
                        </b>
                        <span className="text-[10px] text-sky-700">
                          {detailBreakdown.subtotalNonTunaiPnp} penumpang
                        </span>
                      </div>
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5">
                        <span className="block text-[11px] font-bold text-amber-800">
                          Subtotal Manual:
                        </span>
                        <b className="text-sm font-extrabold text-amber-900 font-mono-num block">
                          {formatRupiah(detailBreakdown.subtotalManualRp)}
                        </b>
                        <span className="text-[10px] text-amber-700">
                          {detailBreakdown.subtotalManualPnp} penumpang
                        </span>
                      </div>
                      <div className="bg-violet-50 border border-violet-200 rounded-xl p-2.5">
                        <span className="block text-[11px] font-bold text-violet-800">
                          Total Pnp PPT (tidak masuk setoran):
                        </span>
                        <b className="text-sm font-extrabold text-violet-900 font-mono-num block">
                          {detailBreakdown.subtotalPptPnp} org
                        </b>
                        <span className="text-[10px] text-violet-700">
                          {formatRupiah(0)}
                        </span>
                      </div>
                      <div className="bg-violet-50 border border-violet-200 rounded-xl p-2.5">
                        <span className="block text-[11px] font-bold text-violet-800">
                          Total Setoran:
                        </span>
                        <b className="text-sm font-extrabold text-violet-950 font-mono-num block">
                          {formatRupiah(detailBreakdown.totalRp)}
                        </b>
                        <span className="text-[10px] text-violet-700">
                          {detailBreakdown.totalPnp} penumpang ({new Set(filteredDetailRecords.map(r => r.noLambung)).size} lambung)
                        </span>
                      </div>
                    </div>

                    {/* Daftar Rincian Per Lambung Per Shift */}
                    <div className="pt-2 border-t border-slate-200 space-y-2">
                      <div className="font-extrabold text-slate-800 text-xs">
                        Daftar Rincian Per Lambung Per Shift ({filteredDetailRecords.length} Data Tersedia)
                      </div>
                      <div className="space-y-1.5">
                        {filteredDetailRecords.map((item) => {
                          const term = getTerminalAkhirFromMasterRit(item.noLambung, item.rit);
                          const rNum = parseInt(String(item.rit || '').replace(/\D/g, ''), 10);
                          const isShift2 = item.shift?.toUpperCase().includes('2') || (!isNaN(rNum) && rNum >= 5);
                          const shiftLabel = item.shift || (isShift2 ? 'SHIFT 2' : 'SHIFT 1');
                          const isCadangan = item.noLambung.toUpperCase().includes('LBC') || item.noLambung.toUpperCase().includes('LBCO');
                          const lbDisplay = isCadangan ? 'LBCO1 (Cadangan)' : item.noLambung;

                          return (
                            <div
                              key={item.idKasirTransaksi}
                              className="bg-white border border-slate-200 rounded-xl p-2.5 flex flex-wrap justify-between items-center gap-2 text-xs"
                            >
                              <span className="font-bold text-slate-800">
                                {lbDisplay} - {term} - {shiftLabel} - {item.waktuCatat || '-'} WIB - {formatRupiah(item.totalPendapatan)} ({item.totalPenumpang} pnp)
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${item.statusKirim === 'TERKIRIM' ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'}`}>
                                ({item.statusKirim})
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              /* TABEL REKAP SHIFT PER LAMBUNG (Alternatif view) */
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-extrabold text-slate-700">
                    Tabel Rekapitulasi Shift 1 &amp; Shift 2 Per Lambung
                  </span>
                  <button
                    type="button"
                    onClick={() => setFilterHanyaSetor((v) => !v)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      filterHanyaSetor
                        ? 'bg-violet-700 text-white border-violet-800'
                        : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {filterHanyaSetor
                      ? `Armada Setor Saja (${armadaSudahSetorCount})`
                      : `Semua Armada (${LIST_LB.length})`}
                  </button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Lambung</th>
                        <th className="py-2.5 px-3">Shift 1 (R01-R04)</th>
                        <th className="py-2.5 px-3">Shift 2 (R05-R08)</th>
                        <th className="py-2.5 px-3 text-right">Total Setoran</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-medium">
                      {filteredDetailPerShift.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-4 text-center text-slate-400 italic">
                            Belum ada armada yang menyetor setoran hari ini ({tanggal})
                          </td>
                        </tr>
                      ) : (
                        filteredDetailPerShift.map((row) => {
                          const isExpanded = expandedLb === row.lb;
                          return (
                            <Fragment key={row.lb}>
                              <tr
                                onClick={() => {
                                  if (row.hasData) {
                                    setExpandedLb(isExpanded ? null : row.lb);
                                  }
                                }}
                                className={`transition-colors ${
                                  row.hasData
                                    ? 'bg-white hover:bg-violet-50/60 cursor-pointer'
                                    : 'bg-slate-50/50 text-slate-400'
                                }`}
                              >
                                <td className="py-2.5 px-3 font-extrabold text-slate-900 whitespace-nowrap">
                                  <div className="flex items-center gap-1.5">
                                    <Bus
                                      className={`w-3.5 h-3.5 ${
                                        row.hasData ? 'text-violet-600' : 'text-slate-400'
                                      }`}
                                    />
                                    <span>{row.lb}</span>
                                    {row.hasData && (
                                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                    )}
                                    {row.hasData && (
                                      <span className="text-slate-400 ml-0.5">
                                        {isExpanded ? (
                                          <ChevronUp className="w-3.5 h-3.5 inline" />
                                        ) : (
                                          <ChevronDown className="w-3.5 h-3.5 inline" />
                                        )}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3">
                                  {row.shift1.rp > 0 ? (
                                    <div>
                                      <b className="text-emerald-700 font-mono-num">
                                        {formatRupiah(row.shift1.rp)}
                                      </b>
                                      <div className="text-[10px] text-slate-500">
                                        {row.shift1.pnp} org · Rit:{' '}
                                        {row.shift1.rits.map((x) => x.rit).join(', ')}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400">-</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3">
                                  {row.shift2.rp > 0 ? (
                                    <div>
                                      <b className="text-emerald-700 font-mono-num">
                                        {formatRupiah(row.shift2.rp)}
                                      </b>
                                      <div className="text-[10px] text-slate-500">
                                        {row.shift2.pnp} org · Rit:{' '}
                                        {row.shift2.rits.map((x) => x.rit).join(', ')}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400">-</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  {row.totalRp > 0 ? (
                                    <div>
                                      <b className="text-slate-900 font-mono-num text-sm font-extrabold">
                                        {formatRupiah(row.totalRp)}
                                      </b>
                                      <div className="text-[10px] text-slate-500">{row.totalPnp} org</div>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 font-mono-num">Rp 0</span>
                                  )}
                                </td>
                              </tr>

                              {/* Accordion Rincian Detail Tiap Rit */}
                              {isExpanded && row.hasData && (
                                <tr className="bg-violet-50/70 border-b border-violet-200">
                                  <td colSpan={4} className="p-3">
                                    <div className="space-y-2 text-xs">
                                      <div className="font-extrabold text-violet-900 flex justify-between items-center">
                                        <span>Rincian Setoran Bus {row.lb}</span>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedDetailLb(row.lb);
                                            setSelectedDetailShift('Semua');
                                            setSelectedDetailTerminal('Semua');
                                            setDetailSubView('kategori');
                                          }}
                                          className="text-[11px] text-violet-700 underline font-bold cursor-pointer hover:text-violet-900"
                                        >
                                          Buka di Tampilan Detail Kategori &rarr;
                                        </button>
                                      </div>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <div className="bg-white p-2.5 rounded-lg border border-violet-200 shadow-2xs">
                                          <div className="font-extrabold text-sky-800 text-[11px] mb-1.5 pb-1 border-b border-sky-100 flex justify-between">
                                            <span>SHIFT 1 (R01 - R04)</span>
                                            <span>{formatRupiah(row.shift1.rp)}</span>
                                          </div>
                                          {row.shift1.rits.length === 0 ? (
                                            <div className="text-slate-400 italic text-[11px]">
                                              Belum ada rit disetor
                                            </div>
                                          ) : (
                                            row.shift1.rits.map((it, idx) => (
                                              <div
                                                key={idx}
                                                className="flex justify-between py-1 text-[11px] border-b border-slate-100 last:border-b-0"
                                              >
                                                <span className="font-bold text-slate-800">
                                                  {it.rit}
                                                </span>
                                                <span className="font-mono-num text-slate-700">
                                                  {it.pnp} pnp · <b>{formatRupiah(it.rp)}</b>{' '}
                                                  <span
                                                    className={`text-[10px] font-bold ${
                                                      it.status === 'TERKIRIM'
                                                        ? 'text-emerald-700'
                                                        : 'text-amber-700'
                                                    }`}
                                                  >
                                                    ({it.status})
                                                  </span>
                                                </span>
                                              </div>
                                            ))
                                          )}
                                        </div>
                                        <div className="bg-white p-2.5 rounded-lg border border-violet-200 shadow-2xs">
                                          <div className="font-extrabold text-violet-800 text-[11px] mb-1.5 pb-1 border-b border-violet-100 flex justify-between">
                                            <span>SHIFT 2 (R05 - R08)</span>
                                            <span>{formatRupiah(row.shift2.rp)}</span>
                                          </div>
                                          {row.shift2.rits.length === 0 ? (
                                            <div className="text-slate-400 italic text-[11px]">
                                              Belum ada rit disetor
                                            </div>
                                          ) : (
                                            row.shift2.rits.map((it, idx) => (
                                              <div
                                                key={idx}
                                                className="flex justify-between py-1 text-[11px] border-b border-slate-100 last:border-b-0"
                                              >
                                                <span className="font-bold text-slate-800">
                                                  {it.rit}
                                                </span>
                                                <span className="font-mono-num text-slate-700">
                                                  {it.pnp} pnp · <b>{formatRupiah(it.rp)}</b>{' '}
                                                  <span
                                                    className={`text-[10px] font-bold ${
                                                      it.status === 'TERKIRIM'
                                                        ? 'text-emerald-700'
                                                        : 'text-amber-700'
                                                    }`}
                                                  >
                                                    ({it.status})
                                                  </span>
                                                </span>
                                              </div>
                                            ))
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
              </>
            )}
          </div>

          {/* Riwayat Kasir */}
          <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 space-y-2.5">
            <button
              type="button"
              onClick={() => setShowRiwayatSetoran((v) => !v)}
              className="w-full flex flex-wrap justify-between items-center gap-2 cursor-pointer text-left"
            >
              <span className="font-extrabold text-slate-900 text-sm">
                RIWAYAT SETORAN KASIR ({displayedRiwayat.length} data)
              </span>
              <span className="text-violet-700 text-sm font-bold">
                {showRiwayatSetoran ? '▲' : '▼'}
              </span>
            </button>
            {showRiwayatSetoran && (
              <>
            <div className="flex flex-wrap justify-end items-center gap-2">
              <button
                type="button"
                onClick={() => setFilterHariIni((v) => !v)}
                className="text-xs font-bold text-violet-700 underline cursor-pointer"
              >
                {filterHariIni ? 'Tampilkan Semua Tanggal' : 'Filter Hari Ini Saja'}
              </button>
            </div>
            {displayedRiwayat.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-4">
                Belum ada setoran kasir tersimpan
              </p>
            ) : (
              displayedRiwayat.map((d) => (
                <div
                  key={d.idKasirTransaksi}
                  className="bg-white border border-slate-300 rounded-xl p-3 text-sm space-y-1"
                >
                  <div className="flex justify-between items-center gap-2">
                    <span className="font-extrabold text-slate-900">
                      {d.noLambung} | {d.rit}
                    </span>
                    <span
                      className={`text-xs font-extrabold ${
                        d.statusKirim === 'GAGAL_KIRIM' ? 'text-red-700' : 'text-emerald-700'
                      }`}
                    >
                      {d.statusKirim}
                    </span>
                  </div>
                  <div className="text-xs font-mono-num text-slate-500">
                    {d.idPerjalanan} · {d.waktuCatat}
                  </div>
                  <div className="text-xs font-extrabold text-slate-800">
                    Total: {formatRupiah(d.totalPendapatan)} · Pnp: {d.totalPenumpang} org
                  </div>
                  <div className="text-xs text-slate-600">
                    Tunai: {d.subtotalTunaiPnp} org ({formatRupiah(d.setoranTunai)}) · Non-Tunai:{' '}
                    {d.subtotalNonTunaiPnp} org ({formatRupiah(d.setoranNonTunai)}) · Manual:{' '}
                    {(d as unknown as Record<string, number | undefined>).subtotalManualPnp || 0} org (
                    {formatRupiah((d as unknown as Record<string, number | undefined>).setoranManual || 0)}) · PPT:{' '}
                    {(d as unknown as Record<string, number | undefined>).subtotalPptPnp || 0} org
                  </div>
                  {d.adaLostFound && (
                    <div className="text-xs font-bold text-red-700">
                      Lost &amp; Found: {d.rincianLostFound}
                    </div>
                  )}
                  {d.statusKirim === 'GAGAL_KIRIM' && (
                    <button
                      type="button"
                      disabled={sending}
                      onClick={() => void kirimKasirKeServer(d)}
                      className="mt-1 text-xs font-extrabold text-blue-700 underline cursor-pointer disabled:opacity-50"
                    >
                      Kirim Ulang Sekarang
                    </button>
                  )}
                </div>
              ))
            )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
