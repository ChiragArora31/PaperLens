import Database from 'better-sqlite3';
import { Pool, type PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  cleanString,
  decodeList,
  encodeList,
  normalizeArxivInput,
  type UserPaperInput,
} from './userPaper';

const MAX_RECENTS_PER_USER = 120;
const MAX_BOOKMARKS_PER_USER = 600;
const hasPostgres = Boolean(process.env.DATABASE_URL);

let sqliteDb: Database.Database | null = null;
let postgresPool: Pool | null = null;
let postgresReady: Promise<void> | null = null;

function nowIso() {
  return new Date().toISOString();
}

function dateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

function clampLimit(limit: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(limit)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(limit)));
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

function numberValue(value: unknown): number {
  return Number(value ?? 0);
}

function isDuplicateError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const coded = error as Error & { code?: string };
  return coded.code === '23505' || /SQLITE_CONSTRAINT/i.test(error.message);
}

export class DuplicateEmailError extends Error {
  constructor() {
    super('An account with this email already exists.');
    this.name = 'DuplicateEmailError';
  }
}

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
  analyzed_count: number | string;
  first_analyzed_at: string;
  last_analyzed_at: string;
  is_public: boolean | number;
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
    analyzedCount: numberValue(row.analyzed_count),
    firstAnalyzedAt: row.first_analyzed_at,
    lastAnalyzedAt: row.last_analyzed_at,
  };
}

function getSqliteDb(): Database.Database {
  if (sqliteDb) return sqliteDb;

  const dbPath = resolve(process.cwd(), process.env.DATABASE_PATH || 'data/paperlens.db');
  const dbDir = dirname(dbPath);
  if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });

  const db = new Database(dbPath);

  for (const statement of [
    'journal_mode = WAL',
    'synchronous = NORMAL',
    'busy_timeout = 5000',
    'foreign_keys = ON',
    'temp_store = MEMORY',
    'cache_size = -16000',
    'wal_autocheckpoint = 1000',
    'journal_size_limit = 67108864',
    'mmap_size = 268435456',
  ]) {
    try {
      db.pragma(statement);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`SQLite pragma skipped: ${statement}`, error);
      }
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

    DELETE FROM recent_papers WHERE user_id NOT IN (SELECT id FROM users);
    DELETE FROM bookmarks WHERE user_id NOT IN (SELECT id FROM users);
  `);

  sqliteDb = db;
  return db;
}

function getPostgresPool(): Pool {
  if (postgresPool) return postgresPool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required for Postgres.');

  const usesLocalPostgres = /(?:localhost|127\.0\.0\.1)/i.test(connectionString);
  let normalizedConnectionString = connectionString;
  if (!usesLocalPostgres) {
    const url = new URL(connectionString);
    url.searchParams.set('sslmode', 'verify-full');
    normalizedConnectionString = url.toString();
  }

  postgresPool = new Pool({
    connectionString: normalizedConnectionString,
    max: 5,
  });
  return postgresPool;
}

async function ensurePostgresSchema(): Promise<void> {
  if (!postgresReady) {
    postgresReady = (async () => {
      const pool = getPostgresPool();
      await pool.query(`
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
          id BIGSERIAL PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          arxiv_id TEXT NOT NULL,
          title TEXT NOT NULL,
          abstract TEXT NOT NULL,
          authors_json TEXT NOT NULL,
          categories_json TEXT NOT NULL,
          viewed_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          UNIQUE(user_id, arxiv_id)
        );

        CREATE TABLE IF NOT EXISTS bookmarks (
          id BIGSERIAL PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          arxiv_id TEXT NOT NULL,
          title TEXT NOT NULL,
          abstract TEXT NOT NULL,
          authors_json TEXT NOT NULL,
          categories_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(user_id, arxiv_id)
        );

        CREATE TABLE IF NOT EXISTS analytics_events (
          id BIGSERIAL PRIMARY KEY,
          event_name TEXT NOT NULL,
          user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
          anonymous_id TEXT,
          arxiv_id TEXT,
          title TEXT,
          path TEXT,
          referrer TEXT,
          source TEXT,
          metadata_json TEXT,
          created_at TEXT NOT NULL,
          date_key TEXT NOT NULL
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
          is_public BOOLEAN NOT NULL DEFAULT TRUE
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
    })();
  }
  await postgresReady;
}

