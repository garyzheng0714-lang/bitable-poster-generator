import { useCallback, useEffect, useState } from 'react'
import {
  bitable,
  FieldType,
  type IFieldMeta,
  type ITable,
} from '@lark-base-open/js-sdk'
import type { FieldMeta } from '../types'

const SDK_TIMEOUT = 3000

const TEXT_COMPATIBLE_TYPES = new Set([
  FieldType.Text,
  FieldType.Number,
  FieldType.DateTime,
  FieldType.Phone,
  FieldType.Url,
  FieldType.Email,
  FieldType.Barcode,
  FieldType.AutoNumber,
  FieldType.Currency,
  FieldType.Rating,
  FieldType.SingleSelect,
  FieldType.MultiSelect,
  FieldType.Formula,
  FieldType.CreatedTime,
  FieldType.ModifiedTime,
])

const IMAGE_COMPATIBLE_TYPES = new Set([FieldType.Attachment])

export function useBitable() {
  const [table, setTable] = useState<ITable | null>(null)
  const [fields, setFields] = useState<FieldMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [isStandalone, setIsStandalone] = useState(false)

  const loadTable = useCallback(async () => {
    try {
      setLoading(true)

      // timeout guard for standalone dev mode
      const selection = await Promise.race([
        bitable.base.getSelection(),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('SDK timeout')), SDK_TIMEOUT),
        ),
      ])

      let activeTable: ITable | null = null

      if (selection?.tableId) {
        activeTable = await bitable.base.getTableById(selection.tableId)
      }
      if (!activeTable) {
        activeTable = await bitable.base.getActiveTable()
      }
      if (!activeTable) {
        const tableList = await bitable.base.getTableList()
        if (tableList.length > 0) {
          activeTable = tableList[0]
        }
      }
      if (!activeTable) {
        setIsStandalone(true)
        return
      }

      setTable(activeTable)

      const metaList: IFieldMeta[] = await activeTable.getFieldMetaList()
      const fieldMetas: FieldMeta[] = metaList.map((m) => ({
        id: m.id,
        name: m.name,
        type: m.type,
      }))
      setFields(fieldMetas)
    } catch (err) {
      console.warn('Bitable SDK unavailable, running in standalone mode', err)
      setIsStandalone(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTable()

    let off: (() => void) | undefined
    try {
      off = bitable.base.onSelectionChange(() => {
        loadTable()
      })
    } catch {
      // standalone mode
    }

    return () => { off?.() }
  }, [loadTable])

  const textFields = fields.filter((f) => TEXT_COMPATIBLE_TYPES.has(f.type))
  const imageFields = fields.filter((f) => IMAGE_COMPATIBLE_TYPES.has(f.type))
  const attachmentFields = fields.filter((f) => f.type === FieldType.Attachment)

  const getRecordIds = useCallback(async (): Promise<string[]> => {
    if (!table) return []
    return table.getRecordIdList()
  }, [table])

  const getCellValue = useCallback(
    async (fieldId: string, recordId: string): Promise<unknown> => {
      if (!table) return null
      const field = await table.getFieldById(fieldId)
      return field.getValue(recordId)
    },
    [table],
  )

  const getAttachmentUrls = useCallback(
    async (fieldId: string, recordId: string): Promise<string[]> => {
      if (!table) return []
      try {
        const field = await table.getFieldById(fieldId)
        const urls = await (field as any).getAttachmentUrls(recordId)
        return urls ?? []
      } catch (err) {
        console.error('getAttachmentUrls failed', fieldId, recordId, err)
        return []
      }
    },
    [table],
  )

  const getCellText = useCallback(
    async (fieldId: string, recordId: string): Promise<string> => {
      if (!table) return ''
      try {
        const field = await table.getFieldById(fieldId)
        const val = await field.getValue(recordId)
        if (val === null || val === undefined) return ''
        if (typeof val === 'string') return val
        if (typeof val === 'number') return String(val)
        if (Array.isArray(val)) {
          return val
            .map((seg: any) => seg?.text ?? seg?.name ?? String(seg))
            .join('')
        }
        if (typeof val === 'object' && 'text' in (val as any)) {
          return (val as any).text
        }
        return String(val)
      } catch (err) {
        console.error('getCellText failed', fieldId, recordId, err)
        return ''
      }
    },
    [table],
  )

  const writeAttachment = useCallback(
    async (fieldId: string, recordId: string, blob: Blob, filename: string): Promise<boolean> => {
      if (!table) return false
      try {
        const field = await table.getFieldById(fieldId)
        const file = new File([blob], filename, { type: blob.type || 'image/png' })
        await (field as any).setValue(recordId, file)
        return true
      } catch (err) {
        console.error('writeAttachment failed', fieldId, recordId, err)
        return false
      }
    },
    [table],
  )

  const createAttachmentField = useCallback(
    async (name: string): Promise<string | null> => {
      if (!table) return null
      try {
        const fieldId = await table.addField({
          type: FieldType.Attachment,
          name,
        })
        await loadTable()
        return fieldId
      } catch (err) {
        console.error('Failed to create attachment field', err)
        return null
      }
    },
    [table, loadTable],
  )

  return {
    table,
    fields,
    textFields,
    imageFields,
    attachmentFields,
    loading,
    isStandalone,
    getRecordIds,
    getCellValue,
    getCellText,
    getAttachmentUrls,
    writeAttachment,
    createAttachmentField,
    reload: loadTable,
  }
}
