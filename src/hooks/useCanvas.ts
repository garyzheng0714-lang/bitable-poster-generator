import { useCallback, useEffect, useRef, useState } from 'react'
import * as fabric from 'fabric'
import { setupGuidelines } from '../utils/guidelines'
import type { PlaceholderBinding } from '../types'

const CANVAS_DEFAULT_W = 800
const CANVAS_DEFAULT_H = 1200
const CONTAINER_PADDING = 24

export interface PlaceholderObject extends fabric.FabricObject {
  placeholderId?: string
  placeholderType?: 'text' | 'image'
  placeholderLabel?: string
  binding?: PlaceholderBinding | null
}

async function loadWithReviver(
  canvas: fabric.Canvas | fabric.StaticCanvas,
  json: string,
): Promise<void> {
  await canvas.loadFromJSON(json, (_serialized: any, instance: any) => {
    if (_serialized.placeholderId) {
      ;(instance as PlaceholderObject).placeholderId = _serialized.placeholderId
      ;(instance as PlaceholderObject).placeholderType = _serialized.placeholderType
      ;(instance as PlaceholderObject).placeholderLabel = _serialized.placeholderLabel
      ;(instance as PlaceholderObject).binding = _serialized.binding ?? null
    }
    if (_serialized.placeholderType === 'text') {
      instance.set({ lockUniScaling: true })
      ;(instance as any).setControlsVisibility?.({
        mt: false,
        mb: false,
        ml: false,
        mr: false,
      })
    }
    if (_serialized._isBg) {
      ;(instance as any)._isBg = true
      instance.set({ selectable: false, evented: false })
    }
  })
}

function serializeCanvas(canvas: fabric.Canvas): string {
  const canvasData = canvas.toJSON()
  const objects = canvas.getObjects()
  if (canvasData.objects) {
    canvasData.objects.forEach((objData: any, i: number) => {
      const obj = objects[i] as PlaceholderObject
      if (obj) {
        objData.placeholderId = obj.placeholderId
        objData.placeholderType = obj.placeholderType
        objData.placeholderLabel = obj.placeholderLabel
        objData.binding = obj.binding
        if ((obj as any)._isBg) objData._isBg = true
      }
    })
  }
  return JSON.stringify(canvasData)
}

