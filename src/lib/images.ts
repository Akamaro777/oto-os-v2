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
