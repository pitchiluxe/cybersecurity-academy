import { createClient, type Client, type Row } from "@libsql/client";

// libSQL client — talks to a local SQLite file in development and to Turso
// (or any libSQL server) in production. Set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN
// on Vercel; locally it defaults to a file under ./data so nothing else changes.
const DB_URL = process.env.TURSO_DATABASE_URL ?? "file:./data/app.db";
const DB_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

let client: Client | null = null;
let schemaReady: Promise<void> | null = null;

const SCHEMA = `
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
  CREATE TABLE IF NOT EXISTS exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    track TEXT NOT NULL,
    content_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, track)
  );
  CREATE TABLE IF NOT EXISTS bootcamp_chapters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    skill TEXT NOT NULL,
    content_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, skill)
  );
  CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    content_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS bootcamp_enrollments (
    user_id INTEGER NOT NULL,
    camp TEXT NOT NULL,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, camp)
  );
  CREATE TABLE IF NOT EXISTS bootcamp_progress (
    user_id INTEGER NOT NULL,
    skill TEXT NOT NULL,
    quiz_score INTEGER NOT NULL DEFAULT 0,
    lab_done INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, skill)
  );
`;

function getClient(): Client {
  if (!client) {
    // On a serverless host (Vercel) the filesystem is read-only, so a `file:`
    // URL can never be written. Fail loudly with the fix instead of an opaque
    // "database is locked / readonly" error on the first query.
    if (process.env.VERCEL && DB_URL.startsWith("file:")) {
      throw new Error(
        "TURSO_DATABASE_URL is not set. On Vercel the local SQLite file is not writable — " +
          "create a Turso database and set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN in the project's " +
          "Environment Variables, then redeploy."
      );
    }
    client = createClient({ url: DB_URL, authToken: DB_AUTH_TOKEN, intMode: "number" });
  }
  return client;
}

// Create the schema exactly once per process (memoized promise).
function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = getClient()
      .executeMultiple(SCHEMA)
      .catch((err) => {
        schemaReady = null; // allow a retry on transient failure
        throw err;
      });
  }
  return schemaReady;
}

type Args = (string | number | bigint | null)[];

async function exec(sql: string, args: Args = []) {
  await ensureSchema();
  return getClient().execute({ sql, args });
}

// Coerce libSQL row values (which can be bigint) to safe JS numbers.
function num(v: unknown): number {
  return typeof v === "bigint" ? Number(v) : (v as number);
}

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  created_at: string;
}

function mapUser(r: Row): UserRow {
  return { id: num(r.id), email: String(r.email), password_hash: String(r.password_hash), created_at: String(r.created_at) };
}

export async function findUserByEmail(email: string): Promise<UserRow | undefined> {
  const rs = await exec("SELECT * FROM users WHERE email = ?", [email]);
  return rs.rows[0] ? mapUser(rs.rows[0]) : undefined;
}

export async function createUser(email: string, passwordHash: string): Promise<UserRow> {
  const info = await exec("INSERT INTO users (email, password_hash) VALUES (?, ?)", [email, passwordHash]);
  const id = Number(info.lastInsertRowid);
  const rs = await exec("SELECT * FROM users WHERE id = ?", [id]);
  return mapUser(rs.rows[0]);
}

export async function upsertPresence(userId: number, nowMs: number): Promise<void> {
  await exec(
    "INSERT INTO presence (user_id, last_seen) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET last_seen = excluded.last_seen",
    [userId, nowMs]
  );
}

export async function getPresenceTimestamps(): Promise<number[]> {
  const rs = await exec("SELECT last_seen FROM presence");
  return rs.rows.map((r) => num(r.last_seen));
}

export interface CertificateRow {
  id: number;
  user_id: number;
  track: string;
  cert_code: string;
  issued_at: string;
}

function mapCert(r: Row): CertificateRow {
  return { id: num(r.id), user_id: num(r.user_id), track: String(r.track), cert_code: String(r.cert_code), issued_at: String(r.issued_at) };
}

export async function getCourseRow(userId: number, track: string): Promise<{ id: number; content_json: string } | undefined> {
  const rs = await exec("SELECT id, content_json FROM courses WHERE user_id = ? AND track = ?", [userId, track]);
  const r = rs.rows[0];
  return r ? { id: num(r.id), content_json: String(r.content_json) } : undefined;
}

