import {
  STANDARD_DISCLAIMER,
  type ApplicationRisk,
  type BusinessProfile,
  type ProgramRequirements,
  type RiskReport
} from "../types.js";
import { normalize, regionEquivalent } from "../text/lexicon.js";

/**
 * 신청 전 점검해야 할 위험 요소를 탐지한다.
 * 업력 범위 초과, 지역 불일치, 제외 업종은 구조화 비교로 판정하고,
 * 중복 수혜·세금 체납·서류 미비는 사용자가 놓치기 쉬운 공통 확인 항목으로 안내한다.
 */
export function detectApplicationRisks(
  profile: BusinessProfile,
  program: ProgramRequirements,
  today: string = new Date().toISOString().slice(0, 10)
): RiskReport {
  const risks: ApplicationRisk[] = [];

  // 업력 초과/미달.
  if (profile.yearsInBusiness !== null) {
    const { minYearsInBusiness: min, maxYearsInBusiness: max } = program;
    if (max !== null && profile.yearsInBusiness > max) {
      risks.push({
        type: "업력초과",
        severity: "높음",
        message: `업력 ${max}년 이하 조건을 초과합니다(현재 ${profile.yearsInBusiness}년).`,
        recommendation: "업력 상한이 없는 공고를 찾거나, 별도 예외 조항을 운영기관에 문의하세요.",
        evidence: findEvidence(program, "yearsInBusiness")
      });
    } else if (min !== null && profile.yearsInBusiness < min) {
      risks.push({
        type: "업력초과",
        severity: "높음",
        message: `업력 ${min}년 이상 조건에 미달합니다(현재 ${profile.yearsInBusiness}년).`,
        recommendation: "업력 요건이 없는 초기창업·예비창업 대상 공고를 확인하세요.",
        evidence: findEvidence(program, "yearsInBusiness")
      });
    }
  }

  // 지역 불일치.
  if (
    profile.region !== null &&
    program.regions.length > 0 &&
    !program.regions.includes("전국") &&
    !program.regions.some((region) => regionEquivalent(profile.region as string, region))
  ) {
    risks.push({
      type: "지역불일치",
      severity: "높음",
      message: `사업장 지역(${profile.region})이 공고 지역(${program.regions.join("/")})과 다릅니다.`,
      recommendation: "사업장 소재지 기준 지역 요건을 원문에서 확인하세요. 본점/지점 기준이 다를 수 있습니다.",
      evidence: findEvidence(program, "regions")
    });
  }

  // 제외 업종.
  if (
    profile.businessType !== null &&
    program.excludedBusinessTypes.length > 0 &&
    typeMatches(profile.businessType, program.excludedBusinessTypes)
  ) {
    risks.push({
      type: "제외업종",
      severity: "높음",
      message: `업종(${profile.businessType})이 제외 업종(${program.excludedBusinessTypes.join("/")})에 해당할 수 있습니다.`,
      recommendation: "업종코드(표준산업분류) 기준 제외 여부를 운영기관에 확인하세요.",
      evidence: findEvidence(program, "excludedBusinessTypes")
    });
  }

  // 마감 임박.
  const deadlineRisk = evaluateDeadline(program.deadline, today);
  if (deadlineRisk) risks.push(deadlineRisk);

  // 서류 미비.
  if (program.requiredDocuments.length > 0) {
    risks.push({
      type: "서류미비",
      severity: "중간",
      message: `제출서류 ${program.requiredDocuments.length}종을 마감 전까지 준비해야 합니다.`,
      recommendation: `발급에 시간이 걸리는 서류(납세증명, 4대보험 등)를 먼저 준비하세요. 항목: ${program.requiredDocuments.join(", ")}`,
      evidence: findEvidence(program, "requiredDocuments")
    });
  } else if (program.missingFields.includes("requiredDocuments")) {
    risks.push({
      type: "서류미비",
      severity: "낮음",
      message: "공고문에서 제출서류 항목을 확인하지 못했습니다.",
      recommendation: "공고 원문 또는 첨부 양식에서 제출서류 목록을 직접 확인하세요."
    });
  }

  if ((program.additionalEligibilityConditions ?? []).length > 0) {
    risks.push({
      type: "정보부족",
      severity: "중간",
      message: `공고에 추가 자격조건 ${program.additionalEligibilityConditions?.length ?? 0}건이 있습니다.`,
      recommendation: `나이, 거주기간, 특정 분야 등 추가 조건을 증빙할 수 있는지 확인하세요. 항목: ${(
        program.additionalEligibilityConditions ?? []
      ).join(" / ")}`,
      evidence: findEvidence(program, "additionalEligibilityConditions")
    });
  }

  // 공통 확인 항목(놓치기 쉬운 결격).
  risks.push({
    type: "중복수혜가능",
    severity: "낮음",
    message: "동일 사업비·동일 목적의 정부지원금 중복 수혜는 제한될 수 있습니다.",
    recommendation: "기존 수혜 이력과 사업비 항목이 겹치지 않는지 확인하세요."
  });
  risks.push({
    type: "세금체납가능",
    severity: "낮음",
    message: "국세·지방세 체납이 있으면 대부분의 공고에서 신청이 제한됩니다.",
    recommendation: "신청 전 납세증명서로 완납 여부를 확인하세요."
  });

  // 정보 부족.
  const missingCount = profile.missingFields.length + program.missingFields.length;
  if (missingCount >= 4) {
    risks.push({
      type: "정보부족",
      severity: "중간",
      message: `판정에 필요한 정보가 부족합니다(사업자 ${profile.missingFields.length}건, 공고 ${program.missingFields.length}건 미확인).`,
      recommendation: "사업자 조건과 공고 요건을 보완한 뒤 다시 점검하세요."
    });
  }

  return { risks, disclaimer: STANDARD_DISCLAIMER };
}

function evaluateDeadline(deadline: string | null, today: string): ApplicationRisk | null {
  if (!deadline) return null;
  const remainingDays = daysBetween(today, deadline);
  if (remainingDays === null) return null;

  if (remainingDays < 0) {
    return {
      type: "마감임박",
      severity: "높음",
      message: `표시된 마감일(${deadline})이 이미 지났습니다.`,
      recommendation: "차기 공고 일정 또는 상시 접수 여부를 운영기관에 확인하세요."
    };
  }
  if (remainingDays <= 7) {
    return {
      type: "마감임박",
      severity: "높음",
      message: `마감까지 ${remainingDays}일 남았습니다(${deadline}).`,
      recommendation: "오늘 바로 필수 서류 발급과 신청서 작성을 시작하세요."
    };
  }
  if (remainingDays <= 14) {
    return {
      type: "마감임박",
      severity: "중간",
      message: `마감까지 ${remainingDays}일 남았습니다(${deadline}).`,
      recommendation: "서류 발급 일정을 역산해 이번 주 안에 준비를 시작하세요."
    };
  }
  return null;
}

function daysBetween(fromIso: string, toIso: string): number | null {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.round((to - from) / (1000 * 60 * 60 * 24));
}

function typeMatches(businessType: string, candidates: string[]): boolean {
  const target = normalize(businessType);
  return candidates.some((candidate) => {
    const c = normalize(candidate);
    return target === c || target.includes(c) || c.includes(target);
  });
}

function findEvidence(program: ProgramRequirements, field: string): string | undefined {
  return program.evidence.find((item) => item.field === field)?.text;
}
