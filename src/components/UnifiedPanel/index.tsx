import { useEffect, useRef, useState } from 'react'
import * as fabric from 'fabric'
import {
  Button,
  Select,
  InputNumber,
  Toast,
  Progress,
  RadioGroup,
  Radio,
} from '@douyinfe/semi-ui'
import { IconPlay, IconDownload, IconClose, IconPlus } from '@douyinfe/semi-icons'
import { bitable } from '@lark-base-open/js-sdk'
import type { useCanvas } from '../../hooks/useCanvas'
import type { PlaceholderObject } from '../../hooks/useCanvas'
import type { useBitable } from '../../hooks/useBitable'
import type { GenerateMode } from '../../types'
import { generatePosterForRecord, downloadBlob, dataUrlToBlob } from '../../services/posterGenerator'

type OutputMode = 'download' | 'attachment'

interface Props {
  canvasHook: ReturnType<typeof useCanvas>
  bitableHook: ReturnType<typeof useBitable>
}

export function UnifiedPanel({ canvasHook, bitableHook }: Props) {
  const {
    activeObject,
    placeholders,
    canvas,
    bindField,
    updateTextFontSize,
    updateTextBoxWidth,
    updateImageSize,
    updateImageFit,
    updateTextColor,
    getCanvasJson,
    exportAsDataUrl,
    previewRecord,
    clearPreview,
  } = canvasHook

  const { textFields, imageFields, attachmentFields, isStandalone } = bitableHook

  const [generateMode, setGenerateMode] = useState<GenerateMode>('selected')
  const [outputMode, setOutputMode] = useState<OutputMode>('download')
  const [targetFieldId, setTargetFieldId] = useState<string | undefined>()
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const cancelledRef = useRef(false)

  // Auto-preview when bitable selection changes
  useEffect(() => {
    if (isStandalone) return

    let cancelled = false
    const runPreview = async () => {
      try {
        const selection = await bitable.base.getSelection()
        if (cancelled) return
        if (selection?.recordId) {
          const hasBound = placeholders.some((p) => p.binding)
          if (hasBound) {
            await previewRecord(selection.recordId, {
              getCellText: bitableHook.getCellText,
              getAttachmentUrls: bitableHook.getAttachmentUrls,
            })
          }
        } else {
          clearPreview()
        }
      } catch {
        // ignore
      }
    }

    runPreview()

    let off: (() => void) | undefined
    try {
      off = bitable.base.onSelectionChange(() => {
        if (!cancelled) runPreview()
      })
    } catch {
      // standalone
    }

    return () => {
      cancelled = true
      off?.()
    }
  }, [isStandalone, placeholders, previewRecord, clearPreview, bitableHook])

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

  const handlePreviewExport = () => {
    const dataUrl = exportAsDataUrl(2)
    if (!dataUrl) {
      Toast.warning({ content: '画布为空' })
      return
    }
    const blob = dataUrlToBlob(dataUrl)
    downloadBlob(blob, `poster-preview-${Date.now()}.png`)
    Toast.success({ content: '预览图已导出' })
  }

  const handleGenerate = async () => {
    if (isStandalone) {
      handlePreviewExport()
      return
    }

    clearPreview()

    const canvasJson = getCanvasJson()
    if (!canvasJson || canvasJson === '{}') {
      Toast.warning({ content: '画布为空' })
      return
    }

    const hasBound = placeholders.some((p) => p.binding)
    if (!hasBound) {
      Toast.warning({ content: '请先绑定字段' })
      return
    }

    if (outputMode === 'attachment' && !targetFieldId) {
      Toast.warning({ content: '请选择目标附件字段' })
      return
    }

    let recordIds: string[] = []
    if (generateMode === 'selected') {
      try {
        const selection = await bitable.base.getSelection()
        if (selection?.recordId) {
          recordIds = [selection.recordId]
        } else {
          Toast.warning({ content: '请先选择一行数据' })
          return
        }
      } catch {
        Toast.warning({ content: '无法获取选中行' })
        return
      }
    } else {
      recordIds = await bitableHook.getRecordIds()
    }

    if (recordIds.length === 0) {
      Toast.warning({ content: '没有数据行' })
      return
    }

    cancelledRef.current = false
    setGenerating(true)
    setProgress({ current: 0, total: recordIds.length })

    let successCount = 0
    for (const recordId of recordIds) {
      if (cancelledRef.current) {
        setGenerating(false)
        Toast.info({ content: '已取消生成' })
        return
      }

      try {
        const blob = await generatePosterForRecord(canvasJson, recordId, {
          getCellText: bitableHook.getCellText,
          getAttachmentUrls: bitableHook.getAttachmentUrls,
        }, 2)

        if (blob) {
          if (outputMode === 'attachment' && targetFieldId) {
            const ok = await bitableHook.writeAttachment(targetFieldId, recordId, blob, `poster-${recordId}.png`)
            if (ok) successCount++
          } else {
            downloadBlob(blob, `poster-${recordId}.png`)
            successCount++
          }
        }
        setProgress((prev) => ({ ...prev, current: prev.current + 1 }))
      } catch (err) {
        console.error('Failed to generate poster for record', recordId, err)
        setProgress((prev) => ({ ...prev, current: prev.current + 1 }))
      }
    }

    setGenerating(false)
    if (outputMode === 'attachment') {
      Toast.success({ content: `已写入 ${successCount} 张海报到表格` })
    } else {
      Toast.success({ content: `已下载 ${successCount} 张海报` })
    }
  }

  return (
    <div className="unified-panel">
      <div className="unified-panel-list">
        {placeholders.length === 0 ? (
          <div className="panel-empty-hint">
            点击左侧工具栏添加文字或图片占位框
          </div>
        ) : (
          placeholders.map((p) => {
            const isText = p.placeholderType === 'text'
            const isActive = activeObject?.placeholderId === p.placeholderId
            const fields = isText ? textFields : imageFields
            const isCircle = p.placeholderShape === 'circle'

            const textObj = p as unknown as fabric.Textbox
            const fontSize = isText ? Math.round(textObj.fontSize ?? 36) : 0
            const textBoxWidth = isText ? Math.round((textObj.width ?? 240) * (textObj.scaleX ?? 1)) : 0
            const textColor = isText ? String(textObj.fill ?? '#333333') : ''

            const imgW = !isText ? Math.round((p.width ?? 0) * (p.scaleX ?? 1)) : 0
            const imgH = !isText ? Math.round((p.height ?? 0) * (p.scaleY ?? 1)) : 0
            const diameter = !isText && isCircle && p instanceof fabric.Circle
              ? Math.round((p.radius ?? 0) * 2 * (p.scaleX ?? 1))
              : 0

            const label = p.binding?.fieldName
              ?? (isText ? '文字' : isCircle ? 'Logo' : '图片')

            return (
              <div
                key={p.placeholderId}
                className={`placeholder-row ${isActive ? 'active' : ''}`}
              >
                <div className="placeholder-row-main">
                  <div
                    className="ph-select-target"
                    onClick={() => {
                      canvas?.setActiveObject(p)
                      canvas?.renderAll()
                    }}
                  >
                    <span className={`ph-badge ${isText ? 'text' : 'image'}`}>
                      {isText ? 'T' : isCircle ? 'C' : 'I'}
                    </span>
                    <span className="ph-name">{label}</span>
                  </div>
                  <Select
                    size="small"
                    style={{ width: 120, flexShrink: 0 }}
                    placeholder="绑定字段"
                    value={p.binding?.fieldId ?? undefined}
                    showClear
                    onChange={(v) => handleBind(p, v as string | undefined)}
                    optionList={fields.map((f) => ({
                      label: f.name,
                      value: f.id,
                    }))}
                    dropdownStyle={{ maxWidth: 240 }}
                    clickToHide
                  />
                </div>

                {isActive && (
                  <div className="placeholder-row-props">
                    {isText && (
                      <>
                        <div className="prop-field">
                          <span className="prop-label">字号</span>
                          <InputNumber
                            size="small"
                            min={8}
                            max={360}
                            step={1}
                            value={fontSize}
                            onChange={(v) => {
                              if (typeof v === 'number') updateTextFontSize(v)
                            }}
                            hideButtons
                            style={{ width: 52 }}
                          />
                        </div>
                        <div className="prop-field">
                          <span className="prop-label">框宽</span>
                          <InputNumber
                            size="small"
                            min={40}
                            max={2000}
                            step={1}
                            value={textBoxWidth}
                            onChange={(v) => {
                              if (typeof v === 'number') updateTextBoxWidth(v)
                            }}
                            hideButtons
                            style={{ width: 60 }}
                          />
                        </div>
                        <div className="prop-field">
                          <span className="prop-label">颜色</span>
                          <input
                            type="color"
                            value={textColor}
                            onChange={(e) => updateTextColor(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="color-picker"
                          />
                        </div>
                      </>
                    )}
                    {!isText && isCircle && (
                      <div className="prop-field">
                        <span className="prop-label">直径</span>
                        <InputNumber
                          size="small"
                          min={24}
                          max={2000}
                          step={1}
                          value={diameter}
                          onChange={(v) => {
                            if (typeof v === 'number') updateImageSize({ diameter: v })
                          }}
                          hideButtons
                          style={{ width: 60 }}
                        />
                      </div>
                    )}
                    {!isText && !isCircle && (
                      <>
                        <div className="prop-field">
                          <span className="prop-label">宽</span>
                          <InputNumber
                            size="small"
                            min={24}
                            max={2000}
                            step={1}
                            value={imgW}
                            onChange={(v) => {
                              if (typeof v === 'number') updateImageSize({ width: v, height: imgH })
                            }}
                            hideButtons
                            style={{ width: 56 }}
                          />
                        </div>
                        <div className="prop-field">
                          <span className="prop-label">高</span>
                          <InputNumber
                            size="small"
                            min={24}
                            max={2000}
                            step={1}
                            value={imgH}
                            onChange={(v) => {
                              if (typeof v === 'number') updateImageSize({ width: imgW, height: v })
                            }}
                            hideButtons
                            style={{ width: 56 }}
                          />
                        </div>
                      </>
                    )}
                    {!isText && (
                      <div className="prop-field">
                        <span className="prop-label">填充</span>
                        <Select
                          size="small"
                          value={p.placeholderFit ?? 'contain'}
                          style={{ width: 76 }}
                          optionList={[
                            { label: '铺满', value: 'cover' },
                            { label: '完整', value: 'contain' },
                          ]}
                          onChange={(v) => {
                            if (v === 'cover' || v === 'contain') updateImageFit(v)
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <div className="unified-panel-actions">
        {generating && (
          <Progress
            percent={Math.round((progress.current / Math.max(progress.total, 1)) * 100)}
            showInfo
            size="small"
            style={{ marginBottom: 6 }}
          />
        )}

        {isStandalone ? (
          <Button
            theme="solid"
            type="primary"
            icon={<IconDownload />}
            onClick={handlePreviewExport}
            block
            size="small"
          >
            导出预览图
          </Button>
        ) : (
          <>
            {!generating && (
              <div className="generate-options">
                <RadioGroup
                  value={generateMode}
                  onChange={(e) => setGenerateMode(e.target.value as GenerateMode)}
                  type="button"
                  size="small"
                >
                  <Radio value="selected">选中行</Radio>
                  <Radio value="all">全部</Radio>
                </RadioGroup>
                <RadioGroup
                  value={outputMode}
                  onChange={(e) => setOutputMode(e.target.value as OutputMode)}
                  type="button"
                  size="small"
                >
                  <Radio value="download">下载</Radio>
                  <Radio value="attachment">写入表格</Radio>
                </RadioGroup>
              </div>
            )}

            {outputMode === 'attachment' && !generating && (
              <div className="generate-field-row">
                <Select
                  size="small"
                  placeholder="选择附件字段"
                  value={targetFieldId}
                  onChange={(v) => setTargetFieldId(v as string | undefined)}
                  style={{ flex: 1 }}
                  optionList={attachmentFields.map((f) => ({
                    label: f.name,
                    value: f.id,
                  }))}
                  emptyContent="暂无附件字段"
                  showClear
                />
                <Button
                  size="small"
                  icon={<IconPlus />}
                  onClick={async () => {
                    const fieldId = await bitableHook.createAttachmentField('海报')
                    if (fieldId) {
                      setTargetFieldId(fieldId)
                      Toast.success({ content: '已创建「海报」附件字段' })
                    }
                  }}
                  style={{ flexShrink: 0 }}
                />
              </div>
            )}

            <div className="generate-bar">
              <Button
                theme="solid"
                type="primary"
                icon={generating ? undefined : <IconPlay />}
                loading={generating}
                onClick={handleGenerate}
                disabled={generating}
                style={{ flex: 1 }}
                size="small"
              >
                {generating ? `${progress.current}/${progress.total}` : '生成海报'}
              </Button>
              {generating && (
                <Button
                  type="danger"
                  icon={<IconClose />}
                  onClick={() => { cancelledRef.current = true }}
                  size="small"
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
