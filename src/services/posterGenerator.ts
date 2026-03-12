import * as fabric from 'fabric'
import type { PlaceholderObject } from '../hooks/useCanvas'
import { loadWithReviver } from '../hooks/useCanvas'

interface FieldValueGetter {
  getCellText: (fieldId: string, recordId: string) => Promise<string>
  getAttachmentUrls: (fieldId: string, recordId: string) => Promise<string[]>
}

/**
 * Fit image into a bounding box using "cover" mode (center crop).
 * Scales the image so it completely fills the box, then clips overflow.
 */
function fitImageCover(
  img: fabric.FabricImage,
  targetWidth: number,
  targetHeight: number,
  left: number,
  top: number,
  angle?: number,
) {
  const imgW = img.width!
  const imgH = img.height!
  const scaleX = targetWidth / imgW
  const scaleY = targetHeight / imgH
  const scale = Math.max(scaleX, scaleY)

  const scaledW = imgW * scale
  const scaledH = imgH * scale
  const cropX = (scaledW - targetWidth) / 2 / scale
  const cropY = (scaledH - targetHeight) / 2 / scale

  img.set({
    left,
    top,
    angle: angle ?? 0,
    scaleX: scale,
    scaleY: scale,
    cropX,
    cropY,
    width: imgW - cropX * 2,
    height: imgH - cropY * 2,
  })
}

/**
 * Fit image into a box using "contain" mode (no crop).
 * When safeInCircle is true, image is additionally scaled to keep all corners
 * inside the circle clip area.
 */
function fitImageContain(
  img: fabric.FabricImage,
  targetWidth: number,
  targetHeight: number,
  left: number,
  top: number,
  angle?: number,
  safeInCircle = false,
) {
  const imgW = img.width!
  const imgH = img.height!
  const scaleX = targetWidth / imgW
  const scaleY = targetHeight / imgH
  let scale = Math.min(scaleX, scaleY)

  if (safeInCircle) {
    const diameter = Math.min(targetWidth, targetHeight)
    const maxByCircle = diameter / Math.sqrt(imgW * imgW + imgH * imgH)
    scale = Math.min(scale, maxByCircle)
  }

  const scaledW = imgW * scale
  const scaledH = imgH * scale

  img.set({
    left: left + (targetWidth - scaledW) / 2,
    top: top + (targetHeight - scaledH) / 2,
    angle: angle ?? 0,
    scaleX: scale,
    scaleY: scale,
    cropX: 0,
    cropY: 0,
    width: imgW,
    height: imgH,
  })
}

export async function generatePosterForRecord(
  canvasJson: string,
  recordId: string,
  getter: FieldValueGetter,
  multiplier = 2,
): Promise<Blob | null> {
  const offscreen = document.createElement('canvas')
  const parsed = JSON.parse(canvasJson)
  const width = parsed.width ?? 800
  const height = parsed.height ?? 1200

  offscreen.width = width
  offscreen.height = height

  const tempCanvas = new fabric.StaticCanvas(offscreen, { width, height })

  await loadWithReviver(tempCanvas, canvasJson)

  const objects = tempCanvas.getObjects() as PlaceholderObject[]

  // collect image replacements to avoid index shift
  const imageReplacements: { obj: PlaceholderObject; idx: number; urls: string[] }[] = []

  for (const obj of objects) {
    if (!obj.binding) continue
    const { fieldId } = obj.binding

    if (obj.placeholderType === 'text') {
      const text = await getter.getCellText(fieldId, recordId)
      const textObj = obj as unknown as fabric.Textbox
      textObj.set('text', text || ' ')
      // Auto-fit: shrink fontSize to fit text in one line within box width
      if (textObj instanceof fabric.Textbox && textObj.width) {
        const maxSize = textObj.fontSize ?? 36
        let size = maxSize
        while (size > 8) {
          textObj.set({ fontSize: size })
          textObj.initDimensions()
          const lineHeight = size * (textObj.lineHeight ?? 1.2)
          if (textObj.height! <= lineHeight * 1.3) break
          size--
        }
      }
    }

    if (obj.placeholderType === 'image') {
      const urls = await getter.getAttachmentUrls(fieldId, recordId)
      if (urls.length > 0) {
        const idx = tempCanvas.getObjects().indexOf(obj)
        imageReplacements.push({ obj, idx, urls })
      }
    }
  }

  // apply image replacements in reverse order to preserve indices
  for (let i = imageReplacements.length - 1; i >= 0; i--) {
    const { obj, idx, urls } = imageReplacements[i]
    try {
      const img = await fabric.FabricImage.fromURL(urls[0], { crossOrigin: 'anonymous' })
      const targetWidth = Math.max(1, obj.getScaledWidth())
      const targetHeight = Math.max(1, obj.getScaledHeight())
      const center = obj.getCenterPoint()
      const left = center.x - targetWidth / 2
      const top = center.y - targetHeight / 2

      const fitMode = obj.placeholderFit ?? 'cover'
      if (fitMode === 'contain') {
        fitImageContain(
          img,
          targetWidth,
          targetHeight,
          left,
          top,
          obj.angle,
          obj.placeholderShape === 'circle',
        )
      } else {
        fitImageCover(img, targetWidth, targetHeight, left, top, obj.angle)
      }

      if (obj.placeholderShape === 'circle') {
        img.set({
          clipPath: new fabric.Circle({
            radius: Math.min(targetWidth, targetHeight) / 2,
            originX: 'center',
            originY: 'center',
          }),
        })
      }

      tempCanvas.remove(obj)
      tempCanvas.insertAt(idx, img)
    } catch (err) {
      console.error('Failed to load image for record', recordId, err)
    }
  }

  tempCanvas.renderAll()

  const dataUrl = tempCanvas.toDataURL({
    format: 'png',
    quality: 1,
    multiplier,
  })

  tempCanvas.dispose()

  return dataUrlToBlob(dataUrl)
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png'
  const bytes = atob(base64)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) {
    arr[i] = bytes.charCodeAt(i)
  }
  return new Blob([arr], { type: mime })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
