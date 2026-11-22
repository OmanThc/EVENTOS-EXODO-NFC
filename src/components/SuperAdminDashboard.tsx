import React, { useState, useMemo } from 'react';
import { 
  ShieldAlert, 
  ArrowLeft, 
  Edit3, 
  Building2, 
  Receipt, 
  KeyRound, 
  DollarSign, 
  TrendingUp, 
  Store, 
  Wallet, 
  Layers, 
  Save, 
  Trash2, 
  Download, 
  CheckCircle2, 
  Lock, 
  Unlock, 
  ExternalLink, 
  Plus, 
  RefreshCw, 
  Search, 
  Sparkles,
  ChevronDown,
  ChevronUp,
  PieChart,
  CheckSquare,
  Square,
  Eraser,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatUSD, formatBs, formatDateTime } from '../utils/formatters';
import { calculateGlobalProviderStats, exportProvidersCSV } from '../utils/providerStats';

const DEMO_COMPANY_IDS = new Set([
  'comp-gastro-ccs',
  'comp-oktoberfest',
  'comp-beach-club',
  'comp-corporativo-tech',
]);

export const SuperAdminDashboard: React.FC = () => {
  const { 
    masterSettings, 
    updateMasterSettings, 
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

  // Form state for Home screen texts
  const [homeTitle, setHomeTitle] = useState(masterSettings.homeTitle);
  const [homeSubtitle, setHomeSubtitle] = useState(masterSettings.homeSubtitle);
  const [homeDesc, setHomeDesc] = useState(masterSettings.homeHeroDescription);
  const [homeBanner, setHomeBanner] = useState(masterSettings.homeBannerText);
  const [allowPublicReg, setAllowPublicReg] = useState(masterSettings.allowPublicCompanyRegistration);
  const [textsSaved, setTextsSaved] = useState(false);

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

  const handleSaveTexts = (e: React.FormEvent) => {
    e.preventDefault();
    updateMasterSettings({
      homeTitle,
      homeSubtitle,
      homeHeroDescription: homeDesc,
      homeBannerText: homeBanner,
      allowPublicCompanyRegistration: allowPublicReg,
    });
    setTextsSaved(true);
    setTimeout(() => setTextsSaved(false), 2500);
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
                Auditoría total de la plataforma y modificación de textos de inicio
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
            <span>1. Modificar Textos de Inicio</span>
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

        {/* TAB 1: MODIFICAR TEXTOS DE LA PANTALLA DE INICIO */}
        {activeSubTab === 'TEXTS' && (
          <div className="bg-slate-900/90 rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-xl max-w-3xl space-y-6">
            <div>
              <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-400" />
                <span>Editor de Textos & Marca de la Pantalla de Inicio</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Como Administrador Supremo, puedes cambiar en vivo los titulares, eslogan y mensajes que ven todos los visitantes al abrir la web app.
              </p>
            </div>

            <form onSubmit={handleSaveTexts} className="space-y-4">
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
                  Texto del Banner Superior (Navbar)
                </label>
                <input
                  type="text"
                  required
                  value={homeBanner}
                  onChange={e => setHomeBanner(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:ring-2 ring-amber-500"
                />
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-300">
                  <input
                    type="checkbox"
                    checked={allowPublicReg}
                    onChange={e => setAllowPublicReg(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
                  />
                  <span>Permitir botón público de &quot;Registrar Nueva Empresa&quot; en pantalla de inicio</span>
                </label>
              </div>

              <div className="pt-4 flex items-center gap-3">
                <button
                  type="submit"
                  className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar Textos de Inicio</span>
                </button>

                {textsSaved && (
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>¡Textos actualizados en la pantalla de inicio!</span>
                  </span>
                )}
              </div>
            </form>
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
                  Empresas Registradas ({companies.length})
                </h3>
                <p className="text-xs text-slate-400">
                  Accede como Administrador Supremo, reasigna claves o limpia empresas demo/de prueba.
                </p>
              </div>

              <button
                type="button"
                onClick={async () => {
                  await restoreDemoCompanies();
                  notifyCompanyCleanup('Empresas demo restauradas/sincronizadas.');
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>Restaurar Empresas Demo</span>
              </button>
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
                <p className="font-black text-white text-base">No hay empresas registradas</p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Todas las empresas de prueba fueron eliminadas. Puedes crear una empresa real desde la pantalla de inicio o restaurar las demos si lo deseas.
                </p>
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
                              {isDemo && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  Demo
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono">
                              ID: {comp.id}
                            </span>
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
    </div>
  );
};
