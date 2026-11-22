import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Delete,
  RotateCcw,
  Radio,
  Receipt,
  Banknote,
  Smartphone,
  CreditCard,
  QrCode,
  ArrowRight,
  Lock,
  Eye,
  EyeOff,
  Search,
  Store,
  Calculator,
  Plus,
  Minus,
  Briefcase,
  UserCheck,
  CheckCircle2,
  Tags,
} from 'lucide-react';
import { useApp, buildQuotasFromAllowances } from '../context/AppContext';
import { formatUSD, formatBs } from '../utils/formatters';
import { soundSynth } from '../utils/audio';
import { PaymentMethod, StickerQuotaProgress } from '../types';

export const CajaModule: React.FC = () => {
  const {
    currentCompany,
    isCajaUnlocked,
    unlockCajaWithPin,
    lockCaja,
    settings,
    products,
    providers,
    transactions,
    openNfcModal,
    setReceiptModalTx,
  } = useApp();

  // Caja PIN Lock state
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [showPinDigits, setShowPinDigits] = useState<boolean>(false);

  // Cashless keypad state (cents: 1000 = $10.00)
  const [cajaCents, setCajaCents] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Efectivo USD');

  // Mobile segmented tabs & Desktop right-column tabs
  const [mobileSection, setMobileSection] = useState<'operacion' | 'precios' | 'historial'>('operacion');
  const [desktopRightTab, setDesktopRightTab] = useState<'precios' | 'historial'>('precios');

  // Product price reference & quick estimator state
  const [priceSearch, setPriceSearch] = useState<string>('');
  const [selectedPriceProvider, setSelectedPriceProvider] = useState<string>('ALL');
  const [estimatorQty, setEstimatorQty] = useState<Record<number, number>>({});

  // Corporate accreditation form state
  const [empName, setEmpName] = useState<string>('');
  const [empDept, setEmpDept] = useState<string>('');
  const [customAllowedMap, setCustomAllowedMap] = useState<Record<string, number>>({});

  const isCorp = currentCompany?.eventMode === 'CORPORATE';

  // Sync default corporate allowance quantities when company or rules change
  useEffect(() => {
    if (!currentCompany) return;
    const nextMap: Record<string, number> = {};
    currentCompany.employeeAllowances.forEach(r => {
      nextMap[r.id] = r.maxQty;
    });
    setCustomAllowedMap(nextMap);
  }, [currentCompany?.id, currentCompany?.employeeAllowances]);

  useEffect(() => {
    if (!isCajaUnlocked) {
      setEnteredPin('');
      setPinError('');
    }
  }, [isCajaUnlocked]);

  const handlePinDigit = useCallback(
    (digit: string) => {
      if (!currentCompany) return;
      soundSynth.playClick(settings.enableSound);
      setEnteredPin(prev => {
        if (prev.length >= 8) return prev;
        const nextPin = prev + digit;
        setPinError('');
        const targetLength = (currentCompany.cajaPin || '1111').length || 4;
        if (nextPin.length === targetLength) {
          setTimeout(() => {
            const ok = unlockCajaWithPin(nextPin);
            if (!ok) {
              setPinError('PIN de Caja incorrecto. Inténtalo de nuevo.');
              setEnteredPin('');
            }
          }, 100);
        }
        return nextPin;
      });
    },
    [currentCompany, settings.enableSound, unlockCajaWithPin]
  );

  const handlePinBackspace = useCallback(() => {
    soundSynth.playClick(settings.enableSound);
    setEnteredPin(prev => prev.slice(0, -1));
    setPinError('');
  }, [settings.enableSound]);

  useEffect(() => {
    if (isCajaUnlocked) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handlePinDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handlePinBackspace();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCajaUnlocked, handlePinDigit, handlePinBackspace]);

  // Filtered products for the Caja Price Reference catalog
  const filteredCatalogProducts = useMemo(() => {
    return products.filter(p => {
      const matchesProvider = selectedPriceProvider === 'ALL' || p.provider === selectedPriceProvider;
      const matchesSearch =
        priceSearch.trim() === '' ||
        p.name.toLowerCase().includes(priceSearch.toLowerCase()) ||
        p.provider.toLowerCase().includes(priceSearch.toLowerCase()) ||
        (p.category || '').toLowerCase().includes(priceSearch.toLowerCase());
      return matchesProvider && matchesSearch;
    });
  }, [products, selectedPriceProvider, priceSearch]);

  // Quick estimator totals
  const estimatorSummary = useMemo(() => {
    let totalUSD = 0;
    let totalCount = 0;
    products.forEach(p => {
      const qty = estimatorQty[p.id] || 0;
      if (qty > 0) {
        totalUSD += p.price * qty;
        totalCount += qty;
      }
    });
    totalUSD = Number(totalUSD.toFixed(2));
    return {
      totalUSD,
      totalBs: Number((totalUSD * settings.bcvRate).toFixed(2)),
      totalCount,
    };
  }, [products, estimatorQty, settings.bcvRate]);

  if (!isCajaUnlocked && currentCompany) {
    const targetLength = (currentCompany.cajaPin || '1111').length || 4;
    return (
      <section className="flex items-center justify-center py-4 sm:py-10">
        <div className="bg-white rounded-3xl max-w-sm w-full p-6 sm:p-8 shadow-xl border border-slate-200/90 text-center">
          <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 mx-auto mb-3 flex items-center justify-center border border-blue-200 shadow-inner">
            <Lock className="w-8 h-8" />
          </div>

          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            {isCorp ? 'Terminal de Acreditación Protegida' : 'Terminal de Caja Protegida'}
          </h2>
          <p className="text-xs text-slate-500 mt-1 mb-5">
            Ingresa el PIN numérico secreto de Caja para <strong className="text-slate-800">{currentCompany.name}</strong>.
          </p>

          <div className="flex items-center justify-center gap-2.5 mb-4">
            {Array.from({ length: targetLength }).map((_, idx) => {
              const hasDigit = idx < enteredPin.length;
              const digitChar = enteredPin[idx];
              return (
                <div
                  key={idx}
                  className={`w-11 h-13 rounded-2xl border-2 flex items-center justify-center font-black text-xl transition-all ${
                    hasDigit
                      ? 'border-blue-600 bg-blue-50 text-blue-800 scale-105 shadow-xs'
                      : 'border-slate-200 bg-slate-50 text-slate-300'
                  }`}
                >
                  {hasDigit ? (showPinDigits ? digitChar : '●') : ''}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 mb-4 px-2">
            <button
              type="button"
              onClick={() => setShowPinDigits(prev => !prev)}
              className="flex items-center gap-1 hover:text-slate-800 font-semibold cursor-pointer"
            >
              {showPinDigits ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showPinDigits ? 'Ocultar' : 'Mostrar'}</span>
            </button>
            <span className="text-[11px] font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              🔒 PIN Secreto
            </span>
          </div>

          {pinError && (
            <p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 p-2 rounded-xl mb-4">
              {pinError}
            </p>
          )}

          <div className="grid grid-cols-3 gap-2 mb-4">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
              <button
                key={d}
                onClick={() => handlePinDigit(d)}
                className="h-13 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 font-black text-xl text-slate-800 shadow-xs active:scale-95 transition cursor-pointer select-none"
              >
                {d}
              </button>
            ))}
            <button
              onClick={() => setEnteredPin('')}
              className="h-13 rounded-2xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-600 shadow-xs active:scale-95 transition cursor-pointer select-none"
            >
              Limpiar
            </button>
            <button
              onClick={() => handlePinDigit('0')}
              className="h-13 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 font-black text-xl text-slate-800 shadow-xs active:scale-95 transition cursor-pointer select-none"
            >
              0
            </button>
            <button
              onClick={handlePinBackspace}
              className="h-13 rounded-2xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center shadow-xs active:scale-95 transition cursor-pointer"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>

          <button
            onClick={() => {
              if (!enteredPin) return;
              const ok = unlockCajaWithPin(enteredPin);
              if (!ok) {
                setPinError('PIN de Caja incorrecto.');
                setEnteredPin('');
              }
            }}
            disabled={enteredPin.length === 0}
            className={`w-full py-3.5 rounded-2xl font-black text-sm shadow-md transition cursor-pointer ${
              enteredPin.length > 0
                ? 'bg-app-primary hover:bg-app-primary-hover text-white'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isCorp ? 'Desbloquear Acreditación' : 'Desbloquear Caja'}
          </button>
        </div>
      </section>
    );
  }

  const usdAmount = Number((cajaCents / 100).toFixed(2));
  const bsAmount = Number((usdAmount * settings.bcvRate).toFixed(2));

  // Keypad logic
  const pressDigit = (digit: string) => {
    soundSynth.playClick(settings.enableSound);
    const currentStr = cajaCents.toString();
    if (currentStr.length >= 8) return;
    const newStr = currentStr === '0' ? digit : currentStr + digit;
    setCajaCents(parseInt(newStr, 10));
  };

  const backspace = () => {
    soundSynth.playClick(settings.enableSound);
    const str = cajaCents.toString();
    if (str.length <= 1) {
      setCajaCents(0);
    } else {
      setCajaCents(parseInt(str.slice(0, -1), 10));
    }
  };

  const clearInput = () => {
    soundSynth.playClick(settings.enableSound);
    setCajaCents(0);
  };

  const addQuickAmount = (dollars: number) => {
    soundSynth.playClick(settings.enableSound);
    setCajaCents(prev => prev + dollars * 100);
  };

  const handleApplyEstimatedAmount = () => {
    if (estimatorSummary.totalUSD <= 0) return;
    soundSynth.playSuccess(settings.enableSound);
    setCajaCents(Math.round(estimatorSummary.totalUSD * 100));
    setMobileSection('operacion');
  };

  const handleChargeSubmit = () => {
    if (usdAmount <= 0) {
      soundSynth.playError(settings.enableSound);
      return;
    }

    openNfcModal({
      mode: 'RECHARGE',
      amountUSD: usdAmount,
      title: 'Recarga de Saldo NFC',
      subtitle: `Acerca el sticker o pulsera del cliente para cargar ${formatUSD(usdAmount)}.`,
      paymentMethod,
    });
  };

  const handleCorporateAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany) return;
    const baseQuotas = buildQuotasFromAllowances(currentCompany.employeeAllowances);
    const customQuotas: Record<string, StickerQuotaProgress> = {};
    Object.entries(baseQuotas).forEach(([ruleId, q]) => {
      customQuotas[ruleId] = {
        ...q,
        allowed: Math.max(0, customAllowedMap[ruleId] ?? q.allowed),
      };
    });

    openNfcModal({
      mode: 'ASSIGN_QUOTA',
      amountUSD: 0,
      title: 'Acreditar Pulsera de Empleado',
      subtitle: `Acerca la pulsera NFC para asignar los beneficios a ${empName.trim() || 'este empleado'}.`,
      customAttendeeName: empName.trim() || undefined,
      customDepartment: empDept.trim() || 'General',
      customQuotas,
    });
  };

  const recentCajaMovements = transactions.filter(t =>
    isCorp ? t.type === 'ASIGNACION' || t.type === 'RETIRO' : t.type === 'RECARGA'
  );

  // Reusable Price Reference Panel (Visible in Caja for cashiers & clients)
  const renderPriceReferencePanel = () => (
    <div className="space-y-4">
      {/* Header & Explanation */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div>
          <h3 className="font-black text-slate-800 text-base sm:text-lg tracking-tight flex items-center gap-2">
            <Tags className="w-5 h-5 text-blue-600" />
            <span>Precios de Stands (Referencia)</span>
          </h3>
          <p className="text-xs text-slate-500">
            {isCorp
              ? 'Catálogo disponible en los stands y su beneficio correspondiente.'
              : 'Suma productos para indicarle al cliente cuánto recargar en USD o Bolívares.'}
          </p>
        </div>
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 font-mono">
          BCV: {formatBs(settings.bcvRate)}
        </span>
      </div>

      {/* Search & Provider Filter Pills */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar producto, comida, bebida o stand..."
            value={priceSearch}
            onChange={e => setPriceSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 ring-app-primary"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedPriceProvider('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition cursor-pointer ${
              selectedPriceProvider === 'ALL'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
            }`}
          >
            Todos ({products.length})
          </button>
          {providers.map(prov => (
            <button
              key={prov.id}
              type="button"
              onClick={() => setSelectedPriceProvider(prov.brandName)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap border transition flex items-center gap-1 cursor-pointer ${
                selectedPriceProvider === prov.brandName
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>{prov.emoji}</span>
              <span>{prov.brandName}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Quick Estimator Summary Banner (Cashless) */}
      {!isCorp && estimatorSummary.totalCount > 0 && (
        <div className="bg-slate-950 text-white rounded-2xl p-3.5 border border-slate-800 space-y-2.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Estimado para {estimatorSummary.totalCount} producto(s)
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black text-emerald-400 font-mono">
                  {formatUSD(estimatorSummary.totalUSD)}
                </span>
                <span className="text-xs font-bold text-amber-400 font-mono">
                  ≈ {formatBs(estimatorSummary.totalBs)}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEstimatorQty({})}
              className="text-[11px] font-bold text-rose-400 hover:text-rose-300 px-2 py-1 rounded-lg bg-white/10 cursor-pointer"
            >
              Limpiar
            </button>
          </div>
          <button
            type="button"
            onClick={handleApplyEstimatedAmount}
            className="w-full py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md transition active:scale-95 cursor-pointer"
          >
            <Calculator className="w-4 h-4" />
            <span>Usar monto en Caja ({formatUSD(estimatorSummary.totalUSD)})</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Product Reference List */}
      {filteredCatalogProducts.length === 0 ? (
        <div className="py-12 text-center text-slate-400">
          <Store className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <p className="text-xs font-bold text-slate-600">No hay productos que coincidan</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {filteredCatalogProducts.map(prod => {
            const qty = estimatorQty[prod.id] || 0;
            const matchingAllowance = isCorp
              ? currentCompany?.employeeAllowances.find(
                  r =>
                    (r.matchType === 'PRODUCT' && r.matchValue === String(prod.id)) ||
                    (r.matchType === 'CATEGORY' &&
                      r.matchValue.toLowerCase() === (prod.category || 'General').toLowerCase())
                )
              : null;

            return (
              <div
                key={prod.id}
                className={`p-3 rounded-2xl border transition flex items-center justify-between gap-2.5 ${
                  qty > 0
                    ? 'bg-blue-50/70 border-blue-300'
                    : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200/80'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-xl shrink-0 shadow-xs overflow-hidden">
                    {prod.imageUrl ? (
                      <img
                        src={prod.imageUrl}
                        alt={prod.name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      prod.emoji || '📦'
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-black text-slate-800 text-xs sm:text-sm truncate">
                      {prod.name}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] font-bold text-slate-500 truncate">
                        {prod.provider}
                      </span>
                      {prod.category && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200/70 text-slate-600 font-semibold">
                          {prod.category}
                        </span>
                      )}
                      {isCorp && matchingAllowance && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 font-bold">
                          Cupo: {matchingAllowance.emoji} {matchingAllowance.label}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="text-right font-mono">
                    <span className="font-black text-app-primary text-sm block">
                      {formatUSD(prod.price)}
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold block">
                      {formatBs(prod.price * settings.bcvRate)}
                    </span>
                  </div>

                  {!isCorp && (
                    <div className="flex items-center gap-1">
                      {qty > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              soundSynth.playClick(settings.enableSound);
                              setEstimatorQty(prev => ({
                                ...prev,
                                [prod.id]: Math.max(0, (prev[prod.id] || 0) - 1),
                              }));
                            }}
                            className="w-7 h-7 rounded-lg bg-white border border-slate-300 text-slate-700 flex items-center justify-center cursor-pointer active:scale-95"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-5 text-center font-black text-xs font-mono text-blue-700">
                            {qty}
                          </span>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          soundSynth.playClick(settings.enableSound);
                          setEstimatorQty(prev => ({
                            ...prev,
                            [prod.id]: (prev[prod.id] || 0) + 1,
                          }));
                        }}
                        className="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-xs cursor-pointer active:scale-95"
                        title="Sumar a estimado de recarga"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // Reusable Recent History Panel
  const renderHistoryPanel = () => (
    <div>
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
        <div>
          <h3 className="font-black text-slate-800 text-base sm:text-lg tracking-tight">
            {isCorp ? 'Últimas Acreditaciones y Retiros' : 'Últimas Recargas en Caja'}
          </h3>
          <p className="text-xs text-slate-400">Transacciones sincronizadas en tiempo real</p>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
          {recentCajaMovements.length} reg.
        </span>
      </div>

      {recentCajaMovements.length === 0 ? (
        <div className="py-12 text-center text-slate-400 space-y-2">
          <Receipt className="w-10 h-10 mx-auto text-slate-300" />
          <p className="text-sm font-semibold">No hay movimientos registrados aún</p>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            {isCorp
              ? 'Acredita la primera pulsera de empleado para ver los movimientos aquí.'
              : 'Ingresa un monto en el teclado numérico y pulsa "Cargar" para registrar la primera recarga.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
          {recentCajaMovements.map(tx => (
            <div
              key={tx.id}
              className="p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 transition flex items-center justify-between gap-3 group"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${
                      tx.type === 'RECARGA'
                        ? 'bg-emerald-100 text-emerald-700'
                        : tx.type === 'ASIGNACION'
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {tx.type}
                  </span>
                  <span className="font-black text-slate-800 text-sm truncate">
                    {tx.owner}
                  </span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 shrink-0">
                    {tx.stickerId}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium truncate">
                  {tx.type === 'ASIGNACION'
                    ? tx.detail
                    : `${formatBs(tx.bs)} • ${tx.paymentMethod || tx.provider || 'NFC'}`}
                </p>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                  {tx.id} • {tx.time}
                </p>
              </div>

              <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                {tx.type !== 'ASIGNACION' ? (
                  <span
                    className={`font-black text-base sm:text-lg font-mono ${
                      tx.type === 'RECARGA' ? 'text-emerald-600' : 'text-indigo-600'
                    }`}
                  >
                    {tx.type === 'RECARGA' ? '+' : ''}{formatUSD(tx.usd)}
                  </span>
                ) : (
                  <span className="text-[11px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200">
                    Acreditado
                  </span>
                )}
                <button
                  onClick={() => setReceiptModalTx(tx)}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 opacity-90 group-hover:opacity-100 hover:underline cursor-pointer"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Ticket</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <section className="space-y-4 sm:space-y-6">
      {/* Mobile-First Segmented Switcher (< lg) */}
      <div className="lg:hidden grid grid-cols-3 gap-1.5 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs">
        <button
          type="button"
          onClick={() => setMobileSection('operacion')}
          className={`py-2 px-2 rounded-xl text-xs font-black transition cursor-pointer ${
            mobileSection === 'operacion'
              ? 'bg-app-primary text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          {isCorp ? 'Acreditar' : 'Recargar'}
        </button>
        <button
          type="button"
          onClick={() => setMobileSection('precios')}
          className={`py-2 px-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1 ${
            mobileSection === 'precios'
              ? 'bg-app-primary text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <span>Precios</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              mobileSection === 'precios' ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {products.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setMobileSection('historial')}
          className={`py-2 px-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1 ${
            mobileSection === 'historial'
              ? 'bg-app-primary text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <span>Historial</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              mobileSection === 'historial' ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {recentCajaMovements.length}
          </span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: CASHLESS Keypad OR CORPORATE Employee Accreditation */}
        <div
          className={`lg:col-span-7 bg-white rounded-3xl shadow-sm border border-slate-200/90 p-4 sm:p-7 ${
            mobileSection === 'operacion' ? 'block' : 'hidden lg:block'
          }`}
        >
          {/* Header row */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4 sm:mb-5">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                {isCorp ? (
                  <Briefcase className="w-5 h-5 text-indigo-600" />
                ) : (
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                )}
                <span>{isCorp ? 'Acreditación de Empleados NFC' : 'Caja de Recarga NFC'}</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                {isCorp
                  ? 'Asigna los cupos corporativos a la pulsera NFC del empleado (sin cobro).'
                  : 'Ingresa el monto a cobrar al cliente para cargar saldo a su etiqueta NFC.'}
              </p>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() =>
                  openNfcModal({
                    mode: 'QUERY',
                    amountUSD: 0,
                    title: isCorp ? 'Consultar Cupos de Empleado NFC' : 'Consultar Saldo de Pulsera NFC',
                    subtitle: isCorp
                      ? 'Acerca la pulsera del empleado para verificar cuántos beneficios le quedan disponibles.'
                      : 'Acerca la pulsera o tarjeta del cliente para verificar su saldo actual e historial.',
                  })
                }
                className="px-2.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                title="Consultar pulsera NFC"
              >
                <Radio className="w-3.5 h-3.5 text-purple-600 animate-pulse" />
                <span>{isCorp ? 'Consultar Cupos' : 'Consultar Saldo'}</span>
              </button>

              {!isCorp && (
                <div className="hidden sm:flex px-3 py-1 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 items-center gap-1.5 font-mono">
                  <span>1 USD =</span>
                  <span className="font-black">{formatBs(settings.bcvRate)}</span>
                </div>
              )}

              <button
                onClick={lockCaja}
                className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                title="Bloquear Caja"
              >
                <Lock className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Bloquear</span>
              </button>
            </div>
          </div>

          {isCorp ? (
            /* CORPORATE MODE ACCREDITATION FORM */
            <form onSubmit={handleCorporateAssignSubmit} className="space-y-4">
              <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-black text-indigo-900 uppercase tracking-wider">
                  <UserCheck className="w-4 h-4 text-indigo-600" />
                  <span>Datos del Empleado / Invitado</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nombre del Empleado *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={80}
                      placeholder="Ej. María Fernanda López"
                      value={empName}
                      onChange={e => setEmpName(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Departamento / Área
                    </label>
                    <input
                      type="text"
                      maxLength={60}
                      placeholder="Ej. Ingeniería, Ventas, RRHH"
                      value={empDept}
                      onChange={e => setEmpDept(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Employee Benefits / Allowances Preview & Per-Employee Adjustments */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Cupos de Beneficios a Cargar en Pulsera
                  </span>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    Sin cobro al empleado
                  </span>
                </div>

                {(!currentCompany?.employeeAllowances || currentCompany.employeeAllowances.length === 0) ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-semibold">
                    No hay reglas de beneficios configuradas aún. Un administrador debe crearlas en el módulo <strong>3. ADMIN</strong>.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {currentCompany.employeeAllowances.map(rule => {
                      const val = customAllowedMap[rule.id] ?? rule.maxQty;
                      return (
                        <div
                          key={rule.id}
                          className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-2 shadow-2xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-2xl">{rule.emoji}</span>
                            <div className="min-w-0">
                              <p className="font-black text-xs text-slate-800 truncate">{rule.label}</p>
                              <p className="text-[10px] text-slate-400 truncate">
                                {rule.matchType === 'CATEGORY' ? `Cat: ${rule.matchValue}` : 'Producto específico'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                setCustomAllowedMap(prev => ({
                                  ...prev,
                                  [rule.id]: Math.max(0, (prev[rule.id] ?? rule.maxQty) - 1),
                                }))
                              }
                              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-7 text-center font-black font-mono text-sm text-indigo-700">
                              {val}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setCustomAllowedMap(prev => ({
                                  ...prev,
                                  [rule.id]: Math.min(99, (prev[rule.id] ?? rule.maxQty) + 1),
                                }))
                              }
                              className="w-7 h-7 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center justify-center cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={!currentCompany?.employeeAllowances || currentCompany.employeeAllowances.length === 0}
                className="w-full py-4 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black text-sm sm:text-base shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2.5 transition active:scale-[0.99] cursor-pointer"
              >
                <Radio className="w-5 h-5 animate-pulse" />
                <span>ASIGNAR CUPOS Y ACTIVAR NFC</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          ) : (
            /* CASHLESS MODE KEYPAD */
            <>
              {/* Dual Currency Screen (USD -> Bs) */}
              <div className="bg-slate-950 rounded-2xl p-4 sm:p-5 text-white mb-4 sm:mb-5 shadow-inner relative overflow-hidden border border-slate-800">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Monto a Recargar (Dólares USD)
                  </span>
                  {cajaCents > 0 && (
                    <button
                      onClick={clearInput}
                      className="text-xs text-rose-400 hover:text-rose-300 font-semibold px-2 py-0.5 rounded bg-white/10 flex items-center gap-1 transition cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Limpiar</span>
                    </button>
                  )}
                </div>

                <div className="flex items-baseline gap-2 mb-2.5">
                  <span className="text-3xl sm:text-4xl font-extrabold text-emerald-400">$</span>
                  <span className="text-4xl sm:text-5xl font-black tracking-tight text-white font-mono select-none">
                    {usdAmount.toFixed(2)}
                  </span>
                </div>

                <div className="pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-slate-400 font-medium">
                    Total en Bolívares (BCV):
                  </div>
                  <div className="text-right">
                    <span className="text-xl sm:text-3xl font-black text-amber-400 font-mono">
                      {formatBs(bsAmount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="mb-4">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Método de Pago Recibido en Caja:
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 sm:gap-2">
                  {[
                    { id: 'Efectivo USD', label: 'Efectivo $', icon: Banknote },
                    { id: 'Pago Móvil (Bs)', label: 'Pago Móvil', icon: Smartphone },
                    { id: 'Punto de Venta (Bs)', label: 'Punto POS', icon: CreditCard },
                    { id: 'Zelle', label: 'Zelle', icon: QrCode },
                    { id: 'Binance Pay', label: 'Binance', icon: Radio },
                  ].map(method => {
                    const Icon = method.icon;
                    const isSelected = paymentMethod === method.id;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => {
                          soundSynth.playClick(settings.enableSound);
                          setPaymentMethod(method.id as PaymentMethod);
                        }}
                        className={`py-2 px-2 rounded-xl border text-[11px] sm:text-xs font-bold flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-xs ring-2 ring-blue-500/20'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:border-slate-300'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="truncate max-w-full">{method.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Amount Chips */}
              <div className="grid grid-cols-5 gap-1.5 sm:gap-2 mb-3.5">
                {[5, 10, 20, 50, 100].map(amt => (
                  <button
                    key={amt}
                    onClick={() => addQuickAmount(amt)}
                    className="py-2 sm:py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200/80 font-black text-slate-700 text-xs sm:text-sm transition active:scale-95 cursor-pointer"
                  >
                    +${amt}
                  </button>
                ))}
              </div>

              {/* Virtual POS Keypad */}
              <div className="grid grid-cols-3 gap-2 sm:gap-2.5 mb-4 sm:mb-5">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
                  <button
                    key={d}
                    onClick={() => pressDigit(d)}
                    className="h-12 sm:h-14 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xl sm:text-2xl font-black text-slate-800 shadow-xs active:scale-95 transition cursor-pointer select-none"
                  >
                    {d}
                  </button>
                ))}
                <button
                  onClick={() => pressDigit('00')}
                  className="h-12 sm:h-14 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-lg sm:text-xl font-black text-slate-800 shadow-xs active:scale-95 transition cursor-pointer select-none"
                >
                  00
                </button>
                <button
                  onClick={() => pressDigit('0')}
                  className="h-12 sm:h-14 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xl sm:text-2xl font-black text-slate-800 shadow-xs active:scale-95 transition cursor-pointer select-none"
                >
                  0
                </button>
                <button
                  onClick={backspace}
                  title="Borrar dígito"
                  className="h-12 sm:h-14 rounded-2xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center shadow-xs active:scale-95 transition cursor-pointer"
                >
                  <Delete className="w-6 h-6" />
                </button>
              </div>

              {/* Main Action Button */}
              <button
                onClick={handleChargeSubmit}
                disabled={usdAmount <= 0}
                className={`w-full py-4 px-5 rounded-2xl font-black text-sm sm:text-lg shadow-lg flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
                  usdAmount > 0
                    ? 'bg-app-primary hover:bg-app-primary-hover text-white shadow-blue-500/25 active:scale-[0.99]'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                }`}
              >
                <Radio className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse" />
                <span>CARGAR {formatUSD(usdAmount)} EN STICKER NFC</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </>
          )}
        </div>

        {/* Right Column: Price Reference Catalog + Ledger History */}
        <div
          className={`lg:col-span-5 bg-white rounded-3xl shadow-sm border border-slate-200/90 p-4 sm:p-6 ${
            mobileSection !== 'operacion' ? 'block' : 'hidden lg:block'
          }`}
        >
          {/* Desktop Switcher between Price Reference and History */}
          <div className="hidden lg:grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-2xl mb-4">
            <button
              type="button"
              onClick={() => setDesktopRightTab('precios')}
              className={`py-2 px-3 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${
                desktopRightTab === 'precios'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Tags className="w-3.5 h-3.5 text-blue-600" />
              <span>Precios de Stands ({products.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setDesktopRightTab('historial')}
              className={`py-2 px-3 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${
                desktopRightTab === 'historial'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Receipt className="w-3.5 h-3.5 text-emerald-600" />
              <span>Historial Caja ({recentCajaMovements.length})</span>
            </button>
          </div>

          {/* Mobile renders selected tab directly; Desktop renders desktopRightTab */}
          <div className="lg:hidden">
            {mobileSection === 'precios' && renderPriceReferencePanel()}
            {mobileSection === 'historial' && renderHistoryPanel()}
          </div>
          <div className="hidden lg:block">
            {desktopRightTab === 'precios' ? renderPriceReferencePanel() : renderHistoryPanel()}
          </div>
        </div>
      </div>
    </section>
  );
};