// Concurrent generations of the same course (e.g. React StrictMode double
// effects) race on the UNIQUE(user_id, track) constraint; first write wins.
export async function saveCourse(userId: number, track: string, contentJson: string): Promise<number> {
  await exec("INSERT INTO courses (user_id, track, content_json) VALUES (?, ?, ?) ON CONFLICT(user_id, track) DO NOTHING", [
    userId,
    track,
    contentJson,
  ]);
  const row = await getCourseRow(userId, track);
  return row!.id;
}

export async function getBootcampChapterRow(userId: number, skill: string): Promise<{ id: number; content_json: string } | undefined> {
  const rs = await exec("SELECT id, content_json FROM bootcamp_chapters WHERE user_id = ? AND skill = ?", [userId, skill]);
  const r = rs.rows[0];
  return r ? { id: num(r.id), content_json: String(r.content_json) } : undefined;
}

// Same first-write-wins race handling as saveCourse.
export async function saveBootcampChapter(userId: number, skill: string, contentJson: string): Promise<void> {
  await exec("INSERT INTO bootcamp_chapters (user_id, skill, content_json) VALUES (?, ?, ?) ON CONFLICT(user_id, skill) DO NOTHING", [
    userId,
    skill,
    contentJson,
  ]);
}

// App settings live in the DB so they persist on hosts with read-only
// filesystems (Vercel); the singleton row keeps it one source of truth.
// NOTE: the id filter must be a bound parameter — Turso's hosted server
// fails to match `WHERE id = 1` written as a literal (0 rows) while the
// parameterized form matches; every query in this file binds values.
export async function getAppSettingsJson(): Promise<string | undefined> {
  const rs = await exec("SELECT content_json FROM app_settings WHERE id = ?", [1]);
  const r = rs.rows[0];
  return r ? String(r.content_json) : undefined;
}

export async function saveAppSettingsJson(contentJson: string): Promise<void> {
  await exec("INSERT INTO app_settings (id, content_json) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET content_json = excluded.content_json", [
    contentJson,
  ]);
}

/** Records the trainee's actual start date the first time they open a bootcamp. */
export async function enrollBootcamp(userId: number, camp: string): Promise<string> {
  await exec("INSERT OR IGNORE INTO bootcamp_enrollments (user_id, camp) VALUES (?, ?)", [userId, camp]);
  const rs = await exec("SELECT started_at FROM bootcamp_enrollments WHERE user_id = ? AND camp = ?", [userId, camp]);
  return String(rs.rows[0].started_at);
}

export interface BootcampProgressRow {
  skill: string;
  quiz_score: number;
  lab_done: number;
}

export async function getBootcampProgress(userId: number, skills: string[]): Promise<BootcampProgressRow[]> {
  if (skills.length === 0) return [];
  const placeholders = skills.map(() => "?").join(",");
  const rs = await exec(
    `SELECT skill, quiz_score, lab_done FROM bootcamp_progress WHERE user_id = ? AND skill IN (${placeholders})`,
    [userId, ...skills]
  );
  return rs.rows.map((r) => ({ skill: String(r.skill), quiz_score: num(r.quiz_score), lab_done: num(r.lab_done) }));
}

export async function upsertBootcampQuizScore(userId: number, skill: string, score: number): Promise<void> {
  await exec(
    `INSERT INTO bootcamp_progress (user_id, skill, quiz_score) VALUES (?, ?, ?)
     ON CONFLICT(user_id, skill) DO UPDATE SET quiz_score = MAX(quiz_score, excluded.quiz_score)`,
    [userId, skill, score]
  );
}

export async function markBootcampLabDone(userId: number, skill: string): Promise<void> {
  await exec(
    `INSERT INTO bootcamp_progress (user_id, skill, lab_done) VALUES (?, ?, 1)
     ON CONFLICT(user_id, skill) DO UPDATE SET lab_done = 1`,
    [userId, skill]
  );
}

export async function getExamRow(userId: number, track: string): Promise<{ id: number; content_json: string } | undefined> {
  const rs = await exec("SELECT id, content_json FROM exams WHERE user_id = ? AND track = ?", [userId, track]);
  const r = rs.rows[0];
  return r ? { id: num(r.id), content_json: String(r.content_json) } : undefined;
}

