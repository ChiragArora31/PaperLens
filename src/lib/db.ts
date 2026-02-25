import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { cleanString, decodeList, encodeList, normalizeArxivInput, type UserPaperInput } from './userPaper';

const dbPath = resolve(process.cwd(), process.env.DATABASE_PATH || 'data/paperlens.db');
const dbDir = dirname(dbPath);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

function nowIso() {
  return new Date().toISOString();
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    password_hash TEXT,
    auth_provider TEXT NOT NULL DEFAULT 'credentials',
    image TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS recent_papers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    arxiv_id TEXT NOT NULL,
    title TEXT NOT NULL,
    abstract TEXT NOT NULL,
    authors_json TEXT NOT NULL,
    categories_json TEXT NOT NULL,
    viewed_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(user_id, arxiv_id)
  );

  CREATE INDEX IF NOT EXISTS idx_recent_user_viewed_at ON recent_papers (user_id, viewed_at DESC);

  CREATE TABLE IF NOT EXISTS bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    arxiv_id TEXT NOT NULL,
    title TEXT NOT NULL,
    abstract TEXT NOT NULL,
    authors_json TEXT NOT NULL,
    categories_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(user_id, arxiv_id)
  );

  CREATE INDEX IF NOT EXISTS idx_bookmarks_user_updated_at ON bookmarks (user_id, updated_at DESC);
`);

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  password_hash: string | null;
  auth_provider: string;
  image: string | null;
}

interface PaperRow {
  arxiv_id: string;
  title: string;
  abstract: string;
  authors_json: string;
  categories_json: string;
  viewed_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AppUser {
  id: string;
  email: string;
  name: string | null;
  passwordHash: string | null;
  provider: string;
  image: string | null;
}

export interface StoredPaper {
  arxivId: string;
  title: string;
  abstract: string;
  authors: string[];
  categories: string[];
  viewedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

function mapUser(row: UserRow | undefined): AppUser | null {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash,
    provider: row.auth_provider,
    image: row.image,
  };
}

function mapPaper(row: PaperRow): StoredPaper {
  return {
    arxivId: row.arxiv_id,
    title: row.title,
    abstract: row.abstract,
    authors: decodeList(row.authors_json),
    categories: decodeList(row.categories_json),
    viewedAt: row.viewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getUserByEmail(email: string): AppUser | null {
  const row = db
    .prepare('SELECT * FROM users WHERE email = ? LIMIT 1')
    .get(cleanString(email).toLowerCase()) as UserRow | undefined;
  return mapUser(row);
}

export function getUserById(id: string): AppUser | null {
  const row = db.prepare('SELECT * FROM users WHERE id = ? LIMIT 1').get(id) as UserRow | undefined;
  return mapUser(row);
}

export function createUser(input: {
  email: string;
  name?: string | null;
  passwordHash?: string | null;
  provider?: string;
  image?: string | null;
}): AppUser {
  const user: AppUser = {
    id: randomUUID(),
    email: cleanString(input.email).toLowerCase(),
    name: input.name ? cleanString(input.name) : null,
    passwordHash: input.passwordHash ?? null,
    provider: input.provider ?? 'credentials',
    image: input.image ?? null,
  };

  const now = nowIso();
  db.prepare(
    `INSERT INTO users (id, email, name, password_hash, auth_provider, image, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(user.id, user.email, user.name, user.passwordHash, user.provider, user.image, now, now);

  return user;
}

export function ensureOAuthUser(input: {
  email: string;
  name?: string | null;
  image?: string | null;
  provider: string;
}): AppUser {
  const existing = getUserByEmail(input.email);
  if (existing) {
    db.prepare(
      `UPDATE users
       SET name = COALESCE(?, name), image = COALESCE(?, image), auth_provider = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      input.name ? cleanString(input.name) : null,
      input.image ?? null,
      existing.provider === 'credentials' ? existing.provider : input.provider,
      nowIso(),
      existing.id
    );
    return getUserById(existing.id) ?? existing;
  }

  return createUser({
    email: input.email,
    name: input.name,
    provider: input.provider,
    image: input.image,
  });
}

export function upsertRecentPaper(userId: string, paperInput: UserPaperInput) {
  const paper = normalizeArxivInput(paperInput);
  const now = nowIso();

  db.prepare(
    `INSERT INTO recent_papers (user_id, arxiv_id, title, abstract, authors_json, categories_json, viewed_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, arxiv_id)
     DO UPDATE SET
       title = excluded.title,
       abstract = excluded.abstract,
       authors_json = excluded.authors_json,
       categories_json = excluded.categories_json,
       viewed_at = excluded.viewed_at`
  ).run(
    userId,
    paper.arxivId,
    paper.title,
    paper.abstract ?? '',
    encodeList(paper.authors),
    encodeList(paper.categories),
    now,
    now
  );
}

export function upsertBookmark(userId: string, paperInput: UserPaperInput) {
  const paper = normalizeArxivInput(paperInput);
  const now = nowIso();

  db.prepare(
    `INSERT INTO bookmarks (user_id, arxiv_id, title, abstract, authors_json, categories_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, arxiv_id)
     DO UPDATE SET
       title = excluded.title,
       abstract = excluded.abstract,
       authors_json = excluded.authors_json,
       categories_json = excluded.categories_json,
       updated_at = excluded.updated_at`
  ).run(
    userId,
    paper.arxivId,
    paper.title,
    paper.abstract ?? '',
    encodeList(paper.authors),
    encodeList(paper.categories),
    now,
    now
  );
}

export function removeBookmark(userId: string, arxivId: string) {
  db.prepare('DELETE FROM bookmarks WHERE user_id = ? AND arxiv_id = ?').run(userId, cleanString(arxivId));
}

export function isBookmarked(userId: string, arxivId: string): boolean {
  const row = db
    .prepare('SELECT 1 FROM bookmarks WHERE user_id = ? AND arxiv_id = ? LIMIT 1')
    .get(userId, cleanString(arxivId)) as { 1?: number } | undefined;
  return Boolean(row);
}

export function listBookmarks(userId: string, limit = 30): StoredPaper[] {
  const rows = db
    .prepare(
      `SELECT arxiv_id, title, abstract, authors_json, categories_json, created_at, updated_at
       FROM bookmarks
       WHERE user_id = ?
       ORDER BY updated_at DESC
       LIMIT ?`
    )
    .all(userId, limit) as PaperRow[];

  return rows.map(mapPaper);
}

export function listRecentPapers(userId: string, limit = 20): StoredPaper[] {
  const rows = db
    .prepare(
      `SELECT arxiv_id, title, abstract, authors_json, categories_json, viewed_at, created_at
       FROM recent_papers
       WHERE user_id = ?
       ORDER BY viewed_at DESC
       LIMIT ?`
    )
    .all(userId, limit) as PaperRow[];

  return rows.map(mapPaper);
}
