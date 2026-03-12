import { useState, useRef, useCallback } from 'react'
import { Spin, Typography, Tabs, TabPane, Banner, Avatar, Button, Dropdown } from '@douyinfe/semi-ui'
import { useTheme } from './hooks/useTheme'
import { useAuth } from './hooks/useAuth'
import { useBitable } from './hooks/useBitable'
import { useCanvas } from './hooks/useCanvas'
import { CanvasEditor } from './components/CanvasEditor'
import { Toolbar } from './components/Toolbar'
import { TemplateManager } from './components/TemplateManager'
import { FieldBinder } from './components/FieldBinder'
import { PropertyPanel } from './components/PropertyPanel'
import { GeneratePanel } from './components/GeneratePanel'
import './App.css'

const { Title } = Typography

export default function App() {
  useTheme()
  const auth = useAuth()
  const bitableHook = useBitable()
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasHook = useCanvas(containerRef)
  const [activeTab, setActiveTab] = useState('fields')
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false)
  const toggleToolbar = useCallback(() => setToolbarCollapsed((v) => !v), [])

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
        <div className="header-right">
          <TemplateManager canvasHook={canvasHook} />
          {!auth.loading && !auth.user && (
            <Button
              size="small"
              theme="solid"
              type="primary"
              onClick={() => {
                window.location.href = `/api/auth/login?return_url=${encodeURIComponent(window.location.href)}`
              }}
            >
              登录
            </Button>
          )}
          {auth.user && (
            <Dropdown
              trigger="click"
              position="bottomRight"
              render={
                <Dropdown.Menu>
                  <Dropdown.Item disabled style={{ opacity: 0.6, cursor: 'default' }}>
                    {auth.user.name}
                  </Dropdown.Item>
                  <Dropdown.Divider />
                  <Dropdown.Item onClick={auth.logout}>退出登录</Dropdown.Item>
                </Dropdown.Menu>
              }
            >
              <Avatar
                size="extra-small"
                src={auth.user.avatar_url || undefined}
                alt={auth.user.name}
                style={{ marginLeft: 8, cursor: 'pointer' }}
              >
                {auth.user.name?.[0]}
              </Avatar>
            </Dropdown>
          )}
        </div>
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
        <div className={`side-toolbar ${toolbarCollapsed ? 'collapsed' : ''}`}>
          <div className="side-toolbar-content">
            <Toolbar canvasHook={canvasHook} />
          </div>
        </div>
        <button
          className={`side-toolbar-tab ${toolbarCollapsed ? 'collapsed' : ''}`}
          onClick={toggleToolbar}
        >
          {toolbarCollapsed ? '›' : '‹'}
        </button>
        <CanvasEditor canvasHook={canvasHook} />
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
          <TabPane tab="属性" itemKey="properties">
            <div className="tab-content">
              <PropertyPanel canvasHook={canvasHook} />
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
