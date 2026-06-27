import {
  STANDARD_DISCLAIMER,
  type ApplicationPlan,
  type BusinessProfile,
  type ProgramRequirements
} from "../types.js";
import { normalize } from "../text/lexicon.js";

/**
 * 신청 준비를 위한 서류, 준비 순서, 사업계획서 작성 방향, 다음 행동을 생성한다.
 * 공고에 명시된 제출서류·평가항목이 있으면 우선 반영한다.
 */
export function generateApplicationPlan(
  profile: BusinessProfile,
  program: ProgramRequirements
): ApplicationPlan {
  return {
    requiredDocuments: buildRequiredDocuments(profile, program),
    preparationOrder: buildPreparationOrder(profile, program),
    businessPlanDirection: buildBusinessPlanDirection(profile, program),
    nextActions: buildNextActions(profile, program),
    disclaimer: STANDARD_DISCLAIMER
  };
}

function buildRequiredDocuments(profile: BusinessProfile, program: ProgramRequirements): string[] {
  const documents = new Set<string>();

  // 공고에 명시된 서류를 최우선으로 반영.
  for (const doc of program.requiredDocuments) {
    documents.add(`${doc} (공고 명시)`);
  }

  // 공통 기본 서류.
  if (profile.isRegistered === false || profile.businessForm === "예비창업자") {
    documents.add("신분증 사본");
    documents.add("창업 예정 아이템 설명서 또는 사업 아이디어 요약");
  } else {
    documents.add("사업자등록증 사본");
    documents.add("대표자 신분증 사본");
    documents.add("국세·지방세 납세증명서(완납 확인용)");
    documents.add("최근 매출 증빙(부가세 과세표준증명 등)");
  }
  documents.add("사업계획서 또는 신청서");
  documents.add("개인정보 수집·이용 동의서");

  // 지원 목적별 추가 서류.
  const purpose = profile.fundingPurpose ?? "";
  const programText = normalizeProgramText(program);
  if (purpose.includes("운영자금") || programText.includes("정책자금") || programText.includes("대출")) {
    documents.add("자금 사용 계획서");
    documents.add("부채·금융거래 확인 자료");
  }
  if (purpose.includes("시설") || programText.includes("시설") || programText.includes("장비")) {
    documents.add("견적서 및 비교 견적");
  }
  if (purpose.includes("고용") || programText.includes("고용") || programText.includes("인력")) {
    documents.add("4대보험 가입자 명부");
  }
  if (programText.includes("연구개발") || programText.includes("기술") || programText.includes("사업화")) {
    documents.add("기술·시제품 관련 증빙(지식재산권, 시제품 사진 등)");
  }

  return [...documents];
}

function buildPreparationOrder(profile: BusinessProfile, program: ProgramRequirements): string[] {
  const steps: string[] = [];

  if (profile.missingFields.length > 0) {
    steps.push(`0단계: 미확인 사업자 정보(${profile.missingFields.join(", ")})를 먼저 정리한다.`);
  }

  steps.push("1단계: 공고 원문에서 신청 자격·제외 대상·마감일을 다시 확인한다.");
  for (const condition of program.additionalEligibilityConditions ?? []) {
    steps.push(`자격 확인: ${condition}`);
  }
  steps.push("2단계: 납세증명서·4대보험 등 발급에 시간이 걸리는 서류부터 신청한다.");
  steps.push("3단계: 지원 목적과 사용 금액을 항목별 예산표로 정리한다.");
  steps.push("4단계: 사업계획서에 문제·해결·실행 일정·기대효과를 연결해 작성한다.");
  steps.push("5단계: 서류 파일명·발급일자를 점검하고 마감 최소 1일 전 제출한다.");

  if (program.deadline) {
    steps.push(`마감 점검: 표시된 마감일(${program.deadline})이 공고 원문과 같은지 확인한다.`);
  }

  return steps;
}

function buildBusinessPlanDirection(profile: BusinessProfile, program: ProgramRequirements): string[] {
  const directions = new Set<string>();

  directions.add("현재 사업의 핵심 문제를 한 문장으로 정의하고 지원 필요성을 숫자로 설명한다.");
  directions.add("지원금 사용 항목·일정·기대 성과를 표로 정리한다.");
  directions.add("단정적 선정 표현 대신 실행 가능성과 근거 중심으로 작성한다.");

  // 공고 평가항목이 있으면 항목별 작성 방향을 제시.
  for (const criteria of program.evaluationCriteria) {
    directions.add(`평가항목 "${criteria}"에 대응하는 내용을 별도 문단으로 작성한다.`);
  }

  if (profile.fundingPurpose) {
    directions.add(`${profile.fundingPurpose} 목적에 맞춰 사용 전후 변화를 비교해 제시한다.`);
  }

  const programText = normalizeProgramText(program);
  if (programText.includes("마케팅") || programText.includes("판로") || programText.includes("브랜드")) {
    directions.add("고객군·채널·전환 목표·광고비 산출 근거를 구체화한다.");
  }
  if (programText.includes("디지털") || programText.includes("스마트") || programText.includes("자동화")) {
    directions.add("도입할 도구와 업무 절감 효과를 현재 프로세스와 비교해 설명한다.");
  }
  if (programText.includes("기술") || programText.includes("연구개발") || programText.includes("시제품")) {
    directions.add("기술 차별성·개발 일정·검증 방법·사업화 경로를 분리해 작성한다.");
  }

  return [...directions];
}

function buildNextActions(profile: BusinessProfile, program: ProgramRequirements): string[] {
  const actions: string[] = [];

  if (profile.missingFields.length > 0) {
    actions.push(`오늘: 미확인 정보(${profile.missingFields.join(", ")})를 확인한다.`);
  } else {
    actions.push("오늘: 공고 원문 링크를 열고 신청 자격 항목을 한 줄씩 대조한다.");
  }

  actions.push("오늘: 납세증명서 등 발급 시간이 필요한 서류를 신청한다.");
  for (const condition of program.additionalEligibilityConditions ?? []) {
    actions.push(`오늘: 추가 자격조건을 증빙할 수 있는지 확인한다 - ${condition}`);
  }
  actions.push("이번 주: 사업계획서 초안(문제·해결·예산·기대효과)을 작성한다.");
  actions.push("제출 전: 제외 업종·중복 수혜·세금 완납 여부를 최종 점검한다.");

  if (program.deadline) {
    actions.push(`마감 관리: ${program.deadline} 기준으로 역산해 제출 일정을 잡는다.`);
  }

  return actions;
}

function normalizeProgramText(program: ProgramRequirements): string {
  return normalize(
    [
      program.title ?? "",
      program.support ?? "",
      ...(program.additionalEligibilityConditions ?? []),
      ...program.targetBusinessTypes,
      ...program.evaluationCriteria,
      ...program.evidence.map((item) => item.text)
    ].join(" ")
  );
}