function toPostgresPlaceholders(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

async function pgRows<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  await ensurePostgresSchema();
  const result = await getPostgresPool().query(sql, params);
  return result.rows as T[];
}

async function withPostgresTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  await ensurePostgresSchema();
  const client = await getPostgresPool().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function pgScalarCount(sql: string, params: unknown[] = []): Promise<number> {
  const rows = await pgRows<{ value: string | number }>(toPostgresPlaceholders(sql), params);
  return numberValue(rows[0]?.value);
}

function sqliteScalarCount(sql: string, params: unknown[] = []): number {
  const row = getSqliteDb().prepare(sql).get(...params) as { value?: number } | undefined;
  return numberValue(row?.value);
}

export async function getUserByEmail(email: string): Promise<AppUser | null> {
  const normalizedEmail = cleanString(email).toLowerCase();
  if (hasPostgres) {
    const rows = await pgRows<UserRow>('SELECT * FROM users WHERE email = $1 LIMIT 1', [normalizedEmail]);
    return mapUser(rows[0]);
  }
  const row = getSqliteDb().prepare('SELECT * FROM users WHERE email = ? LIMIT 1').get(normalizedEmail) as UserRow | undefined;
  return mapUser(row);
}

export async function getUserById(id: string): Promise<AppUser | null> {
  if (hasPostgres) {
    const rows = await pgRows<UserRow>('SELECT * FROM users WHERE id = $1 LIMIT 1', [id]);
    return mapUser(rows[0]);
  }
  const row = getSqliteDb().prepare('SELECT * FROM users WHERE id = ? LIMIT 1').get(id) as UserRow | undefined;
  return mapUser(row);
}

