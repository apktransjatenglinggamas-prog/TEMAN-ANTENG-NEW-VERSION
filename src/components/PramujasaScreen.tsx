import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, PackageSearch, Trash2 } from 'lucide-react';
import {
  KasirRecord,
  KategoriCounts,
  KategoriKey,
  MasterHalteItem,
  MasterPramudiItem,
  MasterRitMap,
  PramujasaRecord,
  TimerLookupData,
  ToastType,
} from '../types/anteng';
import {
  API_PRAMUJASA,
  API_TIMER,
  IDS_PRAM_KEY,
  KATEGORI_LIST,
  LIST_HALTE,
  LIST_KORIDOR,
  LIST_LB,
  LIST_RIT,
  STORAGE_KASIR_KEY,
  STORAGE_PRAM_KEY,
  bacaStorage,
  emptyKategoriCounts,
  hasSavedIdPerjalanan,
  hitungRingkasanRitPram,
  jamSekarangHHMM,
  markSavedIdPerjalanan,
  normalKunciJS,
  normalizePramRecord,
  timestampSekarang,
  tglHariIni,
  tulisStorage,
} from '../utils/anteng';
import { BrandLogo } from './BrandLogo';
import { WhatsAppShareBox } from './WhatsAppShareBox';

interface PramujasaScreenProps {
  petugasNama: string;
  masterRit: MasterRitMap;
  masterPramudi: MasterPramudiItem[];
  masterHalte: MasterHalteItem[];
  onBackToLogin: () => void;
  onOpenLostFound: () => void;
  showToast: (msg: string, type?: ToastType) => void;
  setGlobalLoading: (loading: boolean) => void;
}

