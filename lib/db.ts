import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "data", "app.db");

let db: Database.Database | null = null;

function ensureDataDir(): void {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getDb(): Database.Database {
  if (db) return db;
  ensureDataDir();
  db = new Database(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS presence (
      user_id INTEGER PRIMARY KEY,
      last_seen INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      track TEXT NOT NULL,
      content_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_id, track)
    );
    CREATE TABLE IF NOT EXISTS module_progress (
      course_id INTEGER NOT NULL,
      module_index INTEGER NOT NULL,
      quiz_score INTEGER NOT NULL,
      passed_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (course_id, module_index)
    );
    CREATE TABLE IF NOT EXISTS certificates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      track TEXT NOT NULL,
      cert_code TEXT NOT NULL,
      issued_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_id, track)
    );
    CREATE TABLE IF NOT EXISTS ticket_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      grade INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  created_at: string;
}

export function findUserByEmail(email: string): UserRow | undefined {
  return getDb().prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
}

export function createUser(email: string, passwordHash: string): UserRow {
  const info = getDb()
    .prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)")
    .run(email, passwordHash);
  return getDb().prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid) as UserRow;
}

export function upsertPresence(userId: number, nowMs: number): void {
  getDb()
    .prepare(
      "INSERT INTO presence (user_id, last_seen) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET last_seen = excluded.last_seen"
    )
    .run(userId, nowMs);
}

export function getPresenceTimestamps(): number[] {
  const rows = getDb().prepare("SELECT last_seen FROM presence").all() as { last_seen: number }[];
  return rows.map((r) => r.last_seen);
}

export interface CertificateRow {
  id: number;
  user_id: number;
  track: string;
  cert_code: string;
  issued_at: string;
}

export function getCourseRow(userId: number, track: string): { id: number; content_json: string } | undefined {
  return getDb()
    .prepare("SELECT id, content_json FROM courses WHERE user_id = ? AND track = ?")
    .get(userId, track) as { id: number; content_json: string } | undefined;
}

// Concurrent generations of the same course (e.g. React StrictMode double
// effects) race on the UNIQUE(user_id, track) constraint; first write wins.
export function saveCourse(userId: number, track: string, contentJson: string): number {
  getDb()
    .prepare("INSERT INTO courses (user_id, track, content_json) VALUES (?, ?, ?) ON CONFLICT(user_id, track) DO NOTHING")
    .run(userId, track, contentJson);
  return getCourseRow(userId, track)!.id;
}

export function getPassedModuleIndexes(courseId: number): number[] {
  const rows = getDb()
    .prepare("SELECT module_index FROM module_progress WHERE course_id = ? ORDER BY module_index")
    .all(courseId) as { module_index: number }[];
  return rows.map((r) => r.module_index);
}

export function recordModulePass(courseId: number, moduleIndex: number, score: number): void {
  getDb()
    .prepare(
      "INSERT INTO module_progress (course_id, module_index, quiz_score) VALUES (?, ?, ?) ON CONFLICT(course_id, module_index) DO UPDATE SET quiz_score = MAX(quiz_score, excluded.quiz_score)"
    )
    .run(courseId, moduleIndex, score);
}

export function getCertificates(userId: number): CertificateRow[] {
  return getDb()
    .prepare("SELECT * FROM certificates WHERE user_id = ? ORDER BY issued_at")
    .all(userId) as CertificateRow[];
}

export function hasCertificate(userId: number, track: string): boolean {
  return (
    getDb().prepare("SELECT 1 FROM certificates WHERE user_id = ? AND track = ?").get(userId, track) !== undefined
  );
}

export function insertCertificate(userId: number, track: string, certCode: string): void {
  getDb()
    .prepare("INSERT OR IGNORE INTO certificates (user_id, track, cert_code) VALUES (?, ?, ?)")
    .run(userId, track, certCode);
}

export function recordTicketResult(userId: number, category: string, grade: number): void {
  getDb()
    .prepare("INSERT INTO ticket_results (user_id, category, grade) VALUES (?, ?, ?)")
    .run(userId, category, grade);
}

export function countQualifyingTickets(userId: number, categories: string[], minGrade: number): number {
  if (categories.length === 0) return 0;
  const placeholders = categories.map(() => "?").join(",");
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM ticket_results WHERE user_id = ? AND grade >= ? AND category IN (${placeholders})`
    )
    .get(userId, minGrade, ...categories) as { n: number };
  return row.n;
}

export function getTicketStats(userId: number): { total: number; resolvedOver70: number; avgGrade: number | null } {
  const row = getDb()
    .prepare(
      "SELECT COUNT(*) AS total, SUM(CASE WHEN grade >= 70 THEN 1 ELSE 0 END) AS resolved, AVG(grade) AS avg FROM ticket_results WHERE user_id = ?"
    )
    .get(userId) as { total: number; resolved: number | null; avg: number | null };
  return {
    total: row.total,
    resolvedOver70: row.resolved ?? 0,
    avgGrade: row.avg === null ? null : Math.round(row.avg),
  };
}
