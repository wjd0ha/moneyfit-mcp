import {
  STANDARD_DISCLAIMER,
  VERDICT_LABELS,
  type BusinessProfile,
  type ConditionalNote,
  type EligibilityResult,
  type EligibilityVerdict,
  type HardBlocker,
  type MatchedCondition,
  type ProgramRequirements
} from "../types.js";
import { normalize, regionEquivalent } from "../text/lexicon.js";

/**
 * 사업자 프로필과 공고 요건을 비교해 신청 가능성을 4단계로 판정한다.
 *
 * 우선순위(하드 컷 우선):
 *   1) hardBlockers 존재   -> NOT_ELIGIBLE
 *   2) missingFields 존재  -> INSUFFICIENT_INFO
 *   3) conditionalNotes 존재 -> CONDITIONAL
 *   4) matchedConditions 존재 -> HIGHLY_LIKELY
 *   5) 평가 가능한 조건 없음 -> INSUFFICIENT_INFO
 */
export function checkEligibility(
  profile: BusinessProfile,
  program: ProgramRequirements
): EligibilityResult {
  const hardBlockers: HardBlocker[] = [];
  const matchedConditions: MatchedCondition[] = [];
  const conditionalNotes: ConditionalNote[] = [];
  const missingFields = new Set<string>();

  evaluateRegion(profile, program, { hardBlockers, matchedConditions, missingFields });
  evaluateBusinessForm(profile, program, { hardBlockers, matchedConditions, conditionalNotes, missingFields });
  evaluateYears(profile, program, { hardBlockers, matchedConditions, missingFields });
  evaluateBusinessType(profile, program, { hardBlockers, matchedConditions, conditionalNotes, missingFields });
  evaluateAdditionalConditions(program, { hardBlockers, matchedConditions, conditionalNotes, missingFields });

  const verdict = decideVerdict({
    hasHardBlocker: hardBlockers.length > 0,
    hasMissing: missingFields.size > 0,
    hasConditional: conditionalNotes.length > 0,
    hasMatched: matchedConditions.length > 0
  });

  return {
    verdict,
    verdictLabel: VERDICT_LABELS[verdict],
    hardBlockers,
    missingFields: [...missingFields],
    matchedConditions,
    conditionalNotes,
    summary: buildSummary(verdict, { hardBlockers, missingFields, matchedConditions, conditionalNotes }),
    disclaimer: STANDARD_DISCLAIMER
  };
}

interface Buckets {
  hardBlockers: HardBlocker[];
  matchedConditions: MatchedCondition[];
  conditionalNotes?: ConditionalNote[];
  missingFields: Set<string>;
}

function evaluateRegion(profile: BusinessProfile, program: ProgramRequirements, buckets: Buckets): void {
  if (program.regions.length === 0) {
    return; // 공고에서 지역 요건을 확인할 수 없음(공고측 정보부족).
  }
  if (program.regions.includes("전국")) {
    buckets.matchedConditions.push({ field: "region", reason: "전국 대상 공고로 지역 제한이 없습니다." });
    return;
  }
  if (profile.region === null) {
    buckets.missingFields.add("region");
    return;
  }
  const matched = program.regions.some((region) => regionEquivalent(profile.region as string, region));
  if (matched) {
    buckets.matchedConditions.push({
      field: "region",
      reason: `사업장 지역(${profile.region})이 공고 지역(${program.regions.join("/")})과 일치합니다.`
    });
  } else {
    buckets.hardBlockers.push({
      field: "region",
      reason: `공고 지역(${program.regions.join("/")})과 사업장 지역(${profile.region})이 다릅니다.`,
      evidence: findEvidence(program, "regions")
    });
  }
}

function evaluateBusinessForm(
  profile: BusinessProfile,
  program: ProgramRequirements,
  buckets: Required<Buckets>
): void {
  const forms = program.eligibleBusinessForms;
  if (forms.length === 0) {
    return; // 공고에서 사업자 유형 요건을 확인할 수 없음.
  }

  const preFounderOnly = forms.length === 1 && forms[0] === "예비창업자";
  const allowsPreFounder = forms.includes("예비창업자");
  const allowsRegistered = forms.some((form) => form !== "예비창업자");

  // 등록 여부 기반 하드 컷(상호 배제).
  if (preFounderOnly && profile.isRegistered === true) {
    buckets.hardBlockers.push({
      field: "businessForm",
      reason: "예비창업자 전용 공고이지만 이미 사업자등록이 되어 있어 신청 대상이 아닙니다.",
      evidence: findEvidence(program, "eligibleBusinessForms")
    });
    return;
  }
  if (!allowsPreFounder && profile.isRegistered === false) {
    buckets.hardBlockers.push({
      field: "businessForm",
      reason: "기존 사업자 대상 공고이지만 아직 사업자등록 전(예비창업) 단계입니다.",
      evidence: findEvidence(program, "eligibleBusinessForms")
    });
    return;
  }

  if (profile.businessForm === null) {
    // 등록 여부만으로 충돌이 없으면, 유형 자체가 불명확하므로 추측하지 않는다.
    buckets.missingFields.add("businessForm");
    return;
  }

  if (forms.includes(profile.businessForm)) {
    buckets.matchedConditions.push({
      field: "businessForm",
      reason: `사업자 유형(${profile.businessForm})이 신청 대상에 포함됩니다.`
    });
    return;
  }

  // 소상공인↔개인사업자 등은 분류가 모호할 수 있어 결격이 아닌 확인 항목으로 둔다.
  if (profile.businessForm === "소상공인" && allowsRegistered) {
    buckets.conditionalNotes.push({
      field: "businessForm",
      reason: "소상공인 해당 여부(상시근로자 수·매출 기준)를 공고 기준으로 확인해야 합니다."
    });
    return;
  }

  buckets.conditionalNotes.push({
    field: "businessForm",
    reason: `사업자 유형(${profile.businessForm})이 신청 대상(${forms.join("/")})에 명시되지 않아 확인이 필요합니다.`
  });
}

