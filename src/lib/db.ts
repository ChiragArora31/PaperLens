import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  cleanString,
  decodeList,
  encodeList,
  normalizeArxivInput,
  type UserPaperInput,
} from './userPaper';

const dbPath = resolve(process.cwd(), process.env.DATABASE_PATH || 'data/paperlens.db');
const dbDir = dirname(dbPath);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

function safePragma(statement: string) {
  try {
    db.pragma(statement);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`SQLite pragma skipped: ${statement}`, error);
    }
  }
}

// Pragmas tuned for multi-user write/read concurrency on a single-node deployment.
safePragma('journal_mode = WAL');
safePragma('synchronous = NORMAL');
safePragma('busy_timeout = 5000');
safePragma('foreign_keys = ON');
safePragma('temp_store = MEMORY');
safePragma('cache_size = -16000');
safePragma('wal_autocheckpoint = 1000');
safePragma('journal_size_limit = 67108864');
safePragma('mmap_size = 268435456');

function nowIso() {
  return new Date().toISOString();
}

function clampLimit(limit: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(limit)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(limit)));
}

function isConstraintError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /SQLITE_CONSTRAINT/i.test(error.message);
}

export class DuplicateEmailError extends Error {
  constructor() {
    super('An account with this email already exists.');
    this.name = 'DuplicateEmailError';
  }
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
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, arxiv_id)
  );

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
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, arxiv_id)
  );

  CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
  CREATE INDEX IF NOT EXISTS idx_recent_user_viewed_at ON recent_papers (user_id, viewed_at DESC);
  CREATE INDEX IF NOT EXISTS idx_recent_user_arxiv ON recent_papers (user_id, arxiv_id);
  CREATE INDEX IF NOT EXISTS idx_bookmarks_user_updated_at ON bookmarks (user_id, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_bookmarks_user_arxiv ON bookmarks (user_id, arxiv_id);
`);

// Keep orphan rows cleaned up for DBs that predate FK constraints.
db.exec(`
  DELETE FROM recent_papers WHERE user_id NOT IN (SELECT id FROM users);
  DELETE FROM bookmarks WHERE user_id NOT IN (SELECT id FROM users);
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

const MAX_RECENTS_PER_USER = 120;
const MAX_BOOKMARKS_PER_USER = 600;

const getUserByEmailStmt = db.prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
const getUserByIdStmt = db.prepare('SELECT * FROM users WHERE id = ? LIMIT 1');

const insertUserStmt = db.prepare(
  `INSERT INTO users (id, email, name, password_hash, auth_provider, image, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);

const updateOAuthUserStmt = db.prepare(
  `UPDATE users
   SET name = COALESCE(?, name),
       image = COALESCE(?, image),
       auth_provider = ?,
       updated_at = ?
   WHERE id = ?`
);

const upsertRecentStmt = db.prepare(
  `INSERT INTO recent_papers (user_id, arxiv_id, title, abstract, authors_json, categories_json, viewed_at, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)
   ON CONFLICT(user_id, arxiv_id)
   DO UPDATE SET
     title = excluded.title,
     abstract = excluded.abstract,
     authors_json = excluded.authors_json,
     categories_json = excluded.categories_json,
     viewed_at = excluded.viewed_at`
);

const trimRecentsStmt = db.prepare(
  `DELETE FROM recent_papers
   WHERE user_id = ?
     AND id NOT IN (
       SELECT id FROM recent_papers
       WHERE user_id = ?
       ORDER BY viewed_at DESC
       LIMIT ?
     )`
);

const upsertBookmarkStmt = db.prepare(
  `INSERT INTO bookmarks (user_id, arxiv_id, title, abstract, authors_json, categories_json, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)
   ON CONFLICT(user_id, arxiv_id)
   DO UPDATE SET
     title = excluded.title,
     abstract = excluded.abstract,
     authors_json = excluded.authors_json,
     categories_json = excluded.categories_json,
     updated_at = excluded.updated_at`
);

const trimBookmarksStmt = db.prepare(
  `DELETE FROM bookmarks
   WHERE user_id = ?
     AND id NOT IN (
       SELECT id FROM bookmarks
       WHERE user_id = ?
       ORDER BY updated_at DESC
       LIMIT ?
     )`
);

const removeBookmarkStmt = db.prepare(
  'DELETE FROM bookmarks WHERE user_id = ? AND arxiv_id = ?'
);

const isBookmarkedStmt = db.prepare(
  'SELECT 1 AS found FROM bookmarks WHERE user_id = ? AND arxiv_id = ? LIMIT 1'
);

const listBookmarksStmt = db.prepare(
  `SELECT arxiv_id, title, abstract, authors_json, categories_json, created_at, updated_at
   FROM bookmarks
   WHERE user_id = ?
   ORDER BY updated_at DESC
   LIMIT ?`
);

const listRecentPapersStmt = db.prepare(
  `SELECT arxiv_id, title, abstract, authors_json, categories_json, viewed_at, created_at
   FROM recent_papers
   WHERE user_id = ?
   ORDER BY viewed_at DESC
   LIMIT ?`
);

const upsertRecentTxn = db.transaction((userId: string, paperInput: UserPaperInput) => {
  const paper = normalizeArxivInput(paperInput);
  const now = nowIso();

  upsertRecentStmt.run(
    userId,
    paper.arxivId,
    paper.title,
    paper.abstract ?? '',
    encodeList(paper.authors),
    encodeList(paper.categories),
    now,
    now
  );

  trimRecentsStmt.run(userId, userId, MAX_RECENTS_PER_USER);
});

const upsertBookmarkTxn = db.transaction((userId: string, paperInput: UserPaperInput) => {
  const paper = normalizeArxivInput(paperInput);
  const now = nowIso();

  upsertBookmarkStmt.run(
    userId,
    paper.arxivId,
    paper.title,
    paper.abstract ?? '',
    encodeList(paper.authors),
    encodeList(paper.categories),
    now,
    now
  );

  trimBookmarksStmt.run(userId, userId, MAX_BOOKMARKS_PER_USER);
});

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
  const row = getUserByEmailStmt.get(cleanString(email).toLowerCase()) as UserRow | undefined;
  return mapUser(row);
}

export function getUserById(id: string): AppUser | null {
  const row = getUserByIdStmt.get(id) as UserRow | undefined;
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

  try {
    insertUserStmt.run(
      user.id,
      user.email,
      user.name,
      user.passwordHash,
      user.provider,
      user.image,
      now,
      now
    );
    return user;
  } catch (error) {
    if (isConstraintError(error)) {
      throw new DuplicateEmailError();
    }
    throw error;
  }
}

export function ensureOAuthUser(input: {
  email: string;
  name?: string | null;
  image?: string | null;
  provider: string;
}): AppUser {
  const email = cleanString(input.email).toLowerCase();
  const existing = getUserByEmail(email);

  if (existing) {
    updateOAuthUserStmt.run(
      input.name ? cleanString(input.name) : null,
      input.image ?? null,
      existing.provider === 'credentials' ? existing.provider : input.provider,
      nowIso(),
      existing.id
    );
    return getUserById(existing.id) ?? existing;
  }

  try {
    return createUser({
      email,
      name: input.name,
      provider: input.provider,
      image: input.image,
    });
  } catch (error) {
    if (error instanceof DuplicateEmailError) {
      // Race-safe fallback when two OAuth callbacks land simultaneously.
      return getUserByEmail(email) ?? (() => { throw error; })();
    }
    throw error;
  }
}

export function upsertRecentPaper(userId: string, paperInput: UserPaperInput) {
  upsertRecentTxn(userId, paperInput);
}

export function upsertBookmark(userId: string, paperInput: UserPaperInput) {
  upsertBookmarkTxn(userId, paperInput);
}

export function removeBookmark(userId: string, arxivId: string) {
  removeBookmarkStmt.run(userId, cleanString(arxivId));
}

export function isBookmarked(userId: string, arxivId: string): boolean {
  const row = isBookmarkedStmt.get(userId, cleanString(arxivId)) as { found?: number } | undefined;
  return Boolean(row?.found);
}

export function listBookmarks(userId: string, limit = 30): StoredPaper[] {
  const safeLimit = clampLimit(limit, 1, 200, 30);
  const rows = listBookmarksStmt.all(userId, safeLimit) as PaperRow[];
  return rows.map(mapPaper);
}

export function listRecentPapers(userId: string, limit = 20): StoredPaper[] {
  const safeLimit = clampLimit(limit, 1, 200, 20);
  const rows = listRecentPapersStmt.all(userId, safeLimit) as PaperRow[];
  return rows.map(mapPaper);
}
