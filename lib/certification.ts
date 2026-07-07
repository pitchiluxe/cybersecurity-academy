import type { ScenarioCategory } from "./types";
import type { Course, TrackId } from "./courses";
import { certEligible, getTrack, makeCertCode, tracksForCategory, CERT_MIN_GRADE } from "./courses";
import {
  countQualifyingTickets,
  getCourseRow,
  getPassedModuleIndexes,
  hasCertificate,
  insertCertificate,
} from "./db";

// Returns true when a certificate was newly issued for this track.
export function checkAndIssueCertificate(userId: number, track: TrackId): boolean {
  if (hasCertificate(userId, track)) return false;

  const row = getCourseRow(userId, track);
  if (!row) return false;

  let course: Course;
  try {
    course = JSON.parse(row.content_json) as Course;
  } catch {
    return false;
  }

  const passed = getPassedModuleIndexes(row.id).length;
  const tickets = countQualifyingTickets(userId, getTrack(track).categories, CERT_MIN_GRADE);
  if (!certEligible(passed, course.modules.length, tickets)) return false;

  insertCertificate(userId, track, makeCertCode(track));
  return true;
}

export function checkCertsForCategory(userId: number, category: ScenarioCategory): TrackId[] {
  return tracksForCategory(category).filter((track) => checkAndIssueCertificate(userId, track));
}
