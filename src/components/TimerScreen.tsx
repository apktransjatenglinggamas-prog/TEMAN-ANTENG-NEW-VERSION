// TimerScreen — VERSI SEBELUMNYA (sesuai screenshot) + Panel LBC01 (PENAMBAHAN SAJA)
// Tampilan & fungsi versi sebelumnya TIDAK DIUBAH:
// header merah "Selamat Bekerja", Tanggal Operasional, Koridor / LB / Rit,
// Pola Operasional, Terminal Awal, ID + Cek Ulang Master, banner duplikat,
// TimeTable (Master) + Aktual, Total PNP / Transit / Turun, Kendala Bus,
// Keterangan (Lebih awal X menit — WAJIB isi Keterangan),
// tombol ID SUDAH ADA / SIMPAN, BARANG TERTINGGAL, Lihat Riwayat Validasi,
// footer "dibuat Oleh Ali Setiadi".
// Yang ditambahkan HANYA 6 titik panel LBC01:
//  (1) 4 state, (2) tampilPanelCadangan, (3) ID -GANTI-,
//  (4) 1 validasi ID Asal, (5) 4 field kirim, (6) 1 panel JSX.
import { useEffect, useMemo, useState } from 'react';
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
  normalKunciJS,
  normalisasiJamHHMM,
  pad2,
  tglHariIni,
  timestampSekarang,
  tulisStorage,
} from '../utils/anteng';
import type { MasterJadwalMap, MasterRitMap } from '../types/anteng';

type TimerRecord = Record<string, unknown>;

const KENDALA_LIST = [
  'Tidak Ada Kendala',
  'Mogok',
  'Ban Bocor',
  'Mesin Bermasalah',
  'Kecelakaan',
  'Terlambat',
  'Lainnya',
];