export function useCanvas(containerRef: React.RefObject<HTMLDivElement | null>) {
  const canvasRef = useRef<fabric.Canvas | null>(null)
  const [canvas, setCanvas] = useState<fabric.Canvas | null>(null)
  const [activeObject, setActiveObject] = useState<PlaceholderObject | null>(null)
  const [placeholders, setPlaceholders] = useState<PlaceholderObject[]>([])
  const [templateSize, setTemplateSize] = useState({ width: CANVAS_DEFAULT_W, height: CANVAS_DEFAULT_H })
  const historyRef = useRef<string[]>([])
  const historyIndexRef = useRef(-1)
  const skipSaveRef = useRef(false)

  const refreshPlaceholders = useCallback(() => {
    const c = canvasRef.current
    if (!c) {
      setPlaceholders([])
      return
    }
    const list = c.getObjects().filter(
      (o: any) => o.placeholderType === 'text' || o.placeholderType === 'image',
    ) as PlaceholderObject[]
    setPlaceholders(list)
  }, [])

  const saveHistory = useCallback((c: fabric.Canvas) => {
    if (skipSaveRef.current) return
    const json = serializeCanvas(c)
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1)
    historyRef.current.push(json)
    historyIndexRef.current = historyRef.current.length - 1
  }, [])

  // initialize canvas
  const initCanvas = useCallback(async (canvasEl: HTMLCanvasElement) => {
    if (canvasRef.current) {
      await canvasRef.current.dispose()
    }

    const c = new fabric.Canvas(canvasEl, {
      width: CANVAS_DEFAULT_W,
      height: CANVAS_DEFAULT_H,
      backgroundColor: '#ffffff',
      selection: true,
      preserveObjectStacking: true,
    })

    // Selection controls: dashed border + circle handles
    fabric.FabricObject.prototype.set({
      borderColor: 'rgba(0, 0, 0, 0.4)',
      borderScaleFactor: 1,
      borderDashArray: [4, 4],
      cornerColor: '#ffffff',
      cornerStrokeColor: 'rgba(0, 0, 0, 0.5)',
      cornerSize: 10,
      cornerStyle: 'circle',
      transparentCorners: false,
      padding: 2,
    })
    // Rotation snapping: snap to 0°, 45°, 90°, etc.
    fabric.FabricObject.prototype.snapAngle = 45
    fabric.FabricObject.prototype.snapThreshold = 5

    setupGuidelines(c)

    // --- Rotation angle indicator ---
    let isRotating = false
    let rotationAngle = 0
    let rotationTarget: fabric.FabricObject | null = null

    c.on('object:rotating', (e) => {
      isRotating = true
      rotationAngle = Math.round(e.target?.angle ?? 0)
      rotationTarget = e.target ?? null
    })

    const clearRotationState = () => {
      if (isRotating) {
        isRotating = false
        rotationTarget = null
        c.requestRenderAll()
      }
    }
    c.on('mouse:up', clearRotationState)

    c.on('after:render', () => {
      if (!isRotating || !rotationTarget) return
      const ctx = c.getContext()
      const bound = rotationTarget.getBoundingRect()
      const text = `${rotationAngle}°`

      ctx.save()
      ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      const metrics = ctx.measureText(text)
      const pw = 8
      const bw = metrics.width + pw * 2
      const bh = 22
      const x = bound.left + bound.width / 2
      const y = bound.top - 12

      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
      ctx.beginPath()
      ctx.roundRect(x - bw / 2, y - bh, bw, bh, 4)
      ctx.fill()

      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(text, x, y - bh / 2)
      ctx.restore()
    })

    c.on('selection:created', (e) => {
      setActiveObject((e.selected?.[0] as PlaceholderObject) ?? null)
    })
    c.on('selection:updated', (e) => {
      setActiveObject((e.selected?.[0] as PlaceholderObject) ?? null)
    })
    c.on('selection:cleared', () => {
      setActiveObject(null)
    })

    c.on('object:modified', (e) => {
      const target = e.target as PlaceholderObject
      if (target?.placeholderType === 'text') {
        const textObj = target as unknown as fabric.IText
        const sx = textObj.scaleX ?? 1
        const sy = textObj.scaleY ?? 1
        if (sx !== 1 || sy !== 1) {
          const fontSize = textObj.fontSize ?? 36
          const newSize = Math.round(fontSize * Math.max(sx, sy))
          textObj.set({ fontSize: newSize, scaleX: 1, scaleY: 1 })
          textObj.setCoords()
          c.renderAll()
        }
      }
      saveHistory(c)
    })
    c.on('object:added', () => {
      if (!skipSaveRef.current) saveHistory(c)
      refreshPlaceholders()
    })
    c.on('object:removed', () => {
      if (!skipSaveRef.current) saveHistory(c)
      refreshPlaceholders()
    })

    canvasRef.current = c
    setCanvas(c)
    saveHistory(c)

    return c
  }, [saveHistory, refreshPlaceholders])

  // cleanup on unmount
  useEffect(() => {
    return () => {
      canvasRef.current?.dispose()
      canvasRef.current = null
    }
  }, [])

  // fit canvas to container: use actual container dimensions
  const fitToContainer = useCallback(() => {
    const c = canvasRef.current
    const container = containerRef.current
    if (!c || !container) return

    const containerWidth = container.clientWidth - CONTAINER_PADDING
    const containerHeight = container.clientHeight - CONTAINER_PADDING
    if (containerWidth <= 0 || containerHeight <= 0) return

    const scaleByWidth = containerWidth / templateSize.width
    const scaleByHeight = containerHeight / templateSize.height
    const scale = Math.min(scaleByWidth, scaleByHeight, 1)

    c.setDimensions({
      width: templateSize.width * scale,
      height: templateSize.height * scale,
    })
    c.setZoom(scale)
  }, [containerRef, templateSize])

  useEffect(() => {
    fitToContainer()
    window.addEventListener('resize', fitToContainer)
    return () => window.removeEventListener('resize', fitToContainer)
  }, [fitToContainer])

  // undo / redo with reviver
  const undo = useCallback(async () => {
    const c = canvasRef.current
    if (!c || historyIndexRef.current <= 0) return
    historyIndexRef.current--
    skipSaveRef.current = true
    await loadWithReviver(c, historyRef.current[historyIndexRef.current])
    c.renderAll()
    skipSaveRef.current = false
    refreshPlaceholders()
  }, [refreshPlaceholders])

  const redo = useCallback(async () => {
    const c = canvasRef.current
    if (!c || historyIndexRef.current >= historyRef.current.length - 1) return
    historyIndexRef.current++
    skipSaveRef.current = true
    await loadWithReviver(c, historyRef.current[historyIndexRef.current])
    c.renderAll()
    skipSaveRef.current = false
    refreshPlaceholders()
  }, [refreshPlaceholders])

  // set background template image
  const setBackgroundImage = useCallback(async (url: string) => {
    const c = canvasRef.current
    if (!c) return

    const img = await fabric.FabricImage.fromURL(url, { crossOrigin: 'anonymous' })
    if (url.startsWith('blob:')) URL.revokeObjectURL(url)

    // Convert to data URL so undo/redo won't reference dead blob URLs
    const tmpCanvas = document.createElement('canvas')
    tmpCanvas.width = img.width!
    tmpCanvas.height = img.height!
    const ctx = tmpCanvas.getContext('2d')!
    ctx.drawImage(img.getElement() as HTMLImageElement, 0, 0)
    const dataUrl = tmpCanvas.toDataURL('image/png')
    const imgFromData = await fabric.FabricImage.fromURL(dataUrl)

    const w = imgFromData.width!
    const h = imgFromData.height!
    setTemplateSize({ width: w, height: h })

    c.setDimensions({ width: w, height: h })

    imgFromData.set({
      left: 0,
      top: 0,
      selectable: false,
      evented: false,
      excludeFromExport: false,
    })
    imgFromData.scaleToWidth(w)
    imgFromData.scaleToHeight(h)

    const objs = c.getObjects()
    const bgObj = objs.find((o: any) => o._isBg)
    if (bgObj) c.remove(bgObj)

    ;(imgFromData as any)._isBg = true
    c.insertAt(0, imgFromData)
    c.renderAll()
    fitToContainer()
    saveHistory(c)
  }, [fitToContainer, saveHistory])

  // count existing placeholders to offset new ones
  const getPlaceholderOffset = useCallback(() => {
    const c = canvasRef.current
    if (!c) return 0
    return c.getObjects().filter((o: any) => o.placeholderType).length
  }, [])

  // add text placeholder
  const addTextPlaceholder = useCallback(() => {
    const c = canvasRef.current
    if (!c) return

    const offset = getPlaceholderOffset() * 30
    const id = crypto.randomUUID()
    const text = new fabric.IText('Text', {
      left: templateSize.width / 2 - 60 + offset,
      top: templateSize.height / 2 - 20 + offset,
      fontSize: 36,
      fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif',
      fill: '#333333',
      editable: true,
      padding: 8,
      lockUniScaling: true,
    }) as PlaceholderObject

    ;(text as unknown as fabric.IText).setControlsVisibility({
      mt: false,
      mb: false,
      ml: false,
      mr: false,
    })

    text.placeholderId = id
    text.placeholderType = 'text'
    text.placeholderLabel = 'Text'
    text.binding = null

    c.add(text)
    c.setActiveObject(text)
    c.renderAll()
  }, [templateSize, getPlaceholderOffset])

  // add image placeholder
  const addImagePlaceholder = useCallback(() => {
    const c = canvasRef.current
    if (!c) return

    const offset = getPlaceholderOffset() * 30
    const id = crypto.randomUUID()
    const w = 200
    const h = 200

    const rect = new fabric.Rect({
      left: templateSize.width / 2 - w / 2 + offset,
      top: templateSize.height / 2 - h / 2 + offset,
      width: w,
      height: h,
      fill: 'rgba(0, 0, 0, 0.03)',
      stroke: 'rgba(0, 0, 0, 0.12)',
      strokeWidth: 1,
      rx: 2,
      ry: 2,
      padding: 4,
    }) as unknown as PlaceholderObject

    rect.placeholderId = id
    rect.placeholderType = 'image'
    rect.placeholderLabel = 'Image'
    rect.binding = null

    c.add(rect)
    c.setActiveObject(rect)
    c.renderAll()
  }, [templateSize, getPlaceholderOffset])

  // bind field to a specific placeholder (accepts explicit target to avoid stale state)
  const bindField = useCallback((binding: PlaceholderBinding | null, target?: PlaceholderObject) => {
    const c = canvasRef.current
    const obj = target ?? activeObject
    if (!c || !obj) return

    obj.binding = binding
    if (binding && obj.placeholderType === 'text') {
      ;(obj as unknown as fabric.IText).set('text', `{{${binding.fieldName}}}`)
    }
    if (binding && obj.placeholderType === 'image') {
      obj.placeholderLabel = binding.fieldName
    }

    c.renderAll()
    setActiveObject({ ...obj } as PlaceholderObject)
    refreshPlaceholders()
    saveHistory(c)
  }, [activeObject, refreshPlaceholders, saveHistory])

  // delete active object
  const deleteActive = useCallback(() => {
    const c = canvasRef.current
    if (!c || !activeObject) return
    c.remove(activeObject)
    c.discardActiveObject()
    c.renderAll()
    setActiveObject(null)
  }, [activeObject])

  // keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      const c = canvasRef.current
      if (c) {
        const active = c.getActiveObject()
        if (active && (active as any).isEditing) return
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        deleteActive()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo, deleteActive])

  // export canvas as data url
  const exportAsDataUrl = useCallback((multiplier = 2): string | null => {
    const c = canvasRef.current
    if (!c) return null
    return c.toDataURL({
      format: 'png',
      quality: 1,
      multiplier,
    })
  }, [])

  // get canvas JSON for template saving
  const getCanvasJson = useCallback((): string => {
    const c = canvasRef.current
    if (!c) return '{}'
    return serializeCanvas(c)
  }, [])

  // load canvas from JSON
  const loadCanvasJson = useCallback(async (json: string) => {
    const c = canvasRef.current
    if (!c) return
    skipSaveRef.current = true
    await loadWithReviver(c, json)
    c.renderAll()
    skipSaveRef.current = false
    refreshPlaceholders()
    saveHistory(c)
  }, [refreshPlaceholders, saveHistory])

  return {
    canvasRef,
    canvas,
    activeObject,
    placeholders,
    templateSize,
    initCanvas,
    fitToContainer,
    setBackgroundImage,
    addTextPlaceholder,
    addImagePlaceholder,
    bindField,
    deleteActive,
    refreshPlaceholders,
    exportAsDataUrl,
    getCanvasJson,
    loadCanvasJson,
    undo,
    redo,
  }
}

export { loadWithReviver }
