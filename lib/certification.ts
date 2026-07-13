import { randomBytes } from "crypto";
import type { ScenarioCategory } from "./types";
import type { Course, TrackId } from "./courses";
import { certEligible, getTrack, makeCertCode, tracksForCategory, CERT_MIN_GRADE } from "./courses";
import { getBootcamp, skillsForBootcamp, BOOTCAMP_PASS_SCORE } from "./bootcamp";
import {
  countQualifyingTickets,
  getBootcampProgress,
  getCertificateForTrack,
  getCourseRow,
  getPassedModuleIndexes,
  hasCertificate,
  insertCertificate,
} from "./db";

// Returns true when a certificate was newly issued for this track.
export async function checkAndIssueCertificate(userId: number, track: TrackId): Promise<boolean> {
  if (await hasCertificate(userId, track)) return false;

  const row = await getCourseRow(userId, track);
  if (!row) return false;

  let course: Course;
  try {
    course = JSON.parse(row.content_json) as Course;
  } catch {
    return false;
  }

  const passed = (await getPassedModuleIndexes(row.id)).length;
  const tickets = await countQualifyingTickets(userId, getTrack(track).categories, CERT_MIN_GRADE);
  if (!certEligible(passed, course.modules.length, tickets)) return false;

  await insertCertificate(userId, track, makeCertCode(track));
  return true;
}

export const BOOTCAMP_CERT_PREFIX = "bootcamp-";

/**
 * A bootcamp certificate is earned only when ALL material is done: every
 * chapter quiz passed (≥ BOOTCAMP_PASS_SCORE) AND every chapter's VM lab
 * resolved. Returns the newly issued cert code, or null when not yet earned /
 * already issued.
 */
export async function checkAndIssueBootcampCertificate(userId: number, camp: string): Promise<string | null> {
  const meta = getBootcamp(camp);
  if (!meta) return null;
  const track = `${BOOTCAMP_CERT_PREFIX}${camp}`;
  if (await hasCertificate(userId, track)) return null;

  const skills = skillsForBootcamp(camp);
  const progress = await getBootcampProgress(userId, skills.map((s) => s.id));
  const doneAll = skills.every((s) => {
    const p = progress.find((row) => row.skill === s.id);
    return (p?.quiz_score ?? 0) >= BOOTCAMP_PASS_SCORE && (p?.lab_done ?? 0) === 1;
  });
  if (!doneAll) return null;

  const code = `BC-${camp.toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
  await insertCertificate(userId, track, code);
  return code;
}

export async function getBootcampCertificate(userId: number, camp: string) {
  return getCertificateForTrack(userId, `${BOOTCAMP_CERT_PREFIX}${camp}`);
}

export async function checkCertsForCategory(userId: number, category: ScenarioCategory): Promise<TrackId[]> {
  const issued: TrackId[] = [];
  for (const track of tracksForCategory(category)) {
    if (await checkAndIssueCertificate(userId, track)) issued.push(track);
  }
  return issued;
}