export default function TimerScreen(props: {
  onBack: () => void;
  onOpenLostFound?: () => void;
  onRefreshMaster?: () => void;
  petugasNama: string;
  masterJadwal: MasterJadwalMap;
  masterRit: MasterRitMap;
  showToast: (msg: string, type: 'ok' | 'err' | 'warn') => void;
  setGlobalLoading: (v: boolean) => void;
}) {
  const { onBack, onOpenLostFound, onRefreshMaster, petugasNama, masterJadwal, masterRit, showToast, setGlobalLoading } = props;
  const [tanggal, setTanggal] = useState(tglHariIni());
  const [koridor, setKoridor] = useState('KOR01');
  const [lb, setLb] = useState('LB01');
  const [rit, setRit] = useState('R01');
  const [pola, setPola] = useState('REGULER');
  // ===== PANEL CADANGAN LBC01 — PENAMBAHAN SAJA (1) =====
  const [statusPerjalanan, setStatusPerjalanan] = useState('NORMAL');
  const [idPerjalananAsal, setIdPerjalananAsal] = useState('');
  const [titikGanti, setTitikGanti] = useState('TERMINAL_AWAL');
  const [halteTitikGanti, setHalteTitikGanti] = useState('');
  const isCadangan = lb === 'LBC01';
  const tampilPanelCadangan = isCadangan; // ===== (2) panel HANYA kalau LB = LBC01 =====
  const statusPerjalananEfektif = tampilPanelCadangan ? statusPerjalanan : 'NORMAL';
  const [jadwal, setJadwal] = useState('');
  const [aktual, setAktual] = useState(jamSekarangHHMM());
  const [totalPnp, setTotalPnp] = useState('');
  const [pnpTransit, setPnpTransit] = useState('');
  const [pnpTurun, setPnpTurun] = useState('');
  const [kendala, setKendala] = useState('Tidak Ada Kendala');
  const [ket, setKet] = useState('');
  const [sending, setSending] = useState(false);
  const [riwayat, setRiwayat] = useState<TimerRecord[]>(() => bacaStorage<TimerRecord>(STORAGE_TIMER_KEY));
  const [showRiwayat, setShowRiwayat] = useState(false);

  // ===== ID_PERJALANAN — (3) LBC01 + ID asal = suffix -GANTI- =====
  const idPerjalanan = useMemo(
    () =>
      isCadangan && idPerjalananAsal.trim()
        ? `${koridor}-LBC01${rit}${tanggal.split('-').join('')}-GANTI-${idPerjalananAsal.trim()}`
        : `${koridor}-${lb}${rit}${tanggal.split('-').join('')}`,
    [koridor, lb, rit, tanggal, isCadangan, idPerjalananAsal]
  );

  const ritInfo = useMemo(() => {
    const kunci = normalKunciJS(`${lb}-${rit}`) || `${lb}-${rit}`;
    return masterRit[kunci] || masterRit[rit] || null;
  }, [lb, rit, masterRit]);

  const terminalAwal = ritInfo?.terminal || getTerminalAwalFromMasterRit(lb, rit);
  const arah = ritInfo?.arah || (terminalAwal === 'BUKATEJA' ? 'BK-BP' : 'BP-BK');

  // TimeTable otomatis dari master jadwal (pola + LB-RIT). Petugas boleh ubah manual.
  useEffect(() => {
    const j = masterJadwal?.[pola]?.[normalKunciJS(`${lb}-${rit}`) || `${lb}-${rit}`] || '';
    if (j) setJadwal(normalisasiJamHHMM(j) || j);
  }, [lb, rit, pola, masterJadwal]);

  // "Lebih awal" = Jadwal − Aktual (lewat tengah malam dihitung +1440).
  // Bukti cocok dengan screenshot: 05.15 − 18.31 + 1440 = 644 menit.
  const lebihAwalMenit = useMemo(() => {
    const mJ = jamKeMenit(jadwal);
    const mA = jamKeMenit(aktual);
    if (mJ === null || mA === null) return null;
    let d = mJ - mA;
    if (d < 0) d += 1440;
    return d;
  }, [jadwal, aktual]);

  const isDuplikat = useMemo(() => {
    const fresh = bacaStorage<TimerRecord>(STORAGE_TIMER_KEY);
    return (
      fresh.some((r) => String(r.idPerjalanan) === idPerjalanan) ||
      hasSavedIdPerjalanan(IDS_TIMER_KEY, idPerjalanan)
    );
  }, [idPerjalanan, riwayat]);

  const handleCekUlangMaster = () => {
    if (onRefreshMaster) {
      onRefreshMaster();
      return;
    }
    const j = masterJadwal?.[pola]?.[normalKunciJS(`${lb}-${rit}`) || `${lb}-${rit}`] || '';
    if (j) setJadwal(normalisasiJamHHMM(j) || j);
    showToast('Master dicek ulang.', 'ok');
  };

  const handleSimpan = async () => {
    if (sending) return;
    // ===== (4) Validasi panel LBC01 — penambahan saja =====
    if (isCadangan && !idPerjalananAsal.trim()) {
      showToast('Isi dulu Bus yang diganti (ID Perjalanan Asal) untuk LBC01.', 'warn');
      return;
    }
    if (!jadwal || !aktual) {
      showToast('TimeTable dan Aktual wajib diisi.', 'warn');
      return;
    }
    // Keterangan WAJIB kalau lebih awal (fungsi lama versi sebelumnya)
    if (lebihAwalMenit !== null && lebihAwalMenit > 0 && !ket.trim()) {
      showToast(`Lebih awal ${lebihAwalMenit} menit — WAJIB isi Keterangan.`, 'warn');
      return;
    }
    // Duplikat: ID_PERJALANAN tidak boleh double (fungsi lama, tidak diubah)
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
      lebihAwalMenit,
      pnpNaik: parseInt(totalPnp, 10) || 0,
      pnpTransit: parseInt(pnpTransit, 10) || 0,
      pnpTurun: parseInt(pnpTurun, 10) || 0,
      kendalaBus: kendala,
      petugas: petugasNama,
      keterangan: ket.trim() || '-',
      // ===== (5) 4 field cadangan — penambahan saja =====
      statusPerjalanan: statusPerjalananEfektif,
      idPerjalananAsal: tampilPanelCadangan ? idPerjalananAsal.trim() : '',
      titikGanti: tampilPanelCadangan ? titikGanti : '',
      halteTitikGanti: tampilPanelCadangan ? halteTitikGanti : '',
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

  const labelCls = 'block text-lg font-bold text-slate-800 mb-1.5';
  const inputCls = 'w-full px-3 py-3.5 rounded-2xl border-2 border-slate-800 font-bold text-center text-xl bg-white';
  const riwayatHariIni = riwayat.filter((r) => String(r.tanggal) === tanggal);

  return (
    <div className="min-h-screen bg-slate-100 pb-10">
      <div className="max-w-xl mx-auto bg-white min-h-screen shadow-sm flex flex-col">
        {/* ===== HEADER MERAH — versi sebelumnya ===== */}
        <div className="bg-[#FF2E1F] text-white px-5 pt-4 pb-6 rounded-b-[2rem] relative">
          <button type="button" onClick={onBack} className="absolute top-3 right-3 w-10 h-10 rounded-full bg-slate-900 text-white text-xl font-bold flex items-center justify-center cursor-pointer">←</button>
          <div className="flex items-center gap-3">
            <div className="w-20 h-20 shrink-0 rounded-full bg-white flex flex-col items-center justify-center text-center leading-none">
              <span className="text-2xl">🚌</span>
              <span className="text-[9px] font-extrabold text-blue-800">transjateng</span>
            </div>
            <div>
              <p className="text-xl font-extrabold leading-tight">Selamat Bekerja {petugasNama.toUpperCase()},</p>
              <p className="text-base opacity-90 leading-tight">Harap isi sesuai keadaan lapangan</p>
            </div>
          </div>
        </div>

        <div className="px-4 pt-6 space-y-5">
          <div className="text-center">
            <p className="text-2xl font-extrabold tracking-tight">{petugasNama.toUpperCase()}</p>
            <p className="text-slate-500 text-lg">Petugas Timer</p>
          </div>

          {/* ===== TANGGAL OPERASIONAL ===== */}
          <div>
            <label className={labelCls}>TANGGAL OPERASIONAL</label>
            <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className={`${inputCls} bg-slate-200 !text-2xl`} />
          </div>

          {/* ===== KORIDOR / LB / RIT ===== */}
          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className={labelCls}>Koridor</label>
              <select value={koridor} onChange={(e) => setKoridor(e.target.value)} className={inputCls}>
                {LIST_KORIDOR.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>
            <div>
              <label className={labelCls}>No. Lambung</label>
              <select value={lb} onChange={(e) => setLb(e.target.value)} className={inputCls}>
                {LIST_LB.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Rit Ke</label>
              <select value={rit} onChange={(e) => setRit(e.target.value)} className={inputCls}>
                {LIST_RIT.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>
          </div>

          {/* ===== POLA OPERASIONAL ===== */}
          <div>
            <label className={labelCls}>Pola Operasional</label>
            <select value={pola} onChange={(e) => setPola(e.target.value)} className={inputCls}>
              {['REGULER', 'WEEKEND', 'LIBUR1', 'LIBUR2'].map((c) => (<option key={c} value={c}>{c}</option>))}
            </select>
          </div>

          {/* ===== TERMINAL AWAL ===== */}
          <div>
            <label className={labelCls}>Terminal Awal</label>
            <input type="text" value={terminalAwal} readOnly className={`${inputCls} bg-rose-50`} />
          </div>

          {/* ===== (6) PANEL CADANGAN LBC01 — muncul otomatis kalau LB = LBC01 ===== */}
          {tampilPanelCadangan && (
            <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-3.5 space-y-2.5">
              <p className="font-extrabold text-amber-900 text-lg">🚌 ARMADA CADANGAN AKTIF — {lb}</p>
              <p className="text-sm text-amber-800">Bus ini menggantikan bus reguler. ID Perjalanan otomatis pakai suffix GANTI agar tidak tertukar dengan bus reguler.</p>
              <div>
                <label className="block text-sm font-extrabold text-slate-700 mb-1">Status Perjalanan</label>
                <select value={statusPerjalanan} onChange={(e) => setStatusPerjalanan(e.target.value)} className="w-full px-2 py-3 rounded-xl border-2 border-slate-800 font-bold text-center bg-white">
                  <option value="PENGGANTI">PENGGANTI</option>
                  <option value="LANJUTAN_SETELAH_PERBAIKAN">LANJUTAN_SETELAH_PERBAIKAN</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-extrabold text-slate-700 mb-1">Menggantikan Bus (ID Perjalanan Asal)</label>
                <input type="text" placeholder="Contoh: KOR01-LB05R0320261127" value={idPerjalananAsal} onChange={(e) => setIdPerjalananAsal(e.target.value)} className="w-full px-3 py-3 rounded-xl border-2 border-slate-800 bg-white font-mono-num font-bold text-center" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-extrabold text-slate-700 mb-1">Titik Ganti</label>
                  <select value={titikGanti} onChange={(e) => setTitikGanti(e.target.value)} className="w-full px-2 py-3 rounded-xl border-2 border-slate-800 font-bold text-center bg-white">
                    <option value="TERMINAL_AWAL">TERMINAL_AWAL</option>
                    <option value="TENGAH_JALAN">TENGAH_JALAN</option>
                    <option value="AKHIR_RIT">AKHIR_RIT</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-extrabold text-slate-700 mb-1">Halte Titik Ganti</label>
                  <input type="text" placeholder="Nama halte (jika tengah jalan)" value={halteTitikGanti} onChange={(e) => setHalteTitikGanti(e.target.value)} className="w-full px-3 py-3 rounded-xl border-2 border-slate-800 bg-white font-bold text-center" />
                </div>
              </div>
            </div>
          )}

          {/* ===== ID_PERJALANAN ===== */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-lg font-bold text-slate-800">ID_PERJALANAN</label>
              <button type="button" onClick={handleCekUlangMaster} className="text-blue-700 font-bold text-base flex items-center gap-1 cursor-pointer">⟳ Cek Ulang Master</button>
            </div>
            <input type="text" value={idPerjalanan} readOnly className={`${inputCls} bg-rose-50 text-red-700`} />
          </div>
          {isDuplikat && (
            <div className="rounded-2xl border-2 border-rose-300 bg-rose-50 px-3 py-3 text-center text-red-700 font-extrabold text-lg leading-snug">
              ID_PERJALANAN SUDAH ADA ({idPerjalanan})
            </div>
          )}

          {/* ===== TIMETABLE + AKTUAL ===== */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className={labelCls}>TimeTable <span className="text-base font-medium text-slate-500">(Master – {pola})</span></label>
              <input type="time" value={jadwal} onChange={(e) => setJadwal(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Aktual</label>
              <input type="time" value={aktual} onChange={(e) => setAktual(e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* ===== TOTAL PNP / TRANSIT / TURUN ===== */}
          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className={labelCls}>Total PNP</label>
              <input type="number" min={0} value={totalPnp} onChange={(e) => setTotalPnp(e.target.value)} placeholder="0" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>PNP Transit</label>
              <input type="number" min={0} value={pnpTransit} onChange={(e) => setPnpTransit(e.target.value)} placeholder="0" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>PNP Turun</label>
              <input type="number" min={0} value={pnpTurun} onChange={(e) => setPnpTurun(e.target.value)} placeholder="0" className={inputCls} />
            </div>
          </div>

          {/* ===== KENDALA BUS ===== */}
          <div>
            <label className={labelCls}>Kendala Bus</label>
            <select value={kendala} onChange={(e) => setKendala(e.target.value)} className={inputCls}>
              {KENDALA_LIST.map((c) => (<option key={c} value={c}>{c}</option>))}
            </select>
          </div>

          {/* ===== KETERANGAN ===== */}
          <div>
            <label className={labelCls}>
              Keterangan{' '}
              {lebihAwalMenit !== null && lebihAwalMenit > 0 && (
                <span className="text-red-600">(Lebih awal {lebihAwalMenit} menit — WAJIB isi Keterangan)</span>
              )}
            </label>
            <input type="text" placeholder="Catatan..." value={ket} onChange={(e) => setKet(e.target.value)} className={`${inputCls} bg-amber-100 !border-red-600 placeholder:text-slate-500`} />
          </div>

          {/* ===== TOMBOL SIMPAN — merah + teks berubah kalau duplikat (fungsi lama) ===== */}
          <button type="button" disabled={sending || isDuplikat} onClick={() => void handleSimpan()} className="w-full py-4 rounded-2xl font-extrabold text-xl text-white bg-[#C00000] disabled:cursor-not-allowed cursor-pointer">
            {isDuplikat ? 'ID_PERJALANAN SUDAH ADA' : sending ? 'MENGIRIM...' : 'SIMPAN DAN KIRIM TIMER'}
          </button>

          {/* ===== BARANG TERTINGGAL ===== */}
          {onOpenLostFound && (
            <button type="button" onClick={onOpenLostFound} className="w-full py-4 rounded-2xl bg-[#7C3AED] hover:bg-violet-700 text-white font-extrabold text-xl cursor-pointer">📦 BARANG TERTINGGAL</button>
          )}

          {/* ===== RIWAYAT ===== */}
          <div className="pt-1 text-center">
            <button type="button" onClick={() => setShowRiwayat((v) => !v)} className="text-blue-700 font-extrabold underline text-lg cursor-pointer">
              {showRiwayat ? 'Sembunyikan Riwayat Validasi' : 'Lihat Riwayat Validasi'}
            </button>
            <span className="ml-2 text-base font-bold text-slate-600">({riwayatHariIni.length} data hari ini)</span>
          </div>
          {showRiwayat && (
            <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 space-y-2.5">
              {riwayatHariIni.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-4">Belum ada data Timer hari ini</p>
              ) : (
                riwayatHariIni.map((d, idx) => (
                  <div key={`${String(d.idPerjalanan)}-${idx}`} className="bg-white border border-slate-300 rounded-xl p-3 text-sm space-y-1">
                    <div className="flex justify-between"><span className="font-extrabold">{String(d.noLambung)} | {String(d.rit)}</span><span className="text-xs font-extrabold text-emerald-700">{String(d.status)}</span></div>
                    <div className="text-xs font-mono-num text-slate-500">{String(d.idPerjalanan)}</div>
                    <div className="text-xs text-slate-700">TimeTable {String(d.jadwal)} → Aktual {String(d.aktual)}</div>
                    <div className="text-xs text-slate-700">PNP {String(d.pnpNaik)} | Transit {String(d.pnpTransit)} | Turun {String(d.pnpTurun)}</div>
                    {String(d.statusPerjalanan || '') !== 'NORMAL' && String(d.statusPerjalanan || '') !== '' && (
                      <div className="text-xs font-bold text-amber-800">🚌 {String(d.statusPerjalanan)} — Ganti: {String(d.idPerjalananAsal || '-')}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          <p className="text-center text-slate-500 text-sm pt-2 pb-4">dibuat Oleh Ali Setiadi</p>
        </div>
      </div>
    </div>
  );
}

// Named export untuk App.tsx: import { TimerScreen } from './TimerScreen'
export { TimerScreen };
