import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Image as ImageIcon, RefreshCw, Search, X } from 'lucide-react';
import { KasirRecord, LostItemDisplay } from '../types/anteng';
import {
  STORAGE_KASIR_KEY,
  bacaStorage,
  fetchLostFoundSheet,
  resolveLfPhotoUrl,
} from '../utils/anteng';

interface LostFoundScreenProps {
  onBack: () => void;
}

const DEFAULT_LOST_ITEMS: LostItemDisplay[] = [
  {
    id: 'SAMPLE-1',
    barang: 'Dompet Coklat',
    lambung: 'LB03',
    tgl: '19-11-2026',
    status: 'Di Kantor',
    lokasi: 'Kursi Tengah LB03',
    foto: '',
  },
  {
    id: 'SAMPLE-2',
    barang: 'HP Samsung',
    lambung: 'LB07',
    tgl: '19-11-2026',
    status: 'Di Kantor',
    lokasi: 'Rak Atas LB07',
    foto: '',
  },
  {
    id: 'SAMPLE-3',
    barang: 'Tas Ransel Hitam',
    lambung: 'LB01',
    tgl: '18-11-2026',
    status: 'Sudah Diambil',
    lokasi: 'Halte Bukateja',
    foto: '',
  },
];

export function LostFoundScreen({ onBack }: LostFoundScreenProps) {
  const [query, setQuery] = useState('');
  const [tglFilter, setTglFilter] = useState('');
  const [sheetItems, setSheetItems] = useState<LostItemDisplay[]>([]);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [modalItem, setModalItem] = useState<LostItemDisplay | null>(null);

  const loadFromSheet = async () => {
    setLoadingSheet(true);
    const items = await fetchLostFoundSheet();
    setSheetItems(items);
    setLoadingSheet(false);
  };

  useEffect(() => {
    void loadFromSheet();
  }, []);

  const allItems = useMemo(() => {
    const localKasir = bacaStorage<KasirRecord>(STORAGE_KASIR_KEY);
    const merged: LostItemDisplay[] = [];
    const seenIds = new Set<string>();

    for (const row of localKasir) {
      if (row?.adaLostFound && row.lostFoundData) {
        const lf = row.lostFoundData;
        const tglFmt = (lf.TANGGAL || row.tanggal || '').split('-').reverse().join('-');
        const foto1 = resolveLfPhotoUrl(lf.ID_BARANG, 1, lf.FOTO_1 || lf.foto1);
        const foto2 = resolveLfPhotoUrl(lf.ID_BARANG, 2, lf.FOTO_2 || lf.foto2);

        if (lf.ID_BARANG) seenIds.add(lf.ID_BARANG);
        merged.push({
          id: lf.ID_BARANG,
          barang: lf.NMA_BARANG || 'Barang Temuan',
          lambung: lf.ID_ARMADA || row.noLambung || '-',
          tgl: tglFmt,
          status: lf.STATUS || 'DI_KANTOR',
          foto: foto1 || foto2 || '',
          foto2: foto1 && foto2 ? foto2 : undefined,
          lokasi: lf.LOKASI_DITEMUKAN || '-',
          kategori: lf.KATEGORI,
        });
      }
    }

    for (const sItem of sheetItems) {
      if (sItem.id && seenIds.has(sItem.id)) continue;
      if (sItem.id) seenIds.add(sItem.id);
      merged.push(sItem);
    }

    if (merged.length === 0) {
      return DEFAULT_LOST_ITEMS;
    }
    return merged;
  }, [sheetItems]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allItems.filter((d) => {
      const cocokKata =
        !q ||
        d.barang.toLowerCase().includes(q) ||
        d.lambung.toLowerCase().includes(q) ||
        (d.lokasi || '').toLowerCase().includes(q);
      const tglData = d.tgl.includes('-') && d.tgl.split('-')[0].length === 2
        ? d.tgl.split('-').reverse().join('-')
        : d.tgl;
      const cocokTgl = !tglFilter || tglData === tglFilter;
      return cocokKata && cocokTgl;
    });
  }, [allItems, query, tglFilter]);

  return (
    <div className="min-h-screen bg-slate-100 py-4 px-3 sm:px-6">
      <div className="max-w-2xl mx-auto bg-white rounded-3xl shadow-sm border border-slate-200 p-5 sm:p-6 relative">
        <div className="flex items-center justify-between gap-3 mb-5">
          <button
            type="button"
            onClick={onBack}
            className="w-11 h-11 rounded-full bg-slate-900 text-white flex items-center justify-center hover:bg-slate-700 cursor-pointer shrink-0"
            aria-label="Kembali"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-center flex-1">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">BARANG TERTINGGAL</h1>
            <p className="text-sm text-slate-500 font-medium">Data Lost &amp; Found Penumpang</p>
          </div>
          <button
            type="button"
            onClick={() => void loadFromSheet()}
            disabled={loadingSheet}
            title="Sinkronkan dari Sheet DATA_LOST_FOUND"
            className="w-11 h-11 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center hover:bg-violet-200 cursor-pointer shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loadingSheet ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wide text-slate-700 mb-1.5">
              Cari Barang / Bus / Lokasi
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cth: Dompet / HP / LB03..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-3 border-2 border-slate-800 rounded-xl font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wide text-slate-700 mb-1.5">
              Filter Tanggal
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={tglFilter}
                onChange={(e) => setTglFilter(e.target.value)}
                className="flex-1 px-3 py-3 border-2 border-slate-800 rounded-xl font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              {tglFilter && (
                <button
                  type="button"
                  onClick={() => setTglFilter('')}
                  className="px-3 py-2 rounded-xl border-2 border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="text-center text-slate-500 py-10 font-medium">
            Tidak ada barang tertinggal yang cocok.
          </p>
        ) : (
          <div className="space-y-3">
            {filtered.map((item, idx) => (
              <div
                key={item.id || `${item.barang}-${idx}`}
                className="border-2 border-violet-200 bg-violet-50/30 rounded-2xl p-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-extrabold text-lg text-slate-900 truncate">{item.barang}</div>
                  <div className="text-sm text-slate-600 font-medium mt-0.5">
                    Bus {item.lambung} · {item.tgl}
                    {item.lokasi ? ` · ${item.lokasi}` : ''}
                  </div>
                  <div className="text-xs font-bold text-violet-800 mt-1">Status: {item.status}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setModalItem(item)}
                  className="px-3.5 py-2.5 rounded-xl bg-violet-700 hover:bg-violet-800 text-white text-xs font-extrabold shrink-0 cursor-pointer"
                >
                  Lihat Barang
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={onBack}
          className="w-full mt-6 py-3.5 rounded-2xl bg-slate-600 hover:bg-slate-700 text-white font-extrabold text-base cursor-pointer"
        >
          KEMBALI
        </button>
      </div>

      {modalItem && (
        <div
          onClick={() => setModalItem(null)}
          className="fixed inset-0 z-50 bg-black/85 flex flex-col items-center justify-center p-5"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-2xl overflow-hidden shadow-xl"
          >
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-lg">{modalItem.barang}</h3>
                <p className="text-xs text-slate-300">
                  Bus {modalItem.lambung} · {modalItem.tgl} · {modalItem.status}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalItem(null)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 bg-slate-50 flex flex-col items-center justify-center min-h-[240px] gap-2.5">
              {modalItem.foto ? (
                <>
                  <img
                    src={modalItem.foto}
                    alt={modalItem.barang}
                    referrerPolicy="no-referrer"
                    className="max-h-72 w-full object-contain rounded-xl bg-white border border-slate-200"
                  />
                  {modalItem.foto2 && (
                    <img
                      src={modalItem.foto2}
                      alt={`${modalItem.barang} - Foto 2`}
                      referrerPolicy="no-referrer"
                      className="max-h-72 w-full object-contain rounded-xl bg-white border border-slate-200"
                    />
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                  <ImageIcon className="w-12 h-12 mb-2" />
                  <p className="text-sm font-semibold">Tidak ada foto terlampir</p>
                </div>
              )}
              {modalItem.lokasi && (
                <p className="text-xs font-semibold text-slate-600 mt-3">
                  Lokasi Ditemukan: {modalItem.lokasi}
                </p>
              )}
            </div>
            <div className="p-3 bg-white border-t border-slate-200">
              <button
                type="button"
                onClick={() => setModalItem(null)}
                className="w-full py-3 rounded-xl bg-slate-800 text-white font-extrabold text-sm cursor-pointer"
              >
                TUTUP
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
