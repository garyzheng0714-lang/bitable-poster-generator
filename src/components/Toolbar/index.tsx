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
    <div className="toolbar">
      <div className="toolbar-group">
        <Tooltip content="添加文字">
          <Button
            icon={<IconFont />}
            theme="borderless"
            onClick={addTextPlaceholder}
            draggable
            onDragStart={(e) => handleDragStart(e, 'text')}
          />
        </Tooltip>
        <Tooltip content="添加图片">
          <Button
            icon={<IconImage />}
            theme="borderless"
            onClick={addImagePlaceholder}
            draggable
            onDragStart={(e) => handleDragStart(e, 'image')}
          />
        </Tooltip>
        <Tooltip content="添加圆形Logo">
          <Button
            theme="borderless"
            onClick={addLogoPlaceholder}
            draggable
            onDragStart={(e) => handleDragStart(e, 'logo')}
          >
            Logo
          </Button>
        </Tooltip>
      </div>
      <div className="toolbar-divider" />
      <div className="toolbar-group">
        <Tooltip content="撤销">
          <Button icon={<IconUndo />} theme="borderless" onClick={undo} />
        </Tooltip>
        <Tooltip content="重做">
          <Button icon={<IconRedo />} theme="borderless" onClick={redo} />
        </Tooltip>
      </div>
      <div className="toolbar-divider" />
      <div className="toolbar-group">
        <Tooltip content="删除">
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
