import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  Store,
  Wallet,
  Percent,
  Palette,
  Plus,
  Trash2,
  Download,
  FileSpreadsheet,
  Search,
  RotateCcw,
  Lock,
  ChevronDown,
  ChevronUp,
  Briefcase,
  CreditCard,
  Gift,
  Minus,
  Users,
  CheckCircle2,
  Eraser,
  Image as ImageIcon,
  Upload,
  Camera,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatUSD, formatBs, formatDateTime } from '../utils/formatters';
import { soundSynth } from '../utils/audio';
import { calculateCompanyProviderStats, exportProvidersCSV } from '../utils/providerStats';
import { EmployeeAllowanceRule } from '../types';
import { TestDataCleanupModal } from './TestDataCleanupModal';
import {
  compressImageFileToDataUrl,
  EVENT_COVER_MAX_CHARS,
  EVENT_LOGO_MAX_CHARS,
  PRODUCT_IMAGE_MAX_CHARS,
  sanitizeImageRef,
} from '../utils/imageUtils';

const RULE_EMOJIS = ['🍽️', '🍦', '🥤', '🍔', '☕', '🍿', '🎁', '🎟️', '🍕', '🍺'];

export const AdminModule: React.FC = () => {
  const {
    currentCompany,
    updateCompanyLogoImage,
    updateCompanyCoverImage,
    updateCompanyEventMode,
    updateEmployeeAllowances,
    updateAdminPin,
    updateCajaPin,
    providers,
    updateProviderPin,
    deleteProviderBrand,
    setIsNewProviderModalOpen,
    lockAdmin,
    settings,
    updateSettings,
    resetTheme,
    setPresetTheme,
    stickers,
    products,
    updateProduct,
    deleteProduct,
    transactions,
    setIsProductModalOpen,
    setReceiptModalTx,
    resetCurrentCompanyData,
    wipeCurrentCompanyTestData,
    exportDataJSON,
    exportTransactionsCSV,
  } = useApp();

  const isCorp = currentCompany?.eventMode === 'CORPORATE';

  const [bcvInput, setBcvInput] = useState<string>(settings.bcvRate.toString());
  const [bcvSavedMessage, setBcvSavedMessage] = useState<boolean>(false);
  const [newAdminPinInput, setNewAdminPinInput] = useState<string>('');
  const [pinSavedMessage, setPinSavedMessage] = useState<boolean>(false);
  const [newCajaPinInput, setNewCajaPinInput] = useState<string>('');
  const [cajaPinSavedMessage, setCajaPinSavedMessage] = useState<boolean>(false);
  const [providerPinDrafts, setProviderPinDrafts] = useState<Record<string, string>>({});
  const [txFilter, setTxFilter] = useState<'ALL' | 'RECARGA' | 'CONSUMO' | 'ASIGNACION' | 'RETIRO'>('ALL');
  const [txSearch, setTxSearch] = useState<string>('');
  const [prodSearch, setProdSearch] = useState<string>('');
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [isCleanupModalOpen, setIsCleanupModalOpen] = useState<boolean>(false);
  const [confirmQuickWipe, setConfirmQuickWipe] = useState<boolean>(false);

  // Event logo, cover thumbnail & product photo upload states
  const [logoUrlDraft, setLogoUrlDraft] = useState<string>('');
  const [showLogoUrlBox, setShowLogoUrlBox] = useState<boolean>(false);
  const [logoUploadError, setLogoUploadError] = useState<string>('');
  const [isCompressingLogo, setIsCompressingLogo] = useState<boolean>(false);
  const [coverUrlDraft, setCoverUrlDraft] = useState<string>('');
  const [showCoverUrlBox, setShowCoverUrlBox] = useState<boolean>(false);
  const [coverUploadError, setCoverUploadError] = useState<string>('');
  const [isCompressingCover, setIsCompressingCover] = useState<boolean>(false);
  const [uploadingProductId, setUploadingProductId] = useState<number | null>(null);
  const [productImgError, setProductImgError] = useState<string>('');

  // New corporate allowance rule form state
  const [ruleEmoji, setRuleEmoji] = useState<string>('🍽️');
  const [ruleLabel, setRuleLabel] = useState<string>('');
  const [ruleMatchType, setRuleMatchType] = useState<'CATEGORY' | 'PRODUCT'>('CATEGORY');
  const [ruleMatchValue, setRuleMatchValue] = useState<string>('');
  const [ruleMaxQty, setRuleMaxQty] = useState<string>('1');

  const existingCategories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category?.trim()) set.add(p.category.trim());
    });
    return Array.from(set);
  }, [products]);

  // Provider financial breakdown ($ USD and Bolívares)
  const providerStats = useMemo(() => {
    return calculateCompanyProviderStats(
      products,
      transactions,
      settings.eventCommissionRate,
      settings.bcvRate
    );
  }, [products, transactions, settings.eventCommissionRate, settings.bcvRate]);

  // Financial calculations
  const totalRecargadoUSD = useMemo(() => {
    return transactions
      .filter(t => t.type === 'RECARGA')
      .reduce((sum, t) => sum + t.usd, 0);
  }, [transactions]);

  const totalRecargadoBs = useMemo(() => {
    return transactions
      .filter(t => t.type === 'RECARGA')
      .reduce((sum, t) => sum + t.bs, 0);
  }, [transactions]);

  const totalConsumidoUSD = useMemo(() => {
    return transactions
      .filter(t => t.type === 'CONSUMO' || t.type === 'RETIRO')
      .reduce((sum, t) => sum + t.usd, 0);
  }, [transactions]);

  const totalRetirosCount = useMemo(() => {
    return transactions.filter(t => t.type === 'RETIRO').length;
  }, [transactions]);

  const saldoFlotanteUSD = useMemo(() => {
    return stickers.reduce((sum, s) => sum + s.balance, 0);
  }, [stickers]);

  const comisionOrganizadorUSD = useMemo(() => {
    return totalConsumidoUSD * (settings.eventCommissionRate / 100);
  }, [totalConsumidoUSD, settings.eventCommissionRate]);

  // Update BCV handler
  const handleUpdateBcv = () => {
    const val = parseFloat(bcvInput);
    if (!isNaN(val) && val > 0) {
      updateSettings({ bcvRate: Number(val.toFixed(2)) });
      soundSynth.playSuccess(settings.enableSound);
      setBcvSavedMessage(true);
      setTimeout(() => setBcvSavedMessage(false), 2500);
    }
  };

  // Add corporate benefit rule
  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany || !ruleLabel.trim() || !ruleMatchValue.trim()) return;
    const newRule: EmployeeAllowanceRule = {
      id: `rule-${Date.now().toString(36)}`,
      label: ruleLabel.trim(),
      emoji: ruleEmoji,
      matchType: ruleMatchType,
      matchValue: ruleMatchValue.trim(),
      maxQty: Math.max(1, parseInt(ruleMaxQty, 10) || 1),
    };
    updateEmployeeAllowances([...currentCompany.employeeAllowances, newRule]);
    setRuleLabel('');
    setRuleMatchValue('');
    setRuleMaxQty('1');
  };

  const handleAdjustRuleQty = (ruleId: string, delta: number) => {
    if (!currentCompany) return;
    const next = currentCompany.employeeAllowances.map(r =>
      r.id === ruleId ? { ...r, maxQty: Math.max(1, r.maxQty + delta) } : r
    );
    updateEmployeeAllowances(next);
  };

  const handleDeleteRule = (ruleId: string) => {
    if (!currentCompany) return;
    updateEmployeeAllowances(currentCompany.employeeAllowances.filter(r => r.id !== ruleId));
  };

  const handleLogoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLogoUploadError('');
    setIsCompressingLogo(true);
    try {
      const dataUrl = await compressImageFileToDataUrl(file, {
        maxWidth: 320,
        maxHeight: 320,
        maxChars: EVENT_LOGO_MAX_CHARS,
      });
      updateCompanyLogoImage(dataUrl);
      setLogoUrlDraft('');
      setShowLogoUrlBox(false);
    } catch (err) {
      setLogoUploadError(err instanceof Error ? err.message : 'No se pudo procesar el logo.');
    } finally {
      setIsCompressingLogo(false);
    }
  };

  const handleApplyLogoUrl = () => {
    setLogoUploadError('');
    const clean = sanitizeImageRef(logoUrlDraft, EVENT_LOGO_MAX_CHARS);
    if (!clean) {
      setLogoUploadError('Ingresa una URL https:// válida de imagen PNG o JPG.');
      return;
    }
    updateCompanyLogoImage(clean);
    setLogoUrlDraft('');
    setShowLogoUrlBox(false);
  };

  const handleCoverFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCoverUploadError('');
    setIsCompressingCover(true);
    try {
      const dataUrl = await compressImageFileToDataUrl(file, {
        maxWidth: 720,
        maxHeight: 405,
        maxChars: EVENT_COVER_MAX_CHARS,
      });
      updateCompanyCoverImage(dataUrl);
      setCoverUrlDraft('');
      setShowCoverUrlBox(false);
    } catch (err) {
      setCoverUploadError(err instanceof Error ? err.message : 'No se pudo procesar la portada.');
    } finally {
      setIsCompressingCover(false);
    }
  };

  const handleApplyCoverUrl = () => {
    setCoverUploadError('');
    const clean = sanitizeImageRef(coverUrlDraft, EVENT_COVER_MAX_CHARS);
    if (!clean) {
      setCoverUploadError('Ingresa una URL https:// válida de imagen PNG o JPG.');
      return;
    }
    updateCompanyCoverImage(clean);
    setCoverUrlDraft('');
    setShowCoverUrlBox(false);
  };

  const handleProductRowPhotoUpload = async (
    productId: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setProductImgError('');
    setUploadingProductId(productId);
    try {
      const dataUrl = await compressImageFileToDataUrl(file, {
        maxWidth: 400,
        maxHeight: 400,
        maxChars: PRODUCT_IMAGE_MAX_CHARS,
      });
      updateProduct(productId, { imageUrl: dataUrl });
    } catch (err) {
      setProductImgError(err instanceof Error ? err.message : 'No se pudo procesar la foto.');
    } finally {
      setUploadingProductId(null);
    }
  };

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesType = txFilter === 'ALL' || t.type === txFilter;
      const matchesSearch =
        txSearch.trim() === '' ||
        t.owner.toLowerCase().includes(txSearch.toLowerCase()) ||
        t.stickerId.toLowerCase().includes(txSearch.toLowerCase()) ||
        t.id.toLowerCase().includes(txSearch.toLowerCase()) ||
        t.detail.toLowerCase().includes(txSearch.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [transactions, txFilter, txSearch]);

  // Filter products in table
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      return (
        prodSearch.trim() === '' ||
        p.name.toLowerCase().includes(prodSearch.toLowerCase()) ||
        p.provider.toLowerCase().includes(prodSearch.toLowerCase())
      );
    });
  }, [products, prodSearch]);

  return (
    <section className="space-y-5 sm:space-y-6">
      {/* Financial KPIs Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {isCorp ? (
          <>
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Empleados Acreditados
                </span>
                <span className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </span>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight">
                {stickers.length}
              </p>
              <p className="text-[11px] text-indigo-600 font-bold mt-1">Pulseras con beneficios</p>
            </div>

            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Entregas Realizadas
                </span>
                <span className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </span>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-emerald-600 font-mono tracking-tight">
                {totalRetirosCount}
              </p>
              <p className="text-[11px] text-slate-400 font-medium mt-1">Retiros validados por NFC</p>
            </div>

            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Liquidación Stands (USD)
                </span>
                <span className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </span>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-blue-600 font-mono tracking-tight">
                {formatUSD(totalConsumidoUSD)}
              </p>
              <p className="text-[11px] text-slate-400 font-medium mt-1">Valor consumido por empresa</p>
            </div>

            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Liquidación Stands (Bs)
                </span>
                <span className="w-7 h-7 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </span>
              </div>
              <p className="text-lg sm:text-2xl font-black text-amber-600 font-mono tracking-tight truncate">
                {formatBs(totalConsumidoUSD * settings.bcvRate)}
              </p>
              <p className="text-[11px] text-slate-400 font-medium mt-1">A tasa BCV vigente</p>
            </div>

            <div className="col-span-2 lg:col-span-1 bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Reglas Activas
                </span>
                <span className="w-7 h-7 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Gift className="w-4 h-4" />
                </span>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-purple-600 font-mono tracking-tight">
                {currentCompany?.employeeAllowances.length || 0}
              </p>
              <p className="text-[11px] text-slate-400 font-medium mt-1">Cupos por empleado</p>
            </div>
          </>
        ) : (
          <>
            {/* Recaudado USD */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Recaudado en Caja
                </span>
                <span className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </span>
              </div>
              <p className="text-xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight">
                {formatUSD(totalRecargadoUSD)}
              </p>
              <p className="text-[11px] text-emerald-600 font-bold mt-1">Ingresos brutos</p>
            </div>

            {/* Recaudado Bs */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Recaudado Bs
                </span>
                <span className="w-7 h-7 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </span>
              </div>
              <p className="text-lg sm:text-2xl font-black text-amber-600 font-mono tracking-tight truncate">
                {formatBs(totalRecargadoBs)}
              </p>
              <p className="text-[11px] text-slate-400 font-medium mt-1">Calculado a tasa</p>
            </div>

            {/* Consumo en Proveedores */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Ventas Stands
                </span>
                <span className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Store className="w-4 h-4" />
                </span>
              </div>
              <p className="text-xl sm:text-3xl font-black text-indigo-600 font-mono tracking-tight">
                {formatUSD(totalConsumidoUSD)}
              </p>
              <p className="text-[11px] text-slate-400 font-medium mt-1">Consumos NFC</p>
            </div>

            {/* Saldo Flotante en NFC */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Saldo Flotante
                </span>
                <span className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Wallet className="w-4 h-4" />
                </span>
              </div>
              <p className="text-xl sm:text-3xl font-black text-emerald-600 font-mono tracking-tight">
                {formatUSD(saldoFlotanteUSD)}
              </p>
              <p className="text-[11px] text-slate-400 font-medium mt-1">En {stickers.length} pulseras</p>
            </div>

            {/* Comisión del Evento */}
            <div className="col-span-2 lg:col-span-1 bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Comisión ({settings.eventCommissionRate}%)
                </span>
                <span className="w-7 h-7 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Percent className="w-4 h-4" />
                </span>
              </div>
              <p className="text-xl sm:text-3xl font-black text-purple-600 font-mono tracking-tight">
                {formatUSD(comisionOrganizadorUSD)}
              </p>
              <p className="text-[11px] text-slate-400 font-medium mt-1">Fee organizador</p>
            </div>
          </>
        )}
      </div>

      {/* Main Admin Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        {/* Left Column: Event Mode & Corporate Benefits + BCV + Theme + Security + Backups */}
        <div className="lg:col-span-5 space-y-5 sm:space-y-6">
          {/* Event Mode Switcher + Corporate Benefit Rules Builder */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
            <div>
              <h3 className="font-black text-slate-800 text-base sm:text-lg tracking-tight flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-indigo-600" />
                <span>Modalidad del Evento</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Cambia entre evento público con recarga de saldo o evento corporativo por cupos sin cobro al empleado.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => updateCompanyEventMode('CASHLESS')}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                  !isCorp
                    ? 'bg-blue-50 border-blue-600 text-blue-950 ring-2 ring-blue-500/20'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-1.5 font-black text-xs mb-1">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  <span>Cashless (Saldo)</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Asistentes recargan dinero y consumen saldo.
                </p>
              </button>

              <button
                type="button"
                onClick={() => updateCompanyEventMode('CORPORATE')}
                className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                  isCorp
                    ? 'bg-indigo-50 border-indigo-600 text-indigo-950 ring-2 ring-indigo-500/20'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-1.5 font-black text-xs mb-1">
                  <Briefcase className="w-4 h-4 text-indigo-600" />
                  <span>Corporativo</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  Empleados retiran cupos (1 almuerzo, 2 helados).
                </p>
              </button>
            </div>

            {/* Corporate Allowances Rules Builder */}
            {isCorp && (
              <div className="pt-3 border-t border-slate-100 space-y-3.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                    <Gift className="w-4 h-4 text-indigo-600" />
                    <span>Cupos Permitidos por Empleado</span>
                  </span>
                  <span className="text-[11px] font-bold text-slate-400">
                    {currentCompany?.employeeAllowances.length || 0} reglas
                  </span>
                </div>

                {/* Current Rules List */}
                <div className="space-y-2">
                  {currentCompany?.employeeAllowances.map(rule => (
                    <div
                      key={rule.id}
                      className="p-3 rounded-2xl bg-indigo-50/60 border border-indigo-200/80 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-2xl">{rule.emoji}</span>
                        <div className="min-w-0">
                          <p className="font-black text-xs sm:text-sm text-slate-900 truncate">
                            {rule.label}
                          </p>
                          <p className="text-[10px] text-indigo-700 font-semibold truncate">
                            {rule.matchType === 'CATEGORY'
                              ? `Categoría: ${rule.matchValue}`
                              : `Producto ID: ${rule.matchValue}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleAdjustRuleQty(rule.id, -1)}
                          className="w-6 h-6 rounded-lg bg-white border border-slate-300 text-slate-700 flex items-center justify-center cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-7 text-center font-black font-mono text-sm text-indigo-800">
                          {rule.maxQty}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAdjustRuleQty(rule.id, 1)}
                          className="w-6 h-6 rounded-lg bg-white border border-slate-300 text-slate-700 flex items-center justify-center cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 cursor-pointer ml-1"
                          title="Eliminar regla"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add New Rule Form */}
                <form
                  onSubmit={handleAddRule}
                  className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/90 space-y-2.5"
                >
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 block">
                    + Añadir Nuevo Beneficio por Empleado
                  </span>

                  <div className="flex flex-wrap gap-1">
                    {RULE_EMOJIS.map(em => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => setRuleEmoji(em)}
                        className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center cursor-pointer ${
                          ruleEmoji === em ? 'bg-indigo-600 text-white scale-110' : 'bg-white border border-slate-200'
                        }`}
                      >
                        {em}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Nombre (ej. Almuerzos)"
                      value={ruleLabel}
                      onChange={e => setRuleLabel(e.target.value)}
                      className="col-span-2 px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                    />
                    <input
                      type="number"
                      min="1"
                      max="99"
                      required
                      placeholder="Cant."
                      value={ruleMaxQty}
                      onChange={e => setRuleMaxQty(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-black font-mono text-center bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={ruleMatchType}
                      onChange={e => {
                        setRuleMatchType(e.target.value as 'CATEGORY' | 'PRODUCT');
                        setRuleMatchValue('');
                      }}
                      className="px-2.5 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white"
                    >
                      <option value="CATEGORY">Por Categoría</option>
                      <option value="PRODUCT">Por Producto</option>
                    </select>

                    {ruleMatchType === 'CATEGORY' ? (
                      <>
                        <input
                          type="text"
                          list="corp-categories"
                          required
                          placeholder="Ej. Almuerzos, Helados"
                          value={ruleMatchValue}
                          onChange={e => setRuleMatchValue(e.target.value)}
                          className="px-2.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
                        />
                        <datalist id="corp-categories">
                          {existingCategories.map(cat => (
                            <option key={cat} value={cat} />
                          ))}
                        </datalist>
                      </>
                    ) : (
                      <select
                        required
                        value={ruleMatchValue}
                        onChange={e => setRuleMatchValue(e.target.value)}
                        className="px-2.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
                      >
                        <option value="">Elegir producto...</option>
                        {products.map(pr => (
                          <option key={pr.id} value={String(pr.id)}>
                            {pr.emoji} {pr.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs cursor-pointer transition"
                  >
                    Agregar Regla de Beneficio
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Tasa Oficial BCV Box */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-black text-slate-800 text-base sm:text-lg tracking-tight flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                <span>Tasa Oficial BCV</span>
              </h3>
              <span className="text-xs font-bold text-slate-400 font-mono">USD / VES</span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Ajusta el valor oficial del dólar en Bolívares. Se actualizará al instante en todos los dispositivos conectados.
            </p>

            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-slate-400 font-mono">
                  Bs.
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={bcvInput}
                  onChange={e => setBcvInput(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-300 font-black text-slate-900 text-xl focus:outline-none focus:ring-2 ring-app-primary font-mono"
                />
              </div>
              <button
                onClick={handleUpdateBcv}
                className="px-4 sm:px-5 py-3 rounded-xl bg-app-primary hover:bg-app-primary-hover text-white font-black text-sm shadow-md transition active:scale-95 cursor-pointer"
              >
                Actualizar
              </button>
            </div>

            {bcvSavedMessage && (
              <p className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl mb-3">
                ✓ Tasa BCV actualizada a {formatBs(parseFloat(bcvInput))}
              </p>
            )}

            {/* Quick preset rates */}
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400">Rápido:</span>
              {[50.0, 52.4, 55.0, 58.0].map(val => (
                <button
                  key={val}
                  onClick={() => {
                    setBcvInput(val.toFixed(2));
                    updateSettings({ bcvRate: val });
                    soundSynth.playClick(settings.enableSound);
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono transition cursor-pointer"
                >
                  Bs. {val.toFixed(2)}
                </button>
              ))}
            </div>
          </div>

          {/* White-Label Appearance Customizer */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-800 text-base sm:text-lg tracking-tight flex items-center gap-2">
                  <Palette className="w-5 h-5 text-purple-600" />
                  <span>Personalizar Marca &amp; Colores</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Modifica textos y colores del evento en tiempo real.
                </p>
              </div>
              <button
                onClick={resetTheme}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 underline flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restaurar</span>
              </button>
            </div>

            <div className="space-y-3 pt-1">
              {/* Event Icon / Logo Upload (PNG / JPG) */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-emerald-600" />
                    <span>Logo / Icono del Evento (PNG o JPG)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowLogoUrlBox(prev => !prev)}
                    className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    {showLogoUrlBox ? 'Ocultar URL' : 'O usar URL https'}
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-3xl overflow-hidden shrink-0 shadow-xs">
                    {currentCompany?.logoImage ? (
                      <img
                        src={currentCompany.logoImage}
                        alt={`Logo ${currentCompany.name}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      currentCompany?.logoEmoji || '🏢'
                    )}
                  </div>

                  <div className="flex-1 flex flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <label className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer transition active:scale-95">
                        <Upload className="w-3.5 h-3.5" />
                        <span>
                          {isCompressingLogo
                            ? 'Optimizando...'
                            : currentCompany?.logoImage
                            ? 'Cambiar Logo'
                            : 'Subir Logo PNG / JPG'}
                        </span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp"
                          onChange={handleLogoFileUpload}
                          disabled={isCompressingLogo}
                          className="hidden"
                        />
                      </label>

                      {currentCompany?.logoImage && (
                        <button
                          type="button"
                          onClick={() => updateCompanyLogoImage('')}
                          className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Quitar</span>
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Reemplaza el emoji en tarjetas, barra superior y vista previa del evento.
                    </p>
                  </div>
                </div>

                {showLogoUrlBox && (
                  <div className="flex gap-1.5">
                    <input
                      type="url"
                      placeholder="https://ejemplo.com/logo.png"
                      value={logoUrlDraft}
                      onChange={e => setLogoUrlDraft(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={handleApplyLogoUrl}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs cursor-pointer"
                    >
                      Aplicar
                    </button>
                  </div>
                )}

                {logoUploadError && (
                  <p className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded-xl">
                    {logoUploadError}
                  </p>
                )}
              </div>

              {/* Event Cover / Social Media Thumbnail */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-blue-600" />
                    <span>Miniatura / Portada del Evento (PNG o JPG)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCoverUrlBox(prev => !prev)}
                    className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    {showCoverUrlBox ? 'Ocultar URL' : 'O usar URL https'}
                  </button>
                </div>

                {/* Live 16:9 Social Preview */}
                <div className="relative h-36 w-full rounded-2xl overflow-hidden border border-slate-200 bg-slate-900">
                  {currentCompany?.coverImage ? (
                    <img
                      src={currentCompany.coverImage}
                      alt={currentCompany.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center"
                      style={{
                        background: `linear-gradient(135deg, ${settings.primaryColor}dd 0%, #0f172a 75%, ${settings.secondaryColor}99 100%)`,
                      }}
                    >
                      <span className="text-5xl opacity-30">{currentCompany?.logoEmoji || '🏢'}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                  <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-8 h-8 rounded-xl bg-slate-900/90 border border-white/20 flex items-center justify-center text-lg shrink-0 overflow-hidden">
                        {currentCompany?.logoImage ? (
                          <img
                            src={currentCompany.logoImage}
                            alt="Logo"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          currentCompany?.logoEmoji || '🏢'
                        )}
                      </span>
                      <span className="font-black text-white text-xs sm:text-sm truncate">
                        {currentCompany?.name || settings.appName}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-white/80 bg-black/40 px-2 py-0.5 rounded-full shrink-0">
                      Vista Previa
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <label className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer transition active:scale-95">
                    <Upload className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      {isCompressingCover
                        ? 'Optimizando...'
                        : currentCompany?.coverImage
                        ? 'Cambiar Portada'
                        : 'Subir PNG / JPG'}
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      onChange={handleCoverFileUpload}
                      disabled={isCompressingCover}
                      className="hidden"
                    />
                  </label>

                  {currentCompany?.coverImage && (
                    <button
                      type="button"
                      onClick={() => updateCompanyCoverImage('')}
                      className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Quitar</span>
                    </button>
                  )}
                </div>

                {showCoverUrlBox && (
                  <div className="flex gap-1.5">
                    <input
                      type="url"
                      placeholder="https://ejemplo.com/portada.jpg"
                      value={coverUrlDraft}
                      onChange={e => setCoverUrlDraft(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCoverUrl}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs cursor-pointer"
                    >
                      Aplicar
                    </button>
                  </div>
                )}

                {coverUploadError && (
                  <p className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded-xl">
                    {coverUploadError}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Nombre del Evento / Aplicación
                </label>
                <input
                  type="text"
                  value={settings.appName}
                  onChange={e => updateSettings({ appName: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-bold focus:outline-none focus:ring-2 ring-app-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Subtítulo / Eslogan
                </label>
                <input
                  type="text"
                  value={settings.subtitle}
                  onChange={e => updateSettings({ subtitle: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 ring-app-primary"
                />
              </div>

              <div className="grid grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1 truncate">
                    Color Principal
                  </label>
                  <input
                    type="color"
                    value={settings.primaryColor}
                    onChange={e => updateSettings({ primaryColor: e.target.value, primaryHoverColor: e.target.value })}
                    className="w-full h-10 rounded-xl cursor-pointer border border-slate-200 p-1"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1 truncate">
                    Color Cobro
                  </label>
                  <input
                    type="color"
                    value={settings.secondaryColor}
                    onChange={e => updateSettings({ secondaryColor: e.target.value })}
                    className="w-full h-10 rounded-xl cursor-pointer border border-slate-200 p-1"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1 truncate">
                    Fondo
                  </label>
                  <input
                    type="color"
                    value={settings.bgColor}
                    onChange={e => updateSettings({ bgColor: e.target.value })}
                    className="w-full h-10 rounded-xl cursor-pointer border border-slate-200 p-1"
                  />
                </div>
              </div>

              <div className="pt-2">
                <span className="block text-xs font-bold text-slate-500 mb-2">
                  Paletas de Tema Rápidas:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPresetTheme('#2563eb', '#10b981', '#f8fafc')}
                    className="p-2 rounded-xl text-xs font-bold bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 flex items-center justify-between cursor-pointer"
                  >
                    <span>Azul Fintech</span>
                    <span className="flex gap-1">
                      <span className="w-3 h-3 rounded-full bg-blue-600"></span>
                      <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                    </span>
                  </button>

                  <button
                    onClick={() => setPresetTheme('#7c3aed', '#ec4899', '#faf5ff')}
                    className="p-2 rounded-xl text-xs font-bold bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 flex items-center justify-between cursor-pointer"
                  >
                    <span>Festival Neon</span>
                    <span className="flex gap-1">
                      <span className="w-3 h-3 rounded-full bg-purple-600"></span>
                      <span className="w-3 h-3 rounded-full bg-pink-500"></span>
                    </span>
                  </button>

                  <button
                    onClick={() => setPresetTheme('#0f172a', '#f59e0b', '#f8fafc')}
                    className="p-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300 flex items-center justify-between cursor-pointer"
                  >
                    <span>Dark / Oro</span>
                    <span className="flex gap-1">
                      <span className="w-3 h-3 rounded-full bg-slate-900"></span>
                      <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                    </span>
                  </button>

                  <button
                    onClick={() => setPresetTheme('#059669', '#0284c7', '#ecfdf5')}
                    className="p-2 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center justify-between cursor-pointer"
                  >
                    <span>Esmeralda</span>
                    <span className="flex gap-1">
                      <span className="w-3 h-3 rounded-full bg-emerald-600"></span>
                      <span className="w-3 h-3 rounded-full bg-sky-500"></span>
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Admin & Caja PIN Security Box */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="font-black text-slate-800 text-base sm:text-lg tracking-tight flex items-center gap-2">
                  <Lock className="w-5 h-5 text-amber-600" />
                  <span>Seguridad &amp; PINs</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Actualiza las claves secretas de Admin y Caja.
                </p>
              </div>
              <button
                onClick={lockAdmin}
                className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold flex items-center gap-1 transition cursor-pointer shrink-0"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Bloquear</span>
              </button>
            </div>

            <form
              onSubmit={e => {
                e.preventDefault();
                const cleaned = newAdminPinInput.trim();
                if (cleaned.length >= 4) {
                  updateAdminPin(cleaned);
                  setNewAdminPinInput('');
                  setPinSavedMessage(true);
                  setTimeout(() => setPinSavedMessage(false), 2500);
                }
              }}
              className="space-y-2 pt-1"
            >
              <label className="block text-xs font-bold text-slate-600">
                Cambiar PIN Administrador (4 a 8 dígitos):
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  maxLength={8}
                  placeholder="Nuevo PIN Admin"
                  value={newAdminPinInput}
                  onChange={e => setNewAdminPinInput(e.target.value.replace(/\D/g, ''))}
                  className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-slate-900 font-black tracking-widest text-sm focus:outline-none focus:ring-2 ring-app-primary bg-white"
                />
                <button
                  type="submit"
                  disabled={newAdminPinInput.length < 4}
                  className={`px-4 py-2 rounded-xl font-bold text-xs transition cursor-pointer ${
                    newAdminPinInput.length >= 4
                      ? 'bg-app-primary hover:bg-app-primary-hover text-white shadow-sm'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  Cambiar
                </button>
              </div>
              {pinSavedMessage && (
                <p className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl">
                  ✓ PIN de administrador actualizado.
                </p>
              )}
            </form>

            <form
              onSubmit={e => {
                e.preventDefault();
                const cleaned = newCajaPinInput.trim();
                if (cleaned.length >= 4) {
                  updateCajaPin(cleaned);
                  setNewCajaPinInput('');
                  setCajaPinSavedMessage(true);
                  setTimeout(() => setCajaPinSavedMessage(false), 2500);
                }
              }}
              className="space-y-2 pt-3 border-t border-slate-100"
            >
              <label className="block text-xs font-bold text-slate-600">
                Cambiar PIN Secreto de Caja:
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  maxLength={8}
                  placeholder="Nuevo PIN Caja"
                  value={newCajaPinInput}
                  onChange={e => setNewCajaPinInput(e.target.value.replace(/\D/g, ''))}
                  className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 font-mono text-slate-900 font-black tracking-widest text-sm focus:outline-none focus:ring-2 ring-app-primary bg-white"
                />
                <button
                  type="submit"
                  disabled={newCajaPinInput.length < 4}
                  className={`px-4 py-2 rounded-xl font-bold text-xs transition cursor-pointer ${
                    newCajaPinInput.length >= 4
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  Cambiar
                </button>
              </div>
              {cajaPinSavedMessage && (
                <p className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl">
                  ✓ PIN de Caja actualizado.
                </p>
              )}
            </form>
          </div>

          {/* Registered Provider Brands & Masked PINs */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="font-black text-slate-800 text-base tracking-tight flex items-center gap-2">
                  <Store className="w-4 h-4 text-emerald-600" />
                  <span>Marcas de Proveedores &amp; PINs</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Administra los stands y sus claves privadas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewProviderModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nuevo</span>
              </button>
            </div>

            <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
              {providers.map(prov => {
                const draft = providerPinDrafts[prov.id] || '';
                return (
                  <div
                    key={prov.id}
                    className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{prov.emoji || '🏪'}</span>
                        <div>
                          <p className="font-black text-xs text-slate-900">{prov.brandName}</p>
                          <span className="text-[10px] text-slate-400 font-mono">PIN: •••• (Secreto)</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`¿Eliminar el proveedor "${prov.brandName}" y sus productos?`)) {
                            deleteProviderBrand(prov.id);
                          }
                        }}
                        className="text-rose-500 hover:text-rose-700 p-1 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                        title="Eliminar proveedor"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex gap-1.5">
                      <input
                        type="password"
                        maxLength={8}
                        placeholder="Nuevo PIN (4+ dígitos)"
                        value={draft}
                        onChange={e =>
                          setProviderPinDrafts(prev => ({
                            ...prev,
                            [prov.id]: e.target.value.replace(/\D/g, ''),
                          }))
                        }
                        className="flex-1 px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs font-mono bg-white"
                      />
                      <button
                        type="button"
                        disabled={draft.length < 4}
                        onClick={() => {
                          updateProviderPin(prov.id, draft);
                          setProviderPinDrafts(prev => ({ ...prev, [prov.id]: '' }));
                        }}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer ${
                          draft.length >= 4
                            ? 'bg-slate-900 hover:bg-slate-800 text-white'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        Actualizar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Backup, Exports & Reset Box */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-3">
            <h3 className="font-black text-slate-800 text-base tracking-tight flex items-center gap-2">
              <Download className="w-4 h-4 text-slate-700" />
              <span>Reportes &amp; Copias de Seguridad</span>
            </h3>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                onClick={exportTransactionsCSV}
                className="p-3 rounded-2xl bg-slate-100 hover:bg-slate-200 font-bold text-xs text-slate-800 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Exportar CSV</span>
              </button>

              <button
                onClick={exportDataJSON}
                className="p-3 rounded-2xl bg-slate-100 hover:bg-slate-200 font-bold text-xs text-slate-800 flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Download className="w-4 h-4 text-blue-600" />
                <span>Backup JSON</span>
              </button>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Eraser className="w-3.5 h-3.5 text-rose-600" />
                  <span>Limpieza de Pruebas</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {stickers.length} clientes • {transactions.length} mov.
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsCleanupModalOpen(true)}
                className="w-full p-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Borrar Pruebas (Total o Selectivo)...</span>
              </button>

              {confirmQuickWipe ? (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 space-y-2">
                  <p className="text-[11px] font-bold text-rose-800">
                    ¿Borrar los {stickers.length} clientes y {transactions.length} movimientos? (Conserva stands y productos)
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        void wipeCurrentCompanyTestData({ stickers: true, transactions: true });
                        setConfirmQuickWipe(false);
                      }}
                      className="flex-1 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-black text-[11px] cursor-pointer"
                    >
                      Sí, Limpiar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmQuickWipe(false)}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold text-[11px] cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={stickers.length === 0 && transactions.length === 0}
                  onClick={() => setConfirmQuickWipe(true)}
                  className="w-full p-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 disabled:opacity-40 disabled:cursor-not-allowed text-rose-700 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Borrar Clientes y Movimientos de Prueba</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      `¿Seguro que deseas restablecer los datos de "${currentCompany?.name}" al estado base?`
                    )
                  ) {
                    resetCurrentCompanyData();
                  }
                }}
                className="w-full p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restablecer Datos Demo de esta Empresa</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Provider Settlement Breakdown + Product Catalog + Audit Log */}
        <div className="lg:col-span-7 space-y-5 sm:space-y-6">
          {/* Detailed Provider / Stand Sales Report in USD and Bolívares */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                    <Store className="w-4 h-4" />
                  </div>
                  <h3 className="font-black text-slate-800 text-base sm:text-lg tracking-tight">
                    {isCorp ? 'Liquidación por Proveedor / Stand' : 'Ventas por Proveedor / Stand'}
                  </h3>
                </div>
                <p className="text-xs text-slate-500">
                  {isCorp
                    ? 'Total entregado a empleados por cada stand para liquidación empresarial en USD y Bs.'
                    : 'Desglose exacto de ingresos generados por cada stand en Dólares ($) y Bolívares (Bs.).'}
                </p>
              </div>

              <button
                onClick={() =>
                  exportProvidersCSV(providerStats, `liquidacion_${currentCompany?.slug || 'proveedores'}.csv`)
                }
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Liquidación CSV</span>
              </button>
            </div>

            {/* Providers Summary Cards */}
            <div className="space-y-3">
              {providerStats.map(stat => {
                const isExpanded = expandedProvider === stat.name;
                return (
                  <div
                    key={stat.name}
                    className="p-4 rounded-2xl bg-slate-50 hover:bg-slate-100/70 border border-slate-200/80 transition-all duration-200"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-xl shadow-xs">
                          🏪
                        </div>
                        <div>
                          <h4 className="font-black text-slate-900 text-sm sm:text-base leading-tight">
                            {stat.name}
                          </h4>
                          <span className="text-[11px] text-slate-400 font-semibold block mt-0.5">
                            {stat.salesCount} {isCorp ? 'entregas' : 'consumos'} • {stat.percentageOfTotal}% del evento
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="flex items-baseline justify-end gap-1.5">
                          <span className="text-[11px] text-slate-400 font-bold uppercase">Total:</span>
                          <span className="text-lg sm:text-xl font-black text-indigo-600 font-mono">
                            {formatUSD(stat.totalUSD)}
                          </span>
                        </div>
                        <span className="text-xs font-black text-amber-600 font-mono block">
                          {formatBs(stat.totalBs)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(stat.percentageOfTotal, 3)}%` }}
                      />
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-200/80 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      <div className="bg-white p-2 rounded-xl border border-slate-200/60">
                        <span className="text-[10px] text-slate-400 font-bold block">
                          Comisión ({settings.eventCommissionRate}%)
                        </span>
                        <span className="font-bold text-purple-700 font-mono">{formatUSD(stat.commissionUSD)}</span>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          ({formatBs(stat.commissionBs)})
                        </span>
                      </div>

                      <div className="bg-white p-2 rounded-xl border border-slate-200/60">
                        <span className="text-[10px] text-slate-400 font-bold block">Neto Stand (USD)</span>
                        <span className="font-black text-emerald-700 font-mono text-sm">
                          {formatUSD(stat.netUSD)}
                        </span>
                      </div>

                      <div className="bg-white p-2 rounded-xl border border-slate-200/60 col-span-2 sm:col-span-1">
                        <span className="text-[10px] text-slate-400 font-bold block">Neto Stand (Bolívares)</span>
                        <span className="font-black text-amber-600 font-mono text-xs">
                          {formatBs(stat.netBs)}
                        </span>
                      </div>
                    </div>

                    {stat.itemsBreakdown.length > 0 && (
                      <div className="mt-2 text-right">
                        <button
                          type="button"
                          onClick={() => setExpandedProvider(isExpanded ? null : stat.name)}
                          className="text-[11px] font-bold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>
                            {isExpanded
                              ? 'Ocultar Artículos'
                              : `Ver ${stat.itemsBreakdown.length} Artículos`}
                          </span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {isExpanded && (
                          <div className="mt-2 p-3 bg-white rounded-xl border border-slate-200 space-y-1.5 text-left text-xs animate-in fade-in duration-150">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                              Desglose por producto:
                            </span>
                            {stat.itemsBreakdown.map((item, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between py-1 border-b border-slate-100 last:border-none"
                              >
                                <span className="flex items-center gap-1.5 font-medium text-slate-700">
                                  <span>{item.emoji}</span>
                                  <span>
                                    {item.qty}x {item.name}
                                  </span>
                                </span>
                                <div className="text-right font-mono">
                                  <span className="font-bold text-slate-900">{formatUSD(item.revenueUSD)}</span>
                                  <span className="text-[10px] text-slate-400 block font-normal">
                                    ≈ {formatBs(item.revenueUSD * settings.bcvRate)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Product Manager Table */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-black text-slate-800 text-base sm:text-lg tracking-tight">
                  Gestión de Productos y Precios
                </h3>
                <p className="text-xs text-slate-500">
                  Edita nombres, categorías y precios en USD en tiempo real.
                </p>
              </div>
              <button
                onClick={() => setIsProductModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-app-primary hover:bg-app-primary-hover text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nuevo Producto</span>
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filtrar catálogo..."
                value={prodSearch}
                onChange={e => setProdSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 ring-app-primary"
              />
            </div>

            {productImgError && (
              <p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 px-3 py-2 rounded-xl">
                {productImgError}
              </p>
            )}

            <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-white shadow-xs z-10">
                  <tr className="border-b border-slate-200 text-[11px] font-black uppercase text-slate-400">
                    <th className="py-2.5 px-2">Foto / Icono</th>
                    <th className="py-2.5 px-2">Producto</th>
                    <th className="py-2.5 px-2">Categoría</th>
                    <th className="py-2.5 px-2">Precio ($)</th>
                    <th className="py-2.5 px-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredProducts.map(prod => {
                    const isUploading = uploadingProductId === prod.id;
                    return (
                    <tr key={prod.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1.5">
                          <div className="relative shrink-0">
                            <label
                              title="Subir o cambiar foto PNG/JPG"
                              className="w-10 h-10 rounded-xl border border-slate-200 bg-slate-50 hover:border-blue-400 flex items-center justify-center overflow-hidden cursor-pointer transition"
                            >
                              {isUploading ? (
                                <Camera className="w-4 h-4 text-blue-500 animate-pulse" />
                              ) : prod.imageUrl ? (
                                <img
                                  src={prod.imageUrl}
                                  alt={prod.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-xl">{prod.emoji}</span>
                              )}
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/jpg,image/webp"
                                onChange={e => void handleProductRowPhotoUpload(prod.id, e)}
                                disabled={isUploading}
                                className="hidden"
                              />
                            </label>
                            {prod.imageUrl && (
                              <button
                                type="button"
                                onClick={() => updateProduct(prod.id, { imageUrl: '' })}
                                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center shadow cursor-pointer"
                                title="Quitar foto"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={prod.name}
                          onChange={e => updateProduct(prod.id, { name: e.target.value })}
                          className="w-full min-w-[120px] bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-slate-300 rounded-lg px-2 py-1 font-bold text-slate-800 text-xs sm:text-sm"
                        />
                        <span className="text-[10px] text-slate-400 px-2 block">{prod.provider}</span>
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          value={prod.category || 'General'}
                          onChange={e => updateProduct(prod.id, { category: e.target.value })}
                          className="w-24 bg-slate-50 focus:bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1">
                          <span className="text-slate-400 font-bold text-xs">$</span>
                          <input
                            type="number"
                            step="0.10"
                            min="0.10"
                            value={prod.price}
                            onChange={e => updateProduct(prod.id, { price: parseFloat(e.target.value) || 0.1 })}
                            className="w-20 bg-slate-100 focus:bg-white border border-slate-200 rounded-lg px-2 py-1 font-black text-slate-900 text-xs sm:text-sm font-mono"
                          />
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right">
                        <button
                          onClick={() => deleteProduct(prod.id)}
                          className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                          title="Eliminar producto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Audit Log / General Movements */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="font-black text-slate-800 text-base tracking-tight">
                  Historial y Auditoría de Movimientos
                </h4>
                <p className="text-xs text-slate-500">
                  Registro en tiempo real de todas las operaciones NFC.
                </p>
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto max-w-full">
                {(isCorp
                  ? (['ALL', 'ASIGNACION', 'RETIRO'] as const)
                  : (['ALL', 'RECARGA', 'CONSUMO'] as const)
                ).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setTxFilter(tab)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                      txFilter === tab
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab === 'ALL'
                      ? 'Todas'
                      : tab === 'RECARGA'
                      ? 'Recargas'
                      : tab === 'CONSUMO'
                      ? 'Consumos'
                      : tab === 'ASIGNACION'
                      ? 'Acreditaciones'
                      : 'Retiros'}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por cliente, empleado, ID de sticker o detalle..."
                value={txSearch}
                onChange={e => setTxSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 ring-app-primary"
              />
            </div>

            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {filteredTransactions.map(tx => (
                <div
                  key={tx.id}
                  onClick={() => setReceiptModalTx(tx)}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 transition cursor-pointer group gap-2"
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black tracking-wider ${
                          tx.type === 'RECARGA'
                            ? 'bg-blue-100 text-blue-800'
                            : tx.type === 'ASIGNACION'
                            ? 'bg-indigo-100 text-indigo-800'
                            : tx.type === 'RETIRO'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {tx.type}
                      </span>
                      <span className="font-bold text-slate-800 text-xs sm:text-sm truncate">
                        {tx.owner}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">{tx.stickerId}</span>
                    </div>
                    <p className="text-xs text-slate-500 truncate">{tx.detail}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {tx.id} • {formatDateTime(tx.timestamp)}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    {tx.type === 'ASIGNACION' ? (
                      <span className="text-[11px] font-black text-indigo-600">Cupos</span>
                    ) : (
                      <>
                        <span
                          className={`font-black text-sm sm:text-base font-mono block ${
                            tx.type === 'RECARGA' ? 'text-blue-600' : 'text-rose-600'
                          }`}
                        >
                          {tx.type === 'RECARGA' ? '+' : '-'}
                          {formatUSD(tx.usd)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono block">
                          {formatBs(tx.bs)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <TestDataCleanupModal
        isOpen={isCleanupModalOpen}
        onClose={() => setIsCleanupModalOpen(false)}
      />
    </section>
  );
};
