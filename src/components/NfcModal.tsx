import React, { useEffect, useState, useRef } from 'react';
import {
  Radio,
  X,
  Smartphone,
  CreditCard,
  AlertCircle,
  Sparkles,
  UserPlus,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Search,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatUSD, formatBs } from '../utils/formatters';
import { soundSynth } from '../utils/audio';

export const NfcModal: React.FC = () => {
  const {
    isNfcModalOpen,
    closeNfcModal,
    nfcModalConfig,
    stickers,
    processNfcTap,
    settings,
    currentCompany,
  } = useApp();

  const [isWebNfcListening, setIsWebNfcListening] = useState<boolean>(false);
  const [hardwareScanStatus, setHardwareScanStatus] = useState<string>('');
  const [attendeeNameInput, setAttendeeNameInput] = useState<string>('');
  const [isSimOpen, setIsSimOpen] = useState<boolean>(false);
  const [manualUidInput, setManualUidInput] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const processingLockRef = useRef<boolean>(false);

  // Refs to prevent NDEFReader.scan() from aborting/restarting on every cloud snapshot or keystroke
  const nfcModalConfigRef = useRef(nfcModalConfig);
  const currentCompanyRef = useRef(currentCompany);
  const stickersRef = useRef(stickers);
  const processNfcTapRef = useRef(processNfcTap);
  const enableSoundRef = useRef(settings.enableSound);
  const attendeeNameInputRef = useRef(attendeeNameInput);

  nfcModalConfigRef.current = nfcModalConfig;
  currentCompanyRef.current = currentCompany;
  stickersRef.current = stickers;
  processNfcTapRef.current = processNfcTap;
  enableSoundRef.current = settings.enableSound;
  attendeeNameInputRef.current = attendeeNameInput;

  // Reset state on open/close
  useEffect(() => {
    if (!isNfcModalOpen) {
      setIsWebNfcListening(false);
      setHardwareScanStatus('');
      setAttendeeNameInput('');
      setIsSimOpen(false);
      setManualUidInput('');
      setIsProcessing(false);
      processingLockRef.current = false;
      return;
    }

    if (nfcModalConfig?.customAttendeeName) {
      setAttendeeNameInput(nfcModalConfig.customAttendeeName);
    }
  }, [isNfcModalOpen, nfcModalConfig]);

  // Web NFC hardware scanning via NDEFReader (Chrome on Android) — lifecycle tied ONLY to isNfcModalOpen
  useEffect(() => {
    if (!isNfcModalOpen) return;

    let abortController: AbortController | null = null;
    let isDisposed = false;

    if (typeof window !== 'undefined' && 'NDEFReader' in window) {
      try {
        abortController = new AbortController();
        // @ts-expect-error NDEFReader is a standard W3C Web NFC API in Chrome Android
        const ndef = new window.NDEFReader();

        ndef
          .scan({ signal: abortController.signal })
          .then(() => {
            if (isDisposed) return;
            setIsWebNfcListening(true);
            setHardwareScanStatus('Antena NFC activa. Acerca la pulsera o tarjeta a la parte trasera del teléfono.');

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ndef.onreading = async (event: any) => {
              if (isDisposed || processingLockRef.current) return;
              processingLockRef.current = true;
              setIsProcessing(true);

              try {
                const activeConfig = nfcModalConfigRef.current;
                const activeCompany = currentCompanyRef.current;
                const activeStickers = stickersRef.current;
                const soundEnabled = enableSoundRef.current;
                const typedName = attendeeNameInputRef.current.trim();

                soundSynth.playNfcPing(soundEnabled);

                // 1. Extract physical hardware UID from chip
                const rawSerial = (event.serialNumber || '').trim();

                // 2. Inspect NDEF payload if tag was previously written
                let tagPayloadId: string | null = null;
                let onChipBalance: number | null = null;

                if (event.message?.records) {
                  for (const record of event.message.records) {
                    if (record.recordType === 'text') {
                      try {
                        const decoder = new TextDecoder(record.encoding || 'utf-8');
                        const text = decoder.decode(record.data);
                        const parsed = JSON.parse(text);
                        if (parsed && typeof parsed === 'object') {
                          if (parsed.tagId || parsed.nfcId) {
                            tagPayloadId = String(parsed.tagId || parsed.nfcId);
                          }
                          if (typeof parsed.balance === 'number') {
                            onChipBalance = parsed.balance;
                          }
                        }
                      } catch {
                        // Plain text record or non-JSON, ignore
                      }
                    }
                  }
                }

                // 3. Normalize UID to safe format (NFC-XXXXXXXX)
                const cleanHex = rawSerial
                  ? rawSerial.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
                  : Math.random().toString(36).slice(2, 10).toUpperCase();

                const finalTagId = tagPayloadId || `NFC-${cleanHex}`;

                // 4. Optional physical NDEF mirror write (skip on QUERY so balance checks are instantaneous)
                if (activeConfig && activeCompany && activeConfig.mode !== 'QUERY') {
                  const existingSticker = activeStickers.find(
                    s =>
                      s.id.toLowerCase() === finalTagId.toLowerCase() ||
                      s.id.replace(/^NFC-/, '').toLowerCase() === finalTagId.replace(/^NFC-/, '').toLowerCase()
                  );

                  let newExpectedBalance = existingSticker ? existingSticker.balance : 0;
                  if (activeConfig.mode === 'RECHARGE') {
                    newExpectedBalance = Number(
                      ((existingSticker ? existingSticker.balance : 0) + activeConfig.amountUSD).toFixed(2)
                    );
                  } else if (activeConfig.mode === 'CHARGE' && activeCompany.eventMode !== 'CORPORATE') {
                    newExpectedBalance = Number(
                      (Math.max(0, (existingSticker ? existingSticker.balance : 0) - activeConfig.amountUSD)).toFixed(2)
                    );
                  }

                  try {
                    await ndef.write({
                      records: [
                        {
                          recordType: 'text',
                          data: JSON.stringify({
                            app: 'PayStickerNFC',
                            companyId: activeCompany.id,
                            tagId: finalTagId,
                            eventMode: activeCompany.eventMode || 'CASHLESS',
                            balance: newExpectedBalance,
                            onChipBalance: onChipBalance ?? newExpectedBalance,
                            updatedAt: Date.now(),
                          }),
                        },
                      ],
                    });
                  } catch (writeErr) {
                    // Tag might be write-protected; cloud Firestore remains authoritative
                    console.warn('Physical NDEF write optional/skipped:', writeErr);
                  }
                }

                // 5. Commit atomic transaction in Firestore / AppContext
                await processNfcTapRef.current(finalTagId, typedName);
              } catch (err) {
                console.warn('NFC reading processing error:', err);
              } finally {
                if (!isDisposed) {
                  setIsProcessing(false);
                }
                processingLockRef.current = false;
              }
            };
          })
          .catch((err: unknown) => {
            if (isDisposed) return;
            setIsWebNfcListening(false);
            setHardwareScanStatus('Antena NFC no disponible o permiso denegado.');
            console.warn('NDEFReader.scan error:', err);
          });
      } catch (err: unknown) {
        setIsWebNfcListening(false);
        console.warn('NDEFReader not initialized:', err);
      }
    } else {
      setIsWebNfcListening(false);
      setHardwareScanStatus('Navegador sin Web NFC nativo (utiliza Chrome en Android en el evento).');
    }

    return () => {
      isDisposed = true;
      if (abortController) {
        abortController.abort();
      }
    };
  }, [isNfcModalOpen]);

  if (!isNfcModalOpen || !nfcModalConfig) return null;

  const mode = nfcModalConfig.mode;
  const isRecharge = mode === 'RECHARGE';
  const isCharge = mode === 'CHARGE';
  const isQuery = mode === 'QUERY';
  const isAssignQuota = mode === 'ASSIGN_QUOTA';
  const isCorporate = currentCompany?.eventMode === 'CORPORATE';

  const amountUSD = nfcModalConfig.amountUSD || 0;
  const amountBs = amountUSD * settings.bcvRate;

  const quotaEntries = nfcModalConfig.customQuotas
    ? Object.values(nfcModalConfig.customQuotas)
    : [];

  // Manual simulator trigger for PC / testing without NFC hardware
  const handleManualSimulateTap = async (simulatedId: string) => {
    if (processingLockRef.current) return;
    processingLockRef.current = true;
    setIsProcessing(true);
    soundSynth.playNfcPing(settings.enableSound);

    try {
      await processNfcTap(simulatedId, attendeeNameInput.trim());
    } catch (err) {
      console.warn('Simulated NFC tap error:', err);
    } finally {
      setIsProcessing(false);
      processingLockRef.current = false;
    }
  };

  const handleManualFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualUidInput.trim()) return;
    const clean = manualUidInput.trim().toUpperCase();
    const finalId = clean.startsWith('NFC-') ? clean : `NFC-${clean}`;
    handleManualSimulateTap(finalId);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 sm:p-7 shadow-2xl border border-slate-200 text-center relative overflow-hidden max-h-[92vh] flex flex-col justify-between pb-safe">
        {/* Close button */}
        <button
          onClick={closeNfcModal}
          disabled={isProcessing}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-bold transition cursor-pointer z-10"
          title="Cerrar ventana"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="overflow-y-auto pr-1 space-y-4">
          {/* Badge */}
          <div
            className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
              isRecharge
                ? 'bg-blue-100 text-blue-700'
                : isAssignQuota
                ? 'bg-indigo-100 text-indigo-700'
                : isCharge
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-purple-100 text-purple-700'
            }`}
          >
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>
              {isRecharge
                ? 'Caja NFC • Recarga de Saldo'
                : isAssignQuota
                ? 'Acreditación Corporativa • Cupos NFC'
                : isCharge
                ? isCorporate
                  ? 'Stand • Entrega de Beneficio'
                  : 'Proveedor • Cobro de Consumo'
                : isCorporate
                ? 'Consulta de Cupos NFC'
                : 'Consulta de Saldo NFC'}
            </span>
          </div>

          <div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {nfcModalConfig.title}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {nfcModalConfig.subtitle}
            </p>
          </div>

          {/* Radar concentric wave animation */}
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 mx-auto my-2 flex items-center justify-center">
            <div
              className={`absolute inset-0 rounded-full nfc-ring ${
                isRecharge
                  ? 'bg-blue-500/20'
                  : isAssignQuota
                  ? 'bg-indigo-500/20'
                  : isCharge
                  ? 'bg-emerald-500/20'
                  : 'bg-purple-500/20'
              }`}
            />
            <div
              className={`absolute inset-0 rounded-full nfc-ring-delay ${
                isRecharge
                  ? 'bg-blue-500/20'
                  : isAssignQuota
                  ? 'bg-indigo-500/20'
                  : isCharge
                  ? 'bg-emerald-500/20'
                  : 'bg-purple-500/20'
              }`}
            />
            <div
              className={`relative w-18 h-18 sm:w-20 sm:h-20 rounded-full text-white flex items-center justify-center shadow-xl transition-transform ${
                isProcessing ? 'scale-110' : 'active:scale-95'
              } ${
                isRecharge
                  ? 'bg-app-primary'
                  : isAssignQuota
                  ? 'bg-indigo-600'
                  : isCharge
                  ? 'bg-app-secondary'
                  : 'bg-purple-600'
              }`}
            >
              {isProcessing ? (
                <Cpu className="w-9 h-9 sm:w-10 sm:h-10 animate-spin" />
              ) : (
                <Radio className="w-9 h-9 sm:w-10 sm:h-10 animate-pulse" />
              )}
            </div>
          </div>

          {/* Operation Summary Card */}
          {isAssignQuota ? (
            <div className="bg-slate-950 rounded-2xl p-4 text-white border border-indigo-500/30 shadow-inner text-left space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider block">
                    Cupos Corporativos a Grabar
                  </span>
                  <p className="text-sm font-black text-white">
                    {attendeeNameInput || nfcModalConfig.customAttendeeName || 'Nuevo Colaborador'}
                  </p>
                </div>
                {nfcModalConfig.customDepartment && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-200 border border-indigo-400/30">
                    {nfcModalConfig.customDepartment}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-800">
                {quotaEntries.map(q => (
                  <span
                    key={q.ruleId}
                    className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-emerald-300 flex items-center gap-1"
                  >
                    <span>{q.emoji}</span>
                    <span>
                      {q.allowed}x {q.label}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ) : isCharge && isCorporate ? (
            <div className="bg-slate-950 rounded-2xl p-4 text-white border border-emerald-500/30 shadow-inner">
              <span className="text-[11px] font-bold text-emerald-400 block uppercase tracking-wider">
                Entrega de Beneficio Corporativo
              </span>
              <p className="text-lg font-black text-white mt-1">
                Sin cobro al empleado
              </p>
              <span className="text-[11px] text-slate-400 font-mono block mt-1">
                Liquidación al stand: {formatUSD(amountUSD)} ({formatBs(amountBs)})
              </span>
            </div>
          ) : (
            !isQuery && (
              <div className="bg-slate-950 rounded-2xl p-4 text-white border border-slate-800 shadow-inner">
                <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">
                  {isRecharge ? 'Monto a Acreditar en Chip' : 'Monto a Descontar de Pulsera'}
                </span>
                <div className="flex items-baseline justify-center gap-1.5 mt-1">
                  <span
                    className={`text-3xl sm:text-4xl font-black font-mono ${
                      isRecharge ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {isRecharge ? '+' : '-'}
                    {formatUSD(amountUSD)}
                  </span>
                </div>
                <span className="text-xs text-slate-400 font-mono block mt-1">
                  ≈ {formatBs(amountBs)} (Tasa BCV: {formatBs(settings.bcvRate)})
                </span>
              </div>
            )
          )}

          {/* Hardware NFC Instructions Banner */}
          <div
            className={`p-3.5 rounded-2xl border text-xs font-semibold text-left transition ${
              isWebNfcListening
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}
          >
            <div className="flex items-start gap-2.5">
              <Smartphone
                className={`w-5 h-5 shrink-0 mt-0.5 ${
                  isWebNfcListening ? 'text-emerald-600 animate-bounce' : 'text-slate-400'
                }`}
              />
              <div className="space-y-1">
                <p className="font-black text-slate-900 text-xs">
                  {isWebNfcListening
                    ? '📡 Antena NFC Activa — Esperando contacto físico'
                    : '📱 Lector NFC Físico'}
                </p>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  {hardwareScanStatus ||
                    'Pega la pulsera o tarjeta NFC a la parte trasera del teléfono durante 1 segundo.'}
                  {(isRecharge || isAssignQuota) &&
                    ' Si la pulsera es nueva, se activará y registrará automáticamente.'}
                </p>
              </div>
            </div>
          </div>

          {/* Optional Name Assignment for Caja */}
          {(isRecharge || isAssignQuota) && (
            <div className="text-left bg-slate-50 p-3 rounded-2xl border border-slate-200/90">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                {isAssignQuota
                  ? 'Nombre del Empleado / Titular:'
                  : 'Nombre o Titular de la Pulsera (Opcional):'}
              </label>
              <input
                type="text"
                placeholder={
                  isAssignQuota
                    ? 'Ej. Ana Rodríguez'
                    : 'Ej. Juan Pérez, Mesa 4 o VIP (o dejar vacío)'
                }
                value={attendeeNameInput}
                onChange={e => setAttendeeNameInput(e.target.value)}
                maxLength={80}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 ring-blue-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Si lo dejas vacío, el sistema la numerará automáticamente:{' '}
                {isAssignQuota ? `Empleado #${stickers.length + 1}` : `Pulsera #${stickers.length + 1}`}.
              </p>
            </div>
          )}

          {/* Collapsible Simulator strictly for PC / non-NFC testing */}
          <div className="pt-2 border-t border-slate-100 text-left">
            <button
              type="button"
              onClick={() => setIsSimOpen(prev => !prev)}
              className="w-full flex items-center justify-between text-[11px] font-bold text-slate-500 hover:text-slate-800 py-1 transition cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-slate-400" />
                <span>¿Pruebas en PC sin antena NFC? (Simulador Virtual)</span>
              </span>
              {isSimOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {isSimOpen && (
              <div className="mt-3 p-3.5 bg-slate-100 rounded-2xl border border-slate-200 space-y-3 animate-in fade-in duration-150">
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-2 rounded-xl text-[10px] leading-tight font-medium">
                  ⚠️ <strong>Modo pruebas en PC:</strong> En el evento físico con teléfonos Android,
                  este menú no se utiliza porque la antena física lee las pulseras por contacto directo.
                </div>

                {/* Manual UID Input */}
                <form onSubmit={handleManualFormSubmit} className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-600 uppercase">
                    Ingresar UID de pulsera simulada:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Ej. 04A2B3C4 o Pulsera101"
                      value={manualUidInput}
                      onChange={e => setManualUidInput(e.target.value)}
                      className="flex-1 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold"
                    />
                    <button
                      type="submit"
                      disabled={!manualUidInput.trim() || isProcessing}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl cursor-pointer disabled:opacity-50"
                    >
                      Simular Toque
                    </button>
                  </div>
                </form>

                {/* Quick picker for demo stickers */}
                {stickers.length > 0 && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">
                      O tocar una pulsera de prueba existente:
                    </label>
                    <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto pr-1">
                      {stickers.map(st => {
                        const totalRemainingQuotas = st.quotas
                          ? Object.values(st.quotas).reduce(
                              (sum, q) => sum + Math.max(0, q.allowed - q.used),
                              0
                            )
                          : 0;
                        return (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => handleManualSimulateTap(st.id)}
                            disabled={isProcessing}
                            className="p-2 rounded-xl bg-white border border-slate-200 hover:border-blue-400 text-left transition cursor-pointer active:scale-95 flex flex-col justify-between"
                          >
                            <div className="truncate font-bold text-[11px] text-slate-800">
                              {st.owner}
                            </div>
                            <div className="flex items-center justify-between mt-1 text-[10px] font-mono text-slate-500">
                              <span>{st.id.slice(-6)}</span>
                              {isCorporate ? (
                                <span className="font-bold text-indigo-600">
                                  {totalRemainingQuotas} cupos
                                </span>
                              ) : (
                                <span className="font-bold text-emerald-600">
                                  {formatUSD(st.balance)}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

