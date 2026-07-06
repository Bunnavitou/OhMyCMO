// Downscale + re-encode an image file on the client so we store a compact
// data URL instead of the raw upload. Keeps the longest edge within maxDim
// and re-encodes as JPEG (quality is a 0..1 number). GIF / SVG / unknown
// types fall back to the original file so we don't ruin animations or vectors.

const FALLBACK_TYPES = /^image\/(gif|svg\+xml)$/i

const readAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not decode image'))
    img.src = src
  })

const dataUrlSize = (dataUrl) => {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) return dataUrl.length
  const b64 = dataUrl.slice(comma + 1)
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
  return Math.floor((b64.length * 3) / 4) - padding
}

export async function compressImage(file, options = {}) {
  const { maxDim = 1600, quality = 0.82, mimeType = 'image/jpeg' } = options

  if (!file) return null

  // For formats we shouldn't lossy-recompress, just read the original.
  if (FALLBACK_TYPES.test(file.type)) {
    const dataUrl = await readAsDataUrl(file)
    return { name: file.name, type: file.type, size: file.size, dataUrl }
  }

  const originalDataUrl = await readAsDataUrl(file)
  let img
  try {
    img = await loadImage(originalDataUrl)
  } catch {
    // Decode failure — keep the original bytes rather than dropping the upload.
    return { name: file.name, type: file.type, size: file.size, dataUrl: originalDataUrl }
  }

  const { width: w0, height: h0 } = img
  const scale = Math.min(1, maxDim / Math.max(w0, h0))
  const w = Math.max(1, Math.round(w0 * scale))
  const h = Math.max(1, Math.round(h0 * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return { name: file.name, type: file.type, size: file.size, dataUrl: originalDataUrl }
  }
  // White matte so transparent PNGs don't turn black when re-encoded as JPEG.
  if (mimeType === 'image/jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
  }
  ctx.drawImage(img, 0, 0, w, h)

  const compressedDataUrl = canvas.toDataURL(mimeType, quality)
  // If compression made things bigger (small or already-optimized files),
  // keep the original.
  const compressedSize = dataUrlSize(compressedDataUrl)
  if (compressedSize >= file.size && scale === 1) {
    return { name: file.name, type: file.type, size: file.size, dataUrl: originalDataUrl }
  }

  const ext = mimeType === 'image/jpeg' ? 'jpg' : mimeType.split('/')[1] || 'img'
  const baseName = file.name?.replace(/\.[^.]+$/, '') || 'image'
  return {
    name: `${baseName}.${ext}`,
    type: mimeType,
    size: compressedSize,
    dataUrl: compressedDataUrl,
  }
}
