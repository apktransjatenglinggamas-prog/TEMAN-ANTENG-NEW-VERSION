import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, PackageSearch } from 'lucide-react';
import { MasterRitMap, PpaRecord, TimerLookupData, ToastType } from '../types/anteng';
import {
  API_PPA,
  API_TIMER,
  IDS_PPA_KEY,
  LIST_KORIDOR,
  LIST_LB,
  LIST_POS_PPA,
  LIST_RIT,
  STORAGE_PPA_KEY,
  bacaStorage,
  hasSavedIdPerjalanan,
  hitungSelisihMenit,
  jamKeMenit,
  jamSekarangHHMM,
  markSavedIdPerjalanan,
  normalKunciJS,
  pad2,
  tglHariIni,
  tulisStorage,
} from '../utils/anteng';
import { BrandLogo } from './BrandLogo';
import { WhatsAppShareBox } from './WhatsAppShareBox';

interface PpaScreenProps {
  petugasNama: string;
  // MASTER_RIT — sumber ARAH. Dikirim dari App, sama seperti di PramujasaScreen.
  // JANGAN ambil arah dari MASTER_JADWAL. Kunci: LB + RIT -> { arah, terminal, terminalAkhir }.
  masterRit: MasterRitMap;
  onBackToLogin: () => void;
  onOpenLostFound: () => void;
  showToast: (msg: string, type?: ToastType) => void;
  setGlobalLoading: (loading: boolean) => void;
}

