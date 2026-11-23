import React, { useState, useMemo, useEffect } from 'react';
import {
  ShieldAlert,
  ArrowLeft,
  Edit3,
  Building2,
  Receipt,
  KeyRound,
  Store,
  Save,
  Trash2,
  Download,
  CheckCircle2,
  Lock,
  Unlock,
  Plus,
  Search,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  Eraser,
  AlertTriangle,
  RotateCcw,
  Upload,
  Image as ImageIcon,
  X,
  Clock,
  Infinity as InfinityIcon,
  Percent,
  Briefcase,
  CreditCard,
  Palette,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { EventMode } from '../types';
import { formatUSD, formatBs, formatDateTime } from '../utils/formatters';
import { calculateGlobalProviderStats, exportProvidersCSV } from '../utils/providerStats';
import {
  compressImageFileToDataUrl,
  APP_LOGO_MAX_CHARS,
  EVENT_COVER_MAX_CHARS,
  EVENT_LOGO_MAX_CHARS,
  sanitizeImageRef,
} from '../utils/imageUtils';

const DEMO_COMPANY_IDS = new Set([
  'comp-gastro-ccs',
  'comp-oktoberfest',
  'comp-beach-club',
  'comp-corporativo-tech',
]);

const LOGO_EMOJIS = ['🍔', '🍺', '🏖️', '🎪', '🏢', '🍕', '☕', '🍩', '🎟️', '🍣', '🥩', '🍹'];

const LOGO_BG_PRESETS = [
  { hex: '#ffffff', label: 'Blanco Puro', swatchClass: 'bg-white border-slate-300' },
  { hex: '#f1f5f9', label: 'Gris Claro', swatchClass: 'bg-slate-100 border-slate-300' },
  { hex: '#dbeafe', label: 'Azul Hielo', swatchClass: 'bg-blue-100 border-blue-300' },
  { hex: '#fef3c7', label: 'Crema Ámbar', swatchClass: 'bg-amber-100 border-amber-300' },
  { hex: '#d1fae5', label: 'Menta Claro', swatchClass: 'bg-emerald-100 border-emerald-300' },
  { hex: '#0f172a', label: 'Oscuro Noche', swatchClass: 'bg-slate-900 border-slate-600' },
];

const formatTrialRemaining = (expiresAt: number, now: number): string => {
  const diffMs = Math.max(0, expiresAt - now);
  const totalMins = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours <= 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
};

export const SuperAdminDashboard: React.FC = () => {
  const {
    masterSettings,
    updateMasterSettings,
    updateGlobalCommissionRate,
    convertTrialToPermanent,
    registerCompany,
    logoutSuperAdmin,
    companies,
    allGlobalTransactions,
    exportGlobalTransactionsCSV,
    updateCompanyPinByMaster,
    updateCompanyCajaPinByMaster,
    updateProviderPinByMaster,
    deleteCompany,
    deleteCompaniesBulk,
    deleteGlobalTransactionsBulk,
    restoreDemoCompanies,
    enterCompanyAsSuperAdmin,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'TEXTS' | 'COMPANIES' | 'TRANSACTIONS' | 'PROVIDERS' | 'SECURITY'>('TEXTS');

  // Form state for Global Brand & Home screen texts
  const [appName, setAppName] = useState(masterSettings.appName);
  const [appLogo, setAppLogo] = useState(masterSettings.appLogo || '');
  const [appLogoBgColor, setAppLogoBgColor] = useState(masterSettings.appLogoBgColor || '#ffffff');
  const [appLogoUrlDraft, setAppLogoUrlDraft] = useState('');
  const [showAppLogoUrlBox, setShowAppLogoUrlBox] = useState(false);
  const [appLogoError, setAppLogoError] = useState('');
  const [isCompressingAppLogo, setIsCompressingAppLogo] = useState(false);

  const [homeTitle, setHomeTitle] = useState(masterSettings.homeTitle);
  const [homeSubtitle, setHomeSubtitle] = useState(masterSettings.homeSubtitle);
  const [homeDesc, setHomeDesc] = useState(masterSettings.homeHeroDescription);
  const [homeBanner, setHomeBanner] = useState(masterSettings.homeBannerText);
  const [textsSaved, setTextsSaved] = useState(false);

  // Global commission rate state
  const [globalCommissionDraft, setGlobalCommissionDraft] = useState(
    String(masterSettings.defaultEventCommissionRate ?? 8)
  );
  const [isApplyingCommission, setIsApplyingCommission] = useState(false);
  const [commissionSaved, setCommissionSaved] = useState(false);

  // Live ticker for 24h trial remaining labels
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // Super Admin exclusive event creation modal state
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAdminPin, setNewAdminPin] = useState('');
  const [newCajaPin, setNewCajaPin] = useState('');
  const [newEmoji, setNewEmoji] = useState('🎪');
  const [newLogoImage, setNewLogoImage] = useState('');
  const [logoUrlInput, setLogoUrlInput] = useState('');
  const [showLogoUrlField, setShowLogoUrlField] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [isCompressingLogo, setIsCompressingLogo] = useState(false);
  const [newDesc, setNewDesc] = useState('');
  const [newBcv, setNewBcv] = useState('52.40');
  const [newCommissionRate, setNewCommissionRate] = useState(
    String(masterSettings.defaultEventCommissionRate ?? 8)
  );
  const [newEventMode, setNewEventMode] = useState<EventMode>('CASHLESS');
  const [newEventDuration, setNewEventDuration] = useState<'TRIAL_24H' | 'PERMANENT'>('PERMANENT');
  const [newCoverImage, setNewCoverImage] = useState('');
  const [coverUrlInput, setCoverUrlInput] = useState('');
  const [showCoverUrlField, setShowCoverUrlField] = useState(false);
  const [coverError, setCoverError] = useState('');
  const [isCompressingCover, setIsCompressingCover] = useState(false);

  useEffect(() => {
    setAppName(masterSettings.appName);
    setAppLogo(masterSettings.appLogo || '');
    setAppLogoBgColor(masterSettings.appLogoBgColor || '#ffffff');
    setHomeTitle(masterSettings.homeTitle);
    setHomeSubtitle(masterSettings.homeSubtitle);
    setHomeDesc(masterSettings.homeHeroDescription);
    setHomeBanner(masterSettings.homeBannerText);
    setGlobalCommissionDraft(String(masterSettings.defaultEventCommissionRate ?? 8));
  }, [
    masterSettings.appName,
    masterSettings.appLogo,
    masterSettings.appLogoBgColor,
    masterSettings.homeTitle,
    masterSettings.homeSubtitle,
    masterSettings.homeHeroDescription,
    masterSettings.homeBannerText,
    masterSettings.defaultEventCommissionRate,
  ]);

  // Form state for Master PIN
  const [newMasterPin, setNewMasterPin] = useState('');
  const [masterPinSaved, setMasterPinSaved] = useState(false);

  // Search in global transactions
  const [txSearch, setTxSearch] = useState('');
  const [txFilterCompany, setTxFilterCompany] = useState('ALL');

  // Provider stats across all companies
  const [providerFilterCompany, setProviderFilterCompany] = useState('ALL');
  const [providerSearch, setProviderSearch] = useState('');
  const [expandedGlobalProvider, setExpandedGlobalProvider] = useState<string | null>(null);
  const [editingProviderKey, setEditingProviderKey] = useState<string | null>(null);
  const [editingProviderPinVal, setEditingProviderPinVal] = useState<string>('');

  // Company & Global Transaction cleanup selection states
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [companyConfirm, setCompanyConfirm] = useState<{
    title: string;
    description: string;
    action: () => Promise<void>;
  } | null>(null);
  const [singleDeleteCompanyId, setSingleDeleteCompanyId] = useState<string | null>(null);
  const [companyCleanupMsg, setCompanyCleanupMsg] = useState<string | null>(null);

  const [selectedGlobalTxKeys, setSelectedGlobalTxKeys] = useState<string[]>([]);
  const [txConfirm, setTxConfirm] = useState<{
    title: string;
    description: string;
    action: () => Promise<void>;
  } | null>(null);
  const [txCleanupMsg, setTxCleanupMsg] = useState<string | null>(null);

  const globalProviderStats = useMemo(() => {
    return calculateGlobalProviderStats(companies);
  }, [companies]);

  const filteredProviderStats = useMemo(() => {
    return globalProviderStats.filter(p => {
      const matchesCompany = providerFilterCompany === 'ALL' || p.companyId === providerFilterCompany;
      const matchesSearch = providerSearch.trim() === '' || 
        p.name.toLowerCase().includes(providerSearch.toLowerCase()) || 
        (p.companyName || '').toLowerCase().includes(providerSearch.toLowerCase());
      return matchesCompany && matchesSearch;
    });
  }, [globalProviderStats, providerFilterCompany, providerSearch]);

  // Calculate Global KPIs across all companies
  const globalRecargadoUSD = allGlobalTransactions
    .filter(t => t.type === 'RECARGA')
    .reduce((sum, t) => sum + t.usd, 0);

  const globalRecargadoBs = allGlobalTransactions
    .filter(t => t.type === 'RECARGA')
    .reduce((sum, t) => sum + t.bs, 0);

  const globalConsumidoUSD = allGlobalTransactions
    .filter(t => t.type === 'CONSUMO' || t.type === 'RETIRO')
    .reduce((sum, t) => sum + t.usd, 0);

  const globalSaldoFlotanteUSD = companies.reduce((sum, comp) => {
    return sum + comp.stickers.reduce((stSum, st) => stSum + st.balance, 0);
  }, 0);

  const globalTotalStickers = companies.reduce((sum, comp) => sum + comp.stickers.length, 0);

  const handleAppLogoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAppLogoError('');
    setIsCompressingAppLogo(true);
    try {
      const dataUrl = await compressImageFileToDataUrl(file, {
        maxWidth: 256,
        maxHeight: 256,
        maxChars: APP_LOGO_MAX_CHARS,
      });
      setAppLogo(dataUrl);
      setAppLogoUrlDraft('');
      setShowAppLogoUrlBox(false);
      updateMasterSettings({ appLogo: dataUrl });
      setTextsSaved(true);
      setTimeout(() => setTextsSaved(false), 2500);
    } catch (err) {
      setAppLogoError(err instanceof Error ? err.message : 'No se pudo procesar el logo de la app.');
    } finally {
      setIsCompressingAppLogo(false);
    }
  };

  const handleApplyAppLogoUrl = () => {
    setAppLogoError('');
    const clean = sanitizeImageRef(appLogoUrlDraft, APP_LOGO_MAX_CHARS);
    if (!clean) {
      setAppLogoError('Ingresa una URL https:// válida de imagen PNG o JPG.');
      return;
    }
    setAppLogo(clean);
    setAppLogoUrlDraft('');
    setShowAppLogoUrlBox(false);
    updateMasterSettings({ appLogo: clean });
    setTextsSaved(true);
    setTimeout(() => setTextsSaved(false), 2500);
  };

  const handleRemoveAppLogo = () => {
    setAppLogo('');
    setAppLogoError('');
    updateMasterSettings({ appLogo: '' });
    setTextsSaved(true);
    setTimeout(() => setTextsSaved(false), 2500);
  };

  const handleSaveTexts = (e: React.FormEvent) => {
    e.preventDefault();
    updateMasterSettings({
      appName: appName.trim() || masterSettings.appName,
      appLogo,
      appLogoBgColor,
      homeTitle,
      homeSubtitle,
      homeHeroDescription: homeDesc,
      homeBannerText: homeBanner,
      allowPublicCompanyRegistration: false,
    });
    setTextsSaved(true);
    setTimeout(() => setTextsSaved(false), 2500);
  };

  const handleApplyGlobalCommission = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(globalCommissionDraft);
    const validRate = Number.isFinite(parsed)
      ? Math.round(Math.min(100, Math.max(0, parsed)) * 100) / 100
      : 0;
    setIsApplyingCommission(true);
    try {
      await updateGlobalCommissionRate(validRate);
      setGlobalCommissionDraft(String(validRate));
      setCommissionSaved(true);
      setTimeout(() => setCommissionSaved(false), 3000);
    } finally {
      setIsApplyingCommission(false);
    }
  };

  const handleEventLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLogoError('');
    setIsCompressingLogo(true);
    try {
      const dataUrl = await compressImageFileToDataUrl(file, {
        maxWidth: 320,
        maxHeight: 320,
        maxChars: EVENT_LOGO_MAX_CHARS,
      });
      setNewLogoImage(dataUrl);
      setLogoUrlInput('');
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'No se pudo procesar el logo.');
    } finally {
      setIsCompressingLogo(false);
    }
  };

  const handleEventCoverFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCoverError('');
    setIsCompressingCover(true);
    try {
      const dataUrl = await compressImageFileToDataUrl(file, {
        maxWidth: 720,
        maxHeight: 405,
        maxChars: EVENT_COVER_MAX_CHARS,
      });
      setNewCoverImage(dataUrl);
      setCoverUrlInput('');
    } catch (err) {
      setCoverError(err instanceof Error ? err.message : 'No se pudo procesar la imagen.');
    } finally {
      setIsCompressingCover(false);
    }
  };

  const handleCreateEventAsSuperAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const bcvVal = parseFloat(newBcv) || 52.4;
    const commVal = Number.isFinite(parseFloat(newCommissionRate))
      ? Math.min(100, Math.max(0, parseFloat(newCommissionRate)))
      : masterSettings.defaultEventCommissionRate ?? 8;

    const sanitizedCoverUrl = coverUrlInput.trim()
      ? sanitizeImageRef(coverUrlInput, EVENT_COVER_MAX_CHARS)
      : '';
    if (coverUrlInput.trim() && !sanitizedCoverUrl) {
      setCoverError('El enlace debe comenzar con https:// o ser una imagen válida.');
      return;
    }

    const sanitizedLogoUrl = logoUrlInput.trim()
      ? sanitizeImageRef(logoUrlInput, EVENT_LOGO_MAX_CHARS)
      : '';
    if (logoUrlInput.trim() && !sanitizedLogoUrl) {
      setLogoError('El enlace del logo debe comenzar con https:// o ser una imagen válida.');
      return;
    }

    registerCompany(
      newName.trim(),
      newAdminPin.trim() || '1234',
      newCajaPin.trim() || '1111',
      newEmoji,
      newDesc.trim(),
      bcvVal,
      newEventMode,
      newCoverImage || sanitizedCoverUrl,
      newLogoImage || sanitizedLogoUrl,
      {
        isTrial24h: newEventDuration === 'TRIAL_24H',
        commissionRate: commVal,
        autoEnter: false,
      }
    );

    setShowCreateEventModal(false);
    setNewName('');
    setNewAdminPin('');
    setNewCajaPin('');
    setNewDesc('');
    setNewEventMode('CASHLESS');
    setNewEventDuration('PERMANENT');
    setNewCommissionRate(String(masterSettings.defaultEventCommissionRate ?? 8));
    setNewLogoImage('');
    setLogoUrlInput('');
    setShowLogoUrlField(false);
    setLogoError('');
    setNewCoverImage('');
    setCoverUrlInput('');
    setShowCoverUrlField(false);
    setCoverError('');
    setCompanyCleanupMsg(
      newEventDuration === 'TRIAL_24H'
        ? 'Evento de Prueba (24 horas) creado y publicado.'
        : 'Evento Permanente creado y publicado.'
    );
    setTimeout(() => setCompanyCleanupMsg(null), 4000);
  };

  const handleSaveMasterPin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newMasterPin.trim();
    if (cleaned.length >= 4) {
      updateMasterSettings({ masterPin: cleaned });
      setNewMasterPin('');
      setMasterPinSaved(true);
      setTimeout(() => setMasterPinSaved(false), 2500);
    }
  };

  // Filter global transactions
  const filteredGlobalTx = allGlobalTransactions.filter(tx => {
    const matchesCompany = txFilterCompany === 'ALL' || tx.companyId === txFilterCompany;
    const matchesSearch = txSearch.trim() === '' || 
      tx.owner.toLowerCase().includes(txSearch.toLowerCase()) || 
      (tx.companyName || '').toLowerCase().includes(txSearch.toLowerCase()) || 
      tx.id.toLowerCase().includes(txSearch.toLowerCase()) || 
      tx.detail.toLowerCase().includes(txSearch.toLowerCase());
    return matchesCompany && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500 selection:text-slate-950">
      
      {/* Top Header */}
      <header className="border-b border-amber-500/30 bg-slate-900/90 backdrop-blur-md px-4 py-3 sticky top-0 z-30 shadow-lg shadow-black/40">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shadow-inner">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-black text-lg sm:text-xl text-white tracking-tight">
                  Panel Administrador Supremo
                </h1>
                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                  Master Control
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Auditoría total de {masterSettings.appName} y marca global en todos los dispositivos
              </p>
            </div>
          </div>

          <button
            onClick={logoutSuperAdmin}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs flex items-center gap-2 border border-slate-700 transition active:scale-95 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a la Pantalla de Inicio</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto w-full px-4 py-6 sm:py-8 flex-1 space-y-6">
        
        {/* Global Financial KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-slate-900/90 rounded-3xl p-5 border border-slate-800 shadow-md">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
              Recaudación Global Caja (USD)
            </span>
            <p className="text-2xl sm:text-3xl font-black text-white font-mono">
              {formatUSD(globalRecargadoUSD)}
            </p>
            <p className="text-[11px] text-emerald-400 font-bold mt-1">
              Todas las {companies.length} empresas
            </p>
          </div>

          <div className="bg-slate-900/90 rounded-3xl p-5 border border-slate-800 shadow-md">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
              Recaudado en Bolívares
            </span>
            <p className="text-xl sm:text-2xl font-black text-amber-400 font-mono truncate">
              {formatBs(globalRecargadoBs)}
            </p>
            <p className="text-[11px] text-slate-400 font-medium mt-1">
              Tasa oficial de cada recarga
            </p>
          </div>

          <div className="bg-slate-900/90 rounded-3xl p-5 border border-slate-800 shadow-md">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
              Consumo Total Proveedores
            </span>
            <p className="text-2xl sm:text-3xl font-black text-indigo-400 font-mono">
              {formatUSD(globalConsumidoUSD)}
            </p>
            <p className="text-[11px] text-slate-400 font-medium mt-1">
              Ventas debitadas con NFC
            </p>
          </div>

          <div className="bg-slate-900/90 rounded-3xl p-5 border border-slate-800 shadow-md">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
              Saldo Flotante Global NFC
            </span>
            <p className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
              {formatUSD(globalSaldoFlotanteUSD)}
            </p>
            <p className="text-[11px] text-slate-400 font-medium mt-1">
              En {globalTotalStickers} stickers activos
            </p>
          </div>

          <div className="bg-slate-900/90 rounded-3xl p-5 border border-slate-800 shadow-md">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
              Total Empresas & Transacciones
            </span>
            <p className="text-2xl sm:text-3xl font-black text-purple-400 font-mono">
              {companies.length} emp. / {allGlobalTransactions.length} tx
            </p>
            <p className="text-[11px] text-slate-400 font-medium mt-1">
              Ecosistema completo
            </p>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex overflow-x-auto scrollbar-none gap-2 border-b border-slate-800 pb-3">
          <button
            onClick={() => setActiveSubTab('TEXTS')}
            className={`shrink-0 px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer ${
              activeSubTab === 'TEXTS'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            <span>1. Marca, Logo y Textos</span>
          </button>

          <button
            onClick={() => setActiveSubTab('COMPANIES')}
            className={`shrink-0 px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer ${
              activeSubTab === 'COMPANIES'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>2. Gestión Total de Empresas ({companies.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('TRANSACTIONS')}
            className={`shrink-0 px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer ${
              activeSubTab === 'TRANSACTIONS'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>3. Auditoría Global de Movimientos</span>
          </button>

          <button
            onClick={() => setActiveSubTab('PROVIDERS')}
            className={`shrink-0 px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer ${
              activeSubTab === 'PROVIDERS'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <Store className="w-4 h-4" />
            <span>4. Ventas por Proveedor ($ y Bs)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('SECURITY')}
            className={`shrink-0 px-4 py-2.5 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer ${
              activeSubTab === 'SECURITY'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>5. Clave Maestra Supremo</span>
          </button>
        </div>

        {/* TAB 1: MARCA, LOGO GLOBAL, COMISIÓN Y TEXTOS DE INICIO */}
        {activeSubTab === 'TEXTS' && (
          <div className="space-y-6 max-w-3xl">
          <div className="bg-slate-900/90 rounded-3xl p-5 sm:p-8 border border-slate-800 shadow-xl space-y-6">
            <div>
              <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-400" />
                <span>Nombre, Logo, Fondo y Textos Globales de la App</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Como Administrador Supremo, personaliza el nombre oficial, el logo PNG, su color de fondo y los textos de inicio. También actualiza la app al instalarla desde el navegador.
              </p>
            </div>

            <form onSubmit={handleSaveTexts} className="space-y-5">
              {/* Live Brand Identity Preview & Editor */}
              <div
                ref={el => {
                  if (el) el.style.setProperty('--preview-logo-bg', appLogoBgColor);
                }}
                className="p-4 sm:p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">
                    Vista Previa en Barra Superior e Ícono de App (Todos los dispositivos)
                  </span>
                </div>

                {/* Live Navbar Preview */}
                <div className="p-3 rounded-2xl bg-slate-900 border border-slate-700/80 flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-[var(--preview-logo-bg,#ffffff)] border border-white/25 flex items-center justify-center shrink-0 overflow-hidden p-1 shadow-md">
                    <img
                      src={appLogo || '/app-logo.png'}
                      alt={appName || 'Logo App'}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-base text-white truncate">
                        {appName.trim() || masterSettings.appName}
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full shrink-0">
                        Multi-Empresa
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">
                      {homeBanner || masterSettings.homeBannerText}
                    </p>
                  </div>
                </div>

                {/* App Name Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Nombre Oficial de la App (inicio e ícono descargado)
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={120}
                    value={appName}
                    onChange={e => setAppName(e.target.value)}
                    placeholder="Ej: Mi Marca Cashless NFC"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm font-black text-white focus:outline-none focus:ring-2 ring-amber-500"
                  />
                </div>

                {/* App Logo PNG / JPG Uploader */}
                <div className="space-y-2.5">
                  <label className="block text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                    <span>Logo de la App (PNG con fondo transparente o JPG)</span>
                  </label>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-[var(--preview-logo-bg,#ffffff)] border border-slate-600 flex items-center justify-center overflow-hidden p-1.5 shrink-0 shadow-inner">
                      <img
                        src={appLogo || '/app-logo.png'}
                        alt="Logo actual"
                        className="w-full h-full object-contain"
                      />
                    </div>

                    <div className="flex-1 min-w-[200px] space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer transition active:scale-95">
                          <Upload className="w-3.5 h-3.5" />
                          <span>
                            {isCompressingAppLogo
                              ? 'Procesando PNG...'
                              : appLogo
                              ? 'Cambiar Logo PNG / JPG'
                              : 'Subir Logo PNG / JPG'}
                          </span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp"
                            onChange={handleAppLogoFileUpload}
                            disabled={isCompressingAppLogo}
                            className="hidden"
                          />
                        </label>

                        {appLogo && (
                          <button
                            type="button"
                            onClick={handleRemoveAppLogo}
                            className="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 font-bold text-xs flex items-center gap-1 cursor-pointer transition"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Quitar Logo</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setShowAppLogoUrlBox(prev => !prev)}
                          className="text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer"
                        >
                          {showAppLogoUrlBox ? 'Ocultar campo URL' : 'O pegar enlace URL https://'}
                        </button>
                        <span className="text-slate-500">
                          Se sincroniza al instante en PC, teléfonos y descarga PWA
                        </span>
                      </div>
                    </div>
                  </div>

                  {showAppLogoUrlBox && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <input
                        type="url"
                        value={appLogoUrlDraft}
                        onChange={e => {
                          setAppLogoUrlDraft(e.target.value);
                          setAppLogoError('');
                        }}
                        placeholder="https://ejemplo.com/mi-logo.png"
                        className="flex-1 min-w-[200px] bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 ring-amber-500"
                      />
                      <button
                        type="button"
                        onClick={handleApplyAppLogoUrl}
                        className="px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs cursor-pointer"
                      >
                        Aplicar URL
                      </button>
                    </div>
                  )}

                  {appLogoError && (
                    <p className="text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 px-3 py-2 rounded-xl">
                      {appLogoError}
                    </p>
                  )}
                </div>

                {/* App Logo Background Color Picker (so dark PNG logos stand out on home & launcher icon) */}
                <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-amber-400" />
                      <span>Color de Fondo del Logo PNG (Inicio e Ícono Descargado)</span>
                    </label>
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {appLogoBgColor.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {LOGO_BG_PRESETS.map(preset => {
                      const active = appLogoBgColor.toLowerCase() === preset.hex.toLowerCase();
                      return (
                        <button
                          key={preset.hex}
                          type="button"
                          onClick={() => setAppLogoBgColor(preset.hex)}
                          title={preset.label}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition cursor-pointer ${
                            active
                              ? 'border-amber-400 bg-amber-500/15 text-white ring-2 ring-amber-400/30'
                              : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
                          }`}
                        >
                          <span className={`w-4 h-4 rounded-full border shrink-0 ${preset.swatchClass}`} />
                          <span>{preset.label}</span>
                        </button>
                      );
                    })}

                    <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-700 bg-slate-900 hover:border-amber-400 text-[11px] font-bold text-slate-300 cursor-pointer">
                      <input
                        type="color"
                        value={appLogoBgColor}
                        onChange={e => setAppLogoBgColor(e.target.value)}
                        className="w-5 h-5 rounded border-0 bg-transparent cursor-pointer p-0"
                      />
                      <span>Otro Color</span>
                    </label>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Ideal si tu logo PNG es azul oscuro u otro tono oscuro: el fondo claro lo hace resaltar en la pantalla de inicio y al instalar la app en tu teléfono.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Título Principal (Hero Heading)
                </label>
                <input
                  type="text"
                  required
                  value={homeTitle}
                  onChange={e => setHomeTitle(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Subtítulo / Tagline Superior
                </label>
                <input
                  type="text"
                  required
                  value={homeSubtitle}
                  onChange={e => setHomeSubtitle(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-white focus:outline-none focus:ring-2 ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Descripción Detallada del Hero
                </label>
                <textarea
                  rows={3}
                  required
                  value={homeDesc}
                  onChange={e => setHomeDesc(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:ring-2 ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Texto del Banner Superior (Debajo del nombre)
                </label>
                <input
                  type="text"
                  required
                  value={homeBanner}
                  onChange={e => setHomeBanner(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:ring-2 ring-amber-500"
                />
              </div>

              <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  La creación de nuevos eventos está restringida exclusivamente al <strong>Administrador Supremo</strong> (Pestaña 2: Gestión Total de Empresas).
                </span>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar Marca, Fondo y Textos</span>
                </button>

                {textsSaved && (
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>¡Nombre, logo, fondo y textos actualizados en todos los dispositivos!</span>
                  </span>
                )}
              </div>
            </form>
          </div>

          {/* Global App Commission Card (% Ganancia de la App por Evento) */}
          <div className="bg-slate-900/90 rounded-3xl p-5 sm:p-8 border border-emerald-500/30 shadow-xl space-y-4">
            <div>
              <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                <Percent className="w-5 h-5 text-emerald-400" />
                <span>% de Ganancia de la App por Evento (Comisión Global)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Modifica aquí el porcentaje que le corresponde a tu app por las ventas de cada evento. Al aplicarlo, se actualiza automáticamente en <strong>todos los {companies.length} eventos activos</strong> y será el predeterminado para futuros eventos.
              </p>
            </div>

            <form onSubmit={handleApplyGlobalCommission} className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-40">
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Porcentaje (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      required
                      value={globalCommissionDraft}
                      onChange={e => setGlobalCommissionDraft(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-4 pr-8 py-3 text-lg font-black text-emerald-400 font-mono focus:outline-none focus:ring-2 ring-emerald-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-black">%</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 pb-1">
                  {[5, 8, 10, 12, 15, 20].map(pct => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setGlobalCommissionDraft(String(pct))}
                      className={`px-3 py-2 rounded-xl text-xs font-black border transition cursor-pointer ${
                        Number(globalCommissionDraft) === pct
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={isApplyingCommission}
                  className="px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer transition"
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {isApplyingCommission
                      ? 'Actualizando todos los eventos...'
                      : `Aplicar ${globalCommissionDraft || 0}% a Todos los Eventos (${companies.length})`}
                  </span>
                </button>

                {commissionSaved && (
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>¡Comisión actualizada en todos los eventos!</span>
                  </span>
                )}
              </div>
            </form>
          </div>
          </div>
        )}

        {/* TAB 2: GESTIÓN TOTAL DE EMPRESAS */}
        {activeSubTab === 'COMPANIES' && (() => {
          const selectedCompSet = new Set(selectedCompanyIds.filter(id => companies.some(c => c.id === id)));
          const unselectedCompIds = companies.filter(c => !selectedCompSet.has(c.id)).map(c => c.id);
          const presentDemoIds = companies.filter(c => DEMO_COMPANY_IDS.has(c.id)).map(c => c.id);

          const notifyCompanyCleanup = (msg: string) => {
            setCompanyCleanupMsg(msg);
            setTimeout(() => setCompanyCleanupMsg(null), 3500);
          };

          return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-black text-white tracking-tight">
                  Empresas y Eventos ({companies.length})
                </h3>
                <p className="text-xs text-slate-400">
                  Crea eventos de Prueba (24h) o Permanentes, asigna claves o haz auditoría directa.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setNewCommissionRate(String(masterSettings.defaultEventCommissionRate ?? 8));
                    setShowCreateEventModal(true);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer transition active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Crear Evento / Empresa</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    await restoreDemoCompanies();
                    notifyCompanyCleanup('Empresas demo restauradas/sincronizadas.');
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Restaurar Demos</span>
                </button>
              </div>
            </div>

            {companyCleanupMsg && (
              <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{companyCleanupMsg}</span>
              </div>
            )}

            {/* Bulk / Selective Demo & Test Cleanup Toolbar */}
            {companies.length > 0 && (
              <div className="p-4 rounded-2xl bg-slate-900 border border-rose-500/30 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Eraser className="w-4 h-4 text-rose-400" />
                    <span className="text-xs font-black uppercase tracking-wider text-rose-300">
                      Limpieza de Empresas / Pruebas ({selectedCompSet.size} seleccionadas)
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setCompanyConfirm(null);
                        setSelectedCompanyIds(companies.map(c => c.id));
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold cursor-pointer"
                    >
                      Marcar Todas
                    </button>
                    {presentDemoIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setCompanyConfirm(null);
                          setSelectedCompanyIds(presentDemoIds);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[11px] font-bold cursor-pointer"
                      >
                        Solo Empresas Demo ({presentDemoIds.length})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setCompanyConfirm(null);
                        setSelectedCompanyIds(unselectedCompIds);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold cursor-pointer"
                    >
                      Invertir
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCompanyConfirm(null);
                        setSelectedCompanyIds([]);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-[11px] font-bold cursor-pointer"
                    >
                      Ninguna
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={selectedCompSet.size === 0}
                    onClick={() => {
                      const ids = Array.from(selectedCompSet);
                      setCompanyConfirm({
                        title: `¿Borrar ${ids.length} empresa(s) seleccionada(s)?`,
                        description: 'Se eliminarán de la plataforma y Firestore junto con todos sus clientes, productos y movimientos.',
                        action: async () => {
                          await deleteCompaniesBulk(ids);
                          setSelectedCompanyIds([]);
                          setCompanyConfirm(null);
                          notifyCompanyCleanup(`Se eliminaron ${ids.length} empresa(s).`);
                        },
                      });
                    }}
                    className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-black text-xs cursor-pointer disabled:cursor-not-allowed transition"
                  >
                    Borrar Seleccionadas ({selectedCompSet.size})
                  </button>

                  <button
                    type="button"
                    disabled={selectedCompSet.size === 0 || unselectedCompIds.length === 0}
                    onClick={() => {
                      const toDelete = [...unselectedCompIds];
                      setCompanyConfirm({
                        title: `¿Dejar solo ${selectedCompSet.size} empresa(s) y borrar las otras ${toDelete.length}?`,
                        description: 'Solo permanecerán las empresas marcadas; el resto se borrará por completo.',
                        action: async () => {
                          await deleteCompaniesBulk(toDelete);
                          setCompanyConfirm(null);
                          notifyCompanyCleanup(`Se conservaron ${selectedCompSet.size} y se eliminaron ${toDelete.length} empresa(s).`);
                        },
                      });
                    }}
                    className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-black text-xs cursor-pointer disabled:cursor-not-allowed transition"
                  >
                    Dejar Solo Marcadas (Borrar {unselectedCompIds.length})
                  </button>

                  {presentDemoIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setCompanyConfirm({
                          title: `¿Borrar TODAS las ${presentDemoIds.length} empresas Demo?`,
                          description: 'Se eliminarán las empresas de demostración precargadas y no volverán a aparecer al recargar (salvo que uses "Restaurar Empresas Demo").',
                          action: async () => {
                            await deleteCompaniesBulk(presentDemoIds);
                            setSelectedCompanyIds(prev => prev.filter(id => !DEMO_COMPANY_IDS.has(id)));
                            setCompanyConfirm(null);
                            notifyCompanyCleanup(`Se eliminaron las ${presentDemoIds.length} empresas Demo.`);
                          },
                        })
                      }
                      className="px-3.5 py-2 rounded-xl bg-rose-950 hover:bg-rose-900 border border-rose-500/40 text-rose-200 font-black text-xs cursor-pointer transition"
                    >
                      Borrar TODAS las Demo ({presentDemoIds.length})
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const allIds = companies.map(c => c.id);
                      setCompanyConfirm({
                        title: `¿Borrar TODAS las ${allIds.length} empresas de la plataforma?`,
                        description: 'Dejará la plataforma completamente vacía y lista para registrar tus empresas reales desde cero.',
                        action: async () => {
                          await deleteCompaniesBulk(allIds);
                          setSelectedCompanyIds([]);
                          setCompanyConfirm(null);
                          notifyCompanyCleanup('Plataforma limpiada por completo.');
                        },
                      });
                    }}
                    className="px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-rose-700 border border-slate-700 text-rose-400 hover:text-white font-black text-xs cursor-pointer transition"
                  >
                    Borrar Todas ({companies.length})
                  </button>
                </div>

                {companyConfirm && (
                  <div className="p-3.5 rounded-xl bg-rose-600 text-white space-y-2 animate-in fade-in duration-150">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-300" />
                      <div>
                        <p className="font-black text-xs">{companyConfirm.title}</p>
                        <p className="text-[11px] text-rose-100 mt-0.5">{companyConfirm.description}</p>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setCompanyConfirm(null)}
                        className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white font-bold text-[11px] cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => void companyConfirm.action()}
                        className="px-3.5 py-1.5 rounded-lg bg-white text-rose-700 hover:bg-rose-50 font-black text-[11px] cursor-pointer"
                      >
                        Sí, Borrar Ahora
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {companies.length === 0 ? (
              <div className="p-10 rounded-3xl bg-slate-900 border border-dashed border-slate-700 text-center space-y-3">
                <Building2 className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="font-black text-white text-base">No hay empresas o eventos activos</p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Solo el Administrador Supremo puede crear eventos nuevos. Usa el botón de abajo para crear un evento de prueba (24h) o permanente.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setNewCommissionRate(String(masterSettings.defaultEventCommissionRate ?? 8));
                    setShowCreateEventModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs cursor-pointer transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Crear Primer Evento</span>
                </button>
              </div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {companies.map(comp => {
                const compFloating = comp.stickers.reduce((s, st) => s + st.balance, 0);
                const isSelected = selectedCompSet.has(comp.id);
                const isDemo = DEMO_COMPANY_IDS.has(comp.id);
                return (
                  <div
                    key={comp.id}
                    className={`bg-slate-900 rounded-3xl p-5 border shadow-xl space-y-4 flex flex-col justify-between transition ${
                      isSelected ? 'border-rose-500 ring-2 ring-rose-500/30' : 'border-slate-800'
                    }`}
                  >
                    <div>
                      {comp.coverImage && (
                        <div className="h-24 w-full rounded-2xl overflow-hidden border border-slate-800 mb-3 bg-slate-950">
                          <img
                            src={comp.coverImage}
                            alt={comp.name}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <button
                            type="button"
                            onClick={() => {
                              setCompanyConfirm(null);
                              setSelectedCompanyIds(prev =>
                                prev.includes(comp.id)
                                  ? prev.filter(x => x !== comp.id)
                                  : [...prev, comp.id]
                              );
                            }}
                            className="mt-1 text-slate-400 hover:text-white cursor-pointer shrink-0"
                            title="Seleccionar empresa para limpieza"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-rose-400" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                          <span className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 shrink-0 flex items-center justify-center text-3xl overflow-hidden">
                            {comp.logoImage ? (
                              <img
                                src={comp.logoImage}
                                alt={`Logo ${comp.name}`}
                                loading="lazy"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              comp.logoEmoji
                            )}
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <h4 className="font-black text-white text-base leading-snug">
                                {comp.name}
                              </h4>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                                  comp.eventMode === 'CORPORATE'
                                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                                    : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                                }`}
                              >
                                {comp.eventMode === 'CORPORATE' ? 'Corporativo' : 'Cashless'}
                              </span>
                               {comp.isTrial24h && comp.expiresAt && comp.expiresAt > 0 ? (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5" />
                                  <span>Prueba 24h • {formatTrialRemaining(comp.expiresAt, nowMs)}</span>
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 inline-flex items-center gap-1">
                                  <InfinityIcon className="w-2.5 h-2.5" />
                                  <span>Permanente</span>
                                </span>
                              )}
                              {isDemo && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  Demo
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 font-mono mt-0.5">
                              <span>ID: {comp.id}</span>
                              <span className="text-emerald-400 font-bold">
                                • Comisión App: {comp.settings.eventCommissionRate ?? 0}%
                              </span>
                            </div>
                          </div>
                        </div>

                        {singleDeleteCompanyId === comp.id ? (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                deleteCompany(comp.id);
                                setSingleDeleteCompanyId(null);
                              }}
                              className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-[10px] cursor-pointer"
                            >
                              Borrar
                            </button>
                            <button
                              type="button"
                              onClick={() => setSingleDeleteCompanyId(null)}
                              className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 font-bold text-[10px] cursor-pointer"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSingleDeleteCompanyId(comp.id)}
                            className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer shrink-0"
                            title="Eliminar empresa"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {comp.isTrial24h && (
                        <button
                          type="button"
                          onClick={() => {
                            convertTrialToPermanent(comp.id);
                            notifyCompanyCleanup(`"${comp.name}" ahora es un evento Permanente.`);
                          }}
                          className="w-full mb-3 py-1.5 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/35 font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition"
                        >
                          <InfinityIcon className="w-3.5 h-3.5" />
                          <span>Convertir a Permanente (sin expiración)</span>
                        </button>
                      )}

                      <div className="grid grid-cols-3 gap-2 bg-slate-950 p-2.5 rounded-2xl border border-slate-800/80 text-center text-xs mb-3">
                        <div>
                          <span className="text-[10px] text-slate-500 font-bold block">Stickers</span>
                          <span className="font-bold text-white font-mono">{comp.stickers.length}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 font-bold block">Productos</span>
                          <span className="font-bold text-white font-mono">{comp.products.length}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 font-bold block">Saldo Flot.</span>
                          <span className="font-bold text-emerald-400 font-mono">{formatUSD(compFloating)}</span>
                        </div>
                      </div>

                      {/* Secret PINs management by Master (Admin, Caja, Proveedores) */}
                      <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 space-y-2.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 font-semibold flex items-center gap-1">
                            <Lock className="w-3.5 h-3.5 text-amber-400" />
                            <span>PIN Admin:</span>
                          </span>
                          <span className="font-mono font-black text-amber-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-700 tracking-widest">
                            {comp.adminPin}
                          </span>
                        </div>

                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            maxLength={8}
                            placeholder="Nuevo PIN Admin..."
                            id={`pin-input-${comp.id}`}
                            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1 text-xs text-white font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const el = document.getElementById(`pin-input-${comp.id}`) as HTMLInputElement;
                              if (el && el.value.trim().length >= 4) {
                                updateCompanyPinByMaster(comp.id, el.value.trim());
                                el.value = '';
                              }
                            }}
                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl cursor-pointer"
                          >
                            Asignar
                          </button>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/80">
                          <span className="text-slate-400 font-semibold flex items-center gap-1">
                            <Lock className="w-3.5 h-3.5 text-emerald-400" />
                            <span>PIN Caja:</span>
                          </span>
                          <span className="font-mono font-black text-emerald-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-700 tracking-widest">
                            {comp.cajaPin || '1111'}
                          </span>
                        </div>

                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            maxLength={8}
                            placeholder="Nuevo PIN Caja..."
                            id={`caja-pin-input-${comp.id}`}
                            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1 text-xs text-white font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const el = document.getElementById(`caja-pin-input-${comp.id}`) as HTMLInputElement;
                              if (el && el.value.trim().length >= 4) {
                                updateCompanyCajaPinByMaster(comp.id, el.value.trim());
                                el.value = '';
                              }
                            }}
                            className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl cursor-pointer"
                          >
                            Asignar
                          </button>
                        </div>

                        {comp.providers && comp.providers.length > 0 && (
                          <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                              PINs de Proveedores ({comp.providers.length}):
                            </span>
                            <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                              {comp.providers.map(prov => {
                                const rowKey = `${comp.id}:${prov.id}`;
                                const isEditing = editingProviderKey === rowKey;
                                return (
                                  <div key={prov.id} className="bg-slate-900/80 px-2 py-1.5 rounded-lg border border-slate-800 space-y-1">
                                    <div className="flex items-center justify-between gap-1.5 text-[11px]">
                                      <span className="truncate text-slate-300 font-semibold">
                                        {prov.emoji} {prov.brandName}
                                      </span>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <span className="font-mono font-bold text-blue-300">{prov.pin}</span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (isEditing) {
                                              setEditingProviderKey(null);
                                            } else {
                                              setEditingProviderKey(rowKey);
                                              setEditingProviderPinVal(prov.pin);
                                            }
                                          }}
                                          className="text-[10px] text-amber-400 hover:underline cursor-pointer"
                                        >
                                          {isEditing ? 'Cerrar' : 'Editar'}
                                        </button>
                                      </div>
                                    </div>
                                    {isEditing && (
                                      <div className="flex gap-1">
                                        <input
                                          type="text"
                                          maxLength={8}
                                          value={editingProviderPinVal}
                                          onChange={e => setEditingProviderPinVal(e.target.value.replace(/\D/g, ''))}
                                          className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-[11px] font-mono text-white"
                                        />
                                        <button
                                          type="button"
                                          disabled={editingProviderPinVal.length < 4}
                                          onClick={() => {
                                            updateProviderPinByMaster(comp.id, prov.id, editingProviderPinVal);
                                            setEditingProviderKey(null);
                                          }}
                                          className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold text-[10px] cursor-pointer disabled:opacity-40"
                                        >
                                          Guardar
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Master bypass login */}
                    <button
                      onClick={() => enterCompanyAsSuperAdmin(comp.id)}
                      className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition active:scale-95"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      <span>Ingresar con Acceso Total (Bypass)</span>
                    </button>
                  </div>
                );
              })}
            </div>
            )}
          </div>
          );
        })()}

        {/* TAB 3: AUDITORÍA GLOBAL DE MOVIMIENTOS */}
        {activeSubTab === 'TRANSACTIONS' && (() => {
          const txKey = (t: { companyId?: string; id: string }) => `${t.companyId || ''}::${t.id}`;
          const validFilteredKeys = new Set(filteredGlobalTx.map(txKey));
          const selectedTxSet = new Set(selectedGlobalTxKeys.filter(k => validFilteredKeys.has(k)));
          const selectedTxItems = filteredGlobalTx
            .filter(t => selectedTxSet.has(txKey(t)) && t.companyId)
            .map(t => ({ companyId: t.companyId!, id: t.id }));
          const unselectedTxItems = filteredGlobalTx
            .filter(t => !selectedTxSet.has(txKey(t)) && t.companyId)
            .map(t => ({ companyId: t.companyId!, id: t.id }));

          const notifyTxCleanup = (msg: string) => {
            setTxCleanupMsg(msg);
            setTimeout(() => setTxCleanupMsg(null), 3500);
          };

          return (
          <div className="bg-slate-900/90 rounded-3xl p-6 border border-slate-800 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-black text-white tracking-tight">
                  Auditoría General de Todas las Empresas
                </h3>
                <p className="text-xs text-slate-400">
                  {allGlobalTransactions.length} transacciones registradas en toda la plataforma.
                </p>
              </div>

              <button
                onClick={exportGlobalTransactionsCSV}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow cursor-pointer transition"
              >
                <Download className="w-4 h-4" />
                <span>Exportar Consolidado Global (CSV)</span>
              </button>
            </div>

            {txCleanupMsg && (
              <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{txCleanupMsg}</span>
              </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[200px] relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por cliente, ID de sticker o detalle..."
                  value={txSearch}
                  onChange={e => setTxSearch(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:ring-2 ring-amber-500"
                />
              </div>

              <select
                value={txFilterCompany}
                onChange={e => setTxFilterCompany(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:ring-2 ring-amber-500 cursor-pointer"
              >
                <option value="ALL">🌐 Todas las Empresas</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.logoEmoji} {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Bulk / Selective Transaction Cleanup Toolbar */}
            {filteredGlobalTx.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Limpieza de Movimientos ({selectedTxItems.length} de {filteredGlobalTx.length} marcados)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setTxConfirm(null);
                        setSelectedGlobalTxKeys(filteredGlobalTx.map(txKey));
                      }}
                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold cursor-pointer"
                    >
                      Marcar Visibles
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTxConfirm(null);
                        setSelectedGlobalTxKeys(
                          filteredGlobalTx.filter(t => !selectedTxSet.has(txKey(t))).map(txKey)
                        );
                      }}
                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold cursor-pointer"
                    >
                      Invertir
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTxConfirm(null);
                        setSelectedGlobalTxKeys([]);
                      }}
                      className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-[11px] font-bold cursor-pointer"
                    >
                      Ninguno
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={selectedTxItems.length === 0}
                    onClick={() =>
                      setTxConfirm({
                        title: `¿Borrar ${selectedTxItems.length} movimiento(s) marcados?`,
                        description: 'Se eliminarán permanentemente del historial y de Firestore.',
                        action: async () => {
                          await deleteGlobalTransactionsBulk(selectedTxItems);
                          setSelectedGlobalTxKeys([]);
                          setTxConfirm(null);
                          notifyTxCleanup(`Se eliminaron ${selectedTxItems.length} movimiento(s).`);
                        },
                      })
                    }
                    className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-black text-xs cursor-pointer disabled:cursor-not-allowed"
                  >
                    Borrar Marcados ({selectedTxItems.length})
                  </button>

                  <button
                    type="button"
                    disabled={selectedTxItems.length === 0 || unselectedTxItems.length === 0}
                    onClick={() =>
                      setTxConfirm({
                        title: `¿Dejar solo ${selectedTxItems.length} movimiento(s) y borrar ${unselectedTxItems.length}?`,
                        description: 'Se eliminarán los movimientos visibles no marcados.',
                        action: async () => {
                          await deleteGlobalTransactionsBulk(unselectedTxItems);
                          setTxConfirm(null);
                          notifyTxCleanup(`Se conservaron ${selectedTxItems.length} y se borraron ${unselectedTxItems.length} movimiento(s).`);
                        },
                      })
                    }
                    className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-black text-xs cursor-pointer disabled:cursor-not-allowed"
                  >
                    Dejar Solo Marcados (Borrar {unselectedTxItems.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const allVisible = filteredGlobalTx
                        .filter(t => t.companyId)
                        .map(t => ({ companyId: t.companyId!, id: t.id }));
                      setTxConfirm({
                        title: `¿Borrar TODOS los ${allVisible.length} movimientos visibles?`,
                        description: 'Se vaciará el historial de transacciones filtrado.',
                        action: async () => {
                          await deleteGlobalTransactionsBulk(allVisible);
                          setSelectedGlobalTxKeys([]);
                          setTxConfirm(null);
                          notifyTxCleanup(`Se borraron ${allVisible.length} movimiento(s).`);
                        },
                      });
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-rose-700 border border-slate-700 text-rose-400 hover:text-white font-black text-xs cursor-pointer"
                  >
                    Borrar Todos Visibles ({filteredGlobalTx.length})
                  </button>
                </div>

                {txConfirm && (
                  <div className="p-3 rounded-xl bg-rose-600 text-white space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-300" />
                      <div>
                        <p className="font-black text-xs">{txConfirm.title}</p>
                        <p className="text-[11px] text-rose-100">{txConfirm.description}</p>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setTxConfirm(null)}
                        className="px-3 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white font-bold text-[11px] cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => void txConfirm.action()}
                        className="px-3 py-1 rounded-lg bg-white text-rose-700 font-black text-[11px] cursor-pointer"
                      >
                        Sí, Borrar Ahora
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Table */}
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {filteredGlobalTx.map(tx => {
                const key = txKey(tx);
                const checked = selectedTxSet.has(key);
                return (
                <div
                  key={key}
                  onClick={() => {
                    setTxConfirm(null);
                    setSelectedGlobalTxKeys(prev =>
                      prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key]
                    );
                  }}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border text-xs cursor-pointer transition ${
                    checked
                      ? 'bg-rose-950/40 border-rose-500/50'
                      : 'bg-slate-950/80 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0 pr-2">
                    <span className="mt-0.5 text-slate-500 shrink-0">
                      {checked ? (
                        <CheckSquare className="w-4 h-4 text-rose-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-slate-800 text-amber-400 border border-slate-700">
                          {tx.companyName || 'Empresa'}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black ${
                            tx.type === 'RECARGA'
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              : tx.type === 'ASIGNACION'
                              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                              : tx.type === 'RETIRO'
                              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {tx.type}
                        </span>
                        <span className="font-bold text-white truncate">{tx.owner}</span>
                        <span className="text-[10px] font-mono text-slate-500">{tx.stickerId}</span>
                      </div>
                      <p className="text-slate-400 truncate">{tx.detail}</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {tx.id} • {formatDateTime(tx.timestamp)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {tx.type === 'ASIGNACION' ? (
                      <span className="font-black text-xs font-mono text-indigo-300 block">
                        Cupos Activos
                      </span>
                    ) : (
                      <>
                        <span
                          className={`font-black text-sm sm:text-base font-mono block ${
                            tx.type === 'RECARGA'
                              ? 'text-blue-400'
                              : tx.type === 'RETIRO'
                              ? 'text-teal-300'
                              : 'text-rose-400'
                          }`}
                        >
                          {tx.type === 'RECARGA' ? '+' : '-'}{formatUSD(tx.usd)}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono block">
                          {formatBs(tx.bs)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          </div>
          );
        })()}

        {/* TAB 4: RENDIMIENTO GLOBAL DE PROVEEDORES Y STANDS ($ USD Y BOLÍVARES) */}
        {activeSubTab === 'PROVIDERS' && (
          <div className="bg-slate-900/90 rounded-3xl p-6 border border-slate-800 shadow-xl space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                    <Store className="w-4 h-4" />
                  </div>
                  <h3 className="text-xl font-black text-white tracking-tight">
                    Rendimiento Global de Proveedores & Stands
                  </h3>
                </div>
                <p className="text-xs text-slate-400">
                  Consolidado financiero detallado de cuánto generó cada stand en toda la plataforma, tanto en <strong>Dólares ($ USD)</strong> como en <strong>Bolívares (Bs.)</strong>.
                </p>
              </div>

              <button
                onClick={() => exportProvidersCSV(filteredProviderStats, 'reporte_global_proveedores.csv', true)}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-2 shadow-md transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Exportar Liquidación Global (CSV)</span>
              </button>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap gap-3">
              <div className="flex-1 min-w-[200px] relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar proveedor o empresa..."
                  value={providerSearch}
                  onChange={e => setProviderSearch(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:ring-2 ring-amber-500"
                />
              </div>

              <select
                value={providerFilterCompany}
                onChange={e => setProviderFilterCompany(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:ring-2 ring-amber-500 cursor-pointer"
              >
                <option value="ALL">🌐 Todas las Empresas ({companies.length})</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.logoEmoji} {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Global Providers List */}
            <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
              {filteredProviderStats.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <Store className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                  <p className="font-bold text-sm text-slate-400">No se encontraron proveedores</p>
                  <p className="text-xs text-slate-500">Ajusta el filtro de búsqueda para ver resultados.</p>
                </div>
              ) : (
                filteredProviderStats.map(stat => {
                  const isExpanded = expandedGlobalProvider === `${stat.companyId}-${stat.name}`;
                  return (
                    <div
                      key={`${stat.companyId}-${stat.name}`}
                      className="p-4 rounded-2xl bg-slate-950/80 hover:bg-slate-950 border border-slate-800/80 transition-all duration-200"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-slate-850 border border-slate-700 flex items-center justify-center text-xl shadow-xs">
                            🏪
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-black text-white text-base leading-tight">
                                {stat.name}
                              </h4>
                              {stat.companyName && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                  {stat.companyName}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 font-semibold block mt-0.5">
                              {stat.salesCount} ventas procesadas • {stat.percentageOfTotal}% del volumen global
                            </span>
                          </div>
                        </div>

                        {/* Revenue in USD and Bs */}
                        <div className="text-right">
                          <div className="flex items-baseline justify-end gap-1.5">
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Total Generado:</span>
                            <span className="text-2xl font-black text-emerald-400 font-mono">
                              {formatUSD(stat.totalUSD)}
                            </span>
                          </div>
                          <span className="text-sm font-black text-amber-400 font-mono block">
                            {formatBs(stat.totalBs)}
                          </span>
                        </div>
                      </div>

                      {/* Percentage Bar */}
                      <div className="mt-3 w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(stat.percentageOfTotal, 3)}%` }}
                        />
                      </div>

                      {/* Financial Detail Grid */}
                      <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                        <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                          <span className="text-[10px] text-slate-400 font-bold block">Comisión Organizador</span>
                          <span className="font-bold text-purple-400 font-mono">{formatUSD(stat.commissionUSD)}</span>
                          <span className="text-[10px] text-slate-500 block font-mono">({formatBs(stat.commissionBs)})</span>
                        </div>

                        <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                          <span className="text-[10px] text-slate-400 font-bold block">Neto Proveedor (USD)</span>
                          <span className="font-black text-emerald-400 font-mono text-sm">{formatUSD(stat.netUSD)}</span>
                        </div>

                        <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 col-span-2 sm:col-span-1">
                          <span className="text-[10px] text-slate-400 font-bold block">Neto Proveedor (Bolívares)</span>
                          <span className="font-black text-amber-400 font-mono text-xs">{formatBs(stat.netBs)}</span>
                        </div>
                      </div>

                      {/* Items sold toggle if items exist */}
                      {stat.itemsBreakdown.length > 0 && (
                        <div className="mt-2 text-right">
                          <button
                            type="button"
                            onClick={() => setExpandedGlobalProvider(isExpanded ? null : `${stat.companyId}-${stat.name}`)}
                            className="text-[11px] font-bold text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span>{isExpanded ? 'Ocultar Artículos' : `Ver ${stat.itemsBreakdown.length} Artículos Vendidos`}</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>

                          {isExpanded && (
                            <div className="mt-2 p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-1.5 text-left text-xs animate-in fade-in duration-150">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                                Detalle de ventas por producto:
                              </span>
                              {stat.itemsBreakdown.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between py-1 border-b border-slate-800 last:border-none">
                                  <span className="flex items-center gap-1.5 font-medium text-slate-300">
                                    <span>{item.emoji}</span>
                                    <span>{item.qty}x {item.name}</span>
                                  </span>
                                  <div className="text-right font-mono">
                                    <span className="font-bold text-white">{formatUSD(item.revenueUSD)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 5: CLAVE MAESTRA DEL ADMIN SUPREMO */}
        {activeSubTab === 'SECURITY' && (
          <div className="bg-slate-900/90 rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-xl max-w-md space-y-4">
            <div>
              <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <span>Clave Maestra del Admin Supremo</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Esta clave es el PIN maestro que da acceso a este panel de control superior.
              </p>
            </div>

            <form onSubmit={handleSaveMasterPin} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Nuevo PIN Maestro (4 a 6 dígitos):
                </label>
                <input
                  type="password"
                  maxLength={6}
                  placeholder="Ej. 9999"
                  value={newMasterPin}
                  onChange={e => setNewMasterPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-lg font-black text-amber-400 font-mono tracking-widest focus:outline-none focus:ring-2 ring-amber-500 text-center"
                />
              </div>

              <button
                type="submit"
                disabled={newMasterPin.length < 4}
                className={`w-full py-3.5 rounded-2xl font-black text-sm transition cursor-pointer ${
                  newMasterPin.length >= 4
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                Actualizar PIN Maestro
              </button>

              {masterPinSaved && (
                <p className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 p-2.5 rounded-xl text-center">
                  ✓ Clave maestra actualizada con éxito.
                </p>
              )}
            </form>
          </div>
        )}

      </main>

      {/* Exclusive Super Admin Modal: Create Event (24h Trial or Permanent) */}
      {showCreateEventModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-800 text-left relative text-white my-auto max-h-[92vh] overflow-y-auto pb-safe">
            <button
              type="button"
              onClick={() => setShowCreateEventModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 cursor-pointer transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                <Building2 className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-black text-white tracking-tight">
                Crear Nuevo Evento / Empresa
              </h3>
            </div>
            <p className="text-xs text-slate-400 mb-5">
              Exclusivo del Administrador Supremo. Elige si es un evento temporal de prueba (24 horas) o permanente.
            </p>

            <form onSubmit={handleCreateEventAsSuperAdmin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Nombre de la Empresa o Evento *
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  placeholder="Ej. Festival Caracas o Jornada Corporativa"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white focus:outline-none focus:ring-2 ring-amber-500"
                />
              </div>

              {/* Duration Selector: 24h Trial vs Permanent */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Duración del Evento *
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setNewEventDuration('TRIAL_24H')}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                      newEventDuration === 'TRIAL_24H'
                        ? 'bg-amber-500/20 border-amber-400 text-white ring-2 ring-amber-400/30'
                        : 'bg-slate-800/70 border-slate-700 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-black text-xs mb-1">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>Prueba (24 Horas)</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      Dura 24 horas exactas y luego se borra automáticamente.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewEventDuration('PERMANENT')}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                      newEventDuration === 'PERMANENT'
                        ? 'bg-emerald-500/20 border-emerald-400 text-white ring-2 ring-emerald-400/30'
                        : 'bg-slate-800/70 border-slate-700 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-black text-xs mb-1">
                      <InfinityIcon className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Permanente</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      Sin límite de tiempo; dura lo que el administrador quiera.
                    </p>
                  </button>
                </div>
              </div>

              {/* Event Mode Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Modalidad del Evento *
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setNewEventMode('CASHLESS')}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                      newEventMode === 'CASHLESS'
                        ? 'bg-blue-600/20 border-blue-500 text-white ring-2 ring-blue-500/30'
                        : 'bg-slate-800/70 border-slate-700 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-black text-xs mb-1">
                      <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Cashless (Saldo)</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      Clientes recargan dinero en Caja y pagan en stands.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNewEventMode('CORPORATE');
                      if (newEmoji === '🎪') setNewEmoji('🏢');
                    }}
                    className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                      newEventMode === 'CORPORATE'
                        ? 'bg-indigo-600/20 border-indigo-500 text-white ring-2 ring-indigo-500/30'
                        : 'bg-slate-800/70 border-slate-700 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-black text-xs mb-1">
                      <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Corporativo</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      Empleados retiran cupos (1 almuerzo, 2 helados) sin pagar.
                    </p>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>PIN Admin *</span>
                  </label>
                  <input
                    type="password"
                    minLength={4}
                    maxLength={8}
                    required
                    placeholder="••••"
                    value={newAdminPin}
                    onChange={e => setNewAdminPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-black text-white font-mono tracking-widest focus:outline-none focus:ring-2 ring-amber-500 text-center"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">4 a 8 dígitos</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>PIN Caja *</span>
                  </label>
                  <input
                    type="password"
                    minLength={4}
                    maxLength={8}
                    required
                    placeholder="••••"
                    value={newCajaPin}
                    onChange={e => setNewCajaPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-black text-white font-mono tracking-widest focus:outline-none focus:ring-2 ring-amber-500 text-center"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">4 a 8 dígitos</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Tasa Oficial BCV ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="52.40"
                    value={newBcv}
                    onChange={e => setNewBcv(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-black text-emerald-400 font-mono focus:outline-none focus:ring-2 ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Comisión App (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    required
                    value={newCommissionRate}
                    onChange={e => setNewCommissionRate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-black text-amber-400 font-mono focus:outline-none focus:ring-2 ring-amber-500"
                  />
                </div>
              </div>

              {/* Event Icon / Logo (Image PNG/JPG + Emoji fallback) */}
              <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Logo / Icono del Evento (Imagen o Emoji)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowLogoUrlField(prev => !prev)}
                    className="text-[11px] font-bold text-blue-400 hover:underline cursor-pointer"
                  >
                    {showLogoUrlField ? 'Ocultar enlace' : 'O usar URL https'}
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center text-3xl overflow-hidden shrink-0 shadow-inner">
                    {newLogoImage || sanitizeImageRef(logoUrlInput, EVENT_LOGO_MAX_CHARS) ? (
                      <img
                        src={newLogoImage || sanitizeImageRef(logoUrlInput, EVENT_LOGO_MAX_CHARS)}
                        alt="Logo evento"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      newEmoji
                    )}
                  </div>

                  <div className="flex-1 flex flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <label className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer transition active:scale-95">
                        <Upload className="w-3.5 h-3.5" />
                        <span>
                          {isCompressingLogo
                            ? 'Optimizando...'
                            : newLogoImage
                            ? 'Cambiar Logo'
                            : 'Subir Logo PNG / JPG'}
                        </span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp"
                          onChange={handleEventLogoFileChange}
                          disabled={isCompressingLogo}
                          className="hidden"
                        />
                      </label>

                      {(newLogoImage || logoUrlInput.trim()) && (
                        <button
                          type="button"
                          onClick={() => {
                            setNewLogoImage('');
                            setLogoUrlInput('');
                            setLogoError('');
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 font-bold text-xs cursor-pointer"
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      Se muestra como icono del evento en tarjetas y barra superior.
                    </span>
                  </div>
                </div>

                {showLogoUrlField && (
                  <input
                    type="url"
                    placeholder="https://ejemplo.com/logo-evento.png"
                    value={logoUrlInput}
                    onChange={e => {
                      setLogoUrlInput(e.target.value);
                      if (e.target.value.trim()) setNewLogoImage('');
                      setLogoError('');
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 ring-amber-500"
                  />
                )}

                {logoError && (
                  <p className="text-[11px] font-bold text-rose-300 bg-rose-500/15 border border-rose-500/30 px-2.5 py-1.5 rounded-xl">
                    {logoError}
                  </p>
                )}

                <div>
                  <span className="text-[10px] font-bold text-slate-400 block mb-1">
                    Emoji de respaldo:
                  </span>
                  <div className="flex flex-wrap gap-1.5 p-2 bg-slate-800 rounded-xl border border-slate-700">
                    {LOGO_EMOJIS.map(em => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => setNewEmoji(em)}
                        className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition cursor-pointer ${
                          newEmoji === em ? 'bg-amber-500 text-slate-950 scale-110 shadow-sm' : 'hover:bg-slate-700'
                        }`}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Event Cover Thumbnail (PNG / JPG) */}
              <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                    <span>Portada / Miniatura del Evento (PNG o JPG)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCoverUrlField(prev => !prev)}
                    className="text-[11px] font-bold text-blue-400 hover:underline cursor-pointer"
                  >
                    {showCoverUrlField ? 'Ocultar enlace' : 'O usar URL https'}
                  </button>
                </div>

                {(newCoverImage || sanitizeImageRef(coverUrlInput, EVENT_COVER_MAX_CHARS)) && (
                  <div className="relative h-32 w-full rounded-xl overflow-hidden border border-slate-700 bg-slate-900">
                    <img
                      src={newCoverImage || sanitizeImageRef(coverUrlInput, EVENT_COVER_MAX_CHARS)}
                      alt="Vista previa portada"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent" />
                    <span className="absolute bottom-2 left-2.5 text-xs font-black text-white flex items-center gap-1.5">
                      {newLogoImage || sanitizeImageRef(logoUrlInput, EVENT_LOGO_MAX_CHARS) ? (
                        <img
                          src={newLogoImage || sanitizeImageRef(logoUrlInput, EVENT_LOGO_MAX_CHARS)}
                          alt="Logo"
                          className="w-5 h-5 rounded-md object-cover border border-white/30"
                        />
                      ) : (
                        <span>{newEmoji}</span>
                      )}
                      <span>{newName.trim() || 'Tu Evento'}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setNewCoverImage('');
                        setCoverUrlInput('');
                        setCoverError('');
                      }}
                      className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold cursor-pointer shadow"
                    >
                      Quitar
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <label className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer transition active:scale-95">
                    <Upload className="w-3.5 h-3.5" />
                    <span>
                      {isCompressingCover
                        ? 'Optimizando...'
                        : newCoverImage
                        ? 'Cambiar Portada'
                        : 'Subir Portada PNG / JPG'}
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      onChange={handleEventCoverFileChange}
                      disabled={isCompressingCover}
                      className="hidden"
                    />
                  </label>
                  <span className="text-[10px] text-slate-400">
                    Estilo miniatura de redes (16:9). Opcional.
                  </span>
                </div>

                {showCoverUrlField && (
                  <input
                    type="url"
                    placeholder="https://ejemplo.com/portada-evento.jpg"
                    value={coverUrlInput}
                    onChange={e => {
                      setCoverUrlInput(e.target.value);
                      if (e.target.value.trim()) setNewCoverImage('');
                      setCoverError('');
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 ring-amber-500"
                  />
                )}

                {coverError && (
                  <p className="text-[11px] font-bold text-rose-300 bg-rose-500/15 border border-rose-500/30 px-2.5 py-1.5 rounded-xl">
                    {coverError}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Descripción (Opcional)
                </label>
                <textarea
                  rows={2}
                  maxLength={500}
                  placeholder="Detalles sobre el evento o negocio..."
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 ring-amber-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isCompressingCover || isCompressingLogo}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-slate-950 font-black text-sm shadow-lg shadow-emerald-500/25 transition cursor-pointer"
                >
                  {newEventDuration === 'TRIAL_24H'
                    ? 'Crear Evento de Prueba (24 Horas)'
                    : 'Crear Evento Permanente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
