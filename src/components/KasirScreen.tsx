// KasirScreen.tsx — 4 JENIS (Tunai, Non-Tunai, Manual, PPT).
// Total Penumpang & Total Setoran = Tunai + Non-Tunai + Manual.
// PPT terpisah, Rp-nya 0, tidak masuk total.
// Manual & PPT per kategori disimpan di record (field rincianManualPnp / rincianPptPnp).
// BLOK JENIS BISA DILIPAT: tiap jenis punya tombol Lihat / Sembunyikan supaya halaman pendek di HP. Menutup blok TIDAK menghapus isi input.
// PERUBAHAN NOMOR 3 SAJA (duplikat ID_PERJALANAN): handleSimpan kini cek dulu ke server (GET ?action=cek_id_perjalanan) + cek lokal, dan Apps Script doPost juga menolak kalau ID sudah ada di DB_KASIR. Selain itu tidak ada yang diubah.
// KL1: tombol LIHAT KL1 -> tampil persis seperti Sheet KL 1 FIX, otomatis Landscape + langsung siap print (window.print).
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


// KL1 TTD PRAMUJASA: URL deployment Apps Script PRAMUJASA (code.gs Pramujasa, bukan Kasir).
// ISI INI dengan URL /exec deployment Pramujasa yang baru. Kalau masih kosong, aplikasi
// otomatis pakai fallback API_KASIR ?action=getPramujasa (sudah ditambahkan di code.gs Kasir).
const API_PRAMUJASA = '';

const KASIR_DRAFT_KEY = 'anteng_kasir_draft';


