/** Client-side image utilities: downscale photos before storing or sending to the API. */

/**
 * Read a file, downscale so the longest side is `maxDim`, and return a JPEG
 * data-URL. Used for contact thumbnails (small) and GMAT photo capture (large
 * enough for the model to read handwriting).
 */
export async function fileToJpegDataURL(file: File, maxDim: number, quality = 0.82): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', quality)
}

/** A region of an image, each value a fraction (0–1) of the full width/height. */
export interface FractionBox {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Crop a fractional region out of an image file (at original resolution) and
 * return a small JPEG data-URL. Used to lift a profile picture out of an
 * Instagram screenshot from the box the vision model reports.
 */
export async function cropFileToJpegDataURL(
  file: File,
  box: FractionBox,
  maxDim = 192,
  quality = 0.8,
): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const W = bitmap.width
  const H = bitmap.height
  // Slight padding absorbs an imprecise box; clamp everything to the image.
  const pad = 0.02
  const x = Math.max(0, (box.x - pad) * W)
  const y = Math.max(0, (box.y - pad) * H)
  const w = Math.min(W - x, (box.w + 2 * pad) * W)
  const h = Math.min(H - y, (box.h + 2 * pad) * H)
  if (w < 8 || h < 8) {
    bitmap.close()
    throw new Error('Empty crop region')
  }
  const scale = Math.min(1, maxDim / Math.max(w, h))
  const outW = Math.max(1, Math.round(w * scale))
  const outH = Math.max(1, Math.round(h * scale))
  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.drawImage(bitmap, x, y, w, h, 0, 0, outW, outH)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', quality)
}