export async function createUser(input: {
  email: string;
  name?: string | null;
  passwordHash?: string | null;
  provider?: string;
  image?: string | null;
}): Promise<AppUser> {
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
    if (hasPostgres) {
      await pgRows(
        `INSERT INTO users (id, email, name, password_hash, auth_provider, image, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [user.id, user.email, user.name, user.passwordHash, user.provider, user.image, now, now]
      );
      return user;
    }

    getSqliteDb()
      .prepare(
        `INSERT INTO users (id, email, name, password_hash, auth_provider, image, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(user.id, user.email, user.name, user.passwordHash, user.provider, user.image, now, now);
    return user;
  } catch (error) {
    if (isDuplicateError(error)) throw new DuplicateEmailError();
    throw error;
  }
}

export async function ensureOAuthUser(input: {
  email: string;
  name?: string | null;
  image?: string | null;
  provider: string;
}): Promise<AppUser> {
  const email = cleanString(input.email).toLowerCase();
  const existing = await getUserByEmail(email);
  const name = input.name ? cleanString(input.name) : null;
  const image = input.image ?? null;

  if (existing) {
    const provider = existing.provider === 'credentials' ? existing.provider : input.provider;
    if (hasPostgres) {
      await pgRows(
        `UPDATE users
         SET name = COALESCE($1, name),
             image = COALESCE($2, image),
             auth_provider = $3,
             updated_at = $4
         WHERE id = $5`,
        [name, image, provider, nowIso(), existing.id]
      );
    } else {
      getSqliteDb()
        .prepare(
          `UPDATE users
           SET name = COALESCE(?, name),
               image = COALESCE(?, image),
               auth_provider = ?,
               updated_at = ?
           WHERE id = ?`
        )
        .run(name, image, provider, nowIso(), existing.id);
    }
    return (await getUserById(existing.id)) ?? existing;
  }

  try {
    return await createUser({ email, name, provider: input.provider, image });
  } catch (error) {
    if (error instanceof DuplicateEmailError) {
      const user = await getUserByEmail(email);
      if (user) return user;
    }
    throw error;
  }
}

export async function ensureSessionUser(input: {
  id?: string | null;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  provider?: string;
}): Promise<AppUser | null> {
  const email = cleanString(input.email ?? '').toLowerCase();
  if (!email) return null;

  const preferredId = input.id ? cleanString(input.id) : null;
  const name = input.name ? cleanString(input.name) : null;
  const image = input.image ?? null;

  async function updateUser(existing: AppUser): Promise<AppUser> {
    const provider = input.provider ?? existing.provider;
    if (hasPostgres) {
      await pgRows(
        `UPDATE users
         SET name = COALESCE($1, name),
             image = COALESCE($2, image),
             auth_provider = $3,
             updated_at = $4
         WHERE id = $5`,
        [name, image, provider, nowIso(), existing.id]
      );
    } else {
      getSqliteDb()
        .prepare(
          `UPDATE users
           SET name = COALESCE(?, name),
               image = COALESCE(?, image),
               auth_provider = ?,
               updated_at = ?
           WHERE id = ?`
        )
        .run(name, image, provider, nowIso(), existing.id);
    }
    return (await getUserById(existing.id)) ?? existing;
  }

  if (preferredId) {
    const existingById = await getUserById(preferredId);
    if (existingById) return updateUser(existingById);
  }

  const existingByEmail = await getUserByEmail(email);
  if (existingByEmail) return updateUser(existingByEmail);

  try {
    const userId = preferredId ?? randomUUID();
    const now = nowIso();
    if (hasPostgres) {
      await pgRows(
        `INSERT INTO users (id, email, name, password_hash, auth_provider, image, created_at, updated_at)
         VALUES ($1, $2, $3, NULL, $4, $5, $6, $7)`,
        [userId, email, name, input.provider ?? 'credentials', image, now, now]
      );
    } else {
      getSqliteDb()
        .prepare(
          `INSERT INTO users (id, email, name, password_hash, auth_provider, image, created_at, updated_at)
           VALUES (?, ?, ?, NULL, ?, ?, ?, ?)`
        )
        .run(userId, email, name, input.provider ?? 'credentials', image, now, now);
    }
    return getUserById(userId);
  } catch (error) {
    if (isDuplicateError(error)) return getUserByEmail(email);
    throw error;
  }
}

export async function upsertRecentPaper(userId: string, paperInput: UserPaperInput): Promise<void> {
  const paper = normalizeArxivInput(paperInput);
  const now = nowIso();

  if (hasPostgres) {
    await withPostgresTransaction(async (client) => {
      await client.query(
        `INSERT INTO recent_papers (user_id, arxiv_id, title, abstract, authors_json, categories_json, viewed_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT(user_id, arxiv_id)
         DO UPDATE SET
           title = excluded.title,
           abstract = excluded.abstract,
           authors_json = excluded.authors_json,
           categories_json = excluded.categories_json,
           viewed_at = excluded.viewed_at`,
        [userId, paper.arxivId, paper.title, paper.abstract ?? '', encodeList(paper.authors), encodeList(paper.categories), now, now]
      );
      await client.query(
        `DELETE FROM recent_papers
         WHERE user_id = $1
           AND id NOT IN (
             SELECT id FROM recent_papers
             WHERE user_id = $1
             ORDER BY viewed_at DESC
             LIMIT $2
           )`,
        [userId, MAX_RECENTS_PER_USER]
      );
    });
    return;
  }

  getSqliteDb().transaction(() => {
    getSqliteDb()
      .prepare(
        `INSERT INTO recent_papers (user_id, arxiv_id, title, abstract, authors_json, categories_json, viewed_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, arxiv_id)
         DO UPDATE SET
           title = excluded.title,
           abstract = excluded.abstract,
           authors_json = excluded.authors_json,
           categories_json = excluded.categories_json,
           viewed_at = excluded.viewed_at`
      )
      .run(userId, paper.arxivId, paper.title, paper.abstract ?? '', encodeList(paper.authors), encodeList(paper.categories), now, now);
    getSqliteDb()
      .prepare(
        `DELETE FROM recent_papers
         WHERE user_id = ?
           AND id NOT IN (
             SELECT id FROM recent_papers
             WHERE user_id = ?
             ORDER BY viewed_at DESC
             LIMIT ?
           )`
      )
      .run(userId, userId, MAX_RECENTS_PER_USER);
  })();
}

export async function upsertBookmark(userId: string, paperInput: UserPaperInput): Promise<void> {
  const paper = normalizeArxivInput(paperInput);
  const now = nowIso();

  if (hasPostgres) {
    await withPostgresTransaction(async (client) => {
      await client.query(
        `INSERT INTO bookmarks (user_id, arxiv_id, title, abstract, authors_json, categories_json, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT(user_id, arxiv_id)
         DO UPDATE SET
           title = excluded.title,
           abstract = excluded.abstract,
           authors_json = excluded.authors_json,
           categories_json = excluded.categories_json,
           updated_at = excluded.updated_at`,
        [userId, paper.arxivId, paper.title, paper.abstract ?? '', encodeList(paper.authors), encodeList(paper.categories), now, now]
      );
      await client.query(
        `DELETE FROM bookmarks
         WHERE user_id = $1
           AND id NOT IN (
             SELECT id FROM bookmarks
             WHERE user_id = $1
             ORDER BY updated_at DESC
             LIMIT $2
           )`,
        [userId, MAX_BOOKMARKS_PER_USER]
      );
    });
    return;
  }

  getSqliteDb().transaction(() => {
    getSqliteDb()
      .prepare(
        `INSERT INTO bookmarks (user_id, arxiv_id, title, abstract, authors_json, categories_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, arxiv_id)
         DO UPDATE SET
           title = excluded.title,
           abstract = excluded.abstract,
           authors_json = excluded.authors_json,
           categories_json = excluded.categories_json,
           updated_at = excluded.updated_at`
      )
      .run(userId, paper.arxivId, paper.title, paper.abstract ?? '', encodeList(paper.authors), encodeList(paper.categories), now, now);
    getSqliteDb()
      .prepare(
        `DELETE FROM bookmarks
         WHERE user_id = ?
           AND id NOT IN (
             SELECT id FROM bookmarks
             WHERE user_id = ?
             ORDER BY updated_at DESC
             LIMIT ?
           )`
      )
      .run(userId, userId, MAX_BOOKMARKS_PER_USER);
  })();
}

export async function removeBookmark(userId: string, arxivId: string): Promise<void> {
  if (hasPostgres) {
    await pgRows('DELETE FROM bookmarks WHERE user_id = $1 AND arxiv_id = $2', [userId, cleanString(arxivId)]);
    return;
  }
  getSqliteDb().prepare('DELETE FROM bookmarks WHERE user_id = ? AND arxiv_id = ?').run(userId, cleanString(arxivId));
}

export async function isBookmarked(userId: string, arxivId: string): Promise<boolean> {
  if (hasPostgres) {
    const rows = await pgRows<{ found: number }>('SELECT 1 AS found FROM bookmarks WHERE user_id = $1 AND arxiv_id = $2 LIMIT 1', [
      userId,
      cleanString(arxivId),
    ]);
    return Boolean(rows[0]?.found);
  }
  const row = getSqliteDb()
    .prepare('SELECT 1 AS found FROM bookmarks WHERE user_id = ? AND arxiv_id = ? LIMIT 1')
    .get(userId, cleanString(arxivId)) as { found?: number } | undefined;
  return Boolean(row?.found);
}

export async function listBookmarks(userId: string, limit = 30): Promise<StoredPaper[]> {
  const safeLimit = clampLimit(limit, 1, 200, 30);
  if (hasPostgres) {
    const rows = await pgRows<PaperRow>(
      `SELECT arxiv_id, title, abstract, authors_json, categories_json, created_at, updated_at
       FROM bookmarks
       WHERE user_id = $1
       ORDER BY updated_at DESC
       LIMIT $2`,
      [userId, safeLimit]
    );
    return rows.map(mapPaper);
  }
  const rows = getSqliteDb()
    .prepare(
      `SELECT arxiv_id, title, abstract, authors_json, categories_json, created_at, updated_at
       FROM bookmarks
       WHERE user_id = ?
       ORDER BY updated_at DESC
       LIMIT ?`
    )
    .all(userId, safeLimit) as PaperRow[];
  return rows.map(mapPaper);
}

export async function listRecentPapers(userId: string, limit = 20): Promise<StoredPaper[]> {
  const safeLimit = clampLimit(limit, 1, 200, 20);
  if (hasPostgres) {
    const rows = await pgRows<PaperRow>(
      `SELECT arxiv_id, title, abstract, authors_json, categories_json, viewed_at, created_at
       FROM recent_papers
       WHERE user_id = $1
       ORDER BY viewed_at DESC
       LIMIT $2`,
      [userId, safeLimit]
    );
    return rows.map(mapPaper);
  }
  const rows = getSqliteDb()
    .prepare(
      `SELECT arxiv_id, title, abstract, authors_json, categories_json, viewed_at, created_at
       FROM recent_papers
       WHERE user_id = ?
       ORDER BY viewed_at DESC
       LIMIT ?`
    )
    .all(userId, safeLimit) as PaperRow[];
  return rows.map(mapPaper);
}

export async function trackAnalyticsEvent(input: AnalyticsEventInput): Promise<void> {
  const now = nowIso();
  const values = [
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
    dateKey(new Date(now)),
  ];

  if (hasPostgres) {
    await pgRows(
      `INSERT INTO analytics_events
       (event_name, user_id, anonymous_id, arxiv_id, title, path, referrer, source, metadata_json, created_at, date_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      values
    );
    return;
  }

  getSqliteDb()
    .prepare(
      `INSERT INTO analytics_events
       (event_name, user_id, anonymous_id, arxiv_id, title, path, referrer, source, metadata_json, created_at, date_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(...values);
}

export async function savePublicPaper(input: {
  arxivId: string;
  title: string;
  abstract?: string;
  authors?: string[];
  categories?: string[];
  analysis: unknown;
}): Promise<PublicPaper> {
  const paper = normalizeArxivInput(input);
  const now = nowIso();
  const values = [
    paper.arxivId,
    paper.title,
    paper.abstract ?? '',
    encodeList(paper.authors),
    encodeList(paper.categories),
    safeJson(input.analysis),
    shareSlug(paper.arxivId),
    now,
    now,
    now,
  ];

  if (hasPostgres) {
    await pgRows(
      `INSERT INTO public_papers
       (arxiv_id, title, abstract, authors_json, categories_json, analysis_json, share_slug, analyzed_count, first_analyzed_at, last_analyzed_at, updated_at, is_public)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8, $9, $10, TRUE)
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
         is_public = TRUE`,
      values
    );
  } else {
    getSqliteDb()
      .prepare(
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
      )
      .run(...values);
  }

  const saved = await getPublicPaper(paper.arxivId);
  if (!saved) throw new Error('Unable to save public paper.');
  return saved;
}

export async function savePublicPaperSnapshot(input: {
  arxivId: string;
  title: string;
  abstract?: string;
  authors?: string[];
  categories?: string[];
  analysis: unknown;
}): Promise<PublicPaper> {
  const paper = normalizeArxivInput(input);
  const now = nowIso();
  const values = [
    paper.arxivId,
    paper.title,
    paper.abstract ?? '',
    encodeList(paper.authors),
    encodeList(paper.categories),
    safeJson(input.analysis),
    shareSlug(paper.arxivId),
    now,
    now,
    now,
  ];

  if (hasPostgres) {
    await pgRows(
      `INSERT INTO public_papers
       (arxiv_id, title, abstract, authors_json, categories_json, analysis_json, share_slug, analyzed_count, first_analyzed_at, last_analyzed_at, updated_at, is_public)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8, $9, $10, TRUE)
       ON CONFLICT(arxiv_id)
       DO UPDATE SET
         title = excluded.title,
         abstract = excluded.abstract,
         authors_json = excluded.authors_json,
         categories_json = excluded.categories_json,
         analysis_json = excluded.analysis_json,
         updated_at = excluded.updated_at,
         is_public = TRUE`,
      values
    );
  } else {
    getSqliteDb()
      .prepare(
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
      )
      .run(...values);
  }

  const saved = await getPublicPaper(paper.arxivId);
  if (!saved) throw new Error('Unable to save public paper.');
  return saved;
}

export async function getPublicPaper(arxivId: string): Promise<PublicPaper | null> {
  const cleaned = cleanString(arxivId);
  if (hasPostgres) {
    const rows = await pgRows<PublicPaperRow>(
      `SELECT arxiv_id, title, abstract, authors_json, categories_json, analysis_json, share_slug,
              analyzed_count, first_analyzed_at, last_analyzed_at, updated_at, is_public
       FROM public_papers
       WHERE arxiv_id = $1 AND is_public = TRUE
       LIMIT 1`,
      [cleaned]
    );
    return mapPublicPaper(rows[0]);
  }
  const row = getSqliteDb()
    .prepare(
      `SELECT arxiv_id, title, abstract, authors_json, categories_json, analysis_json, share_slug,
              analyzed_count, first_analyzed_at, last_analyzed_at, updated_at, is_public
       FROM public_papers
       WHERE arxiv_id = ? AND is_public = 1
       LIMIT 1`
    )
    .get(cleaned) as PublicPaperRow | undefined;
  return mapPublicPaper(row);
}

export async function recordPublicPaperAnalysis(arxivId: string): Promise<void> {
  const now = nowIso();
  if (hasPostgres) {
    await pgRows(
      `UPDATE public_papers
       SET analyzed_count = analyzed_count + 1,
           last_analyzed_at = $1,
           updated_at = $2
       WHERE arxiv_id = $3 AND is_public = TRUE`,
      [now, now, cleanString(arxivId)]
    );
    return;
  }
  getSqliteDb()
    .prepare(
      `UPDATE public_papers
       SET analyzed_count = analyzed_count + 1,
           last_analyzed_at = ?,
           updated_at = ?
       WHERE arxiv_id = ? AND is_public = 1`
    )
    .run(now, now, cleanString(arxivId));
}

export async function listPublicPapers(limit = 8): Promise<PublicPaper[]> {
  const safeLimit = clampLimit(limit, 1, 24, 8);
  if (hasPostgres) {
    const rows = await pgRows<PublicPaperRow>(
      `SELECT arxiv_id, title, abstract, authors_json, categories_json, analysis_json, share_slug,
              analyzed_count, first_analyzed_at, last_analyzed_at, updated_at, is_public
       FROM public_papers
       WHERE is_public = TRUE
       ORDER BY analyzed_count DESC, last_analyzed_at DESC
       LIMIT $1`,
      [safeLimit]
    );
    return rows.map(mapPublicPaper).filter((paper): paper is PublicPaper => Boolean(paper));
  }
  const rows = getSqliteDb()
    .prepare(
      `SELECT arxiv_id, title, abstract, authors_json, categories_json, analysis_json, share_slug,
              analyzed_count, first_analyzed_at, last_analyzed_at, updated_at, is_public
       FROM public_papers
       WHERE is_public = 1
       ORDER BY analyzed_count DESC, last_analyzed_at DESC
       LIMIT ?`
    )
    .all(safeLimit) as PublicPaperRow[];
  return rows.map(mapPublicPaper).filter((paper): paper is PublicPaper => Boolean(paper));
}

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  const today = dateKey();
  const since30 = daysAgo(30);
  const since14 = daysAgo(14);
  const since7 = daysAgo(7);
  const since180 = daysAgo(180);

  const scalarCount = hasPostgres ? pgScalarCount : async (sql: string, params: unknown[] = []) => sqliteScalarCount(sql, params);
  const eventCount = (eventName: string, since: string) =>
    scalarCount('SELECT COUNT(*) AS value FROM analytics_events WHERE event_name = ? AND created_at >= ?', [eventName, since]);

  const registeredUsers = await scalarCount('SELECT COUNT(*) AS value FROM users');
  const dailyActiveUsers = await scalarCount(
    `SELECT COUNT(DISTINCT COALESCE(user_id, anonymous_id)) AS value
     FROM analytics_events
     WHERE date_key = ? AND COALESCE(user_id, anonymous_id) IS NOT NULL`,
    [today]
  );
  const monthlyActiveUsers = await scalarCount(
    `SELECT COUNT(DISTINCT COALESCE(user_id, anonymous_id)) AS value
     FROM analytics_events
     WHERE created_at >= ? AND COALESCE(user_id, anonymous_id) IS NOT NULL`,
    [since30]
  );
  const anonymousVisitors30d = await scalarCount(
    `SELECT COUNT(DISTINCT anonymous_id) AS value
     FROM analytics_events
     WHERE created_at >= ? AND user_id IS NULL AND anonymous_id IS NOT NULL`,
    [since30]
  );
  const repeatUsers30d = await scalarCount(
    `SELECT COUNT(*) AS value
     FROM (
       SELECT COALESCE(user_id, anonymous_id) AS identity, COUNT(DISTINCT date_key) AS active_days
       FROM analytics_events
       WHERE created_at >= ? AND COALESCE(user_id, anonymous_id) IS NOT NULL
       GROUP BY identity
       HAVING COUNT(DISTINCT date_key) > 1
     ) AS repeats`,
    [since30]
  );
  const activeLast7d = await scalarCount(
    `SELECT COUNT(DISTINCT COALESCE(user_id, anonymous_id)) AS value
     FROM analytics_events
     WHERE created_at >= ? AND COALESCE(user_id, anonymous_id) IS NOT NULL`,
    [since7]
  );
  const returnedFromPrevious7d = await scalarCount(
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
     ) AS retained`,
    [since7, since14, since7]
  );

  let dailyRows: AnalyticsSummary['dailySeries'];
  let monthlyRows: AnalyticsSummary['monthlySeries'];
  let popularPapers: AnalyticsSummary['popularPapers'];
  let trafficSources: AnalyticsSummary['trafficSources'];
  let recentEvents: AnalyticsSummary['recentEvents'];

  if (hasPostgres) {
    dailyRows = (
      await pgRows<{
        date: string;
        activeusers: string | number;
        analyses: string | number;
        bookmarks: string | number;
        exports: string | number;
        chats: string | number;
      }>(
        `WITH days AS (
           SELECT date_key FROM analytics_events WHERE created_at >= $1 GROUP BY date_key
         )
         SELECT
           days.date_key AS date,
           COUNT(DISTINCT COALESCE(e.user_id, e.anonymous_id)) AS activeUsers,
           COALESCE(SUM(CASE WHEN e.event_name = 'paper_analyzed' THEN 1 ELSE 0 END), 0) AS analyses,
           COALESCE(SUM(CASE WHEN e.event_name = 'bookmark_created' THEN 1 ELSE 0 END), 0) AS bookmarks,
           COALESCE(SUM(CASE WHEN e.event_name = 'summary_exported' THEN 1 ELSE 0 END), 0) AS exports,
           COALESCE(SUM(CASE WHEN e.event_name = 'chat_message_sent' THEN 1 ELSE 0 END), 0) AS chats
         FROM days
         LEFT JOIN analytics_events e ON e.date_key = days.date_key
         GROUP BY days.date_key
         ORDER BY days.date_key ASC`,
        [since30]
      )
    ).map((row) => ({
      date: row.date,
      activeUsers: numberValue(row.activeusers),
      analyses: numberValue(row.analyses),
      bookmarks: numberValue(row.bookmarks),
      exports: numberValue(row.exports),
      chats: numberValue(row.chats),
    }));

    monthlyRows = (
      await pgRows<{ month: string; activeusers: string | number; analyses: string | number }>(
        `SELECT
           substr(date_key, 1, 7) AS month,
           COUNT(DISTINCT COALESCE(user_id, anonymous_id)) AS activeUsers,
           COALESCE(SUM(CASE WHEN event_name = 'paper_analyzed' THEN 1 ELSE 0 END), 0) AS analyses
         FROM analytics_events
         WHERE created_at >= $1
         GROUP BY month
         ORDER BY month ASC`,
        [since180]
      )
    ).map((row) => ({
      month: row.month,
      activeUsers: numberValue(row.activeusers),
      analyses: numberValue(row.analyses),
    }));

    popularPapers = (
      await pgRows<{ arxivid: string; title: string; count: string | number; lastanalyzedat: string }>(
        `SELECT arxiv_id AS arxivId, title, analyzed_count AS count, last_analyzed_at AS lastAnalyzedAt
         FROM public_papers
         WHERE is_public = TRUE
         ORDER BY analyzed_count DESC, last_analyzed_at DESC
         LIMIT 10`
      )
    ).map((row) => ({
      arxivId: row.arxivid,
      title: row.title,
      count: numberValue(row.count),
      lastAnalyzedAt: row.lastanalyzedat,
    }));

    trafficSources = (
      await pgRows<{ source: string; count: string | number }>(
        `SELECT COALESCE(NULLIF(source, ''), 'Direct / unknown') AS source, COUNT(*) AS count
         FROM analytics_events
         WHERE created_at >= $1 AND event_name = 'page_view'
         GROUP BY source
         ORDER BY count DESC
         LIMIT 10`,
        [since30]
      )
    ).map((row) => ({ source: row.source, count: numberValue(row.count) }));

    recentEvents = (
      await pgRows<{ eventname: string; arxivid: string | null; title: string | null; createdat: string; identity: 'user' | 'guest' }>(
        `SELECT event_name AS eventName, arxiv_id AS arxivId, title, created_at AS createdAt,
                CASE WHEN user_id IS NULL THEN 'guest' ELSE 'user' END AS identity
         FROM analytics_events
         ORDER BY created_at DESC
         LIMIT 24`
      )
    ).map((row) => ({
      eventName: row.eventname,
      arxivId: row.arxivid,
      title: row.title,
      createdAt: row.createdat,
      identity: row.identity,
    }));
  } else {
    dailyRows = getSqliteDb()
      .prepare(
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
      )
      .all(since30) as AnalyticsSummary['dailySeries'];

    monthlyRows = getSqliteDb()
      .prepare(
        `SELECT
           substr(date_key, 1, 7) AS month,
           COUNT(DISTINCT COALESCE(user_id, anonymous_id)) AS activeUsers,
           SUM(CASE WHEN event_name = 'paper_analyzed' THEN 1 ELSE 0 END) AS analyses
         FROM analytics_events
         WHERE created_at >= ?
         GROUP BY month
         ORDER BY month ASC`
      )
      .all(since180) as AnalyticsSummary['monthlySeries'];

    popularPapers = getSqliteDb()
      .prepare(
        `SELECT arxiv_id AS arxivId, title, analyzed_count AS count, last_analyzed_at AS lastAnalyzedAt
         FROM public_papers
         WHERE is_public = 1
         ORDER BY analyzed_count DESC, last_analyzed_at DESC
         LIMIT 10`
      )
      .all() as AnalyticsSummary['popularPapers'];

    trafficSources = getSqliteDb()
      .prepare(
        `SELECT COALESCE(NULLIF(source, ''), 'Direct / unknown') AS source, COUNT(*) AS count
         FROM analytics_events
         WHERE created_at >= ? AND event_name = 'page_view'
         GROUP BY source
         ORDER BY count DESC
         LIMIT 10`
      )
      .all(since30) as AnalyticsSummary['trafficSources'];

    recentEvents = getSqliteDb()
      .prepare(
        `SELECT event_name AS eventName, arxiv_id AS arxivId, title, created_at AS createdAt,
                CASE WHEN user_id IS NULL THEN 'guest' ELSE 'user' END AS identity
         FROM analytics_events
         ORDER BY created_at DESC
         LIMIT 24`
      )
      .all() as AnalyticsSummary['recentEvents'];
  }

  return {
    totals: {
      dailyActiveUsers,
      monthlyActiveUsers,
      registeredUsers,
      anonymousVisitors30d,
      paperAnalysesToday: await scalarCount(
        `SELECT COUNT(*) AS value FROM analytics_events WHERE event_name = ? AND date_key = ?`,
        ['paper_analyzed', today]
      ),
      paperAnalyses30d: await eventCount('paper_analyzed', since30),
      bookmarks30d: await eventCount('bookmark_created', since30),
      exports30d: await eventCount('summary_exported', since30),
      chatMessages30d: await eventCount('chat_message_sent', since30),
      repeatUsers30d,
      guestAnalyses30d: await scalarCount(
        `SELECT COUNT(*) AS value FROM analytics_events
         WHERE event_name = ? AND created_at >= ? AND user_id IS NULL`,
        ['paper_analyzed', since30]
      ),
      loggedInAnalyses30d: await scalarCount(
        `SELECT COUNT(*) AS value FROM analytics_events
         WHERE event_name = ? AND created_at >= ? AND user_id IS NOT NULL`,
        ['paper_analyzed', since30]
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
