import * as fabric from 'fabric'
import type { PlaceholderObject } from '../hooks/useCanvas'
import { loadWithReviver } from '../hooks/useCanvas'
import { fitTextboxText, type TextboxWithBounds } from '../utils/textLayout'

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
 */
function fitImageContain(
  img: fabric.FabricImage,
  targetWidth: number,
  targetHeight: number,
  left: number,
  top: number,
  angle?: number,
) {
  const imgW = img.width!
  const imgH = img.height!
  const scale = Math.min(targetWidth / imgW, targetHeight / imgH)

  img.set({
    left: left + (targetWidth - imgW * scale) / 2,
    top: top + (targetHeight - imgH * scale) / 2,
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
      const textObj = obj as unknown as TextboxWithBounds
      fitTextboxText(textObj, {
        text: text || ' ',
        maxFontSize: Math.round(textObj.fontSize ?? 36),
      })
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

      const isCircle = obj.placeholderShape === 'circle'

      if (isCircle) {
        // Circle: scale to cover, center with originX/Y, clip with clipPath (no crop)
        const scale = Math.max(targetWidth / img.width!, targetHeight / img.height!)
        const r = Math.min(targetWidth, targetHeight) / 2
        img.set({
          left: center.x,
          top: center.y,
          originX: 'center',
          originY: 'center',
          angle: obj.angle ?? 0,
          scaleX: scale,
          scaleY: scale,
          clipPath: new fabric.Circle({ radius: r / scale, originX: 'center', originY: 'center' }),
        })
      } else {
        const fitMode = obj.placeholderFit ?? 'cover'
        if (fitMode === 'contain') {
          fitImageContain(img, targetWidth, targetHeight, left, top, obj.angle)
        } else {
          fitImageCover(img, targetWidth, targetHeight, left, top, obj.angle)
        }
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
