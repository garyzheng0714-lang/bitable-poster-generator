import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface UserRow {
  open_id: string;
  union_id: string | null;
  name: string;
  avatar_url: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionRow {
  token: string;
  open_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  refresh_expires_at: string;
  created_at: string;
}

export interface AppDataRow {
  id: number;
  project_id: string;
  open_id: string;
  data_key: string;
  data_value: string;
  created_at: string;
  updated_at: string;
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  open_id     TEXT PRIMARY KEY,
  union_id    TEXT,
  name        TEXT NOT NULL DEFAULT '',
  avatar_url  TEXT,
  email       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token               TEXT PRIMARY KEY,
  open_id             TEXT NOT NULL REFERENCES users(open_id),
  access_token        TEXT NOT NULL,
  refresh_token       TEXT NOT NULL DEFAULT '',
  expires_at          TEXT NOT NULL,
  refresh_expires_at  TEXT NOT NULL DEFAULT '',
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_open_id ON sessions(open_id);

CREATE TABLE IF NOT EXISTS app_data (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  TEXT NOT NULL,
  open_id     TEXT NOT NULL REFERENCES users(open_id),
  data_key    TEXT NOT NULL,
  data_value  TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_app_data_lookup ON app_data(project_id, open_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_data_unique ON app_data(project_id, open_id, data_key);
`;

let db: Database.Database | null = null;

function getDefaultDbPath(): string {
  const serverDir = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(serverDir, '../../data/app.db');
}

export function initDatabase(dbPath?: string): Database.Database {
  if (db) return db;
  const resolved = dbPath ?? getDefaultDbPath();
  mkdirSync(path.dirname(resolved), { recursive: true });
  db = new Database(resolved);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);
  return db;
}

// ── Users ──

export function upsertUser(user: {
  openId: string;
  unionId?: string | null;
  name: string;
  avatarUrl?: string | null;
  email?: string | null;
}): UserRow {
  const database = initDatabase();
  return database.prepare(`
    INSERT INTO users (open_id, union_id, name, avatar_url, email, updated_at)
    VALUES (@open_id, @union_id, @name, @avatar_url, @email, datetime('now'))
    ON CONFLICT(open_id) DO UPDATE SET
      union_id   = excluded.union_id,
      name       = excluded.name,
      avatar_url = excluded.avatar_url,
      email      = excluded.email,
      updated_at = datetime('now')
    RETURNING *
  `).get({
    open_id: user.openId,
    union_id: user.unionId ?? null,
    name: user.name,
    avatar_url: user.avatarUrl ?? null,
    email: user.email ?? null,
  }) as UserRow;
}

export function getUserByOpenId(openId: string): UserRow | undefined {
  const database = initDatabase();
  return database.prepare('SELECT * FROM users WHERE open_id = ?').get(openId) as UserRow | undefined;
}

// ── Sessions ──

export function upsertSession(session: {
  token: string;
  openId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
  refreshExpiresAt?: string;
}): SessionRow {
  const database = initDatabase();
  return database.prepare(`
    INSERT INTO sessions (token, open_id, access_token, refresh_token, expires_at, refresh_expires_at)
    VALUES (@token, @open_id, @access_token, @refresh_token, @expires_at, @refresh_expires_at)
    ON CONFLICT(token) DO UPDATE SET
      access_token       = excluded.access_token,
      refresh_token      = excluded.refresh_token,
      expires_at         = excluded.expires_at,
      refresh_expires_at = excluded.refresh_expires_at
    RETURNING *
  `).get({
    token: session.token,
    open_id: session.openId,
    access_token: session.accessToken,
    refresh_token: session.refreshToken ?? '',
    expires_at: session.expiresAt,
    refresh_expires_at: session.refreshExpiresAt ?? '',
  }) as SessionRow;
}

export function getSessionByToken(token: string): SessionRow | undefined {
  const database = initDatabase();
  return database.prepare('SELECT * FROM sessions WHERE token = ?').get(token) as SessionRow | undefined;
}

export function deleteSession(token: string): void {
  const database = initDatabase();
  database.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

// ── App Data (multi-project) ──

export function listAppData(projectId: string, openId: string, keyPrefix?: string): AppDataRow[] {
  const database = initDatabase();
  if (keyPrefix) {
    return database.prepare(
      'SELECT * FROM app_data WHERE project_id = ? AND open_id = ? AND data_key LIKE ? ORDER BY updated_at DESC'
    ).all(projectId, openId, keyPrefix + '%') as AppDataRow[];
  }
  return database.prepare(
    'SELECT * FROM app_data WHERE project_id = ? AND open_id = ? ORDER BY updated_at DESC'
  ).all(projectId, openId) as AppDataRow[];
}

export function getAppData(projectId: string, openId: string, dataKey: string): AppDataRow | undefined {
  const database = initDatabase();
  return database.prepare(
    'SELECT * FROM app_data WHERE project_id = ? AND open_id = ? AND data_key = ?'
  ).get(projectId, openId, dataKey) as AppDataRow | undefined;
}

export function putAppData(item: {
  projectId: string;
  openId: string;
  dataKey: string;
  dataValue: string;
}): AppDataRow {
  const database = initDatabase();
  return database.prepare(`
    INSERT INTO app_data (project_id, open_id, data_key, data_value, updated_at)
    VALUES (@project_id, @open_id, @data_key, @data_value, datetime('now'))
    ON CONFLICT(project_id, open_id, data_key) DO UPDATE SET
      data_value = excluded.data_value,
      updated_at = datetime('now')
    RETURNING *
  `).get({
    project_id: item.projectId,
    open_id: item.openId,
    data_key: item.dataKey,
    data_value: item.dataValue,
  }) as AppDataRow;
}

export function deleteAppData(projectId: string, openId: string, dataKey: string): boolean {
  const database = initDatabase();
  const result = database.prepare(
    'DELETE FROM app_data WHERE project_id = ? AND open_id = ? AND data_key = ?'
  ).run(projectId, openId, dataKey);
  return result.changes > 0;
}