interface KasirDraft {
  tanggal: string;
  koridor: string;
  lb: string;
  rit: string;
  shift?: string;
  tunaiPnp: KategoriCounts;
  nonTunaiPnp: KategoriCounts;
  qrisPnp?: KategoriCounts;
  tapPnp?: KategoriCounts;
  siAntengPnp?: KategoriCounts;
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
          url: draft.lfFoto1.url.startsWith('data:image/') ? '[Tersimpan di Sesi]' : draft.lfFoto1.url,
          info: draft.lfFoto1.info,
        },
        lfFoto2: {
          url: draft.lfFoto2.url.startsWith('data:image/') ? '[Tersimpan di Sesi]' : draft.lfFoto2.url,
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



// ===== KL1: TERBILANG + TIPE DATA + TAMPILAN CETAK =====
function terbilangKL1(n: number): string {
  const satuan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
  const nn = Math.floor(Math.abs(n) || 0);
  if (nn < 12) return satuan[nn];
  if (nn < 20) return terbilangKL1(nn - 10) + ' Belas';
  if (nn < 100) return (terbilangKL1(Math.floor(nn / 10)) + ' Puluh ' + terbilangKL1(nn % 10)).trim();
  if (nn < 200) return ('Seratus ' + terbilangKL1(nn - 100)).trim();
  if (nn < 1000) return (terbilangKL1(Math.floor(nn / 100)) + ' Ratus ' + terbilangKL1(nn % 100)).trim();
  if (nn < 2000) return ('Seribu ' + terbilangKL1(nn - 1000)).trim();
  if (nn < 1000000) return (terbilangKL1(Math.floor(nn / 1000)) + ' Ribu ' + terbilangKL1(nn % 1000)).trim();
  if (nn < 1000000000) return (terbilangKL1(Math.floor(nn / 1000000)) + ' Juta ' + terbilangKL1(nn % 1000000)).trim();
  return '';
}
export interface KL1RowData { label: string; eTickPnp: number; eTickRp: number; manPnp: number; manRp: number; qrisPnp: number; qrisRp: number; tapPnp: number; tapRp: number; siAntengPnp: number; siAntengRp: number; }
export interface KL1Data { idPerjalanan: string; pool: string; lambung: string; shift: string; hari: string; tanggal: string; tabel1: KL1RowData[]; tabel2: KL1RowData[]; totalPnp: number; totalRp: number; terbilang: string; adminKasir: string; pramujasa: string; keterangan: string; }
const KL1_CSS = `
  #kl1-print-area { background:#e5e7eb; padding:16px; min-height:100vh; }
  .kl1-no-print { display:flex; gap:8px; max-width:1000px; margin:0 auto 12px; }
  .kl1-btn-abu { flex:1; padding:12px; border-radius:12px; background:#fff; font-weight:800; border:2px solid #cbd5e1; cursor:pointer; }
  .kl1-btn-hijau { flex:2; padding:12px; border-radius:12px; background:#059669; color:#fff; font-weight:800; border:none; cursor:pointer; }
  .kl1-kertas { background:#fff; max-width:980px; margin:0 auto; padding:12px 12px; font-family:"Times New Roman",Times,serif; color:#000; }
  .kl1-head-kanan { text-align:right; font-size:13px; font-weight:700; }
  .kl1-judul { text-align:center; font-size:15px; font-weight:800; text-decoration:underline; margin:8px 0 14px; }
  .kl1-meta { font-size:14px; margin-bottom:12px; }
  .kl1-meta td:first-child { width:180px; font-weight:700; }
  .kl1-meta td { padding:1px 4px; }
  .kl1-table { width:100%; border-collapse:collapse; font-size:10px; }
  .kl1-th, .kl1-td { border:1.5px solid #000; padding:3px 2px; text-align:center; }
  .kl1-kiri { text-align:left; font-weight:700; width:110px; }
  .kl1-sub { font-size:10px; }
  .kl1-total-head { font-size:11px; width:120px; background:#f1f5f9; }
  .kl1-total { font-weight:800; font-size:13px; }
  .kl1-bold { font-weight:700; }
  .kl1-abu { color:#94a3b8; }
  .kl1-jarak { height:12px; }
  .kl1-terbilang { border:1.5px solid #000; border-top:none; padding:8px 10px; font-size:13px; font-style:italic; }
  .kl1-bawah { width:100%; margin-top:14px; font-size:13px; }
  .kl1-bawah td { vertical-align:top; padding:4px; }
  .kl1-ket { width:34%; }
  .kl1-ttd { width:33%; text-align:center; font-weight:700; }
  @page { size:215mm 165mm; margin:5mm; } /* KERTAS 1/2 F4 landscape: F4 215x330 dilipat jadi 215x165 */
  @media print {
    body { background:#fff !important; margin:0; }
    body * { visibility:visible; }
    #kl1-print-area { position:static; width:100%; background:#fff; padding:0; min-height:auto; }
    .kl1-no-print { display:none !important; }
    .kl1-kertas { max-width:none; margin:0; padding:0; }
  }
`;
function KL1Tabel({ rows, totalPnp, totalRp }: { rows: KL1RowData[]; totalPnp: number; totalRp: number }) {
  const totalRow = (r: KL1RowData) => r.eTickPnp + r.manPnp + r.qrisPnp + r.tapPnp + r.siAntengPnp;
  const totalRowRp = (r: KL1RowData) => r.eTickRp + r.manRp + r.qrisRp + r.tapRp + r.siAntengRp;
  return (
    <table className="kl1-table">
      <thead>
        <tr>
          <th rowSpan={3} className="kl1-th kl1-kiri">KLASIFIKASI</th>
          {rows.map((r) => (<th key={r.label} colSpan={5} className="kl1-th">{r.label}</th>))}
          <th rowSpan={3} className="kl1-th kl1-total-head">TOTAL PENUMPANG<br />DAN<br />SETORAN TUNAI</th>
        </tr>
        <tr>
          {rows.map((r) => (
            <Fragment key={r.label}>
              <th colSpan={2} className="kl1-th kl1-sub">TUNAI</th><th colSpan={3} className="kl1-th kl1-sub">NON TUNAI</th>
            </Fragment>
          ))}
        </tr>
        <tr>
          {rows.map((r) => (
            <Fragment key={r.label}>
              <th className="kl1-th kl1-sub">E-TICK</th><th className="kl1-th kl1-sub">MAN</th><th className="kl1-th kl1-sub">QRIS</th><th className="kl1-th kl1-sub">TAP</th><th className="kl1-th kl1-sub">SI ANTENG</th>
            </Fragment>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="kl1-td kl1-kiri">PENUMPANG</td>
          {rows.map((r) => (
            <Fragment key={r.label}>
              <td className="kl1-td">{r.eTickPnp || ''}</td><td className="kl1-td">{r.manPnp || ''}</td><td className="kl1-td">{r.qrisPnp || ''}</td><td className="kl1-td">{r.tapPnp || ''}</td><td className="kl1-td">{r.siAntengPnp || ''}</td>
            </Fragment>
          ))}
          <td className="kl1-td kl1-total" rowSpan={4}>{totalPnp || ''}<br /><span style={{ fontSize: 11, fontWeight: 700 }}>{totalRp ? formatRupiah(totalRp) : ''}</span></td>
        </tr>
        <tr>
          <td className="kl1-td kl1-kiri">PENDAPATAN</td>
          {rows.map((r) => (
            <Fragment key={r.label}>
              <td className="kl1-td">{r.eTickRp ? formatRupiah(r.eTickRp) : ''}</td><td className="kl1-td">{r.manRp ? formatRupiah(r.manRp) : ''}</td><td className="kl1-td">{r.qrisRp ? formatRupiah(r.qrisRp) : ''}</td><td className="kl1-td">{r.tapRp ? formatRupiah(r.tapRp) : ''}</td><td className="kl1-td">{r.siAntengRp ? formatRupiah(r.siAntengRp) : ''}</td>
            </Fragment>
          ))}
        </tr>
        <tr>
          <td className="kl1-td kl1-kiri">JUMLAH PENUMPANG</td>
          {rows.map((r) => (
            <Fragment key={r.label}>
              <td className="kl1-td kl1-bold">{totalRow(r) || ''}</td><td className="kl1-td kl1-abu">-</td><td className="kl1-td kl1-abu">-</td><td className="kl1-td kl1-abu">-</td><td className="kl1-td kl1-abu">-</td>
            </Fragment>
          ))}
        </tr>
        <tr>
          <td className="kl1-td kl1-kiri">JUMLAH PENDAPATAN</td>
          {rows.map((r) => (
            <Fragment key={r.label}>
              <td className="kl1-td kl1-bold">{totalRowRp(r) ? formatRupiah(totalRowRp(r)) : ''}</td><td className="kl1-td kl1-abu">-</td><td className="kl1-td kl1-abu">-</td><td className="kl1-td kl1-abu">-</td><td className="kl1-td kl1-abu">-</td>
            </Fragment>
          ))}
        </tr>
      </tbody>
    </table>
  );
}
function KL1SheetView({ data, onClose, onPramujasaChange }: { data: KL1Data; onClose: () => void; onPramujasaChange?: (nama: string) => void }) {
  return (
    <div id="kl1-print-area">
      <style>{KL1_CSS}</style>
      <div className="kl1-no-print" style={{ flexDirection: 'column' }}>
        {/* PRAMUJASA BELUM MUNCUL? Ketik manual di sini — langsung tampil di tanda tangan di bawah. Tidak ikut keprint. */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#fff', border: '2px solid #f59e0b', borderRadius: 12, padding: 10 }}>
          <span style={{ fontWeight: 800, fontSize: 13, whiteSpace: 'nowrap' }}>Nama Pramujasa:</span>
          <input
            type="text"
            value={data.pramujasa}
            placeholder="Contoh: IKA W — ketik di sini kalau belum muncul otomatis"
            onChange={(e) => onPramujasaChange && onPramujasaChange(e.target.value)}
            style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontWeight: 700 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={onClose} className="kl1-btn-abu">← KEMBALI</button>
        <button type="button" onClick={() => { document.title = `KL1-${data.idPerjalanan || data.tanggal}`; window.print(); }} className="kl1-btn-hijau">🖨 CETAK / SIMPAN PDF (Kertas 1/2 F4)</button>
        </div>
      </div>
      <div className="kl1-kertas">
        <div className="kl1-head-kanan">BRT.JATENG.03</div>
        <div className="kl1-head-kanan">FORM : KL1</div>
        <h1 className="kl1-judul">RINCIAN HASIL PENJUALAN TIKET BUS BRT TRANS JATENG</h1>
        <table className="kl1-meta"><tbody>
          <tr><td>Pool / Terminal Awal</td><td>: {data.pool}</td></tr>
          <tr><td>No. Lambung</td><td>: {data.lambung}</td></tr>
          <tr><td>Shift</td><td>: {data.shift}</td></tr>
          <tr><td>Hari</td><td>: {data.hari}</td></tr>
          <tr><td>Tanggal</td><td>: {data.tanggal}</td></tr>
        </tbody></table>
        <KL1Tabel rows={data.tabel1} totalPnp={data.totalPnp} totalRp={data.totalRp} />
        <div className="kl1-jarak" />
        <KL1Tabel rows={data.tabel2} totalPnp={data.totalPnp} totalRp={data.totalRp} />
        <div className="kl1-terbilang"><b>TERBILANG</b> &nbsp; : &nbsp; {data.terbilang}</div>
        <table className="kl1-bawah"><tbody><tr>
          <td className="kl1-ket"><b>KETERANGAN :</b><br />UMUM = 5,000<br />PELAJAR = 1,000<br />BURUH = 1,000<br />VETERAN = 1,000<br />DISABILITAS = 1,000<br />LANSIA = 1,000{data.keterangan && data.keterangan !== '-' ? (<><br /><br />Ket: {data.keterangan}</>) : null}</td>
          <td className="kl1-ttd">ADMIN KASIR<br /><br /><br /><br />________________________<br />{data.adminKasir}</td>
          <td className="kl1-ttd">PRAMUJASA<br /><br /><br /><br />________________________<br />{data.pramujasa}</td>
        </tr></tbody></table>
      </div>
    </div>
  );
}


// ===== KL2: REKAP 1 HARI / 1 SHIFT / 1 SHELTER (persis file Excel KL2) =====
// File Excel KL2 punya 2 sheet: PBG (Purbalingga) dan PWT (Purwokerto).
// Tiap sheet = 2 tabel x 10 baris NOMOR LAMBUNG / NAMA HALTE.
// Tabel 1: UMUM + PELAJAR. Tabel 2: BURUH + VETERAN.
// Per kategori, yang DIISI hanya 5 angka: QRIS, TAPPING, SI ANTENG, MANUAL, E-TICKETING.
// Yang lain HITUNG OTOMATIS:
//   TIKET NON TUNAI = QRIS + TAPPING + SI ANTENG
//   TIKET TUNAI = MANUAL + E-TICKETING
//   RUPIAH NON TUNAI = TIKET NON TUNAI x tarif kategori (UMUM 5000, sisanya 1000)
//   RUPIAH TUNAI = TIKET TUNAI x tarif kategori
//   JUMLAH TOTAL = RUPIAH NON TUNAI + RUPIAH TUNAI
// Kolom TOTAL AKHIR (tabel 1) / TOTAL (tabel 2): per baris = gabungan 2 kategori di tabel itu.
//   TIKET NON TUNAI / TIKET TUNAI / TR / RUPIAH NON TUNAI / RUPIAH TUNAI / JUMLAH TOTAL.
//   TR di file Excel tidak dijelaskan — di sini TR = total tiket (Non Tunai + Tunai).
// CATATAN PENTING: file Excel KL2 TIDAK punya kolom LANSIA & DISABILITAS.
//   Jadi LANSIA & DISABILITAS tidak masuk KL2 (ikut file aslinya). Kalau ternyata
//   harus ada, bilang saja — nanti ditambah jadi tabel ke-3.
export interface KL2KatInput { qris: number; tap: number; siAnteng: number; manual: number; eTick: number; }
export interface KL2Row { lambung: string; umum: KL2KatInput; pelajar: KL2KatInput; buruh: KL2KatInput; veteran: KL2KatInput; }
export type KL2Shelter = 'PBG' | 'PWT';
export interface KL2Data { hari: string; tanggal: string; shift: string; shelter: KL2Shelter; adminKasir: string; rows: KL2Row[]; }
export const KL2_TARIF: Record<'umum' | 'pelajar' | 'buruh' | 'veteran', number> = { umum: 5000, pelajar: 1000, buruh: 1000, veteran: 1000 };
export function kl2EmptyKat(): KL2KatInput { return { qris: 0, tap: 0, siAnteng: 0, manual: 0, eTick: 0 }; }
export function kl2EmptyRow(): KL2Row { return { lambung: '', umum: kl2EmptyKat(), pelajar: kl2EmptyKat(), buruh: kl2EmptyKat(), veteran: kl2EmptyKat() }; }
export function kl2KatHitung(kat: KL2KatInput, tarif: number) {
  const nonTunai = (kat.qris || 0) + (kat.tap || 0) + (kat.siAnteng || 0);
  const tunai = (kat.manual || 0) + (kat.eTick || 0);
  const rpNon = nonTunai * tarif;
  const rpTunai = tunai * tarif;
  return { nonTunai, tunai, rpNon, rpTunai, jumlah: rpNon + rpTunai, totalTiket: nonTunai + tunai };
}
const KL2_CSS = `
  #kl2-print-area { background:#e5e7eb; padding:12px; min-height:100vh; }
  .kl2-no-print { display:flex; gap:8px; max-width:1100px; margin:0 auto 12px; flex-wrap:wrap; }
  .kl2-btn-abu { flex:1; padding:12px; border-radius:12px; background:#fff; font-weight:800; border:2px solid #cbd5e1; cursor:pointer; min-width:120px; }
  .kl2-btn-hijau { flex:2; padding:12px; border-radius:12px; background:#059669; color:#fff; font-weight:800; border:none; cursor:pointer; min-width:180px; }
  .kl2-btn-biru { flex:1; padding:12px; border-radius:12px; background:#0369a1; color:#fff; font-weight:800; border:none; cursor:pointer; min-width:180px; }
  .kl2-kertas { background:#fff; max-width:1100px; margin:0 auto; padding:12px; font-family:"Times New Roman",Times,serif; color:#000; }
  .kl2-head-kanan { text-align:right; font-size:12px; font-weight:700; }
  .kl2-judul { text-align:center; font-size:14px; font-weight:800; text-decoration:underline; margin:6px 0 2px; }
  .kl2-subjudul { text-align:center; font-size:15px; font-weight:800; margin:0 0 10px; }
  .kl2-meta { font-size:13px; margin-bottom:10px; width:100%; }
  .kl2-meta td { padding:1px 4px; }
  .kl2-table { width:100%; border-collapse:collapse; font-size:9px; margin-bottom:10px; }
  .kl2-th, .kl2-td { border:1.5px solid #000; padding:2px 1px; text-align:center; }
  .kl2-kiri { text-align:left; font-weight:700; }
  .kl2-total-head { background:#f1f5f9; }
  .kl2-bold { font-weight:700; }
  .kl2-input { width:100%; border:none; background:transparent; text-align:center; font-family:inherit; font-size:10px; font-weight:700; padding:2px 0; }
  .kl2-input-lambung { width:100%; border:none; background:transparent; font-family:inherit; font-size:10px; font-weight:700; padding:2px; }
  .kl2-bawah { width:100%; margin-top:10px; font-size:12px; }
  .kl2-bawah td { vertical-align:top; padding:4px; }
  .kl2-ttd { width:33%; text-align:center; font-weight:700; }
  .kl2-catatan { font-size:11px; color:#334155; margin:6px 0 0; }
  @page { size:297mm 210mm landscape; margin:5mm; }
  @media print {
    body { background:#fff !important; margin:0; }
    #kl2-print-area { position:static; width:100%; background:#fff; padding:0; min-height:auto; }
    .kl2-no-print { display:none !important; }
    .kl2-kertas { max-width:none; margin:0; padding:0; }
    .kl2-input, .kl2-input-lambung { border:none !important; }
  }
`;
function KL2Tabel({ rows, katKiri, katKanan, onRowChange }: { rows: KL2Row[]; katKiri: 'umum' | 'buruh'; katKanan: 'pelajar' | 'veteran'; onRowChange: (idx: number, kat: 'umum' | 'pelajar' | 'buruh' | 'veteran' | 'lambung', field: string, val: string) => void }) {
  const labelKiri = katKiri === 'umum' ? 'UMUM' : 'BURUH';
  const labelKanan = katKanan === 'pelajar' ? 'PELAJAR' : 'VETERAN';
  const tarifKiri = KL2_TARIF[katKiri];
  const tarifKanan = KL2_TARIF[katKanan];
  const renderKatCells = (row: KL2Row, idx: number, kat: 'umum' | 'pelajar' | 'buruh' | 'veteran', tarif: number) => {
    const v = row[kat];
    const h = kl2KatHitung(v, tarif);
    const fields: Array<[keyof KL2KatInput, string]> = [['qris', 'QRIS'], ['tap', 'TAPPING'], ['siAnteng', 'SI ANTENG'], ['manual', 'MANUAL'], ['eTick', 'E-TICKETING']];
    return (
      <Fragment key={kat}>
        {fields.map(([f]) => (
          <td key={f} className="kl2-td"><input type="number" min={0} className="kl2-input" value={v[f] || ''} placeholder="0" onChange={(e) => onRowChange(idx, kat, f, e.target.value)} /></td>
        ))}
        <td className="kl2-td">{h.nonTunai || ''}</td><td className="kl2-td">{h.tunai || ''}</td><td className="kl2-td">{h.rpNon ? formatRupiah(h.rpNon) : ''}</td><td className="kl2-td">{h.rpTunai ? formatRupiah(h.rpTunai) : ''}</td><td className="kl2-td kl2-bold">{h.jumlah ? formatRupiah(h.jumlah) : ''}</td>
      </Fragment>
    );
  };
  const renderTotalCells = (row: KL2Row) => {
    const a = kl2KatHitung(row[katKiri], tarifKiri);
    const b = kl2KatHitung(row[katKanan], tarifKanan);
    const nt = a.nonTunai + b.nonTunai; const t = a.tunai + b.tunai; const rpN = a.rpNon + b.rpNon; const rpT = a.rpTunai + b.rpTunai;
    return (<Fragment><td className="kl2-td kl2-bold">{nt || ''}</td><td className="kl2-td kl2-bold">{t || ''}</td><td className="kl2-td kl2-bold">{(nt + t) || ''}</td><td className="kl2-td kl2-bold">{rpN ? formatRupiah(rpN) : ''}</td><td className="kl2-td kl2-bold">{rpT ? formatRupiah(rpT) : ''}</td><td className="kl2-td kl2-bold">{(rpN + rpT) ? formatRupiah(rpN + rpT) : ''}</td></Fragment>);
  };
  const sumKat = (kat: 'umum' | 'pelajar' | 'buruh' | 'veteran', tarif: number) => {
    let nt = 0, t = 0, rpN = 0, rpT = 0;
    rows.forEach((r) => { const h = kl2KatHitung(r[kat], tarif); nt += h.nonTunai; t += h.tunai; rpN += h.rpNon; rpT += h.rpTunai; });
    return { nt, t, rpN, rpT, jumlah: rpN + rpT };
  };
  const sKiri = sumKat(katKiri, tarifKiri); const sKanan = sumKat(katKanan, tarifKanan);
  const totalLabel = katKiri === 'umum' ? 'TOTAL AKHIR' : 'TOTAL';
  return (
    <table className="kl2-table">
      <thead>
        <tr>
          <th rowSpan={3} className="kl2-th" style={{ width: 26 }}>NO</th>
          <th rowSpan={3} className="kl2-th" style={{ width: 90 }}>NOMOR LAMBUNG / NAMA HALTE</th>
          <th colSpan={10} className="kl2-th">{labelKiri}</th>
          <th colSpan={10} className="kl2-th">{labelKanan}</th>
          <th colSpan={6} className="kl2-th kl2-total-head">{totalLabel}</th>
        </tr>
        <tr>
          <th colSpan={3} className="kl2-th">NON TUNAI</th><th colSpan={2} className="kl2-th">TUNAI</th><th colSpan={5} className="kl2-th">TOTAL</th>
          <th colSpan={3} className="kl2-th">NON TUNAI</th><th colSpan={2} className="kl2-th">TUNAI</th><th colSpan={5} className="kl2-th">TOTAL</th>
          <th colSpan={6} className="kl2-th kl2-total-head">TOTAL</th>
        </tr>
        <tr>
          <th className="kl2-th">QRIS</th><th className="kl2-th">TAPPING</th><th className="kl2-th">SI ANTENG</th><th className="kl2-th">MANUAL</th><th className="kl2-th">E-TICKETING</th><th className="kl2-th">TIKET NON TUNAI</th><th className="kl2-th">TIKET TUNAI</th><th className="kl2-th">RUPIAH NON TUNAI</th><th className="kl2-th">RUPIAH TUNAI</th><th className="kl2-th">JUMLAH TOTAL</th>
          <th className="kl2-th">QRIS</th><th className="kl2-th">TAPPING</th><th className="kl2-th">SI ANTENG</th><th className="kl2-th">MANUAL</th><th className="kl2-th">E-TICKETING</th><th className="kl2-th">TIKET NON TUNAI</th><th className="kl2-th">TIKET TUNAI</th><th className="kl2-th">RUPIAH NON TUNAI</th><th className="kl2-th">RUPIAH TUNAI</th><th className="kl2-th">JUMLAH TOTAL</th>
          <th className="kl2-th kl2-total-head">TIKET NON TUNAI</th><th className="kl2-th kl2-total-head">TIKET TUNAI</th><th className="kl2-th kl2-total-head">TR</th><th className="kl2-th kl2-total-head">RUPIAH NON TUNAI</th><th className="kl2-th kl2-total-head">RUPIAH TUNAI</th><th className="kl2-th kl2-total-head">JUMLAH TOTAL</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <tr key={idx}>
            <td className="kl2-td">{idx + 1}</td>
            <td className="kl2-td"><input type="text" className="kl2-input-lambung" value={row.lambung} placeholder="LB.." onChange={(e) => onRowChange(idx, 'lambung', 'lambung', e.target.value)} /></td>
            {renderKatCells(row, idx, katKiri, tarifKiri)}
            {renderKatCells(row, idx, katKanan, tarifKanan)}
            {renderTotalCells(row)}
          </tr>
        ))}
        <tr>
          <td className="kl2-td kl2-bold" colSpan={2}>J U M L A H</td>
          <td className="kl2-td kl2-bold">{rows.reduce((a, r) => a + (r[katKiri].qris || 0), 0) || ''}</td><td className="kl2-td kl2-bold">{rows.reduce((a, r) => a + (r[katKiri].tap || 0), 0) || ''}</td><td className="kl2-td kl2-bold">{rows.reduce((a, r) => a + (r[katKiri].siAnteng || 0), 0) || ''}</td><td className="kl2-td kl2-bold">{rows.reduce((a, r) => a + (r[katKiri].manual || 0), 0) || ''}</td><td className="kl2-td kl2-bold">{rows.reduce((a, r) => a + (r[katKiri].eTick || 0), 0) || ''}</td><td className="kl2-td kl2-bold">{sKiri.nt || ''}</td><td className="kl2-td kl2-bold">{sKiri.t || ''}</td><td className="kl2-td kl2-bold">{sKiri.rpN ? formatRupiah(sKiri.rpN) : ''}</td><td className="kl2-td kl2-bold">{sKiri.rpT ? formatRupiah(sKiri.rpT) : ''}</td><td className="kl2-td kl2-bold">{sKiri.jumlah ? formatRupiah(sKiri.jumlah) : ''}</td>
          <td className="kl2-td kl2-bold">{rows.reduce((a, r) => a + (r[katKanan].qris || 0), 0) || ''}</td><td className="kl2-td kl2-bold">{rows.reduce((a, r) => a + (r[katKanan].tap || 0), 0) || ''}</td><td className="kl2-td kl2-bold">{rows.reduce((a, r) => a + (r[katKanan].siAnteng || 0), 0) || ''}</td><td className="kl2-td kl2-bold">{rows.reduce((a, r) => a + (r[katKanan].manual || 0), 0) || ''}</td><td className="kl2-td kl2-bold">{rows.reduce((a, r) => a + (r[katKanan].eTick || 0), 0) || ''}</td><td className="kl2-td kl2-bold">{sKanan.nt || ''}</td><td className="kl2-td kl2-bold">{sKanan.t || ''}</td><td className="kl2-td kl2-bold">{sKanan.rpN ? formatRupiah(sKanan.rpN) : ''}</td><td className="kl2-td kl2-bold">{sKanan.rpT ? formatRupiah(sKanan.rpT) : ''}</td><td className="kl2-td kl2-bold">{sKanan.jumlah ? formatRupiah(sKanan.jumlah) : ''}</td>
          <td className="kl2-td kl2-bold">{(sKiri.nt + sKanan.nt) || ''}</td><td className="kl2-td kl2-bold">{(sKiri.t + sKanan.t) || ''}</td><td className="kl2-td kl2-bold">{(sKiri.nt + sKanan.nt + sKiri.t + sKanan.t) || ''}</td><td className="kl2-td kl2-bold">{(sKiri.rpN + sKanan.rpN) ? formatRupiah(sKiri.rpN + sKanan.rpN) : ''}</td><td className="kl2-td kl2-bold">{(sKiri.rpT + sKanan.rpT) ? formatRupiah(sKiri.rpT + sKanan.rpT) : ''}</td><td className="kl2-td kl2-bold">{(sKiri.jumlah + sKanan.jumlah) ? formatRupiah(sKiri.jumlah + sKanan.jumlah) : ''}</td>
        </tr>
      </tbody>
    </table>
  );
}
function KL2SheetView({ data, onClose, onRowsChange, onShelterChange, onAutoFill }: { data: KL2Data; onClose: () => void; onRowsChange: (rows: KL2Row[]) => void; onShelterChange: (s: KL2Shelter) => void; onAutoFill: () => void }) {
  const kota = data.shelter === 'PBG' ? 'Purbalingga' : 'Purwokerto';
  const grand = (() => {
    let nt = 0, t = 0, rpN = 0, rpT = 0;
    (['umum', 'pelajar', 'buruh', 'veteran'] as const).forEach((k) => {
      data.rows.forEach((r) => { const h = kl2KatHitung(r[k], KL2_TARIF[k]); nt += h.nonTunai; t += h.tunai; rpN += h.rpNon; rpT += h.rpTunai; });
    });
    return { nt, t, rpN, rpT, jumlah: rpN + rpT, tiket: nt + t };
  })();
  const handleChange = (idx: number, kat: 'umum' | 'pelajar' | 'buruh' | 'veteran' | 'lambung', field: string, val: string) => {
    const next = data.rows.map((r, i) => {
      if (i !== idx) return r;
      if (kat === 'lambung') return { ...r, lambung: val.toUpperCase() };
      const n = Math.max(0, parseInt(val, 10) || 0);
      return { ...r, [kat]: { ...(r[kat] as KL2KatInput), [field]: n } };
    });
    onRowsChange(next);
  };
  return (
    <div id="kl2-print-area">
      <style>{KL2_CSS}</style>
      <div className="kl2-no-print">
        <button type="button" onClick={onClose} className="kl2-btn-abu">← KEMBALI</button>
        <button type="button" onClick={onAutoFill} className="kl2-btn-biru">↺ ISI OTOMATIS DARI RIWAYAT HARI INI</button>
        <button type="button" onClick={() => { document.title = `KL2-${data.shelter}-${data.tanggal}-${data.shift}`; window.print(); }} className="kl2-btn-hijau">🖨 CETAK / SIMPAN PDF (KL2 Landscape)</button>
      </div>
      <div className="kl2-no-print" style={{ alignItems: 'center' }}>
        <label style={{ fontWeight: 800, fontSize: 13 }}>Shelter / Sheet:</label>
        <select value={data.shelter} onChange={(e) => onShelterChange(e.target.value as KL2Shelter)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontWeight: 800 }}>
          <option value="PBG">PBG — Purbalingga</option>
          <option value="PWT">PWT — Purwokerto</option>
        </select>
        <span style={{ fontSize: 12, color: '#475569' }}>Isi hanya 5 angka per kategori (QRIS, TAPPING, SI ANTENG, MANUAL, E-TICKETING) — sisanya hitung otomatis. KL2 ini rekap 1 hari + 1 shift + 1 shelter, 10 lambung.</span>
      </div>
      <div className="kl2-kertas">
        <div className="kl2-head-kanan">BRT.JATENG.08. REV</div>
        <div className="kl2-head-kanan">FORM : KL2</div>
        <h1 className="kl2-judul">HASIL PENJUALAN TIKET BUS BRT TRANS JATENG</h1>
        <h2 className="kl2-subjudul">KL2</h2>
        <table className="kl2-meta"><tbody>
          <tr><td style={{ width: 90, fontWeight: 700 }}>Hari</td><td>: {data.hari}</td><td style={{ width: 220, fontWeight: 700 }}>Shelter</td><td>: {data.shelter}</td></tr>
          <tr><td style={{ fontWeight: 700 }}>Tanggal</td><td>: {data.tanggal}</td><td style={{ fontWeight: 700 }}>Administrasi Kasir (Pengelola Pendapatan)</td><td>: {data.adminKasir}</td></tr>
          <tr><td style={{ fontWeight: 700 }}>Shift</td><td>: {data.shift}</td><td></td><td></td></tr>
        </tbody></table>
        <KL2Tabel rows={data.rows} katKiri="umum" katKanan="pelajar" onRowChange={handleChange} />
        <KL2Tabel rows={data.rows} katKiri="buruh" katKanan="veteran" onRowChange={handleChange} />
        <table className="kl2-table"><tbody><tr>
          <td className="kl2-td kl2-bold kl2-kiri" colSpan={2}>JUMLAH TOTAL</td>
          <td className="kl2-td kl2-bold">{grand.nt || ''}</td><td className="kl2-td kl2-bold">{grand.t || ''}</td><td className="kl2-td kl2-bold">{grand.tiket || ''}</td><td className="kl2-td kl2-bold">{grand.rpN ? formatRupiah(grand.rpN) : ''}</td><td className="kl2-td kl2-bold">{grand.rpT ? formatRupiah(grand.rpT) : ''}</td><td className="kl2-td kl2-bold">{grand.jumlah ? formatRupiah(grand.jumlah) : ''}</td>
          <td className="kl2-td" colSpan={20} style={{ textAlign: 'left' }}>Tiket Non Tunai {grand.nt || 0} + Tiket Tunai {grand.t || 0} = TR {grand.tiket || 0} · Total {grand.jumlah ? formatRupiah(grand.jumlah) : 'Rp 0'}</td>
        </tr></tbody></table>
        <p className="kl2-catatan">Catatan: di file Excel KL2, kategori yang ada hanya UMUM, PELAJAR, BURUH, VETERAN — LANSIA &amp; DISABILITAS tidak punya kolom, jadi tidak masuk KL2 ini. Tarif: UMUM Rp 5.000, PELAJAR / BURUH / VETERAN Rp 1.000. TR = total tiket (Non Tunai + Tunai).</p>
        <table className="kl2-bawah"><tbody>
          <tr><td></td><td></td><td style={{ textAlign: 'right' }}>{kota}, {data.tanggal}</td></tr>
          <tr><td></td><td className="kl2-ttd">Mengetahui,<br />ADMINISTRASI KANTOR (PENGELOLA DATA)<br /><br /><br />_______________________</td><td className="kl2-ttd">ADMINISTRASI KASIR (PENGELOLA PENDAPATAN)<br /><br /><br />_______________________<br />{data.adminKasir}</td></tr>
        </tbody></table>
      </div>
    </div>
  );
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
  // ===== PANEL CADANGAN LBC01 — PENAMBAHAN SAJA, fungsi lain tidak diubah =====
  const [statusPerjalanan, setStatusPerjalanan] = useState('NORMAL');
  const [idPerjalananAsal, setIdPerjalananAsal] = useState('');
  const [titikGanti, setTitikGanti] = useState('TERMINAL_AWAL');
  const [halteTitikGanti, setHalteTitikGanti] = useState('');
  const isCadangan = lb === 'LBC01';
  const tampilPanelCadangan = isCadangan || statusPerjalanan === 'LANJUTAN_SETELAH_PERBAIKAN';
  const statusPerjalananEfektif = tampilPanelCadangan ? statusPerjalanan : 'NORMAL';
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
  // KL1: tampilkan form KL1
  const [showKL1, setShowKL1] = useState<boolean>(false);
  // KL2: rekap 1 hari + 1 shift + 1 shelter (10 lambung). Disimpan di HP per tanggal+shift+shelter.
  const [showKL2, setShowKL2] = useState<boolean>(false);
  const [kl2Shelter, setKl2Shelter] = useState<KL2Shelter>('PBG');
  const [kl2Rows, setKl2Rows] = useState<KL2Row[]>(() => Array.from({ length: 10 }, () => kl2EmptyRow()));
  const kl2StorageKey = `anteng_kl2_${tanggal}_${shift}_${kl2Shelter}`;
  useEffect(() => {
    try {
      const raw = localStorage.getItem(kl2StorageKey);
      if (raw) { const parsed = JSON.parse(raw) as KL2Row[]; if (Array.isArray(parsed) && parsed.length === 10) setKl2Rows(parsed); else setKl2Rows(Array.from({ length: 10 }, () => kl2EmptyRow())); }
      else setKl2Rows(Array.from({ length: 10 }, () => kl2EmptyRow()));
    } catch { setKl2Rows(Array.from({ length: 10 }, () => kl2EmptyRow())); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kl2StorageKey]);
  useEffect(() => {
    try { localStorage.setItem(kl2StorageKey, JSON.stringify(kl2Rows)); } catch {}
  }, [kl2Rows, kl2StorageKey]);
  // KL2: isi otomatis dari riwayat tersimpan hari ini + shift ini (tiap record = 1 baris lambung).
  // Kalau riwayat kosong, pakai input KL1 yang sedang diisi sebagai baris 1.
  const handleKl2AutoFill = () => {
    const loose = (r: unknown) => r as unknown as Record<string, Record<string, number> | undefined>;
    const rowDariRecord = (r: unknown, lambungFallback: string): KL2Row => {
      const L = loose(r);
      const ambil = (kat: string): KL2KatInput => {
        const q = Number(L.rincianQrisPnp?.[kat]) || 0;
        const tap = Number(L.rincianTapPnp?.[kat]) || 0;
        const sia = Number(L.rincianSiAntengPnp?.[kat]) || 0;
        const man = Number(L.rincianManualPnp?.[kat]) || 0;
        const e = Number(L.rincianTunaiPnp?.[kat]) || 0;
        // Data lama tanpa rincian QRIS/TAP/SI ANTENG: total Non-Tunai dianggap QRIS (sama seperti KL1).
        const nt = Number(L.rincianNonTunaiPnp?.[kat]) || 0;
        return { qris: (q + tap + sia === 0 && nt > 0) ? nt : q, tap, siAnteng: sia, manual: man, eTick: e };
      };
      const rec = r as { lb?: string; lambung?: string; koridor?: string };
      return { lambung: String(rec.lb || rec.lambung || lambungFallback || '').toUpperCase(), umum: ambil('umum'), pelajar: ambil('pelajar'), buruh: ambil('buruh'), veteran: ambil('veteran') };
    };
    const tglIso = tanggal;
    const shiftNorm = shift.toUpperCase().includes('2') ? 'SHIFT 2' : 'SHIFT 1';
    const cocok = (riwayat as unknown as Array<Record<string, unknown>>).filter((r) => {
      const t = String(r.tanggal || '');
      const idp = String(r.idPerjalanan || '');
      const cocokTgl = t === tglIso || idp.endsWith(tglIso.split('-').join(''));
      const s = String(r.shift || '').toUpperCase();
      const cocokShift = !s || s.includes('2') === shiftNorm.includes('2') || s === shiftNorm;
      return cocokTgl && cocokShift;
    });
    const rowsBaru: KL2Row[] = Array.from({ length: 10 }, () => kl2EmptyRow());
    cocok.slice(0, 10).forEach((r, i) => { rowsBaru[i] = rowDariRecord(r, lb); });
    if (cocok.length === 0 && matriks.totalPnp > 0) {
      rowsBaru[0] = { lambung: lb.toUpperCase(), umum: { qris: qrisPnp.umum || 0, tap: tapPnp.umum || 0, siAnteng: siAntengPnp.umum || 0, manual: manualPnp.umum || 0, eTick: tunaiPnp.umum || 0 }, pelajar: { qris: qrisPnp.pelajar || 0, tap: tapPnp.pelajar || 0, siAnteng: siAntengPnp.pelajar || 0, manual: manualPnp.pelajar || 0, eTick: tunaiPnp.pelajar || 0 }, buruh: { qris: qrisPnp.buruh || 0, tap: tapPnp.buruh || 0, siAnteng: siAntengPnp.buruh || 0, manual: manualPnp.buruh || 0, eTick: tunaiPnp.buruh || 0 }, veteran: { qris: qrisPnp.veteran || 0, tap: tapPnp.veteran || 0, siAnteng: siAntengPnp.veteran || 0, manual: manualPnp.veteran || 0, eTick: tunaiPnp.veteran || 0 } };
    }
    setKl2Rows(rowsBaru);
    showToast(cocok.length > 0 ? `KL2 diisi otomatis dari ${cocok.length} riwayat hari ini.` : (matriks.totalPnp > 0 ? 'KL2 diisi dari input KL1 yang sedang diisi (baris 1).' : 'Tidak ada riwayat hari ini — isi manual 10 barisnya.'), cocok.length > 0 || matriks.totalPnp > 0 ? 'ok' : 'err');
  };
  const dataKL2: KL2Data = {
    hari: (() => { try { return ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][new Date(Number(tanggal.slice(0, 4)), Number(tanggal.slice(5, 7)) - 1, Number(tanggal.slice(8, 10))).getDay()]; } catch { return '-'; } })(),
    tanggal: `${tanggal.slice(8, 10)}-${tanggal.slice(5, 7)}-${tanggal.slice(0, 4)}`,
    shift: shift.toUpperCase().includes('2') ? 'SHIFT 2' : 'SHIFT 1',
    shelter: kl2Shelter, adminKasir: petugasNama, rows: kl2Rows,
  };
  // KL1 TTD PRAMUJASA: nama dari DB_PRAMUJASA lewat API Pramujasa (kunci ID_PERJALANAN)
  const [pramujasaKL1, setPramujasaKL1] = useState<string>('');
  const [pramujasaKL1Loading, setPramujasaKL1Loading] = useState<boolean>(false);
  // BLOK JENIS BISA DILIPAT: default hanya TUNAI terbuka
  const [openJenis, setOpenJenis] = useState({ tunai: true, nonTunai: false, manual: false, ppt: false });
  const toggleJenis = (jenis: 'tunai' | 'nonTunai' | 'manual' | 'ppt') => setOpenJenis((prev) => ({ ...prev, [jenis]: !prev[jenis] }));


  const [tunaiPnp, setTunaiPnp] = useState<KategoriCounts>(
    () => initialDraft.tunaiPnp || emptyKategoriCounts()
  );
  const [nonTunaiPnp, setNonTunaiPnp] = useState<KategoriCounts>(
    () => initialDraft.nonTunaiPnp || emptyKategoriCounts()
  );
  // KL1 TERBARU: NON TUNAI dipecah QRIS + TAP + SI ANTENG. Total Non-Tunai = ketiganya.
  // Data lama (hanya ada total Non-Tunai, tanpa rincian) -> seluruh total dianggap QRIS,
  // supaya total di KL1 lama tetap cocok dan tidak hilang.
  const initialSub = (field: 'qrisPnp' | 'tapPnp' | 'siAntengPnp') => {
    const d = initialDraft as unknown as Record<string, KategoriCounts | undefined>;
    const v = d[field] || emptyKategoriCounts();
    return v;
  };
  const [qrisPnp, setQrisPnp] = useState<KategoriCounts>(() => {
    const q = initialSub('qrisPnp'); const t = initialSub('tapPnp'); const s = initialSub('siAntengPnp');
    const sumSub = KATEGORI_LIST.reduce((a, k) => a + (q[k.key] || 0) + (t[k.key] || 0) + (s[k.key] || 0), 0);
    if (sumSub === 0) return { ...(initialDraft.nonTunaiPnp || emptyKategoriCounts()) };
    return q;
  });
  const [tapPnp, setTapPnp] = useState<KategoriCounts>(() => initialSub('tapPnp'));
  const [siAntengPnp, setSiAntengPnp] = useState<KategoriCounts>(() => initialSub('siAntengPnp'));
  const [manualPnp, setManualPnp] = useState<KategoriCounts>(
    () => initialDraft.manualPnp || emptyKategoriCounts()
  );
  const [pptPnp, setPptPnp] = useState<KategoriCounts>(
    () => initialDraft.pptPnp || emptyKategoriCounts()
  );
  const [ket, setKet] = useState(initialDraft.ket || '');


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
      qrisPnp,
      tapPnp,
      siAntengPnp,
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
    qrisPnp,
    tapPnp,
    siAntengPnp,
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
    () =>
      isCadangan && idPerjalananAsal.trim()
        ? `${koridor}-LBC01${rit}${tanggal.split('-').join('')}-GANTI-${idPerjalananAsal.trim()}`
        : `${koridor}-${lb}${rit}${tanggal.split('-').join('')}`,
    [koridor, lb, rit, tanggal, isCadangan, idPerjalananAsal]
  );


  const matriks = useMemo(() => {
    const tunaiRp = emptyKategoriCounts();
    const nonTunaiRp = emptyKategoriCounts();
    const manualRp = emptyKategoriCounts();
    const qrisRp = emptyKategoriCounts();
    const tapRp = emptyKategoriCounts();
    const siAntengRp = emptyKategoriCounts();
    let subTunaiPnp = 0;
    let subTunaiRp = 0;
    let subNonTunaiPnp = 0;
    let subNonTunaiRp = 0;
    let subQrisPnp = 0;
    let subQrisRp = 0;
    let subTapPnp = 0;
    let subTapRp = 0;
    let subSiAntengPnp = 0;
    let subSiAntengRp = 0;
    let subManualPnp = 0;
    let subManualRp = 0;
    let subPptPnp = 0;

    for (const k of KATEGORI_LIST) {
      const tp = Math.max(0, tunaiPnp[k.key] || 0);
      const qp = Math.max(0, qrisPnp[k.key] || 0);
      const tap = Math.max(0, tapPnp[k.key] || 0);
      const sia = Math.max(0, siAntengPnp[k.key] || 0);
      const ntp = qp + tap + sia;
      const mp = Math.max(0, manualPnp[k.key] || 0);
      const pp = Math.max(0, pptPnp[k.key] || 0);
      const tr = tp * k.tarif;
      const ntr = ntp * k.tarif;
      const mr = mp * k.tarif;
      tunaiRp[k.key] = tr;
      nonTunaiRp[k.key] = ntr;
      manualRp[k.key] = mr;
      qrisRp[k.key] = qp * k.tarif;
      tapRp[k.key] = tap * k.tarif;
      siAntengRp[k.key] = sia * k.tarif;
      subTunaiPnp += tp;
      subTunaiRp += tr;
      subNonTunaiPnp += ntp;
      subNonTunaiRp += ntr;
      subQrisPnp += qp;
      subQrisRp += qp * k.tarif;
      subTapPnp += tap;
      subTapRp += tap * k.tarif;
      subSiAntengPnp += sia;
      subSiAntengRp += sia * k.tarif;
      subManualPnp += mp;
      subManualRp += mr;
      subPptPnp += pp;
    }

    return {
      tunaiRp,
      nonTunaiRp,
      manualRp,
      qrisRp,
      tapRp,
      siAntengRp,
      subTunaiPnp,
      subTunaiRp,
      subNonTunaiPnp,
      subNonTunaiRp,
      subQrisPnp,
      subQrisRp,
      subTapPnp,
      subTapRp,
      subSiAntengPnp,
      subSiAntengRp,
      subManualPnp,
      subManualRp,
      subPptPnp,
      // Total Pnp & Total Setoran = Tunai + Non-Tunai + Manual.
      // PPT terpisah, Rp-nya 0, tidak masuk total.
      totalPnp: subTunaiPnp + subNonTunaiPnp + subManualPnp,
      totalSetoran: subTunaiRp + subNonTunaiRp + subManualRp,
    };
  }, [tunaiPnp, nonTunaiPnp, qrisPnp, tapPnp, siAntengPnp, manualPnp, pptPnp]);



  // ===== KL1: data dari input yang sedang diisi (kalau sudah ada) =====
  // Kalau input masih kosong tapi riwayat ada untuk ID ini, pakai riwayat.
  const dataKL1: KL1Data | null = useMemo(() => {
    const saved = riwayat.find((r) => r.idPerjalanan === idPerjalanan);
    const pakaiInput = matriks.totalPnp > 0 || matriks.subPptPnp > 0;
    if (!pakaiInput && !saved) return null;
    const getRow = (key: KategoriKey): KL1RowData => {
      const kat = KATEGORI_LIST.find((x) => x.key === key)!;
      if (pakaiInput) {
        const t = tunaiPnp[key] || 0; const m = manualPnp[key] || 0;
        const q = qrisPnp[key] || 0; const tap = tapPnp[key] || 0; const sia = siAntengPnp[key] || 0;
        return { label: kat.label, eTickPnp: t, eTickRp: t * kat.tarif, manPnp: m, manRp: m * kat.tarif, qrisPnp: q, qrisRp: q * kat.tarif, tapPnp: tap, tapRp: tap * kat.tarif, siAntengPnp: sia, siAntengRp: sia * kat.tarif };
      }
      const loose = saved as unknown as Record<string, Record<string, number> | undefined>;
      const t = Number(saved?.rincianTunaiPnp?.[key]) || 0; const nt = Number(saved?.rincianNonTunaiPnp?.[key]) || 0; const m = Number(loose.rincianManualPnp?.[key]) || 0;
      let q = Number(loose.rincianQrisPnp?.[key]) || 0; let tap = Number(loose.rincianTapPnp?.[key]) || 0; let sia = Number(loose.rincianSiAntengPnp?.[key]) || 0;
      if (q + tap + sia === 0 && nt > 0) q = nt; // data lama tanpa rincian -> anggap QRIS supaya total cocok
      return { label: kat.label, eTickPnp: t, eTickRp: t * kat.tarif, manPnp: m, manRp: m * kat.tarif, qrisPnp: q, qrisRp: q * kat.tarif, tapPnp: tap, tapRp: tap * kat.tarif, siAntengPnp: sia, siAntengRp: sia * kat.tarif };
    };
    const tabel1 = [getRow('umum'), getRow('pelajar'), getRow('buruh')];
    const tabel2 = [getRow('veteran'), getRow('disabilitas'), getRow('lansia')];
    const totalPnp = pakaiInput ? matriks.totalPnp : Number(saved?.totalPenumpang) || 0;
    const totalRp = pakaiInput ? matriks.totalSetoran : Number(saved?.totalPendapatan) || 0;
    const m = idPerjalanan.match(/^(KOR\d+)-([A-Z]+\d+)(R\d+)(\d{8})$/);
    const tglRaw = m?.[4] || '';
    const tanggalKL1 = tglRaw ? `${tglRaw.slice(6, 8)}-${tglRaw.slice(4, 6)}-${tglRaw.slice(0, 4)}` : tanggal;
    const hariKL1 = tglRaw ? ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][new Date(Number(tglRaw.slice(0, 4)), Number(tglRaw.slice(4, 6)) - 1, Number(tglRaw.slice(6, 8))).getDay()] : '-';
    // POOL / TERMINAL AWAL — JANGAN pakai KOR01 (itu koridor, bukan terminal).
    // Ambil dari DB_MASTER sheet MASTER_JADWAL lewat util yang sama dengan
    // Terminal Akhir (getTerminalAkhirFromMasterRit sudah baca MASTER_JADWAL).
    // Di MASTER_JADWAL terminal hanya ada 2: BULUPITU & BUKATEJA, jadi
    // TERMINAL_AWAL = lawan TERMINAL_AKHIR untuk LB + RIT yang sama.
    // Contoh: RIT yang TERMINAL_AKHIR-nya BULUPITU -> TERMINAL_AWAL-nya BUKATEJA.
    // Pakai LB + RIT dari ID_PERJALANAN (bukan dari input sekarang), supaya
    // KL1 dari riwayat lama tetap dapat terminal yang benar.
    const lbKL1 = m?.[2] || lb;
    const ritKL1 = m?.[3] || rit;
    const akhirKL1 = String(getTerminalAkhirFromMasterRit(lbKL1, ritKL1) || '').toUpperCase();
    const poolKL1 = akhirKL1.includes('BULUPITU') ? 'BUKATEJA' : akhirKL1.includes('BUKATEJA') ? 'BULUPITU' : '';
    return {
      idPerjalanan, pool: poolKL1 || '-', lambung: lbKL1, shift: shift.toUpperCase().includes('2') ? 'SHIFT 2' : 'SHIFT 1',
      hari: hariKL1, tanggal: tanggalKL1, tabel1, tabel2, totalPnp, totalRp,
      terbilang: `# ${terbilangKL1(totalRp).trim()} Rupiah #`,
      adminKasir: petugasNama, pramujasa: pramujasaKL1, keterangan: pakaiInput ? (ket.trim() || '-') : (saved?.keterangan || '-'),
    };
  }, [riwayat, idPerjalanan, matriks, tunaiPnp, nonTunaiPnp, qrisPnp, tapPnp, siAntengPnp, manualPnp, koridor, lb, shift, tanggal, petugasNama, ket, pramujasaKL1]);

  // KL1 TTD PRAMUJASA — OTOMATIS seperti nama petugas kasir:
  // Dijemput SEJAK ID_PERJALANAN terbentuk (bukan baru pas KL1 dibuka), jadi pas KL1
  // dibuka namanya sudah ada. Hasilnya disimpan di HP (localStorage) per ID_PERJALANAN,
  // jadi buka ID yang sama kedua kalinya langsung muncul tanpa jemput lagi — persis
  // seperti petugas kasir yang sudah tersimpan di HP.
  // Coba 2 jalur berurutan: (1) API Pramujasa, (2) API Kasir ?action=getPramujasa.
  useEffect(() => {
    if (!idPerjalanan) return;
    let batal = false;
    // 1) Ambil dari simpanan HP dulu (langsung tampil)
    try {
      const cache = JSON.parse(localStorage.getItem('anteng_pramujasa_by_id') || '{}') as Record<string, string>;
      if (cache[idPerjalanan]) { setPramujasaKL1(cache[idPerjalanan]); setPramujasaKL1Loading(false); return; }
    } catch {}
    // 2) Belum ada di HP -> jemput dari server di latar belakang
    setPramujasaKL1Loading(true);
    const ambilDari = async (base: string): Promise<string> => {
      if (!base) return '';
      try {
        const r = await fetch(`${base}?action=getPramujasa&id_perjalanan=${encodeURIComponent(idPerjalanan)}`, { method: 'GET' });
        const j = await r.json().catch(() => null);
        return String((j && j.pramujasa) || '');
      } catch { return ''; }
    };
    (async () => {
      let nama = await ambilDari(API_PRAMUJASA);
      if (!nama && API_KASIR && API_KASIR !== API_PRAMUJASA) nama = await ambilDari(API_KASIR);
      if (batal) return;
      setPramujasaKL1(nama);
      setPramujasaKL1Loading(false);
      // 3) Simpan ke HP kalau ketemu, untuk buka berikutnya
      if (nama) {
        try {
          const cache = JSON.parse(localStorage.getItem('anteng_pramujasa_by_id') || '{}') as Record<string, string>;
          cache[idPerjalanan] = nama;
          localStorage.setItem('anteng_pramujasa_by_id', JSON.stringify(cache));
        } catch {}
      }
    })();
    return () => { batal = true; };
  }, [idPerjalanan]);

  // KL1: begitu dibuka, langsung siap print (Landscape via @page di KL1_CSS)
  // SIMPAN PDF: JANGAN auto-print. window.print() otomatis tanpa klik diblokir browser
  // (terutama di HP), jadi dialog tidak muncul / PDF blank. Print hanya dari klik tombol
  // CETAK / SIMPAN PDF di bawah — itu user gesture, jadi diizinkan browser.

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
    jenis: 'tunai' | 'nonTunai' | 'manual' | 'ppt' | 'qris' | 'tap' | 'siAnteng',
    key: KategoriKey,
    val: string
  ) => {
    const n = Math.max(0, parseInt(val, 10) || 0);
    if (jenis === 'tunai') setTunaiPnp((prev) => ({ ...prev, [key]: n }));
    else if (jenis === 'nonTunai') setNonTunaiPnp((prev) => ({ ...prev, [key]: n }));
    else if (jenis === 'manual') setManualPnp((prev) => ({ ...prev, [key]: n }));
    else if (jenis === 'qris') { setQrisPnp((prev) => ({ ...prev, [key]: n })); setNonTunaiPnp((prev) => ({ ...prev, [key]: n + (tapPnp[key] || 0) + (siAntengPnp[key] || 0) })); }
    else if (jenis === 'tap') { setTapPnp((prev) => ({ ...prev, [key]: n })); setNonTunaiPnp((prev) => ({ ...prev, [key]: (qrisPnp[key] || 0) + n + (siAntengPnp[key] || 0) })); }
    else if (jenis === 'siAnteng') { setSiAntengPnp((prev) => ({ ...prev, [key]: n })); setNonTunaiPnp((prev) => ({ ...prev, [key]: (qrisPnp[key] || 0) + (tapPnp[key] || 0) + n })); }
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
    QRIS_UMUM: (rec as unknown as Record<string, Record<string, number> | undefined>).rincianQrisPnp?.umum || 0,
    QRIS_PELAJAR: (rec as unknown as Record<string, Record<string, number> | undefined>).rincianQrisPnp?.pelajar || 0,
    QRIS_BURUH: (rec as unknown as Record<string, Record<string, number> | undefined>).rincianQrisPnp?.buruh || 0,
    QRIS_LANSIA: (rec as unknown as Record<string, Record<string, number> | undefined>).rincianQrisPnp?.lansia || 0,
    QRIS_VETERAN: (rec as unknown as Record<string, Record<string, number> | undefined>).rincianQrisPnp?.veteran || 0,
    QRIS_DISABILITAS: (rec as unknown as Record<string, Record<string, number> | undefined>).rincianQrisPnp?.disabilitas || 0,
    TAP_UMUM: (rec as unknown as Record<string, Record<string, number> | undefined>).rincianTapPnp?.umum || 0,
    TAP_PELAJAR: (rec as unknown as Record<string, Record<string, number> | undefined>).rincianTapPnp?.pelajar || 0,
    TAP_BURUH: (rec as unknown as Record<string, Record<string, number> | undefined>).rincianTapPnp?.buruh || 0,
    TAP_LANSIA: (rec as unknown as Record<string, Record<string, number> | undefined>).rincianTapPnp?.lansia || 0,
    TAP_VETERAN: (rec as unknown as Record<string, Record<string, number> | undefined>).rincianTapPnp?.veteran || 0,
    TAP_DISABILITAS: (rec as unknown as Record<string, Record<string, number> | undefined>).rincianTapPnp?.disabilitas || 0,
    SI_ANTENG_UMUM: (rec as unknown as Record<string, Record<string, number> | undefined>).rincianSiAntengPnp?.umum || 0,
    SI_ANTENG_PELAJAR: (rec as unknown as Record<string, Record<string, number> | undefined>).rincianSiAntengPnp?.pelajar || 0,
    SI_ANTENG_BURUH: (rec as unknown as Record<string, Record<string, number> | undefined>).rincianSiAntengPnp?.buruh || 0,
    SI_ANTENG_LANSIA: (rec as unknown as Record<string, Record<string, number> | undefined>).rincianSiAntengPnp?.lansia || 0,
    SI_ANTENG_VETERAN: (rec as unknown as Record<string, Record<string, number> | undefined>).rincianSiAntengPnp?.veteran || 0,
    SI_ANTENG_DISABILITAS: (rec as unknown as Record<string, Record<string, number> | undefined>).rincianSiAntengPnp?.disabilitas || 0,
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


  // === NOMOR 3 SAJA: cek duplikat ID_PERJALANAN langsung ke DB_KASIR (server) ===
  const cekIdPerjalananDiServer = async (): Promise<boolean> => {
    if (!API_KASIR) return false;
    try {
      const res = await fetch(
        `${API_KASIR}?action=cek_id_perjalanan&id_perjalanan=${encodeURIComponent(idPerjalanan)}`,
        { method: 'GET' }
      );
      const json = await res.json().catch(() => null);
      return Boolean(json && (json.sudahAda === true || json.status === 'DUPLIKAT'));
    } catch {
      return false;
    }
  };

  const handleSimpan = async () => {
    if (sending) return;
    // Validasi panel cadangan LBC01 — penambahan saja
    if (isCadangan && !idPerjalananAsal.trim()) {
      showToast('Isi dulu Bus yang diganti (ID Perjalanan Asal) untuk LBC01.', 'warn');
      return;
    }
    if (photoBusyCount > 0) {
      showToast('Foto sedang diproses, tunggu sebentar lalu klik Simpan lagi.', 'warn');
      return;
    }
    if (existingFailedRecord && matriks.totalPnp === 0 && matriks.subPptPnp === 0 && !adaLF) {
      await kirimKasirKeServer(existingFailedRecord);
      return;
    }
    // === NOMOR 3 SAJA: tolak simpan kalau ID_PERJALANAN sudah ada di DB_KASIR ===
    if (await cekIdPerjalananDiServer()) {
      showToast(`ID_PERJALANAN ${idPerjalanan} SUDAH ADA DI DB_KASIR. Simpan ditolak agar data tidak ganda.`, 'err');
      return;
    }
    const freshRiw = bacaStorage<KasirRecord>(STORAGE_KASIR_KEY);
    if (
      freshRiw.some((r) => r.idPerjalanan === idPerjalanan && r.statusKirim !== 'GAGAL_KIRIM') ||
      hasSavedIdPerjalanan(IDS_KASIR_KEY, idPerjalanan)
    ) {
      showToast(`ID_PERJALANAN ${idPerjalanan} SUDAH ADA. Simpan ditolak agar data tidak ganda.`, 'err');
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
      rincianQrisPnp: { ...qrisPnp },
      rincianQrisRp: { ...matriks.qrisRp },
      rincianTapPnp: { ...tapPnp },
      rincianTapRp: { ...matriks.tapRp },
      rincianSiAntengPnp: { ...siAntengPnp },
      rincianSiAntengRp: { ...matriks.siAntengRp },
      rincianManualPnp: { ...manualPnp },
      rincianManualRp: { ...matriks.manualRp },
      rincianPptPnp: { ...pptPnp },
      adaLostFound: adaLF,
      rincianLostFound: lfDetailText,
      lostFoundData: dataLF,
      keterangan: ketVal,
      statusPerjalanan: statusPerjalananEfektif,
      idPerjalananAsal: tampilPanelCadangan ? idPerjalananAsal.trim() : '',
      titikGanti: tampilPanelCadangan ? titikGanti : '',
      halteTitikGanti: tampilPanelCadangan ? halteTitikGanti : '',
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
    setQrisPnp(emptyKategoriCounts());
    setTapPnp(emptyKategoriCounts());
    setSiAntengPnp(emptyKategoriCounts());
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
                {jenis === 'nonTunai' ? (
                  <div>
                    <div className="grid grid-cols-3 gap-2">
                      {([['qris', 'QRIS', qrisPnp], ['tap', 'TAP', tapPnp], ['siAnteng', 'SI ANTENG', siAntengPnp]] as const).map(([sub, labelSub, stateSub]) => (
                        <div key={sub}>
                          <label className="block text-[11px] font-extrabold text-slate-600 mb-1 text-center">{labelSub}</label>
                          <input type="number" min={0} placeholder="0" value={stateSub[kat.key] || ''} onChange={(e) => updatePnp(sub, kat.key, e.target.value)} className="w-full px-2 py-2 rounded-xl border-2 border-slate-700 bg-white font-mono-num font-extrabold text-center text-sm" />
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex justify-between items-center bg-sky-50 border border-sky-200 rounded-lg px-2 py-1.5 text-xs font-extrabold text-sky-900">
                      <span>Non-Tunai {kat.label} (QRIS+TAP+SI ANTENG)</span><span className="font-mono-num">{nonTunaiPnp[kat.key] || 0} org · {formatRupiah(matriks.nonTunaiRp[kat.key] || 0)}</span>
                    </div>
                  </div>
                ) : (
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
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // KL2: kalau mode KL2 aktif, tampilkan hanya KL2 (persis sheet Excel, Landscape, siap print)
  if (showKL2) {
    return <KL2SheetView data={dataKL2} onClose={() => setShowKL2(false)} onRowsChange={setKl2Rows} onShelterChange={setKl2Shelter} onAutoFill={handleKl2AutoFill} />;
  }
  // KL1: kalau mode KL1 aktif, tampilkan hanya KL1 (persis sheet, Landscape, siap print)
  if (showKL1 && dataKL1) {
    return <KL1SheetView data={dataKL1} onClose={() => setShowKL1(false)} onPramujasaChange={(nama) => { setPramujasaKL1(nama); try { const cache = JSON.parse(localStorage.getItem('anteng_pramujasa_by_id') || '{}') as Record<string, string>; if (nama.trim()) { cache[idPerjalanan] = nama.trim(); localStorage.setItem('anteng_pramujasa_by_id', JSON.stringify(cache)); } } catch {} }} />;
  }

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


          {/* ===== PANEL CADANGAN LBC01 — muncul otomatis kalau LB = LBC01 ===== */}
          {tampilPanelCadangan && (
            <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-3.5 space-y-2.5">
              <p className="font-extrabold text-amber-900">🚌 ARMADA CADANGAN AKTIF — {lb}</p>
              <p className="text-xs text-amber-800">Bus ini menggantikan bus reguler. Setoran ini adalah segmen LBC01, bukan setoran bus reguler.</p>
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
              className="w-full px-3 py-3 rounded-xl border-2 border-violet-600 bg-violet-50 font-mono-num font-extrabold text-center text-violet-950 text-lg"
            />
            {existingValidRecord && (
              <div className="mt-2 rounded-xl border-2 border-red-300 bg-red-50 px-3 py-2 text-center text-xs font-extrabold text-red-800">
                ID_PERJALANAN SUDAH ADA ({idPerjalanan})
              </div>
            )}
            {/* PRAMUJASA BERTUGAS — otomatis terisi dari DB_PRAMUJASA lewat ID_PERJALANAN, seperti petugas kasir */}
            <div className="mt-2 rounded-xl border-2 border-violet-300 bg-violet-50 px-3 py-2 text-center">
              <span className="text-xs font-extrabold text-violet-800">PRAMUJASA BERTUGAS: </span>
              <span className="text-sm font-extrabold text-violet-950">{pramujasaKL1Loading ? 'Mengambil...' : (pramujasaKL1 || '— belum ketemu —')}</span>
            </div>
          </div>


          {/* Matriks Setoran Per Kategori */}
          <div className="bg-white border-2 border-slate-300 rounded-2xl p-3.5 space-y-2.5">
            <div className="text-center">
              <h4 className="text-sm font-extrabold text-slate-900">SETORAN PER KATEGORI (RP)</h4>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                Isi jumlah penumpang per kategori; nominal setoran (Rp) dihitung otomatis
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
                  placeholder="Cth: Dompet Coklat, HP Samsung, Tas Ransel..."
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
                    placeholder="Cth: Samsung, Eiger"
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


            {/* KL1: tombol LIHAT KL1 - di bawah SIMPAN, di atas BARANG TERTINGGAL */}
            <button type="button" disabled={!dataKL1} onClick={() => setShowKL1(true)} className="w-full py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-base cursor-pointer disabled:opacity-50">{dataKL1 ? 'LIHAT KL1' : 'FORM KL1 (ISI DATA DULU)'}</button>
            <button type="button" onClick={() => setShowKL2(true)} className="w-full py-3.5 rounded-2xl bg-teal-700 hover:bg-teal-800 text-white font-extrabold text-base cursor-pointer">LIHAT KL2 (REKAP 1 HARI / 1 SHIFT)</button>
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