export function PramujasaScreen({
  petugasNama,
  masterRit,
  masterPramudi,
  masterHalte,
  onBackToLogin,
  onOpenLostFound,
  showToast,
  setGlobalLoading,
}: PramujasaScreenProps) {
  const [tanggal, setTanggal] = useState(tglHariIni());
  const [koridor, setKoridor] = useState('KOR01');
  const [lb, setLb] = useState('LB01');
  const [rit, setRit] = useState('R01');
  // ===== PANEL CADANGAN LBC01 — PENAMBAHAN SAJA =====
  const [statusPerjalanan, setStatusPerjalanan] = useState('NORMAL');
  const [idPerjalananAsal, setIdPerjalananAsal] = useState('');
  const [titikGanti, setTitikGanti] = useState('TERMINAL_AWAL');
  const [halteTitikGanti, setHalteTitikGanti] = useState('');
  const isCadangan = lb === 'LBC01';
  const tampilPanelCadangan = isCadangan; // panel HANYA kalau LB = LBC01 — jangan ikut status, biar tidak nyangkut saat LB diganti
  const statusPerjalananEfektif = tampilPanelCadangan ? statusPerjalanan : 'NORMAL';
  const [shift, setShift] = useState('SHIFT 1');
  // Shift otomatis ngikut rit, biar rekap tidak 0 kalau petugas lupa ganti dropdown
  // R01-R04 = SHIFT 1, R05-R08 = SHIFT 2
  useEffect(() => {
    const num = parseInt(rit.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(num)) {
      setShift(num >= 5 ? 'SHIFT 2' : 'SHIFT 1');
    }
  }, [rit]);
  const [jamTiba, setJamTiba] = useState(jamSekarangHHMM());
  const [jamManual, setJamManual] = useState(false);

  // Pramudi (dari MASTER_DB sheet MASTER_PRAMUDI)
  const [selectedPramudiId, setSelectedPramudiId] = useState('');

  // Arah manual fallback khusus LBC01 (jika tidak ada di MASTER_RIT)
  const [manualArah, setManualArah] = useState<'BP' | 'BK'>('BP');
  const [selectedHalteId, setSelectedHalteId] = useState('');

  // Input kolom Tunai & Non-Tunai per kategori (seperti modul Kasir, tanpa dropdown)
  const [tunaiInputs, setTunaiInputs] = useState<KategoriCounts>(emptyKategoriCounts);
  const [nonTunaiInputs, setNonTunaiInputs] = useState<KategoriCounts>(emptyKategoriCounts);
  // ===== INPUT PER JENIS (sesuai screenshot): TUNAI / NON-TUNAI / MANUAL / PPT =====
  // Manual & PPT per kategori, masing-masing bisa dilipat. Menutup blok TIDAK menghapus input.
  const [manualInputs, setManualInputs] = useState<KategoriCounts>(emptyKategoriCounts);
  const [pptInputs, setPptInputs] = useState<KategoriCounts>(emptyKategoriCounts);
  const [openJenis, setOpenJenis] = useState<Record<string, boolean>>({ tunai: true, nonTunai: false, manual: false, ppt: false });
  const toggleJenis = (j: string) => setOpenJenis((prev) => ({ ...prev, [j]: !prev[j] }));
  const [showLMB, setShowLMB] = useState(false);
  const [turunHalte, setTurunHalte] = useState('0');
  const [transitHalte, setTransitHalte] = useState('0');
  const [pptHalte, setPptHalte] = useState('0');
  const [ket, setKet] = useState('');

  const [riwayat, setRiwayat] = useState<PramujasaRecord[]>(() =>
    bacaStorage<PramujasaRecord>(STORAGE_PRAM_KEY)
  );
  const [showSementara, setShowSementara] = useState(false);
  const [showRekapShift, setShowRekapShift] = useState(false);
  const [showRiwayat, setShowRiwayat] = useState(false);
  const [lastWaMsg, setLastWaMsg] = useState('');
  const [sending, setSending] = useState(false);

  const idPerjalanan = useMemo(
    () =>
      isCadangan && idPerjalananAsal.trim()
        ? `${koridor}-LBC01${rit}${tanggal.split('-').join('')}-GANTI-${idPerjalananAsal.trim().toUpperCase()}`
        : `${koridor}-${lb}${rit}${tanggal.split('-').join('')}`,
    [koridor, lb, rit, tanggal, isCadangan, idPerjalananAsal]
  );

  // Acuan arah dari MASTER_RIT berdasarkan bus + rit
  const ritInfo = useMemo(() => {
    const kunci = normalKunciJS(`${lb}-${rit}`) || `${lb}-${rit}`;
    return masterRit[kunci] || masterRit[rit] || null;
  }, [lb, rit, masterRit]);

  const arahAktif = useMemo(() => {
    if (ritInfo?.arah === 'BP' || ritInfo?.arah === 'BK') {
      return ritInfo.arah;
    }
    if (ritInfo?.terminalAkhir) {
      const upAk = ritInfo.terminalAkhir.toUpperCase();
      if (upAk.includes('BULUPITU')) return 'BP';
      if (upAk.includes('BUKATEJA')) return 'BK';
    }
    return manualArah;
  }, [ritInfo, manualArah]);

  const butuhArahManual = !ritInfo?.arah && !ritInfo?.terminalAkhir;

  const arahLabel = useMemo(() => {
    if (ritInfo?.terminal && ritInfo?.terminalAkhir) {
      return `${arahAktif} (${ritInfo.terminal} → ${ritInfo.terminalAkhir})`;
    }
    return arahAktif === 'BP'
      ? 'BP (Arah Bulupitu)'
      : 'BK (Arah Bukateja)';
  }, [arahAktif, ritInfo]);

  // Daftar Halte searah dari MASTER_HALTE berdasarkan koridor & arahAktif
  const halteSearah = useMemo(() => {
    if (masterHalte.length > 0) {
      const byKorAndArah = masterHalte.filter(
        (h) =>
          (!h.koridor || h.koridor === koridor) &&
          (!arahAktif || h.arah === arahAktif)
      );
      if (byKorAndArah.length > 0) return byKorAndArah;

      const byKorOnly = masterHalte.filter((h) => !h.koridor || h.koridor === koridor);
      if (byKorOnly.length > 0) return byKorOnly;
      return masterHalte;
    }

    return LIST_HALTE.map((h) => ({
      id: h.id,
      koridor: 'KOR01',
      nama: h.value,
      arah: arahAktif,
      status: 'AKTIF',
    }));
  }, [masterHalte, koridor, arahAktif]);

  // Pastikan selectedHalteId selalu valid mengikuti halte searah saat ganti bus/rit/arah
  useEffect(() => {
    if (halteSearah.length === 0) return;
    const stillValid = halteSearah.some((h) => h.id === selectedHalteId);
    if (!stillValid) {
      setSelectedHalteId(halteSearah[0].id);
    }
  }, [halteSearah, selectedHalteId]);

  // Auto-select Pramudi pertama jika daftar MASTER_PRAMUDI termuat
  useEffect(() => {
    if (masterPramudi.length > 0 && !selectedPramudiId) {
      setSelectedPramudiId(masterPramudi[0].id);
    }
  }, [masterPramudi, selectedPramudiId]);

  const selectedPramudi = useMemo(
    () => masterPramudi.find((p) => p.id === selectedPramudiId) || null,
    [masterPramudi, selectedPramudiId]
  );

  const selectedHalte = useMemo(
    () => halteSearah.find((h) => h.id === selectedHalteId) || halteSearah[0],
    [halteSearah, selectedHalteId]
  );

  useEffect(() => {
    setTanggal(tglHariIni());
    if (!jamManual) {
      setJamTiba(jamSekarangHHMM());
    }
  }, [koridor, lb, rit, jamManual]);

  const subtotalHalte = useMemo(() => {
    let subTunai = 0;
    let subNonTunai = 0;
    let subManual = 0;
    let subPPT = 0;
    for (const k of KATEGORI_LIST) {
      subTunai += Math.max(0, tunaiInputs[k.key] || 0);
      subNonTunai += Math.max(0, nonTunaiInputs[k.key] || 0);
      subManual += Math.max(0, manualInputs[k.key] || 0);
      subPPT += Math.max(0, pptInputs[k.key] || 0);
    }
    return {
      subTunai,
      subNonTunai,
      subManual,
      subPPT,
      // Total Naik = Tunai + Non-Tunai + Manual. PPT TIDAK MASUK.
      total: subTunai + subNonTunai + subManual,
      totalPPT: subPPT,
    };
  }, [tunaiInputs, nonTunaiInputs, manualInputs, pptInputs]);
  // Manual & PPT yang sudah tersimpan sementara (dari field tambahan di record)
  const manualPptTersimpan = useMemo(() => {
    let m = 0; let pp = 0;
    for (const d of riwayat) {
      if (!d || d.idPerjalanan !== idPerjalanan) continue;
      const extra = d as unknown as { manual?: KategoriCounts; pptCounts?: KategoriCounts };
      if (extra.manual) for (const k of KATEGORI_LIST) m += Math.max(0, extra.manual[k.key] || 0);
      if (extra.pptCounts) for (const k of KATEGORI_LIST) pp += Math.max(0, extra.pptCounts[k.key] || 0);
    }
    return { manual: m, ppt: pp };
  }, [riwayat, idPerjalanan]);

  // Akumulasi selama 1 Rit (data tersimpan di rit ini)
  const ringkasRitTersimpan = useMemo(
    () => hitungRingkasanRitPram(riwayat, tanggal, lb, rit, idPerjalanan),
    [riwayat, tanggal, lb, rit, idPerjalanan]
  );

  // REKAP 1 SHIFT: total gabungan semua rit dalam 1 shift
  // Bisa dilihat walau baru jalan 1, 2, atau 3 rit - totalnya nambah live
  // Shift 1 = R01-R04, Shift 2 = R05-R08
  // UPGRADE dari file _2: ditambah totalTransit & totalPPT + perRit transit/ppt
  const rekapShift = useMemo(() => {
    const ritShift1 = ['R01', 'R02', 'R03', 'R04'];
    const ritShift2 = ['R05', 'R06', 'R07', 'R08'];
    const ritDiShiftIni = shift === 'SHIFT 2' ? ritShift2 : ritShift1;

    const list = riwayat.filter((d) => {
      if (!d) return false;
      if (d.tanggal && d.tanggal !== tanggal) return false;
      if (d.koridor && d.koridor !== koridor) return false;
      if (d.noLambung && d.noLambung !== lb) return false;
      if (!ritDiShiftIni.includes(d.rit)) return false;
      // Jangan filter kaku pakai d.shift, karena rit sudah menentukan shift
      // R01-R04 pasti Shift 1, R05-R08 pasti Shift 2
      return true;
    });

    const perRitMap = new Map();
    let totalNaik = 0, totalTunai = 0, totalNonTunai = 0, totalTurun = 0, totalTransit = 0, totalPPT = 0;

    for (const d of list) {
      const norm = normalizePramRecord(d);
      const naik = norm.totalHalte || 0;
      totalNaik += naik;
      totalTunai += norm.totalTunai || 0;
      totalNonTunai += norm.totalNonTunai || 0;
      totalTurun += d.penumpangTurun || 0;
      totalTransit += d.penumpangTransit || 0;
      totalPPT += d.penumpangPPT || 0;
      const key = d.idPerjalanan || d.rit;
      const cur = perRitMap.get(key) || { rit: d.rit, idPerjalanan: d.idPerjalanan, naik: 0, tunai: 0, nonTunai: 0, turun: 0, transit: 0, ppt: 0, halte: 0 };
      cur.naik += naik; cur.tunai += norm.totalTunai || 0; cur.nonTunai += norm.totalNonTunai || 0;
      cur.turun += d.penumpangTurun || 0; cur.transit += d.penumpangTransit || 0; cur.ppt += d.penumpangPPT || 0; cur.halte += 1;
      perRitMap.set(key, cur);
    }
    const perRit = Array.from(perRitMap.values()).sort((a, b) => a.rit.localeCompare(b.rit));
    return { list, perRit, jumlahRitJalan: perRit.length, totalNaik, totalTunai, totalNonTunai, totalTurun, totalTransit, totalPPT };
  }, [riwayat, tanggal, koridor, lb, shift]);

  // Transaksi sementara per halte (SEMENTARA / GAGAL_KIRIM) untuk rit aktif / hari ini
  const transaksiSementaraPerHalte = useMemo(
    () =>
      riwayat.filter(
        (d) =>
          (!d.tanggal || d.tanggal === tanggal) &&
          d.idPerjalanan === idPerjalanan &&
          d.status !== 'TERVALIDASI'
      ),
    [riwayat, tanggal, idPerjalanan]
  );

  const todayRiwayat = useMemo(
    () => riwayat.filter((d) => !d.tanggal || d.tanggal === tanggal),
    [riwayat, tanggal]
  );

  const unsentCountRit = transaksiSementaraPerHalte.length;

  useEffect(() => {
    for (const r of riwayat) {
      if (r?.idPerjalanan && r.status === 'TERVALIDASI') {
        markSavedIdPerjalanan(IDS_PRAM_KEY, r.idPerjalanan);
      }
    }
  }, [riwayat]);

  const sudahTersimpan = useMemo(
    () =>
      riwayat.some((d) => d && d.idPerjalanan === idPerjalanan && d.status === 'TERVALIDASI') ||
      hasSavedIdPerjalanan(IDS_PRAM_KEY, idPerjalanan),
    [riwayat, idPerjalanan]
  );

  const updateKategoriInput = (
    jenis: 'tunai' | 'nonTunai' | 'manual' | 'ppt',
    key: KategoriKey,
    rawVal: string
  ) => {
    const num = Math.max(0, parseInt(rawVal, 10) || 0);
    if (jenis === 'tunai') setTunaiInputs((prev) => ({ ...prev, [key]: num }));
    else if (jenis === 'nonTunai') setNonTunaiInputs((prev) => ({ ...prev, [key]: num }));
    else if (jenis === 'manual') setManualInputs((prev) => ({ ...prev, [key]: num }));
    else setPptInputs((prev) => ({ ...prev, [key]: num }));
  };

  const bersihkanInputHalte = () => {
    setTunaiInputs(emptyKategoriCounts());
    setNonTunaiInputs(emptyKategoriCounts());
    setManualInputs(emptyKategoriCounts());
    setPptInputs(emptyKategoriCounts());
    setTurunHalte('0');
    setTransitHalte('0');
    setPptHalte('0');
    setKet('');
    setJamManual(false);
  };

  const handleSimpanSementara = () => {
    // Validasi panel cadangan LBC01 — penambahan saja
    if (isCadangan && !idPerjalananAsal.trim()) {
      showToast('Isi dulu Bus yang diganti (ID Perjalanan Asal) untuk LBC01.', 'warn');
      return;
    }
    const freshRiw = bacaStorage<PramujasaRecord>(STORAGE_PRAM_KEY);
    if (
      freshRiw.some((r) => r.idPerjalanan === idPerjalanan && r.status === 'TERVALIDASI') ||
      hasSavedIdPerjalanan(IDS_PRAM_KEY, idPerjalanan)
    ) {
      showToast('ID_PERJALANAN SUDAH ADA', 'err');
      return;
    }

    const turunNum = Math.max(0, parseInt(turunHalte, 10) || 0);
    const transitNum = Math.max(0, parseInt(transitHalte, 10) || 0);
    const pptNum = subtotalHalte.totalPPT; // PPT dari blok PNP PPT per kategori, bukan dari kotak terpisah
    if (subtotalHalte.total === 0 && turunNum === 0 && transitNum === 0 && pptNum === 0) {
      showToast('Isi jumlah penumpang (Tunai atau Non-Tunai) halte terlebih dahulu.', 'warn');
      return;
    }

    const nowMs = Date.now();
    const jam = jamTiba || jamSekarangHHMM();
    const halteId = selectedHalte?.id || 'HT01';
    const halteNama = selectedHalte?.nama || 'Halte';

    const itemBaru: PramujasaRecord = {
      idTransaksi: `PJT_${nowMs}`,
      idDetail: `TJD_${nowMs}`,
      tanggal,
      koridor,
      noLambung: lb,
      rit,
      idPerjalanan,
      shift,
      jamTiba: jam,
      idHalte: halteId,
      namaHalte: halteNama,
      tunai: { ...tunaiInputs },
      nonTunai: { ...nonTunaiInputs },
      totalTunai: subtotalHalte.subTunai,
      totalNonTunai: subtotalHalte.subNonTunai,
      totalHalte: subtotalHalte.total,
      // Manual + PPT per kategori — disimpan sebagai field tambahan (tidak mengubah field lama)
      ...({ manual: { ...manualInputs }, pptCounts: { ...pptInputs } } as unknown as Partial<PramujasaRecord>),
      penumpangTurun: turunNum,
      penumpangTransit: transitNum,
      penumpangPPT: pptNum,
      keterangan: ket.trim() || '-',
      statusPerjalanan: statusPerjalananEfektif,
      idPerjalananAsal: tampilPanelCadangan ? idPerjalananAsal.trim() : '',
      titikGanti: tampilPanelCadangan ? titikGanti : '',
      halteTitikGanti: tampilPanelCadangan ? halteTitikGanti : '',
      petugas: petugasNama,
      idPramudi: selectedPramudi?.id || '',
      namaPramudi: selectedPramudi?.nama || '',
      status: 'SEMENTARA',
      waktuKirim: jam,
    };

    const current = bacaStorage<PramujasaRecord>(STORAGE_PRAM_KEY);
    const updated = [itemBaru, ...current];
    tulisStorage(STORAGE_PRAM_KEY, updated);
    setRiwayat(updated);
    bersihkanInputHalte();

    const ringkasBaru = hitungRingkasanRitPram(updated, tanggal, lb, rit, idPerjalanan);
    showToast(
      `Disimpan SEMENTARA (${halteNama}). Akumulasi rit: ${ringkasBaru.totalRit} pnp (Tunai ${ringkasBaru.totalTunai} | Non-Tunai ${ringkasBaru.totalNonTunai}).`,
      'warn'
    );
  };

  const handleHapusDraft = (idDetail: string) => {
    const current = bacaStorage<PramujasaRecord>(STORAGE_PRAM_KEY);
    const updated = current.filter(
      (item) => !(item.idDetail === idDetail && item.status !== 'TERVALIDASI')
    );
    tulisStorage(STORAGE_PRAM_KEY, updated);
    setRiwayat(updated);
    showToast('Transaksi sementara halte dihapus.', 'ok');
  };

  const handleValidasiKirim = async () => {
    if (sending) return;

    let currentRiw = bacaStorage<PramujasaRecord>(STORAGE_PRAM_KEY);
    if (
      currentRiw.some((r) => r.idPerjalanan === idPerjalanan && r.status === 'TERVALIDASI') ||
      hasSavedIdPerjalanan(IDS_PRAM_KEY, idPerjalanan)
    ) {
      showToast('ID_PERJALANAN SUDAH ADA', 'err');
      return;
    }

    const turunNum = Math.max(0, parseInt(turunHalte, 10) || 0);
    const transitNum = Math.max(0, parseInt(transitHalte, 10) || 0);
    const pptNum = subtotalHalte.totalPPT; // PPT dari blok PNP PPT per kategori
    const jam = jamTiba || jamSekarangHHMM();
    const ketVal = ket.trim() || '-';
    const nowTs = timestampSekarang();
    const nowMs = Date.now();
    const tglCompact = tanggal.split('-').join('');
    const idPramTransaksi = `PJT_${nowMs}`;
    const halteId = selectedHalte?.id || 'HT01';
    const halteNama = selectedHalte?.nama || 'Halte';

    if (subtotalHalte.total > 0 || turunNum > 0 || transitNum > 0 || pptNum > 0) {
      const itemHalteAkhir: PramujasaRecord = {
        idTransaksi: idPramTransaksi,
        idDetail: `TJD_${nowMs}`,
        tanggal,
        koridor,
        noLambung: lb,
        rit,
        idPerjalanan,
        shift,
        jamTiba: jam,
        idHalte: halteId,
        namaHalte: halteNama,
        tunai: { ...tunaiInputs },
        nonTunai: { ...nonTunaiInputs },
        totalTunai: subtotalHalte.subTunai,
        totalNonTunai: subtotalHalte.subNonTunai,
        totalHalte: subtotalHalte.total,
        ...({ manual: { ...manualInputs }, pptCounts: { ...pptInputs } } as unknown as Partial<PramujasaRecord>),
        penumpangTurun: turunNum,
        penumpangTransit: transitNum,
        penumpangPPT: pptNum,
        keterangan: ketVal,
        petugas: petugasNama,
        idPramudi: selectedPramudi?.id || '',
        namaPramudi: selectedPramudi?.nama || '',
        status: 'SEMENTARA',
        waktuKirim: jam,
      };
      currentRiw = [itemHalteAkhir, ...currentRiw];
      tulisStorage(STORAGE_PRAM_KEY, currentRiw);
      setRiwayat(currentRiw);
      bersihkanInputHalte();
    }

    const unsentItems = currentRiw.filter(
      (item) => item && item.idPerjalanan === idPerjalanan && item.status !== 'TERVALIDASI'
    );

    if (unsentItems.length === 0) {
      showToast('Belum ada data halte baru (belum tervalidasi) untuk rit ini.', 'warn');
      return;
    }

    const listDetailKirim = unsentItems.map((item) => {
      const norm = normalizePramRecord(item);
      return {
        ID_DETAIL: item.idDetail || `TJD_${Math.random()}`,
        ID_PRAMUJASA_TRANSAKSI: idPramTransaksi,
        ID_PERJALANAN: idPerjalanan,
        ID_HALTE: item.idHalte || 'HT01',
        TUNAI_UMUM: norm.tunai.umum,
        TUNAI_PELAJAR: norm.tunai.pelajar,
        TUNAI_BURUH: norm.tunai.buruh,
        TUNAI_LANSIA: norm.tunai.lansia,
        TUNAI_VETERAN: norm.tunai.veteran,
        TUNAI_DISABILITAS: norm.tunai.disabilitas,
        NONTUNAI_UMUM: norm.nonTunai.umum,
        NONTUNAI_PELAJAR: norm.nonTunai.pelajar,
        NONTUNAI_BURUH: norm.nonTunai.buruh,
        NONTUNAI_LANSIA: norm.nonTunai.lansia,
        NONTUNAI_VETERAN: norm.nonTunai.veteran,
        NONTUNAI_DISABILITAS: norm.nonTunai.disabilitas,
        MANUAL_UMUM: (item as unknown as { manual?: KategoriCounts }).manual?.umum || 0,
        MANUAL_PELAJAR: (item as unknown as { manual?: KategoriCounts }).manual?.pelajar || 0,
        MANUAL_BURUH: (item as unknown as { manual?: KategoriCounts }).manual?.buruh || 0,
        MANUAL_LANSIA: (item as unknown as { manual?: KategoriCounts }).manual?.lansia || 0,
        MANUAL_VETERAN: (item as unknown as { manual?: KategoriCounts }).manual?.veteran || 0,
        MANUAL_DISABILITAS: (item as unknown as { manual?: KategoriCounts }).manual?.disabilitas || 0,
        PPT_UMUM: (item as unknown as { pptCounts?: KategoriCounts }).pptCounts?.umum || 0,
        PPT_PELAJAR: (item as unknown as { pptCounts?: KategoriCounts }).pptCounts?.pelajar || 0,
        PPT_BURUH: (item as unknown as { pptCounts?: KategoriCounts }).pptCounts?.buruh || 0,
        PPT_LANSIA: (item as unknown as { pptCounts?: KategoriCounts }).pptCounts?.lansia || 0,
        PPT_VETERAN: (item as unknown as { pptCounts?: KategoriCounts }).pptCounts?.veteran || 0,
        PPT_DISABILITAS: (item as unknown as { pptCounts?: KategoriCounts }).pptCounts?.disabilitas || 0,
        TOTAL_TURUN: item.penumpangTurun || 0,
        TOTAL_TRANSIT: item.penumpangTransit || 0,
        TOTAL_PPT: item.penumpangPPT || 0,
        KETERANGAN: item.keterangan || '-',
        CREATED_AT: nowTs,
        CREATED_BY: petugasNama,
        UPDATED_AT: nowTs,
        UPDATED_BY: petugasNama,
      };
    });

    const ringkasRit = hitungRingkasanRitPram(currentRiw, tanggal, lb, rit, idPerjalanan);

    // Gunakan Pramudi yang dipilih di Box Pramudi; fallback ke lookup Timer jika kosong
    let namaPramudiFinal = selectedPramudi?.nama || '';
    if (!namaPramudiFinal) {
      try {
        const tmRes = await fetch(
          `${API_TIMER}?idPerjalanan=${encodeURIComponent(idPerjalanan)}&t=${Date.now()}`
        );
        const tmTxt = await tmRes.text();
        const tmJson = JSON.parse(tmTxt) as TimerLookupData;
        if (tmJson?.pramudi) namaPramudiFinal = tmJson.pramudi;
      } catch {
        // ignore optional lookup error
      }
    }

    const globalRow = {
      ID_PRAMUJASA_TRANSAKSI: idPramTransaksi,
      ID_PERJALANAN: idPerjalanan,
      ID_PRAMUJASA: petugasNama,
      ID_PRAMUDI: selectedPramudi?.id || '',
      PRAMUDI: namaPramudiFinal,
      SHIFT: shift,
      ID_LOKASI: halteId,
      JAM_TIBA: jam,
      TOTAL_PNP_NAIK: ringkasRit.totalRit,
      TOTAL_PNP_TURUN: ringkasRit.totalTurunRit,
      TOTAL_PNP_TRANSIT: ringkasRit.totalTransitRit || 0,
      TOTAL_PNP_PPT: ringkasRit.totalPPTRit || 0,
      TOTAL_TUNAI: ringkasRit.totalTunai,
      TOTAL_NON_TUNAI: ringkasRit.totalNonTunai,
      TOTAL_MANUAL: 0,
      STATUS_VALIDASI: 'TERVALIDASI',
      CREATED_AT: nowTs,
      CREATED_BY: petugasNama,
      KETERANGAN: ketVal,
      UPDATED_AT: nowTs,
      UPDATED_BY: petugasNama,
    };

    const payload = {
      action: 'savePramujasa',
      tanggal,
      sheetGlobal: 'DATA_PRAMUJASA',
      sheetDetail: `DETAIL_${tglCompact}`,
      globalData: globalRow,
      detailList: listDetailKirim,
    };

    setSending(true);
    setGlobalLoading(true);

    let lokasiTiba = ritInfo?.terminalAkhir || '';
    if (!lokasiTiba && ritInfo?.terminal) {
      const upAwal = ritInfo.terminal.toUpperCase().trim();
      if (upAwal === 'BUKATEJA') lokasiTiba = 'BULUPITU';
      else if (upAwal === 'BULUPITU') lokasiTiba = 'BUKATEJA';
    }
    if (!lokasiTiba) {
      lokasiTiba = arahAktif === 'BP' ? 'BULUPITU' : 'BUKATEJA';
    }

    const ritNum = parseInt(rit.replace(/[^0-9]/g, ''), 10);
    const ritTampil = isNaN(ritNum) ? rit : String(ritNum);
    const busNum = parseInt(lb.replace(/[^0-9]/g, ''), 10);
    const busTampil = isNaN(busNum) ? lb : String(busNum);
    const jamTibaFmt = jam.replace(':', '.');

    const riwKasir = bacaStorage<KasirRecord>(STORAGE_KASIR_KEY);
    const barangList: string[] = [];
    for (const rk of riwKasir) {
      if (
        rk?.adaLostFound &&
        rk.lostFoundData?.ID_PERJALANAN === idPerjalanan &&
        rk.lostFoundData.NMA_BARANG
      ) {
        barangList.push(rk.lostFoundData.NMA_BARANG);
      }
    }

    const waText =
      `✅ *TEMAN ANTENG - VALIDASI PRAMUJASA*\n` +
      `Lokasi tiba : ${lokasiTiba}\n` +
      `Rit : ${ritTampil} | Bus : ${busTampil}\n` +
      `ID_PERJALANAN ${idPerjalanan}\n` +
      `Pnp E-ticketing : ${ringkasRit.totalNonTunai}\n` +
      `Pnp Transit : ${ringkasRit.totalTransitRit || 0}\n` +
      `Pnp PPT : ${ringkasRit.totalPPTRit || 0}\n` +
      `Total pnp : ${ringkasRit.totalRit}\n` +
      `Pnp Turun : ${ringkasRit.totalTurunRit}\n` +
      `Jam tiba : ${jamTibaFmt}\n` +
      `Pramujasa : ${petugasNama}\n` +
      `Pramudi : ${namaPramudiFinal}\n` +
      `Ket : ${ketVal !== '-' ? ketVal : ''}\n` +
      `Barang tertinggal: ${barangList.join(', ')}`;

    try {
      await fetch(API_PRAMUJASA, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload),
      });

      const latest = bacaStorage<PramujasaRecord>(STORAGE_PRAM_KEY);
      const sentIds = new Set(unsentItems.map((u) => u.idDetail));
      const updated = latest.map((item) =>
        item.idPerjalanan === idPerjalanan && sentIds.has(item.idDetail)
          ? { ...item, idTransaksi: idPramTransaksi, status: 'TERVALIDASI' as const }
          : item
      );
      markSavedIdPerjalanan(IDS_PRAM_KEY, idPerjalanan);
      tulisStorage(STORAGE_PRAM_KEY, updated);
      setRiwayat(updated);
      setLastWaMsg(waText);
      showToast(
        `Data 1 rit (${listDetailKirim.length} halte) tervalidasi & dikirim ke database!`,
        'ok'
      );
    } catch {
      const latest = bacaStorage<PramujasaRecord>(STORAGE_PRAM_KEY);
      const unsentIds = new Set(unsentItems.map((u) => u.idDetail));
      const updated = latest.map((item) =>
        item.idPerjalanan === idPerjalanan && unsentIds.has(item.idDetail)
          ? { ...item, status: 'GAGAL_KIRIM' as const }
          : item
      );
      tulisStorage(STORAGE_PRAM_KEY, updated);
      setRiwayat(updated);
      showToast(
        'Gagal terhubung ke server. Data tersimpan di transaksi sementara (GAGAL_KIRIM) dan siap dikirim ulang.',
        'err'
      );
    } finally {
      setSending(false);
      setGlobalLoading(false);
    }
  };

  const handleReset = () => {
    bersihkanInputHalte();
    setJamTiba(jamSekarangHHMM());
    setLastWaMsg('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <div className="max-w-xl mx-auto bg-white min-h-screen shadow-sm border-x border-slate-200 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white p-5 rounded-b-3xl flex items-center gap-4 relative shadow-sm">
          <BrandLogo className="w-16 h-16 p-1 border-2 border-white/80" />
          <div className="pr-10">
            <h2 className="text-xl font-extrabold leading-tight">Selamat Bekerja {petugasNama}</h2>
            <p className="text-sm text-white/90 font-medium">
              Isi jumlah penumpang Tunai &amp; Non-Tunai di kolom kategori halte!
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
            <p className="text-sm font-bold text-slate-500">Petugas Pramujasa</p>
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

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">Koridor</label>
              <select
                value={koridor}
                onChange={(e) => setKoridor(e.target.value)}
                className="w-full px-2 py-3 rounded-xl border-2 border-slate-800 font-bold text-center bg-white"
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
                className="w-full px-2 py-3 rounded-xl border-2 border-slate-800 font-bold text-center bg-white"
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
                onChange={(e) => setRit(e.target.value)}
                className="w-full px-2 py-3 rounded-xl border-2 border-slate-800 font-bold text-center bg-white"
              >
                {LIST_RIT.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ===== PANEL CADANGAN LBC01 — muncul otomatis kalau LB = LBC01 ===== */}
          {tampilPanelCadangan && (
            <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-3.5 space-y-2.5">
              <p className="font-extrabold text-amber-900">🚌 ARMADA CADANGAN AKTIF — {lb}</p>
              <p className="text-xs text-amber-800">Bus ini menggantikan bus reguler. Lengkapi keterangan pengganti di bawah.</p>
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">Status Perjalanan</label>
                <select value={statusPerjalanan} onChange={(e) => setStatusPerjalanan(e.target.value)} className="w-full px-2 py-3 rounded-xl border-2 border-slate-800 font-bold text-center bg-white">
                  <option value="PENGGANTI">PENGGANTI</option>
                  <option value="LANJUTAN_SETELAH_PERBAIKAN">LANJUTAN_SETELAH_PERBAIKAN</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">Menggantikan Bus (ID Perjalanan Asal)</label>
                <input type="text" placeholder="Contoh: KOR01-LB05R0320261127" value={idPerjalananAsal} onChange={(e) => setIdPerjalananAsal(e.target.value)} className="w-full px-3 py-3 rounded-xl border-2 border-slate-800 bg-white font-mono-num font-bold text-center" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">Titik Ganti</label>
                  <select value={titikGanti} onChange={(e) => setTitikGanti(e.target.value)} className="w-full px-2 py-3 rounded-xl border-2 border-slate-800 font-bold text-center bg-white">
                    <option value="TERMINAL_AWAL">TERMINAL_AWAL</option>
                    <option value="TENGAH_JALAN">TENGAH_JALAN</option>
                    <option value="AKHIR_RIT">AKHIR_RIT</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">Halte Titik Ganti</label>
                  <input type="text" placeholder="Nama halte (jika tengah jalan)" value={halteTitikGanti} onChange={(e) => setHalteTitikGanti(e.target.value)} className="w-full px-3 py-3 rounded-xl border-2 border-slate-800 bg-white font-bold text-center" />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-extrabold text-center text-slate-700 mb-1">
              ID_PERJALANAN
            </label>
            <input
              type="text"
              value={idPerjalanan}
              readOnly
              className="w-full px-3 py-3 rounded-xl border-2 border-emerald-600 bg-emerald-50 font-mono-num font-extrabold text-center text-emerald-950 text-lg"
            />
            {sudahTersimpan && (
              <div className="mt-2 rounded-xl border-2 border-red-300 bg-red-50 px-3 py-2 text-center text-xs font-extrabold text-red-800">
                ID_PERJALANAN SUDAH ADA ({idPerjalanan})
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">Shift</label>
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value)}
                className="w-full px-3 py-3 rounded-xl border-2 border-slate-800 font-bold text-center bg-white"
              >
                <option value="SHIFT 1">Shift 1</option>
                <option value="SHIFT 2">Shift 2</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">
                Jam Tiba Halte
              </label>
              <input
                type="time"
                value={jamTiba}
                onChange={(e) => {
                  setJamTiba(e.target.value);
                  setJamManual(true);
                }}
                className="w-full px-3 py-3 rounded-xl border-2 border-slate-800 bg-rose-50 font-mono-num font-bold text-center"
              />
            </div>
          </div>

          {/* BOX PRAMUDI (DARI MASTER_PRAMUDI) */}
          <div>
            <label className="block text-xs font-extrabold text-slate-700 mb-1">
              Pramudi (Dari MASTER_PRAMUDI)
            </label>
            <select
              value={selectedPramudiId}
              onChange={(e) => setSelectedPramudiId(e.target.value)}
              className="w-full px-3 py-3 rounded-xl border-2 border-slate-800 font-bold text-center bg-white"
            >
              {masterPramudi.length === 0 ? (
                <option value="">Memuat daftar Pramudi...</option>
              ) : (
                masterPramudi.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id} - {p.nama}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* DROPDOWN NAMA HALTE SEARAH (MASTER_HALTE + ACUAN ARAH MASTER_RIT) */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <label className="text-xs font-extrabold text-slate-700">
                Nama Halte (Searah · {halteSearah.length} halte)
              </label>
              <span className="text-xs font-extrabold text-emerald-800">
                Arah: {arahLabel}
              </span>
            </div>

            {butuhArahManual && (
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setManualArah('BP')}
                  className={`py-2 px-3 rounded-xl text-xs font-extrabold border-2 cursor-pointer ${
                    manualArah === 'BP'
                      ? 'bg-emerald-600 text-white border-emerald-700'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  Arah BP (Bulupitu)
                </button>
                <button
                  type="button"
                  onClick={() => setManualArah('BK')}
                  className={`py-2 px-3 rounded-xl text-xs font-extrabold border-2 cursor-pointer ${
                    manualArah === 'BK'
                      ? 'bg-emerald-600 text-white border-emerald-700'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  Arah BK (Bukateja)
                </button>
              </div>
            )}

            <select
              value={selectedHalte?.id || ''}
              onChange={(e) => setSelectedHalteId(e.target.value)}
              className="w-full px-3 py-3 rounded-xl border-2 border-slate-800 font-bold text-center bg-white"
            >
              {halteSearah.map((h, idx) => (
                <option key={h.id} value={h.id}>
                  {idx + 1}. {h.nama} ({h.id} · {h.arah})
                </option>
              ))}
            </select>
          </div>

          {/* INPUT PENUMPANG HALTE INI (PER JENIS) — 4 blok lipat, sesuai screenshot */}
          <div className="bg-white border-2 border-slate-300 rounded-2xl p-3.5 space-y-2.5">
            <div className="text-center">
              <h4 className="text-sm font-extrabold text-slate-900">
                INPUT PENUMPANG HALTE INI (PER JENIS)
              </h4>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                Ketuk jenis untuk membuka / menutup isinya
              </p>
            </div>

            {/* PNP TUNAI */}
            <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 overflow-hidden">
              <button type="button" onClick={() => toggleJenis('tunai')} className="w-full flex justify-between items-center px-3 py-3 cursor-pointer">
                <span className="font-extrabold text-emerald-900">PNP TUNAI</span>
                <span className="text-sm font-bold text-slate-700">{subtotalHalte.subTunai} org {openJenis.tunai ? '▲ Sembunyikan' : '▼ Lihat'}</span>
              </button>
              {openJenis.tunai && (
                <div className="px-3 pb-3 space-y-2">
                  {KATEGORI_LIST.map((kat) => (
                    <div key={`tunai-${kat.key}`} className="flex items-center justify-between gap-3">
                      <label className="text-sm font-bold text-slate-800">{kat.label}</label>
                      <input type="number" min={0} placeholder="0" value={tunaiInputs[kat.key]} onChange={(e) => updateKategoriInput('tunai', kat.key, e.target.value)} className="w-40 px-2 py-2.5 rounded-xl border-2 border-slate-700 bg-white font-mono-num font-extrabold text-center text-lg text-slate-900" />
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 border-t border-emerald-200 text-sm font-extrabold text-emerald-950"><span>Subtotal TUNAI:</span><span className="font-mono-num">{subtotalHalte.subTunai} org</span></div>
                </div>
              )}
            </div>

            {/* PNP NON-TUNAI */}
            <div className="rounded-2xl border-2 border-violet-200 bg-violet-50 overflow-hidden">
              <button type="button" onClick={() => toggleJenis('nonTunai')} className="w-full flex justify-between items-center px-3 py-3 cursor-pointer">
                <span className="font-extrabold text-violet-900">PNP NON-TUNAI</span>
                <span className="text-sm font-bold text-slate-700">{subtotalHalte.subNonTunai} org {openJenis.nonTunai ? '▲ Sembunyikan' : '▼ Lihat'}</span>
              </button>
              {openJenis.nonTunai && (
                <div className="px-3 pb-3 space-y-2">
                  {KATEGORI_LIST.map((kat) => (
                    <div key={`nt-${kat.key}`} className="flex items-center justify-between gap-3">
                      <label className="text-sm font-bold text-slate-800">{kat.label}</label>
                      <input type="number" min={0} placeholder="0" value={nonTunaiInputs[kat.key]} onChange={(e) => updateKategoriInput('nonTunai', kat.key, e.target.value)} className="w-40 px-2 py-2.5 rounded-xl border-2 border-slate-700 bg-white font-mono-num font-extrabold text-center text-lg text-slate-900" />
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 border-t border-violet-200 text-sm font-extrabold text-violet-950"><span>Subtotal NON-TUNAI:</span><span className="font-mono-num">{subtotalHalte.subNonTunai} org</span></div>
                </div>
              )}
            </div>

            {/* PNP MANUAL */}
            <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 overflow-hidden">
              <button type="button" onClick={() => toggleJenis('manual')} className="w-full flex justify-between items-center px-3 py-3 cursor-pointer">
                <span className="font-extrabold text-amber-900">PNP MANUAL</span>
                <span className="text-sm font-bold text-slate-700">{subtotalHalte.subManual} org {openJenis.manual ? '▲ Sembunyikan' : '▼ Lihat'}</span>
              </button>
              {openJenis.manual && (
                <div className="px-3 pb-3 space-y-2">
                  {KATEGORI_LIST.map((kat) => (
                    <div key={`man-${kat.key}`} className="flex items-center justify-between gap-3">
                      <label className="text-sm font-bold text-slate-800">{kat.label}</label>
                      <input type="number" min={0} placeholder="0" value={manualInputs[kat.key]} onChange={(e) => updateKategoriInput('manual', kat.key, e.target.value)} className="w-40 px-2 py-2.5 rounded-xl border-2 border-slate-700 bg-white font-mono-num font-extrabold text-center text-lg text-slate-900" />
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 border-t border-amber-200 text-sm font-extrabold text-amber-950"><span>Subtotal MANUAL:</span><span className="font-mono-num">{subtotalHalte.subManual} org</span></div>
                </div>
              )}
            </div>

            {/* PNP PPT */}
            <div className="rounded-2xl border-2 border-sky-200 bg-sky-50 overflow-hidden">
              <button type="button" onClick={() => toggleJenis('ppt')} className="w-full flex justify-between items-center px-3 py-3 cursor-pointer">
                <span className="font-extrabold text-sky-900">PNP PPT</span>
                <span className="text-sm font-bold text-slate-700">{subtotalHalte.subPPT} org {openJenis.ppt ? '▲ Sembunyikan' : '▼ Lihat'}</span>
              </button>
              {openJenis.ppt && (
                <div className="px-3 pb-3 space-y-2">
                  {KATEGORI_LIST.map((kat) => (
                    <div key={`ppt-${kat.key}`} className="flex items-center justify-between gap-3">
                      <label className="text-sm font-bold text-slate-800">{kat.label}</label>
                      <input type="number" min={0} placeholder="0" value={pptInputs[kat.key]} onChange={(e) => updateKategoriInput('ppt', kat.key, e.target.value)} className="w-40 px-2 py-2.5 rounded-xl border-2 border-slate-700 bg-white font-mono-num font-extrabold text-center text-lg text-slate-900" />
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 border-t border-sky-200 text-sm font-extrabold text-sky-950"><span>Subtotal PPT:</span><span className="font-mono-num">{subtotalHalte.subPPT} org</span></div>
                </div>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs font-extrabold text-blue-950 space-y-1">
              <div className="flex justify-between"><span>Subtotal Tunai Halte Ini:</span><span className="font-mono-num">{subtotalHalte.subTunai} org</span></div>
              <div className="flex justify-between"><span>Subtotal Non-Tunai Halte Ini:</span><span className="font-mono-num">{subtotalHalte.subNonTunai} org</span></div>
              <div className="flex justify-between"><span>Subtotal Manual Halte Ini:</span><span className="font-mono-num">{subtotalHalte.subManual} org</span></div>
              <div className="flex justify-between"><span>Subtotal PPT Halte Ini:</span><span className="font-mono-num">{subtotalHalte.subPPT} org</span></div>
              <div className="flex justify-between pt-1 border-t border-blue-200 text-sm text-red-700"><span>Total Naik Halte Ini:</span><span className="font-mono-num">{subtotalHalte.total} org</span></div>
              <div className="flex justify-between text-sm text-sky-800"><span>Total PPT Halte Ini:</span><span className="font-mono-num">{subtotalHalte.totalPPT} org</span></div>
            </div>
          </div>

          {/* Pnp Turun + Transit (PPT sekarang dari blok PNP PPT di atas, bukan kotak terpisah) */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">Pnp Turun</label>
              <input type="number" min={0} placeholder="0" value={turunHalte} onChange={(e) => setTurunHalte(e.target.value)} className="w-full px-2 sm:px-3 py-3 rounded-xl border-2 border-slate-800 bg-rose-50 font-mono-num font-bold text-center text-lg" />
            </div>
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">Pnp Transit</label>
              <input type="number" min={0} placeholder="0" value={transitHalte} onChange={(e) => setTransitHalte(e.target.value)} className="w-full px-2 sm:px-3 py-3 rounded-xl border-2 border-slate-800 bg-amber-50 font-mono-num font-bold text-center text-lg" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-extrabold text-slate-700 mb-1">
              Keterangan (Opsional)
            </label>
            <input
              type="text"
              placeholder="Catatan halte..."
              value={ket}
              onChange={(e) => setKet(e.target.value)}
              className="w-full px-3 py-3 rounded-xl border-2 border-slate-800 bg-white font-bold text-left text-base"
            />
          </div>

          {/* AKUMULASI TOTAL SELAMA 1 RIT */}
          <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-4 space-y-3">
            <div className="text-center font-extrabold text-emerald-900 text-sm">
              AKUMULASI TOTAL SELAMA 1 RIT ({idPerjalanan})
            </div>

            <div>
              <div className="text-xs font-extrabold text-emerald-800 mb-1.5">
                Rincian Pnp Tunai (Tersimpan: {ringkasRitTersimpan.totalTunai})
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {KATEGORI_LIST.map((k) => (
                  <div
                    key={`t-${k.key}`}
                    className="bg-white border border-emerald-200 rounded-lg px-2.5 py-1.5 flex justify-between items-center text-xs font-bold"
                  >
                    <span>{k.label}</span>
                    <span className="font-mono-num font-extrabold">
                      {ringkasRitTersimpan.tunai[k.key]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-extrabold text-emerald-800 mb-1.5">
                Rincian Pnp Non-Tunai (Tersimpan: {ringkasRitTersimpan.totalNonTunai})
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {KATEGORI_LIST.map((k) => (
                  <div
                    key={`nt-${k.key}`}
                    className="bg-white border border-emerald-200 rounded-lg px-2.5 py-1.5 flex justify-between items-center text-xs font-bold"
                  >
                    <span>{k.label}</span>
                    <span className="font-mono-num font-extrabold">
                      {ringkasRitTersimpan.nonTunai[k.key]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-extrabold text-emerald-800 mb-1.5">
                Rincian Pnp Manual (Tersimpan: {manualPptTersimpan.manual})
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {KATEGORI_LIST.map((k) => {
                  let v = 0;
                  for (const d of riwayat) {
                    if (!d || d.idPerjalanan !== idPerjalanan) continue;
                    v += Math.max(0, (d as unknown as { manual?: KategoriCounts }).manual?.[k.key] || 0);
                  }
                  return (
                    <div key={`man-${k.key}`} className="bg-white border border-emerald-200 rounded-lg px-2.5 py-1.5 flex justify-between items-center text-xs font-bold">
                      <span>{k.label}</span><span className="font-mono-num font-extrabold">{v}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-xs font-extrabold text-emerald-800 mb-1.5">
                Rincian Pnp PPT (Tersimpan: {manualPptTersimpan.ppt})
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {KATEGORI_LIST.map((k) => {
                  let v = 0;
                  for (const d of riwayat) {
                    if (!d || d.idPerjalanan !== idPerjalanan) continue;
                    v += Math.max(0, (d as unknown as { pptCounts?: KategoriCounts }).pptCounts?.[k.key] || 0);
                  }
                  return (
                    <div key={`ppt-${k.key}`} className="bg-white border border-emerald-200 rounded-lg px-2.5 py-1.5 flex justify-between items-center text-xs font-bold">
                      <span>{k.label}</span><span className="font-mono-num font-extrabold">{v}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-emerald-200/80 border-2 border-emerald-500 rounded-xl p-2.5 text-center font-extrabold text-emerald-950 text-base">
              Total Rit Tersimpan:{' '}
              <span className="font-mono-num">{ringkasRitTersimpan.totalRit}</span> org · Turun:{' '}
              <span className="font-mono-num">{ringkasRitTersimpan.totalTurunRit}</span> org · Transit:{' '}
              <span className="font-mono-num">{ringkasRitTersimpan.totalTransitRit || 0}</span> org · PPT:{' '}
              <span className="font-mono-num">{ringkasRitTersimpan.totalPPTRit || 0}</span> org
            </div>
          </div>

          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              disabled={sending}
              onClick={handleSimpanSementara}
              className={`w-full py-4 rounded-2xl font-extrabold text-base cursor-pointer disabled:opacity-60 ${
                sudahTersimpan
                  ? 'bg-red-700 hover:bg-red-800 text-white'
                  : 'bg-amber-500 hover:bg-amber-600 text-amber-950'
              }`}
            >
              {sudahTersimpan ? 'ID_PERJALANAN SUDAH ADA' : 'SIMPAN SEMENTARA (Halte Ini)'}
            </button>

            {/* TEKS KLIK: LIHAT TRANSAKSI SEMENTARA PER HALTE */}
            <div className="text-center py-1">
              <button
                type="button"
                onClick={() => setShowSementara((v) => !v)}
                className="text-amber-800 hover:text-amber-950 font-extrabold underline text-sm cursor-pointer"
              >
                {showSementara
                  ? 'Sembunyikan Transaksi Sementara'
                  : 'Lihat Transaksi Sementara'}
              </button>
              <span className="ml-2 text-xs font-bold text-slate-600">
                ({transaksiSementaraPerHalte.length} halte sementara)
              </span>
            </div>

            {showSementara && (
              <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-amber-950 text-sm">
                    TRANSAKSI SEMENTARA PER HALTE ({idPerjalanan})
                  </span>
                  <span className="text-xs font-bold text-amber-900">
                    {transaksiSementaraPerHalte.length} halte
                  </span>
                </div>

                {transaksiSementaraPerHalte.length === 0 ? (
                  <p className="text-center text-sm text-amber-800/80 py-3 font-medium">
                    Belum ada transaksi sementara per halte pada rit ini
                  </p>
                ) : (
                  transaksiSementaraPerHalte.map((d) => {
                    const norm = normalizePramRecord(d);
                    return (
                      <div
                        key={d.idDetail}
                        className="bg-white border border-amber-200 rounded-xl p-3 text-xs space-y-1.5"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <div className="font-extrabold text-sm text-slate-900">
                              {d.namaHalte} ({d.idHalte})
                            </div>
                            <div className="text-slate-500 font-mono-num">
                              {d.noLambung} | {d.rit} · Jam {d.jamTiba || d.waktuKirim}
                              {d.namaPramudi ? ` · Pramudi: ${d.namaPramudi}` : ''}
                            </div>
                          </div>
                          <span
                            className={`font-extrabold ${
                              d.status === 'GAGAL_KIRIM' ? 'text-red-700' : 'text-amber-700'
                            }`}
                          >
                            {d.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 bg-slate-50 rounded-lg p-2 border border-slate-200">
                          <div>
                            <div className="font-extrabold text-emerald-800 mb-0.5">
                              Tunai ({norm.totalTunai} org)
                            </div>
                            <div className="text-[11px] text-slate-700 leading-relaxed">
                              Umum {norm.tunai.umum} · Buruh {norm.tunai.buruh} · Pelajar{' '}
                              {norm.tunai.pelajar} · Lansia {norm.tunai.lansia} · Disab{' '}
                              {norm.tunai.disabilitas} · Vet {norm.tunai.veteran}
                            </div>
                          </div>
                          <div>
                            <div className="font-extrabold text-violet-800 mb-0.5">
                              Non-Tunai ({norm.totalNonTunai} org)
                            </div>
                            <div className="text-[11px] text-slate-700 leading-relaxed">
                              Umum {norm.nonTunai.umum} · Buruh {norm.nonTunai.buruh} · Pelajar{' '}
                              {norm.nonTunai.pelajar} · Lansia {norm.nonTunai.lansia} · Disab{' '}
                              {norm.nonTunai.disabilitas} · Vet {norm.nonTunai.veteran}
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-0.5">
                          <span className="font-bold text-slate-700">
                            Total Naik: <b>{norm.totalHalte}</b> org · Turun:{' '}
                            <b>{d.penumpangTurun}</b> org · Transit:{' '}
                            <b>{d.penumpangTransit || 0}</b> org · PPT:{' '}
                            <b>{d.penumpangPPT || 0}</b> org
                            {d.keterangan && d.keterangan !== '-' ? ` · Ket: ${d.keterangan}` : ''}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleHapusDraft(d.idDetail)}
                            className="inline-flex items-center gap-1 font-bold text-red-600 hover:underline cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Hapus
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            <button
              type="button"
              disabled={sending}
              onClick={() => void handleValidasiKirim()}
              className={`w-full py-4 rounded-2xl text-white font-extrabold text-lg cursor-pointer disabled:opacity-60 ${
                sudahTersimpan
                  ? 'bg-red-700 hover:bg-red-800'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {sending
                ? 'MENGIRIM KE DATABASE...'
                : sudahTersimpan
                ? 'ID_PERJALANAN SUDAH ADA'
                : `VALIDASI & KIRIM (${unsentCountRit} Draft${subtotalHalte.total > 0 || Number(turunHalte) > 0 || Number(transitHalte) > 0 || Number(pptHalte) > 0 ? ' + Halte Ini' : ''})`}
            </button>

            {/* LMB — di antara VALIDASI & KIRIM dan BARANG TERTINGGAL */}
            <button
              type="button"
              onClick={() => setShowLMB((v) => !v)}
              className="w-full py-4 rounded-2xl font-extrabold text-lg text-white bg-indigo-600 hover:bg-indigo-700 cursor-pointer shadow-lg"
            >
              {showLMB ? '▲ Sembunyikan LMB (Lembar Muatan Bus)' : '🧾 Lihat LMB (Lembar Muatan Bus)'}
            </button>

            {showLMB && (
              <div className="bg-white border-2 border-indigo-300 rounded-2xl p-4 space-y-2.5">
                <div className="text-center font-extrabold text-indigo-950 text-sm">LEMBAR MUATAN BUS (LMB)</div>
                <div className="text-center text-xs font-bold text-slate-600">{idPerjalanan} · {lb} | {rit} · {tanggal}</div>
                {transaksiSementaraPerHalte.length === 0 && riwayat.filter((d) => d && d.idPerjalanan === idPerjalanan && d.status === 'TERVALIDASI').length === 0 ? (
                  <p className="text-center text-sm text-slate-500 py-3 font-medium">Belum ada halte untuk rit ini. Simpan sementara dulu 1 halte.</p>
                ) : (
                  <div className="space-y-1.5">
                    {[...riwayat].filter((d) => d && d.idPerjalanan === idPerjalanan).reverse().map((d, idx) => {
                      const norm = normalizePramRecord(d);
                      const man = (d as unknown as { manual?: KategoriCounts }).manual;
                      const pptC = (d as unknown as { pptCounts?: KategoriCounts }).pptCounts;
                      const manTotal = man ? KATEGORI_LIST.reduce((a, k) => a + (man[k.key] || 0), 0) : 0;
                      const pptTotal = pptC ? KATEGORI_LIST.reduce((a, k) => a + (pptC[k.key] || 0), 0) : (d.penumpangPPT || 0);
                      return (
                        <div key={d.idDetail} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex justify-between items-center text-xs font-bold">
                          <span>{idx + 1}. {d.namaHalte}</span>
                          <span className="font-mono-num">Tunai {norm.totalTunai} · Non-Tunai {norm.totalNonTunai} · Manual {manTotal} · PPT {pptTotal} · Turun {d.penumpangTurun || 0}</span>
                        </div>
                      );
                    })}
                    <div className="bg-indigo-100 border-2 border-indigo-400 rounded-xl p-2.5 text-center font-extrabold text-indigo-950 text-sm">
                      Total Naik Rit: {ringkasRitTersimpan.totalRit + manualPptTersimpan.manual} org · PPT: {ringkasRitTersimpan.totalPPTRit || manualPptTersimpan.ppt} org
                    </div>
                  </div>
                )}
                <button type="button" onClick={() => window.print()} className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-sm cursor-pointer">🖨️ CETAK LMB</button>
              </div>
            )}

            {/* BARANG TERTINGGAL — dikembalikan, tepat sesudah LMB */}
            <button
              type="button"
              onClick={onOpenLostFound}
              className="w-full py-4 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-extrabold text-lg flex items-center justify-center gap-2 cursor-pointer shadow-lg"
            >
              <PackageSearch className="w-5 h-5" /> BARANG TERTINGGAL
            </button>

            {/* LIHAT TRANSAKSI PER SHIFT - di antara VALIDASI & KIRIM dan BARANG TERTINGGAL */}
            <button
              type="button"
              onClick={() => setShowRekapShift((v) => !v)}
              className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-base flex items-center justify-center gap-2 cursor-pointer"
            >
              {showRekapShift ? '▲ Sembunyikan Transaksi Per Shift' : '👁️ Lihat Transaksi Per Shift'}
            </button>

            {showRekapShift && (
              <div className="bg-indigo-50 border-2 border-indigo-300 rounded-2xl p-4 space-y-3">
                <div className="text-center font-extrabold text-indigo-950 text-sm">
                  REKAP {shift} - {lb} ({koridor}) - {tanggal}
                </div>
                <div className="text-center text-xs font-bold text-indigo-900">
                  Rit sudah jalan: {rekapShift.jumlahRitJalan} rit
                  {rekapShift.perRit.length > 0 ? ` (${rekapShift.perRit.map((r) => r.rit).join(', ')})` : ' - belum ada rit tersimpan'}
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-white border border-indigo-200 rounded-xl p-2.5">
                    <div className="text-[11px] font-bold text-slate-500">TOTAL NAIK</div>
                    <div className="font-mono-num font-extrabold text-lg">{rekapShift.totalNaik} org</div>
                    <div className="text-[11px] font-bold text-slate-600">Tunai {rekapShift.totalTunai} · Non-Tunai {rekapShift.totalNonTunai}</div>
                  </div>
                  <div className="bg-white border border-indigo-200 rounded-xl p-2.5">
                    <div className="text-[11px] font-bold text-slate-500">TOTAL TURUN</div>
                    <div className="font-mono-num font-extrabold text-lg">{rekapShift.totalTurun} org</div>
                    <div className="text-[11px] font-bold text-slate-600">{rekapShift.list.length} halte tercatat</div>
                  </div>
                  <div className="bg-white border border-indigo-200 rounded-xl p-2.5">
                    <div className="text-[11px] font-bold text-slate-500">TOTAL TRANSIT</div>
                    <div className="font-mono-num font-extrabold text-lg">{rekapShift.totalTransit} org</div>
                    <div className="text-[11px] font-bold text-slate-600">{rekapShift.list.length} halte tercatat</div>
                  </div>
                  <div className="bg-white border border-indigo-200 rounded-xl p-2.5">
                    <div className="text-[11px] font-bold text-slate-500">TOTAL PPT</div>
                    <div className="font-mono-num font-extrabold text-lg">{rekapShift.totalPPT} org</div>
                    <div className="text-[11px] font-bold text-slate-600">{rekapShift.list.length} halte tercatat</div>
                  </div>
                </div>
                {rekapShift.perRit.length === 0 ? (
                  <p className="text-center text-sm text-indigo-800/80 py-2 font-medium">
                    Belum ada data tersimpan di shift ini. Rekap akan muncul otomatis setelah rit pertama disimpan.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    <div className="text-xs font-extrabold text-indigo-900">Rincian Per Rit:</div>
                    {rekapShift.perRit.map((r) => (
                      <div key={r.idPerjalanan || r.rit} className="bg-white border border-indigo-200 rounded-lg px-3 py-2 flex justify-between items-center text-xs font-bold">
                        <span>{r.rit} <span className="text-slate-500 font-medium">({r.halte} halte)</span></span>
                        <span className="font-mono-num">Naik {r.naik} · Turun {r.turun} · Transit {r.transit} · PPT {r.ppt}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {lastWaMsg && (
              <>
                <WhatsAppShareBox
                  message={lastWaMsg}
                  onCopied={(ok) =>
                    showToast(
                      ok ? 'Pesan validasi WA berhasil disalin.' : 'Gagal menyalin pesan WA.',
                      ok ? 'ok' : 'err'
                    )
                  }
                />
                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full py-3.5 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-extrabold text-base cursor-pointer"
                >
                  INPUT HALTE / BUS BERIKUTNYA
                </button>
              </>
            )}


          </div>

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => setShowRiwayat((v) => !v)}
              className="text-blue-600 font-extrabold underline text-sm cursor-pointer"
            >
              {showRiwayat ? 'Sembunyikan Riwayat Pramujasa' : 'Lihat Riwayat Pramujasa'}
            </button>
            <span className="ml-2 text-xs font-bold text-slate-600">
              ({todayRiwayat.length} data hari ini)
            </span>
          </div>

          {showRiwayat && (
            <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="font-extrabold text-slate-900">RIWAYAT PRAMUJASA</span>
                <span className="text-xs font-bold text-slate-600">{todayRiwayat.length} data</span>
              </div>
              {todayRiwayat.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-4">
                  Belum ada data Pramujasa hari ini
                </p>
              ) : (
                todayRiwayat.map((d) => {
                  const norm = normalizePramRecord(d);
                  return (
                    <div
                      key={d.idDetail}
                      className="bg-white border border-slate-300 rounded-xl p-3 text-sm space-y-1"
                    >
                      <div className="flex justify-between items-center gap-2">
                        <span className="font-extrabold text-slate-900">
                          {d.noLambung} | {d.rit} - {d.namaHalte}
                        </span>
                        <span
                          className={`text-xs font-extrabold ${
                            d.status === 'TERVALIDASI'
                              ? 'text-emerald-700'
                              : d.status === 'GAGAL_KIRIM'
                              ? 'text-red-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {d.status}
                        </span>
                      </div>
                      <div className="text-xs font-mono-num text-slate-500">
                        {d.idPerjalanan} · Jam {d.waktuKirim}
                        {d.namaPramudi ? ` · Pramudi: ${d.namaPramudi}` : ''}
                      </div>
                      <div className="text-xs text-slate-700 font-semibold">
                        Tunai: <b>{norm.totalTunai}</b> · Non-Tunai: <b>{norm.totalNonTunai}</b> ·
                        Total Naik: <b>{norm.totalHalte}</b> · Turun: <b>{d.penumpangTurun}</b> · Transit: <b>{d.penumpangTransit || 0}</b> · PPT: <b>{d.penumpangPPT || 0}</b>
                      </div>
                      {d.status !== 'TERVALIDASI' && (
                        <button
                          type="button"
                          onClick={() => handleHapusDraft(d.idDetail)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:underline mt-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Hapus Draft Lokal
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
