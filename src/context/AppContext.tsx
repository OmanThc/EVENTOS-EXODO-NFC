import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  BOOTSTRAP_ADMIN_EMAIL,
  OperationType,
  handleFirestoreError,
} from '../firebase';
import {
  Sticker,
  Product,
  CartItem,
  Transaction,
  AppThemeSettings,
  ActiveTab,
  PaymentMethod,
  Company,
  MasterSettings,
  ProviderAccount,
  EventMode,
  EmployeeAllowanceRule,
  StickerQuotaProgress,
} from '../types';
import { INITIAL_COMPANIES } from '../data/initialCompanies';
import { INITIAL_SETTINGS, INITIAL_MASTER_SETTINGS } from '../data/initialData';
import { soundSynth } from '../utils/audio';
import { formatUSD, formatTime } from '../utils/formatters';
import {
  sanitizeImageRef,
  generatePwaAppIcons,
  EVENT_COVER_MAX_CHARS,
  EVENT_LOGO_MAX_CHARS,
  APP_LOGO_MAX_CHARS,
  PRODUCT_IMAGE_MAX_CHARS,
} from '../utils/imageUtils';

export interface NfcModalConfig {
  mode: 'RECHARGE' | 'CHARGE' | 'QUERY' | 'ASSIGN_QUOTA';
  amountUSD: number;
  title: string;
  subtitle: string;
  paymentMethod?: PaymentMethod;
  customAttendeeName?: string;
  customDepartment?: string;
  customQuotas?: Record<string, StickerQuotaProgress>;
  targetStickerId?: string;
}

interface ResultModalData {
  isOpen: boolean;
  isSuccess: boolean;
  title: string;
  message: string;
  details?: {
    stickerId?: string;
    owner?: string;
    department?: string;
    amountUSD?: number;
    amountBs?: number;
    prevBalance?: number;
    newBalance?: number;
    missingUSD?: number;
    detail?: string;
    bcvRate?: number;
    isCorporate?: boolean;
    quotas?: Record<string, StickerQuotaProgress>;
    consumedItems?: string[];
  };
  transaction?: Transaction;
}

export interface NewProviderProductDraft {
  name: string;
  price: number;
  emoji: string;
  category?: string;
  imageUrl?: string;
}

interface AppContextType {
  // Firebase Auth & Sync (runs silently in background)
  firebaseUser: User | null;
  isAuthReady: boolean;
  isCloudSynced: boolean;
  isCloudLoading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOutGoogle: () => Promise<void>;

  // Master / Super Admin
  masterSettings: MasterSettings;
  updateMasterSettings: (partial: Partial<MasterSettings>) => void;
  updateGlobalCommissionRate: (rate: number) => Promise<void>;
  convertTrialToPermanent: (companyId: string) => void;
  isSuperAdminAuthenticated: boolean;
  showSuperAdminModal: boolean;
  setShowSuperAdminModal: (show: boolean) => void;
  isSuperAdminDashboardOpen: boolean;
  setIsSuperAdminDashboardOpen: (open: boolean) => void;
  loginSuperAdmin: (pin: string) => boolean;
  logoutSuperAdmin: () => void;
  updateCompanyPinByMaster: (companyId: string, newPin: string) => void;
  updateCompanyCajaPinByMaster: (companyId: string, newPin: string) => void;
  updateProviderPinByMaster: (companyId: string, providerId: string, newPin: string) => void;
  updateCompanyByMaster: (companyId: string, partial: Partial<Company>) => void;
  enterCompanyAsSuperAdmin: (companyId: string) => void;
  allGlobalTransactions: Transaction[];
  exportGlobalTransactionsCSV: () => void;

  // Company & Multi-tenant
  companies: Company[];
  currentCompany: Company | null;
  loginCompany: (companyId: string) => void;
  logoutCompany: () => void;
  registerCompany: (
    name: string,
    adminPin: string,
    cajaPin: string,
    logoEmoji?: string,
    description?: string,
    initialBcvRate?: number,
    eventMode?: EventMode,
    coverImage?: string,
    logoImage?: string,
    options?: {
      isTrial24h?: boolean;
      commissionRate?: number;
      autoEnter?: boolean;
    }
  ) => Company;
  deleteCompany: (companyId: string) => void;
  updateCompanyLogoImage: (logoImage: string) => void;
  updateCompanyCoverImage: (coverImage: string) => void;
  updateCompanyEventMode: (mode: EventMode) => void;
  updateEmployeeAllowances: (rules: EmployeeAllowanceRule[]) => void;

  // Admin PIN Lock (Company level)
  isAdminUnlocked: boolean;
  unlockAdminWithPin: (pin: string) => boolean;
  lockAdmin: () => void;
  updateAdminPin: (newPin: string) => void;
  showPinModal: boolean;
  setShowPinModal: (show: boolean) => void;

  // Caja PIN Lock (Company level)
  isCajaUnlocked: boolean;
  unlockCajaWithPin: (pin: string) => boolean;
  lockCaja: () => void;
  updateCajaPin: (newPin: string) => void;
  showCajaPinModal: boolean;
  setShowCajaPinModal: (show: boolean) => void;

  // Provider Brand Accounts & PIN Lock
  providers: ProviderAccount[];
  unlockedProviderId: string | null;
  activeProvider: ProviderAccount | null;
  pendingProviderId: string | null;
  showProviderPinModal: boolean;
  openProviderPinPrompt: (providerId: string) => void;
  closeProviderPinPrompt: () => void;
  unlockProviderWithPin: (providerId: string, pin: string) => boolean;
  lockProvider: () => void;
  isNewProviderModalOpen: boolean;
  setIsNewProviderModalOpen: (open: boolean) => void;
  addProviderWithProducts: (
    brandName: string,
    emoji: string,
    pin: string,
    initialProducts: NewProviderProductDraft[]
  ) => ProviderAccount | null;
  updateProviderPin: (providerId: string, newPin: string) => void;
  deleteProviderBrand: (providerId: string) => void;

  // Navigation & Settings
  settings: AppThemeSettings;
  updateSettings: (partial: Partial<AppThemeSettings>) => void;
  resetTheme: () => void;
  setPresetTheme: (primary: string, secondary: string, bg: string) => void;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  requestNavigateTab: (tab: ActiveTab) => void;

  // Stickers
  stickers: Sticker[];
  addSticker: (owner: string, initialBalance?: number, color?: string, department?: string) => Sticker;
  updateSticker: (id: string, partial: Partial<Sticker>) => void;
  deleteSticker: (id: string) => void;

  // Products
  products: Product[];
  addProduct: (product: Omit<Product, 'id'>) => Product;
  updateProduct: (id: number, fields: Partial<Product>) => void;
  deleteProduct: (id: number) => void;

  // Cart
  cart: CartItem[];
  addToCart: (product: Product) => void;
  updateCartQty: (productId: number, delta: number) => void;
  removeFromCart: (productId: number) => void;
  clearCart: () => void;
  cartTotalUSD: number;
  cartTotalBs: number;
  cartItemCount: number;

  // Transactions
  transactions: Transaction[];
  addTransaction: (tx: Omit<Transaction, 'id' | 'timestamp' | 'time'>) => Transaction;

  // Modals
  isNfcModalOpen: boolean;
  nfcModalConfig: NfcModalConfig | null;
  openNfcModal: (config: NfcModalConfig) => void;
  closeNfcModal: () => void;
  resultModal: ResultModalData;
  closeResultModal: () => void;
  isStickersDrawerOpen: boolean;
  toggleStickersDrawer: () => void;
  setIsStickersDrawerOpen: (open: boolean) => void;
  isProductModalOpen: boolean;
  setIsProductModalOpen: (open: boolean) => void;
  receiptModalTx: Transaction | null;
  setReceiptModalTx: (tx: Transaction | null) => void;
  processNfcTap: (stickerId: string, customAttendeeName?: string) => Promise<boolean>;

  // Backup, Reset & Test-Data Cleanup
  deleteStickersBulk: (stickerIds: string[], alsoDeleteTransactions?: boolean) => Promise<void>;
  deleteTransactionsBulk: (transactionIds: string[]) => Promise<void>;
  deleteGlobalTransactionsBulk: (items: { companyId: string; id: string }[]) => Promise<void>;
  deleteProductsBulk: (productIds: number[]) => Promise<void>;
  deleteProvidersBulk: (providerIds: string[]) => Promise<void>;
  deleteCompaniesBulk: (companyIds: string[]) => Promise<void>;
  wipeCurrentCompanyTestData: (options: {
    stickers: boolean;
    transactions: boolean;
    products?: boolean;
    providers?: boolean;
  }) => Promise<void>;
  restoreDemoCompanies: () => Promise<void>;
  resetCurrentCompanyData: () => void;
  exportDataJSON: () => void;
  exportTransactionsCSV: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

const PUBLIC_ACTOR_UID = 'paysticker-cloud-sync';

const STORAGE_KEYS = {
  COMPANIES: 'paysticker_companies_v4',
  ACTIVE_COMPANY_ID: 'paysticker_active_company_id_v4',
  MASTER_SETTINGS: 'paysticker_master_settings_v2',
};

const DEFAULT_CORPORATE_RULES: EmployeeAllowanceRule[] = [
  { id: 'rule-almuerzo', label: 'Almuerzos', emoji: '🍽️', matchType: 'CATEGORY', matchValue: 'Almuerzos', maxQty: 1 },
  { id: 'rule-helados', label: 'Helados', emoji: '🍦', matchType: 'CATEGORY', matchValue: 'Helados', maxQty: 2 },
  { id: 'rule-bebidas', label: 'Bebidas', emoji: '🥤', matchType: 'CATEGORY', matchValue: 'Bebidas', maxQty: 2 },
];

export const buildQuotasFromAllowances = (
  allowances: EmployeeAllowanceRule[],
  existingQuotas?: Record<string, StickerQuotaProgress>
): Record<string, StickerQuotaProgress> => {
  const result: Record<string, StickerQuotaProgress> = {};
  allowances.forEach(rule => {
    const prev = existingQuotas?.[rule.id];
    result[rule.id] = {
      ruleId: rule.id,
      label: rule.label,
      emoji: rule.emoji,
      matchType: rule.matchType,
      matchValue: rule.matchValue,
      allowed: rule.maxQty,
      used: prev ? Math.min(prev.used, rule.maxQty) : 0,
    };
  });
  return result;
};

const sanitizePin = (pin: string, fallback = '1234'): string => {
  const digits = (pin || '').replace(/\D/g, '').slice(0, 8);
  return digits.length >= 4 ? digits : fallback;
};

const sanitizeHex = (hex: string | undefined, fallback: string): string => {
  if (hex && /^#[0-9a-fA-F]{3,8}$/.test(hex.trim())) return hex.trim();
  return fallback;
};

const clampStr = (val: string | undefined, maxLen: number, fallback = ''): string => {
  const trimmed = (val ?? '').trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLen);
};

const generateUniqueSuffix = (len = 6): string => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID().replace(/-/g, '').slice(0, len).toUpperCase();
    }
  } catch {
    // fallback
  }
  return (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2))
    .slice(0, len)
    .toUpperCase();
};

class NfcBusinessError extends Error {
  public readonly code: 'NOT_FOUND' | 'BLOCKED' | 'INSUFFICIENT_BALANCE' | 'QUOTA_EXCEEDED' | 'INVALID_PRODUCT';
  public readonly payload: Record<string, unknown>;

  constructor(
    code: 'NOT_FOUND' | 'BLOCKED' | 'INSUFFICIENT_BALANCE' | 'QUOTA_EXCEEDED' | 'INVALID_PRODUCT',
    message: string,
    payload: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'NfcBusinessError';
    this.code = code;
    this.payload = payload;
  }
}

