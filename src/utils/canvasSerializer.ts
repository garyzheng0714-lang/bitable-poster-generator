import type { TemplateConfig } from '../types'

const STORAGE_KEY = 'poster-generator-templates'

export function saveTemplate(template: TemplateConfig) {
  const templates = loadAllTemplates()
  const idx = templates.findIndex((t) => t.id === template.id)
  if (idx >= 0) {
    templates[idx] = template
  } else {
    templates.push(template)
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
}

export function loadAllTemplates(): TemplateConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export function deleteTemplate(id: string) {
  const templates = loadAllTemplates().filter((t) => t.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
}

export function generateId(): string {
  return crypto.randomUUID()
}
