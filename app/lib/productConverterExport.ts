const SOURCE_CANVAS_W = 4200;
const SOURCE_CANVAS_H = 4800;

/** Transparent PNG blob for Product Converter — same fit/centre logic as single-design export. */
export function createConverterExportBlob(
  image: HTMLImageElement,
  exportWidth: number,
  exportHeight: number,
): Promise<Blob | null> {
  const scaleX = SOURCE_CANVAS_W / image.naturalWidth;
  const scaleY = SOURCE_CANVAS_H / image.naturalHeight;
  const fitScaleToCanvas = Math.min(scaleX, scaleY);
  const scaledW = image.naturalWidth * fitScaleToCanvas;
  const scaledH = image.naturalHeight * fitScaleToCanvas;
  const offsetX = Math.round((SOURCE_CANVAS_W - scaledW) / 2);
  const offsetY = Math.round((SOURCE_CANVAS_H - scaledH) / 2);

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = exportWidth;
  exportCanvas.height = exportHeight;

  const ctx = exportCanvas.getContext('2d', { alpha: true });
  if (!ctx) return Promise.resolve(null);

  ctx.clearRect(0, 0, exportWidth, exportHeight);

  const canvasFitScale = Math.min(exportWidth / SOURCE_CANVAS_W, exportHeight / SOURCE_CANVAS_H);
  const padX = (exportWidth - SOURCE_CANVAS_W * canvasFitScale) / 2;
  const padY = (exportHeight - SOURCE_CANVAS_H * canvasFitScale) / 2;
  const drawW = image.naturalWidth * fitScaleToCanvas * canvasFitScale;
  const drawH = image.naturalHeight * fitScaleToCanvas * canvasFitScale;
  const drawX = offsetX * canvasFitScale + padX;
  const drawY = offsetY * canvasFitScale + padY;

  ctx.drawImage(image, drawX, drawY, drawW, drawH);

  return new Promise((resolve) => {
    exportCanvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

export function sanitizeUploadBasename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '');
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'design';
}
