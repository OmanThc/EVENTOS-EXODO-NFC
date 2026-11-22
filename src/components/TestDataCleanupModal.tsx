import React, { useState, useMemo } from 'react';
import {
  X,
  Eraser,
  Trash2,
  CheckSquare,
  Square,
  Search,
  AlertTriangle,
  Check,
  Users,
  Receipt,
  Package,
  Store,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatUSD, formatBs, formatDateTime } from '../utils/formatters';

interface TestDataCleanupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type CleanupTab = 'STICKERS' | 'TRANSACTIONS' | 'PRODUCTS' | 'PROVIDERS';

export const TestDataCleanupModal: React.FC<TestDataCleanupModalProps> = ({ isOpen, onClose }) => {
  const {
    currentCompany,
    stickers,
    transactions,
    products,
    providers,
    settings,
    deleteStickersBulk,
    deleteTransactionsBulk,
    deleteProductsBulk,
    deleteProvidersBulk,
    wipeCurrentCompanyTestData,
  } = useApp();

  const [activeTab, setActiveTab] = useState<CleanupTab>('STICKERS');
  const [search, setSearch] = useState<string>('');
  const [selectedStickerIds, setSelectedStickerIds] = useState<string[]>([]);
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [selectedProviderIds, setSelectedProviderIds] = useState<string[]>([]);
  const [alsoDeleteStickerTx, setAlsoDeleteStickerTx] = useState<boolean>(true);
  const [pendingConfirm, setPendingConfirm] = useState<{
    title: string;
    description: string;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const isCorp = currentCompany?.eventMode === 'CORPORATE';

  const filteredStickers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stickers;
    return stickers.filter(
      s =>
        s.owner.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        (s.department || '').toLowerCase().includes(q)
    );
  }, [stickers, search]);

  const filteredTransactions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter(
      t =>
        t.owner.toLowerCase().includes(q) ||
        t.stickerId.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        t.detail.toLowerCase().includes(q) ||
        (t.provider || '').toLowerCase().includes(q)
    );
  }, [transactions, search]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      p =>
        p.name.toLowerCase().includes(q) ||
        p.provider.toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q)
    );
  }, [products, search]);

  const filteredProviders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return providers;
    return providers.filter(p => p.brandName.toLowerCase().includes(q));
  }, [providers, search]);

  if (!isOpen || !currentCompany) return null;

  const notify = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleTabChange = (tab: CleanupTab) => {
    setActiveTab(tab);
    setSearch('');
    setPendingConfirm(null);
  };

  // Current tab selection helpers
  const currentTabCounts = (() => {
    if (activeTab === 'STICKERS') {
      const selSet = new Set(selectedStickerIds);
      const unselected = stickers.filter(s => !selSet.has(s.id)).map(s => s.id);
      return { total: stickers.length, selected: selectedStickerIds.length, unselectedCount: unselected.length };
    }
    if (activeTab === 'TRANSACTIONS') {
      const selSet = new Set(selectedTxIds);
      const unselected = transactions.filter(t => !selSet.has(t.id)).map(t => t.id);
      return { total: transactions.length, selected: selectedTxIds.length, unselectedCount: unselected.length };
    }
    if (activeTab === 'PRODUCTS') {
      const selSet = new Set(selectedProductIds);
      const unselected = products.filter(p => !selSet.has(p.id)).map(p => p.id);
      return { total: products.length, selected: selectedProductIds.length, unselectedCount: unselected.length };
    }
    const selSet = new Set(selectedProviderIds);
    const unselected = providers.filter(p => !selSet.has(p.id)).map(p => p.id);
    return { total: providers.length, selected: selectedProviderIds.length, unselectedCount: unselected.length };
  })();

  const selectAllVisible = () => {
    setPendingConfirm(null);
    if (activeTab === 'STICKERS') setSelectedStickerIds(filteredStickers.map(s => s.id));
    else if (activeTab === 'TRANSACTIONS') setSelectedTxIds(filteredTransactions.map(t => t.id));
    else if (activeTab === 'PRODUCTS') setSelectedProductIds(filteredProducts.map(p => p.id));
    else setSelectedProviderIds(filteredProviders.map(p => p.id));
  };

  const selectNone = () => {
    setPendingConfirm(null);
    if (activeTab === 'STICKERS') setSelectedStickerIds([]);
    else if (activeTab === 'TRANSACTIONS') setSelectedTxIds([]);
    else if (activeTab === 'PRODUCTS') setSelectedProductIds([]);
    else setSelectedProviderIds([]);
  };

  const invertSelection = () => {
    setPendingConfirm(null);
    if (activeTab === 'STICKERS') {
      const set = new Set(selectedStickerIds);
      setSelectedStickerIds(stickers.filter(s => !set.has(s.id)).map(s => s.id));
    } else if (activeTab === 'TRANSACTIONS') {
      const set = new Set(selectedTxIds);
      setSelectedTxIds(transactions.filter(t => !set.has(t.id)).map(t => t.id));
    } else if (activeTab === 'PRODUCTS') {
      const set = new Set(selectedProductIds);
      setSelectedProductIds(products.filter(p => !set.has(p.id)).map(p => p.id));
    } else {
      const set = new Set(selectedProviderIds);
      setSelectedProviderIds(providers.filter(p => !set.has(p.id)).map(p => p.id));
    }
  };

  const requestDeleteSelected = () => {
    if (activeTab === 'STICKERS' && selectedStickerIds.length > 0) {
      const ids = [...selectedStickerIds];
      setPendingConfirm({
        title: `¿Borrar ${ids.length} cliente(s) seleccionados?`,
        description: alsoDeleteStickerTx
          ? 'Se eliminarán estos clientes NFC y también todos sus movimientos registrados en la nube.'
          : 'Se eliminarán estos clientes NFC. Sus movimientos históricos permanecerán en auditoría.',
        onConfirm: async () => {
          await deleteStickersBulk(ids, alsoDeleteStickerTx);
          setSelectedStickerIds([]);
          setPendingConfirm(null);
          notify(`Se eliminaron ${ids.length} cliente(s).`);
        },
      });
    } else if (activeTab === 'TRANSACTIONS' && selectedTxIds.length > 0) {
      const ids = [...selectedTxIds];
      setPendingConfirm({
        title: `¿Borrar ${ids.length} movimiento(s) seleccionados?`,
        description: 'Se eliminarán permanentemente del historial y de Firestore.',
        onConfirm: async () => {
          await deleteTransactionsBulk(ids);
          setSelectedTxIds([]);
          setPendingConfirm(null);
          notify(`Se eliminaron ${ids.length} movimiento(s).`);
        },
      });
    } else if (activeTab === 'PRODUCTS' && selectedProductIds.length > 0) {
      const ids = [...selectedProductIds];
      setPendingConfirm({
        title: `¿Borrar ${ids.length} producto(s) seleccionados?`,
        description: 'Desaparecerán del catálogo de Caja y Proveedores.',
        onConfirm: async () => {
          await deleteProductsBulk(ids);
          setSelectedProductIds([]);
          setPendingConfirm(null);
          notify(`Se eliminaron ${ids.length} producto(s).`);
        },
      });
    } else if (activeTab === 'PROVIDERS' && selectedProviderIds.length > 0) {
      const ids = [...selectedProviderIds];
      setPendingConfirm({
        title: `¿Borrar ${ids.length} proveedor(es) seleccionados?`,
        description: 'También se eliminarán los productos asociados a esos stands.',
        onConfirm: async () => {
          await deleteProvidersBulk(ids);
          setSelectedProviderIds([]);
          setPendingConfirm(null);
          notify(`Se eliminaron ${ids.length} proveedor(es).`);
        },
      });
    }
  };

  const requestKeepOnlySelected = () => {
    if (activeTab === 'STICKERS') {
      const selSet = new Set(selectedStickerIds);
      const toDelete = stickers.filter(s => !selSet.has(s.id)).map(s => s.id);
      if (selectedStickerIds.length === 0 || toDelete.length === 0) return;
      setPendingConfirm({
        title: `¿Dejar solo ${selectedStickerIds.length} cliente(s) y borrar ${toDelete.length}?`,
        description: alsoDeleteStickerTx
          ? 'Se conservarán únicamente los clientes marcados. Los demás y sus movimientos serán eliminados.'
          : 'Se conservarán únicamente los clientes marcados y se borrarán los no marcados.',
        onConfirm: async () => {
          await deleteStickersBulk(toDelete, alsoDeleteStickerTx);
          setPendingConfirm(null);
          notify(`Se conservaron ${selectedStickerIds.length} cliente(s) y se borraron ${toDelete.length}.`);
        },
      });
    } else if (activeTab === 'TRANSACTIONS') {
      const selSet = new Set(selectedTxIds);
      const toDelete = transactions.filter(t => !selSet.has(t.id)).map(t => t.id);
      if (selectedTxIds.length === 0 || toDelete.length === 0) return;
      setPendingConfirm({
        title: `¿Dejar solo ${selectedTxIds.length} movimiento(s) y borrar ${toDelete.length}?`,
        description: 'Los movimientos no marcados serán eliminados permanentemente.',
        onConfirm: async () => {
          await deleteTransactionsBulk(toDelete);
          setPendingConfirm(null);
          notify(`Se conservaron ${selectedTxIds.length} movimiento(s) y se borraron ${toDelete.length}.`);
        },
      });
    } else if (activeTab === 'PRODUCTS') {
      const selSet = new Set(selectedProductIds);
      const toDelete = products.filter(p => !selSet.has(p.id)).map(p => p.id);
      if (selectedProductIds.length === 0 || toDelete.length === 0) return;
      setPendingConfirm({
        title: `¿Dejar solo ${selectedProductIds.length} producto(s) y borrar ${toDelete.length}?`,
        description: 'Solo quedarán los productos marcados en tu catálogo.',
        onConfirm: async () => {
          await deleteProductsBulk(toDelete);
          setPendingConfirm(null);
          notify(`Se conservaron ${selectedProductIds.length} producto(s) y se borraron ${toDelete.length}.`);
        },
      });
    } else if (activeTab === 'PROVIDERS') {
      const selSet = new Set(selectedProviderIds);
      const toDelete = providers.filter(p => !selSet.has(p.id)).map(p => p.id);
      if (selectedProviderIds.length === 0 || toDelete.length === 0) return;
      setPendingConfirm({
        title: `¿Dejar solo ${selectedProviderIds.length} proveedor(es) y borrar ${toDelete.length}?`,
        description: 'Se eliminarán los proveedores no marcados junto con sus productos.',
        onConfirm: async () => {
          await deleteProvidersBulk(toDelete);
          setPendingConfirm(null);
          notify(`Se conservaron ${selectedProviderIds.length} proveedor(es) y se borraron ${toDelete.length}.`);
        },
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-3xl max-h-[92vh] rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <Eraser className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight truncate">
                Limpieza de Pruebas — {currentCompany.name}
              </h3>
              <p className="text-xs text-slate-500">
                Borra todas las pruebas de golpe o elige exactamente qué dejar y qué borrar.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white hover:bg-slate-200 border border-slate-200 flex items-center justify-center text-slate-600 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {feedback && (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{feedback}</span>
            </div>
          )}

          {/* Quick Total Wipe Section */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-50 to-amber-50/60 border border-rose-200/80 space-y-2.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-rose-600 shrink-0" />
              <h4 className="text-xs font-black uppercase tracking-wider text-rose-900">
                Borrado Total Rápido (1 clic + confirmación)
              </h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                disabled={stickers.length === 0 && transactions.length === 0}
                onClick={() =>
                  setPendingConfirm({
                    title: '¿Borrar TODOS los clientes y movimientos de prueba?',
                    description: `Se eliminarán ${stickers.length} clientes/pulseras y ${transactions.length} movimientos. Tus proveedores y catálogo de productos permanecerán intactos para el evento real.`,
                    onConfirm: async () => {
                      await wipeCurrentCompanyTestData({ stickers: true, transactions: true });
                      setSelectedStickerIds([]);
                      setSelectedTxIds([]);
                      setPendingConfirm(null);
                      notify('Clientes y movimientos de prueba eliminados. Stands y catálogo conservados.');
                    },
                  })
                }
                className="p-2.5 rounded-xl bg-white hover:bg-rose-600 hover:text-white border border-rose-200 text-rose-800 font-bold text-xs text-left transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="block font-black">Limpiar Evento (Clientes + Historial)</span>
                <span className="text-[10px] opacity-80 block mt-0.5">
                  Mantiene stands y productos
                </span>
              </button>

              <button
                type="button"
                disabled={transactions.length === 0}
                onClick={() =>
                  setPendingConfirm({
                    title: `¿Borrar SOLO los ${transactions.length} movimientos?`,
                    description: 'Se vaciará el historial de recargas/consumos. Los clientes y el catálogo se mantienen.',
                    onConfirm: async () => {
                      await wipeCurrentCompanyTestData({ stickers: false, transactions: true });
                      setSelectedTxIds([]);
                      setPendingConfirm(null);
                      notify('Historial de movimientos vaciado.');
                    },
                  })
                }
                className="p-2.5 rounded-xl bg-white hover:bg-amber-600 hover:text-white border border-amber-200 text-amber-900 font-bold text-xs text-left transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="block font-black">Borrar Solo Movimientos ({transactions.length})</span>
                <span className="text-[10px] opacity-80 block mt-0.5">
                  Mantiene clientes y catálogo
                </span>
              </button>

              <button
                type="button"
                disabled={
                  stickers.length === 0 &&
                  transactions.length === 0 &&
                  products.length === 0 &&
                  providers.length === 0
                }
                onClick={() =>
                  setPendingConfirm({
                    title: '¿VACIAR COMPLETAMENTE esta empresa?',
                    description: `Se eliminarán ${stickers.length} clientes, ${transactions.length} movimientos, ${products.length} productos y ${providers.length} proveedores.`,
                    onConfirm: async () => {
                      await wipeCurrentCompanyTestData({
                        stickers: true,
                        transactions: true,
                        products: true,
                        providers: true,
                      });
                      setSelectedStickerIds([]);
                      setSelectedTxIds([]);
                      setSelectedProductIds([]);
                      setSelectedProviderIds([]);
                      setPendingConfirm(null);
                      notify('Empresa vaciada por completo en tiempo real.');
                    },
                  })
                }
                className="p-2.5 rounded-xl bg-slate-900 hover:bg-rose-700 text-rose-300 hover:text-white font-bold text-xs text-left transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="block font-black">Borrar TODO en Total</span>
                <span className="text-[10px] opacity-80 block mt-0.5">
                  Clientes, historial, productos y stands
                </span>
              </button>
            </div>
          </div>

          {/* Inline Confirmation Banner */}
          {pendingConfirm && (
            <div className="p-4 rounded-2xl bg-rose-600 text-white shadow-lg space-y-2.5 animate-in fade-in duration-150">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-300" />
                <div>
                  <h5 className="font-black text-sm">{pendingConfirm.title}</h5>
                  <p className="text-xs text-rose-100 mt-0.5">{pendingConfirm.description}</p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPendingConfirm(null)}
                  className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void pendingConfirm.onConfirm()}
                  className="px-4 py-2 rounded-xl bg-white text-rose-700 hover:bg-rose-50 font-black text-xs cursor-pointer shadow"
                >
                  Sí, Borrar Ahora
                </button>
              </div>
            </div>
          )}

          {/* Selective Tab Navigation */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => handleTabChange('STICKERS')}
              className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shrink-0 cursor-pointer transition ${
                activeTab === 'STICKERS'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Clientes ({stickers.length})</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('TRANSACTIONS')}
              className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shrink-0 cursor-pointer transition ${
                activeTab === 'TRANSACTIONS'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Movimientos ({transactions.length})</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('PRODUCTS')}
              className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shrink-0 cursor-pointer transition ${
                activeTab === 'PRODUCTS'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Productos ({products.length})</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('PROVIDERS')}
              className={`px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shrink-0 cursor-pointer transition ${
                activeTab === 'PROVIDERS'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>Proveedores ({providers.length})</span>
            </button>
          </div>

          {/* Selective Toolbar */}
          <div className="space-y-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar para seleccionar o excluir..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 ring-slate-400"
                />
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={selectAllVisible}
                  className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-[11px] font-bold text-slate-700 cursor-pointer"
                >
                  Marcar Todos
                </button>
                <button
                  type="button"
                  onClick={invertSelection}
                  className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-[11px] font-bold text-slate-700 cursor-pointer"
                >
                  Invertir
                </button>
                <button
                  type="button"
                  onClick={selectNone}
                  className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-[11px] font-bold text-slate-700 cursor-pointer"
                >
                  Ninguno
                </button>
              </div>
            </div>

            {activeTab === 'STICKERS' && (
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={alsoDeleteStickerTx}
                  onChange={e => setAlsoDeleteStickerTx(e.target.checked)}
                  className="w-4 h-4 rounded text-rose-600"
                />
                <span>También borrar los movimientos de los clientes eliminados</span>
              </label>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                disabled={currentTabCounts.selected === 0}
                onClick={requestDeleteSelected}
                className="flex-1 min-w-[160px] py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Borrar Seleccionados ({currentTabCounts.selected})</span>
              </button>
              <button
                type="button"
                disabled={currentTabCounts.selected === 0 || currentTabCounts.unselectedCount === 0}
                onClick={requestKeepOnlySelected}
                className="flex-1 min-w-[180px] py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed transition"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>
                  Dejar Solo Marcados (Borrar {currentTabCounts.unselectedCount})
                </span>
              </button>
            </div>
          </div>

          {/* Checklist Content */}
          <div className="space-y-2 max-h-[290px] overflow-y-auto pr-1">
            {activeTab === 'STICKERS' &&
              (filteredStickers.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-8">No hay clientes para mostrar.</p>
              ) : (
                filteredStickers.map(st => {
                  const checked = selectedStickerIds.includes(st.id);
                  return (
                    <div
                      key={st.id}
                      onClick={() => {
                        setPendingConfirm(null);
                        setSelectedStickerIds(prev =>
                          prev.includes(st.id) ? prev.filter(x => x !== st.id) : [...prev, st.id]
                        );
                      }}
                      className={`p-3 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition ${
                        checked
                          ? 'bg-rose-50 border-rose-300'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {checked ? (
                          <CheckSquare className="w-4 h-4 text-rose-600 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-black text-xs sm:text-sm text-slate-900 truncate">
                            {st.owner}
                          </p>
                          <p className="text-[11px] font-mono text-slate-400">
                            {st.id}
                            {st.department ? ` • ${st.department}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {isCorp ? (
                          <span className="text-xs font-bold text-indigo-700">
                            {Object.values(st.quotas || {}).reduce(
                              (sum, q) => sum + Math.max(0, q.allowed - q.used),
                              0
                            )}{' '}
                            cupos
                          </span>
                        ) : (
                          <>
                            <span className="font-black text-xs font-mono text-slate-900 block">
                              {formatUSD(st.balance)}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {formatBs(st.balance * settings.bcvRate)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              ))}

            {activeTab === 'TRANSACTIONS' &&
              (filteredTransactions.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-8">No hay movimientos para mostrar.</p>
              ) : (
                filteredTransactions.map(tx => {
                  const checked = selectedTxIds.includes(tx.id);
                  return (
                    <div
                      key={tx.id}
                      onClick={() => {
                        setPendingConfirm(null);
                        setSelectedTxIds(prev =>
                          prev.includes(tx.id) ? prev.filter(x => x !== tx.id) : [...prev, tx.id]
                        );
                      }}
                      className={`p-3 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition ${
                        checked
                          ? 'bg-rose-50 border-rose-300'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {checked ? (
                          <CheckSquare className="w-4 h-4 text-rose-600 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-slate-100 text-slate-700">
                              {tx.type}
                            </span>
                            <span className="font-bold text-xs text-slate-900 truncate">
                              {tx.owner}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {tx.stickerId}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate">{tx.detail}</p>
                          <p className="text-[10px] font-mono text-slate-400">
                            {formatDateTime(tx.timestamp)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 font-mono">
                        <span className="font-black text-xs text-slate-900 block">
                          {formatUSD(tx.usd)}
                        </span>
                        <span className="text-[10px] text-slate-400">{formatBs(tx.bs)}</span>
                      </div>
                    </div>
                  );
                })
              ))}

            {activeTab === 'PRODUCTS' &&
              (filteredProducts.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-8">No hay productos para mostrar.</p>
              ) : (
                filteredProducts.map(prod => {
                  const checked = selectedProductIds.includes(prod.id);
                  return (
                    <div
                      key={prod.id}
                      onClick={() => {
                        setPendingConfirm(null);
                        setSelectedProductIds(prev =>
                          prev.includes(prod.id) ? prev.filter(x => x !== prod.id) : [...prev, prod.id]
                        );
                      }}
                      className={`p-3 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition ${
                        checked
                          ? 'bg-rose-50 border-rose-300'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {checked ? (
                          <CheckSquare className="w-4 h-4 text-rose-600 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <span className="text-xl shrink-0">{prod.emoji}</span>
                        <div className="min-w-0">
                          <p className="font-black text-xs sm:text-sm text-slate-900 truncate">
                            {prod.name}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate">
                            {prod.provider} • {prod.category || 'General'}
                          </p>
                        </div>
                      </div>
                      <span className="font-black text-xs font-mono text-slate-900 shrink-0">
                        {formatUSD(prod.price)}
                      </span>
                    </div>
                  );
                })
              ))}

            {activeTab === 'PROVIDERS' &&
              (filteredProviders.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-8">No hay proveedores para mostrar.</p>
              ) : (
                filteredProviders.map(prov => {
                  const checked = selectedProviderIds.includes(prov.id);
                  return (
                    <div
                      key={prov.id}
                      onClick={() => {
                        setPendingConfirm(null);
                        setSelectedProviderIds(prev =>
                          prev.includes(prov.id) ? prev.filter(x => x !== prov.id) : [...prev, prov.id]
                        );
                      }}
                      className={`p-3 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition ${
                        checked
                          ? 'bg-rose-50 border-rose-300'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {checked ? (
                          <CheckSquare className="w-4 h-4 text-rose-600 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <span className="text-xl shrink-0">{prov.emoji || '🏪'}</span>
                        <div className="min-w-0">
                          <p className="font-black text-xs sm:text-sm text-slate-900 truncate">
                            {prov.brandName}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {products.filter(p => p.provider === prov.brandName).length} producto(s)
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">{prov.id}</span>
                    </div>
                  );
                })
              ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Los cambios se sincronizan en tiempo real en todos tus dispositivos.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};
