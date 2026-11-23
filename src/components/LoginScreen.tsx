import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  ShieldAlert,
  Store,
  DollarSign,
  Lock,
  Sparkles,
  Briefcase,
  CreditCard,
  Clock,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatUSD, formatBs } from '../utils/formatters';
import { PWAInstallButton } from './PWAInstallButton';

const formatTrialRemaining = (expiresAt: number, now: number): string => {
  const diffMs = Math.max(0, expiresAt - now);
  const totalMins = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours <= 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
};

export const LoginScreen: React.FC = () => {
  const {
    companies,
    loginCompany,
    masterSettings,
    setShowSuperAdminModal,
  } = useApp();

  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-500 selection:text-slate-950">
      {/* Top Navbar (No Firebase buttons or status exposed) */}
      <nav className="border-b border-slate-800 bg-slate-950/85 backdrop-blur-md px-3 sm:px-4 py-3 sticky top-0 z-20 pt-safe">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2.5">
          {/* Logo & Banner text */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-[var(--app-logo-bg,#ffffff)] flex items-center justify-center shadow-lg border border-white/25 shrink-0 overflow-hidden p-1">
              <img
                src={masterSettings.appLogo || '/app-logo.png'}
                alt={masterSettings.appName}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <h1 className="font-black text-base sm:text-lg tracking-tight text-white flex items-center gap-2">
                <span className="truncate">{masterSettings.appName}</span>
                <span className="hidden sm:inline text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">
                  Multi-Empresa
                </span>
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate max-w-[200px] sm:max-w-none">
                {masterSettings.homeBannerText}
              </p>
            </div>
          </div>

          {/* Right actions: PWA Mobile Install + Super Admin Access */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <PWAInstallButton variant="navbar" />

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
            const coverSrc = company.coverImage;

            return (
              <div
                key={company.id}
                className="bg-slate-900/95 hover:bg-slate-900 rounded-3xl border border-slate-800 hover:border-blue-500/60 shadow-xl transition-all duration-200 flex flex-col justify-between group relative overflow-hidden"
              >
                {/* Social-Media Cover Banner (16:9 style thumbnail) */}
                <div className="relative h-40 sm:h-44 w-full overflow-hidden bg-slate-800 shrink-0">
                  {coverSrc ? (
                    <img
                      src={coverSrc}
                      alt={company.name}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div
                      className="w-full h-full relative flex items-center justify-center overflow-hidden"
                      style={{
                        background: `linear-gradient(135deg, ${company.settings.primaryColor}dd 0%, #0f172a 70%, ${company.settings.secondaryColor}99 100%)`,
                      }}
                    >
                      <span className="text-7xl opacity-20 select-none transform -rotate-12 group-hover:scale-110 transition-transform duration-500">
                        {company.logoEmoji || '🏢'}
                      </span>
                    </div>
                  )}

                  {/* Readability gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/35 to-black/25" />

                  {/* Top floating pills */}
                  <div className="absolute top-3 inset-x-3 flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border backdrop-blur-md inline-flex items-center gap-1 shadow-sm ${
                          isCorp
                            ? 'bg-indigo-600/80 text-white border-indigo-400/50'
                            : 'bg-emerald-600/80 text-white border-emerald-400/50'
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

                      {company.isTrial24h && company.expiresAt && company.expiresAt > 0 && (
                        <span
                          className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-amber-500/90 text-slate-950 border border-amber-300/60 backdrop-blur-md inline-flex items-center gap-1 shadow-sm"
                          title="Evento temporal de prueba de 24 horas"
                        >
                          <Clock className="w-2.5 h-2.5" />
                          <span>Prueba {formatTrialRemaining(company.expiresAt, nowMs)}</span>
                        </span>
                      )}
                    </div>

                    <span
                      className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-slate-950/75 text-slate-200 border border-white/15 backdrop-blur-md shrink-0 flex items-center gap-1 shadow-sm"
                      title="Acceso protegido"
                    >
                      <Lock className="w-3 h-3 text-amber-400" />
                      <span>Protegido</span>
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5 sm:p-6 pt-0 flex-1 flex flex-col justify-between relative">
                  <div>
                    {/* Overlapping Avatar + Event Title */}
                    <div className="flex items-end gap-3 -mt-8 mb-3 relative z-10">
                      <div className="w-14 h-14 rounded-2xl bg-slate-900 border-2 border-slate-700 flex items-center justify-center text-2xl sm:text-3xl shadow-xl group-hover:scale-105 transition shrink-0 overflow-hidden">
                        {company.logoImage ? (
                          <img
                            src={company.logoImage}
                            alt={`Logo ${company.name}`}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          company.logoEmoji || '🏢'
                        )}
                      </div>
                      <div className="min-w-0 pb-0.5">
                        <h3 className="font-black text-base sm:text-lg text-white group-hover:text-blue-400 transition leading-snug truncate drop-shadow-sm">
                          {company.name}
                        </h3>
                        <span className="text-[11px] text-slate-400 font-medium block">
                          BCV: <strong className="text-emerald-400 font-mono">{formatBs(company.settings.bcvRate)}</strong>
                        </span>
                      </div>
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
              </div>
            );
          })}

          {/* Empty state when no active events exist (only Super Admin creates events) */}
          {companies.length === 0 && (
            <div className="col-span-full rounded-3xl p-8 sm:p-10 border border-slate-800 bg-slate-900/70 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="font-black text-lg text-white">
                No hay eventos activos en este momento
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
                La creación de nuevos eventos es exclusiva del <strong>Administrador Supremo</strong>. Si eres el administrador, ingresa al panel maestro para crear un evento de prueba (24h) o permanente.
              </p>
              <button
                type="button"
                onClick={() => setShowSuperAdminModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer transition"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Abrir Panel Admin Supremo</span>
              </button>
            </div>
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
        {masterSettings.appName} Multi-Tenant • Cashless &amp; Eventos Corporativos • Tiempo Real.
      </footer>
    </div>
  );
};
