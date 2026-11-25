import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, RefreshCw, PackageSearch } from 'lucide-react';
import { MasterJadwalMap, MasterRitMap, TimerLookupData, TimerRecord, ToastType } from '../types/anteng';
import {
  API_TIMER,
  IDS_TIMER_KEY,
  LIST_KORIDOR,
  LIST_LB,
  LIST_RIT,
  STORAGE_TIMER_KEY,
  bacaStorage,
  getTerminalAwalFromMasterRit,
  hasSavedIdPerjalanan,
  jamKeMenit,
  jamSekarangHHMM,
  markSavedIdPerjalanan,
  normalisasiJamHHMM,
  pad2,
  tglHariIni,
  tulisStorage,
} from '../utils/anteng';
import { BrandLogo } from './BrandLogo';
import { WhatsAppShareBox } from './WhatsAppShareBox';

interface TimerScreenProps {
  petugasNama: string;
  masterJadwal: MasterJadwalMap;
  masterRit: MasterRitMap;
  onReloadMaster: () => Promise<void>;
  onBackToLogin: () => void;
  onOpenLostFound: () => void;
  showToast: (msg: string, type?: ToastType) => void;
  setGlobalLoading: (loading: boolean) => void;
}

export function TimerScreen({
  petugasNama,
  masterJadwal,
  masterRit,
  onReloadMaster,
  onBackToLogin,
  onOpenLostFound,
  showToast,
  setGlobalLoading,
}: TimerScreenProps) {
  const [tanggal, setTanggal] = useState(tglHariIni());
  const [koridor, setKoridor] = useState('KOR01');
  const [lb, setLb] = useState('LB01');
  const [rit, setRit] = useState('R01');
  const [pola, setPola] = useState('REGULER');
  const [jadwal, setJadwal] = useState('');
  const [aktual, setAktual] = useState(jamSekarangHHMM());
  const [totPnp, setTotPnp] = useState('4');
  const [trPnp, setTrPnp] = useState('0');
  const [turPnp, setTurPnp] = useState('0');
  const [kendala, setKendala] = useState('-');
  const [catatan, setCatatan] = useState('');
  const [riwayat, setRiwayat] = useState<TimerRecord[]>(() =>
    bacaStorage<TimerRecord>(STORAGE_TIMER_KEY)
  );
  const [showRiwayat, setShowRiwayat] = useState(false);
  const [lastWaMsg, setLastWaMsg] = useState('');
  const [reloadingMaster, setReloadingMaster] = useState(false);
  const [sending, setSending] = useState(false);
  const [serverDuplicate, setServerDuplicate] = useState(false);

  const idPerjalanan = useMemo(
    () => `${koridor}-${lb}${rit}${tanggal.split('-').join('')}`,
    [koridor, lb, rit, tanggal]
  );

  const terminalAwal = useMemo(() => {
    const kunci = `${lb}-${rit}`;
    const info = masterRit[kunci] || masterRit[rit];
    if (info?.terminal) return info.terminal;
    return getTerminalAwalFromMasterRit(lb, rit);
  }, [lb, rit, masterRit]);

  const prevLbRef = useRef(lb);

  // Sinkronkan TimeTable dari Master saat koridor/lb/rit/pola/masterJadwal berubah
  useEffect(() => {
    const today = tglHariIni();
    setTanggal(today);
    const kunci = `${lb}-${rit}`;
    const switchedToCadangan = prevLbRef.current !== 'LBC01' && lb === 'LBC01';
    prevLbRef.current = lb;
    if (lb === 'LBC01') {
      setJadwal((prev) => (switchedToCadangan || !prev ? jamSekarangHHMM() : prev));
    } else {
      const pUpper = pola.toUpperCase().trim();
      let jamPola = masterJadwal[pUpper]?.[kunci] || '';
      if (!jamPola) {
        for (const p of Object.keys(masterJadwal)) {
          if (masterJadwal[p]?.[kunci]) {
            jamPola = masterJadwal[p][kunci];
            break;
          }
        }
      }
      setJadwal(normalisasiJamHHMM(jamPola));
    }
    setAktual(jamSekarangHHMM());
  }, [koridor, lb, rit, pola, masterJadwal]);

  const jamBerbeda = useMemo(() => {
    if (!jadwal || !aktual) return false;
    const mJd = jamKeMenit(jadwal);
    const mAk = jamKeMenit(aktual);
    if (mJd === null || mAk === null) {
      return normalisasiJamHHMM(jadwal) !== normalisasiJamHHMM(aktual);
    }
    return mJd !== mAk;
  }, [jadwal, aktual]);

  const statusSelisihLabel = useMemo(() => {
    if (!jadwal || !aktual) return '';
    const mJd = jamKeMenit(jadwal);
    const mAk = jamKeMenit(aktual);
    if (mJd === null || mAk === null) return 'Jam berbeda dari TimeTable';
    let diff = mAk - mJd;
    if (diff < -720) diff += 1440;
    else if (diff > 720) diff -= 1440;
    if (diff > 0) return `Telat ${diff} menit — WAJIB isi Keterangan`;
    if (diff < 0) return `Lebih awal ${Math.abs(diff)} menit — WAJIB isi Keterangan`;
    return '';
  }, [jadwal, aktual]);

  // Cek apakah ID_PERJALANAN sudah pernah tercatat di server Timer
  useEffect(() => {
    let cancelled = false;
    setServerDuplicate(false);
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
            setServerDuplicate(true);
          }
        } catch {
          // ignore parse error
        }
      })
      .catch(() => {
        // ignore network error saat offline
      });
    return () => {
      cancelled = true;
    };
  }, [idPerjalanan]);

  useEffect(() => {
    for (const r of riwayat) {
      if (r?.idPerjalanan && r.status !== 'GAGAL_KIRIM') {
        markSavedIdPerjalanan(IDS_TIMER_KEY, r.idPerjalanan);
      }
    }
  }, [riwayat]);

  const existingRecord = useMemo(
    () => riwayat.find((r) => r.idPerjalanan === idPerjalanan),
    [riwayat, idPerjalanan]
  );

  // Kunci duplikat jika sudah tersimpan di lokal (bukan GAGAL_KIRIM), registry ID, atau di server
  const sudahTerkirim = Boolean(
    (existingRecord && existingRecord.status !== 'GAGAL_KIRIM') ||
      hasSavedIdPerjalanan(IDS_TIMER_KEY, idPerjalanan) ||
      serverDuplicate
  );

  const todayRiwayat = useMemo(
    () => riwayat.filter((r) => r.tanggal === tanggal),
    [riwayat, tanggal]
  );

  const handleCekUlangMaster = async () => {
    setReloadingMaster(true);
    await onReloadMaster();
    setReloadingMaster(false);
    showToast('Data Master Jadwal & Terminal diperbarui.', 'ok');
  };

  const buildWaMessage = (pl: TimerRecord) =>
    `✅ *TEMAN ANTENG - VALIDASI TIMER*\n` +
    `ID_PERJALANAN: ${pl.idPerjalanan}\n` +
    `Koridor: ${pl.koridor}\n` +
    `Pola: ${pl.polaOperasional}\n` +
    `Tanggal: ${pl.tanggal}\n` +
    `Petugas: ${pl.petugas}\n` +
    `Bus: ${pl.noLambung} | Rit: ${pl.rit}\n` +
    `Terminal: ${pl.terminal}\n` +
    `Jadwal: ${pl.jadwal}\n` +
    `Aktual: ${pl.aktual}\n` +
    `PNP: Total ${pl.pnpNaik}\n` +
    `Transit ${pl.pnpTransit} | Turun ${pl.pnpTurun}\n` +
    `Kendala: ${pl.kendala}\n` +
    `Catatan: ${pl.catatan}`;

  const activeWaMsg = useMemo(() => {
    if (lastWaMsg) return lastWaMsg;
    if (existingRecord && existingRecord.status !== 'GAGAL_KIRIM') {
      return buildWaMessage(existingRecord);
    }
    return '';
  }, [lastWaMsg, existingRecord]);

  const kirimKeServer = async (pl: TimerRecord) => {
    setSending(true);
    setGlobalLoading(true);
    try {
      await fetch(API_TIMER, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(pl),
      });

      const current = bacaStorage<TimerRecord>(STORAGE_TIMER_KEY).filter(
        (r) => r.idPerjalanan !== pl.idPerjalanan
      );
      const saved: TimerRecord = { ...pl, status: 'PENDING' };
      const updated = [saved, ...current];
      markSavedIdPerjalanan(IDS_TIMER_KEY, pl.idPerjalanan);
      tulisStorage(STORAGE_TIMER_KEY, updated);
      setRiwayat(updated);
      setLastWaMsg(buildWaMessage(saved));
      showToast('Data Timer berhasil dikirim ke database!', 'ok');
    } catch {
      const current = bacaStorage<TimerRecord>(STORAGE_TIMER_KEY).filter(
        (r) => r.idPerjalanan !== pl.idPerjalanan
      );
      const failedRec: TimerRecord = { ...pl, status: 'GAGAL_KIRIM' };
      const updated = [failedRec, ...current];
      tulisStorage(STORAGE_TIMER_KEY, updated);
      setRiwayat(updated);
      showToast('Gagal terhubung ke server. Data disimpan lokal dan dapat dikirim ulang.', 'err');
    } finally {
      setSending(false);
      setGlobalLoading(false);
    }
  };

  const handleSimpan = async () => {
    if (sending) return;
    const freshRiwayat = bacaStorage<TimerRecord>(STORAGE_TIMER_KEY);
    const localDup = freshRiwayat.find(
      (r) => r.idPerjalanan === idPerjalanan && r.status !== 'GAGAL_KIRIM'
    );
    if (localDup || hasSavedIdPerjalanan(IDS_TIMER_KEY, idPerjalanan) || serverDuplicate) {
      showToast('ID_PERJALANAN SUDAH ADA', 'err');
      return;
    }
    if (!jadwal) {
      showToast('Jadwal TimeTable masih kosong. Tekan "Cek Ulang Master" terlebih dahulu.', 'warn');
      return;
    }
    if (!aktual) {
      showToast('Jam Aktual masih kosong.', 'warn');
      return;
    }
    const catTrim = catatan.trim();
    if (jamBerbeda && (!catTrim || catTrim === '-' || catTrim.length < 3)) {
      showToast('Jam berbeda dari jadwal! Wajib isi Keterangan minimal 3 huruf.', 'err');
      return;
    }

    // Verifikasi ulang ke server Timer sebelum kirim (timeout singkat agar tidak menghambat saat offline)
    try {
      const ctrl = new AbortController();
      const timerId = window.setTimeout(() => ctrl.abort(), 3500);
      const chkRes = await fetch(
        `${API_TIMER}?idPerjalanan=${encodeURIComponent(idPerjalanan)}&t=${Date.now()}`,
        { signal: ctrl.signal }
      );
      window.clearTimeout(timerId);
      const chkTxt = await chkRes.text();
      const tm = JSON.parse(chkTxt) as TimerLookupData;
      if (
        tm &&
        !tm.tidakKetemu &&
        !tm.error &&
        (tm.jadwal || tm.aktual || tm.terminal || tm.pnpNaik !== undefined)
      ) {
        markSavedIdPerjalanan(IDS_TIMER_KEY, idPerjalanan);
        setServerDuplicate(true);
        showToast('ID_PERJALANAN SUDAH ADA', 'err');
        return;
      }
    } catch {
      // Lanjut jika server tidak dapat dihubungi (mode offline)
    }

    const now = new Date();
    const kodeUnik =
      `${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}-` +
      String(Math.floor(Math.random() * 900) + 100);

    const pl: TimerRecord = {
      petugas: petugasNama,
      tanggal,
      koridor,
      noLambung: lb,
      rit,
      polaOperasional: pola,
      idPerjalanan,
      idTransaksi: `${idPerjalanan}-T${kodeUnik}`,
      terminal: terminalAwal,
      jadwal,
      aktual,
      pnpNaik: parseInt(totPnp, 10) || 0,
      pnpTransit: parseInt(trPnp, 10) || 0,
      pnpTurun: parseInt(turPnp, 10) || 0,
      kendala,
      catatan: catTrim || '-',
      status: 'PENDING',
      waktuKirim: `${pad2(now.getHours())}:${pad2(now.getMinutes())}`,
    };

    await kirimKeServer(pl);
  };

  const handleReset = () => {
    setTanggal(tglHariIni());
    setKoridor('KOR01');
    setLb('LB01');
    setRit('R01');
    setAktual(jamSekarangHHMM());
    setTotPnp('4');
    setTrPnp('0');
    setTurPnp('0');
    setKendala('-');
    setCatatan('');
    setLastWaMsg('');
    setShowRiwayat(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const ketKurang = jamBerbeda && (catatan.trim() === '' || catatan.trim() === '-' || catatan.trim().length < 3);

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <div className="max-w-xl mx-auto bg-white min-h-screen shadow-sm border-x border-slate-200 flex flex-col">
        {/* Header */}
        <div className="bg-[#FF473A] text-white p-5 rounded-b-3xl flex items-center gap-4 relative">
          <BrandLogo className="w-16 h-16 p-1 border-2 border-white/80" />
          <div className="pr-10">
            <h2 className="text-xl font-extrabold leading-tight">Selamat Bekerja {petugasNama},</h2>
            <p className="text-sm text-white/90 font-medium">Harap isi sesuai keadaan lapangan</p>
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
            <p className="text-sm font-semibold text-slate-500">Petugas Timer</p>
          </div>

          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wide text-slate-700 mb-1">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">
                Pola Operasional
              </label>
              <select
                value={pola}
                onChange={(e) => setPola(e.target.value)}
                className="w-full px-3 py-3 rounded-xl border-2 border-slate-800 font-bold text-center bg-white"
              >
                <option value="REGULER">REGULER</option>
                <option value="WEEKEND">WEEKEND</option>
                <option value="LIBUR1">LIBUR1</option>
                <option value="LIBUR2">LIBUR2</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">
                Terminal Awal
              </label>
              <input
                type="text"
                value={terminalAwal}
                readOnly
                placeholder="-"
                className="w-full px-3 py-3 rounded-xl border-2 border-slate-800 bg-rose-50 font-bold text-center text-slate-900"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-extrabold text-slate-700">ID_PERJALANAN</label>
              <button
                type="button"
                onClick={() => void handleCekUlangMaster()}
                disabled={reloadingMaster}
                className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${reloadingMaster ? 'animate-spin' : ''}`} />
                Cek Ulang Master
              </button>
            </div>
            <input
              type="text"
              value={idPerjalanan}
              readOnly
              className="w-full px-3 py-3 rounded-xl border-2 border-slate-800 bg-rose-50 font-mono-num font-extrabold text-center text-red-800 text-lg"
            />
            {sudahTerkirim && (
              <div className="mt-2 rounded-xl border-2 border-red-300 bg-red-50 px-3 py-2 text-center text-xs font-extrabold text-red-800">
                ID_PERJALANAN SUDAH ADA ({idPerjalanan})
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">
                TimeTable{' '}
                <span className="text-[11px] font-semibold text-slate-500">
                  {lb === 'LBC01' ? '(Manual - Cadangan)' : `(Master - ${pola})`}
                </span>
              </label>
              <input
                type="time"
                value={jadwal}
                readOnly={lb !== 'LBC01'}
                onChange={(e) => setJadwal(e.target.value)}
                className="w-full px-3 py-3 rounded-xl border-2 border-slate-800 bg-rose-50 font-mono-num font-bold text-center text-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">Aktual</label>
              <input
                type="time"
                value={aktual}
                onChange={(e) => setAktual(e.target.value)}
                className="w-full px-3 py-3 rounded-xl border-2 border-slate-800 bg-rose-50 font-mono-num font-bold text-center text-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">Total PNP</label>
              <input
                type="number"
                min={0}
                value={totPnp}
                onChange={(e) => setTotPnp(e.target.value)}
                className="w-full px-2 py-3 rounded-xl border-2 border-slate-800 bg-rose-50 font-mono-num font-bold text-center text-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">PNP Transit</label>
              <input
                type="number"
                min={0}
                value={trPnp}
                onChange={(e) => setTrPnp(e.target.value)}
                className="w-full px-2 py-3 rounded-xl border-2 border-slate-800 bg-rose-50 font-mono-num font-bold text-center text-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">PNP Turun</label>
              <input
                type="number"
                min={0}
                value={turPnp}
                onChange={(e) => setTurPnp(e.target.value)}
                className="w-full px-2 py-3 rounded-xl border-2 border-slate-800 bg-rose-50 font-mono-num font-bold text-center text-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-extrabold text-slate-700 mb-1">Kendala Bus</label>
            <select
              value={kendala}
              onChange={(e) => setKendala(e.target.value)}
              className="w-full px-3 py-3 rounded-xl border-2 border-slate-800 bg-rose-50 font-bold text-center"
            >
              <option value="-">Tidak Ada Kendala</option>
              <option value="Mesin Mogok">Mesin Mogok</option>
              <option value="Ban Bocor">Ban Bocor</option>
              <option value="AC Mati">AC Mati</option>
              <option value="Rem Bermasalah">Rem Bermasalah</option>
              <option value="Pintu Rusak">Pintu Rusak</option>
              <option value="Macet Parah">Macet Parah</option>
              <option value="Kecelakaan">Kecelakaan</option>
              <option value="Lainnya">Lainnya</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-extrabold text-slate-700 mb-1">
              Keterangan{' '}
              {jamBerbeda && (
                <span className="text-red-600 font-bold">({statusSelisihLabel})</span>
              )}
            </label>
            <div
              className={`rounded-xl p-1 ${
                jamBerbeda ? 'bg-amber-100 border-2 border-red-600' : 'bg-amber-100 border border-amber-300'
              }`}
            >
              <input
                type="text"
                placeholder="Catatan..."
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                className="w-full px-3 py-2.5 bg-transparent font-bold text-center text-slate-900 focus:outline-none text-lg"
              />
            </div>
          </div>

          <div className="space-y-2.5 pt-2">
            <button
              type="button"
              disabled={sending}
              onClick={() => void handleSimpan()}
              className={`w-full py-4 rounded-2xl font-extrabold text-lg text-white transition-colors cursor-pointer disabled:cursor-not-allowed ${
                sudahTerkirim
                  ? 'bg-red-700 hover:bg-red-800'
                  : ketKurang
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-emerald-500 hover:bg-emerald-600'
              }`}
            >
              {sending
                ? 'MENGIRIM KE DATABASE...'
                : sudahTerkirim
                ? 'ID_PERJALANAN SUDAH ADA'
                : existingRecord?.status === 'GAGAL_KIRIM'
                ? 'KIRIM ULANG KE DATABASE'
                : ketKurang
                ? 'ISI KETERANGAN DULU - JAM BERBEDA'
                : 'SIMPAN KE DATABASE'}
            </button>

            {activeWaMsg && (
              <WhatsAppShareBox
                message={activeWaMsg}
                onCopied={(ok) =>
                  showToast(
                    ok ? 'Pesan validasi WA berhasil disalin.' : 'Gagal menyalin pesan WA.',
                    ok ? 'ok' : 'err'
                  )
                }
              />
            )}

            {lastWaMsg && (
              <button
                type="button"
                onClick={handleReset}
                className="w-full py-3.5 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-extrabold text-base cursor-pointer"
              >
                INPUT BUS BERIKUTNYA
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

          {/* Toggle Riwayat */}
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
                <span className="font-extrabold text-slate-900">RIWAYAT VALIDASI</span>
                <span className="text-xs font-bold text-slate-600">{todayRiwayat.length} data</span>
              </div>
              {todayRiwayat.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-4">Belum ada data hari ini</p>
              ) : (
                todayRiwayat.map((d) => (
                  <div
                    key={d.idTransaksi}
                    className="bg-white border border-slate-300 rounded-xl p-3 text-sm space-y-1"
                  >
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-extrabold text-slate-900">
                        {d.noLambung} | {d.rit}
                      </span>
                      <span
                        className={`text-xs font-extrabold ${
                          d.status === 'GAGAL_KIRIM'
                            ? 'text-red-700'
                            : d.status === 'TERVALIDASI'
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {d.status}
                      </span>
                    </div>
                    <div className="text-xs font-mono-num text-slate-500">{d.idPerjalanan}</div>
                    <div className="text-xs text-slate-700">
                      Jadwal {d.jadwal} | Aktual {d.aktual} · Total {d.pnpNaik} | Transit{' '}
                      {d.pnpTransit} | Turun {d.pnpTurun}
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
