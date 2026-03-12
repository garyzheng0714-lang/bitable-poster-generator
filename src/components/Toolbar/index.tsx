import { Button, Tooltip } from '@douyinfe/semi-ui'
import { IconUndo, IconRedo, IconFont, IconImage, IconDelete } from '@douyinfe/semi-icons'
import type { useCanvas } from '../../hooks/useCanvas'

interface ToolbarProps {
  canvasHook: ReturnType<typeof useCanvas>
}

export function Toolbar({ canvasHook }: ToolbarProps) {
  const { addTextPlaceholder, addImagePlaceholder, addLogoPlaceholder, deleteActive, undo, redo, activeObject } =
    canvasHook

  const handleDragStart = (e: React.DragEvent, type: string) => {
    e.dataTransfer.setData('placeholder-type', type)
  }

  return (
    <div className="toolbar vertical">
      <div className="toolbar-group">
        <Tooltip content="添加文字" position="right">
          <Button
            icon={<IconFont />}
            theme="borderless"
            onClick={addTextPlaceholder}
            draggable
            onDragStart={(e) => handleDragStart(e, 'text')}
          />
        </Tooltip>
        <Tooltip content="添加图片" position="right">
          <Button
            icon={<IconImage />}
            theme="borderless"
            onClick={addImagePlaceholder}
            draggable
            onDragStart={(e) => handleDragStart(e, 'image')}
          />
        </Tooltip>
        <Tooltip content="添加圆形Logo" position="right">
          <Button
            icon={
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ display: 'block' }}>
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
              </svg>
            }
            theme="borderless"
            onClick={addLogoPlaceholder}
            draggable
            onDragStart={(e) => handleDragStart(e, 'logo')}
          />
        </Tooltip>
      </div>
      <div className="toolbar-divider" />
      <div className="toolbar-group">
        <Tooltip content="撤销" position="right">
          <Button icon={<IconUndo />} theme="borderless" onClick={undo} />
        </Tooltip>
        <Tooltip content="重做" position="right">
          <Button icon={<IconRedo />} theme="borderless" onClick={redo} />
        </Tooltip>
      </div>
      <div className="toolbar-divider" />
      <div className="toolbar-group">
        <Tooltip content="删除" position="right">
          <Button
            icon={<IconDelete />}
            theme="borderless"
            type="danger"
            onClick={deleteActive}
            disabled={!activeObject}
          />
        </Tooltip>
      </div>
    </div>
  )
}
