import React, { useState, useEffect } from 'react';
import { X, Plus, Package, Store, Image as ImageIcon, Upload, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatBs } from '../utils/formatters';
import {
  compressImageFileToDataUrl,
  PRODUCT_IMAGE_MAX_CHARS,
  sanitizeImageRef,
} from '../utils/imageUtils';

const EMOJI_OPTIONS = [
  { emoji: '🍔', label: 'Hamburguesa' },
  { emoji: '🌭', label: 'Perro Caliente' },
  { emoji: '🍕', label: 'Pizza' },
  { emoji: '🍟', label: 'Papas Fritas' },
  { emoji: '🌮', label: 'Tacos / Arepas' },
  { emoji: '🥩', label: 'Parrilla / Carne' },
  { emoji: '🥤', label: 'Refresco' },
  { emoji: '🍺', label: 'Cerveza' },
  { emoji: '🍹', label: 'Cóctel' },
  { emoji: '☕', label: 'Café' },
  { emoji: '🍩', label: 'Dona / Postre' },
  { emoji: '🍦', label: 'Helado' },
  { emoji: '🍿', label: 'Cotufas / Snacks' },
  { emoji: '🎟️', label: 'Ticket / Brazalete' },
];

export const ProductModal: React.FC = () => {
  const {
    isProductModalOpen,
    setIsProductModalOpen,
    setIsNewProviderModalOpen,
    addProduct,
    providers,
    activeProvider,
    settings,
  } = useApp();

  const [name, setName] = useState('');
  const [price, setPrice] = useState('5.00');
  const [emoji, setEmoji] = useState('🍔');
  const [provider, setProvider] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageUrlDraft, setImageUrlDraft] = useState('');
  const [showUrlField, setShowUrlField] = useState(false);
  const [imageError, setImageError] = useState('');
  const [isCompressing, setIsCompressing] = useState(false);

  useEffect(() => {
    if (isProductModalOpen) {
      if (activeProvider) {
        setProvider(activeProvider.brandName);
      } else if (providers.length > 0) {
        setProvider(providers[0].brandName);
      } else {
        setProvider('General');
      }
      setImageUrl('');
      setImageUrlDraft('');
      setShowUrlField(false);
      setImageError('');
    }
  }, [isProductModalOpen, activeProvider, providers]);

  if (!isProductModalOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImageError('');
    setIsCompressing(true);
    try {
      const dataUrl = await compressImageFileToDataUrl(file, {
        maxWidth: 400,
        maxHeight: 400,
        maxChars: PRODUCT_IMAGE_MAX_CHARS,
      });
      setImageUrl(dataUrl);
      setImageUrlDraft('');
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'No se pudo procesar la imagen.');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setImageError('');
    const finalProvider = activeProvider ? activeProvider.brandName : provider || 'General';
    const finalPrice = parseFloat(price);

    if (!name.trim() || isNaN(finalPrice) || finalPrice <= 0) return;

    const urlCandidate = imageUrlDraft.trim()
      ? sanitizeImageRef(imageUrlDraft, PRODUCT_IMAGE_MAX_CHARS)
      : '';
    if (imageUrlDraft.trim() && !urlCandidate) {
      setImageError('El enlace debe comenzar con https:// o ser una imagen válida.');
      return;
    }

    const finalImage = imageUrl || urlCandidate;

    addProduct({
      name: name.trim(),
      price: finalPrice,
      emoji,
      provider: finalProvider,
      category: 'General',
      ...(finalImage ? { imageUrl: finalImage } : {}),
    });

    setName('');
    setPrice('5.00');
    setImageUrl('');
    setImageUrlDraft('');
    setShowUrlField(false);
    setImageError('');
    setIsProductModalOpen(false);
  };

  const parsedPrice = parseFloat(price) || 0;
  const previewSrc = imageUrl || sanitizeImageRef(imageUrlDraft, PRODUCT_IMAGE_MAX_CHARS);

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in zoom-in-95 duration-150 overflow-y-auto">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 my-auto max-h-[92vh] overflow-y-auto pb-safe">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-black text-slate-900 tracking-tight">
              Registrar Nuevo Producto
            </h3>
          </div>
          <button
            onClick={() => setIsProductModalOpen(false)}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nombre del Producto o Servicio
            </label>
            <input
              type="text"
              required
              maxLength={120}
              placeholder="Ej. Hamburguesa Doble con Tocineta"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 ring-app-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Precio en Dólares ($)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 font-mono">
                  $
                </span>
                <input
                  type="number"
                  step="0.10"
                  min="0.10"
                  required
                  placeholder="5.00"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-slate-300 text-sm font-black text-slate-900 font-mono focus:outline-none focus:ring-2 ring-app-primary"
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                ≈ {formatBs(parsedPrice * settings.bcvRate)}
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Emoji / Icono
              </label>
              <select
                value={emoji}
                onChange={e => setEmoji(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm font-bold bg-white focus:outline-none focus:ring-2 ring-app-primary"
              >
                {EMOJI_OPTIONS.map(opt => (
                  <option key={opt.emoji} value={opt.emoji}>
                    {opt.emoji} {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Product Image Upload (PNG / JPG) */}
          <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                <span>Foto del Producto (PNG o JPG)</span>
              </span>
              <button
                type="button"
                onClick={() => setShowUrlField(prev => !prev)}
                className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
              >
                {showUrlField ? 'Ocultar enlace' : 'O usar enlace https'}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                {previewSrc ? (
                  <img
                    src={previewSrc}
                    alt="Vista previa producto"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-3xl">{emoji}</span>
                )}
              </div>

              <div className="flex-1 flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <label className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer transition active:scale-95">
                    <Upload className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isCompressing ? 'Optimizando...' : previewSrc ? 'Cambiar Foto' : 'Subir PNG / JPG'}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      onChange={handleFileUpload}
                      disabled={isCompressing}
                      className="hidden"
                    />
                  </label>

                  {previewSrc && (
                    <button
                      type="button"
                      onClick={() => {
                        setImageUrl('');
                        setImageUrlDraft('');
                        setImageError('');
                      }}
                      className="px-2.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold text-xs inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Quitar</span>
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-slate-500">
                  Opcional. Se optimiza automáticamente para cargar rápido en todos los teléfonos.
                </p>
              </div>
            </div>

            {showUrlField && (
              <input
                type="url"
                placeholder="https://ejemplo.com/foto-producto.jpg"
                value={imageUrlDraft}
                onChange={e => {
                  setImageUrlDraft(e.target.value);
                  if (e.target.value.trim()) setImageUrl('');
                  setImageError('');
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 ring-app-primary"
              />
            )}

            {imageError && (
              <p className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded-xl">
                {imageError}
              </p>
            )}
          </div>

          {/* Provider / Stand */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Marca / Proveedor Asignado
            </label>

            {activeProvider ? (
              <div className="px-3.5 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-sm font-black text-emerald-800 flex items-center gap-2">
                <span>{activeProvider.emoji}</span>
                <span>{activeProvider.brandName}</span>
              </div>
            ) : (
              <div className="space-y-2">
                <select
                  value={provider}
                  onChange={e => setProvider(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold bg-white focus:outline-none focus:ring-2 ring-app-primary"
                >
                  {providers.map(p => (
                    <option key={p.id} value={p.brandName}>
                      {p.emoji} {p.brandName}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setIsProductModalOpen(false);
                    setIsNewProviderModalOpen(true);
                  }}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer"
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>+ Registrar una nueva marca de proveedor con su PIN</span>
                </button>
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isCompressing}
              className="w-full py-3.5 rounded-2xl bg-app-primary hover:bg-app-primary-hover disabled:opacity-50 text-white font-black text-sm shadow-md transition cursor-pointer flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Guardar Producto en Catálogo</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
