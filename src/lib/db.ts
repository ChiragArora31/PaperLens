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

  CREATE TABLE IF NOT EXISTS analytics_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_name TEXT NOT NULL,
    user_id TEXT,
    anonymous_id TEXT,
    arxiv_id TEXT,
    title TEXT,
    path TEXT,
    referrer TEXT,
    source TEXT,
    metadata_json TEXT,
    created_at TEXT NOT NULL,
    date_key TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS public_papers (
    arxiv_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    abstract TEXT NOT NULL,
    authors_json TEXT NOT NULL,
    categories_json TEXT NOT NULL,
    analysis_json TEXT NOT NULL,
    share_slug TEXT NOT NULL UNIQUE,
    analyzed_count INTEGER NOT NULL DEFAULT 1,
    first_analyzed_at TEXT NOT NULL,
    last_analyzed_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_public INTEGER NOT NULL DEFAULT 1
  );

  CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
  CREATE INDEX IF NOT EXISTS idx_recent_user_viewed_at ON recent_papers (user_id, viewed_at DESC);
  CREATE INDEX IF NOT EXISTS idx_recent_user_arxiv ON recent_papers (user_id, arxiv_id);
  CREATE INDEX IF NOT EXISTS idx_bookmarks_user_updated_at ON bookmarks (user_id, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_bookmarks_user_arxiv ON bookmarks (user_id, arxiv_id);
  CREATE INDEX IF NOT EXISTS idx_analytics_event_date ON analytics_events (event_name, date_key);
  CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics_events (created_at);
  CREATE INDEX IF NOT EXISTS idx_analytics_arxiv ON analytics_events (arxiv_id);
  CREATE INDEX IF NOT EXISTS idx_analytics_user_date ON analytics_events (user_id, date_key);
  CREATE INDEX IF NOT EXISTS idx_public_papers_analyzed ON public_papers (analyzed_count DESC, last_analyzed_at DESC);
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

interface PublicPaperRow extends PaperRow {
  analysis_json: string;
  share_slug: string;
  analyzed_count: number;
  first_analyzed_at: string;
  last_analyzed_at: string;
  is_public: number;
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

export interface AnalyticsEventInput {
  eventName: string;
  userId?: string | null;
  anonymousId?: string | null;
  arxivId?: string | null;
  title?: string | null;
  path?: string | null;
  referrer?: string | null;
  source?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface AnalyticsSummary {
  totals: {
    dailyActiveUsers: number;
    monthlyActiveUsers: number;
    registeredUsers: number;
    anonymousVisitors30d: number;
    paperAnalysesToday: number;
    paperAnalyses30d: number;
    bookmarks30d: number;
    exports30d: number;
    chatMessages30d: number;
    repeatUsers30d: number;
    guestAnalyses30d: number;
    loggedInAnalyses30d: number;
  };
  dailySeries: Array<{
    date: string;
    activeUsers: number;
    analyses: number;
    bookmarks: number;
    exports: number;
    chats: number;
  }>;
  monthlySeries: Array<{ month: string; activeUsers: number; analyses: number }>;
  popularPapers: Array<{ arxivId: string; title: string; count: number; lastAnalyzedAt: string }>;
  trafficSources: Array<{ source: string; count: number }>;
  recentEvents: Array<{
    eventName: string;
    arxivId: string | null;
    title: string | null;
    createdAt: string;
    identity: 'user' | 'guest';
  }>;
  retention: {
    activeLast7d: number;
    returnedFromPrevious7d: number;
    returningRate: number;
  };
}

export interface PublicPaper {
  arxivId: string;
  title: string;
  abstract: string;
  authors: string[];
  categories: string[];
  analysis: unknown;
  shareSlug: string;
  analyzedCount: number;
  firstAnalyzedAt: string;
  lastAnalyzedAt: string;
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

const updateSessionUserStmt = db.prepare(
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

const insertAnalyticsEventStmt = db.prepare(
  `INSERT INTO analytics_events
   (event_name, user_id, anonymous_id, arxiv_id, title, path, referrer, source, metadata_json, created_at, date_key)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);

const upsertPublicPaperStmt = db.prepare(
  `INSERT INTO public_papers
   (arxiv_id, title, abstract, authors_json, categories_json, analysis_json, share_slug, analyzed_count, first_analyzed_at, last_analyzed_at, updated_at, is_public)
   VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 1)
   ON CONFLICT(arxiv_id)
   DO UPDATE SET
     title = excluded.title,
     abstract = excluded.abstract,
     authors_json = excluded.authors_json,
     categories_json = excluded.categories_json,
     analysis_json = excluded.analysis_json,
     analyzed_count = public_papers.analyzed_count + 1,
     last_analyzed_at = excluded.last_analyzed_at,
     updated_at = excluded.updated_at,
     is_public = 1`
);

const upsertPublicPaperSnapshotStmt = db.prepare(
  `INSERT INTO public_papers
   (arxiv_id, title, abstract, authors_json, categories_json, analysis_json, share_slug, analyzed_count, first_analyzed_at, last_analyzed_at, updated_at, is_public)
   VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 1)
   ON CONFLICT(arxiv_id)
   DO UPDATE SET
     title = excluded.title,
     abstract = excluded.abstract,
     authors_json = excluded.authors_json,
     categories_json = excluded.categories_json,
     analysis_json = excluded.analysis_json,
     updated_at = excluded.updated_at,
     is_public = 1`
);

const incrementPublicPaperAnalysisStmt = db.prepare(
  `UPDATE public_papers
   SET analyzed_count = analyzed_count + 1,
       last_analyzed_at = ?,
       updated_at = ?
   WHERE arxiv_id = ? AND is_public = 1`
);

const getPublicPaperStmt = db.prepare(
  `SELECT arxiv_id, title, abstract, authors_json, categories_json, analysis_json, share_slug,
          analyzed_count, first_analyzed_at, last_analyzed_at, updated_at, is_public
   FROM public_papers
   WHERE arxiv_id = ? AND is_public = 1
   LIMIT 1`
);

const listPublicPapersStmt = db.prepare(
  `SELECT arxiv_id, title, abstract, authors_json, categories_json, analysis_json, share_slug,
          analyzed_count, first_analyzed_at, last_analyzed_at, updated_at, is_public
   FROM public_papers
   WHERE is_public = 1
   ORDER BY analyzed_count DESC, last_analyzed_at DESC
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

function dateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

function cleanOptional(value: string | null | undefined, max = 500): string | null {
  if (!value) return null;
  const cleaned = cleanString(value);
  return cleaned ? cleaned.slice(0, max) : null;
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return '{}';
  }
}

function shareSlug(arxivId: string): string {
  return cleanString(arxivId).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function mapPublicPaper(row: PublicPaperRow | undefined): PublicPaper | null {
  if (!row) return null;
  let analysis: unknown = null;
  try {
    analysis = JSON.parse(row.analysis_json);
  } catch {
    analysis = null;
  }
  return {
    arxivId: row.arxiv_id,
    title: row.title,
    abstract: row.abstract,
    authors: decodeList(row.authors_json),
    categories: decodeList(row.categories_json),
    analysis,
    shareSlug: row.share_slug,
    analyzedCount: row.analyzed_count,
    firstAnalyzedAt: row.first_analyzed_at,
    lastAnalyzedAt: row.last_analyzed_at,
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

export function ensureSessionUser(input: {
  id?: string | null;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  provider?: string;
}): AppUser | null {
  const email = cleanString(input.email ?? '').toLowerCase();
  if (!email) return null;

  const preferredId = input.id ? cleanString(input.id) : null;

  if (preferredId) {
    const existingById = getUserById(preferredId);
    if (existingById) {
      updateSessionUserStmt.run(
        input.name ? cleanString(input.name) : null,
        input.image ?? null,
        input.provider ?? existingById.provider,
        nowIso(),
        preferredId
      );
      return getUserById(preferredId) ?? existingById;
    }
  }

  const existingByEmail = getUserByEmail(email);
  if (existingByEmail) {
    updateSessionUserStmt.run(
      input.name ? cleanString(input.name) : null,
      input.image ?? null,
      input.provider ?? existingByEmail.provider,
      nowIso(),
      existingByEmail.id
    );
    return getUserById(existingByEmail.id) ?? existingByEmail;
  }

  const now = nowIso();
  const userId = preferredId ?? randomUUID();

  try {
    insertUserStmt.run(
      userId,
      email,
      input.name ? cleanString(input.name) : null,
      null,
      input.provider ?? 'credentials',
      input.image ?? null,
      now,
      now
    );
    return getUserById(userId);
  } catch (error) {
    if (isConstraintError(error)) {
      return getUserByEmail(email);
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

export function trackAnalyticsEvent(input: AnalyticsEventInput) {
  const now = nowIso();
  insertAnalyticsEventStmt.run(
    cleanString(input.eventName).slice(0, 80),
    cleanOptional(input.userId, 120),
    cleanOptional(input.anonymousId, 120),
    cleanOptional(input.arxivId, 80),
    cleanOptional(input.title, 500),
    cleanOptional(input.path, 500),
    cleanOptional(input.referrer, 500),
    cleanOptional(input.source, 160),
    safeJson(input.metadata),
    now,
    dateKey(new Date(now))
  );
}

export function savePublicPaper(input: {
  arxivId: string;
  title: string;
  abstract?: string;
  authors?: string[];
  categories?: string[];
  analysis: unknown;
}): PublicPaper {
  const paper = normalizeArxivInput(input);
  const now = nowIso();
  upsertPublicPaperStmt.run(
    paper.arxivId,
    paper.title,
    paper.abstract ?? '',
    encodeList(paper.authors),
    encodeList(paper.categories),
    safeJson(input.analysis),
    shareSlug(paper.arxivId),
    now,
    now,
    now
  );

  const saved = getPublicPaper(paper.arxivId);
  if (!saved) {
    throw new Error('Unable to save public paper.');
  }
  return saved;
}

export function savePublicPaperSnapshot(input: {
  arxivId: string;
  title: string;
  abstract?: string;
  authors?: string[];
  categories?: string[];
  analysis: unknown;
}): PublicPaper {
  const paper = normalizeArxivInput(input);
  const now = nowIso();
  upsertPublicPaperSnapshotStmt.run(
    paper.arxivId,
    paper.title,
    paper.abstract ?? '',
    encodeList(paper.authors),
    encodeList(paper.categories),
    safeJson(input.analysis),
    shareSlug(paper.arxivId),
    now,
    now,
    now
  );

  const saved = getPublicPaper(paper.arxivId);
  if (!saved) {
    throw new Error('Unable to save public paper.');
  }
  return saved;
}

export function getPublicPaper(arxivId: string): PublicPaper | null {
  const row = getPublicPaperStmt.get(cleanString(arxivId)) as PublicPaperRow | undefined;
  return mapPublicPaper(row);
}

export function recordPublicPaperAnalysis(arxivId: string) {
  const now = nowIso();
  incrementPublicPaperAnalysisStmt.run(now, now, cleanString(arxivId));
}

export function listPublicPapers(limit = 8): PublicPaper[] {
  const safeLimit = clampLimit(limit, 1, 24, 8);
  const rows = listPublicPapersStmt.all(safeLimit) as PublicPaperRow[];
  return rows.map(mapPublicPaper).filter((paper): paper is PublicPaper => Boolean(paper));
}

function scalarCount(sql: string, params: unknown[] = []): number {
  const row = db.prepare(sql).get(...params) as { value?: number } | undefined;
  return Number(row?.value ?? 0);
}

export function getAnalyticsSummary(): AnalyticsSummary {
  const today = dateKey();
  const since30 = daysAgo(30);
  const since14 = daysAgo(14);
  const since7 = daysAgo(7);

  const registeredUsers = scalarCount('SELECT COUNT(*) AS value FROM users');
  const dailyActiveUsers = scalarCount(
    `SELECT COUNT(DISTINCT COALESCE(user_id, anonymous_id)) AS value
     FROM analytics_events
     WHERE date_key = ? AND COALESCE(user_id, anonymous_id) IS NOT NULL`,
    [today]
  );
  const monthlyActiveUsers = scalarCount(
    `SELECT COUNT(DISTINCT COALESCE(user_id, anonymous_id)) AS value
     FROM analytics_events
     WHERE created_at >= ? AND COALESCE(user_id, anonymous_id) IS NOT NULL`,
    [since30]
  );
  const anonymousVisitors30d = scalarCount(
    `SELECT COUNT(DISTINCT anonymous_id) AS value
     FROM analytics_events
     WHERE created_at >= ? AND user_id IS NULL AND anonymous_id IS NOT NULL`,
    [since30]
  );

  const eventCount = (eventName: string, since: string) =>
    scalarCount(
      'SELECT COUNT(*) AS value FROM analytics_events WHERE event_name = ? AND created_at >= ?',
      [eventName, since]
    );

  const repeatUsers30d = scalarCount(
    `SELECT COUNT(*) AS value
     FROM (
       SELECT COALESCE(user_id, anonymous_id) AS identity, COUNT(DISTINCT date_key) AS active_days
       FROM analytics_events
       WHERE created_at >= ? AND COALESCE(user_id, anonymous_id) IS NOT NULL
       GROUP BY identity
       HAVING active_days > 1
     )`,
    [since30]
  );

  const activeLast7d = scalarCount(
    `SELECT COUNT(DISTINCT COALESCE(user_id, anonymous_id)) AS value
     FROM analytics_events
     WHERE created_at >= ? AND COALESCE(user_id, anonymous_id) IS NOT NULL`,
    [since7]
  );
  const returnedFromPrevious7d = scalarCount(
    `SELECT COUNT(*) AS value
     FROM (
       SELECT COALESCE(recent.user_id, recent.anonymous_id) AS visitor_identity
       FROM analytics_events recent
       WHERE recent.created_at >= ? AND COALESCE(recent.user_id, recent.anonymous_id) IS NOT NULL
       GROUP BY visitor_identity
       HAVING EXISTS (
         SELECT 1 FROM analytics_events previous
         WHERE COALESCE(previous.user_id, previous.anonymous_id) = visitor_identity
           AND previous.created_at >= ?
           AND previous.created_at < ?
       )
     )`,
    [since7, since14, since7]
  );

  const dailyRows = db.prepare(
    `WITH days AS (
       SELECT date_key FROM analytics_events WHERE created_at >= ? GROUP BY date_key
     )
     SELECT
       days.date_key AS date,
       COUNT(DISTINCT COALESCE(e.user_id, e.anonymous_id)) AS activeUsers,
       SUM(CASE WHEN e.event_name = 'paper_analyzed' THEN 1 ELSE 0 END) AS analyses,
       SUM(CASE WHEN e.event_name = 'bookmark_created' THEN 1 ELSE 0 END) AS bookmarks,
       SUM(CASE WHEN e.event_name = 'summary_exported' THEN 1 ELSE 0 END) AS exports,
       SUM(CASE WHEN e.event_name = 'chat_message_sent' THEN 1 ELSE 0 END) AS chats
     FROM days
     LEFT JOIN analytics_events e ON e.date_key = days.date_key
     GROUP BY days.date_key
     ORDER BY days.date_key ASC`
  ).all(since30) as Array<{
    date: string;
    activeUsers: number;
    analyses: number;
    bookmarks: number;
    exports: number;
    chats: number;
  }>;

  const monthlyRows = db.prepare(
    `SELECT
       substr(date_key, 1, 7) AS month,
       COUNT(DISTINCT COALESCE(user_id, anonymous_id)) AS activeUsers,
       SUM(CASE WHEN event_name = 'paper_analyzed' THEN 1 ELSE 0 END) AS analyses
     FROM analytics_events
     WHERE created_at >= ?
     GROUP BY month
     ORDER BY month ASC`
  ).all(daysAgo(180)) as Array<{ month: string; activeUsers: number; analyses: number }>;

  const popularPapers = db.prepare(
    `SELECT arxiv_id AS arxivId, title, analyzed_count AS count, last_analyzed_at AS lastAnalyzedAt
     FROM public_papers
     WHERE is_public = 1
     ORDER BY analyzed_count DESC, last_analyzed_at DESC
     LIMIT 10`
  ).all() as AnalyticsSummary['popularPapers'];

  const trafficSources = db.prepare(
    `SELECT COALESCE(NULLIF(source, ''), 'Direct / unknown') AS source, COUNT(*) AS count
     FROM analytics_events
     WHERE created_at >= ? AND event_name = 'page_view'
     GROUP BY source
     ORDER BY count DESC
     LIMIT 10`
  ).all(since30) as AnalyticsSummary['trafficSources'];

  const recentEvents = db.prepare(
    `SELECT event_name AS eventName, arxiv_id AS arxivId, title, created_at AS createdAt,
            CASE WHEN user_id IS NULL THEN 'guest' ELSE 'user' END AS identity
     FROM analytics_events
     ORDER BY created_at DESC
     LIMIT 24`
  ).all() as AnalyticsSummary['recentEvents'];

  return {
    totals: {
      dailyActiveUsers,
      monthlyActiveUsers,
      registeredUsers,
      anonymousVisitors30d,
      paperAnalysesToday: scalarCount(
        `SELECT COUNT(*) AS value FROM analytics_events WHERE event_name = 'paper_analyzed' AND date_key = ?`,
        [today]
      ),
      paperAnalyses30d: eventCount('paper_analyzed', since30),
      bookmarks30d: eventCount('bookmark_created', since30),
      exports30d: eventCount('summary_exported', since30),
      chatMessages30d: eventCount('chat_message_sent', since30),
      repeatUsers30d,
      guestAnalyses30d: scalarCount(
        `SELECT COUNT(*) AS value FROM analytics_events
         WHERE event_name = 'paper_analyzed' AND created_at >= ? AND user_id IS NULL`,
        [since30]
      ),
      loggedInAnalyses30d: scalarCount(
        `SELECT COUNT(*) AS value FROM analytics_events
         WHERE event_name = 'paper_analyzed' AND created_at >= ? AND user_id IS NOT NULL`,
        [since30]
      ),
    },
    dailySeries: dailyRows,
    monthlySeries: monthlyRows,
    popularPapers,
    trafficSources,
    recentEvents,
    retention: {
      activeLast7d,
      returnedFromPrevious7d,
      returningRate: activeLast7d > 0 ? Math.round((returnedFromPrevious7d / activeLast7d) * 100) : 0,
    },
  };
}
