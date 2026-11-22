export const EVENT_COVER_MAX_CHARS = 95000;
export const EVENT_LOGO_MAX_CHARS = 65000;
export const APP_LOGO_MAX_CHARS = 75000;
export const PRODUCT_IMAGE_MAX_CHARS = 75000;

const ALLOWED_IMAGE_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

export function sanitizeImageRef(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  const trimmed = val.trim();
  if (!trimmed || trimmed.length > maxLen) return '';
  if (/^https:\/\/[^\s<>"]+$/.test(trimmed)) return trimmed;
  if (/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(trimmed)) {
    return trimmed;
  }
  return '';
}

export async function compressImageFileToDataUrl(
  file: File,
  options: {
    maxWidth: number;
    maxHeight: number;
    maxChars: number;
  }
): Promise<string> {
  const mime = file.type.toLowerCase();
  const ext = file.name.toLowerCase();
  const validExt = ext.endsWith('.png') || ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.webp');

  if (!ALLOWED_IMAGE_MIME.has(mime) && !validExt) {
    throw new Error('Formato no válido. Usa una imagen PNG o JPG.');
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('No se pudo leer la imagen seleccionada.'));
    };
    reader.onerror = () => reject(new Error('Error leyendo el archivo de imagen.'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('La imagen está dañada o no es válida.'));
    el.src = rawDataUrl;
  });

  let targetW = img.naturalWidth || img.width;
  let targetH = img.naturalHeight || img.height;
  if (targetW <= 0 || targetH <= 0) {
    throw new Error('Dimensiones de imagen inválidas.');
  }

  const initialRatio = Math.min(1, options.maxWidth / targetW, options.maxHeight / targetH);
  targetW = Math.max(1, Math.round(targetW * initialRatio));
  targetH = Math.max(1, Math.round(targetH * initialRatio));

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('El navegador no soporta procesamiento de imágenes.');
  }

  // If PNG, try preserving PNG transparency across progressive sizes first, then transparent WebP
  const isPng = mime === 'image/png' || ext.endsWith('.png');
  if (isPng) {
    for (const pngScale of [1, 0.72, 0.52]) {
      const pw = Math.max(72, Math.round(targetW * pngScale));
      const ph = Math.max(72, Math.round(targetH * pngScale));
      canvas.width = pw;
      canvas.height = ph;
      ctx.clearRect(0, 0, pw, ph);
      ctx.drawImage(img, 0, 0, pw, ph);
      const pngAttempt = canvas.toDataURL('image/png');
      if (pngAttempt.length <= options.maxChars) {
        return pngAttempt;
      }
    }

    // Try transparent WebP if supported by browser before falling back to opaque JPEG
    canvas.width = targetW;
    canvas.height = targetH;
    ctx.clearRect(0, 0, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);
    for (const quality of [0.85, 0.7, 0.55]) {
      const webpAttempt = canvas.toDataURL('image/webp', quality);
      if (webpAttempt.startsWith('data:image/webp;base64,') && webpAttempt.length <= options.maxChars) {
        return webpAttempt;
      }
    }
  }

  // Otherwise iteratively compress as JPEG/WebP until strictly inside Firestore char limit
  let scale = 1;
  for (let pass = 0; pass < 5; pass++) {
    const w = Math.max(80, Math.round(targetW * scale));
    const h = Math.max(60, Math.round(targetH * scale));
    canvas.width = w;
    canvas.height = h;
    // Fill white background before JPEG export in case source PNG had transparency
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    for (const quality of [0.84, 0.72, 0.6, 0.48]) {
      const attempt = canvas.toDataURL('image/jpeg', quality);
      if (attempt.length <= options.maxChars) {
        return attempt;
      }
    }
    scale *= 0.78;
  }

  throw new Error('La imagen es demasiado pesada. Intenta con una foto más liviana.');
}
