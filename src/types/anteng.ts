export type RoleType = 'Timer' | 'PPA' | 'Pramujasa' | 'Kasir';
export type ScreenId = 's1' | 's2' | 's3' | 's4' | 's5' | 's6';
export type ToastType = 'ok' | 'warn' | 'err' | '';

export interface UserLoginRecord {
  username: string;
  password: string;
  role: string;
  status: string;
  nama: string;
}

export interface MasterRitInfo {
  koridor?: string;
  pola?: string;
  arah?: string; // 'BK' | 'BP'
  terminal?: string;
  terminalAkhir?: string;
}

export interface MasterPramudiItem {
  id: string;
  nama: string;
  awalOperasional?: string;
  status: string;
}

export interface MasterHalteItem {
  id: string;
  koridor: string;
  nama: string;
  arah: string; // 'BK' | 'BP'
  status: string;
}

export type MasterJadwalMap = Record<string, Record<string, string>>;
export type MasterRitMap = Record<string, MasterRitInfo>;

export interface TimerRecord {
  petugas: string;
  tanggal: string;
  koridor: string;
  noLambung: string;
  rit: string;
  polaOperasional: string;
  idPerjalanan: string;
  idTransaksi: string;
  terminal: string;
  jadwal: string;
  aktual: string;
  pnpNaik: number;
  pnpTransit: number;
  pnpTurun: number;
  kendala: string;
  catatan: string;
  status: 'PENDING' | 'TERVALIDASI' | 'GAGAL_KIRIM';
  waktuKirim: string;
}

export interface TimerLookupData {
  idPerjalanan?: string;
  terminal?: string;
  polaOperasional?: string;
  jadwal?: string;
  aktual?: string;
  pnpNaik?: number;
  pnpTransit?: number;
  pnpTurun?: number;
  pramudi?: string;
  tidakKetemu?: boolean;
  error?: string;
}

export interface PpaRecord {
  tanggal: string;
  idPerjalanan: string;
  pos: string;
  posPPA: string;
  jamTiba: string;
  jamTibaPos: string;
  aktual: string;
  jamBerangkatAktual: string;
  waktuTempuhKePos: string;
  headwayPos: string;
  all: number;
  allPnp: number;
  naik: number;
  pnpNaik: number;
  turun: number;
  pnpTurun: number;
  keterangan: string;
  ket: string;
  petugas: string;
  waktuKirim: string;
  koridor: string;
  noLambung: string;
  rit: string;
  polaOperasional: string;
  status: 'Tervalidasi' | 'GAGAL_KIRIM';
}

export type KategoriKey = 'umum' | 'buruh' | 'pelajar' | 'lansia' | 'disabilitas' | 'veteran';
export type KategoriCounts = Record<KategoriKey, number>;

export interface PramujasaRecord {
  idTransaksi: string;
  idDetail: string;
  tanggal: string;
  koridor: string;
  noLambung: string;
  rit: string;
  idPerjalanan: string;
  shift: string;
  jamTiba: string;
  idHalte: string;
  namaHalte: string;
  tunai: KategoriCounts;
  nonTunai: KategoriCounts;
  totalTunai: number;
  totalNonTunai: number;
  totalHalte: number;
  penumpangTurun: number;
  penumpangTransit?: number;
  penumpangPPT?: number;
  keterangan: string;
  petugas: string;
  idPramudi?: string;
  namaPramudi?: string;
  status: 'SEMENTARA' | 'TERVALIDASI' | 'GAGAL_KIRIM';
  waktuKirim: string;
  // Legacy compatibility fields for reading older stored items
  metodeBayar?: string;
  umum?: number;
  buruh?: number;
  pelajar?: number;
  lansia?: number;
  disabilitas?: number;
  veteran?: number;
}

export interface LostFoundData {
  ID_BARANG: string;
  TANGGAL: string;
  JAM: string;
  ID_PERJALANAN: string;
  ID_ARMADA: string;
  RIT: string;
  KORIDOR: string;
  LOKASI_DITEMUKAN: string;
  NMA_BARANG: string;
  KATEGORI: string;
  WARNA: string;
  MEREK: string;
  DESKRIPSI: string;
  FOTO_1: string;
  FOTO_2: string;
  foto1?: string;
  foto2?: string;
  DITEMUKAN_OLEH: string;
  PENERIMA: string;
  STATUS: string;
  NAMA_PEMILIK: string;
  NO_HP: string;
  NO_IDENTITAS: string;
  TANGGAL_DIAMBIL: string;
  JAM_DIAMBIL: string;
  PENERIMA_BARANG: string;
  CATATAN: string;
}

export interface KasirRecord {
  idKasirTransaksi: string;
  tanggal: string;
  koridor: string;
  noLambung: string;
  rit: string;
  shift?: string;
  idPerjalanan: string;
  petugasKasir: string;
  totalPenumpang: number;
  subtotalTunaiPnp: number;
  subtotalNonTunaiPnp: number;
  totalPnpRincian: number;
  setoranTunai: number;
  setoranNonTunai: number;
  subtotalTunaiRp: number;
  subtotalNonTunaiRp: number;
  totalPendapatan: number;
  rincianTunaiPnp: KategoriCounts;
  rincianTunaiRp: KategoriCounts;
  rincianNonTunaiPnp: KategoriCounts;
  rincianNonTunaiRp: KategoriCounts;
  adaLostFound: boolean;
  rincianLostFound: string;
  lostFoundData: LostFoundData | null;
  keterangan: string;
  statusKirim: 'TERKIRIM' | 'GAGAL_KIRIM' | 'MENUNGGU_SYNC' | 'TERSIMPAN_LOKAL';
  waktuCatat: string;
  createdAt: string;
}

export interface LostItemDisplay {
  id?: string;
  barang: string;
  lambung: string;
  tgl: string;
  status: string;
  foto: string;
  foto2?: string;
  lokasi?: string;
  kategori?: string;
}
