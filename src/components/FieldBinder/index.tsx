import { Select, Typography, Tag } from '@douyinfe/semi-ui'
import type { useCanvas } from '../../hooks/useCanvas'
import type { PlaceholderObject } from '../../hooks/useCanvas'
import type { FieldMeta } from '../../types'

const { Title, Text } = Typography

interface FieldBinderProps {
  canvasHook: ReturnType<typeof useCanvas>
  textFields: FieldMeta[]
  imageFields: FieldMeta[]
}

export function FieldBinder({ canvasHook, textFields, imageFields }: FieldBinderProps) {
  const { activeObject, bindField, placeholders, canvas } = canvasHook

  const handleBind = (placeholder: PlaceholderObject, fieldId: string | undefined) => {
    if (!fieldId) {
      bindField(null, placeholder)
      return
    }
    const fields = placeholder.placeholderType === 'text' ? textFields : imageFields
    const field = fields.find((f) => f.id === fieldId)
    if (!field) return
    bindField({ fieldId: field.id, fieldName: field.name, fieldType: field.type }, placeholder)
  }

  if (placeholders.length === 0) {
    return (
      <div className="panel-section">
        <Title heading={6} className="section-title">字段绑定</Title>
        <div className="binding-empty">
          <div className="binding-empty-icon">+</div>
          <div className="binding-empty-text">请先添加文字或图片占位框</div>
        </div>
      </div>
    )
  }

  return (
    <div className="panel-section">
      <Title heading={6} className="section-title">字段绑定</Title>
      <div className="binding-list">
        {placeholders.map((p) => {
          const isText = p.placeholderType === 'text'
          const fields = isText ? textFields : imageFields
          const isActive = activeObject?.placeholderId === p.placeholderId

          return (
            <div
              key={p.placeholderId}
              className={`binding-row ${isActive ? 'binding-row-active' : ''}`}
              onClick={() => {
                canvas?.setActiveObject(p)
                canvas?.renderAll()
              }}
            >
              <div className="binding-row-label">
                <Tag size="small" color={isText ? 'blue' : 'green'} style={{ marginRight: 4 }}>
                  {isText ? 'T' : 'IMG'}
                </Tag>
                <Text
                  ellipsis={{ showTooltip: true }}
                  style={{ maxWidth: 80, fontSize: 12 }}
                >
                  {p.placeholderLabel ?? p.placeholderId}
                </Text>
              </div>
              <Select
                size="small"
                style={{ flex: 1, minWidth: 0 }}
                placeholder="选择字段"
                value={p.binding?.fieldId ?? undefined}
                showClear
                filter
                onChange={(v) => handleBind(p, v as string | undefined)}
                optionList={fields.map((f) => ({
                  label: f.name,
                  value: f.id,
                }))}
                dropdownStyle={{ maxWidth: 240 }}
                clickToHide
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
