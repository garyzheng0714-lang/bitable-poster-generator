import type { TemplateConfig } from '../types'
import { getAuthToken, listTemplates, saveTemplateToServer, deleteTemplateFromServer } from '../services/api'

const STORAGE_KEY = 'poster-generator-templates'

function isLoggedIn(): boolean {
  return !!getAuthToken()
}

// ── LocalStorage fallback ──

function loadLocal(): TemplateConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function saveLocal(template: TemplateConfig) {
  const templates = loadLocal()
  const idx = templates.findIndex((t) => t.id === template.id)
  if (idx >= 0) templates[idx] = template
  else templates.push(template)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
}

function deleteLocal(id: string) {
  const templates = loadLocal().filter((t) => t.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
}

// ── Public API (auto-switch local / server) ──

export async function loadAllTemplates(): Promise<TemplateConfig[]> {
  if (!isLoggedIn()) return loadLocal()
  try {
    const { items } = await listTemplates()
    return items.map((item) => JSON.parse(item.data_value) as TemplateConfig)
  } catch {
    return loadLocal()
  }
}

export async function saveTemplate(template: TemplateConfig): Promise<void> {
  saveLocal(template) // always keep local copy
  if (isLoggedIn()) {
    await saveTemplateToServer(template.id, JSON.stringify(template))
  }
}

export async function deleteTemplate(id: string): Promise<void> {
  deleteLocal(id)
  if (isLoggedIn()) {
    await deleteTemplateFromServer(id)
  }
}

export function generateId(): string {
  return crypto.randomUUID()
}