export function PpaScreen({
  petugasNama,
  masterRit,
  onBackToLogin,
  onOpenLostFound,
  showToast,
  setGlobalLoading,
}: PpaScreenProps) {
  const [tanggal, setTanggal] = useState(tglHariIni());
  const [pos, setPos] = useState(LIST_POS_PPA[0].value);
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
  const [allPnp, setAllPnp] = useState('0');
  const [naikPnp, setNaikPnp] = useState('0');
  const [turunPnp, setTurunPnp] = useState('0');
  const [jamTiba, setJamTiba] = useState(jamSekarangHHMM());
  const [ket, setKet] = useState('');
  const [timerData, setTimerData] = useState<TimerLookupData | null>(null);
  const [loadingTimer, setLoadingTimer] = useState(false);
  const [timerErr, setTimerErr] = useState(false);
  const [riwayat, setRiwayat] = useState<PpaRecord[]>(() =>
    bacaStorage<PpaRecord>(STORAGE_PPA_KEY)
  );
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

  // ===== ARAH dari MASTER_RIT (bukan MASTER_JADWAL, bukan ketikan manual) =====
  // Kunci persis seperti PramujasaScreen: normalKunciJS(`${lb}-${rit}`) lalu fallback `rit`.
  const ritInfo = useMemo(() => {
    const kunci = normalKunciJS(`${lb}-${rit}`) || `${lb}-${rit}`;
    return masterRit?.[kunci] || masterRit?.[rit] || null;
  }, [lb, rit, masterRit]);

  // Fallback arah dari nama POS, HANYA kalau MASTER_RIT tidak ketemu.
  // POS seperti JOMPO_BK_BP artinya BK -> BP, jadi arahnya BP (tujuan akhir).
  // POS seperti JOMPO_BP_BK artinya BP -> BK, jadi arahnya BK.
  const arahDariPos = useMemo(() => {
    const up = String(pos || '').toUpperCase();
    if (up.endsWith('_BK_BP') || up.endsWith('_BP')) return 'BP';
    if (up.endsWith('_BP_BK') || up.endsWith('_BK')) return 'BK';
    if (up.includes('BK_BP')) return 'BP';
    if (up.includes('BP_BK')) return 'BK';
    return '';
  }, [pos]);

  const arahAktif = useMemo(() => {
    if (ritInfo?.arah === 'BP' || ritInfo?.arah === 'BK') return ritInfo.arah;
    if (ritInfo?.terminalAkhir) {
      const upAk = String(ritInfo.terminalAkhir).toUpperCase();
      if (upAk.includes('BULUPITU')) return 'BP';
      if (upAk.includes('BUKATEJA')) return 'BK';
    }
    return arahDariPos;
  }, [ritInfo, arahDariPos]);

  const arahKetemu = Boolean(arahAktif);
  const arahLabel = useMemo(() => {
    if (ritInfo?.terminal && ritInfo?.terminalAkhir) {
      return `${arahAktif} (${ritInfo.terminal} \u2192 ${ritInfo.terminalAkhir})`;
    }
    if (arahAktif === 'BP') return 'BP (Arah Bulupitu)';
    if (arahAktif === 'BK') return 'BK (Arah Bukateja)';
    return '-';
  }, [arahAktif, ritInfo]);

  // Arah sebuah record lama (yang belum punya field arah): pakai field arah kalau ada,
  // kalau tidak ada turunkan dari POS-nya, supaya headway lama tetap terkelompok benar.
  const arahOfRecord = (item: PpaRecord): string => {
    const rec = item as unknown as Record<string, unknown>;
    const a = String(rec.arah || rec.arahPerjalanan || '').toUpperCase();
    if (a === 'BP' || a === 'BK') return a;
    const up = String(item.pos || '').toUpperCase();
    if (up.endsWith('_BK_BP') || up.endsWith('_BP') || up.includes('BK_BP')) return 'BP';
    if (up.endsWith('_BP_BK') || up.endsWith('_BK') || up.includes('BP_BK')) return 'BK';
    return '';
  };

  // Ambil data Timer saat armada/rit berubah
  useEffect(() => {
    let cancelled = false;
    setTanggal(tglHariIni());
    setJamTiba(jamSekarangHHMM());
    setTimerData(null);
    setTimerErr(false);
    setLoadingTimer(true);

    fetch(`${API_TIMER}?idPerjalanan=${encodeURIComponent(idPerjalanan)}&t=${Date.now()}`)
      .then((res) => res.text())
      .then((txt) => {
        if (cancelled) return;
        try {
          const tm = JSON.parse(txt) as TimerLookupData;
          if (
            tm &&
            !tm.tidakKetemu &&
            !tm.error &&
            (tm.jadwal || tm.aktual || tm.terminal || tm.pnpNaik !== undefined)
          ) {
            setTimerData(tm);
            setTimerErr(false);
          } else {
            setTimerData(null);
            setTimerErr(true);
          }
        } catch {
          setTimerData(null);
          setTimerErr(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTimerData(null);
          setTimerErr(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingTimer(false);
      });

    return () => {
      cancelled = true;
    };
  }, [idPerjalanan]);

  const jamInvalid = useMemo(() => {
    const mPPA = jamKeMenit(jamTiba);
    const mBerangkat = timerData?.aktual ? jamKeMenit(timerData.aktual) : null;
    return (
      mPPA !== null &&
      mBerangkat !== null &&
      mPPA < mBerangkat &&
      mBerangkat - mPPA <= 720
    );
  }, [jamTiba, timerData]);

  // Waktu Tempuh (tampil): JAM TIBA POS - JAM BERANGKAT AKTUAL (Timer).
  // Per baris, tidak peduli POS lain / arah lain. Versi angka murni disimpan di waktuTempuhMenit.
  const waktuTempuhMenit = useMemo(() => {
    if (!timerData?.aktual || !jamTiba) return null;
    return hitungSelisihMenit(timerData.aktual, jamTiba);
  }, [timerData, jamTiba]);

  const waktuTempuh = useMemo(() => {
    return waktuTempuhMenit !== null ? `${waktuTempuhMenit} menit` : '-';
  }, [waktuTempuhMenit]);

  // Headway (tampil, preview dari HP): HANYA dalam grup TANGGAL + POS + ARAH.
  // Ini preview supaya petugas langsung lihat. Angka resmi dihitung ulang di code.gs
  // dari seluruh Sheet, supaya benar antar HP. Bus pertama di grupnya -> BUS PERTAMA.
  const headwayInfo = useMemo(() => {
    const mSekarang = jamKeMenit(jamTiba);
    let busDepan: PpaRecord | null = null;
    let mTerdekat = -1;
    for (const item of riwayat) {
      if (
        item &&
        item.tanggal === tanggal &&
        item.pos === pos &&
        arahOfRecord(item) === arahAktif &&
        arahAktif !== '' &&
        item.idPerjalanan !== idPerjalanan &&
        item.status !== 'GAGAL_KIRIM' &&
        item.jamTiba
      ) {
        const mItem = jamKeMenit(item.jamTiba);
        if (mItem !== null && (mSekarang === null || mItem <= mSekarang)) {
          if (mItem >= mTerdekat) {
            mTerdekat = mItem;
            busDepan = item;
          }
        }
      }
    }
    if (!busDepan) return { menit: null as number | null, teks: 'BUS PERTAMA', busDepan: null as PpaRecord | null };
    const selisih = hitungSelisihMenit(busDepan.jamTiba, jamTiba);
    if (selisih === null) return { menit: null, teks: 'BUS PERTAMA', busDepan: null };
    return {
      menit: selisih,
      teks: `${selisih} menit (dari ${busDepan.noLambung} ${busDepan.rit} jam ${busDepan.jamTiba})`,
      busDepan,
    };
  }, [riwayat, tanggal, pos, arahAktif, idPerjalanan, jamTiba]);

  const headwayPos = headwayInfo.teks;

  useEffect(() => {
    for (const r of riwayat) {
      if (r?.idPerjalanan && r.status !== 'GAGAL_KIRIM') {
        markSavedIdPerjalanan(IDS_PPA_KEY, r.idPerjalanan);
      }
    }
  }, [riwayat]);

  // ===== DUPLIKAT: kunci = ID_PERJALANAN + POS + ARAH (bukan ID saja) =====
  // 1 bus yang sama BOLEH dicatat di POS berbeda dan di arah berbeda (itu baris beda).
  // 1 bus di POS + ARAH yang sama persis TIDAK BOLEH double.
  // Catatan: markSavedIdPerjalanan lama hanya kunci ID, jadi untuk keamanan ganda
  // cek riwayat (ID+POS+ARAH) dipakai sebagai penentu utama di handleSimpan.
  const kunciDuplikat = `${idPerjalanan}|${pos}|${arahAktif}`;
  const existingValidRecord = useMemo(
    () =>
      Boolean(
        riwayat.find(
          (r) =>
            r.idPerjalanan === idPerjalanan &&
            r.pos === pos &&
            arahOfRecord(r) === arahAktif &&
            arahAktif !== '' &&
            r.status !== 'GAGAL_KIRIM'
        )
      ),
    [riwayat, idPerjalanan, pos, arahAktif]
  );

  const existingFailedRecord = useMemo(
    () =>
      riwayat.find(
        (r) =>
          r.idPerjalanan === idPerjalanan &&
          r.pos === pos &&
          arahOfRecord(r) === arahAktif &&
          arahAktif !== '' &&
          r.status === 'GAGAL_KIRIM'
      ),
    [riwayat, idPerjalanan, pos, arahAktif]
  );

  const todayRiwayat = useMemo(
    () => riwayat.filter((r) => r.tanggal === tanggal),
    [riwayat, tanggal]
  );

  const buildWaPpa = (pl: PpaRecord) =>
    `\u2705 *TEMAN ANTENG - VALIDASI PPA*\n` +
    `ID_PERJALANAN: ${pl.idPerjalanan}\n` +
    `Koridor: ${pl.koridor}\n` +
    `Pola: ${pl.polaOperasional}\n` +
    `Tanggal: ${pl.tanggal}\n` +
    `Petugas PPA: ${pl.petugas}\n` +
    `Bus: ${pl.noLambung} | Rit: ${pl.rit}\n` +
    `POS: ${pl.pos}\n` +
    `Arah: ${(pl as unknown as Record<string, unknown>).arah || '-'}\n` +
    `JAM BERANGKAT AKTUAL (Timer): ${pl.aktual}\n` +
    `Jam Tiba di POS: ${pl.jamTiba}\n` +
    `Waktu Tempuh ke POS: ${pl.waktuTempuhKePos}\n` +
    `Headway dengan Bus Depan: ${pl.headwayPos}\n` +
    `All: ${pl.all} | Naik: ${pl.naik} | Turun: ${pl.turun}\n` +
    `Ket: ${pl.keterangan}\n` +
    `Status: ${pl.status}`;

  const kirimKeServer = async (pl: PpaRecord) => {
    setSending(true);
    setGlobalLoading(true);
    try {
      // Payload dikirim apa adanya (seperti sebelumnya) supaya code.gs PPA lama tetap jalan.
      // code.gs PPA BARU membaca: arah (string), waktuTempuhMenit (angka),
      // headwayMenit (angka, null = BUS PERTAMA), lalu menghitung ulang headway
      // dari Sheet per grup TANGGAL+POS+ARAH dan menolak duplikat ID+POS+ARAH.
      await fetch(API_PPA, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(pl),
      });

      const current = bacaStorage<PpaRecord>(STORAGE_PPA_KEY).filter(
        (r) =>
          !(
            r.idPerjalanan === pl.idPerjalanan &&
            r.pos === pl.pos &&
            arahOfRecord(r) === arahAktif
          )
      );
      const saved: PpaRecord = { ...pl, status: 'Tervalidasi' };
      const updated = [saved, ...current];
      markSavedIdPerjalanan(IDS_PPA_KEY, pl.idPerjalanan);
      tulisStorage(STORAGE_PPA_KEY, updated);
      setRiwayat(updated);
      setLastWaMsg(buildWaPpa(saved));
      showToast('Validasi PPA berhasil dikirim ke database!', 'ok');
    } catch {
      const current = bacaStorage<PpaRecord>(STORAGE_PPA_KEY).filter(
        (r) =>
          !(
            r.idPerjalanan === pl.idPerjalanan &&
            r.pos === pl.pos &&
            arahOfRecord(r) === arahAktif
          )
      );
      const failed: PpaRecord = { ...pl, status: 'GAGAL_KIRIM' };
      const updated = [failed, ...current];
      tulisStorage(STORAGE_PPA_KEY, updated);
      setRiwayat(updated);
      showToast('Gagal terhubung ke server. Data PPA disimpan lokal untuk dikirim ulang.', 'err');
    } finally {
      setSending(false);
      setGlobalLoading(false);
    }
  };

  const handleSimpan = async () => {
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
    // Duplikat: ID + POS + ARAH. Cek riwayat lokal (kunci lengkap).
    const freshRiw = bacaStorage<PpaRecord>(STORAGE_PPA_KEY);
    if (
      freshRiw.some(
        (r) =>
          r.idPerjalanan === idPerjalanan &&
          r.pos === pos &&
          arahOfRecord(r) === arahAktif &&
          arahAktif !== '' &&
          r.status !== 'GAGAL_KIRIM'
      )
    ) {
      showToast('ID_PERJALANAN + POS + ARAH SUDAH ADA', 'err');
      return;
    }
    if (!arahKetemu) {
      showToast('ARAH tidak ketemu di MASTER_RIT untuk LB + RIT ini. Cek LB / RIT.', 'warn');
      return;
    }
    if (jamInvalid) {
      showToast('Jam tiba di POS tidak boleh lebih cepat dari jam berangkat aktual.', 'warn');
      return;
    }

    const now = new Date();
    const jamAktualTimer = timerData?.aktual || '-';
    const polaVal = timerData?.polaOperasional || 'REGULER';
    const ketVal = ket.trim() || '-';
    const allN = parseInt(allPnp, 10) || 0;
    const naikN = parseInt(naikPnp, 10) || 0;
    const turunN = parseInt(turunPnp, 10) || 0;

    const pl: PpaRecord = {
      tanggal,
      idPerjalanan,
      pos,
      posPPA: pos,
      arah: arahAktif,
      arahPerjalanan: arahAktif,
      jamTiba,
      jamTibaPos: jamTiba,
      aktual: jamAktualTimer,
      jamBerangkatAktual: jamAktualTimer,
      waktuTempuhKePos: waktuTempuh,
      waktuTempuhMenit: waktuTempuhMenit,
      headwayPos,
      headwayMenit: headwayInfo.menit,
      all: allN,
      allPnp: allN,
      naik: naikN,
      pnpNaik: naikN,
      turun: turunN,
      pnpTurun: turunN,
      keterangan: ketVal,
      ket: ketVal,
      petugas: petugasNama,
      waktuKirim: `${pad2(now.getHours())}:${pad2(now.getMinutes())}`,
      koridor,
      noLambung: lb,
      rit,
      polaOperasional: polaVal,
      status: 'Tervalidasi',
      // ===== 4 field cadangan — penambahan saja =====
      statusPerjalanan: statusPerjalananEfektif,
      idPerjalananAsal: tampilPanelCadangan ? idPerjalananAsal.trim().toUpperCase() : '',
      titikGanti: tampilPanelCadangan ? titikGanti : '',
      halteTitikGanti: tampilPanelCadangan ? halteTitikGanti.trim().toUpperCase() : '',
    } as PpaRecord;

    await kirimKeServer(pl);
  };

  const handleReset = () => {
    setTanggal(tglHariIni());
    setLb('LB01');
    setRit('R01');
    setStatusPerjalanan('NORMAL');
    setIdPerjalananAsal('');
    setTitikGanti('TERMINAL_AWAL');
    setHalteTitikGanti('');
    setAllPnp('0');
    setNaikPnp('0');
    setTurunPnp('0');
    setKet('');
    setJamTiba(jamSekarangHHMM());
    setLastWaMsg('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <div className="max-w-xl mx-auto bg-white min-h-screen shadow-sm border-x border-slate-200 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-br from-[#0056b3] to-[#003366] text-white p-5 rounded-b-3xl flex items-center gap-4 relative">
          <BrandLogo className="w-16 h-16 p-1 border-2 border-white/80" />
          <div className="pr-10">
            <h2 className="text-xl font-extrabold leading-tight">
              Selamat Bekerja {petugasNama.toUpperCase()}
            </h2>
            <p className="text-sm text-white/90 font-medium">
              Validasi setelah bus sampai di POS. Jam tiba tidak boleh lebih cepat dari jam berangkat.
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
            <p className="text-sm font-semibold text-slate-500">Petugas Pengawas Angkutan (PPA)</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-extrabold uppercase text-slate-700 mb-1">
                Tanggal Operasional
              </label>
              <input
                type="date"
                value={tanggal}
                readOnly
                className="w-full px-3 py-3 rounded-xl border-2 border-slate-400 bg-slate-200 text-slate-700 font-bold text-center"
              />
            </div>
            <div>
              <label className="block text-xs font-extrabold uppercase text-slate-700 mb-1">
                Lokasi POS PPA
              </label>
              <select
                value={pos}
                onChange={(e) => setPos(e.target.value)}
                className="w-full px-3 py-3 rounded-xl border-2 border-slate-800 font-bold text-center bg-white"
              >
                {LIST_POS_PPA.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
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
            <label className="block text-xs font-extrabold text-slate-700 mb-1">ID_PERJALANAN</label>
            <input
              type="text"
              value={idPerjalanan}
              readOnly
              className="w-full px-3 py-3 rounded-xl border-2 border-slate-800 bg-rose-50 font-mono-num font-extrabold text-center text-blue-900 text-lg"
            />
            {existingValidRecord && (
              <div className="mt-2 rounded-xl border-2 border-red-300 bg-red-50 px-3 py-2 text-center text-xs font-extrabold text-red-800">
                ID + POS + ARAH SUDAH ADA ({idPerjalanan} | {pos} | {arahAktif})
              </div>
            )}
          </div>

          {/* ARAH dari MASTER_RIT — tampil, tidak bisa diketik */}
          <div className={`rounded-2xl border-2 p-3.5 text-sm ${arahKetemu ? 'bg-violet-50 border-violet-200 text-slate-800' : 'bg-red-50 border-red-200 text-red-900'}`}>
            <p className="font-extrabold">ARAH (MASTER_RIT)</p>
            <p className="font-extrabold text-base">{arahLabel}</p>
            {!arahKetemu && (
              <p className="text-xs mt-1">ARAH tidak ketemu di MASTER_RIT untuk {lb} + {rit}. Cek LB / RIT atau isi MASTER_RIT.</p>
            )}
            {ritInfo && !ritInfo.arah && (
              <p className="text-xs mt-1">MASTER_RIT ketemu tapi kolom arah kosong — arah diambil dari nama POS sebagai fallback.</p>
            )}
          </div>

          {/* Info Timer */}
          <div
            className={`rounded-2xl border-2 p-3.5 text-sm leading-relaxed ${
              loadingTimer
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : timerErr || !timerData
                ? 'bg-red-50 border-red-200 text-red-900'
                : 'bg-blue-50 border-blue-200 text-slate-800'
            }`}
          >
            {loadingTimer ? (
              <p className="font-bold">Mengambil data Timer dari Database Timer...</p>
            ) : timerData ? (
              <div>
                <p className="font-extrabold text-blue-900">DATA TIMER DITEMUKAN (Sheet Timer)</p>
                <p>
                  Bus {lb} | Rit {rit} | Terminal <b>{timerData.terminal || '-'}</b>
                </p>
                <p>
                  Pola: <b>{timerData.polaOperasional || 'REGULER'}</b> | Jadwal:{' '}
                  <b>{timerData.jadwal || '-'}</b>
                </p>
                <p className="font-extrabold text-blue-900">
                  Jam Berangkat Aktual: {timerData.aktual || '-'}
                </p>
                <p>
                  Total <b>{timerData.pnpNaik ?? 0}</b> | Transit <b>{timerData.pnpTransit ?? 0}</b>{' '}
                  | Turun <b>{timerData.pnpTurun ?? 0}</b>
                </p>
              </div>
            ) : (
              <div>
                <p className="font-extrabold">BELUM ADA DATA TIMER untuk ID ini.</p>
                <p className="text-xs mt-1">
                  ID: {idPerjalanan}. Minta Timer kirim dulu, atau cek No. Lambung / Rit.
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">All Pnp</label>
              <input
                type="number"
                min={0}
                value={allPnp}
                onChange={(e) => setAllPnp(e.target.value)}
                className="w-full px-2 py-3 rounded-xl border-2 border-slate-800 font-mono-num font-bold text-center text-lg bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">Pnp Naik</label>
              <input
                type="number"
                min={0}
                value={naikPnp}
                onChange={(e) => setNaikPnp(e.target.value)}
                className="w-full px-2 py-3 rounded-xl border-2 border-slate-800 font-mono-num font-bold text-center text-lg bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">Pnp Turun</label>
              <input
                type="number"
                min={0}
                value={turunPnp}
                onChange={(e) => setTurunPnp(e.target.value)}
                className="w-full px-2 py-3 rounded-xl border-2 border-slate-800 font-mono-num font-bold text-center text-lg bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-extrabold text-slate-700 mb-1">
              Jam Tiba di POS PPA (Manual)
            </label>
            <input
              type="time"
              value={jamTiba}
              onChange={(e) => setJamTiba(e.target.value)}
              className="w-full px-3 py-3 rounded-xl border-2 border-slate-800 bg-rose-50 font-mono-num font-bold text-center text-lg"
            />
          </div>

          {jamInvalid && (
            <div className="rounded-xl border-2 border-red-200 bg-red-50 text-red-800 p-3 text-sm font-bold">
              Jam tiba di POS PPA ({jamTiba}) tidak boleh lebih cepat dari jam berangkat aktual (
              {timerData?.aktual}).
            </div>
          )}

          <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-3.5 text-sm space-y-1">
            <div>
              <b>Arah:</b> {arahLabel}
            </div>
            <div>
              <b>Waktu Tempuh ke POS:</b> {waktuTempuh}
            </div>
            <div>
              <b>Headway dengan Bus Depan (grup Tanggal + POS + Arah):</b> {headwayPos}
            </div>
            <div className="text-xs text-slate-600">
              Headway resmi dihitung ulang di server dari seluruh Sheet — angka di sini preview dari HP ini.
            </div>
          </div>

          <div>
            <label className="block text-xs font-extrabold text-slate-700 mb-1">
              Keterangan POS
            </label>
            <div className="rounded-xl bg-amber-100 border border-amber-300 p-1">
              <input
                type="text"
                placeholder="Catatan pengawas..."
                value={ket}
                onChange={(e) => setKet(e.target.value)}
                className="w-full px-3 py-2.5 bg-transparent font-bold text-center text-slate-900 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-2.5 pt-2">
            <button
              type="button"
              disabled={sending}
              onClick={() => void handleSimpan()}
              className={`w-full py-4 rounded-2xl font-extrabold text-lg text-white cursor-pointer disabled:cursor-not-allowed ${
                existingValidRecord
                  ? 'bg-red-700 hover:bg-red-800'
                  : jamInvalid || !arahKetemu
                  ? 'bg-red-400'
                  : 'bg-[#004080] hover:bg-blue-950'
              }`}
            >
              {sending
                ? 'MENGIRIM VALIDASI...'
                : existingValidRecord
                ? 'ID + POS + ARAH SUDAH ADA'
                : existingFailedRecord
                ? 'KIRIM ULANG VALIDASI PPA'
                : 'SIMPAN DAN KIRIM VALIDASI'}
            </button>

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
                  INPUT BUS BERIKUTNYA
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
              {showRiwayat ? 'Sembunyikan Riwayat Validasi' : 'Lihat Riwayat Validasi'}
            </button>
            <span className="ml-2 text-xs font-bold text-slate-600">
              ({todayRiwayat.length} data hari ini)
            </span>
          </div>

          {showRiwayat && (
            <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="font-extrabold text-slate-900">RIWAYAT VALIDASI PPA</span>
                <span className="text-xs font-bold text-slate-600">{todayRiwayat.length} data</span>
              </div>
              {todayRiwayat.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-4">
                  Belum ada data PPA hari ini
                </p>
              ) : (
                todayRiwayat.map((d, idx) => (
                  <div
                    key={`${d.idPerjalanan}-${d.pos}-${arahOfRecord(d)}-${idx}`}
                    className="bg-white border border-slate-300 rounded-xl p-3 text-sm space-y-1"
                  >
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-extrabold text-slate-900">
                        {d.noLambung} | {d.rit} ({d.pos} | {arahOfRecord(d) || '-'})
                      </span>
                      <span
                        className={`text-xs font-extrabold ${
                          d.status === 'GAGAL_KIRIM' ? 'text-red-700' : 'text-emerald-700'
                        }`}
                      >
                        {d.status}
                      </span>
                    </div>
                    <div className="text-xs font-mono-num text-slate-500">{d.idPerjalanan}</div>
                    <div className="text-xs text-slate-700">
                      Berangkat {d.aktual} | Tiba POS {d.jamTiba} | Tempuh {d.waktuTempuhKePos}
                    </div>
                    <div className="text-xs text-slate-700">Headway: {d.headwayPos}</div>
                    <div className="text-xs text-slate-700">
                      All {d.all} | Naik {d.naik} | Turun {d.turun}
                    </div>
                    {d.status === 'GAGAL_KIRIM' && (
                      <button
                        type="button"
                        onClick={() => void kirimKeServer(d)}
                        className="mt-1 text-xs font-extrabold text-blue-700 underline cursor-pointer"
                      >
                        Kirim Ulang Sekarang
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
