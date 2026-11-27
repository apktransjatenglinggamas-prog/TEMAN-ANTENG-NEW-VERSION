// TimerScreen — UTUH, dengan Panel Cadangan LBC01
// Fungsi lama TIDAK diubah: input LB/RIT, Jadwal, Aktual, Penumpang, Kirim ke API_TIMER,
// cek duplikat ID_PERJALANAN, simpan lokal. Yang ditambah HANYA panel LBC01
// (4 state + 1 validasi + 4 field kirim + 1 panel JSX + ID otomatis GANTI).
import { useEffect, useMemo, useState } from 'react';
import {
  API_TIMER,
  IDS_TIMER_KEY,
  KATEGORI_LIST,
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
  normalKunciJS,
  normalisasiJamHHMM,
  pad2,
  tglHariIni,
  timestampSekarang,
  tulisStorage,
} from '../utils/anteng';
import type { MasterJadwalMap, MasterRitMap } from '../types/anteng';

type TimerRecord = Record<string, unknown>;

export default function TimerScreen(props: {
  onBack: () => void;
  onOpenLostFound?: () => void;
  petugasNama: string;
  masterJadwal: MasterJadwalMap;
  masterRit: MasterRitMap;
  showToast: (msg: string, type: 'ok' | 'err' | 'warn') => void;
  setGlobalLoading: (v: boolean) => void;
}) {
  const { onBack, onOpenLostFound, petugasNama, masterJadwal, masterRit, showToast, setGlobalLoading } = props;
  const [tanggal, setTanggal] = useState(tglHariIni());
  const [koridor, setKoridor] = useState('KOR01');
  const [lb, setLb] = useState('LB01');
  const [rit, setRit] = useState('R01');
  const [pola, setPola] = useState('REGULER');
  // ===== PANEL CADANGAN LBC01 — PENAMBAHAN SAJA =====
  const [statusPerjalanan, setStatusPerjalanan] = useState('NORMAL');
  const [idPerjalananAsal, setIdPerjalananAsal] = useState('');
  const [titikGanti, setTitikGanti] = useState('TERMINAL_AWAL');
  const [halteTitikGanti, setHalteTitikGanti] = useState('');
  const isCadangan = lb === 'LBC01';
  const tampilPanelCadangan = isCadangan; // panel HANYA kalau LB = LBC01 — jangan ikut status, biar tidak nyangkut saat LB diganti
  const statusPerjalananEfektif = tampilPanelCadangan ? statusPerjalanan : 'NORMAL';
  const [jadwal, setJadwal] = useState('');
  const [aktual, setAktual] = useState(jamSekarangHHMM());
  const [pnpNaik, setPnpNaik] = useState('');
  const [pnpTransit, setPnpTransit] = useState('');
  const [pnpTurun, setPnpTurun] = useState('');
  const [ket, setKet] = useState('');
  const [sending, setSending] = useState(false);
  const [riwayat, setRiwayat] = useState<TimerRecord[]>(() => bacaStorage<TimerRecord>(STORAGE_TIMER_KEY));
  const [showRiwayat, setShowRiwayat] = useState(false);

  // ID_PERJALANAN: normal = KOR01-LB05R0320261127.
  // Kalau LBC01 + ID asal diisi, otomatis pakai suffix GANTI agar tidak tertukar
  // dengan ID bus reguler dan tidak dianggap duplikat.
  const idPerjalanan = useMemo(
    () =>
      isCadangan && idPerjalananAsal.trim()
        ? `${koridor}-LBC01${rit}${tanggal.split('-').join('')}-GANTI-${idPerjalananAsal.trim().toUpperCase()}`
        : `${koridor}-${lb}${rit}${tanggal.split('-').join('')}`,
    [koridor, lb, rit, tanggal, isCadangan, idPerjalananAsal]
  );

  const ritInfo = useMemo(() => {
    const kunci = normalKunciJS(`${lb}-${rit}`) || `${lb}-${rit}`;
    return masterRit[kunci] || masterRit[rit] || null;
  }, [lb, rit, masterRit]);

  const terminalAwal = ritInfo?.terminal || getTerminalAwalFromMasterRit(lb, rit);
  const arah = ritInfo?.arah || (terminalAwal === 'BUKATEJA' ? 'BK-BP' : 'BP-BK');

  // Jadwal otomatis dari master jadwal (pola + LB-RIT). Petugas boleh ubah manual.
  useEffect(() => {
    const j = masterJadwal?.[pola]?.[normalKunciJS(`${lb}-${rit}`) || `${lb}-${rit}`] || '';
    if (j) setJadwal(normalisasiJamHHMM(j) || j);
  }, [lb, rit, pola, masterJadwal]);

  const selisihMenit = useMemo(() => {
    const mJ = jamKeMenit(jadwal);
    const mA = jamKeMenit(aktual);
    if (mJ === null || mA === null) return null;
    let d = mA - mJ;
    if (d < 0) d += 1440;
    return d;
  }, [jadwal, aktual]);

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
    if (!jadwal || !aktual) {
      showToast('Jadwal dan Jam Berangkat Aktual wajib diisi.', 'warn');
      return;
    }
    // Duplikat: ID_PERJALANAN tidak boleh double (logika lama, tidak diubah)
    const fresh = bacaStorage<TimerRecord>(STORAGE_TIMER_KEY);
    if (
      fresh.some((r) => String(r.idPerjalanan) === idPerjalanan) ||
      hasSavedIdPerjalanan(IDS_TIMER_KEY, idPerjalanan)
    ) {
      showToast(`ID_PERJALANAN ${idPerjalanan} SUDAH ADA. Simpan ditolak agar data tidak ganda.`, 'err');
      return;
    }
    const now = new Date();
    const rec: TimerRecord = {
      tanggal,
      koridor,
      noLambung: lb,
      rit,
      polaOperasional: pola,
      idPerjalanan,
      terminal: terminalAwal,
      arah,
      jadwal,
      aktual,
      selisihMenit,
      pnpNaik: parseInt(pnpNaik, 10) || 0,
      pnpTransit: parseInt(pnpTransit, 10) || 0,
      pnpTurun: parseInt(pnpTurun, 10) || 0,
      petugas: petugasNama,
      keterangan: ket.trim() || '-',
      // ===== 4 field cadangan — penambahan saja =====
      statusPerjalanan: statusPerjalananEfektif,
      idPerjalananAsal: tampilPanelCadangan ? idPerjalananAsal.trim().toUpperCase() : '',
      titikGanti: tampilPanelCadangan ? titikGanti : '',
      halteTitikGanti: tampilPanelCadangan ? halteTitikGanti.trim().toUpperCase() : '',
      status: 'Terkirim',
      waktuKirim: `${pad2(now.getHours())}:${pad2(now.getMinutes())}`,
      createdAt: timestampSekarang(),
    };
    setSending(true);
    setGlobalLoading(true);
    try {
      await fetch(API_TIMER, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(rec),
      });
      const updated = [rec, ...fresh.filter((r) => String(r.idPerjalanan) !== idPerjalanan)];
      markSavedIdPerjalanan(IDS_TIMER_KEY, idPerjalanan);
      tulisStorage(STORAGE_TIMER_KEY, updated);
      setRiwayat(updated);
      showToast('Timer berhasil dikirim ke database!', 'ok');
    } catch {
      const failed = { ...rec, status: 'GAGAL_KIRIM' };
      const updated = [failed, ...fresh.filter((r) => String(r.idPerjalanan) !== idPerjalanan)];
      tulisStorage(STORAGE_TIMER_KEY, updated);
      setRiwayat(updated);
      showToast('Gagal terhubung ke server. Data Timer disimpan lokal untuk dikirim ulang.', 'err');
    } finally {
      setSending(false);
      setGlobalLoading(false);
    }
  };

  const handleReset = () => {
    setTanggal(tglHariIni());
    setLb('LB01');
    setRit('R01');
    setPola('REGULER');
    setStatusPerjalanan('NORMAL');
    setIdPerjalananAsal('');
    setTitikGanti('TERMINAL_AWAL');
    setHalteTitikGanti('');
    setAktual(jamSekarangHHMM());
    setPnpNaik('');
    setPnpTransit('');
    setPnpTurun('');
    setKet('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <div className="max-w-xl mx-auto bg-white min-h-screen shadow-sm border-x border-slate-200 flex flex-col">
        <div className="bg-gradient-to-br from-[#0056b3] to-[#003366] text-white p-4 relative">
          <button type="button" onClick={onBack} className="text-sm font-bold underline cursor-pointer">← Kembali</button>
          {onOpenLostFound && (
            <button type="button" onClick={onOpenLostFound} className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-amber-400 hover:bg-amber-500 text-amber-950 text-xs font-extrabold cursor-pointer">🧳 Barang Tertinggal</button>
          )}
          <h1 className="text-xl font-extrabold mt-1">TIMER — Keberangkatan Bus</h1>
          <p className="text-xs opacity-80">Petugas: {petugasNama} | Terminal Awal: {terminalAwal} | Arah: {arah}</p>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-extrabold text-slate-700 mb-1">Tanggal</label>
            <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className="w-full px-3 py-3 rounded-xl border-2 border-slate-800 font-bold text-center bg-white" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">Koridor</label>
              <select value={koridor} onChange={(e) => setKoridor(e.target.value)} className="w-full px-2 py-3 rounded-xl border-2 border-slate-800 font-bold text-center bg-white">
                {LIST_KORIDOR.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">No. Lambung</label>
              <select value={lb} onChange={(e) => setLb(e.target.value)} className="w-full px-2 py-3 rounded-xl border-2 border-slate-800 font-bold text-center bg-white">
                {LIST_LB.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">Rit Ke</label>
              <select value={rit} onChange={(e) => setRit(e.target.value)} className="w-full px-2 py-3 rounded-xl border-2 border-slate-800 font-bold text-center bg-white">
                {LIST_RIT.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">Pola</label>
              <select value={pola} onChange={(e) => setPola(e.target.value)} className="w-full px-2 py-3 rounded-xl border-2 border-slate-800 font-bold text-center bg-white">
                {['REGULER', 'WEEKEND', 'LIBUR1', 'LIBUR2'].map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>
          </div>
          {/* ===== PANEL CADANGAN LBC01 — muncul otomatis kalau LB = LBC01 ===== */}
          {tampilPanelCadangan && (
            <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-3.5 space-y-2.5">
              <p className="font-extrabold text-amber-900">🚌 ARMADA CADANGAN AKTIF — {lb}</p>
              <p className="text-xs text-amber-800">Bus ini menggantikan bus reguler. ID Perjalanan otomatis pakai suffix GANTI agar tidak tertukar dengan bus reguler.</p>
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
            <label className="block text-xs font-extrabold text-slate-700 mb-1">ID_PERJALANAN</label>
            <input type="text" value={idPerjalanan} readOnly className="w-full px-3 py-3 rounded-xl border-2 border-slate-800 bg-rose-50 font-mono-num font-extrabold text-center text-blue-900 text-lg" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">Jadwal Berangkat</label>
              <input type="time" value={jadwal} onChange={(e) => setJadwal(e.target.value)} className="w-full px-3 py-3 rounded-xl border-2 border-slate-800 font-bold text-center bg-white" />
            </div>
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">Jam Berangkat Aktual</label>
              <input type="time" value={aktual} onChange={(e) => setAktual(e.target.value)} className="w-full px-3 py-3 rounded-xl border-2 border-slate-800 font-bold text-center bg-white" />
            </div>
          </div>
          {selisihMenit !== null && (<p className="text-xs font-bold text-slate-600 text-center">Selisih: {selisihMenit} menit dari jadwal</p>)}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">Pnp Naik</label>
              <input type="number" min={0} value={pnpNaik} onChange={(e) => setPnpNaik(e.target.value)} placeholder="0" className="w-full px-2 py-3 rounded-xl border-2 border-slate-800 font-bold text-center text-lg bg-white" />
            </div>
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">Pnp Transit</label>
              <input type="number" min={0} value={pnpTransit} onChange={(e) => setPnpTransit(e.target.value)} placeholder="0" className="w-full px-2 py-3 rounded-xl border-2 border-slate-800 font-bold text-center text-lg bg-white" />
            </div>
            <div>
              <label className="block text-xs font-extrabold text-slate-700 mb-1">Pnp Turun</label>
              <input type="number" min={0} value={pnpTurun} onChange={(e) => setPnpTurun(e.target.value)} placeholder="0" className="w-full px-2 py-3 rounded-xl border-2 border-slate-800 font-bold text-center text-lg bg-white" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-extrabold text-slate-700 mb-1">Keterangan</label>
            <input type="text" placeholder="Catatan..." value={ket} onChange={(e) => setKet(e.target.value)} className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-800 font-bold text-center bg-white" />
          </div>
          <button type="button" disabled={sending} onClick={() => void handleSimpan()} className="w-full py-4 rounded-2xl font-extrabold text-lg text-white bg-[#004080] hover:bg-blue-950 disabled:cursor-not-allowed cursor-pointer">
            {sending ? 'MENGIRIM...' : 'SIMPAN DAN KIRIM TIMER'}
          </button>
          <button type="button" onClick={handleReset} className="w-full py-3 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-extrabold cursor-pointer">INPUT BUS BERIKUTNYA</button>
          <div className="pt-2 text-center">
            <button type="button" onClick={() => setShowRiwayat((v) => !v)} className="text-blue-600 font-extrabold underline text-sm cursor-pointer">
              {showRiwayat ? 'Sembunyikan Riwayat Timer' : 'Lihat Riwayat Timer'}
            </button>
            <span className="ml-2 text-xs font-bold text-slate-600">({riwayat.filter((r) => String(r.tanggal) === tanggal).length} data hari ini)</span>
          </div>
          {showRiwayat && (
            <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 space-y-2.5">
              {riwayat.filter((r) => String(r.tanggal) === tanggal).length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-4">Belum ada data Timer hari ini</p>
              ) : (
                riwayat.filter((r) => String(r.tanggal) === tanggal).map((d, idx) => (
                  <div key={`${String(d.idPerjalanan)}-${idx}`} className="bg-white border border-slate-300 rounded-xl p-3 text-sm space-y-1">
                    <div className="flex justify-between"><span className="font-extrabold">{String(d.noLambung)} | {String(d.rit)}</span><span className="text-xs font-extrabold text-emerald-700">{String(d.status)}</span></div>
                    <div className="text-xs font-mono-num text-slate-500">{String(d.idPerjalanan)}</div>
                    <div className="text-xs text-slate-700">Jadwal {String(d.jadwal)} → Aktual {String(d.aktual)}</div>
                    <div className="text-xs text-slate-700">Naik {String(d.pnpNaik)} | Transit {String(d.pnpTransit)} | Turun {String(d.pnpTurun)}</div>
                    {String(d.statusPerjalanan || '') !== 'NORMAL' && String(d.statusPerjalanan || '') !== '' && (
                      <div className="text-xs font-bold text-amber-800">🚌 {String(d.statusPerjalanan)} — Ganti: {String(d.idPerjalananAsal || '-')}</div>
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

// Named export untuk App.tsx: import { TimerScreen } from './TimerScreen'
// (file ini juga tetap punya default export, jadi 2 cara import jalan)
export { TimerScreen };
