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
  const tampilPanelCadangan = isCadangan || statusPerjalanan === 'LANJUTAN_SETELAH_PERBAIKAN';
  const statusPerjalananEfektif = tampilPanelCadangan ? statusPerjalanan : 'NORMAL';

  const [shift, setShift] = useState('SHIFT 1');
  const [jamTiba, setJamTiba] = useState(jamSekarangHHMM());
  const [jamManual, setJamManual] = useState(false);

  // Pramudi (dari MASTER_DB sheet MASTER_PRAMUDI)
  const [selectedPramudiId, setSelectedPramudiId] = useState('');

  // Arah manual fallback khusus LBC01 (jika tidak ada di MASTER_RIT)
  const [manualArah, setManualArah] = useState<'BP' | 'BK'>('BP');
  const [selectedHalteId, setSelectedHalteId] = useState('');

  // Input penumpang per halte dengan dropdown jenis transaksi (metodeBayar)
  const [metodeBayar, setMetodeBayar] = useState('TUNAI');
  const [pnpCounts, setPnpCounts] = useState<Record<KategoriKey, string>>({
    umum: '',
    buruh: '',
    pelajar: '',
    lansia: '',
    disabilitas: '',
    veteran: '',
  });
  const [turunHalte, setTurunHalte] = useState('');
  const [transitHalte, setTransitHalte] = useState('');
  const [pptHalte, setPptHalte] = useState('');
  const [ket, setKet] = useState('');

  const [riwayat, setRiwayat] = useState<PramujasaRecord[]>(() =>
    bacaStorage<PramujasaRecord>(STORAGE_PRAM_KEY)
  );
  const [showSementara, setShowSementara] = useState(false);
  const [showRiwayat, setShowRiwayat] = useState(false);
  const [lastWaMsg, setLastWaMsg] = useState('');
  const [sending, setSending] = useState(false);

  const idPerjalanan = useMemo(
    () =>
      isCadangan && idPerjalananAsal.trim()
        ? `${koridor}-LBC01${rit}${tanggal.split('-').join('')}-GANTI-${idPerjalananAsal.trim()}`
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

    return [
      { id: 'HT01', nama: 'Terminal Bulupitu', koridor, arah: 'BP' },
      { id: 'HT02', nama: 'Halte Simpang Purbalingga', koridor, arah: 'BP' },
      { id: 'HT03', nama: 'Terminal Bukateja', koridor, arah: 'BK' },
    ];
  }, [masterHalte, koridor, arahAktif]);

  const selectedHalte = useMemo(() => {
    return halteSearah.find((h) => h.id === selectedHalteId) || halteSearah[0] || null;
  }, [halteSearah, selectedHalteId]);

  // Default pilih pramudi pertama jika belum dipilih
  const selectedPramudi = useMemo(() => {
    if (masterPramudi.length === 0) return null;
    return masterPramudi.find((p) => p.id === selectedPramudiId) || masterPramudi[0] || null;
  }, [masterPramudi, selectedPramudiId]);

  // Shift otomatis berdasarkan nomor rit (R01-R04 = SHIFT 1, R05-R08 = SHIFT 2)
  useEffect(() => {
    if (!jamManual) {
      setJamTiba(jamSekarangHHMM());
    }
    const ritStr = String(rit || '').toUpperCase();
    const num = parseInt(ritStr.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(num)) {
      if (num >= 1 && num <= 4) setShift('SHIFT 1');
      else if (num >= 5) setShift('SHIFT 2');
    }
  }, [koridor, lb, rit, jamManual]);

  const subtotalHalte = useMemo(() => {
    let sub = 0;
    for (const k of KATEGORI_LIST) {
      sub += Math.max(0, parseInt(pnpCounts[k.key], 10) || 0);
    }
    return sub;
  }, [pnpCounts]);

  // Akumulasi selama 1 Rit (data tersimpan di rit ini)
  const ringkasRitTersimpan = useMemo(
    () => hitungRingkasanRitPram(riwayat, tanggal, lb, rit, idPerjalanan),
    [riwayat, tanggal, lb, rit, idPerjalanan]
  );

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

  const updatePnpCount = (key: KategoriKey, rawVal: string) => {
    setPnpCounts((prev) => ({ ...prev, [key]: rawVal }));
  };

  const bersihkanInputHalte = () => {
    setPnpCounts({
      umum: '',
      buruh: '',
      pelajar: '',
      lansia: '',
      disabilitas: '',
      veteran: '',
    });
    setTurunHalte('');
    setTransitHalte('');
    setPptHalte('');
    setKet('');
    setJamManual(false);
  };

  const handleSimpanSementara = () => {
    // Validasi panel cadangan LBC01 — penambahan saja
    if (isCadangan && !idPerjalananAsal.trim()) {
      showToast('Isi dulu Bus yang diganti (ID Perjalanan Asal) untuk LBC01.', 'warn');
      return;
    }
    if (isCadangan && titikGanti === 'TENGAH_JALAN' && !halteTitikGanti.trim()) {
      showToast('Isi dulu Halte Titik Ganti untuk LBC01.', 'warn');
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
    const pptNum = Math.max(0, parseInt(pptHalte, 10) || 0);
    if (subtotalHalte === 0 && turunNum === 0 && transitNum === 0 && pptNum === 0) {
      showToast('Isi jumlah penumpang halte terlebih dahulu.', 'warn');
      return;
    }

    const nowMs = Date.now();
    const jam = jamTiba || jamSekarangHHMM();
    const halteId = selectedHalte?.id || 'HT01';
    const halteNama = selectedHalte?.nama || 'Halte';

    const counts: KategoriCounts = {
      umum: Math.max(0, parseInt(pnpCounts.umum, 10) || 0),
      buruh: Math.max(0, parseInt(pnpCounts.buruh, 10) || 0),
      pelajar: Math.max(0, parseInt(pnpCounts.pelajar, 10) || 0),
      lansia: Math.max(0, parseInt(pnpCounts.lansia, 10) || 0),
      disabilitas: Math.max(0, parseInt(pnpCounts.disabilitas, 10) || 0),
      veteran: Math.max(0, parseInt(pnpCounts.veteran, 10) || 0),
    };
    const sumCat = KATEGORI_LIST.reduce((acc, k) => acc + counts[k.key], 0);
    const isNT = metodeBayar.toUpperCase().includes('NON TUNAI') || metodeBayar.toUpperCase().includes('NON-TUNAI');

    const newItem: PramujasaRecord = {
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
      metodeBayar,
      tunai: isNT ? emptyKategoriCounts() : counts,
      nonTunai: isNT ? counts : emptyKategoriCounts(),
      totalTunai: isNT ? 0 : sumCat,
      totalNonTunai: isNT ? sumCat : 0,
      totalHalte: sumCat,
      penumpangTurun: turunNum,
      penumpangTransit: transitNum,
      penumpangPPT: pptNum,
      keterangan: ket.trim() || '-',
      petugas: petugasNama,
      idPramudi: selectedPramudi?.id || '',
      namaPramudi: selectedPramudi?.nama || '',
      status: 'SEMENTARA',
      waktuKirim: jam,
      // ===== 4 field cadangan — penambahan saja =====
      statusPerjalanan: statusPerjalananEfektif,
      idPerjalananAsal: tampilPanelCadangan ? idPerjalananAsal.trim().toUpperCase() : '',
      titikGanti: tampilPanelCadangan ? titikGanti : '',
      halteTitikGanti: tampilPanelCadangan ? halteTitikGanti.trim().toUpperCase() : '',
    };

    const updated = [newItem, ...freshRiw];
    tulisStorage(STORAGE_PRAM_KEY, updated);
    setRiwayat(updated);
    bersihkanInputHalte();
    showToast('Data halte berhasil disimpan sementara!', 'ok');
  };

  const handleHapusSementarItem = (idDetail: string) => {
    const updated = riwayat.filter((d) => d.idDetail !== idDetail);
    tulisStorage(STORAGE_PRAM_KEY, updated);
    setRiwayat(updated);
    showToast('Transaksi sementara halte dihapus.', 'ok');
  };

  const handleValidasiKirim = async () => {
    if (sending) return;

    // Validasi panel cadangan LBC01 — penambahan saja
    if (isCadangan && !idPerjalananAsal.trim()) {
      showToast('Isi dulu Bus yang diganti (ID Perjalanan Asal) untuk LBC01.', 'warn');
      return;
    }
    if (isCadangan && titikGanti === 'TENGAH_JALAN' && !halteTitikGanti.trim()) {
      showToast('Isi dulu Halte Titik Ganti untuk LBC01.', 'warn');
      return;
    }

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

    if (subtotalHalte > 0 || turunNum > 0 || transitNum > 0 || pptNum > 0) {
      const counts: KategoriCounts = {
        umum: Math.max(0, parseInt(pnpCounts.umum, 10) || 0),
        buruh: Math.max(0, parseInt(pnpCounts.buruh, 10) || 0),
        pelajar: Math.max(0, parseInt(pnpCounts.pelajar, 10) || 0),
        lansia: Math.max(0, parseInt(pnpCounts.lansia, 10) || 0),
        disabilitas: Math.max(0, parseInt(pnpCounts.disabilitas, 10) || 0),
        veteran: Math.max(0, parseInt(pnpCounts.veteran, 10) || 0),
      };
      const sumCat = KATEGORI_LIST.reduce((acc, k) => acc + counts[k.key], 0);
      const isNT = metodeBayar.toUpperCase().includes('NON TUNAI') || metodeBayar.toUpperCase().includes('NON-TUNAI');

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
        metodeBayar,
        tunai: isNT ? emptyKategoriCounts() : counts,
        nonTunai: isNT ? counts : emptyKategoriCounts(),
        totalTunai: isNT ? 0 : sumCat,
        totalNonTunai: isNT ? sumCat : 0,
        totalHalte: sumCat,
        penumpangTurun: turunNum,
        penumpangTransit: transitNum,
        penumpangPPT: pptNum,
        keterangan: ketVal,
        petugas: petugasNama,
        idPramudi: selectedPramudi?.id || '',
        namaPramudi: selectedPramudi?.nama || '',
        status: 'SEMENTARA',
        waktuKirim: jam,
        // ===== 4 field cadangan — penambahan saja =====
        statusPerjalanan: statusPerjalananEfektif,
        idPerjalananAsal: tampilPanelCadangan ? idPerjalananAsal.trim().toUpperCase() : '',
        titikGanti: tampilPanelCadangan ? titikGanti : '',
        halteTitikGanti: tampilPanelCadangan ? halteTitikGanti.trim().toUpperCase() : '',
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
      // ===== 4 field cadangan — penambahan saja =====
      STATUS_PERJALANAN: statusPerjalananEfektif,
      ID_PERJALANAN_ASAL: tampilPanelCadangan ? idPerjalananAsal.trim().toUpperCase() : '',
      TITIK_GANTI: tampilPanelCadangan ? titikGanti : '',
      HALTE_TITIK_GANTI: tampilPanelCadangan ? halteTitikGanti.trim().toUpperCase() : '',
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
    setStatusPerjalanan('NORMAL');
    setIdPerjalananAsal('');
    setTitikGanti('TERMINAL_AWAL');
    setHalteTitikGanti('');
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
              Pilih metode bayar &amp; isi jumlah penumpang per kategori halte!
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
            <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🚌</span>
                <div>
                  <h3 className="font-extrabold text-amber-900 text-sm">ARMADA CADANGAN AKTIF — {lb}</h3>
                  <p className="text-xs text-amber-800">Bus ini menggantikan bus reguler. Lengkapi keterangan pengganti di bawah.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">Status Perjalanan</label>
                  <select value={statusPerjalanan} onChange={(e) => setStatusPerjalanan(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-800 bg-white font-bold">
                    <option value="PENGGANTI">PENGGANTI</option>
                    <option value="LANJUTAN_SETELAH_PERBAIKAN">LANJUTAN_SETELAH_PERBAIKAN</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">Menggantikan Bus (ID Asal)</label>
                  <input type="text" placeholder="Contoh: KOR01-LB05R0320261127" value={idPerjalananAsal} onChange={(e) => setIdPerjalananAsal(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-800 bg-white font-mono-num font-bold text-center" />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">Titik Ganti</label>
                  <select value={titikGanti} onChange={(e) => setTitikGanti(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-800 bg-white font-bold">
                    <option value="TERMINAL_AWAL">TERMINAL_AWAL</option>
                    <option value="TENGAH_JALAN">TENGAH_JALAN</option>
                    <option value="AKHIR_RIT">AKHIR_RIT</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">Halte Titik Ganti</label>
                  <input type="text" placeholder="Nama halte (jika tengah jalan)" value={halteTitikGanti} onChange={(e) => setHalteTitikGanti(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-800 bg-white font-bold text-center" />
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

          {/* KOLOM INPUT KATEGORI PENUMPANG DENGAN DROPDOWN METODE / JENIS TRANSAKSI */}
          <div className="bg-white border-2 border-slate-300 rounded-2xl p-4 space-y-3">
            <div className="text-center">
              <h4 className="text-sm font-extrabold text-slate-900">
                INPUT PENUMPANG HALTE INI
              </h4>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                Pilih metode pembayaran, lalu isi jumlah penumpang per kategori
              </p>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">
                Jenis Transaksi / Metode Pembayaran
              </label>
              <select
                value={metodeBayar}
                onChange={(e) => setMetodeBayar(e.target.value)}
                className="w-full px-3 py-3 rounded-xl border-2 border-slate-800 bg-white font-extrabold text-center text-base"
              >
                <option value="TUNAI">TUNAI</option>
                <option value="NON-TUNAI">NON-TUNAI</option>
              </select>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
              {KATEGORI_LIST.map((kat) => (
                <div key={kat.key} className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                  <label className="block text-xs font-extrabold text-slate-800 mb-1">
                    {kat.label}
                  </label>
                  <input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={pnpCounts[kat.key]}
                    onChange={(e) => updatePnpCount(kat.key, e.target.value)}
                    className="w-full px-2 py-2.5 rounded-xl border-2 border-slate-700 bg-white font-mono-num font-extrabold text-center text-lg text-slate-900"
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">Pnp Turun</label>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={turunHalte}
                  onChange={(e) => setTurunHalte(e.target.value)}
                  className="w-full px-2 py-3 rounded-xl border-2 border-slate-800 bg-rose-50 font-mono-num font-bold text-center text-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">Pnp Transit</label>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={transitHalte}
                  onChange={(e) => setTransitHalte(e.target.value)}
                  className="w-full px-2 py-3 rounded-xl border-2 border-slate-800 bg-amber-50 font-mono-num font-bold text-center text-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">Pnp PPT</label>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={pptHalte}
                  onChange={(e) => setPptHalte(e.target.value)}
                  className="w-full px-2 py-3 rounded-xl border-2 border-slate-800 bg-sky-50 font-mono-num font-bold text-center text-lg"
                />
              </div>
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
                          <button
                            type="button"
                            onClick={() => handleHapusSementarItem(d.idDetail)}
                            className="text-red-600 hover:text-red-800 p-1 cursor-pointer"
                            title="Hapus baris"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

                        <div className="text-slate-600 font-medium">
                          Turun: {d.penumpangTurun || 0} · Transit: {d.penumpangTransit || 0} · PPT:{' '}
                          {d.penumpangPPT || 0} {d.keterangan ? `· Ket: ${d.keterangan}` : ''}
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
              className="w-full py-4 rounded-2xl font-extrabold text-lg text-white bg-[#004080] hover:bg-blue-950 disabled:cursor-not-allowed cursor-pointer shadow-lg"
            >
              {sending ? 'MENGIRIM...' : 'VALIDASI & KIRIM KE DATABASE'}
            </button>
          </div>

          {/* WHATSAPP SHARE BOX */}
          <WhatsAppShareBox message={lastWaMsg} onCopied={() => {}} />

          {/* TEKS KLIK: LIHAT RIWAYAT PRAMUJASA */}
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => setShowRiwayat((v) => !v)}
              className="text-emerald-700 hover:text-emerald-950 font-extrabold underline text-sm cursor-pointer"
            >
              {showRiwayat ? 'Sembunyikan Riwayat Tervalidasi' : 'Lihat Riwayat Tervalidasi'}
            </button>
            <span className="ml-2 text-xs font-bold text-slate-600">
              ({todayRiwayat.filter((d) => d && d.status === 'TERVALIDASI').length} data hari ini)
            </span>
          </div>

          {showRiwayat && (
            <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-4 space-y-2.5">
              <div className="flex justify-between items-center mb-2">
                <span className="font-extrabold text-emerald-950 text-sm">
                  RIWAYAT TERVALIDASI HARI INI
                </span>
                <span className="text-xs font-bold text-emerald-900">
                  {todayRiwayat.filter((d) => d && d.status === 'TERVALIDASI').length} data
                </span>
              </div>

              {todayRiwayat.filter((d) => d && d.status === 'TERVALIDASI').length === 0 ? (
                <p className="text-center text-sm text-emerald-800/80 py-4 font-medium">
                  Belum ada data Pramujasa tervalidasi hari ini
                </p>
              ) : (
                todayRiwayat
                  .filter((d) => d && d.status === 'TERVALIDASI')
                  .map((d, idx) => {
                    const norm = normalizePramRecord(d);
                    return (
                      <div
                        key={`${d.idPerjalanan}-${idx}`}
                        className="bg-white border border-emerald-300 rounded-xl p-3 text-xs space-y-1.5"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-extrabold text-emerald-900">
                            {d.noLambung} | {d.rit} · {d.idPerjalanan}
                          </span>
                          <span className="font-extrabold text-emerald-700">Tervalidasi</span>
                        </div>
                        <div className="text-slate-600 font-semibold">
                          Halte: {d.namaHalte} · Jam: {d.jamTiba} · Petugas: {d.petugas}
                        </div>
                        <div className="grid grid-cols-2 gap-2 bg-emerald-50/50 rounded-lg p-2">
                          <div>
                            <span className="font-bold text-emerald-900">Tunai: {norm.totalTunai} org</span>
                          </div>
                          <div>
                            <span className="font-bold text-violet-900">Non-Tunai: {norm.totalNonTunai} org</span>
                          </div>
                        </div>
                        {d.statusPerjalanan && d.statusPerjalanan !== 'NORMAL' && (
                          <div className="text-xs font-bold text-amber-800">
                            🚌 {d.statusPerjalanan} — Asal: {d.idPerjalananAsal || '-'} · Titik Ganti: {d.titikGanti || '-'}
                          </div>
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