// Same first-write-wins race handling as saveCourse.
export async function saveExam(userId: number, track: string, contentJson: string): Promise<void> {
  await exec("INSERT INTO exams (user_id, track, content_json) VALUES (?, ?, ?) ON CONFLICT(user_id, track) DO NOTHING", [
    userId,
    track,
    contentJson,
  ]);
}

export async function updateExamJson(userId: number, track: string, contentJson: string): Promise<void> {
  await exec("UPDATE exams SET content_json = ? WHERE user_id = ? AND track = ?", [contentJson, userId, track]);
}

export async function deleteExam(userId: number, track: string): Promise<void> {
  await exec("DELETE FROM exams WHERE user_id = ? AND track = ?", [userId, track]);
}

export async function deleteCourse(userId: number, track: string): Promise<void> {
  const row = await getCourseRow(userId, track);
  if (!row) return;
  await exec("DELETE FROM module_progress WHERE course_id = ?", [row.id]);
  await exec("DELETE FROM courses WHERE id = ?", [row.id]);
}

export async function getPassedModuleIndexes(courseId: number): Promise<number[]> {
  const rs = await exec("SELECT module_index FROM module_progress WHERE course_id = ? ORDER BY module_index", [courseId]);
  return rs.rows.map((r) => num(r.module_index));
}

export async function recordModulePass(courseId: number, moduleIndex: number, score: number): Promise<void> {
  await exec(
    "INSERT INTO module_progress (course_id, module_index, quiz_score) VALUES (?, ?, ?) ON CONFLICT(course_id, module_index) DO UPDATE SET quiz_score = MAX(quiz_score, excluded.quiz_score)",
    [courseId, moduleIndex, score]
  );
}

export async function getCertificates(userId: number): Promise<CertificateRow[]> {
  const rs = await exec("SELECT * FROM certificates WHERE user_id = ? ORDER BY issued_at", [userId]);
  return rs.rows.map(mapCert);
}

export async function getCertificateForTrack(
  userId: number,
  track: string
): Promise<{ cert_code: string; issued_at: string } | undefined> {
  const rs = await exec("SELECT cert_code, issued_at FROM certificates WHERE user_id = ? AND track = ?", [userId, track]);
  const r = rs.rows[0];
  return r ? { cert_code: String(r.cert_code), issued_at: String(r.issued_at) } : undefined;
}

export async function hasCertificate(userId: number, track: string): Promise<boolean> {
  const rs = await exec("SELECT 1 FROM certificates WHERE user_id = ? AND track = ?", [userId, track]);
  return rs.rows.length > 0;
}

export async function insertCertificate(userId: number, track: string, certCode: string): Promise<void> {
  await exec("INSERT OR IGNORE INTO certificates (user_id, track, cert_code) VALUES (?, ?, ?)", [userId, track, certCode]);
}

export async function recordTicketResult(userId: number, category: string, grade: number): Promise<void> {
  await exec("INSERT INTO ticket_results (user_id, category, grade) VALUES (?, ?, ?)", [userId, category, grade]);
}

export async function countQualifyingTickets(userId: number, categories: string[], minGrade: number): Promise<number> {
  if (categories.length === 0) return 0;
  const placeholders = categories.map(() => "?").join(",");
  const rs = await exec(
    `SELECT COUNT(*) AS n FROM ticket_results WHERE user_id = ? AND grade >= ? AND category IN (${placeholders})`,
    [userId, minGrade, ...categories]
  );
  return num(rs.rows[0].n);
}

export async function getTicketStats(userId: number): Promise<{ total: number; resolvedOver70: number; avgGrade: number | null }> {
  const rs = await exec(
    "SELECT COUNT(*) AS total, SUM(CASE WHEN grade >= 70 THEN 1 ELSE 0 END) AS resolved, AVG(grade) AS avg FROM ticket_results WHERE user_id = ?",
    [userId]
  );
  const r = rs.rows[0];
  return {
    total: num(r.total),
    resolvedOver70: r.resolved === null ? 0 : num(r.resolved),
    avgGrade: r.avg === null ? null : Math.round(num(r.avg)),
  };
}