const normalizeCompany = (c: Partial<Company>): Company => {
  const fallbackProviders: ProviderAccount[] = Array.isArray(c.providers)
    ? c.providers
    : [];
  const prods = Array.isArray(c.products) ? c.products : [];
  const provMap = new Map<string, ProviderAccount>();
  fallbackProviders.forEach(p => provMap.set(p.brandName, p));
  prods.forEach((pr, idx) => {
    if (pr.provider && !provMap.has(pr.provider)) {
      provMap.set(pr.provider, {
        id: `prov-auto-${idx}-${Date.now().toString(36)}`,
        brandName: pr.provider,
        emoji: pr.emoji || '🏪',
        pin: '2026',
        createdAt: c.createdAt || new Date().toISOString().slice(0, 10),
      });
    }
  });

  return {
    id: c.id || `comp-${Date.now().toString(36)}`,
    ownerUid: c.ownerUid,
    name: c.name || 'Empresa',
    slug: c.slug || 'empresa',
    description: c.description || '',
    logoEmoji: c.logoEmoji || '🏢',
    logoImage: sanitizeImageRef(c.logoImage, EVENT_LOGO_MAX_CHARS),
    coverImage: sanitizeImageRef(c.coverImage, EVENT_COVER_MAX_CHARS),
    eventMode: c.eventMode === 'CORPORATE' ? 'CORPORATE' : 'CASHLESS',
    employeeAllowances: Array.isArray(c.employeeAllowances) ? c.employeeAllowances : [],
    adminPin: c.adminPin || '1234',
    cajaPin: c.cajaPin || '1111',
    providers: Array.from(provMap.values()),
    settings: { ...INITIAL_SETTINGS, ...(c.settings || {}) },
    stickers: Array.isArray(c.stickers) ? c.stickers : [],
    products: prods,
    transactions: Array.isArray(c.transactions) ? c.transactions : [],
    createdAt: c.createdAt || new Date().toISOString().slice(0, 10),
    isTrial24h: Boolean(c.isTrial24h),
    expiresAt: typeof c.expiresAt === 'number' ? c.expiresAt : 0,
    status: c.status || 'active',
  };
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Firebase Auth state (kept silent for SuperAdmin platform doc ownership if needed)
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
  const [isCloudLoading, setIsCloudLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Real-time cloud sync is ALWAYS active across all phones and PCs invisibly
  const isCloudSynced = true;
  const isBootstrappedAdminUser =
    Boolean(firebaseUser && firebaseUser.emailVerified && firebaseUser.email === BOOTSTRAP_ADMIN_EMAIL);

  // 1. Master Settings state
  const [masterSettings, setMasterSettings] = useState<MasterSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MASTER_SETTINGS);
      return saved ? { ...INITIAL_MASTER_SETTINGS, ...JSON.parse(saved) } : INITIAL_MASTER_SETTINGS;
    } catch {
      return INITIAL_MASTER_SETTINGS;
    }
  });
  const masterSettingsRef = useRef<MasterSettings>(masterSettings);
  useEffect(() => {
    masterSettingsRef.current = masterSettings;
  }, [masterSettings]);

  // 2. Super Admin Access state
  const [isSuperAdminAuthenticated, setIsSuperAdminAuthenticated] = useState<boolean>(false);
  const [showSuperAdminModal, setShowSuperAdminModal] = useState<boolean>(false);
  const [isSuperAdminDashboardOpen, setIsSuperAdminDashboardOpen] = useState<boolean>(false);

  // 3. Companies state
  const [companies, setCompanies] = useState<Company[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.COMPANIES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map(normalizeCompany);
        }
      }
      return INITIAL_COMPANIES.map(normalizeCompany);
    } catch {
      return INITIAL_COMPANIES.map(normalizeCompany);
    }
  });
  const companiesRef = useRef<Company[]>(companies);
  useEffect(() => {
    companiesRef.current = companies;
  }, [companies]);
  const deletingExpiredRef = useRef<Set<string>>(new Set());
  const manifestBlobUrlRef = useRef<string | null>(null);
  useEffect(() => {
    return () => {
      if (manifestBlobUrlRef.current) {
        URL.revokeObjectURL(manifestBlobUrlRef.current);
      }
    };
  }, []);

  // 4. Active Company ID
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.ACTIVE_COMPANY_ID) || null;
    } catch {
      return null;
    }
  });

  const currentCompany = useMemo(() => {
    if (!activeCompanyId) return null;
    return companies.find(c => c.id === activeCompanyId) || null;
  }, [companies, activeCompanyId]);

  // 5. Company-level PIN Locks (Admin, Caja, Provider)
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(false);
  const [showPinModal, setShowPinModal] = useState<boolean>(false);

  const [isCajaUnlocked, setIsCajaUnlocked] = useState<boolean>(false);
  const [showCajaPinModal, setShowCajaPinModal] = useState<boolean>(false);

  const [unlockedProviderId, setUnlockedProviderId] = useState<string | null>(null);
  const [pendingProviderId, setPendingProviderId] = useState<string | null>(null);
  const [showProviderPinModal, setShowProviderPinModal] = useState<boolean>(false);
  const [isNewProviderModalOpen, setIsNewProviderModalOpen] = useState<boolean>(false);

  // 6. Active Tab
  const [activeTab, setActiveTab] = useState<ActiveTab>('caja');

  // 7. Cart
  const [cart, setCart] = useState<CartItem[]>([]);

  // 8. Modals
  const [isNfcModalOpen, setIsNfcModalOpen] = useState(false);
  const [nfcModalConfig, setNfcModalConfig] = useState<NfcModalConfig | null>(null);
  const [resultModal, setResultModal] = useState<ResultModalData>({
    isOpen: false,
    isSuccess: true,
    title: '',
    message: '',
  });
  const [isStickersDrawerOpen, setIsStickersDrawerOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [receiptModalTx, setReceiptModalTx] = useState<Transaction | null>(null);

  // Listen to Firebase Auth state silently
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      setFirebaseUser(user);
      setIsAuthReady(true);
    });
    return () => unsub();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      soundSynth.playSuccess(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al iniciar sesión';
      setAuthError(msg);
      soundSynth.playError(true);
    }
  }, []);

  const signOutGoogle = useCallback(async () => {
    try {
      await signOut(auth);
      soundSynth.playClick(true);
    } catch (err) {
      console.error('Error signing out:', err);
    }
  }, []);

  // Keep subcollection unsubscribe refs cleanly tracked
  const subUnsubsRef = useRef<Map<string, Unsubscribe[]>>(new Map());

  // Helper to delete arbitrary Firestore document refs safely in chunks (< 500 batch limit)
  const commitDeletesInChunks = useCallback(async (refs: ReturnType<typeof doc>[]) => {
    const CHUNK_SIZE = 400;
    for (let i = 0; i < refs.length; i += CHUNK_SIZE) {
      const chunk = refs.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      chunk.forEach(ref => batch.delete(ref));
      await batch.commit();
    }
  }, []);

  const purgeExpiredTrialCompanies = useCallback(
    async (expiredIds: string[]) => {
      const pendingIds = expiredIds.filter(id => !deletingExpiredRef.current.has(id));
      if (pendingIds.length === 0) return;

      pendingIds.forEach(id => deletingExpiredRef.current.add(id));
      const targetSet = new Set(pendingIds);

      setCompanies(prev => prev.filter(c => !targetSet.has(c.id)));
      setActiveCompanyId(prevId => {
        if (prevId && targetSet.has(prevId)) {
          setIsAdminUnlocked(false);
          setIsCajaUnlocked(false);
          setUnlockedProviderId(null);
          setCart([]);
          return null;
        }
        return prevId;
      });

      try {
        const refsToDelete: ReturnType<typeof doc>[] = [];
        for (const cid of pendingIds) {
          for (const sub of ['transactions', 'stickers', 'products', 'providers']) {
            const subSnap = await getDocs(collection(db, 'companies', cid, sub));
            subSnap.docs.forEach(d => refsToDelete.push(d.ref));
          }
          refsToDelete.push(doc(db, 'companies', cid));
        }
        await commitDeletesInChunks(refsToDelete);
      } catch (err) {
        console.error('Error auto-purging expired 24h trial events:', err);
      } finally {
        pendingIds.forEach(id => deletingExpiredRef.current.delete(id));
      }
    },
    [commitDeletesInChunks]
  );

  // Write the 4 demo companies into Firestore
  const writeInitialCompaniesBatch = useCallback(async (actorUid: string) => {
    const batch = writeBatch(db);

    INITIAL_COMPANIES.forEach(rawComp => {
      const compId = rawComp.id.slice(0, 128);
      const compRef = doc(db, 'companies', compId);
      batch.set(compRef, {
        id: compId,
        ownerUid: actorUid,
        name: rawComp.name.slice(0, 120),
        slug: rawComp.slug.slice(0, 120),
        description: (rawComp.description || '').slice(0, 500),
        logoEmoji: rawComp.logoEmoji.slice(0, 24),
        eventMode: rawComp.eventMode || 'CASHLESS',
        employeeAllowances: rawComp.employeeAllowances || [],
        adminPin: sanitizePin(rawComp.adminPin, '1234'),
        cajaPin: sanitizePin(rawComp.cajaPin, '1111'),
        appName: rawComp.settings.appName.slice(0, 120),
        subtitle: rawComp.settings.subtitle.slice(0, 160),
        bcvRate: rawComp.settings.bcvRate,
        eventCommissionRate: rawComp.settings.eventCommissionRate,
        primaryColor: sanitizeHex(rawComp.settings.primaryColor, '#2563eb'),
        primaryHoverColor: sanitizeHex(rawComp.settings.primaryHoverColor, '#1d4ed8'),
        secondaryColor: sanitizeHex(rawComp.settings.secondaryColor, '#10b981'),
        bgColor: sanitizeHex(rawComp.settings.bgColor, '#f8fafc'),
        enableSound: rawComp.settings.enableSound,
        enableVibration: rawComp.settings.enableVibration,
        isTrial24h: false,
        expiresAt: 0,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      rawComp.providers.forEach(prov => {
        const provRef = doc(db, 'companies', compId, 'providers', prov.id);
        batch.set(provRef, {
          id: prov.id,
          companyId: compId,
          ownerUid: actorUid,
          brandName: prov.brandName.slice(0, 100),
          emoji: prov.emoji.slice(0, 24),
          pin: sanitizePin(prov.pin, '2001'),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      rawComp.stickers.forEach(st => {
        const stRef = doc(db, 'companies', compId, 'stickers', st.id);
        const stPayload: Record<string, unknown> = {
          id: st.id,
          companyId: compId,
          ownerUid: actorUid,
          owner: st.owner.slice(0, 100),
          balance: st.balance,
          color: st.color.slice(0, 80),
          tagType: st.tagType,
          status: st.status,
          totalRecharged: st.totalRecharged,
          totalSpent: st.totalSpent,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (st.department) stPayload.department = st.department.slice(0, 80);
        if (st.quotas) stPayload.quotas = st.quotas;
        batch.set(stRef, stPayload);
      });

      rawComp.products.forEach(pr => {
        const prodId = String(pr.id);
        const prRef = doc(db, 'companies', compId, 'products', prodId);
        batch.set(prRef, {
          id: prodId,
          companyId: compId,
          ownerUid: actorUid,
          name: pr.name.slice(0, 120),
          price: pr.price,
          emoji: pr.emoji.slice(0, 24),
          provider: pr.provider.slice(0, 100),
          category: (pr.category || 'General').slice(0, 60),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      rawComp.transactions.forEach(tx => {
        const txRef = doc(db, 'companies', compId, 'transactions', tx.id);
        const payload: Record<string, unknown> = {
          id: tx.id,
          companyId: compId,
          ownerUid: actorUid,
          type: tx.type,
          stickerId: tx.stickerId,
          owner: tx.owner.slice(0, 100),
          usd: tx.usd,
          bs: tx.bs,
          bcvRate: tx.bcvRate,
          detail: tx.detail.slice(0, 500),
          time: tx.time.slice(0, 40),
          timestamp: tx.timestamp,
          createdAt: serverTimestamp(),
        };
        if (tx.provider) payload.provider = tx.provider.slice(0, 100);
        if (tx.paymentMethod) payload.paymentMethod = tx.paymentMethod.slice(0, 60);
        if (tx.cartSnapshot) payload.cartSnapshot = tx.cartSnapshot.slice(0, 50);
        batch.set(txRef, payload);
      });
    });

    await batch.commit();
  }, []);

  // Seed initial companies & public platform config into Firestore ONLY on very first run
  const seedCompaniesIfEmpty = useCallback(async (actorUid: string) => {
    const platPubRef = doc(db, 'platform_public', 'config');
    let alreadySeeded = false;
    try {
      const platPubSnap = await getDoc(platPubRef);
      if (!platPubSnap.exists()) {
        await setDoc(platPubRef, {
          ownerUid: actorUid,
          appName: INITIAL_MASTER_SETTINGS.appName,
          appLogo: INITIAL_MASTER_SETTINGS.appLogo || '',
          appLogoBgColor: INITIAL_MASTER_SETTINGS.appLogoBgColor || '#ffffff',
          defaultEventCommissionRate: INITIAL_MASTER_SETTINGS.defaultEventCommissionRate,
          homeTitle: INITIAL_MASTER_SETTINGS.homeTitle,
          homeSubtitle: INITIAL_MASTER_SETTINGS.homeSubtitle,
          homeHeroDescription: INITIAL_MASTER_SETTINGS.homeHeroDescription,
          homeBannerText: INITIAL_MASTER_SETTINGS.homeBannerText,
          allowPublicCompanyRegistration: INITIAL_MASTER_SETTINGS.allowPublicCompanyRegistration,
          demoSeeded: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        alreadySeeded = Boolean(platPubSnap.data()?.demoSeeded);
        if (!alreadySeeded) {
          await updateDoc(platPubRef, {
            demoSeeded: true,
            updatedAt: serverTimestamp(),
          });
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'platform_public/config');
    }

    if (alreadySeeded) return;

    const companiesCol = collection(db, 'companies');
    let snap;
    try {
      snap = await getDocs(query(companiesCol));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'companies');
    }

    if (!snap.empty) return;

    try {
      await writeInitialCompaniesBatch(actorUid);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'companies/seed');
    }
  }, [writeInitialCompaniesBatch]);

  // Global Firestore real-time synchronization (platform config + lightweight companies index)
  useEffect(() => {
    let cancelled = false;
    const unsubs: Unsubscribe[] = [];

    const startSync = async () => {
      setIsCloudLoading(true);
      const actorUid = firebaseUser?.uid || PUBLIC_ACTOR_UID;

      // 1. Always subscribe to public platform texts across all devices
      const platPubRef = doc(db, 'platform_public', 'config');
      const unsubPlatPub = onSnapshot(
        platPubRef,
        snap => {
          if (snap.exists()) {
            const d = snap.data();
            setMasterSettings(prev => ({
              ...prev,
              appName: d.appName || prev.appName,
              appLogo:
                typeof d.appLogo === 'string'
                  ? sanitizeImageRef(d.appLogo, APP_LOGO_MAX_CHARS)
                  : prev.appLogo || '',
              appLogoBgColor: sanitizeHex(d.appLogoBgColor, prev.appLogoBgColor || '#ffffff'),
              defaultEventCommissionRate:
                typeof d.defaultEventCommissionRate === 'number'
                  ? Math.min(100, Math.max(0, d.defaultEventCommissionRate))
                  : prev.defaultEventCommissionRate,
              homeTitle: d.homeTitle || prev.homeTitle,
              homeSubtitle: d.homeSubtitle || prev.homeSubtitle,
              homeHeroDescription: d.homeHeroDescription || prev.homeHeroDescription,
              homeBannerText: d.homeBannerText || prev.homeBannerText,
              allowPublicCompanyRegistration:
                typeof d.allowPublicCompanyRegistration === 'boolean'
                  ? d.allowPublicCompanyRegistration
                  : prev.allowPublicCompanyRegistration,
            }));
          }
        },
        error => {
          handleFirestoreError(error, OperationType.GET, 'platform_public/config');
        }
      );
      unsubs.push(unsubPlatPub);

      // If bootstrapped admin is authenticated silently, also sync /platform/config
      if (isBootstrappedAdminUser && firebaseUser) {
        const platRef = doc(db, 'platform', 'config');
        try {
          const platSnap = await getDoc(platRef);
          if (!platSnap.exists()) {
            await setDoc(platRef, {
              ownerUid: firebaseUser.uid,
              masterPin: INITIAL_MASTER_SETTINGS.masterPin,
              appName: INITIAL_MASTER_SETTINGS.appName,
              appLogo: INITIAL_MASTER_SETTINGS.appLogo || '',
              appLogoBgColor: INITIAL_MASTER_SETTINGS.appLogoBgColor || '#ffffff',
              defaultEventCommissionRate: INITIAL_MASTER_SETTINGS.defaultEventCommissionRate,
              homeTitle: INITIAL_MASTER_SETTINGS.homeTitle,
              homeSubtitle: INITIAL_MASTER_SETTINGS.homeSubtitle,
              homeHeroDescription: INITIAL_MASTER_SETTINGS.homeHeroDescription,
              homeBannerText: INITIAL_MASTER_SETTINGS.homeBannerText,
              allowPublicCompanyRegistration: INITIAL_MASTER_SETTINGS.allowPublicCompanyRegistration,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, 'platform/config');
        }

        const unsubPlat = onSnapshot(
          platRef,
          snap => {
            if (snap.exists()) {
              const d = snap.data();
              setMasterSettings(prev => ({
                ...prev,
                masterPin: d.masterPin || prev.masterPin,
              }));
            }
          },
          error => {
            handleFirestoreError(error, OperationType.GET, 'platform/config');
          }
        );
        unsubs.push(unsubPlat);
      }

      // 2. Seed initial companies if Firestore is completely empty
      await seedCompaniesIfEmpty(actorUid);
      if (cancelled) return;

      // 3. Subscribe to Companies index (1 document per event) across devices
      const companiesQuery = query(collection(db, 'companies'));

      const unsubCompanies = onSnapshot(
        companiesQuery,
        snapshot => {
          const docsMap = new Map<string, Company>();
          const expiredTrialIds: string[] = [];
          const nowMs = Date.now();

          snapshot.docs.forEach(docSnap => {
            const d = docSnap.data();
            const cid = docSnap.id;
            const isTrial24h = Boolean(d.isTrial24h);
            const expiresAt = typeof d.expiresAt === 'number' ? d.expiresAt : 0;

            if (isTrial24h && expiresAt > 0 && nowMs >= expiresAt) {
              expiredTrialIds.push(cid);
              return;
            }

            docsMap.set(cid, {
              id: cid,
              ownerUid: d.ownerUid,
              name: d.name,
              slug: d.slug,
              description: d.description || '',
              logoEmoji: d.logoEmoji || '🏢',
              logoImage: sanitizeImageRef(d.logoImage, EVENT_LOGO_MAX_CHARS),
              coverImage: sanitizeImageRef(d.coverImage, EVENT_COVER_MAX_CHARS),
              eventMode: d.eventMode === 'CORPORATE' ? 'CORPORATE' : 'CASHLESS',
              employeeAllowances: Array.isArray(d.employeeAllowances) ? d.employeeAllowances : [],
              adminPin: d.adminPin || '1234',
              cajaPin: d.cajaPin || '1111',
              providers: [],
              settings: {
                appName: d.appName || d.name,
                subtitle: d.subtitle || 'Sistema Cashless & Tasa BCV',
                bcvRate: Number(d.bcvRate) || 52.4,
                eventCommissionRate: Number(d.eventCommissionRate ?? 8),
                primaryColor: d.primaryColor || '#2563eb',
                primaryHoverColor: d.primaryHoverColor || d.primaryColor || '#1d4ed8',
                secondaryColor: d.secondaryColor || '#10b981',
                bgColor: d.bgColor || '#f8fafc',
                enableSound: typeof d.enableSound === 'boolean' ? d.enableSound : true,
                enableVibration: typeof d.enableVibration === 'boolean' ? d.enableVibration : true,
              },
              stickers: [],
              products: [],
              transactions: [],
              createdAt:
                d.createdAt && typeof d.createdAt.toDate === 'function'
                  ? d.createdAt.toDate().toISOString().slice(0, 10)
                  : new Date().toISOString().slice(0, 10),
              isTrial24h,
              expiresAt,
              status: d.status || 'active',
            });
          });

          if (expiredTrialIds.length > 0) {
            void purgeExpiredTrialCompanies(expiredTrialIds);
          }

          setCompanies(prev => {
            const prevById = new Map(prev.map(c => [c.id, c]));
            return Array.from(docsMap.values()).map(nextComp => {
              const old = prevById.get(nextComp.id);
              return old
                ? {
                    ...nextComp,
                    providers: old.providers,
                    stickers: old.stickers,
                    products: old.products,
                    transactions: old.transactions,
                  }
                : nextComp;
            });
          });

          setIsCloudLoading(false);
        },
        error => {
          setIsCloudLoading(false);
          handleFirestoreError(error, OperationType.LIST, 'companies');
        }
      );
      unsubs.push(unsubCompanies);
    };

    void startSync();

    return () => {
      cancelled = true;
      unsubs.forEach(u => u());
    };
  }, [firebaseUser, isBootstrappedAdminUser, seedCompaniesIfEmpty, purgeExpiredTrialCompanies]);

  // Scoped Subcollection Sync: Only subscribe to the active event (or all events if SuperAdmin Maestro is open).
  // Prevents read amplification & listener flood when 40+ concurrent devices are active.
  const activeCompanyIdsKey = useMemo(
    () =>
      companies
        .map(c => c.id)
        .sort()
        .join(','),
    [companies]
  );

  useEffect(() => {
    const currentSubUnsubs = subUnsubsRef.current;
    const allKnownIds = new Set(activeCompanyIdsKey ? activeCompanyIdsKey.split(',') : []);

    const targetIds = new Set<string>();
    if (isSuperAdminDashboardOpen && isSuperAdminAuthenticated) {
      allKnownIds.forEach(cid => targetIds.add(cid));
    } else if (activeCompanyId && allKnownIds.has(activeCompanyId)) {
      targetIds.add(activeCompanyId);
    }

    // Detach listeners for companies no longer in active scope
    currentSubUnsubs.forEach((list, cid) => {
      if (!targetIds.has(cid)) {
        list.forEach(u => u());
        currentSubUnsubs.delete(cid);
      }
    });

    // Attach subcollection listeners only for targeted companies
    targetIds.forEach(cid => {
      if (currentSubUnsubs.has(cid)) return;
      const companySubUnsubs: Unsubscribe[] = [];
      const makeSubQuery = (subName: string) => query(collection(db, 'companies', cid, subName));

      // Providers
      companySubUnsubs.push(
        onSnapshot(
          makeSubQuery('providers'),
          subSnap => {
            const list: ProviderAccount[] = subSnap.docs.map(s => {
              const sd = s.data();
              return {
                id: s.id,
                brandName: sd.brandName,
                emoji: sd.emoji || '🏪',
                pin: sd.pin || '2001',
                createdAt:
                  sd.createdAt && typeof sd.createdAt.toDate === 'function'
                    ? sd.createdAt.toDate().toISOString().slice(0, 10)
                    : new Date().toISOString().slice(0, 10),
              };
            });
            setCompanies(prev => prev.map(c => (c.id === cid ? { ...c, providers: list } : c)));
          },
          error => handleFirestoreError(error, OperationType.LIST, `companies/${cid}/providers`)
        )
      );

      // Stickers
      companySubUnsubs.push(
        onSnapshot(
          makeSubQuery('stickers'),
          subSnap => {
            const list: Sticker[] = subSnap.docs.map(s => {
              const sd = s.data();
              return {
                id: s.id,
                owner: sd.owner,
                department: sd.department || undefined,
                balance: Number(sd.balance) || 0,
                color: sd.color || 'from-blue-600 to-indigo-700',
                tagType: sd.tagType || 'NTAG215',
                status: sd.status || 'active',
                totalRecharged: Number(sd.totalRecharged) || 0,
                totalSpent: Number(sd.totalSpent) || 0,
                quotas: sd.quotas && typeof sd.quotas === 'object' ? sd.quotas : undefined,
                createdAt:
                  sd.createdAt && typeof sd.createdAt.toDate === 'function'
                    ? sd.createdAt.toDate().toISOString().slice(0, 16).replace('T', ' ')
                    : new Date().toISOString().slice(0, 16).replace('T', ' '),
              };
            });
            setCompanies(prev => prev.map(c => (c.id === cid ? { ...c, stickers: list } : c)));
          },
          error => handleFirestoreError(error, OperationType.LIST, `companies/${cid}/stickers`)
        )
      );

      // Products
      companySubUnsubs.push(
        onSnapshot(
          makeSubQuery('products'),
          subSnap => {
            const list: Product[] = subSnap.docs.map(s => {
              const sd = s.data();
              const numericId = Number(s.id);
              return {
                id: !Number.isNaN(numericId)
                  ? numericId
                  : Math.abs(s.id.split('').reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7)),
                name: sd.name,
                price: Number(sd.price) || 0,
                emoji: sd.emoji || '📦',
                imageUrl: sanitizeImageRef(sd.imageUrl, PRODUCT_IMAGE_MAX_CHARS),
                provider: sd.provider,
                category: sd.category || 'General',
                stock: sd.stock,
              };
            });
            setCompanies(prev => prev.map(c => (c.id === cid ? { ...c, products: list } : c)));
          },
          error => handleFirestoreError(error, OperationType.LIST, `companies/${cid}/products`)
        )
      );

      // Transactions
      companySubUnsubs.push(
        onSnapshot(
          makeSubQuery('transactions'),
          subSnap => {
            const list: Transaction[] = subSnap.docs
              .map(s => {
                const sd = s.data();
                return {
                  id: s.id,
                  type: sd.type,
                  stickerId: sd.stickerId,
                  owner: sd.owner,
                  usd: Number(sd.usd) || 0,
                  bs: Number(sd.bs) || 0,
                  bcvRate: Number(sd.bcvRate) || 52.4,
                  detail: sd.detail,
                  provider: sd.provider,
                  paymentMethod: sd.paymentMethod,
                  time: sd.time,
                  timestamp: Number(sd.timestamp) || Date.now(),
                  cartSnapshot: sd.cartSnapshot,
                } as Transaction;
              })
              .sort((a, b) => b.timestamp - a.timestamp);
            setCompanies(prev => prev.map(c => (c.id === cid ? { ...c, transactions: list } : c)));
          },
          error => handleFirestoreError(error, OperationType.LIST, `companies/${cid}/transactions`)
        )
      );

      currentSubUnsubs.set(cid, companySubUnsubs);
    });
  }, [activeCompanyId, isSuperAdminDashboardOpen, isSuperAdminAuthenticated, activeCompanyIdsKey]);

  // Cleanup all subcollection listeners on unmount
  useEffect(() => {
    const currentSubUnsubs = subUnsubsRef.current;
    return () => {
      currentSubUnsubs.forEach(list => list.forEach(u => u()));
      currentSubUnsubs.clear();
    };
  }, []);

  // LocalStorage fallback sync (debounced & capped so 40+ devices never hit main-thread stutter or 5MB quota)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.MASTER_SETTINGS, JSON.stringify(masterSettings));
    } catch {
      // ignore
    }
  }, [masterSettings]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const compactCompanies = companies.map(c => ({
          ...c,
          transactions: c.transactions.slice(0, 100),
        }));
        localStorage.setItem(STORAGE_KEYS.COMPANIES, JSON.stringify(compactCompanies));
      } catch {
        // Fallback: strip large base64 images if QuotaExceededError
        try {
          const ultraCompact = companies.map(c => ({
            ...c,
            logoImage: undefined,
            coverImage: undefined,
            products: c.products.map(p => ({ ...p, imageUrl: undefined })),
            transactions: c.transactions.slice(0, 50),
          }));
          localStorage.setItem(STORAGE_KEYS.COMPANIES, JSON.stringify(ultraCompact));
        } catch {
          // ignore
        }
      }
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [companies]);

  useEffect(() => {
    try {
      if (activeCompanyId) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_COMPANY_ID, activeCompanyId);
      } else {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_COMPANY_ID);
      }
    } catch {
      // ignore
    }
  }, [activeCompanyId]);

  // Dynamic Theme CSS Variables
  useEffect(() => {
    const root = document.documentElement;
    if (currentCompany) {
      root.style.setProperty('--color-primary', currentCompany.settings.primaryColor);
      root.style.setProperty('--color-primary-hover', currentCompany.settings.primaryHoverColor || currentCompany.settings.primaryColor);
      root.style.setProperty('--color-secondary', currentCompany.settings.secondaryColor);
      root.style.setProperty('--color-bg', currentCompany.settings.bgColor);
    } else {
      root.style.setProperty('--color-primary', '#2563eb');
      root.style.setProperty('--color-primary-hover', '#1d4ed8');
      root.style.setProperty('--color-secondary', '#10b981');
      root.style.setProperty('--color-bg', '#090d16');
    }
  }, [currentCompany]);

  // Dynamic Browser Title, Meta, App Logo Background CSS Var, Favicons & Dynamic PWA Manifest
  useEffect(() => {
    let cancelled = false;
    const brandName = clampStr(masterSettings.appName, 120, INITIAL_MASTER_SETTINGS.appName);
    const logoBg = sanitizeHex(masterSettings.appLogoBgColor, '#ffffff');
    const logoSrc = sanitizeImageRef(masterSettings.appLogo, APP_LOGO_MAX_CHARS) || '/app-logo.png';

    document.documentElement.style.setProperty('--app-logo-bg', logoBg);

    document.title = currentCompany
      ? `${currentCompany.name} • ${brandName}`
      : `${brandName} - Cashless & Tasa BCV`;

    const shortWords = brandName.split(/\s+/).filter(Boolean);
    const shortName =
      brandName.length <= 12
        ? brandName
        : shortWords[0] && shortWords[0].length <= 12
        ? shortWords[0]
        : brandName.slice(0, 12).trim();

    const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (appleTitle) appleTitle.setAttribute('content', shortName);

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', `${brandName} - Cashless & Tasa BCV`);

    const applyManifestAndIcons = async () => {
      const origin = window.location.origin;
      const generatedIcons = logoSrc ? await generatePwaAppIcons(logoSrc, logoBg) : null;
      if (cancelled) return;

      const faviconEl = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (faviconEl) {
        faviconEl.href = generatedIcons?.icon192 || logoSrc || '/icon.svg';
        if (generatedIcons?.icon192) faviconEl.type = 'image/png';
        else if (logoSrc) faviconEl.removeAttribute('type');
        else faviconEl.type = 'image/svg+xml';
      }

      const appleIconEl = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
      if (appleIconEl) {
        appleIconEl.href = generatedIcons?.appleTouchIcon || logoSrc || '/apple-touch-icon.png';
      }

      const manifestData = {
        id: `${origin}/`,
        name: brandName,
        short_name: shortName,
        description:
          masterSettings.homeSubtitle ||
          'Plataforma POS Cashless NFC y Eventos Corporativos con tasa BCV.',
        theme_color: '#0f172a',
        background_color: logoBg,
        display: 'standalone',
        orientation: 'portrait',
        start_url: `${origin}/`,
        scope: `${origin}/`,
        icons: generatedIcons
          ? [
              {
                src: generatedIcons.icon192,
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any',
              },
              {
                src: generatedIcons.icon512,
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any',
              },
              {
                src: generatedIcons.icon512Maskable,
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable',
              },
            ]
          : [
              {
                src: `${origin}/pwa-192x192.png`,
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any',
              },
              {
                src: `${origin}/pwa-512x512.png`,
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any',
              },
              {
                src: `${origin}/pwa-maskable-512x512.png`,
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable',
              },
            ],
      };

      const blob = new Blob([JSON.stringify(manifestData)], {
        type: 'application/manifest+json',
      });
      const nextBlobUrl = URL.createObjectURL(blob);
      const prevBlobUrl = manifestBlobUrlRef.current;
      manifestBlobUrlRef.current = nextBlobUrl;

      let manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
      if (!manifestLink) {
        manifestLink = document.createElement('link');
        manifestLink.rel = 'manifest';
        document.head.appendChild(manifestLink);
      }
      manifestLink.href = nextBlobUrl;

      if (prevBlobUrl) {
        URL.revokeObjectURL(prevBlobUrl);
      }
    };

    void applyManifestAndIcons();

    return () => {
      cancelled = true;
    };
  }, [
    masterSettings.appName,
    masterSettings.appLogo,
    masterSettings.appLogoBgColor,
    masterSettings.homeSubtitle,
    currentCompany,
  ]);

  // Periodic 60s check to expire and purge any 24h trial events in real time
  useEffect(() => {
    const checkExpired = () => {
      const now = Date.now();
      const expired = companiesRef.current
        .filter(c => c.isTrial24h && c.expiresAt && c.expiresAt > 0 && now >= c.expiresAt)
        .map(c => c.id);
      if (expired.length > 0) {
        void purgeExpiredTrialCompanies(expired);
      }
    };
    const timer = window.setInterval(checkExpired, 60_000);
    return () => window.clearInterval(timer);
  }, [purgeExpiredTrialCompanies]);

  // Helper to update active company locally
  const updateCurrentCompany = useCallback((updater: (comp: Company) => Company) => {
    if (!activeCompanyId) return;
    setCompanies(prev => prev.map(c => (c.id === activeCompanyId ? updater(c) : c)));
  }, [activeCompanyId]);

  // Helper: always returns a non-empty valid ownerUid string for Firestore writes
  const getCompanyOwnerUid = useCallback(
    (company?: Company | null): string => {
      return company?.ownerUid || firebaseUser?.uid || PUBLIC_ACTOR_UID;
    },
    [firebaseUser]
  );

  // Master / Super Admin methods
  const updateMasterSettings = useCallback(
    (partial: Partial<MasterSettings>) => {
      const merged: MasterSettings = { ...masterSettingsRef.current, ...partial };
      const cleanRate = Number.isFinite(Number(merged.defaultEventCommissionRate))
        ? Math.round(Math.min(100, Math.max(0, Number(merged.defaultEventCommissionRate))) * 100) / 100
        : INITIAL_MASTER_SETTINGS.defaultEventCommissionRate;

      const sanitized: MasterSettings = {
        ...merged,
        masterPin: sanitizePin(merged.masterPin, '9999'),
        appName: clampStr(merged.appName, 120, INITIAL_MASTER_SETTINGS.appName),
        appLogo: sanitizeImageRef(merged.appLogo, APP_LOGO_MAX_CHARS),
        appLogoBgColor: sanitizeHex(merged.appLogoBgColor, '#ffffff'),
        defaultEventCommissionRate: cleanRate,
        homeTitle: clampStr(merged.homeTitle, 200, INITIAL_MASTER_SETTINGS.homeTitle),
        homeSubtitle: clampStr(merged.homeSubtitle, 200, INITIAL_MASTER_SETTINGS.homeSubtitle),
        homeHeroDescription: clampStr(merged.homeHeroDescription, 600, INITIAL_MASTER_SETTINGS.homeHeroDescription),
        homeBannerText: clampStr(merged.homeBannerText, 200, INITIAL_MASTER_SETTINGS.homeBannerText),
        allowPublicCompanyRegistration: Boolean(merged.allowPublicCompanyRegistration),
      };
      masterSettingsRef.current = sanitized;
      setMasterSettings(sanitized);

      const batch = writeBatch(db);
      if (isBootstrappedAdminUser && firebaseUser) {
        batch.update(doc(db, 'platform', 'config'), {
          masterPin: sanitized.masterPin,
          appName: sanitized.appName,
          appLogo: sanitized.appLogo || '',
          appLogoBgColor: sanitized.appLogoBgColor || '#ffffff',
          defaultEventCommissionRate: sanitized.defaultEventCommissionRate,
          homeTitle: sanitized.homeTitle,
          homeSubtitle: sanitized.homeSubtitle,
          homeHeroDescription: sanitized.homeHeroDescription,
          homeBannerText: sanitized.homeBannerText,
          allowPublicCompanyRegistration: sanitized.allowPublicCompanyRegistration,
          updatedAt: serverTimestamp(),
        });
      }
      batch.update(doc(db, 'platform_public', 'config'), {
        appName: sanitized.appName,
        appLogo: sanitized.appLogo || '',
        appLogoBgColor: sanitized.appLogoBgColor || '#ffffff',
        defaultEventCommissionRate: sanitized.defaultEventCommissionRate,
        homeTitle: sanitized.homeTitle,
        homeSubtitle: sanitized.homeSubtitle,
        homeHeroDescription: sanitized.homeHeroDescription,
        homeBannerText: sanitized.homeBannerText,
        allowPublicCompanyRegistration: sanitized.allowPublicCompanyRegistration,
        updatedAt: serverTimestamp(),
      });
      batch.commit().catch(err => {
        try {
          handleFirestoreError(err, OperationType.UPDATE, 'platform_public/config');
        } catch (e) {
          console.error('Firestore sync error in updateMasterSettings:', e);
        }
      });
      soundSynth.playSuccess(true);
    },
    [isBootstrappedAdminUser, firebaseUser]
  );

  const updateGlobalCommissionRate = useCallback(
    async (rate: number) => {
      const cleanRate = Math.round(Math.min(100, Math.max(0, Number(rate) || 0)) * 100) / 100;
      updateMasterSettings({ defaultEventCommissionRate: cleanRate });

      setCompanies(prev =>
        prev.map(c => ({
          ...c,
          settings: {
            ...c.settings,
            eventCommissionRate: cleanRate,
          },
        }))
      );

      try {
        const list = companiesRef.current;
        const CHUNK_SIZE = 400;
        for (let i = 0; i < list.length; i += CHUNK_SIZE) {
          const batch = writeBatch(db);
          list.slice(i, i + CHUNK_SIZE).forEach(comp => {
            batch.update(doc(db, 'companies', comp.id), {
              eventCommissionRate: cleanRate,
              updatedAt: serverTimestamp(),
            });
          });
          await batch.commit();
        }
        soundSynth.playSuccess(true);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, 'companies/commission-rate');
      }
    },
    [updateMasterSettings]
  );

  const convertTrialToPermanent = useCallback((companyId: string) => {
    setCompanies(prev =>
      prev.map(c =>
        c.id === companyId ? { ...c, isTrial24h: false, expiresAt: 0 } : c
      )
    );
    updateDoc(doc(db, 'companies', companyId), {
      isTrial24h: false,
      expiresAt: 0,
      updatedAt: serverTimestamp(),
    }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `companies/${companyId}`));
    soundSynth.playSuccess(true);
  }, []);

  const loginSuperAdmin = useCallback((pin: string): boolean => {
    const isCorrect = pin.trim() === masterSettings.masterPin.trim();
    if (isCorrect) {
      setIsSuperAdminAuthenticated(true);
      setShowSuperAdminModal(false);
      setIsSuperAdminDashboardOpen(true);
      soundSynth.playSuccess(true);
      return true;
    } else {
      soundSynth.playError(true);
      return false;
    }
  }, [masterSettings.masterPin]);

  const logoutSuperAdmin = useCallback(() => {
    setIsSuperAdminAuthenticated(false);
    setIsSuperAdminDashboardOpen(false);
    soundSynth.playClick(true);
  }, []);

  const updateCompanyPinByMaster = useCallback(
    (companyId: string, newPin: string) => {
      const cleaned = sanitizePin(newPin, '');
      if (!cleaned) return;
      setCompanies(prev => prev.map(c => (c.id === companyId ? { ...c, adminPin: cleaned } : c)));
      updateDoc(doc(db, 'companies', companyId), {
        adminPin: cleaned,
        updatedAt: serverTimestamp(),
      }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `companies/${companyId}`));
      soundSynth.playSuccess(true);
    },
    []
  );

  const updateCompanyCajaPinByMaster = useCallback(
    (companyId: string, newPin: string) => {
      const cleaned = sanitizePin(newPin, '');
      if (!cleaned) return;
      setCompanies(prev => prev.map(c => (c.id === companyId ? { ...c, cajaPin: cleaned } : c)));
      updateDoc(doc(db, 'companies', companyId), {
        cajaPin: cleaned,
        updatedAt: serverTimestamp(),
      }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `companies/${companyId}`));
      soundSynth.playSuccess(true);
    },
    []
  );

  const updateProviderPinByMaster = useCallback(
    (companyId: string, providerId: string, newPin: string) => {
      const cleaned = sanitizePin(newPin, '');
      if (!cleaned) return;
      setCompanies(prev =>
        prev.map(c =>
          c.id === companyId
            ? {
                ...c,
                providers: c.providers.map(p => (p.id === providerId ? { ...p, pin: cleaned } : p)),
              }
            : c
        )
      );
      updateDoc(doc(db, 'companies', companyId, 'providers', providerId), {
        pin: cleaned,
        updatedAt: serverTimestamp(),
      }).catch(err =>
        handleFirestoreError(err, OperationType.UPDATE, `companies/${companyId}/providers/${providerId}`)
      );
      soundSynth.playSuccess(true);
    },
    []
  );

  const updateCompanyByMaster = useCallback(
    (companyId: string, partial: Partial<Company>) => {
      setCompanies(prev => prev.map(c => (c.id === companyId ? { ...c, ...partial } : c)));
      if (partial.status) {
        updateDoc(doc(db, 'companies', companyId), {
          status: partial.status,
          updatedAt: serverTimestamp(),
        }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `companies/${companyId}`));
      }
      soundSynth.playSuccess(true);
    },
    []
  );

  const enterCompanyAsSuperAdmin = useCallback((companyId: string) => {
    const target = companies.find(c => c.id === companyId);
    if (!target) return;
    setActiveCompanyId(companyId);
    setIsAdminUnlocked(true);
    setIsCajaUnlocked(true);
    setUnlockedProviderId(null);
    setIsSuperAdminDashboardOpen(false);
    setActiveTab('admin');
    setCart([]);
    soundSynth.playSuccess(true);
  }, [companies]);

  // Consolidated global transactions across all companies
  const allGlobalTransactions = useMemo(() => {
    const list: Transaction[] = [];
    companies.forEach(comp => {
      comp.transactions.forEach(tx => {
        list.push({
          ...tx,
          companyId: comp.id,
          companyName: comp.name,
        });
      });
    });
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [companies]);

  const exportGlobalTransactionsCSV = useCallback(() => {
    const headers = ['ID', 'Empresa', 'Tipo', 'Sticker ID', 'Cliente', 'Monto USD', 'Monto Bs', 'Tasa BCV', 'Detalle', 'Metodo/Stand', 'Hora'];
    const rows = allGlobalTransactions.map(t => [
      t.id,
      `"${(t.companyName || '').replace(/"/g, '""')}"`,
      t.type,
      t.stickerId,
      `"${t.owner.replace(/"/g, '""')}"`,
      t.usd.toFixed(2),
      t.bs.toFixed(2),
      t.bcvRate.toFixed(2),
      `"${t.detail.replace(/"/g, '""')}"`,
      `"${(t.paymentMethod || t.provider || '').replace(/"/g, '""')}"`,
      `"${t.time}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `reporte_global_admin_supremo_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, [allGlobalTransactions]);

  // Company management
  const loginCompany = useCallback((companyId: string) => {
    const target = companies.find(c => c.id === companyId);
    if (!target) return;
    setActiveCompanyId(companyId);
    setIsAdminUnlocked(false);
    setIsCajaUnlocked(false);
    setUnlockedProviderId(null);
    setPendingProviderId(null);
    setShowProviderPinModal(false);
    setActiveTab('caja');
    setCart([]);
    soundSynth.playSuccess(target.settings.enableSound ?? true);
  }, [companies]);

  const logoutCompany = useCallback(() => {
    setActiveCompanyId(null);
    setIsAdminUnlocked(false);
    setIsCajaUnlocked(false);
    setUnlockedProviderId(null);
    setPendingProviderId(null);
    setShowProviderPinModal(false);
    setCart([]);
    soundSynth.playClick(true);
  }, []);

  const registerCompany = useCallback(
    (
      name: string,
      adminPin: string,
      cajaPin: string,
      logoEmoji: string = '🏪',
      description: string = '',
      initialBcvRate: number = 52.4,
      eventMode: EventMode = 'CASHLESS',
      coverImage: string = '',
      logoImage: string = '',
      options?: {
        isTrial24h?: boolean;
        commissionRate?: number;
        autoEnter?: boolean;
      }
    ): Company => {
      const id = `comp-${Date.now().toString(36)}`;
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || id;
      const cleanAdminPin = sanitizePin(adminPin, '1234');
      const cleanCajaPin = sanitizePin(cajaPin, '1111');
      const cleanBcv = initialBcvRate > 0 ? Number(initialBcvRate.toFixed(2)) : 52.4;
      const today = new Date().toISOString().slice(0, 10);
      const actorUid = getCompanyOwnerUid(null);
      const isCorp = eventMode === 'CORPORATE';
      const isTrial24h = Boolean(options?.isTrial24h);
      const expiresAt = isTrial24h ? Date.now() + 24 * 60 * 60 * 1000 : 0;
      const commissionRate =
        options?.commissionRate !== undefined
          ? Math.min(100, Math.max(0, Number(options.commissionRate) || 0))
          : masterSettingsRef.current.defaultEventCommissionRate ?? 8;

      const defaultAllowances: EmployeeAllowanceRule[] = isCorp ? DEFAULT_CORPORATE_RULES : [];

      const defaultProviders: ProviderAccount[] = isCorp
        ? [
            { id: `prov-${Date.now().toString(36)}-1`, brandName: 'Catering Corporativo', emoji: '🍽️', pin: '2001', createdAt: today },
            { id: `prov-${Date.now().toString(36)}-2`, brandName: 'Helados & Postres', emoji: '🍦', pin: '2002', createdAt: today },
            { id: `prov-${Date.now().toString(36)}-3`, brandName: 'Barra de Bebidas', emoji: '🥤', pin: '2003', createdAt: today },
          ]
        : [
            { id: `prov-${Date.now().toString(36)}-1`, brandName: 'Stand Principal', emoji: '🍔', pin: '2001', createdAt: today },
            { id: `prov-${Date.now().toString(36)}-2`, brandName: 'Barra de Bebidas', emoji: '🥤', pin: '2002', createdAt: today },
          ];

      const prod1Id = Date.now() + 1;
      const prod2Id = Date.now() + 2;
      const prod3Id = Date.now() + 3;

      const defaultProducts: Product[] = isCorp
        ? [
            { id: prod1Id, name: 'Almuerzo Ejecutivo', price: 8.5, emoji: '🍽️', provider: 'Catering Corporativo', category: 'Almuerzos' },
            { id: prod2Id, name: 'Helado Artesanal', price: 3.0, emoji: '🍦', provider: 'Helados & Postres', category: 'Helados' },
            { id: prod3Id, name: 'Bebida Refrescante', price: 2.0, emoji: '🥤', provider: 'Barra de Bebidas', category: 'Bebidas' },
          ]
        : [
            { id: prod1Id, name: 'Combo Especial de Bienvenida', price: 5.0, emoji: '🍔', provider: 'Stand Principal', category: 'Comida' },
            { id: prod2Id, name: 'Bebida Refrescante 400ml', price: 2.0, emoji: '🥤', provider: 'Barra de Bebidas', category: 'Bebidas' },
          ];

      const demoSticker: Sticker = isCorp
        ? {
            id: 'NFC-001',
            owner: 'Empleado Demo',
            department: 'General',
            balance: 0,
            color: 'from-blue-600 to-indigo-700',
            tagType: 'NTAG215',
            createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
            status: 'active',
            totalRecharged: 0,
            totalSpent: 0,
            quotas: buildQuotasFromAllowances(defaultAllowances),
          }
        : {
            id: 'NFC-001',
            owner: 'Cliente Demo (VIP)',
            balance: 20.0,
            color: 'from-blue-600 to-indigo-700',
            tagType: 'NTAG215',
            createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
            status: 'active',
            totalRecharged: 20.0,
            totalSpent: 0.0,
          };

      const newCompany: Company = {
        id,
        ownerUid: actorUid,
        name: clampStr(name, 120, 'Nueva Empresa'),
        slug: clampStr(slug, 120, id),
        description: clampStr(
          description,
          500,
          isCorp
            ? 'Evento corporativo con control de cupos y beneficios para empleados.'
            : 'Sistema de gestión de caja, proveedores y control NFC.'
        ),
        logoEmoji: clampStr(logoEmoji, 24, '🏪'),
        logoImage: sanitizeImageRef(logoImage, EVENT_LOGO_MAX_CHARS),
        coverImage: sanitizeImageRef(coverImage, EVENT_COVER_MAX_CHARS),
        eventMode,
        employeeAllowances: defaultAllowances,
        adminPin: cleanAdminPin,
        cajaPin: cleanCajaPin,
        providers: defaultProviders,
        createdAt: today,
        isTrial24h,
        expiresAt,
        status: 'active',
        settings: {
          ...INITIAL_SETTINGS,
          appName: clampStr(name, 120, 'Nueva Empresa'),
          subtitle: isCorp ? 'Evento Corporativo • Control de Beneficios NFC' : 'Cashless Oficial & Tasa BCV',
          bcvRate: cleanBcv,
          eventCommissionRate: commissionRate,
          primaryColor: '#2563eb',
          primaryHoverColor: '#1d4ed8',
          secondaryColor: '#10b981',
          bgColor: '#f8fafc',
        },
        stickers: [demoSticker],
        products: defaultProducts,
        transactions: [],
      };

      setCompanies(prev => [newCompany, ...prev]);

      const batch = writeBatch(db);
      const compPayload: Record<string, unknown> = {
        id,
        ownerUid: actorUid,
        name: newCompany.name,
        slug: newCompany.slug,
        description: newCompany.description || '',
        logoEmoji: newCompany.logoEmoji,
        eventMode: newCompany.eventMode,
        employeeAllowances: newCompany.employeeAllowances,
        adminPin: newCompany.adminPin,
        cajaPin: newCompany.cajaPin,
        appName: newCompany.settings.appName,
        subtitle: newCompany.settings.subtitle,
        bcvRate: newCompany.settings.bcvRate,
        eventCommissionRate: newCompany.settings.eventCommissionRate,
        primaryColor: newCompany.settings.primaryColor,
        primaryHoverColor: newCompany.settings.primaryHoverColor,
        secondaryColor: newCompany.settings.secondaryColor,
        bgColor: newCompany.settings.bgColor,
        enableSound: newCompany.settings.enableSound,
        enableVibration: newCompany.settings.enableVibration,
        isTrial24h,
        expiresAt,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (newCompany.logoImage) {
        compPayload.logoImage = newCompany.logoImage;
      }
      if (newCompany.coverImage) {
        compPayload.coverImage = newCompany.coverImage;
      }
      batch.set(doc(db, 'companies', id), compPayload);

      defaultProviders.forEach(prov => {
        batch.set(doc(db, 'companies', id, 'providers', prov.id), {
          id: prov.id,
          companyId: id,
          ownerUid: actorUid,
          brandName: prov.brandName,
          emoji: prov.emoji,
          pin: prov.pin,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      newCompany.stickers.forEach(st => {
        const stPayload: Record<string, unknown> = {
          id: st.id,
          companyId: id,
          ownerUid: actorUid,
          owner: st.owner,
          balance: st.balance,
          color: st.color,
          tagType: st.tagType,
          status: st.status,
          totalRecharged: st.totalRecharged,
          totalSpent: st.totalSpent,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (st.department) stPayload.department = st.department;
        if (st.quotas) stPayload.quotas = st.quotas;
        batch.set(doc(db, 'companies', id, 'stickers', st.id), stPayload);
      });

      newCompany.products.forEach(pr => {
        const pId = String(pr.id);
        batch.set(doc(db, 'companies', id, 'products', pId), {
          id: pId,
          companyId: id,
          ownerUid: actorUid,
          name: pr.name,
          price: pr.price,
          emoji: pr.emoji,
          provider: pr.provider,
          category: pr.category || 'General',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      batch.commit().catch(err => {
        try {
          handleFirestoreError(err, OperationType.CREATE, `companies/${id}`);
        } catch (e) {
          console.error('Firestore sync error in registerCompany:', e);
        }
      });

      if (options?.autoEnter !== false) {
        setActiveCompanyId(newCompany.id);
        setIsAdminUnlocked(false);
        setIsCajaUnlocked(false);
        setUnlockedProviderId(null);
        setActiveTab('caja');
        setCart([]);
      }
      soundSynth.playSuccess(true);
      return newCompany;
    },
    [getCompanyOwnerUid]
  );

  const deleteCompaniesBulk = useCallback(
    async (companyIds: string[]) => {
      if (companyIds.length === 0) return;
      const targetSet = new Set(companyIds);
      setCompanies(prev => prev.filter(c => !targetSet.has(c.id)));
      if (activeCompanyId && targetSet.has(activeCompanyId)) {
        logoutCompany();
      }

      try {
        const refsToDelete: ReturnType<typeof doc>[] = [];
        for (const cid of companyIds) {
          for (const sub of ['transactions', 'stickers', 'products', 'providers']) {
            const subSnap = await getDocs(collection(db, 'companies', cid, sub));
            subSnap.docs.forEach(d => refsToDelete.push(d.ref));
          }
          refsToDelete.push(doc(db, 'companies', cid));
        }
        await commitDeletesInChunks(refsToDelete);
        soundSynth.playSuccess(true);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `companies/bulk`);
      }
    },
    [activeCompanyId, logoutCompany, commitDeletesInChunks]
  );

  const deleteCompany = useCallback(
    (companyId: string) => {
      void deleteCompaniesBulk([companyId]);
    },
    [deleteCompaniesBulk]
  );

  const restoreDemoCompanies = useCallback(async () => {
    const actorUid = firebaseUser?.uid || PUBLIC_ACTOR_UID;
    try {
      await writeInitialCompaniesBatch(actorUid);
      soundSynth.playSuccess(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'companies/restore-demo');
    }
  }, [firebaseUser, writeInitialCompaniesBatch]);

  const updateCompanyLogoImage = useCallback(
    (logoImage: string) => {
      if (!currentCompany) return;
      const cleanLogo = sanitizeImageRef(logoImage, EVENT_LOGO_MAX_CHARS);
      updateCurrentCompany(c => ({
        ...c,
        logoImage: cleanLogo,
      }));
      updateDoc(doc(db, 'companies', currentCompany.id), {
        logoImage: cleanLogo,
        updatedAt: serverTimestamp(),
      }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `companies/${currentCompany.id}`));
      soundSynth.playSuccess(currentCompany.settings.enableSound);
    },
    [currentCompany, updateCurrentCompany]
  );

  const updateCompanyCoverImage = useCallback(
    (coverImage: string) => {
      if (!currentCompany) return;
      const cleanCover = sanitizeImageRef(coverImage, EVENT_COVER_MAX_CHARS);
      updateCurrentCompany(c => ({
        ...c,
        coverImage: cleanCover,
      }));
      updateDoc(doc(db, 'companies', currentCompany.id), {
        coverImage: cleanCover,
        updatedAt: serverTimestamp(),
      }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `companies/${currentCompany.id}`));
      soundSynth.playSuccess(currentCompany.settings.enableSound);
    },
    [currentCompany, updateCurrentCompany]
  );

  const updateCompanyEventMode = useCallback(
    (mode: EventMode) => {
      if (!currentCompany) return;
      const nextAllowances =
        mode === 'CORPORATE' && currentCompany.employeeAllowances.length === 0
          ? DEFAULT_CORPORATE_RULES
          : currentCompany.employeeAllowances;

      const nextSubtitle =
        mode === 'CORPORATE'
          ? 'Evento Corporativo • Control de Beneficios NFC'
          : 'Sistema Cashless & Tasa BCV';

      updateCurrentCompany(c => ({
        ...c,
        eventMode: mode,
        employeeAllowances: nextAllowances,
        settings: {
          ...c.settings,
          subtitle: nextSubtitle,
        },
      }));

      updateDoc(doc(db, 'companies', currentCompany.id), {
        eventMode: mode,
        employeeAllowances: nextAllowances,
        subtitle: nextSubtitle,
        updatedAt: serverTimestamp(),
      }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `companies/${currentCompany.id}`));

      soundSynth.playSuccess(currentCompany.settings.enableSound);
    },
    [currentCompany, updateCurrentCompany]
  );

  const updateEmployeeAllowances = useCallback(
    (rules: EmployeeAllowanceRule[]) => {
      if (!currentCompany) return;
      const sanitizedRules = rules.slice(0, 30).map(r => ({
        id: clampStr(r.id, 60, `rule-${Date.now()}`),
        label: clampStr(r.label, 80, 'Beneficio'),
        emoji: clampStr(r.emoji, 24, '🎁'),
        matchType: r.matchType === 'PRODUCT' ? 'PRODUCT' : 'CATEGORY',
        matchValue: clampStr(r.matchValue, 100, 'General'),
        maxQty: Math.max(1, Math.min(999, Math.round(Number(r.maxQty) || 1))),
      })) as EmployeeAllowanceRule[];

      updateCurrentCompany(c => ({
        ...c,
        employeeAllowances: sanitizedRules,
      }));

      updateDoc(doc(db, 'companies', currentCompany.id), {
        employeeAllowances: sanitizedRules,
        updatedAt: serverTimestamp(),
      }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `companies/${currentCompany.id}`));

      soundSynth.playSuccess(currentCompany.settings.enableSound);
    },
    [currentCompany, updateCurrentCompany]
  );

  // Company Admin PIN authorization
  const unlockAdminWithPin = useCallback(
    (pin: string): boolean => {
      if (!currentCompany) return false;
      const isCorrect =
        pin.trim() === currentCompany.adminPin.trim() || pin.trim() === masterSettings.masterPin.trim();
      if (isCorrect) {
        setIsAdminUnlocked(true);
        setShowPinModal(false);
        setActiveTab('admin');
        soundSynth.playSuccess(currentCompany.settings.enableSound);
        return true;
      } else {
        soundSynth.playError(currentCompany.settings.enableSound);
        return false;
      }
    },
    [currentCompany, masterSettings.masterPin]
  );

  const lockAdmin = useCallback(() => {
    setIsAdminUnlocked(false);
    if (activeTab === 'admin') {
      setActiveTab('caja');
    }
    soundSynth.playClick(currentCompany?.settings.enableSound ?? true);
  }, [activeTab, currentCompany]);

  const updateAdminPin = useCallback(
    (newPin: string) => {
      const cleaned = sanitizePin(newPin, '');
      if (!cleaned || !currentCompany) return;
      updateCurrentCompany(c => ({
        ...c,
        adminPin: cleaned,
      }));
      updateDoc(doc(db, 'companies', currentCompany.id), {
        adminPin: cleaned,
        updatedAt: serverTimestamp(),
      }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `companies/${currentCompany.id}`));
      soundSynth.playSuccess(currentCompany.settings.enableSound ?? true);
    },
    [updateCurrentCompany, currentCompany]
  );

  // Company Caja PIN authorization
  const unlockCajaWithPin = useCallback(
    (pin: string): boolean => {
      if (!currentCompany) return false;
      const isCorrect =
        pin.trim() === (currentCompany.cajaPin || '1111').trim() ||
        pin.trim() === masterSettings.masterPin.trim();
      if (isCorrect) {
        setIsCajaUnlocked(true);
        setShowCajaPinModal(false);
        soundSynth.playSuccess(currentCompany.settings.enableSound);
        return true;
      } else {
        soundSynth.playError(currentCompany.settings.enableSound);
        return false;
      }
    },
    [currentCompany, masterSettings.masterPin]
  );

  const lockCaja = useCallback(() => {
    setIsCajaUnlocked(false);
    soundSynth.playClick(currentCompany?.settings.enableSound ?? true);
  }, [currentCompany]);

  const updateCajaPin = useCallback(
    (newPin: string) => {
      const cleaned = sanitizePin(newPin, '');
      if (!cleaned || !currentCompany) return;
      updateCurrentCompany(c => ({
        ...c,
        cajaPin: cleaned,
      }));
      updateDoc(doc(db, 'companies', currentCompany.id), {
        cajaPin: cleaned,
        updatedAt: serverTimestamp(),
      }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `companies/${currentCompany.id}`));
      soundSynth.playSuccess(currentCompany.settings.enableSound ?? true);
    },
    [updateCurrentCompany, currentCompany]
  );

  // Provider Brands & PIN authorization
  const providers = useMemo(() => {
    return currentCompany ? currentCompany.providers : [];
  }, [currentCompany]);

  const activeProvider = useMemo(() => {
    if (!unlockedProviderId) return null;
    return providers.find(p => p.id === unlockedProviderId) || null;
  }, [providers, unlockedProviderId]);

  const openProviderPinPrompt = useCallback((providerId: string) => {
    setPendingProviderId(providerId);
    setShowProviderPinModal(true);
  }, []);

  const closeProviderPinPrompt = useCallback(() => {
    setShowProviderPinModal(false);
    setPendingProviderId(null);
  }, []);

  const unlockProviderWithPin = useCallback(
    (providerId: string, pin: string): boolean => {
      if (!currentCompany) return false;
      const target = currentCompany.providers.find(p => p.id === providerId);
      if (!target) return false;
      const isCorrect =
        pin.trim() === target.pin.trim() || pin.trim() === masterSettings.masterPin.trim();
      if (isCorrect) {
        setUnlockedProviderId(providerId);
        setShowProviderPinModal(false);
        setPendingProviderId(null);
        setCart([]);
        soundSynth.playSuccess(currentCompany.settings.enableSound);
        return true;
      } else {
        soundSynth.playError(currentCompany.settings.enableSound);
        return false;
      }
    },
    [currentCompany, masterSettings.masterPin]
  );

  const lockProvider = useCallback(() => {
    setUnlockedProviderId(null);
    setCart([]);
    soundSynth.playClick(currentCompany?.settings.enableSound ?? true);
  }, [currentCompany]);

  const addProviderWithProducts = useCallback(
    (
      brandName: string,
      emoji: string,
      pin: string,
      initialProducts: NewProviderProductDraft[]
    ): ProviderAccount | null => {
      if (!currentCompany) return null;
      const cleanBrand = clampStr(brandName, 100);
      if (!cleanBrand) return null;

      const cleanEmoji = clampStr(emoji, 24, '🏪');
      const cleanPin = sanitizePin(pin, '2001');
      const provId = `prov-${Date.now().toString(36)}`;
      const today = new Date().toISOString().slice(0, 10);

      const newProvider: ProviderAccount = {
        id: provId,
        brandName: cleanBrand,
        emoji: cleanEmoji,
        pin: cleanPin,
        createdAt: today,
      };

      const baseTimestamp = Date.now();
      const newProducts: Product[] = initialProducts
        .filter(item => item.name.trim().length > 0 && Number(item.price) > 0)
        .map((item, idx) => ({
          id: baseTimestamp + idx + 1,
          name: clampStr(item.name, 120),
          price: Math.max(0.1, Number(Number(item.price).toFixed(2))),
          emoji: clampStr(item.emoji, 24, '📦'),
          imageUrl: sanitizeImageRef(item.imageUrl, PRODUCT_IMAGE_MAX_CHARS),
          provider: cleanBrand,
          category: clampStr(item.category, 60, 'General'),
        }));

      updateCurrentCompany(c => ({
        ...c,
        providers: [...c.providers, newProvider],
        products: [...newProducts, ...c.products],
      }));

      const ownerUid = getCompanyOwnerUid(currentCompany);
      const batch = writeBatch(db);
      batch.set(doc(db, 'companies', currentCompany.id, 'providers', provId), {
        id: provId,
        companyId: currentCompany.id,
        ownerUid,
        brandName: newProvider.brandName,
        emoji: newProvider.emoji,
        pin: newProvider.pin,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      newProducts.forEach(pr => {
        const pId = String(pr.id);
        const prPayload: Record<string, unknown> = {
          id: pId,
          companyId: currentCompany.id,
          ownerUid,
          name: pr.name,
          price: pr.price,
          emoji: pr.emoji,
          provider: pr.provider,
          category: pr.category || 'General',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (pr.imageUrl) prPayload.imageUrl = pr.imageUrl;
        batch.set(doc(db, 'companies', currentCompany.id, 'products', pId), prPayload);
      });

      batch.commit().catch(err => {
        try {
          handleFirestoreError(err, OperationType.CREATE, `companies/${currentCompany.id}/providers/${provId}`);
        } catch (e) {
          console.error('Firestore sync error in addProviderWithProducts:', e);
        }
      });

      soundSynth.playSuccess(currentCompany.settings.enableSound);
      return newProvider;
    },
    [currentCompany, updateCurrentCompany, getCompanyOwnerUid]
  );

  const updateProviderPin = useCallback(
    (providerId: string, newPin: string) => {
      const cleaned = sanitizePin(newPin, '');
      if (!cleaned || !currentCompany) return;
      updateCurrentCompany(c => ({
        ...c,
        providers: c.providers.map(p => (p.id === providerId ? { ...p, pin: cleaned } : p)),
      }));
      updateDoc(doc(db, 'companies', currentCompany.id, 'providers', providerId), {
        pin: cleaned,
        updatedAt: serverTimestamp(),
      }).catch(err =>
        handleFirestoreError(err, OperationType.UPDATE, `companies/${currentCompany.id}/providers/${providerId}`)
      );
      soundSynth.playSuccess(currentCompany.settings.enableSound);
    },
    [currentCompany, updateCurrentCompany]
  );

  const deleteProviderBrand = useCallback(
    async (providerId: string) => {
      if (!currentCompany) return;
      const target = currentCompany.providers.find(p => p.id === providerId);
      if (!target) return;

      const productsToRemove = currentCompany.products.filter(p => p.provider === target.brandName);
      updateCurrentCompany(c => ({
        ...c,
        providers: c.providers.filter(p => p.id !== providerId),
        products: c.products.filter(p => p.provider !== target.brandName),
      }));

      if (unlockedProviderId === providerId) {
        setUnlockedProviderId(null);
        setCart([]);
      }

      const batch = writeBatch(db);
      batch.delete(doc(db, 'companies', currentCompany.id, 'providers', providerId));
      productsToRemove.forEach(pr => {
        batch.delete(doc(db, 'companies', currentCompany.id, 'products', String(pr.id)));
      });
      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `companies/${currentCompany.id}/providers/${providerId}`);
      }
    },
    [currentCompany, updateCurrentCompany, unlockedProviderId]
  );

  const requestNavigateTab = useCallback(
    (tab: ActiveTab) => {
      if (tab === 'admin') {
        if (isAdminUnlocked) {
          setActiveTab('admin');
        } else {
          setShowPinModal(true);
        }
      } else {
        setActiveTab(tab);
      }
    },
    [isAdminUnlocked]
  );

  // Settings & Theme for active company
  const settings = useMemo(() => {
    return currentCompany ? currentCompany.settings : INITIAL_SETTINGS;
  }, [currentCompany]);

  const updateSettings = useCallback(
    (partial: Partial<AppThemeSettings>) => {
      if (!currentCompany) return;
      const merged = { ...currentCompany.settings, ...partial };
      updateCurrentCompany(c => ({
        ...c,
        settings: merged,
      }));
      const payload: Record<string, unknown> = {
        appName: clampStr(merged.appName, 120, currentCompany.name),
        subtitle: clampStr(merged.subtitle, 160, 'Sistema Cashless & Tasa BCV'),
        bcvRate: merged.bcvRate > 0 ? Number(merged.bcvRate) : 52.4,
        eventCommissionRate: Math.min(100, Math.max(0, Number(merged.eventCommissionRate ?? 8))),
        primaryColor: sanitizeHex(merged.primaryColor, '#2563eb'),
        primaryHoverColor: sanitizeHex(merged.primaryHoverColor, '#1d4ed8'),
        secondaryColor: sanitizeHex(merged.secondaryColor, '#10b981'),
        bgColor: sanitizeHex(merged.bgColor, '#f8fafc'),
        enableSound: Boolean(merged.enableSound),
        enableVibration: Boolean(merged.enableVibration),
        updatedAt: serverTimestamp(),
      };
      updateDoc(doc(db, 'companies', currentCompany.id), payload).catch(err =>
        handleFirestoreError(err, OperationType.UPDATE, `companies/${currentCompany.id}`)
      );
    },
    [currentCompany, updateCurrentCompany]
  );

  const resetTheme = useCallback(() => {
    if (!currentCompany) return;
    updateSettings({
      appName: currentCompany.name,
      subtitle:
        currentCompany.eventMode === 'CORPORATE'
          ? 'Evento Corporativo • Control de Beneficios NFC'
          : 'Sistema Cashless & Tasa BCV',
      primaryColor: '#2563eb',
      primaryHoverColor: '#1d4ed8',
      secondaryColor: '#10b981',
      bgColor: '#f8fafc',
    });
  }, [currentCompany, updateSettings]);

  const setPresetTheme = useCallback(
    (primary: string, secondary: string, bg: string) => {
      updateSettings({
        primaryColor: primary,
        primaryHoverColor: primary,
        secondaryColor: secondary,
        bgColor: bg,
      });
    },
    [updateSettings]
  );

  // Stickers of active company
  const stickers = useMemo(() => {
    return currentCompany ? currentCompany.stickers : [];
  }, [currentCompany]);

  const addSticker = useCallback(
    (owner: string, initialBalance: number = 0, customColor?: string, department?: string): Sticker => {
      const nextNum = (stickers.length + 1).toString().padStart(3, '0');
      const uniqueSuffix = `-${Date.now().toString(36).slice(-3).toUpperCase()}`;
      const colors = [
        'from-blue-600 to-indigo-700',
        'from-emerald-600 to-teal-700',
        'from-purple-600 to-pink-600',
        'from-amber-600 to-orange-700',
        'from-rose-600 to-red-800',
        'from-cyan-600 to-blue-700',
      ];
      const color = customColor || colors[stickers.length % colors.length];
      const safeBalance =
        currentCompany?.eventMode === 'CORPORATE'
          ? 0
          : Math.max(0, Number(initialBalance.toFixed(2)));
      const stickerId = stickers.some(s => s.id === `NFC-${nextNum}`)
        ? `NFC-${nextNum}${uniqueSuffix}`
        : `NFC-${nextNum}`;

      const initialQuotas =
        currentCompany?.eventMode === 'CORPORATE'
          ? buildQuotasFromAllowances(currentCompany.employeeAllowances)
          : undefined;

      const newSticker: Sticker = {
        id: stickerId,
        owner: clampStr(owner, 100, `Asistente #${nextNum}`),
        department: department ? clampStr(department, 80) : undefined,
        balance: safeBalance,
        color: clampStr(color, 80, 'from-blue-600 to-indigo-700'),
        tagType: 'NTAG215',
        createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
        status: 'active',
        totalRecharged: safeBalance,
        totalSpent: 0,
        quotas: initialQuotas,
      };

      updateCurrentCompany(c => ({
        ...c,
        stickers: [...c.stickers, newSticker],
      }));

      if (currentCompany) {
        const ownerUid = getCompanyOwnerUid(currentCompany);
        const stPayload: Record<string, unknown> = {
          id: newSticker.id,
          companyId: currentCompany.id,
          ownerUid,
          owner: newSticker.owner,
          balance: newSticker.balance,
          color: newSticker.color,
          tagType: newSticker.tagType,
          status: newSticker.status,
          totalRecharged: newSticker.totalRecharged,
          totalSpent: newSticker.totalSpent,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (newSticker.department) stPayload.department = newSticker.department;
        if (newSticker.quotas) stPayload.quotas = newSticker.quotas;

        setDoc(doc(db, 'companies', currentCompany.id, 'stickers', newSticker.id), stPayload).catch(err =>
          handleFirestoreError(err, OperationType.CREATE, `companies/${currentCompany.id}/stickers/${newSticker.id}`)
        );
      }

      soundSynth.playSuccess(settings.enableSound);
      return newSticker;
    },
    [stickers, updateCurrentCompany, settings.enableSound, currentCompany, getCompanyOwnerUid]
  );

  const updateSticker = useCallback(
    (id: string, partial: Partial<Sticker>) => {
      if (!currentCompany) return;
      updateCurrentCompany(c => ({
        ...c,
        stickers: c.stickers.map(s => (s.id === id ? { ...s, ...partial } : s)),
      }));
      const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (partial.owner !== undefined) payload.owner = clampStr(partial.owner, 100, 'Cliente');
      if (partial.department !== undefined) payload.department = clampStr(partial.department, 80);
      if (partial.balance !== undefined) payload.balance = Math.max(0, Number(partial.balance));
      if (partial.color !== undefined) payload.color = clampStr(partial.color, 80);
      if (partial.status !== undefined) payload.status = partial.status;
      if (partial.totalRecharged !== undefined) payload.totalRecharged = Math.max(0, Number(partial.totalRecharged));
      if (partial.totalSpent !== undefined) payload.totalSpent = Math.max(0, Number(partial.totalSpent));
      if (partial.quotas !== undefined) payload.quotas = partial.quotas;

      updateDoc(doc(db, 'companies', currentCompany.id, 'stickers', id), payload).catch(err =>
        handleFirestoreError(err, OperationType.UPDATE, `companies/${currentCompany.id}/stickers/${id}`)
      );
    },
    [currentCompany, updateCurrentCompany]
  );

  const deleteSticker = useCallback(
    (id: string) => {
      if (!currentCompany) return;
      updateCurrentCompany(c => ({
        ...c,
        stickers: c.stickers.filter(s => s.id !== id),
      }));
      deleteDoc(doc(db, 'companies', currentCompany.id, 'stickers', id)).catch(err =>
        handleFirestoreError(err, OperationType.DELETE, `companies/${currentCompany.id}/stickers/${id}`)
      );
    },
    [currentCompany, updateCurrentCompany]
  );

  // Products of active company
  const products = useMemo(() => {
    return currentCompany ? currentCompany.products : [];
  }, [currentCompany]);

  const addProduct = useCallback(
    (prodData: Omit<Product, 'id'>): Product => {
      const cleanImg = sanitizeImageRef(prodData.imageUrl, PRODUCT_IMAGE_MAX_CHARS);
      const newProd: Product = {
        ...prodData,
        id: Date.now() * 100 + Math.floor(Math.random() * 100),
        name: clampStr(prodData.name, 120, 'Producto'),
        price: Math.max(0.1, Number(prodData.price.toFixed(2))),
        emoji: clampStr(prodData.emoji, 24, '📦'),
        imageUrl: cleanImg,
        provider: clampStr(prodData.provider, 100, 'General'),
        category: clampStr(prodData.category, 60, 'General'),
      };

      updateCurrentCompany(c => {
        const hasProvider = c.providers.some(p => p.brandName === newProd.provider);
        return {
          ...c,
          products: [newProd, ...c.products],
          providers: hasProvider
            ? c.providers
            : [
                ...c.providers,
                {
                  id: `prov-${Date.now().toString(36)}-${generateUniqueSuffix(4)}`,
                  brandName: newProd.provider,
                  emoji: newProd.emoji,
                  pin: '2001',
                  createdAt: new Date().toISOString().slice(0, 10),
                },
              ],
        };
      });

      if (currentCompany) {
        const ownerUid = getCompanyOwnerUid(currentCompany);
        const prodId = String(newProd.id);
        const prodPayload: Record<string, unknown> = {
          id: prodId,
          companyId: currentCompany.id,
          ownerUid,
          name: newProd.name,
          price: newProd.price,
          emoji: newProd.emoji,
          provider: newProd.provider,
          category: newProd.category || 'General',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        if (cleanImg) prodPayload.imageUrl = cleanImg;

        setDoc(doc(db, 'companies', currentCompany.id, 'products', prodId), prodPayload).catch(err =>
          handleFirestoreError(err, OperationType.CREATE, `companies/${currentCompany.id}/products/${prodId}`)
        );
      }

      soundSynth.playSuccess(settings.enableSound);
      return newProd;
    },
    [updateCurrentCompany, settings.enableSound, currentCompany, getCompanyOwnerUid]
  );

  const updateProduct = useCallback(
    (id: number, fields: Partial<Product>) => {
      if (!currentCompany) return;
      const cleanImg =
        fields.imageUrl !== undefined
          ? sanitizeImageRef(fields.imageUrl, PRODUCT_IMAGE_MAX_CHARS)
          : undefined;
      const sanitizedFields: Partial<Product> =
        cleanImg !== undefined ? { ...fields, imageUrl: cleanImg } : fields;

      updateCurrentCompany(c => ({
        ...c,
        products: c.products.map(p => (p.id === id ? { ...p, ...sanitizedFields } : p)),
      }));
      const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (fields.name !== undefined && fields.name.trim()) payload.name = clampStr(fields.name, 120);
      if (fields.price !== undefined && fields.price > 0) payload.price = Math.max(0.1, Number(fields.price));
      if (fields.emoji !== undefined) payload.emoji = clampStr(fields.emoji, 24, '📦');
      if (cleanImg !== undefined) payload.imageUrl = cleanImg;
      if (fields.provider !== undefined && fields.provider.trim()) payload.provider = clampStr(fields.provider, 100);
      if (fields.category !== undefined) payload.category = clampStr(fields.category, 60, 'General');

      if (Object.keys(payload).length > 1) {
        updateDoc(doc(db, 'companies', currentCompany.id, 'products', String(id)), payload).catch(err =>
          handleFirestoreError(err, OperationType.UPDATE, `companies/${currentCompany.id}/products/${id}`)
        );
      }
    },
    [currentCompany, updateCurrentCompany]
  );

  const deleteProduct = useCallback(
    (id: number) => {
      if (!currentCompany) return;
      updateCurrentCompany(c => ({
        ...c,
        products: c.products.filter(p => p.id !== id),
      }));
      setCart(prev => prev.filter(item => item.product.id !== id));
      deleteDoc(doc(db, 'companies', currentCompany.id, 'products', String(id))).catch(err =>
        handleFirestoreError(err, OperationType.DELETE, `companies/${currentCompany.id}/products/${id}`)
      );
    },
    [currentCompany, updateCurrentCompany]
  );

  // Cart
  const addToCart = useCallback(
    (product: Product) => {
      soundSynth.playClick(settings.enableSound);
      setCart(prev => {
        const existing = prev.find(item => item.product.id === product.id);
        if (existing) {
          return prev.map(item => (item.product.id === product.id ? { ...item, qty: item.qty + 1 } : item));
        }
        return [...prev, { product, qty: 1 }];
      });
    },
    [settings.enableSound]
  );

  const updateCartQty = useCallback(
    (productId: number, delta: number) => {
      soundSynth.playClick(settings.enableSound);
      setCart(prev => {
        return prev
          .map(item => {
            if (item.product.id === productId) {
              const nextQty = item.qty + delta;
              return nextQty > 0 ? { ...item, qty: nextQty } : null;
            }
            return item;
          })
          .filter((item): item is CartItem => item !== null);
      });
    },
    [settings.enableSound]
  );

  const removeFromCart = useCallback((productId: number) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const cartTotalUSD = useMemo(() => {
    const sum = cart.reduce((acc, item) => acc + item.product.price * item.qty, 0);
    return Number(sum.toFixed(2));
  }, [cart]);

  const cartTotalBs = useMemo(() => {
    return Number((cartTotalUSD * settings.bcvRate).toFixed(2));
  }, [cartTotalUSD, settings.bcvRate]);

  const cartItemCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.qty, 0);
  }, [cart]);

  // Transactions of active company
  const transactions = useMemo(() => {
    return currentCompany ? currentCompany.transactions : [];
  }, [currentCompany]);

  const buildTransactionRecord = useCallback(
    (txData: Omit<Transaction, 'id' | 'timestamp' | 'time'>): Transaction => {
      const now = Date.now();
      return {
        ...txData,
        id: `TX-${now.toString(36).toUpperCase()}-${generateUniqueSuffix(6)}`,
        timestamp: now,
        time: formatTime(now),
      };
    },
    []
  );

  const addTransaction = useCallback(
    (txData: Omit<Transaction, 'id' | 'timestamp' | 'time'>): Transaction => {
      const newTx = buildTransactionRecord(txData);
      updateCurrentCompany(c => ({
        ...c,
        transactions: [newTx, ...c.transactions],
      }));
      return newTx;
    },
    [buildTransactionRecord, updateCurrentCompany]
  );

  // NFC Modals
  const openNfcModal = useCallback(
    (config: NfcModalConfig) => {
      soundSynth.playNfcPing(settings.enableSound);
      setNfcModalConfig(config);
      setIsNfcModalOpen(true);
    },
    [settings.enableSound]
  );

  const closeNfcModal = useCallback(() => {
    setIsNfcModalOpen(false);
    setNfcModalConfig(null);
  }, []);

  const closeResultModal = useCallback(() => {
    setResultModal(prev => ({ ...prev, isOpen: false }));
  }, []);

  const toggleStickersDrawer = useCallback(() => {
    setIsStickersDrawerOpen(prev => !prev);
  }, []);

  // Process NFC Tap (Atomic Firestore runTransaction when online + IndexedDB batch fallback when offline)
  const processNfcTap = useCallback(
    async (stickerId: string, customAttendeeName?: string): Promise<boolean> => {
      if (!nfcModalConfig || !currentCompany) return false;

      const rawId = (stickerId || '').trim();
      const cleanId =
        rawId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) ||
        `NFC-${Date.now().toString(36).slice(-6).toUpperCase()}-${generateUniqueSuffix(4)}`;

      const localSticker = stickers.find(
        s =>
          s.id.toLowerCase() === cleanId.toLowerCase() ||
          s.id.replace(/^NFC-/, '').toLowerCase() === cleanId.replace(/^NFC-/, '').toLowerCase()
      );
      const targetStickerId = localSticker ? localSticker.id : cleanId;
      const isCorpMode = currentCompany.eventMode === 'CORPORATE';
      const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
      const companyId = currentCompany.id;
      const ownerUid = getCompanyOwnerUid(currentCompany);
      const stickerRef = doc(db, 'companies', companyId, 'stickers', targetStickerId);

      closeNfcModal();

      const mapStickerDoc = (id: string, sd: Record<string, unknown>): Sticker => ({
        id,
        owner: String(sd.owner || 'Cliente'),
        department: sd.department ? String(sd.department) : undefined,
        balance: Number(sd.balance) || 0,
        color: String(sd.color || 'from-blue-600 to-indigo-700'),
        tagType: (sd.tagType as Sticker['tagType']) || 'NTAG215',
        status: sd.status === 'blocked' ? 'blocked' : 'active',
        totalRecharged: Number(sd.totalRecharged) || 0,
        totalSpent: Number(sd.totalSpent) || 0,
        quotas: sd.quotas && typeof sd.quotas === 'object' ? (sd.quotas as Record<string, StickerQuotaProgress>) : undefined,
        createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      });

      const commitLocalUpdate = (activeSticker: Sticker, tx: Transaction, isNewTag: boolean) => {
        updateCurrentCompany(comp => ({
          ...comp,
          stickers: isNewTag || !comp.stickers.some(s => s.id === activeSticker.id)
            ? [...comp.stickers.filter(s => s.id !== activeSticker.id), activeSticker]
            : comp.stickers.map(s => (s.id === activeSticker.id ? activeSticker : s)),
          transactions: comp.transactions.some(t => t.id === tx.id)
            ? comp.transactions
            : [tx, ...comp.transactions],
        }));
      };

      const handleNfcError = (err: unknown, txId?: string): false => {
        if (err instanceof NfcBusinessError) {
          soundSynth.playError(settings.enableSound);
          const p = err.payload;
          if (err.code === 'NOT_FOUND') {
            setResultModal({
              isOpen: true,
              isSuccess: false,
              title: isCorpMode ? 'Pulsera No Acreditada' : 'Pulsera No Registrada',
              message: err.message,
            });
          } else if (err.code === 'BLOCKED') {
            setResultModal({
              isOpen: true,
              isSuccess: false,
              title: 'Pulsera Bloqueada',
              message: err.message,
            });
          } else if (err.code === 'INSUFFICIENT_BALANCE') {
            setResultModal({
              isOpen: true,
              isSuccess: false,
              title: 'Saldo Insuficiente',
              message: err.message,
              details: {
                stickerId: String(p.stickerId || targetStickerId),
                owner: String(p.owner || ''),
                prevBalance: Number(p.prevBalance || 0),
                amountUSD: Number(p.amountUSD || 0),
                missingUSD: Number(p.missingUSD || 0),
                bcvRate: settings.bcvRate,
              },
            });
          } else if (err.code === 'QUOTA_EXCEEDED' || err.code === 'INVALID_PRODUCT') {
            setResultModal({
              isOpen: true,
              isSuccess: false,
              title: err.code === 'INVALID_PRODUCT' ? 'Producto Fuera de Beneficio' : 'Cupo Agotado / Límite Excedido',
              message: err.message,
              details: {
                stickerId: String(p.stickerId || targetStickerId),
                owner: String(p.owner || ''),
                department: p.department ? String(p.department) : undefined,
                isCorporate: true,
                quotas: p.quotas as Record<string, StickerQuotaProgress> | undefined,
              },
            });
          }
          return false;
        }

        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.toLowerCase().includes('permission') || errMsg.toLowerCase().includes('insufficient')) {
          handleFirestoreError(err, OperationType.WRITE, `companies/${companyId}/transactions/${txId || 'nfc'}`);
        }

        soundSynth.playError(settings.enableSound);
        setResultModal({
          isOpen: true,
          isSuccess: false,
          title: 'Error de Sincronización',
          message: 'No se pudo completar la operación en la nube por conexión intermitente. Verifica tu señal e intenta de nuevo.',
        });
        return false;
      };

      // 1. MODE: QUERY (Consulta de Saldo o Cupos NFC - Authoritative server read when online)
      if (nfcModalConfig.mode === 'QUERY') {
        let sticker = localSticker;
        if (isOnline) {
          try {
            const snap = await getDoc(stickerRef);
            if (snap.exists()) {
              sticker = mapStickerDoc(snap.id, snap.data() as Record<string, unknown>);
            }
          } catch {
            // Fall back to local cached sticker when network is temporarily unavailable
          }
        }

        if (!sticker) {
          soundSynth.playError(settings.enableSound);
          setResultModal({
            isOpen: true,
            isSuccess: false,
            title: isCorpMode ? 'Pulsera No Acreditada' : 'Pulsera No Registrada',
            message: isCorpMode
              ? `La pulsera NFC (${cleanId}) aún no tiene beneficios corporativos asignados.`
              : `La pulsera NFC (${cleanId}) no tiene saldo ni ha sido activada en Caja aún.`,
          });
          return false;
        }

        soundSynth.playSuccess(settings.enableSound);

        if (isCorpMode) {
          const effectiveQuotas = buildQuotasFromAllowances(
            currentCompany.employeeAllowances,
            sticker.quotas
          );
          if (sticker.quotas) {
            Object.entries(sticker.quotas).forEach(([k, v]) => {
              if (!effectiveQuotas[k]) {
                effectiveQuotas[k] = v;
              }
            });
          }

          setResultModal({
            isOpen: true,
            isSuccess: true,
            title: 'Cupos de Empleado NFC',
            message: `Pulsera corporativa verificada correctamente.`,
            details: {
              stickerId: sticker.id,
              owner: sticker.owner,
              department: sticker.department,
              isCorporate: true,
              quotas: effectiveQuotas,
            },
          });
        } else {
          setResultModal({
            isOpen: true,
            isSuccess: true,
            title: 'Consulta de Saldo NFC',
            message: `Pulsera verificada correctamente.`,
            details: {
              stickerId: sticker.id,
              owner: sticker.owner,
              amountUSD: sticker.balance,
              amountBs: Number((sticker.balance * settings.bcvRate).toFixed(2)),
              newBalance: sticker.balance,
              bcvRate: settings.bcvRate,
              detail: `Total Recargado: ${formatUSD(sticker.totalRecharged || 0)} | Total Consumido: ${formatUSD(sticker.totalSpent || 0)}`,
            },
          });
        }
        return true;
      }

      // 2. MODE: ASSIGN_QUOTA (Corporate Caja Accreditation)
      if (nfcModalConfig.mode === 'ASSIGN_QUOTA') {
        const baseQuotas =
          nfcModalConfig.customQuotas ||
          buildQuotasFromAllowances(currentCompany.employeeAllowances);
        const count = stickers.length + 1;
        const shortHex = targetStickerId.replace(/^NFC-/, '').slice(-5).toUpperCase() || `${count}`;
        const txBaseId = `TX-${Date.now().toString(36).toUpperCase()}-${generateUniqueSuffix(6)}`;
        const colors = [
          'from-blue-600 to-indigo-700',
          'from-emerald-600 to-teal-700',
          'from-purple-600 to-pink-600',
          'from-amber-600 to-orange-700',
        ];

        const executeAssign = (
          existingData: Record<string, unknown> | null
        ): {
          isNewTag: boolean;
          activeSticker: Sticker;
          nextQuotas: Record<string, StickerQuotaProgress>;
          assignedDept: string;
          quotaSummary: string;
          tx: Transaction;
        } => {
          if (existingData && existingData.status === 'blocked') {
            throw new NfcBusinessError(
              'BLOCKED',
              `La pulsera ${targetStickerId} de ${String(existingData.owner || 'Empleado')} se encuentra bloqueada por seguridad.`
            );
          }

          const isNewTag = !existingData;
          const existingOwner = existingData?.owner ? String(existingData.owner) : undefined;
          const existingDept = existingData?.department ? String(existingData.department) : undefined;
          const existingQuotas =
            existingData?.quotas && typeof existingData.quotas === 'object'
              ? (existingData.quotas as Record<string, StickerQuotaProgress>)
              : undefined;

          const assignedOwner = clampStr(
            (customAttendeeName || nfcModalConfig.customAttendeeName || existingOwner || '').trim(),
            100,
            `Empleado #${count} (${shortHex})`
          );
          const assignedDept = clampStr(
            (nfcModalConfig.customDepartment || existingDept || 'General').trim(),
            80,
            'General'
          );

          const nextQuotas: Record<string, StickerQuotaProgress> = {};
          Object.entries(baseQuotas).forEach(([k, q]) => {
            const prevUsed = existingQuotas?.[k]?.used ?? 0;
            nextQuotas[k] = {
              ...q,
              used: Math.min(q.allowed, prevUsed),
            };
          });

          const activeSticker: Sticker = isNewTag
            ? {
                id: targetStickerId,
                owner: assignedOwner,
                department: assignedDept,
                balance: 0,
                totalRecharged: 0,
                totalSpent: 0,
                color: colors[stickers.length % colors.length],
                tagType: 'NTAG215',
                status: 'active',
                quotas: nextQuotas,
                createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
              }
            : {
                ...mapStickerDoc(targetStickerId, existingData!),
                owner: assignedOwner,
                department: assignedDept,
                quotas: nextQuotas,
              };

          const quotaSummary = Object.values(nextQuotas)
            .map(q => `${q.allowed}x ${q.label}`)
            .join(', ');

          const now = Date.now();
          const tx: Transaction = {
            id: txBaseId,
            type: 'ASIGNACION',
            stickerId: activeSticker.id,
            owner: activeSticker.owner,
            usd: 0,
            bs: 0,
            bcvRate: settings.bcvRate,
            detail: quotaSummary
              ? `Acreditación (${assignedDept}): ${quotaSummary}`
              : `Acreditación corporativa (${assignedDept})`,
            paymentMethod: 'Beneficio Corporativo',
            timestamp: now,
            time: formatTime(now),
          };

          return { isNewTag, activeSticker, nextQuotas, assignedDept, quotaSummary, tx };
        };

        try {
          let outcome: ReturnType<typeof executeAssign>;
          if (isOnline) {
            outcome = await runTransaction(db, async txRunner => {
              const snap = await txRunner.get(stickerRef);
              const res = executeAssign(snap.exists() ? (snap.data() as Record<string, unknown>) : null);
              if (res.isNewTag) {
                txRunner.set(stickerRef, {
                  id: res.activeSticker.id,
                  companyId,
                  ownerUid,
                  owner: res.activeSticker.owner,
                  department: res.assignedDept,
                  balance: 0,
                  color: res.activeSticker.color,
                  tagType: res.activeSticker.tagType,
                  status: res.activeSticker.status,
                  totalRecharged: 0,
                  totalSpent: 0,
                  quotas: res.nextQuotas,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
              } else {
                txRunner.update(stickerRef, {
                  owner: res.activeSticker.owner,
                  department: res.assignedDept,
                  quotas: res.nextQuotas,
                  updatedAt: serverTimestamp(),
                });
              }
              txRunner.set(doc(db, 'companies', companyId, 'transactions', res.tx.id), {
                id: res.tx.id,
                companyId,
                ownerUid,
                type: res.tx.type,
                stickerId: res.tx.stickerId,
                owner: clampStr(res.tx.owner, 100),
                usd: 0,
                bs: 0,
                bcvRate: res.tx.bcvRate,
                detail: clampStr(res.tx.detail, 500),
                paymentMethod: 'Beneficio Corporativo',
                time: res.tx.time,
                timestamp: res.tx.timestamp,
                createdAt: serverTimestamp(),
              });
              return res;
            });
          } else {
            const existingOffline = localSticker ? ({ ...localSticker } as unknown as Record<string, unknown>) : null;
            outcome = executeAssign(existingOffline);
            const batch = writeBatch(db);
            if (outcome.isNewTag) {
              batch.set(stickerRef, {
                id: outcome.activeSticker.id,
                companyId,
                ownerUid,
                owner: outcome.activeSticker.owner,
                department: outcome.assignedDept,
                balance: 0,
                color: outcome.activeSticker.color,
                tagType: outcome.activeSticker.tagType,
                status: outcome.activeSticker.status,
                totalRecharged: 0,
                totalSpent: 0,
                quotas: outcome.nextQuotas,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            } else {
              batch.update(stickerRef, {
                owner: outcome.activeSticker.owner,
                department: outcome.assignedDept,
                quotas: outcome.nextQuotas,
                updatedAt: serverTimestamp(),
              });
            }
            batch.set(doc(db, 'companies', companyId, 'transactions', outcome.tx.id), {
              id: outcome.tx.id,
              companyId,
              ownerUid,
              type: outcome.tx.type,
              stickerId: outcome.tx.stickerId,
              owner: clampStr(outcome.tx.owner, 100),
              usd: 0,
              bs: 0,
              bcvRate: outcome.tx.bcvRate,
              detail: clampStr(outcome.tx.detail, 500),
              paymentMethod: 'Beneficio Corporativo',
              time: outcome.tx.time,
              timestamp: outcome.tx.timestamp,
              createdAt: serverTimestamp(),
            });
            await batch.commit();
          }

          commitLocalUpdate(outcome.activeSticker, outcome.tx, outcome.isNewTag);
          soundSynth.playSuccess(settings.enableSound);
          try {
            confetti({ particleCount: 55, spread: 60, origin: { y: 0.65 } });
          } catch {
            // ignore
          }

          setResultModal({
            isOpen: true,
            isSuccess: true,
            title: outcome.isNewTag ? '¡Empleado Acreditado!' : '¡Cupos Actualizados!',
            message: `La pulsera ${outcome.activeSticker.id} de ${outcome.activeSticker.owner} (${outcome.assignedDept}) está lista para retirar sus beneficios.`,
            details: {
              stickerId: outcome.activeSticker.id,
              owner: outcome.activeSticker.owner,
              department: outcome.assignedDept,
              isCorporate: true,
              quotas: outcome.nextQuotas,
              detail: outcome.quotaSummary,
            },
            transaction: outcome.tx,
          });
          return true;
        } catch (err) {
          return handleNfcError(err, txBaseId);
        }
      }

      // 3. MODE: RECHARGE (Cashless Caja — Atomic Server Increment via runTransaction)
      if (nfcModalConfig.mode === 'RECHARGE') {
        const amountUSD = Number(nfcModalConfig.amountUSD.toFixed(2));
        const amountBs = Number((amountUSD * settings.bcvRate).toFixed(2));
        const paymentMethod = nfcModalConfig.paymentMethod || 'Efectivo USD';
        const txBaseId = `TX-${Date.now().toString(36).toUpperCase()}-${generateUniqueSuffix(6)}`;
        const count = stickers.length + 1;
        const shortHex = targetStickerId.replace(/^NFC-/, '').slice(-5).toUpperCase() || `${count}`;
        const colors = [
          'from-blue-600 to-indigo-700',
          'from-emerald-600 to-teal-700',
          'from-purple-600 to-pink-600',
          'from-amber-600 to-orange-700',
          'from-rose-600 to-red-800',
          'from-cyan-600 to-blue-700',
        ];

        const executeRecharge = (
          existingData: Record<string, unknown> | null
        ): {
          isNewTag: boolean;
          prevBalance: number;
          activeSticker: Sticker;
          tx: Transaction;
        } => {
          if (existingData && existingData.status === 'blocked') {
            throw new NfcBusinessError(
              'BLOCKED',
              `La pulsera ${targetStickerId} de ${String(existingData.owner || 'Cliente')} se encuentra bloqueada por seguridad.`
            );
          }

          const isNewTag = !existingData;
          let activeSticker: Sticker;
          let prevBalance = 0;

          if (isNewTag) {
            const assignedOwner =
              (customAttendeeName || nfcModalConfig.customAttendeeName || '').trim() ||
              `Pulsera #${count} (${shortHex})`;

            activeSticker = {
              id: targetStickerId,
              owner: clampStr(assignedOwner, 100),
              balance: amountUSD,
              totalRecharged: amountUSD,
              totalSpent: 0,
              color: colors[stickers.length % colors.length],
              tagType: 'NTAG215',
              status: 'active',
              createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
            };
          } else {
            prevBalance = Number(existingData!.balance) || 0;
            const newBalance = Number((prevBalance + amountUSD).toFixed(2));
            const nextTotalRecharged = Number(((Number(existingData!.totalRecharged) || 0) + amountUSD).toFixed(2));

            activeSticker = {
              ...mapStickerDoc(targetStickerId, existingData!),
              balance: newBalance,
              totalRecharged: nextTotalRecharged,
            };
          }

          const now = Date.now();
          const tx: Transaction = {
            id: txBaseId,
            type: 'RECARGA',
            stickerId: activeSticker.id,
            owner: activeSticker.owner,
            usd: amountUSD,
            bs: amountBs,
            bcvRate: settings.bcvRate,
            detail: isNewTag
              ? `Activación y Primera Recarga en Caja (${paymentMethod})`
              : `Recarga en Caja (${paymentMethod})`,
            paymentMethod,
            timestamp: now,
            time: formatTime(now),
          };

          return { isNewTag, prevBalance, activeSticker, tx };
        };

        try {
          let outcome: ReturnType<typeof executeRecharge>;
          if (isOnline) {
            outcome = await runTransaction(db, async txRunner => {
              const snap = await txRunner.get(stickerRef);
              const res = executeRecharge(snap.exists() ? (snap.data() as Record<string, unknown>) : null);
              if (res.isNewTag) {
                txRunner.set(stickerRef, {
                  id: res.activeSticker.id,
                  companyId,
                  ownerUid,
                  owner: clampStr(res.activeSticker.owner, 100),
                  balance: res.activeSticker.balance,
                  color: res.activeSticker.color,
                  tagType: res.activeSticker.tagType,
                  status: res.activeSticker.status,
                  totalRecharged: res.activeSticker.totalRecharged,
                  totalSpent: res.activeSticker.totalSpent,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
              } else {
                txRunner.update(stickerRef, {
                  balance: res.activeSticker.balance,
                  totalRecharged: res.activeSticker.totalRecharged,
                  updatedAt: serverTimestamp(),
                });
              }
              txRunner.set(doc(db, 'companies', companyId, 'transactions', res.tx.id), {
                id: res.tx.id,
                companyId,
                ownerUid,
                type: res.tx.type,
                stickerId: res.tx.stickerId,
                owner: clampStr(res.tx.owner, 100),
                usd: res.tx.usd,
                bs: res.tx.bs,
                bcvRate: res.tx.bcvRate,
                detail: clampStr(res.tx.detail, 500),
                paymentMethod: paymentMethod.slice(0, 60),
                time: res.tx.time,
                timestamp: res.tx.timestamp,
                createdAt: serverTimestamp(),
              });
              return res;
            });
          } else {
            const existingOffline = localSticker ? ({ ...localSticker } as unknown as Record<string, unknown>) : null;
            outcome = executeRecharge(existingOffline);
            const batch = writeBatch(db);
            if (outcome.isNewTag) {
              batch.set(stickerRef, {
                id: outcome.activeSticker.id,
                companyId,
                ownerUid,
                owner: clampStr(outcome.activeSticker.owner, 100),
                balance: outcome.activeSticker.balance,
                color: outcome.activeSticker.color,
                tagType: outcome.activeSticker.tagType,
                status: outcome.activeSticker.status,
                totalRecharged: outcome.activeSticker.totalRecharged,
                totalSpent: outcome.activeSticker.totalSpent,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            } else {
              batch.update(stickerRef, {
                balance: outcome.activeSticker.balance,
                totalRecharged: outcome.activeSticker.totalRecharged,
                updatedAt: serverTimestamp(),
              });
            }
            batch.set(doc(db, 'companies', companyId, 'transactions', outcome.tx.id), {
              id: outcome.tx.id,
              companyId,
              ownerUid,
              type: outcome.tx.type,
              stickerId: outcome.tx.stickerId,
              owner: clampStr(outcome.tx.owner, 100),
              usd: outcome.tx.usd,
              bs: outcome.tx.bs,
              bcvRate: outcome.tx.bcvRate,
              detail: clampStr(outcome.tx.detail, 500),
              paymentMethod: paymentMethod.slice(0, 60),
              time: outcome.tx.time,
              timestamp: outcome.tx.timestamp,
              createdAt: serverTimestamp(),
            });
            await batch.commit();
          }

          commitLocalUpdate(outcome.activeSticker, outcome.tx, outcome.isNewTag);
          soundSynth.playSuccess(settings.enableSound);
          try {
            confetti({
              particleCount: 65,
              spread: 60,
              origin: { y: 0.65 },
            });
          } catch {
            // ignore
          }

          setResultModal({
            isOpen: true,
            isSuccess: true,
            title: outcome.isNewTag ? '¡Pulsera Activada y Cargada!' : '¡Recarga Exitosa!',
            message: outcome.isNewTag
              ? `Se ha activado la pulsera ${outcome.activeSticker.id} de ${outcome.activeSticker.owner} con ${formatUSD(amountUSD)} de saldo inicial.`
              : `Se han acreditado ${formatUSD(amountUSD)} a ${outcome.activeSticker.owner}.`,
            details: {
              stickerId: outcome.activeSticker.id,
              owner: outcome.activeSticker.owner,
              amountUSD,
              amountBs,
              prevBalance: outcome.prevBalance,
              newBalance: outcome.activeSticker.balance,
              bcvRate: settings.bcvRate,
              detail: outcome.isNewTag ? `Activación nueva • Método: ${paymentMethod}` : `Método: ${paymentMethod}`,
            },
            transaction: outcome.tx,
          });

          return true;
        } catch (err) {
          return handleNfcError(err, txBaseId);
        }
      }

      // 4. MODE: CHARGE (Proveedores / Stands — Atomic runTransaction for both CASHLESS & CORPORATE)
      if (nfcModalConfig.mode === 'CHARGE') {
        const totalUSD = Number(nfcModalConfig.amountUSD.toFixed(2));
        const amountBs = Number((totalUSD * settings.bcvRate).toFixed(2));
        const summaryItems = cart.map(i => `${i.qty}x ${i.product.name}`).join(', ');
        const cartSnapshot = cart.slice(0, 50).map(i => ({
          name: i.product.name,
          qty: i.qty,
          price: i.product.price,
          emoji: i.product.emoji,
          provider: i.product.provider,
        }));
        const provider = activeProvider?.brandName || (cart.length > 0 ? cart[0].product.provider : 'Varios');
        const txBaseId = `TX-${Date.now().toString(36).toUpperCase()}-${generateUniqueSuffix(6)}`;

        const executeCharge = (existingData: Record<string, unknown> | null) => {
          if (!existingData) {
            throw new NfcBusinessError(
              'NOT_FOUND',
              isCorpMode
                ? `La pulsera NFC (${cleanId}) no está acreditada para este evento empresarial. El empleado debe acudir primero a Acreditación / Caja.`
                : `La pulsera NFC (${cleanId}) no está activada en el sistema. El cliente debe acudir a Caja primero para registrarla y recargar saldo.`
            );
          }

          if (existingData.status === 'blocked') {
            throw new NfcBusinessError(
              'BLOCKED',
              `La pulsera ${targetStickerId} de ${String(existingData.owner || 'Cliente')} se encuentra bloqueada por seguridad.`
            );
          }

          const serverSticker = mapStickerDoc(targetStickerId, existingData);

          if (isCorpMode) {
            const currentQuotas: Record<string, StickerQuotaProgress> = buildQuotasFromAllowances(
              currentCompany.employeeAllowances,
              serverSticker.quotas
            );
            if (serverSticker.quotas) {
              Object.entries(serverSticker.quotas).forEach(([k, v]) => {
                if (!currentQuotas[k]) {
                  currentQuotas[k] = { ...v };
                }
              });
            }

            const quotaList = Object.values(currentQuotas);
            const requestedByRule: Record<string, number> = {};

            for (const item of cart) {
              const prodIdStr = String(item.product.id);
              const catLower = (item.product.category || 'General').trim().toLowerCase();

              const matchedRule =
                quotaList.find(q => q.matchType === 'PRODUCT' && q.matchValue === prodIdStr) ||
                quotaList.find(
                  q => q.matchType === 'CATEGORY' && q.matchValue.trim().toLowerCase() === catLower
                );

              if (!matchedRule) {
                throw new NfcBusinessError(
                  'INVALID_PRODUCT',
                  `El artículo "${item.product.name}" (${item.product.category || 'General'}) no está incluido en las reglas de beneficios configuradas para este evento.`,
                  {
                    stickerId: serverSticker.id,
                    owner: serverSticker.owner,
                    department: serverSticker.department,
                    quotas: currentQuotas,
                  }
                );
              }

              requestedByRule[matchedRule.ruleId] = (requestedByRule[matchedRule.ruleId] || 0) + item.qty;
            }

            for (const [ruleId, reqQty] of Object.entries(requestedByRule)) {
              const rule = currentQuotas[ruleId];
              const remaining = Math.max(0, rule.allowed - rule.used);
              if (rule.used + reqQty > rule.allowed) {
                throw new NfcBusinessError(
                  'QUOTA_EXCEEDED',
                  `${serverSticker.owner} solo tiene ${remaining} de ${rule.allowed} ${rule.emoji} ${rule.label} disponibles (intenta retirar ${reqQty}).`,
                  {
                    stickerId: serverSticker.id,
                    owner: serverSticker.owner,
                    department: serverSticker.department,
                    quotas: currentQuotas,
                  }
                );
              }
            }

            const nextQuotas: Record<string, StickerQuotaProgress> = {};
            Object.entries(currentQuotas).forEach(([ruleId, q]) => {
              const delta = requestedByRule[ruleId] || 0;
              nextQuotas[ruleId] = {
                ...q,
                used: q.used + delta,
              };
            });

            const nextTotalSpent = Number(((serverSticker.totalSpent || 0) + totalUSD).toFixed(2));
            const updatedSticker: Sticker = {
              ...serverSticker,
              quotas: nextQuotas,
              totalSpent: nextTotalSpent,
            };

            const now = Date.now();
            const tx: Transaction = {
              id: txBaseId,
              type: 'RETIRO',
              stickerId: serverSticker.id,
              owner: serverSticker.owner,
              usd: totalUSD,
              bs: amountBs,
              bcvRate: settings.bcvRate,
              detail: summaryItems || 'Entrega de Beneficio Corporativo',
              provider,
              paymentMethod: 'Beneficio Corporativo',
              cartSnapshot,
              timestamp: now,
              time: formatTime(now),
            };

            return {
              mode: 'CORPORATE' as const,
              prevBalance: serverSticker.balance,
              updatedSticker,
              nextQuotas,
              tx,
            };
          } else {
            const prevBalance = serverSticker.balance;
            if (prevBalance < totalUSD) {
              const missingUSD = Number((totalUSD - prevBalance).toFixed(2));
              throw new NfcBusinessError(
                'INSUFFICIENT_BALANCE',
                `La pulsera de ${serverSticker.owner} no cuenta con fondos suficientes para pagar esta orden.`,
                {
                  stickerId: serverSticker.id,
                  owner: serverSticker.owner,
                  prevBalance,
                  amountUSD: totalUSD,
                  missingUSD,
                }
              );
            }

            const newBalance = Number((prevBalance - totalUSD).toFixed(2));
            const nextTotalSpent = Number(((serverSticker.totalSpent || 0) + totalUSD).toFixed(2));
            const updatedSticker: Sticker = {
              ...serverSticker,
              balance: newBalance,
              totalSpent: nextTotalSpent,
            };

            const now = Date.now();
            const tx: Transaction = {
              id: txBaseId,
              type: 'CONSUMO',
              stickerId: serverSticker.id,
              owner: serverSticker.owner,
              usd: totalUSD,
              bs: amountBs,
              bcvRate: settings.bcvRate,
              detail: summaryItems || 'Consumo en Stand',
              provider,
              cartSnapshot,
              timestamp: now,
              time: formatTime(now),
            };

            return {
              mode: 'CASHLESS' as const,
              prevBalance,
              updatedSticker,
              nextQuotas: undefined,
              tx,
            };
          }
        };

        try {
          let outcome: ReturnType<typeof executeCharge>;
          if (isOnline) {
            outcome = await runTransaction(db, async txRunner => {
              const snap = await txRunner.get(stickerRef);
              const res = executeCharge(snap.exists() ? (snap.data() as Record<string, unknown>) : null);

              if (res.mode === 'CORPORATE') {
                txRunner.update(stickerRef, {
                  quotas: res.nextQuotas,
                  totalSpent: res.updatedSticker.totalSpent,
                  updatedAt: serverTimestamp(),
                });
              } else {
                txRunner.update(stickerRef, {
                  balance: res.updatedSticker.balance,
                  totalSpent: res.updatedSticker.totalSpent,
                  updatedAt: serverTimestamp(),
                });
              }

              const txPayload: Record<string, unknown> = {
                id: res.tx.id,
                companyId,
                ownerUid,
                type: res.tx.type,
                stickerId: res.tx.stickerId,
                owner: clampStr(res.tx.owner, 100),
                usd: res.tx.usd,
                bs: res.tx.bs,
                bcvRate: res.tx.bcvRate,
                detail: clampStr(res.tx.detail, 500),
                provider: clampStr(provider, 100),
                time: res.tx.time,
                timestamp: res.tx.timestamp,
                cartSnapshot,
                createdAt: serverTimestamp(),
              };
              if (res.mode === 'CORPORATE') {
                txPayload.paymentMethod = 'Beneficio Corporativo';
              }
              txRunner.set(doc(db, 'companies', companyId, 'transactions', res.tx.id), txPayload);
              return res;
            });
          } else {
            const existingOffline = localSticker ? ({ ...localSticker } as unknown as Record<string, unknown>) : null;
            outcome = executeCharge(existingOffline);
            const batch = writeBatch(db);
            if (outcome.mode === 'CORPORATE') {
              batch.update(stickerRef, {
                quotas: outcome.nextQuotas,
                totalSpent: outcome.updatedSticker.totalSpent,
                updatedAt: serverTimestamp(),
              });
            } else {
              batch.update(stickerRef, {
                balance: outcome.updatedSticker.balance,
                totalSpent: outcome.updatedSticker.totalSpent,
                updatedAt: serverTimestamp(),
              });
            }
            const txPayload: Record<string, unknown> = {
              id: outcome.tx.id,
              companyId,
              ownerUid,
              type: outcome.tx.type,
              stickerId: outcome.tx.stickerId,
              owner: clampStr(outcome.tx.owner, 100),
              usd: outcome.tx.usd,
              bs: outcome.tx.bs,
              bcvRate: outcome.tx.bcvRate,
              detail: clampStr(outcome.tx.detail, 500),
              provider: clampStr(provider, 100),
              time: outcome.tx.time,
              timestamp: outcome.tx.timestamp,
              cartSnapshot,
              createdAt: serverTimestamp(),
            };
            if (outcome.mode === 'CORPORATE') {
              txPayload.paymentMethod = 'Beneficio Corporativo';
            }
            batch.set(doc(db, 'companies', companyId, 'transactions', outcome.tx.id), txPayload);
            await batch.commit();
          }

          commitLocalUpdate(outcome.updatedSticker, outcome.tx, false);
          setCart([]);
          soundSynth.playSuccess(settings.enableSound);
          try {
            confetti({
              particleCount: 50,
              spread: 70,
              origin: { y: 0.6 },
              colors:
                outcome.mode === 'CORPORATE'
                  ? ['#10b981', '#34d399', '#2563eb', '#60a5fa']
                  : ['#10b981', '#34d399', '#6ee7b7', '#2563eb'],
            });
          } catch {
            // ignore
          }

          if (outcome.mode === 'CORPORATE') {
            setResultModal({
              isOpen: true,
              isSuccess: true,
              title: '¡Entrega Corporativa Aprobada!',
              message: `Beneficio descontado de la pulsera de ${outcome.updatedSticker.owner}. Sin cobro al empleado.`,
              details: {
                stickerId: outcome.updatedSticker.id,
                owner: outcome.updatedSticker.owner,
                department: outcome.updatedSticker.department,
                amountUSD: totalUSD,
                amountBs,
                detail: summaryItems,
                bcvRate: settings.bcvRate,
                isCorporate: true,
                quotas: outcome.nextQuotas,
                consumedItems: cart.map(i => `${i.qty}x ${i.product.emoji} ${i.product.name}`),
              },
              transaction: outcome.tx,
            });
          } else {
            setResultModal({
              isOpen: true,
              isSuccess: true,
              title: '¡Pago Aprobado!',
              message: `Cobro procesado exitosamente con la pulsera NFC de ${outcome.updatedSticker.owner}.`,
              details: {
                stickerId: outcome.updatedSticker.id,
                owner: outcome.updatedSticker.owner,
                amountUSD: totalUSD,
                amountBs,
                prevBalance: outcome.prevBalance,
                newBalance: outcome.updatedSticker.balance,
                detail: summaryItems,
                bcvRate: settings.bcvRate,
              },
              transaction: outcome.tx,
            });
          }

          return true;
        } catch (err) {
          return handleNfcError(err, txBaseId);
        }
      }

      return false;
    },
    [
      nfcModalConfig,
      currentCompany,
      stickers,
      settings.bcvRate,
      settings.enableSound,
      updateCurrentCompany,
      cart,
      closeNfcModal,
      activeProvider,
      getCompanyOwnerUid,
    ]
  );

  const deleteStickersBulk = useCallback(
    async (stickerIds: string[], alsoDeleteTransactions = false) => {
      if (!currentCompany || stickerIds.length === 0) return;
      const targetSet = new Set(stickerIds);
      const txToDelete = alsoDeleteTransactions
        ? currentCompany.transactions.filter(t => targetSet.has(t.stickerId)).map(t => t.id)
        : [];
      const txSet = new Set(txToDelete);

      updateCurrentCompany(c => ({
        ...c,
        stickers: c.stickers.filter(s => !targetSet.has(s.id)),
        transactions: alsoDeleteTransactions
          ? c.transactions.filter(t => !txSet.has(t.id))
          : c.transactions,
      }));

      try {
        const refs: ReturnType<typeof doc>[] = [
          ...stickerIds.map(id => doc(db, 'companies', currentCompany.id, 'stickers', id)),
          ...txToDelete.map(txId => doc(db, 'companies', currentCompany.id, 'transactions', txId)),
        ];
        await commitDeletesInChunks(refs);
        soundSynth.playSuccess(currentCompany.settings.enableSound);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `companies/${currentCompany.id}/stickers`);
      }
    },
    [currentCompany, updateCurrentCompany, commitDeletesInChunks]
  );

  const deleteTransactionsBulk = useCallback(
    async (transactionIds: string[]) => {
      if (!currentCompany || transactionIds.length === 0) return;
      const targetSet = new Set(transactionIds);
      updateCurrentCompany(c => ({
        ...c,
        transactions: c.transactions.filter(t => !targetSet.has(t.id)),
      }));

      try {
        const refs = transactionIds.map(id => doc(db, 'companies', currentCompany.id, 'transactions', id));
        await commitDeletesInChunks(refs);
        soundSynth.playSuccess(currentCompany.settings.enableSound);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `companies/${currentCompany.id}/transactions`);
      }
    },
    [currentCompany, updateCurrentCompany, commitDeletesInChunks]
  );

  const deleteGlobalTransactionsBulk = useCallback(
    async (items: { companyId: string; id: string }[]) => {
      if (items.length === 0) return;
      const byCompany = new Map<string, Set<string>>();
      items.forEach(({ companyId, id }) => {
        if (!companyId || !id) return;
        const set = byCompany.get(companyId) || new Set<string>();
        set.add(id);
        byCompany.set(companyId, set);
      });

      setCompanies(prev =>
        prev.map(comp => {
          const idSet = byCompany.get(comp.id);
          if (!idSet) return comp;
          return {
            ...comp,
            transactions: comp.transactions.filter(t => !idSet.has(t.id)),
          };
        })
      );

      try {
        const refs = items
          .filter(i => i.companyId && i.id)
          .map(i => doc(db, 'companies', i.companyId, 'transactions', i.id));
        await commitDeletesInChunks(refs);
        soundSynth.playSuccess(true);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `companies/global-transactions`);
      }
    },
    [commitDeletesInChunks]
  );

  const deleteProductsBulk = useCallback(
    async (productIds: number[]) => {
      if (!currentCompany || productIds.length === 0) return;
      const targetSet = new Set(productIds);
      updateCurrentCompany(c => ({
        ...c,
        products: c.products.filter(p => !targetSet.has(p.id)),
      }));
      setCart(prev => prev.filter(item => !targetSet.has(item.product.id)));

      try {
        const refs = productIds.map(id => doc(db, 'companies', currentCompany.id, 'products', String(id)));
        await commitDeletesInChunks(refs);
        soundSynth.playSuccess(currentCompany.settings.enableSound);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `companies/${currentCompany.id}/products`);
      }
    },
    [currentCompany, updateCurrentCompany, commitDeletesInChunks]
  );

  const deleteProvidersBulk = useCallback(
    async (providerIds: string[]) => {
      if (!currentCompany || providerIds.length === 0) return;
      const targetSet = new Set(providerIds);
      const removedBrands = new Set(
        currentCompany.providers.filter(p => targetSet.has(p.id)).map(p => p.brandName)
      );
      const productsToRemove = currentCompany.products.filter(p => removedBrands.has(p.provider));

      updateCurrentCompany(c => ({
        ...c,
        providers: c.providers.filter(p => !targetSet.has(p.id)),
        products: c.products.filter(p => !removedBrands.has(p.provider)),
      }));

      if (unlockedProviderId && targetSet.has(unlockedProviderId)) {
        setUnlockedProviderId(null);
        setCart([]);
      }

      try {
        const refs = [
          ...providerIds.map(id => doc(db, 'companies', currentCompany.id, 'providers', id)),
          ...productsToRemove.map(pr => doc(db, 'companies', currentCompany.id, 'products', String(pr.id))),
        ];
        await commitDeletesInChunks(refs);
        soundSynth.playSuccess(currentCompany.settings.enableSound);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `companies/${currentCompany.id}/providers`);
      }
    },
    [currentCompany, updateCurrentCompany, unlockedProviderId, commitDeletesInChunks]
  );

  const wipeCurrentCompanyTestData = useCallback(
    async (options: {
      stickers: boolean;
      transactions: boolean;
      products?: boolean;
      providers?: boolean;
    }) => {
      if (!currentCompany) return;
      const cid = currentCompany.id;

      const stickerIds = options.stickers ? currentCompany.stickers.map(s => s.id) : [];
      const txIds = options.transactions ? currentCompany.transactions.map(t => t.id) : [];
      const prodIds = options.products ? currentCompany.products.map(p => String(p.id)) : [];
      const provIds = options.providers ? currentCompany.providers.map(p => p.id) : [];

      updateCurrentCompany(c => ({
        ...c,
        stickers: options.stickers ? [] : c.stickers,
        transactions: options.transactions ? [] : c.transactions,
        products: options.products ? [] : c.products,
        providers: options.providers ? [] : c.providers,
      }));
      if (options.products || options.providers) {
        setCart([]);
      }
      if (options.providers) {
        setUnlockedProviderId(null);
      }

      try {
        const refs: ReturnType<typeof doc>[] = [
          ...txIds.map(id => doc(db, 'companies', cid, 'transactions', id)),
          ...stickerIds.map(id => doc(db, 'companies', cid, 'stickers', id)),
          ...prodIds.map(id => doc(db, 'companies', cid, 'products', id)),
          ...provIds.map(id => doc(db, 'companies', cid, 'providers', id)),
        ];
        await commitDeletesInChunks(refs);
        soundSynth.playSuccess(currentCompany.settings.enableSound);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `companies/${cid}/wipe`);
      }
    },
    [currentCompany, updateCurrentCompany, commitDeletesInChunks]
  );

  const resetCurrentCompanyData = useCallback(() => {
    if (!currentCompany) return;
    const baseId = INITIAL_COMPANIES.find(c => currentCompany.id.startsWith(c.id));
    if (baseId) {
      updateCurrentCompany(c => ({
        ...baseId,
        id: c.id,
        ownerUid: c.ownerUid,
      }));
    } else {
      void wipeCurrentCompanyTestData({ stickers: true, transactions: true, products: false, providers: false });
      return;
    }
    setCart([]);
    soundSynth.playSuccess(true);
  }, [currentCompany, updateCurrentCompany, wipeCurrentCompanyTestData]);

  const exportDataJSON = useCallback(() => {
    if (!currentCompany) return;
    const backup = {
      company: currentCompany,
      exportedAt: new Date().toISOString(),
    };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backup, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `paysticker_${currentCompany.slug}_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }, [currentCompany]);

  const exportTransactionsCSV = useCallback(() => {
    if (!currentCompany) return;
    const headers = ['ID', 'Tipo', 'Sticker ID', 'Cliente', 'Monto USD', 'Monto Bs', 'Tasa BCV', 'Detalle', 'Metodo/Stand', 'Hora'];
    const rows = transactions.map(t => [
      t.id,
      t.type,
      t.stickerId,
      `"${t.owner.replace(/"/g, '""')}"`,
      t.usd.toFixed(2),
      t.bs.toFixed(2),
      t.bcvRate.toFixed(2),
      `"${t.detail.replace(/"/g, '""')}"`,
      `"${(t.paymentMethod || t.provider || '').replace(/"/g, '""')}"`,
      `"${t.time}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `reporte_${currentCompany.slug}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, [currentCompany, transactions]);

  const value: AppContextType = {
    firebaseUser,
    isAuthReady,
    isCloudSynced,
    isCloudLoading,
    authError,
    signInWithGoogle,
    signOutGoogle,

    masterSettings,
    updateMasterSettings,
    updateGlobalCommissionRate,
    convertTrialToPermanent,
    isSuperAdminAuthenticated,
    showSuperAdminModal,
    setShowSuperAdminModal,
    isSuperAdminDashboardOpen,
    setIsSuperAdminDashboardOpen,
    loginSuperAdmin,
    logoutSuperAdmin,
    updateCompanyPinByMaster,
    updateCompanyCajaPinByMaster,
    updateProviderPinByMaster,
    updateCompanyByMaster,
    enterCompanyAsSuperAdmin,
    allGlobalTransactions,
    exportGlobalTransactionsCSV,

    companies,
    currentCompany,
    loginCompany,
    logoutCompany,
    registerCompany,
    deleteCompany,
    updateCompanyLogoImage,
    updateCompanyCoverImage,
    updateCompanyEventMode,
    updateEmployeeAllowances,

    isAdminUnlocked,
    unlockAdminWithPin,
    lockAdmin,
    updateAdminPin,
    showPinModal,
    setShowPinModal,

    isCajaUnlocked,
    unlockCajaWithPin,
    lockCaja,
    updateCajaPin,
    showCajaPinModal,
    setShowCajaPinModal,

    providers,
    unlockedProviderId,
    activeProvider,
    pendingProviderId,
    showProviderPinModal,
    openProviderPinPrompt,
    closeProviderPinPrompt,
    unlockProviderWithPin,
    lockProvider,
    isNewProviderModalOpen,
    setIsNewProviderModalOpen,
    addProviderWithProducts,
    updateProviderPin,
    deleteProviderBrand,

    settings,
    updateSettings,
    resetTheme,
    setPresetTheme,
    activeTab,
    setActiveTab,
    requestNavigateTab,

    stickers,
    addSticker,
    updateSticker,
    deleteSticker,

    products,
    addProduct,
    updateProduct,
    deleteProduct,

    cart,
    addToCart,
    updateCartQty,
    removeFromCart,
    clearCart,
    cartTotalUSD,
    cartTotalBs,
    cartItemCount,

    transactions,
    addTransaction,

    isNfcModalOpen,
    nfcModalConfig,
    openNfcModal,
    closeNfcModal,
    resultModal,
    closeResultModal,
    isStickersDrawerOpen,
    toggleStickersDrawer,
    setIsStickersDrawerOpen,
    isProductModalOpen,
    setIsProductModalOpen,
    receiptModalTx,
    setReceiptModalTx,
    processNfcTap,

    deleteStickersBulk,
    deleteTransactionsBulk,
    deleteGlobalTransactionsBulk,
    deleteProductsBulk,
    deleteProvidersBulk,
    deleteCompaniesBulk,
    wipeCurrentCompanyTestData,
    restoreDemoCompanies,
    resetCurrentCompanyData,
    exportDataJSON,
    exportTransactionsCSV,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
