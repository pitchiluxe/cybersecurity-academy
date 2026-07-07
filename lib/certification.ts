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

export async function checkCertsForCategory(userId: number, category: ScenarioCategory): Promise<TrackId[]> {
  const issued: TrackId[] = [];
  for (const track of tracksForCategory(category)) {
    if (await checkAndIssueCertificate(userId, track)) issued.push(track);
  }
  return issued;
}
