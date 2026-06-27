import { loadPrograms } from "../data/loadPrograms.js";
import {
  STANDARD_DISCLAIMER,
  type BusinessProfile,
  type CuratedProgram,
  type EligibilityResult
} from "../types.js";
import { normalize } from "../text/lexicon.js";
import { checkEligibility } from "./checkEligibility.js";

export interface RelevantProgram {
  programId: string;
  title: string;
  organization: string;
  target: string;
  support: string | null;
  deadline: string | null;
  sourceUrl: string;
  reviewFitScore: number;
  reviewFitLevel: "높음" | "보통" | "낮음";
  matchedReasons: string[];
  cautions: string[];
  nextAction: string;
}

export interface FindRelevantProgramsResult {
  programs: RelevantProgram[];
  missingFields: string[];
  disclaimer: string;
}

/**
 * 로컬 데모 공고 DB에서 사업자 조건과 맞는 후보를 찾는다.
 * 선정/수령 가능성이 아니라 "검토 우선순위"를 정하기 위한 deterministic search다.
 */
export async function findRelevantPrograms(
  businessProfile: BusinessProfile,
  today = new Date().toISOString().slice(0, 10)
): Promise<FindRelevantProgramsResult> {
  const programs = await loadPrograms();
  const results = programs
    .map((program) => rankProgram(businessProfile, program, today))
    .sort((a, b) => b.reviewFitScore - a.reviewFitScore)
    .slice(0, 5);
  const hasUsefulCandidate = results.some((program) => program.reviewFitScore >= 60);

  return {
    programs: results,
    // 후보가 충분히 있으면 먼저 결과를 보여준다. 부족 정보는 각 후보의 cautions로만 남겨
    // 사용자가 "더 말해야만 진행되는" 느낌을 줄인다.
    missingFields: hasUsefulCandidate ? [] : businessProfile.missingFields,
    disclaimer: STANDARD_DISCLAIMER
  };
}

function rankProgram(profile: BusinessProfile, program: CuratedProgram, today: string): RelevantProgram {
  const eligibility = checkEligibility(profile, program);
  const keywordScore = calculateKeywordScore(profile, program);
  const deadline = getDeadlineStatus(program.deadline, today);

  let score = baseScore(eligibility) + keywordScore;
  const cautions = [
    ...eligibility.hardBlockers.map((blocker) => blocker.reason),
    ...eligibility.conditionalNotes.map((note) => note.reason),
    ...eligibility.missingFields.map((field) => `판정에 필요한 정보가 부족합니다: ${field}`)
  ];

  if (deadline.status === "closed") {
    score = Math.min(score, 40);
    cautions.push("현재 기준 마감일이 지난 공고일 수 있습니다. 원문에서 재공고/추가모집 여부를 확인하세요.");
  } else if (deadline.status === "soon") {
    cautions.push("마감이 임박한 공고입니다. 제출서류 준비 가능 시간을 먼저 확인하세요.");
  } else if (deadline.status === "unknown") {
    cautions.push("마감일이 명확하지 않습니다. 공고 원문에서 접수 가능 상태를 확인하세요.");
  }

  score = clamp(score, 0, 100);

  const matchedReasons = buildMatchedReasons(profile, program, eligibility, keywordScore);

  return {
    programId: extractProgramId(program),
    title: program.title ?? "제목 미상",
    organization: program.organization ?? "기관 미상",
    target: program.target,
    support: program.support,
    deadline: program.deadline,
    sourceUrl: program.sourceUrl,
    reviewFitScore: score,
    reviewFitLevel: fitLevel(score),
    matchedReasons,
    cautions: Array.from(new Set(cautions)),
    nextAction: nextActionFor(eligibility, deadline.status)
  };
}

function baseScore(eligibility: EligibilityResult): number {
  switch (eligibility.verdict) {
    case "HIGHLY_LIKELY":
      return 80;
    case "CONDITIONAL":
      return 65;
    case "INSUFFICIENT_INFO":
      return 45;
    case "NOT_ELIGIBLE":
      return 15;
  }
}

function calculateKeywordScore(profile: BusinessProfile, program: CuratedProgram): number {
  const profileTokens = [
    profile.businessType,
    profile.fundingPurpose,
    ...profile.keywords
  ]
    .filter((value): value is string => Boolean(value))
    .map(normalize)
    .filter(Boolean);

  if (profileTokens.length === 0) return 0;

  const haystack = normalize(
    [
      program.title,
      program.target,
      program.support,
      ...program.targetBusinessTypes,
      ...program.evaluationCriteria,
      ...program.requiredDocuments
    ]
      .filter(Boolean)
      .join(" ")
  );

  const matches = profileTokens.filter((token) => haystack.includes(token)).length;
  return Math.min(matches * 5, 15);
}

function buildMatchedReasons(
  profile: BusinessProfile,
  program: CuratedProgram,
  eligibility: EligibilityResult,
  keywordScore: number
): string[] {
  const reasons = eligibility.matchedConditions.map((condition) => condition.reason);

  if (keywordScore > 0) {
    reasons.push("사업 업종/지원 목적과 공고 내용에 겹치는 키워드가 있습니다.");
  }

  if (program.regions.includes("전국")) {
    reasons.push("전국 대상 공고라 지역 제한 부담이 낮습니다.");
  }

  if (profile.businessForm && program.eligibleBusinessForms.includes(profile.businessForm)) {
    reasons.push(`사업자 유형(${profile.businessForm})이 공고 대상에 포함됩니다.`);
  }

  return Array.from(new Set(reasons)).slice(0, 5);
}

function nextActionFor(eligibility: EligibilityResult, deadlineStatus: DeadlineStatus): string {
  if (deadlineStatus === "closed") {
    return "마감 상태와 추가모집 여부를 먼저 확인한 뒤, 유사 공고를 함께 찾아보세요.";
  }
  if (eligibility.verdict === "NOT_ELIGIBLE") {
    return "결격 가능성이 있는 조건을 먼저 확인하고, 같은 목적의 다른 공고를 검토하세요.";
  }
  if (eligibility.verdict === "INSUFFICIENT_INFO") {
    return "지역, 업력, 사업자 유형, 업종 등 부족한 정보를 보완한 뒤 다시 판정하세요.";
  }
  return "공고 원문을 확인하고 제출서류, 평가항목, 신청 마감일부터 준비하세요.";
}

type DeadlineStatus = "open" | "soon" | "closed" | "unknown";

function getDeadlineStatus(deadline: string | null, today: string): { status: DeadlineStatus } {
  if (!deadline) return { status: "unknown" };
  const deadlineDate = Date.parse(`${deadline}T23:59:59+09:00`);
  const todayDate = Date.parse(`${today}T00:00:00+09:00`);
  if (Number.isNaN(deadlineDate) || Number.isNaN(todayDate)) return { status: "unknown" };
  const daysLeft = Math.ceil((deadlineDate - todayDate) / 86_400_000);
  if (daysLeft < 0) return { status: "closed" };
  if (daysLeft <= 7) return { status: "soon" };
  return { status: "open" };
}

function fitLevel(score: number): "높음" | "보통" | "낮음" {
  if (score >= 70) return "높음";
  if (score >= 45) return "보통";
  return "낮음";
}

function extractProgramId(program: CuratedProgram): string {
  const urlMatch = program.sourceUrl.match(/[?&]pblancId=([^&]+)/);
  if (urlMatch) return urlMatch[1];
  return normalize(program.title ?? "program").slice(0, 40) || "program";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
