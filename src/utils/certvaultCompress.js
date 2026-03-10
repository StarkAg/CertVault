const MAX_TEMPLATE_DIM = 2000; // Balanced quality and speed
const MAX_DATA_URL_LENGTH = 3_000_000; // ~3MB before we force downscaling
const JPEG_QUALITY = 0.88; // Balanced quality for speed

/** Compress template image to stay under Cloudflare/nginx limits. */
export async function compressTemplateImage(dataUrl) {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return dataUrl;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let w = img.width, h = img.height;
      // Only compress if dimensions OR size are truly large
      if (w <= MAX_TEMPLATE_DIM && h <= MAX_TEMPLATE_DIM && dataUrl.length <= MAX_DATA_URL_LENGTH) {
        resolve(dataUrl);
        return;
      }
      const scale = Math.min(MAX_TEMPLATE_DIM / w, MAX_TEMPLATE_DIM / h, 1);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
