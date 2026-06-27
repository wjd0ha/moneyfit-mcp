import { promises as fs } from "node:fs";
import path from "node:path";
import type { CuratedProgram } from "../types.js";

let cachedPrograms: CuratedProgram[] | null = null;
let cachedPath: string | null = null;

/**
 * data/programs.json에서 큐레이션된 공고 데이터셋을 로드한다.
 * 모든 항목은 구조화 요건 필드와 출처 메타를 갖추어야 한다.
 */
export async function loadPrograms(
  customPath = process.env.PROGRAM_DB_PATH
): Promise<CuratedProgram[]> {
  const resolvedPath = resolveProgramsPath(customPath);

  if (cachedPrograms && cachedPath === resolvedPath) {
    return cachedPrograms;
  }

  const raw = await fs.readFile(resolvedPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("programs.json must contain an array.");
  }

  const programs = parsed.map(validateProgram);
  cachedPrograms = programs;
  cachedPath = resolvedPath;
  return programs;
}

export function clearProgramsCache(): void {
  cachedPrograms = null;
  cachedPath = null;
}

function resolveProgramsPath(customPath?: string): string {
  if (customPath && customPath.trim().length > 0) {
    return path.isAbsolute(customPath) ? customPath : path.resolve(process.cwd(), customPath);
  }
  return path.resolve(process.cwd(), "data", "programs.json");
}

function validateProgram(value: unknown, index: number): CuratedProgram {
  if (!isRecord(value)) {
    throw new Error(`Program at index ${index} must be an object.`);
  }

  const requiredStrings = ["title", "organization", "sourceUrl", "sourceDate", "target"] as const;
  for (const field of requiredStrings) {
    if (typeof value[field] !== "string" || (value[field] as string).trim().length === 0) {
      throw new Error(`Program at index ${index} is missing string field: ${field}.`);
    }
  }

  const requiredArrays = [
    "regions",
    "eligibleBusinessForms",
    "targetBusinessTypes",
    "excludedBusinessTypes",
    "requiredDocuments",
    "evaluationCriteria",
    "evidence"
  ] as const;
  for (const field of requiredArrays) {
    if (!Array.isArray(value[field])) {
      throw new Error(`Program at index ${index} is missing array field: ${field}.`);
    }
  }

  if (!Array.isArray((value as Record<string, unknown>).evidence) ||
    !(value.evidence as unknown[]).every((item) => isRecord(item) && typeof item.field === "string" && typeof item.text === "string")) {
    throw new Error(`Program at index ${index} has malformed evidence entries.`);
  }

  if (value.sample !== true) {
    throw new Error(`Program at index ${index} must include sample: true for MVP data.`);
  }

  return value as unknown as CuratedProgram;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
