/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginScreen } from './components/LoginScreen';
import { Header } from './components/Header';
import { CajaModule } from './components/CajaModule';
import { ProveedoresModule } from './components/ProveedoresModule';
import { AdminModule } from './components/AdminModule';
import { AdminPinModal } from './components/AdminPinModal';
import { ProviderPinModal } from './components/ProviderPinModal';
import { NewProviderModal } from './components/NewProviderModal';
import { SuperAdminModal } from './components/SuperAdminModal';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { NfcModal } from './components/NfcModal';
import { ResultModal } from './components/ResultModal';
import { StickersDrawer } from './components/StickersDrawer';
import { ProductModal } from './components/ProductModal';
import { ReceiptModal } from './components/ReceiptModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { Radio, ShieldCheck } from 'lucide-react';

const AppContent: React.FC = () => {
  const {
    currentCompany,
    activeTab,
    isSuperAdminDashboardOpen,
  } = useApp();

  // 1. If Super Admin Dashboard is open, render Master Control Panel
  if (isSuperAdminDashboardOpen) {
    return (
      <>
        <OfflineIndicator />
        <SuperAdminDashboard />
        <SuperAdminModal />
      </>
    );
  }

  // 2. If no company is active, render the Home / Login Portal with Super Admin modal
  if (!currentCompany) {
    return (
      <>
        <OfflineIndicator />
        <LoginScreen />
        <SuperAdminModal />
      </>
    );
  }

  const isCorp = currentCompany.eventMode === 'CORPORATE';

  // 3. If company is active, render isolated POS environment (mobile-first)
  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)] transition-colors duration-300 selection:bg-blue-500 selection:text-white">
      <OfflineIndicator />

      {/* Dynamic Header + Mobile Bottom Navigation */}
      <Header />

      {/* Main Module Viewport (extra bottom clearance for mobile bottom nav & sticky cart) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 py-4 sm:p-6 lg:p-8 pb-28 md:pb-8">
        {activeTab === 'caja' && <CajaModule />}
        {activeTab === 'proveedores' && <ProveedoresModule />}
        {activeTab === 'admin' && <AdminModule />}
      </main>

      {/* Global Modals & Drawers */}
      <AdminPinModal />
      <ProviderPinModal />
      <NewProviderModal />
      <SuperAdminModal />
      <NfcModal />
      <ResultModal />
      <StickersDrawer />
      <ProductModal />
      <ReceiptModal />

      {/* Desktop Clean Footer */}
      <footer className="hidden md:block border-t border-slate-200/80 bg-white/70 backdrop-blur-xs py-4 px-4 text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-blue-600" />
            <span className="font-bold text-slate-700">{currentCompany.name}</span>
            <span className="text-slate-400">•</span>
            <span>
              {isCorp
                ? 'Modo Corporativo (Beneficios para Empleados) • Referencia Tasa BCV'
                : 'Sistema Cashless con conversión a tasa oficial BCV'}
            </span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Soporte Web NFC (NTAG215)
            </span>
            <span>Sincronización multi-dispositivo</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ErrorBoundary>
  );
}
