import React, { useState } from 'react';
import { 
  X, 
  CreditCard, 
  Plus, 
  Trash2, 
  Radio, 
  Smartphone,
  CheckSquare,
  Square,
  AlertTriangle,
  Eraser,
  Check
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatUSD, formatBs } from '../utils/formatters';

const GRADIENT_PRESETS = [
  { id: 'blue', label: 'Azul', class: 'from-blue-600 to-indigo-700' },
  { id: 'emerald', label: 'Verde', class: 'from-emerald-600 to-teal-700' },
  { id: 'purple', label: 'Morado', class: 'from-purple-600 to-pink-600' },
  { id: 'amber', label: 'Oro', class: 'from-amber-600 to-orange-700' },
  { id: 'dark', label: 'Dark', class: 'from-slate-700 to-slate-900' },
  { id: 'rose', label: 'Rosa', class: 'from-rose-600 to-red-800' },
];

export const StickersDrawer: React.FC = () => {
  const { 
    isStickersDrawerOpen, 
    toggleStickersDrawer, 
    stickers, 
    addSticker, 
    deleteSticker,
    deleteStickersBulk,
    wipeCurrentCompanyTestData,
    settings, 
    currentCompany,
    setActiveTab 
  } = useApp();

  const [newOwner, setNewOwner] = useState<string>('');
  const [newDepartment, setNewDepartment] = useState<string>('');
  const [initialBalance, setInitialBalance] = useState<string>('0');
  const [selectedColor, setSelectedColor] = useState<string>(GRADIENT_PRESETS[0].class);

  // Test cleanup mode state
  const [isCleanupMode, setIsCleanupMode] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [alsoDeleteTx, setAlsoDeleteTx] = useState<boolean>(true);
  const [confirmAction, setConfirmAction] = useState<'DELETE_SELECTED' | 'KEEP_ONLY_SELECTED' | 'DELETE_ALL' | null>(null);
  const [singleDeleteConfirmId, setSingleDeleteConfirmId] = useState<string | null>(null);
  const [cleanupFeedback, setCleanupFeedback] = useState<string | null>(null);

  if (!isStickersDrawerOpen) return null;

  const isCorporate = currentCompany?.eventMode === 'CORPORATE';

  const selectedSet = new Set(selectedIds);
  const unselectedIds = stickers.filter(s => !selectedSet.has(s.id)).map(s => s.id);

  const toggleSelect = (id: string) => {
    setConfirmAction(null);
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const selectAll = () => {
    setConfirmAction(null);
    setSelectedIds(stickers.map(s => s.id));
  };

  const selectNone = () => {
    setConfirmAction(null);
    setSelectedIds([]);
  };

  const invertSelection = () => {
    setConfirmAction(null);
    setSelectedIds(stickers.filter(s => !selectedSet.has(s.id)).map(s => s.id));
  };

  const showFeedback = (msg: string) => {
    setCleanupFeedback(msg);
    setTimeout(() => setCleanupFeedback(null), 3000);
  };

  const executeCleanup = async (action: 'DELETE_SELECTED' | 'KEEP_ONLY_SELECTED' | 'DELETE_ALL') => {
    if (action === 'DELETE_SELECTED' && selectedIds.length > 0) {
      const count = selectedIds.length;
      await deleteStickersBulk(selectedIds, alsoDeleteTx);
      setSelectedIds([]);
      setConfirmAction(null);
      showFeedback(`Se eliminaron ${count} cliente(s) de prueba.`);
    } else if (action === 'KEEP_ONLY_SELECTED' && unselectedIds.length > 0) {
      const count = unselectedIds.length;
      await deleteStickersBulk(unselectedIds, alsoDeleteTx);
      setConfirmAction(null);
      showFeedback(`Se conservaron ${selectedIds.length} y se borraron ${count} cliente(s).`);
    } else if (action === 'DELETE_ALL' && stickers.length > 0) {
      const count = stickers.length;
      await wipeCurrentCompanyTestData({ stickers: true, transactions: alsoDeleteTx });
      setSelectedIds([]);
      setConfirmAction(null);
      setIsCleanupMode(false);
      showFeedback(`Se limpiaron todos los ${count} clientes de prueba.`);
    }
  };

  const handleCreateSticker = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOwner.trim()) return;
    const balance = isCorporate ? 0 : parseFloat(initialBalance) || 0;
    addSticker(newOwner.trim(), balance, selectedColor, newDepartment.trim() || undefined);
    setNewOwner('');
    setNewDepartment('');
    setInitialBalance('0');
  };

  const handleQuickRechargeFromDrawer = () => {
    toggleStickersDrawer();
    setActiveTab('caja');
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex justify-end animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-md h-full p-5 sm:p-6 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200 pb-safe">
        
        {/* Top Header */}
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-600" />
                <span>{isCorporate ? 'Pulseras Corporativas' : 'Billeteras / Stickers NFC'}</span>
              </h3>
              <p className="text-xs text-slate-500">
                {isCorporate
                  ? 'Colaboradores acreditados y cupos disponibles'
                  : 'Clientes con tarjetas y pulseras NTAG215'}
              </p>
            </div>
            <button
              onClick={toggleStickersDrawer}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-600 cursor-pointer transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Cleanup Mode Toggle & Feedback */}
          <div className="mb-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Etiquetas Activas ({stickers.length}) • {formatBs(settings.bcvRate)}
              </div>
              {stickers.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setIsCleanupMode(prev => !prev);
                    setConfirmAction(null);
                    setSingleDeleteConfirmId(null);
                  }}
                  className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-1.5 transition cursor-pointer ${
                    isCleanupMode
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                  }`}
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span>{isCleanupMode ? 'Cerrar Limpieza' : 'Limpiar Pruebas'}</span>
                </button>
              )}
            </div>

            {cleanupFeedback && (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{cleanupFeedback}</span>
              </div>
            )}

            {isCleanupMode && stickers.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-rose-50/90 border border-rose-200 space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-rose-900">
                    Selección ({selectedIds.length} de {stickers.length})
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={selectAll}
                      className="px-2 py-1 rounded-lg bg-white border border-rose-200 text-[10px] font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      Todos
                    </button>
                    <button
                      type="button"
                      onClick={invertSelection}
                      className="px-2 py-1 rounded-lg bg-white border border-rose-200 text-[10px] font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      Invertir
                    </button>
                    <button
                      type="button"
                      onClick={selectNone}
                      className="px-2 py-1 rounded-lg bg-white border border-rose-200 text-[10px] font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      Ninguno
                    </button>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-[11px] font-semibold text-rose-950 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={alsoDeleteTx}
                    onChange={e => setAlsoDeleteTx(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-rose-600"
                  />
                  <span>También borrar los movimientos/recargas de esos clientes</span>
                </label>

                {confirmAction ? (
                  <div className="p-2.5 rounded-xl bg-white border border-rose-300 space-y-2">
                    <p className="text-[11px] font-bold text-rose-800 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                      <span>
                        {confirmAction === 'DELETE_ALL'
                          ? `¿Borrar TODOS los ${stickers.length} clientes${alsoDeleteTx ? ' y sus movimientos' : ''}?`
                          : confirmAction === 'KEEP_ONLY_SELECTED'
                          ? `¿Conservar los ${selectedIds.length} marcados y borrar los otros ${unselectedIds.length}?`
                          : `¿Borrar los ${selectedIds.length} cliente(s) seleccionados?`}
                      </span>
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void executeCleanup(confirmAction)}
                        className="flex-1 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-black text-[11px] cursor-pointer"
                      >
                        Sí, Confirmar
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmAction(null)}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        disabled={selectedIds.length === 0}
                        onClick={() => setConfirmAction('DELETE_SELECTED')}
                        className="py-2 px-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black text-[11px] transition cursor-pointer disabled:cursor-not-allowed"
                      >
                        Borrar Marcados ({selectedIds.length})
                      </button>
                      <button
                        type="button"
                        disabled={selectedIds.length === 0 || unselectedIds.length === 0}
                        onClick={() => setConfirmAction('KEEP_ONLY_SELECTED')}
                        className="py-2 px-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black text-[11px] transition cursor-pointer disabled:cursor-not-allowed"
                      >
                        Dejar Marcados ({selectedIds.length})
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfirmAction('DELETE_ALL')}
                      className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-rose-300 font-black text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Borrar TODOS los Clientes ({stickers.length})</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Stickers List */}
          <div className="space-y-3 mb-6">
            {stickers.length === 0 ? (
              <div className="p-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center space-y-1">
                <p className="text-xs font-black text-slate-700">Sin clientes o pulseras registradas</p>
                <p className="text-[11px] text-slate-500">
                  La lista está limpia. Crea una nueva tarjeta abajo o registra al cliente al recargar en Caja.
                </p>
              </div>
            ) : (
              stickers.map(st => {
                const quotasList = st.quotas ? Object.values(st.quotas) : [];
                const totalRemaining = quotasList.reduce(
                  (sum, q) => sum + Math.max(0, q.allowed - q.used),
                  0
                );
                const isSelected = selectedSet.has(st.id);

                return (
                  <div
                    key={st.id}
                    onClick={isCleanupMode ? () => toggleSelect(st.id) : undefined}
                    className={`p-4 rounded-2xl bg-gradient-to-r ${st.color} text-white shadow-md relative overflow-hidden group transition ${
                      isCleanupMode ? 'cursor-pointer' : ''
                    } ${
                      isCleanupMode && isSelected ? 'ring-4 ring-rose-500 ring-offset-2' : ''
                    }`}
                  >
                    {/* Chip graphic decoration */}
                    <div className="absolute right-3 top-3 opacity-20 pointer-events-none">
                      <Radio className="w-16 h-16 text-white" />
                    </div>

                    <div className="flex items-start justify-between relative z-10 gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        {isCleanupMode && (
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              toggleSelect(st.id);
                            }}
                            className="mt-0.5 text-white shrink-0 cursor-pointer"
                            aria-label={`Seleccionar ${st.owner}`}
                          >
                            {isSelected ? (
                              <CheckSquare className="w-5 h-5 text-white drop-shadow" />
                            ) : (
                              <Square className="w-5 h-5 text-white/75" />
                            )}
                          </button>
                        )}
                        <div className="min-w-0">
                          <span className="text-[10px] font-mono uppercase tracking-widest text-white/80 block">
                            {st.id} • {st.tagType}
                          </span>
                          <h4 className="font-black text-base text-white tracking-tight mt-0.5 truncate">
                            {st.owner}
                          </h4>
                          {isCorporate && st.department && (
                            <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white">
                              {st.department}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        {isCorporate ? (
                          <>
                            <span className="text-[10px] uppercase text-white/80 block font-bold">
                              Cupos Restantes
                            </span>
                            <span className="text-2xl font-black font-mono text-white block">
                              {totalRemaining}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-[10px] uppercase text-white/80 block font-bold">
                              Saldo
                            </span>
                            <span className="text-2xl font-black font-mono text-white block">
                              {formatUSD(st.balance)}
                            </span>
                            <span className="text-[11px] text-white/80 font-mono block">
                              ≈ {formatBs(st.balance * settings.bcvRate)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {isCorporate && quotasList.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5 relative z-10">
                        {quotasList.map(q => {
                          const rem = Math.max(0, q.allowed - q.used);
                          return (
                            <span
                              key={q.ruleId}
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 ${
                                rem === 0
                                  ? 'bg-black/30 text-white/60 line-through'
                                  : 'bg-white/20 text-white'
                              }`}
                            >
                              <span>{q.emoji}</span>
                              <span>
                                {q.label}: {rem}/{q.allowed}
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Bottom row actions */}
                    {!isCleanupMode && (
                      <div className="mt-3 pt-2.5 border-t border-white/20 flex items-center justify-between text-xs relative z-10">
                        <button
                          onClick={handleQuickRechargeFromDrawer}
                          className="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white font-bold flex items-center gap-1 transition cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>{isCorporate ? 'Editar Cupos en Caja' : 'Recargar en Caja'}</span>
                        </button>

                        {singleDeleteConfirmId === st.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                deleteSticker(st.id);
                                setSingleDeleteConfirmId(null);
                              }}
                              className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] cursor-pointer"
                            >
                              Confirmar
                            </button>
                            <button
                              type="button"
                              onClick={() => setSingleDeleteConfirmId(null)}
                              className="px-2 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white font-bold text-[10px] cursor-pointer"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setSingleDeleteConfirmId(st.id)}
                            className="text-white/70 hover:text-white p-1 rounded transition cursor-pointer"
                            title="Eliminar cliente"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Register New Sticker Form */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/90 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-emerald-600" />
              <span>{isCorporate ? 'Registrar Nuevo Empleado / Pulsera' : 'Registrar Nuevo Cliente / Sticker'}</span>
            </h4>

            <form onSubmit={handleCreateSticker} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  {isCorporate ? 'Nombre del Empleado' : 'Nombre del Cliente'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={isCorporate ? 'Ej. Carlos Mendoza' : 'Ej. Valentina Mendoza'}
                  value={newOwner}
                  onChange={e => setNewOwner(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:ring-2 ring-app-primary bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                {isCorporate ? (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Área / Departamento
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Operaciones"
                      value={newDepartment}
                      onChange={e => setNewDepartment(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:ring-2 ring-app-primary bg-white"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Saldo Inicial ($)
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={initialBalance}
                      onChange={e => setInitialBalance(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold focus:outline-none focus:ring-2 ring-app-primary bg-white font-mono"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    Diseño de Tarjeta
                  </label>
                  <div className="flex items-center gap-1.5 py-1">
                    {GRADIENT_PRESETS.map(g => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setSelectedColor(g.class)}
                        className={`w-6 h-6 rounded-full bg-gradient-to-r ${g.class} cursor-pointer transition ${
                          selectedColor === g.class ? 'ring-2 ring-slate-900 scale-110' : 'opacity-70 hover:opacity-100'
                        }`}
                        title={g.label}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isCorporate ? 'Crear Pulsera con Cupos Base' : 'Crear Tarjeta NFC'}</span>
              </button>
            </form>
          </div>
        </div>

        {/* Footer Note */}
        <div className="pt-4 border-t border-slate-200 text-xs text-slate-500 space-y-1 mt-4">
          <div className="flex items-start gap-1.5">
            <Smartphone className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              En dispositivos móviles Android con Google Chrome, esta aplicación activa directamente la antena de hardware mediante la API estándar <code className="text-slate-700 bg-slate-100 px-1 py-0.5 rounded font-mono">NDEFReader</code>.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

