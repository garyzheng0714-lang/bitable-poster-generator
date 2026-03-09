import { useRef } from 'react'
import { Button, Typography } from '@douyinfe/semi-ui'
import { IconUpload } from '@douyinfe/semi-icons'
import type { useCanvas } from '../../hooks/useCanvas'

const { Title } = Typography

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
    <div className="panel-section">
      <Title heading={6} className="section-title">模板</Title>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleUpload}
      />
      <div className="template-row">
        <Button
          icon={<IconUpload />}
          size="small"
          onClick={() => fileInputRef.current?.click()}
        >
          上传模板
        </Button>
        <span className="template-size">
          {canvasHook.templateSize.width} x {canvasHook.templateSize.height}
        </span>
      </div>
    </div>
  )
}