function evaluateYears(profile: BusinessProfile, program: ProgramRequirements, buckets: Buckets): void {
  const { minYearsInBusiness: min, maxYearsInBusiness: max } = program;
  if (min === null && max === null) {
    return; // 업력 요건 없음.
  }
  if (profile.yearsInBusiness === null) {
    buckets.missingFields.add("yearsInBusiness");
    return;
  }
  const years = profile.yearsInBusiness;
  if (min !== null && years < min) {
    buckets.hardBlockers.push({
      field: "yearsInBusiness",
      reason: `업력 ${min}년 이상 조건이지만 현재 업력은 ${years}년입니다.`,
      evidence: findEvidence(program, "yearsInBusiness")
    });
    return;
  }
  if (max !== null && years > max) {
    buckets.hardBlockers.push({
      field: "yearsInBusiness",
      reason: `업력 ${max}년 이하 조건이지만 현재 업력은 ${years}년입니다.`,
      evidence: findEvidence(program, "yearsInBusiness")
    });
    return;
  }
  const range = [min === null ? "제한 없음" : `${min}년 이상`, max === null ? "상한 없음" : `${max}년 이하`].join(", ");
  buckets.matchedConditions.push({
    field: "yearsInBusiness",
    reason: `업력(${years}년)이 공고 조건(${range}) 범위에 들어갑니다.`
  });
}

function evaluateBusinessType(
  profile: BusinessProfile,
  program: ProgramRequirements,
  buckets: Required<Buckets>
): void {
  const hasExclusion = program.excludedBusinessTypes.length > 0;
  const hasTarget = program.targetBusinessTypes.length > 0;
  if (!hasExclusion && !hasTarget) {
    return; // 업종 요건 없음.
  }

  if (profile.businessType === null) {
    buckets.missingFields.add("businessType");
    return;
  }

  if (hasExclusion && typeMatches(profile.businessType, program.excludedBusinessTypes)) {
    buckets.hardBlockers.push({
      field: "businessType",
      reason: `업종(${profile.businessType})이 공고 제외 업종(${program.excludedBusinessTypes.join("/")})에 해당합니다.`,
      evidence: findEvidence(program, "excludedBusinessTypes")
    });
    return;
  }

  if (hasTarget) {
    if (typeMatches(profile.businessType, program.targetBusinessTypes)) {
      buckets.matchedConditions.push({
        field: "businessType",
        reason: `업종(${profile.businessType})이 신청 대상 업종에 포함됩니다.`
      });
    } else {
      buckets.conditionalNotes.push({
        field: "businessType",
        reason: `업종(${profile.businessType})이 대상 업종 목록에 명시되지 않아 원문 확인이 필요합니다.`
      });
    }
  } else {
    // 제외 목록만 있고 거기 해당하지 않으면 통과로 본다.
    buckets.matchedConditions.push({
      field: "businessType",
      reason: `업종(${profile.businessType})이 공고 제외 업종에 해당하지 않습니다.`
    });
  }
}

function evaluateAdditionalConditions(program: ProgramRequirements, buckets: Required<Buckets>): void {
  const conditions = program.additionalEligibilityConditions ?? [];
  for (const condition of conditions) {
    buckets.conditionalNotes.push({
      field: "additionalEligibilityConditions",
      reason: `공고의 추가 자격조건 확인이 필요합니다: ${condition}`
    });
  }
}

function typeMatches(businessType: string, candidates: string[]): boolean {
  const target = normalize(businessType);
  return candidates.some((candidate) => {
    const c = normalize(candidate);
    return target === c || target.includes(c) || c.includes(target);
  });
}

function decideVerdict(flags: {
  hasHardBlocker: boolean;
  hasMissing: boolean;
  hasConditional: boolean;
  hasMatched: boolean;
}): EligibilityVerdict {
  if (flags.hasHardBlocker) return "NOT_ELIGIBLE";
  if (flags.hasMissing) return "INSUFFICIENT_INFO";
  if (flags.hasConditional) return "CONDITIONAL";
  if (flags.hasMatched) return "HIGHLY_LIKELY";
  return "INSUFFICIENT_INFO";
}

function buildSummary(
  verdict: EligibilityVerdict,
  parts: {
    hardBlockers: HardBlocker[];
    missingFields: Set<string>;
    matchedConditions: MatchedCondition[];
    conditionalNotes: ConditionalNote[];
  }
): string {
  switch (verdict) {
    case "NOT_ELIGIBLE":
      return `현재 정보 기준 신청 부적합 가능성이 높습니다. 결격 사유: ${parts.hardBlockers
        .map((blocker) => blocker.reason)
        .join(" ")}`;
    case "INSUFFICIENT_INFO":
      return `현재 정보로는 판단이 어렵습니다. 다음 항목을 먼저 확인하세요: ${[...parts.missingFields].join(", ")}`;
    case "CONDITIONAL":
      return `결격 사유는 없지만 추가 확인이 필요합니다. 확인 항목: ${parts.conditionalNotes
        .map((note) => note.reason)
        .join(" ")}`;
    case "HIGHLY_LIKELY":
      return `현재 정보 기준 신청을 검토할 수 있습니다. 충족 조건: ${parts.matchedConditions
        .map((condition) => condition.reason)
        .join(" ")}`;
  }
}

function findEvidence(program: ProgramRequirements, field: string): string | undefined {
  return program.evidence.find((item) => item.field === field)?.text;
}
