/**
 * Browser-side image compression for editor uploads.
 *
 * Large phone photos (4-8 MB) become ~100-300 KB before they ever leave the
 * tab: downscale to a sane display width, re-encode as WebP (JPEG fallback),
 * then step the quality down until under the byte budget. GIFs pass through
 * untouched — re-encoding would kill their animation.
 */

export const MAX_WIDTH = 1600; // reading column is ~680 px; 2x for retina
export const TARGET_BYTES = 350 * 1024;

const load = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('चित्र पढ़ा नहीं जा सका।'));
    };
    img.src = url;
  });

const toBlob = (canvas, type, quality) =>
  new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), type, quality));

export async function compressImage(file, { maxWidth = MAX_WIDTH, maxBytes = TARGET_BYTES } = {}) {
  if (!file || !file.type || !file.type.startsWith('image/')) return file;
  if (file.type === 'image/gif') return file; // keep animation intact

  const img = await load(file);
  const scale = Math.min(1, maxWidth / (img.naturalWidth || maxWidth));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round((img.naturalWidth || maxWidth) * scale));
  canvas.height = Math.max(1, Math.round((img.naturalHeight || maxWidth) * scale));
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // Prefer WebP (much smaller at equal quality); Safari-on-IOs edge cases
  // fall back to JPEG — canvas reports the encoded type on the blob.
  let blob = await toBlob(canvas, 'image/webp', 0.82);
  if (!blob || blob.type !== 'image/webp') {
    blob = await toBlob(canvas, 'image/jpeg', 0.82);
  }
  if (!blob) return file;

  let quality = 0.82;
  while (blob.size > maxBytes && quality > 0.5) {
    quality -= 0.12;
    const retry = await toBlob(canvas, blob.type, quality);
    if (!retry || retry.size >= blob.size) break;
    blob = retry;
  }

  // Never make things worse (tiny originals, exotic formats).
  return blob.size < file.size ? blob : file;
}

export const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('चित्र पढ़ा नहीं जा सका।'));
    reader.readAsDataURL(blob);
  });
