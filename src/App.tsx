import { useRef } from 'react'
import { Spin, Typography, Banner } from '@douyinfe/semi-ui'
import { useTheme } from './hooks/useTheme'
import { useBitable } from './hooks/useBitable'
import { useCanvas } from './hooks/useCanvas'
import { CanvasEditor } from './components/CanvasEditor'
import { Toolbar } from './components/Toolbar'
import { TemplateManager } from './components/TemplateManager'
import { FieldBinder } from './components/FieldBinder'
import { GeneratePanel } from './components/GeneratePanel'
import './App.css'

const { Title } = Typography

export default function App() {
  useTheme()
  const bitableHook = useBitable()
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasHook = useCanvas(containerRef)

  if (bitableHook.loading) {
    return (
      <div className="app-loading">
        <Spin size="large" />
        <p>加载中...</p>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="app-header">
        <div className="header-accent" />
        <Title heading={5} style={{ margin: 0 }}>
          海报生成器
        </Title>
      </div>

      <div className="app-scroll">
        {bitableHook.isStandalone && (
          <div className="standalone-banner">
            <Banner
              type="info"
              description="独立预览模式 - 请在多维表格中打开以绑定字段"
              closeIcon={null}
            />
          </div>
        )}

        <div className="section">
          <TemplateManager canvasHook={canvasHook} />
        </div>

        <div className="canvas-area">
          <div className="canvas-section" ref={containerRef}>
            <CanvasEditor canvasHook={canvasHook} />
          </div>
          <div className="canvas-toolbar">
            <Toolbar canvasHook={canvasHook} />
          </div>
        </div>

        <div className="section">
          <FieldBinder
            canvasHook={canvasHook}
            textFields={bitableHook.textFields}
            imageFields={bitableHook.imageFields}
          />
        </div>

        <div className="section">
          <GeneratePanel canvasHook={canvasHook} bitableHook={bitableHook} />
        </div>
      </div>
    </div>
  )
}
