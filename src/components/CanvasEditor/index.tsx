import { useCallback, useEffect, useRef } from 'react'
import type { useCanvas } from '../../hooks/useCanvas'

interface CanvasEditorProps {
  canvasHook: ReturnType<typeof useCanvas>
}

export function CanvasEditor({ canvasHook }: CanvasEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasElRef = useRef<HTMLCanvasElement>(null)
  const initialized = useRef(false)

  const { initCanvas, fitToContainer } = canvasHook

  useEffect(() => {
    if (canvasElRef.current && !initialized.current) {
      initialized.current = true
      initCanvas(canvasElRef.current)
    }
  }, [initCanvas])

  useEffect(() => {
    fitToContainer()
  }, [fitToContainer])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const type = e.dataTransfer.getData('placeholder-type')
      if (type === 'text') canvasHook.addTextPlaceholder()
      if (type === 'image') canvasHook.addImagePlaceholder()
      if (type === 'logo') canvasHook.addLogoPlaceholder()
    },
    [canvasHook],
  )

  return (
    <div
      ref={containerRef}
      className="canvas-container"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <canvas ref={canvasElRef} />
    </div>
  )
}
