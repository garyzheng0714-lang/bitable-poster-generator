import { useRef } from 'react'
import { Button } from '@douyinfe/semi-ui'
import { IconUpload } from '@douyinfe/semi-icons'
import type { useCanvas } from '../../hooks/useCanvas'

interface TemplateManagerProps {
  canvasHook: ReturnType<typeof useCanvas>
}

export function TemplateManager({ canvasHook }: TemplateManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    canvasHook.setBackgroundImage(url)
    e.target.value = ''
  }

  return (
    <div className="header-template">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleUpload}
      />
      <span className="template-size">
        {canvasHook.templateSize.width} x {canvasHook.templateSize.height}
      </span>
      <Button
        icon={<IconUpload />}
        size="small"
        theme="borderless"
        onClick={() => fileInputRef.current?.click()}
      >
        上传
      </Button>
    </div>
  )
}
