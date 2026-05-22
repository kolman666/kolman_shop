// Resize a user-picked image file down to a square (or contained-fit) data URL
// suitable for an avatar. Drawing the image through a canvas also strips EXIF
// metadata and unsupported color profiles.
//
//   const dataUrl = await resizeImageToDataUrl(file, { maxSize: 512, quality: 0.85 })
//
// Falls back to the original FileReader → data URL pipeline if anything goes
// wrong with the canvas decode (rare, but Safari occasionally refuses HEIC).

export type ResizeOptions = {
  maxSize?: number
  quality?: number
  mimeType?: 'image/jpeg' | 'image/webp' | 'image/png'
}

export async function resizeImageToDataUrl(file: File, opts: ResizeOptions = {}): Promise<string> {
  const maxSize = opts.maxSize ?? 512
  const quality = opts.quality ?? 0.85
  const mimeType = opts.mimeType ?? 'image/jpeg'

  // Read into an HTMLImageElement first — this works for any format the
  // browser can decode (jpeg, png, webp, gif first frame, AVIF on modern
  // browsers). createImageBitmap would be slightly faster but isn't in Safari
  // before 16.4 for File inputs.
  const sourceUrl = await readFileAsDataUrl(file)
  const img = await loadImage(sourceUrl)

  const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1)
  const targetW = Math.max(1, Math.round(img.width * ratio))
  const targetH = Math.max(1, Math.round(img.height * ratio))

  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    // No canvas? Fall back to the original file as a data URL.
    return sourceUrl
  }
  // White background so JPEG transparency doesn't render black.
  if (mimeType === 'image/jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, targetW, targetH)
  }
  ctx.drawImage(img, 0, 0, targetW, targetH)

  // toDataURL returns the base64 string synchronously — large images can take
  // a frame or two but for 512px it's instant.
  try {
    return canvas.toDataURL(mimeType, quality)
  } catch {
    return sourceUrl
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('unreadable file'))
    }
    reader.onerror = () => reject(new Error('file read failed'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image decode failed'))
    img.src = src
  })
}
