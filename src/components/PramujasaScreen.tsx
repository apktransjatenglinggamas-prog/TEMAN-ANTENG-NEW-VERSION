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
    () => `${koridor}-${lb}${rit}${tanggal.split('-').join('')}`,
    [koridor, lb, rit, tanggal]
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
    for (const k of KATEGORI_LIST) {
      subTunai += Math.max(0, tunaiInputs[k.key] || 0);
      subNonTunai += Math.max(0, nonTunaiInputs[k.key] || 0);
    }
    return {
      subTunai,
      subNonTunai,
      total: subTunai + subNonTunai,
    };
  }, [tunaiInputs, nonTunaiInputs]);

  // Akumulasi selama 1 Rit (data tersimpan di rit ini)
  const ringkasRitTersimpan = useMemo(
    () => hitungRingkasanRitPram(riwayat, tanggal, lb, rit, idPerjalanan),
    [riwayat, tanggal, lb, rit, idPerjalanan]
  );

  // REKAP 1 SHIFT: total gabungan semua rit dalam 1 shift
  // Bisa dilihat walau baru jalan 1, 2, atau 3 rit - totalnya nambah live
  // Shift 1 = R01-R04, Shift 2 = R05-R08
  // UPGRADE dari file _2: ditambah totalTransit & totalPPT + perRit transit/ppt
  const [showLmb, setShowLmb] = useState(false);

  // Data LMB: Filter riwayat persis 1 rit aktif (idPerjalanan)
  // dan hanya halte yang bertransaksi (adaTransaksi)
  const lmbData = useMemo(() => {
    const listRaw = riwayat.filter((d) => {
      if (!d) return false;
      if (d.idPerjalanan !== idPerjalanan) return false;
      return true;
    });

    // Filter hanya halte yang punya transaksi (adaTransaksi)
    const filteredHalte = [];
    let totalNaik = 0, totalTurun = 0, totalTransit = 0, totalPPT = 0;
    const catTotalTunai = emptyKategoriCounts();
    const catTotalNonTunai = emptyKategoriCounts();

    for (const d of listRaw) {
      const norm = normalizePramRecord(d);
      const adaTx =
        (norm.totalHalte || 0) > 0 ||
        (d.penumpangTurun || 0) > 0 ||
        (d.penumpangTransit || 0) > 0 ||
        (d.penumpangPPT || 0) > 0;

      if (adaTx) {
        filteredHalte.push({ ...d, norm });
        totalNaik += norm.totalHalte || 0;
        totalTurun += d.penumpangTurun || 0;
        totalTransit += d.penumpangTransit || 0;
        totalPPT += d.penumpangPPT || 0;

        for (const k of KATEGORI_LIST) {
          catTotalTunai[k.key] += norm.tunai[k.key] || 0;
          catTotalNonTunai[k.key] += norm.nonTunai[k.key] || 0;
        }
      }
    }

    return {
      list: filteredHalte,
      jumlahHalte: filteredHalte.length,
      totalNaik,
      totalTurun,
      totalTransit,
      totalPPT,
      catTotalTunai,
      catTotalNonTunai,
      totalTunaiGlobal: Object.values(catTotalTunai).reduce((a, b) => a + b, 0),
      totalNonTunaiGlobal: Object.values(catTotalNonTunai).reduce((a, b) => a + b, 0),
    };
  }, [riwayat, idPerjalanan]);

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
    jenis: 'tunai' | 'nonTunai',
    key: KategoriKey,
    rawVal: string
  ) => {
    const num = Math.max(0, parseInt(rawVal, 10) || 0);
    if (jenis === 'tunai') {
      setTunaiInputs((prev) => ({ ...prev, [key]: num }));
    } else {
      setNonTunaiInputs((prev) => ({ ...prev, [key]: num }));
    }
  };

  const bersihkanInputHalte = () => {
    setTunaiInputs(emptyKategoriCounts());
    setNonTunaiInputs(emptyKategoriCounts());
    setTurunHalte('0');
    setTransitHalte('0');
    setPptHalte('0');
    setKet('');
    setJamManual(false);
  };

  const handleSimpanSementara = () => {
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
    const pptNum = Math.max(0, parseInt(pptHalte, 10) || 0);
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
      penumpangTurun: turunNum,
      penumpangTransit: transitNum,
      penumpangPPT: pptNum,
      keterangan: ket.trim() || '-',
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
    const pptNum = Math.max(0, parseInt(pptHalte, 10) || 0);
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
        MANUAL_UMUM: 0,
        MANUAL_PELAJAR: 0,
        MANUAL_BURUH: 0,
        MANUAL_LANSIA: 0,
        MANUAL_VETERAN: 0,
        MANUAL_DISABILITAS: 0,
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
    setTanggal(tglHariIni());
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

          {/* KOLOM INPUT KATEGORI PENUMPANG (MODEL KASIR: TUNAI & NON-TUNAI BERDAMPINGAN) */}
          <div className="bg-white border-2 border-slate-300 rounded-2xl p-3.5 space-y-2.5">
            <div className="text-center">
              <h4 className="text-sm font-extrabold text-slate-900">
                INPUT PENUMPANG HALTE INI (PER KATEGORI)
              </h4>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                Isi kolom Tunai &amp; Non-Tunai secara langsung untuk setiap kategori
              </p>
            </div>

            {KATEGORI_LIST.map((kat) => (
              <div
                key={kat.key}
                className="bg-slate-50 border border-slate-200 rounded-xl p-2.5"
              >
                <div className="text-sm font-extrabold text-slate-800 mb-2">{kat.label}</div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-extrabold text-emerald-800 mb-1">
                      Pnp Tunai
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={tunaiInputs[kat.key]}
                      onChange={(e) => updateKategoriInput('tunai', kat.key, e.target.value)}
                      className="w-full px-2 py-2.5 rounded-xl border-2 border-slate-700 bg-white font-mono-num font-extrabold text-center text-base text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-extrabold text-violet-800 mb-1">
                      Pnp Non-Tunai
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={nonTunaiInputs[kat.key]}
                      onChange={(e) => updateKategoriInput('nonTunai', kat.key, e.target.value)}
                      className="w-full px-2 py-2.5 rounded-xl border-2 border-slate-700 bg-white font-mono-num font-extrabold text-center text-base text-slate-900"
                    />
                  </div>
                </div>
              </div>
            ))}

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs font-extrabold text-blue-950 space-y-1">
              <div className="flex justify-between">
                <span>Subtotal Tunai Halte Ini:</span>
                <span className="font-mono-num">{subtotalHalte.subTunai} org</span>
              </div>
              <div className="flex justify-between">
                <span>Subtotal Non-Tunai Halte Ini:</span>
                <span className="font-mono-num">{subtotalHalte.subNonTunai} org</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-blue-200 text-sm text-red-700">
                <span>Total Penumpang Halte Ini:</span>
                <span className="font-mono-num">{subtotalHalte.total} org</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">
                Pnp Turun
              </label>
              <input
                type="number"
                min={0}
                value={turunHalte}
                onChange={(e) => setTurunHalte(e.target.value)}
                className="w-full px-2 sm:px-3 py-3 rounded-xl border-2 border-slate-800 bg-rose-50 font-mono-num font-bold text-center text-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">
                Pnp Transit
              </label>
              <input
                type="number"
                min={0}
                value={transitHalte}
                onChange={(e) => setTransitHalte(e.target.value)}
                className="w-full px-2 sm:px-3 py-3 rounded-xl border-2 border-slate-800 bg-amber-50 font-mono-num font-bold text-center text-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">
                Pnp PPT
              </label>
              <input
                type="number"
                min={0}
                value={pptHalte}
                onChange={(e) => setPptHalte(e.target.value)}
                className="w-full px-2 sm:px-3 py-3 rounded-xl border-2 border-slate-800 bg-sky-50 font-mono-num font-bold text-center text-lg"
              />
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

            {/* FITUR BARU: LMB (Lembar Muatan Bus) MENGGANTIKAN LIHAT TRANSAKSI PER RIT */}
            <button
              type="button"
              onClick={() => setShowLmb((v) => !v)}
              className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-base flex items-center justify-center gap-2 cursor-pointer"
            >
              {showLmb ? '▲ Sembunyikan Lembar Muatan Bus (LMB)' : '🖨️ Lembar Muatan Bus (LMB)'}
            </button>

            {showLmb && (
              <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 space-y-4 shadow-sm text-slate-800 font-sans">
                {/* Preview Struk Thermal 80mm */}
                <div id="print-lmb-area" className="bg-amber-50/40 border border-slate-300 rounded-xl p-4 font-mono text-xs leading-relaxed space-y-3">
                  <div className="text-center font-bold text-sm tracking-wide border-b border-dashed border-slate-400 pb-2">
                    LEMBAR MUATAN BUS (LMB)<br/>
                    <span className="text-xs font-normal">TEMAN ANTENG</span>
                  </div>

                  <div className="space-y-0.5 text-[11px] border-b border-dashed border-slate-400 pb-2">
                    <div><b>Petugas:</b> {petugasNama}</div>
                    <div><b>No. Lambung:</b> {lb}</div>
                    <div><b>Shift:</b> {shift}</div>
                    <div><b>Terminal Awal:</b> {ritInfo?.terminal || (arahAktif === 'BP' ? 'BUKATEJA' : arahAktif === 'BK' ? 'BULUPITU' : '-')}</div>
                    <div><b>ID_PERJALANAN:</b> {idPerjalanan}</div>
                    <div><b>Koridor:</b> {koridor} | <b>Rit:</b> {rit} | <b>Tanggal:</b> {tanggal}</div>
                    <div><b>Jam Tiba:</b> {jamTiba} | <b>Arah:</b> {arahLabel}</div>
                  </div>

                  {lmbData.jumlahHalte === 0 ? (
                    <div className="text-center text-slate-500 py-3 font-sans text-xs">
                      Belum ada halte bertransaksi di rit ini.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-[11px] font-bold border-b border-slate-300 pb-1">RINCIAN HALTE BERTRANSAKSI:</div>
                      {lmbData.list.map((h, idx) => {
                        const hNorm = h.norm;
                        return (
                          <div key={h.idPerjalanan + '-' + h.namaHalte + '-' + idx} className="border-b border-dashed border-slate-300 pb-2.5 space-y-1">
                            <div className="font-bold">
                              {idx + 1}. {h.namaHalte} {h.idHalte ? `(${h.idHalte})` : ''}
                            </div>
                            <table className="w-full text-[11px] border-collapse">
                              <thead>
                                <tr className="border-b border-slate-300 text-left">
                                  <th className="py-0.5 font-normal text-slate-600">Kategori</th>
                                  <th className="py-0.5 text-right font-normal text-slate-600">Tunai</th>
                                  <th className="py-0.5 text-right font-normal text-slate-600">Non-Tunai</th>
                                </tr>
                              </thead>
                              <tbody>
                                {KATEGORI_LIST.map((kat) => {
                                  const tVal = hNorm.tunai[kat.key] || 0;
                                  const ntVal = hNorm.nonTunai[kat.key] || 0;
                                  if (tVal === 0 && ntVal === 0) return null;
                                  return (
                                    <tr key={kat.key}>
                                      <td className="py-0.5">{kat.label}</td>
                                      <td className="py-0.5 text-right font-mono-num">{tVal}</td>
                                      <td className="py-0.5 text-right font-mono-num">{ntVal}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                            <div className="pt-1 text-[11px] space-y-0.5">
                              <div>Subtotal Naik: Tunai <b>{hNorm.totalTunai}</b> · Non-Tunai <b>{hNorm.totalNonTunai}</b> · <b>Total {hNorm.totalHalte} org</b></div>
                              <div className="text-slate-600">Turun: {h.penumpangTurun || 0} · Transit: {h.penumpangTransit || 0} · PPT: {h.penumpangPPT || 0}</div>
                              {h.keterangan && h.keterangan !== '-' && (
                                <div className="text-slate-600 italic">Ket: {h.keterangan}</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {lmbData.jumlahHalte > 0 && (
                    <div className="space-y-2 pt-1 border-t border-slate-400">
                      <div className="font-bold text-[11px]">REKAP AKHIR 1 RIT:</div>
                      <table className="w-full text-[11px] border-collapse">
                        <thead>
                          <tr className="border-b border-slate-300 text-left">
                            <th className="py-0.5 font-normal text-slate-600">Kategori</th>
                            <th className="py-0.5 text-right font-normal text-slate-600">Tunai</th>
                            <th className="py-0.5 text-right font-normal text-slate-600">Non-Tunai</th>
                            <th className="py-0.5 text-right font-normal text-slate-600">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {KATEGORI_LIST.map((kat) => {
                            const tVal = lmbData.catTotalTunai[kat.key] || 0;
                            const ntVal = lmbData.catTotalNonTunai[kat.key] || 0;
                            const totCat = tVal + ntVal;
                            return (
                              <tr key={kat.key} className="border-b border-slate-100">
                                <td className="py-0.5">{kat.label}</td>
                                <td className="py-0.5 text-right font-mono-num">{tVal}</td>
                                <td className="py-0.5 text-right font-mono-num">{ntVal}</td>
                                <td className="py-0.5 text-right font-mono-num font-bold">{totCat}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      <div className="bg-amber-100/60 rounded-lg p-2.5 space-y-1 text-[11px]">
                        <div><b>Total Naik:</b> {lmbData.totalNaik} org</div>
                        <div><b>Total Tunai:</b> {lmbData.totalTunaiGlobal} org</div>
                        <div><b>Total Non-Tunai (E-ticketing):</b> {lmbData.totalNonTunaiGlobal} org</div>
                        <div><b>Total Turun:</b> {lmbData.totalTurun} org</div>
                        <div><b>Total Transit:</b> {lmbData.totalTransit} org</div>
                        <div><b>Total PPT:</b> {lmbData.totalPPT} org</div>
                        <div><b>Jumlah Halte Tercatat:</b> {lmbData.jumlahHalte} halte</div>
                      </div>
                    </div>
                  )}

                  <div className="pt-4 space-y-6 text-center text-[11px] border-t border-dashed border-slate-400">
                    <div className="flex justify-around pt-2">
                      <div className="text-center space-y-10">
                        <div>Pramujasa:</div>
                        <div className="font-bold">............</div>
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Dicetak: {tanggal} {new Date().toLocaleTimeString()}
                    </div>
                  </div>
                </div>

                {/* Tombol Cetak / Print */}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    disabled={lmbData.jumlahHalte === 0}
                    onClick={() => {
                      if (lmbData.jumlahHalte === 0) return;
                      const printContent = document.getElementById('print-lmb-area')?.innerHTML;
                      if (!printContent) return;
                      const win = window.open('', '_blank', 'width=400,height=600');
                      if (win) {
                        win.document.write(`
                          <html>
                            <head>
                              <title>LMB - ${idPerjalanan}</title>
                              <style>
                                body { font-family: monospace; font-size: 12px; padding: 12px; color: #000; background: #fff; }
                                table { width: 100%; border-collapse: collapse; margin-top: 4px; margin-bottom: 4px; }
                                th, td { padding: 2px 4px; text-align: left; }
                                th { border-bottom: 1px solid #000; }
                                .text-right { text-align: right; }
                                .font-bold { font-weight: bold; }
                              </style>
                            </head>
                            <body>
                              ${printContent}
                            </body>
                          </html>
                        `);
                        win.document.close();
                        win.focus();
                        setTimeout(() => {
                          win.print();
                          win.close();
                        }, 250);
                      }
                    }}
                    className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    🖨️ CETAK LMB (Thermal 80mm)
                  </button>
                </div>
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

            <button
              type="button"
              onClick={onOpenLostFound}
              className="w-full py-3.5 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-extrabold text-base flex items-center justify-center gap-2 cursor-pointer"
            >
              <PackageSearch className="w-5 h-5" /> BARANG TERTINGGAL
            </button>
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
