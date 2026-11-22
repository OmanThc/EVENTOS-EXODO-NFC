import React, { useState } from 'react';
import { Download, Smartphone, X, Share2, MoreVertical } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useApp } from '../context/AppContext';

interface PWAInstallButtonProps {
  variant?: 'navbar' | 'header' | 'banner';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'navbar' }) => {
  const { masterSettings } = useApp();
  const { isInstallable, isInstalled, isIOS, isMobileBrowser, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  // Never show when already running inside the installed standalone mobile/desktop app
  if (isInstalled) {
    return null;
  }

  // Only show fallback guide button on mobile browsers if native prompt isn't ready yet
  const canTrigger = isInstallable || isIOS || isMobileBrowser;
  if (!canTrigger) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const ok = await install();
      if (!ok) {
        setShowGuideModal(true);
      }
    } else {
      setShowGuideModal(true);
    }
  };

  return (
    <>
      {variant === 'banner' ? (
        <div className="mb-6 bg-gradient-to-r from-blue-600/20 via-indigo-600/20 to-emerald-600/20 border border-blue-500/35 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {masterSettings.appLogo ? (
              <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 shadow-md overflow-hidden p-1">
                <img
                  src={masterSettings.appLogo}
                  alt={masterSettings.appName}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md">
                <Smartphone className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-black text-white truncate">
                Instala {masterSettings.appName} en tu teléfono
              </p>
              <p className="text-[11px] text-slate-300 leading-snug">
                Úsala en pantalla completa, más rápido y sin barra del navegador.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClick}
            className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shrink-0 shadow-lg shadow-emerald-500/20 transition active:scale-95 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar App</span>
          </button>
        </div>
      ) : variant === 'header' ? (
        <button
          type="button"
          onClick={handleClick}
          className="px-2.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1 shadow-md transition active:scale-95 cursor-pointer"
          title="Descargar App Móvil"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">App</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className="px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-xs sm:text-sm flex items-center gap-1.5 border border-emerald-500/35 transition active:scale-95 cursor-pointer"
        >
          <Download className="w-4 h-4 text-emerald-400" />
          <span>Instalar App</span>
        </button>
      )}

      {/* Guided Installation Modal (iOS Safari & Android Fallback) */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white text-slate-900 rounded-t-3xl sm:rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 relative pb-safe">
            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {masterSettings.appLogo ? (
              <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-200 flex items-center justify-center mb-3 overflow-hidden p-1.5">
                <img
                  src={masterSettings.appLogo}
                  alt={masterSettings.appName}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center mb-3">
                <Smartphone className="w-6 h-6" />
              </div>
            )}

            <h3 className="text-lg font-black text-slate-900 tracking-tight">
              {isIOS ? 'Instalar en iPhone / iPad' : `Instalar ${masterSettings.appName} en Android`}
            </h3>

            {isIOS ? (
              <div className="mt-3 space-y-2.5 text-xs text-slate-600">
                <p>Sigue estos 2 pasos en Safari para descargar la app en tu pantalla de inicio:</p>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-2.5">
                  <Share2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>
                    1. Pulsa el botón <strong>Compartir</strong> en la barra inferior o superior de Safari.
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-2.5">
                  <Download className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    2. Desliza hacia abajo y selecciona <strong>&quot;Agregar a inicio&quot;</strong>.
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-3 space-y-2.5 text-xs text-slate-600">
                <p>Instala la app en tu teléfono Android para usarla a pantalla completa:</p>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-2.5">
                  <MoreVertical className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>
                    1. Pulsa el menú <strong>(⋮)</strong> arriba a la derecha en Google Chrome.
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-2.5">
                  <Download className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    2. Toca <strong>&quot;Instalar aplicación&quot;</strong> o <strong>&quot;Agregar a la pantalla principal&quot;</strong>.
                  </span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="mt-5 w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
};
