// 사장님 머니핏(MoneyFit) MCP — 공고 판독 + 신청 가능성 체크 도메인 타입.
// 추천기(검색/점수화) 모델은 제거하고, 공고 요건과 사업자 조건을 구조화 필드로 비교한다.

export type BusinessForm = "예비창업자" | "개인사업자" | "법인" | "소상공인" | "기타";

export type BusinessProfileMissingField =
  | "businessForm"
  | "isRegistered"
  | "region"
  | "yearsInBusiness"
  | "businessType"
  | "fundingPurpose";

export interface BusinessProfile {
  /** 사업자 유형. 불명확하면 null. */
  businessForm: BusinessForm | null;
  /** 사업자등록 여부. 불명확하면 null(추측 금지). */
  isRegistered: boolean | null;
  /** 대표자/신청자 나이. 공고 연령 조건이 있을 때만 활용한다. */
  age?: number | null;
  region: string | null;
  /** 업력(년). 예비창업/미등록은 0. 불명확하면 null. */
  yearsInBusiness: number | null;
  businessType: string | null;
  /** 자금/지원 목적. */
  fundingPurpose: string | null;
  keywords: string[];
  missingFields: BusinessProfileMissingField[];
  summary: string;
}

/** 공고문에서 추출한 각 요건의 원문 근거 문장. */
export interface RequirementEvidence {
  field: string;
  text: string;
}

export interface ProgramRequirements {
  title: string | null;
  organization: string | null;
  /** 신청 가능 지역. "전국"이면 지역 제한 없음. */
  regions: string[];
  /** 신청 가능한 사업자 유형. 비어 있으면 공고에서 확인 불가. */
  eligibleBusinessForms: BusinessForm[];
  /** 신청 대상 업종. */
  targetBusinessTypes: string[];
  /** 신청 제외 업종. */
  excludedBusinessTypes: string[];
  minYearsInBusiness: number | null;
  maxYearsInBusiness: number | null;
  support: string | null;
  /** 나이, 거주기간, 특정 분야 등 현재 사업자 프로필 모델로 단정 판정하지 않는 추가 자격조건. */
  additionalEligibilityConditions?: string[];
  /** 마감일(YYYY-MM-DD). 불명확하면 null. */
  deadline: string | null;
  requiredDocuments: string[];
  evaluationCriteria: string[];
  evidence: RequirementEvidence[];
  /** 공고문에서 추출하지 못한 핵심 항목. */
  missingFields: string[];
  /** 샘플 데이터 표시. */
  sample?: boolean;
}

/**
 * data/programs.json의 큐레이션된 공고 항목.
 * ProgramRequirements(비교용 구조화 필드)에 출처 메타(sourceUrl, sourceDate, target)를 더한 형태.
 */
export interface CuratedProgram extends ProgramRequirements {
  sourceUrl: string;
  sourceDate: string;
  /** 신청대상 원문 요약. */
  target: string;
}

/** 신청 가능성 4단계 판정. 이 외 값은 사용하지 않는다. */
export type EligibilityVerdict =
  | "HIGHLY_LIKELY"
  | "CONDITIONAL"
  | "INSUFFICIENT_INFO"
  | "NOT_ELIGIBLE";

/** 점수보다 우선하는 하드 컷 결격 사유. */
export interface HardBlocker {
  field: string;
  reason: string;
  evidence?: string;
}

export interface MatchedCondition {
  field: string;
  reason: string;
}

export interface ConditionalNote {
  field: string;
  reason: string;
}

export interface EligibilityResult {
  verdict: EligibilityVerdict;
  /** 사용자 노출용 한국어 라벨(선정/합격 표현 금지). */
  verdictLabel: string;
  hardBlockers: HardBlocker[];
  /** 판정에 필요하지만 비어 있는 항목(추측 금지). */
  missingFields: string[];
  matchedConditions: MatchedCondition[];
  conditionalNotes: ConditionalNote[];
  summary: string;
  disclaimer: string;
}

export type RiskType =
  | "업력초과"
  | "지역불일치"
  | "제외업종"
  | "중복수혜가능"
  | "세금체납가능"
  | "서류미비"
  | "마감임박"
  | "정보부족";

export type RiskSeverity = "높음" | "중간" | "낮음";

export interface ApplicationRisk {
  type: RiskType;
  severity: RiskSeverity;
  message: string;
  recommendation: string;
  evidence?: string;
}

export interface RiskReport {
  risks: ApplicationRisk[];
  disclaimer: string;
}

export interface ApplicationPlan {
  requiredDocuments: string[];
  preparationOrder: string[];
  businessPlanDirection: string[];
  nextActions: string[];
  disclaimer: string;
}

/** 모든 판정/계획 응답 하단에 붙는 고정 안내 문구. */
export const STANDARD_DISCLAIMER =
  "이 결과는 입력한 정보와 공고문 기준의 사전 판단입니다. 최종 신청 가능 여부는 공고 원문과 운영기관 확인을 기준으로 판단하세요.";

export const VERDICT_LABELS: Record<EligibilityVerdict, string> = {
  HIGHLY_LIKELY: "신청 검토 가능 (현재 정보 기준 결격사유 없음)",
  CONDITIONAL: "조건 확인 필요",
  INSUFFICIENT_INFO: "현재 정보로 판단 불가",
  NOT_ELIGIBLE: "신청 부적합 가능성 높음"
};
