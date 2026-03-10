import { useState, useRef } from 'react'
import { Spin, Typography, Tabs, TabPane, Banner } from '@douyinfe/semi-ui'
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
  const [activeTab, setActiveTab] = useState('fields')

  return (
    <div className="app">
      {bitableHook.loading && (
        <div className="app-loading-overlay">
          <Spin size="large" />
          <p>加载中...</p>
        </div>
      )}
      <div className="app-header">
        <div className="header-left">
          <div className="header-accent" />
          <Title heading={5} style={{ margin: 0 }}>海报生成器</Title>
        </div>
        <TemplateManager canvasHook={canvasHook} />
      </div>

      {bitableHook.isStandalone && (
        <Banner
          type="info"
          description="独立预览模式 - 请在多维表格中打开以绑定字段"
          closeIcon={null}
          className="standalone-banner"
        />
      )}

      <div className="canvas-workspace" ref={containerRef}>
        <CanvasEditor canvasHook={canvasHook} />
        <div className="floating-toolbar">
          <Toolbar canvasHook={canvasHook} />
        </div>
      </div>

      <div className="bottom-panel">
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key)}
          size="small"
          type="line"
          className="panel-tabs"
        >
          <TabPane tab="字段" itemKey="fields">
            <div className="tab-content">
              <FieldBinder
                canvasHook={canvasHook}
                textFields={bitableHook.textFields}
                imageFields={bitableHook.imageFields}
              />
            </div>
          </TabPane>
          <TabPane tab="生成" itemKey="generate">
            <div className="tab-content">
              <GeneratePanel canvasHook={canvasHook} bitableHook={bitableHook} />
            </div>
          </TabPane>
        </Tabs>
      </div>
    </div>
  )
}
