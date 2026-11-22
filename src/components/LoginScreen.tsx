import React, { useState } from 'react';
import {
  Building2,
  Radio,
  Plus,
  ArrowRight,
  ShieldAlert,
  Store,
  DollarSign,
  Lock,
  Sparkles,
  X,
  Briefcase,
  CreditCard,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatUSD, formatBs } from '../utils/formatters';
import { PWAInstallButton } from './PWAInstallButton';
import { EventMode } from '../types';

const LOGO_EMOJIS = ['🍔', '🍺', '🏖️', '🎪', '🏢', '🍕', '☕', '🍩', '🎟️', '🍣', '🥩', '🍹'];

export const LoginScreen: React.FC = () => {
  const {
    companies,
    loginCompany,
    registerCompany,
    masterSettings,
    setShowSuperAdminModal,
  } = useApp();

  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newAdminPin, setNewAdminPin] = useState<string>('');
  const [newCajaPin, setNewCajaPin] = useState<string>('');
  const [newEmoji, setNewEmoji] = useState<string>('🎪');
  const [newDesc, setNewDesc] = useState<string>('');
  const [newBcv, setNewBcv] = useState<string>('52.40');
  const [newEventMode, setNewEventMode] = useState<EventMode>('CASHLESS');

  const handleCreateCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const bcvVal = parseFloat(newBcv) || 52.4;
    registerCompany(
      newName.trim(),
      newAdminPin.trim() || '1234',
      newCajaPin.trim() || '1111',
      newEmoji,
      newDesc.trim(),
      bcvVal,
      newEventMode
    );
    setShowCreateModal(false);
    setNewName('');
    setNewAdminPin('');
    setNewCajaPin('');
    setNewDesc('');
    setNewEventMode('CASHLESS');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-500 selection:text-slate-950">
      {/* Top Navbar (No Firebase buttons or status exposed) */}
      <nav className="border-b border-slate-800 bg-slate-950/85 backdrop-blur-md px-3 sm:px-4 py-3 sticky top-0 z-20 pt-safe">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2.5">
          {/* Logo & Banner text */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 border border-white/20 shrink-0">
              <Radio className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div className="min-w-0">
              <h1 className="font-black text-base sm:text-lg tracking-tight text-white flex items-center gap-2">
                <span className="truncate">PaySticker NFC</span>
                <span className="hidden sm:inline text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">
                  Multi-Empresa
                </span>
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate max-w-[200px] sm:max-w-none">
                {masterSettings.homeBannerText}
              </p>
            </div>
          </div>

          {/* Right actions: PWA Mobile Install + Register Company + Super Admin Access */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <PWAInstallButton variant="navbar" />

            {masterSettings.allowPublicCompanyRegistration && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 border border-slate-700 transition active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">Nueva Empresa</span>
              </button>
            )}

            {/* Admin Supremo Trigger */}
            <button
              onClick={() => setShowSuperAdminModal(true)}
              className="px-3 sm:px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition active:scale-95 cursor-pointer"
              title="Panel de Control Maestro del Administrador Supremo"
            >
              <ShieldAlert className="w-4 h-4" />
              <span className="hidden xs:inline sm:inline">Admin Supremo</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content: Hero & Company Grid */}
      <main className="max-w-7xl mx-auto w-full px-3.5 sm:px-4 py-6 sm:py-12 flex-1">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto mb-7 sm:mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300 text-[11px] sm:text-xs font-semibold mb-3 sm:mb-4">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{masterSettings.homeSubtitle}</span>
          </div>
          <h2 className="text-2xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            {masterSettings.homeTitle}
          </h2>
          <p className="text-slate-400 text-xs sm:text-base mt-2.5 sm:mt-3 max-w-2xl mx-auto">
            {masterSettings.homeHeroDescription}
          </p>
        </div>

        {/* Mobile App Install Banner (shows automatically on mobile browsers until installed) */}
        <PWAInstallButton variant="banner" />

        {/* Companies Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-10 sm:mb-12">
          {companies.map(company => {
            const totalBalance = company.stickers.reduce((s, st) => s + st.balance, 0);
            const isCorp = company.eventMode === 'CORPORATE';

            return (
              <div
                key={company.id}
                className="bg-slate-900/90 hover:bg-slate-850 rounded-3xl p-5 sm:p-6 border border-slate-800 hover:border-blue-500/50 shadow-xl transition-all duration-200 flex flex-col justify-between group relative overflow-hidden"
              >
                {/* Accent Top Bar */}
                <div
                  className="absolute top-0 left-0 right-0 h-1.5 opacity-85"
                  style={{ backgroundColor: company.settings.primaryColor }}
                />

                <div>
                  {/* Header info (NO PIN DISPLAYED AT ALL) */}
                  <div className="flex items-start justify-between gap-2.5 mb-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl sm:text-3xl shadow-inner group-hover:scale-105 transition shrink-0">
                        {company.logoEmoji || '🏢'}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-black text-base sm:text-lg text-white group-hover:text-blue-400 transition leading-snug truncate">
                          {company.name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span
                            className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border inline-flex items-center gap-1 ${
                              isCorp
                                ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            }`}
                          >
                            {isCorp ? (
                              <>
                                <Briefcase className="w-2.5 h-2.5" />
                                <span>Corporativo</span>
                              </>
                            ) : (
                              <>
                                <CreditCard className="w-2.5 h-2.5" />
                                <span>Cashless</span>
                              </>
                            )}
                          </span>
                          <span className="text-[11px] text-slate-400 font-medium">
                            BCV: <strong className="text-emerald-400 font-mono">{formatBs(company.settings.bcvRate)}</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    <span
                      className="text-[10px] font-mono font-bold px-2 py-1 rounded-lg bg-slate-800 text-slate-400 border border-slate-700 shrink-0 flex items-center gap-1"
                      title="Acceso protegido"
                    >
                      <Lock className="w-3 h-3 text-amber-400" />
                      <span className="hidden sm:inline">Protegido</span>
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2 mb-4 sm:mb-5">
                    {company.description || 'Ambiente NFC con control de caja y stands.'}
                  </p>

                  {/* Quick stats */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80 mb-5 text-center">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                        {isCorp ? 'Empleados' : 'Pulseras'}
                      </span>
                      <span className="text-sm font-black text-white font-mono">
                        {company.stickers.length}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                        {isCorp ? 'Beneficios' : 'Productos'}
                      </span>
                      <span className="text-sm font-black text-white font-mono">
                        {isCorp ? company.employeeAllowances.length : company.products.length}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                        {isCorp ? 'Consumo' : 'Flotante'}
                      </span>
                      <span className="text-sm font-black text-emerald-400 font-mono">
                        {isCorp
                          ? formatUSD(company.stickers.reduce((s, st) => s + (st.totalSpent || 0), 0))
                          : formatUSD(totalBalance)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Login button */}
                <button
                  onClick={() => loginCompany(company.id)}
                  className="w-full py-3.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 transition active:scale-[0.99] cursor-pointer"
                >
                  <span>Entrar al Evento</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
                </button>
              </div>
            );
          })}

          {/* New Company Dashed Card */}
          {masterSettings.allowPublicCompanyRegistration && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="rounded-3xl p-7 border-2 border-dashed border-slate-800 hover:border-blue-500/60 bg-slate-900/30 hover:bg-slate-900/60 transition-all flex flex-col items-center justify-center text-center cursor-pointer group min-h-[240px] sm:min-h-[280px]"
            >
              <div className="w-13 h-13 rounded-2xl bg-slate-800/80 group-hover:bg-blue-600 text-slate-300 group-hover:text-white flex items-center justify-center mb-3.5 transition shadow-inner">
                <Plus className="w-7 h-7" />
              </div>
              <h3 className="font-black text-base text-white group-hover:text-blue-400 transition">
                Registrar Nueva Empresa / Evento
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-[230px]">
                Elige modo Cashless (recargas) o Corporativo (cupos por empleado sin cobro).
              </p>
            </button>
          )}
        </div>

        {/* Benefits bar */}
        <div className="bg-slate-900/60 rounded-3xl p-5 sm:p-6 border border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6 text-slate-300 text-xs">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">Caja con Catálogo de Precios</h4>
              <p className="text-slate-400 mt-0.5">
                Consulta precios de todos los stands en USD/Bs para sugerir la recarga exacta o acreditar cupos.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
              <Store className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">Stands y Eventos Corporativos</h4>
              <p className="text-slate-400 mt-0.5">
                Cobra con pulseras Cashless o valida retiros por empleado (ej. 1 almuerzo, 2 helados) sin cobrarles.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm">Sincronización en Tiempo Real</h4>
              <p className="text-slate-400 mt-0.5">
                Usa la app en múltiples teléfonos y PCs simultáneamente con actualización instantánea.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-4 px-4 text-center text-xs text-slate-500 pb-safe">
        PaySticker NFC Multi-Tenant • Cashless &amp; Eventos Corporativos • Tiempo Real.
      </footer>

      {/* Modal: Create Company */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-800 text-left relative text-white my-auto max-h-[92vh] overflow-y-auto pb-safe">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 cursor-pointer transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                <Building2 className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-black text-white tracking-tight">
                Registrar Nuevo Evento
              </h3>
            </div>
            <p className="text-xs text-slate-400 mb-5">
              Crea una organización con su propio ecosistema NFC y claves privadas.
            </p>

            <form onSubmit={handleCreateCompany} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Nombre de la Empresa o Evento *
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  placeholder="Ej. Feria Gourmet o Jornada Corporativa"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white focus:outline-none focus:ring-2 ring-blue-500"
                />
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
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-black text-white font-mono tracking-widest focus:outline-none focus:ring-2 ring-blue-500 text-center"
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
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-black text-white font-mono tracking-widest focus:outline-none focus:ring-2 ring-blue-500 text-center"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">4 a 8 dígitos</span>
                </div>
              </div>

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
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-black text-emerald-400 font-mono focus:outline-none focus:ring-2 ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Logo / Emoji Representativo
                </label>
                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-800 rounded-xl border border-slate-700">
                  {LOGO_EMOJIS.map(em => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setNewEmoji(em)}
                      className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition cursor-pointer ${
                        newEmoji === em ? 'bg-blue-600 scale-110 shadow-sm' : 'hover:bg-slate-700'
                      }`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
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
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 ring-blue-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm shadow-lg shadow-blue-600/30 transition cursor-pointer"
                >
                  Crear Evento e Iniciar Sesión
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
