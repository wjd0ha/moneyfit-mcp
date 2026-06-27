import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { extractBusinessProfile } from "../src/tools/extractBusinessProfile.js";
import { findRelevantPrograms } from "../src/tools/findRelevantPrograms.js";
import { extractProgramRequirements } from "../src/tools/extractProgramRequirements.js";
import { checkEligibility } from "../src/tools/checkEligibility.js";
import { detectApplicationRisks } from "../src/tools/detectApplicationRisks.js";
import { generateApplicationPlan } from "../src/tools/generateApplicationPlan.js";
import { loadPrograms, clearProgramsCache } from "../src/data/loadPrograms.js";
import { STANDARD_DISCLAIMER, VERDICT_LABELS } from "../src/types.js";
import type { BusinessProfile, EligibilityVerdict, ProgramRequirements } from "../src/types.js";

const here = dirname(fileURLToPath(import.meta.url));

interface EligibilityCase {
  name: string;
  businessProfile: BusinessProfile;
  programRequirements: ProgramRequirements;
  expectedVerdict: EligibilityVerdict;
}

const cases = JSON.parse(readFileSync(resolve(here, "cases.json"), "utf8")) as EligibilityCase[];

describe("check_eligibility verdict cases", () => {
  it("loads at least 10 cases", () => {
    expect(cases.length).toBeGreaterThanOrEqual(10);
  });

  for (const testCase of cases) {
    it(`판정: ${testCase.name}`, () => {
      const result = checkEligibility(testCase.businessProfile, testCase.programRequirements);
      expect(result.verdict).toBe(testCase.expectedVerdict);

      // 하드 컷 결격이면 NOT_ELIGIBLE이어야 하고, 근거가 함께 제공되어야 한다.
      if (result.hardBlockers.length > 0) {
        expect(result.verdict).toBe("NOT_ELIGIBLE");
        expect(result.hardBlockers.every((blocker) => blocker.reason.length > 0)).toBe(true);
      }
      // INSUFFICIENT_INFO는 missingFields가 비어 있으면 안 된다(추측 금지 원칙).
      if (result.verdict === "INSUFFICIENT_INFO") {
        expect(result.missingFields.length).toBeGreaterThan(0);
      }
    });
  }
});

describe("extract_business_profile", () => {
  it("등록 사업자 자연어에서 유형·업력·지역을 추출하고 추측하지 않는다", () => {
    const profile = extractBusinessProfile("서울 성수에서 카페를 2년째 운영 중인 개인사업자입니다. 키오스크 도입하고 싶어요.");
    expect(profile.region).toBe("서울");
    expect(profile.businessType).toBe("음식점/카페");
    expect(profile.businessForm).toBe("개인사업자");
    expect(profile.isRegistered).toBe(true);
    expect(profile.yearsInBusiness).toBe(2);
    expect(profile.fundingPurpose).toBe("디지털 전환");
    expect(profile.missingFields).not.toContain("region");
  });

  it("예비창업자는 미등록·업력 0으로 처리한다", () => {
    const profile = extractBusinessProfile("만 41세이고 아직 사업자등록 전이고 카페 창업을 준비 중이에요.");
    expect(profile.businessForm).toBe("예비창업자");
    expect(profile.isRegistered).toBe(false);
    expect(profile.age).toBe(41);
    expect(profile.yearsInBusiness).toBe(0);
  });

  it("정보가 없으면 missingFields에 담는다", () => {
    const profile = extractBusinessProfile("지원사업 알아보고 있어요.");
    expect(profile.missingFields).toContain("region");
    expect(profile.missingFields).toContain("businessType");
  });
});

describe("extract_program_requirements", () => {
  const notice = [
    "서울 소상공인 AI 활용 바우처 지원 공고",
    "주관: 서울경제진흥원",
    "신청대상: 서울특별시 소재 소상공인 및 개인사업자",
    "업력 1년 이상 사업자에 한함",
    "유흥·사행성 업종은 지원 제외",
    "지원내용: AI 도구 도입비 최대 500만원",
    "접수마감: 2026-08-29",
    "제출서류: 사업자등록증, 납세증명서, 매출 증빙",
    "평가항목: AI 활용 적합성, 기대효과"
  ].join("\n");

  it("공고문에서 지역·업력·제외업종·마감일을 구조화한다", () => {
    const program = extractProgramRequirements(notice);
    expect(program.regions).toContain("서울");
    expect(program.minYearsInBusiness).toBe(1);
    expect(program.excludedBusinessTypes).toContain("유흥/사행성");
    expect(program.eligibleBusinessForms).toContain("소상공인");
    expect(program.deadline).toBe("2026-08-29");
  });

  it("추출 항목마다 원문 근거를 evidence에 남긴다", () => {
    const program = extractProgramRequirements(notice);
    expect(program.evidence.length).toBeGreaterThan(0);
    expect(program.evidence.every((item) => item.text.length > 0)).toBe(true);
  });

  it("기업마당 예비창업자 전용 공고에서 거주기간을 업력으로 오인하지 않는다", () => {
    const noticeText = [
      "지원사업 공고",
      "사업수행기관: 경기도시장상권진흥원",
      "신청기간: 모집 완료시",
      "경기도와 경기도시장상권진흥원에서는 「2026년 생애 최초 경영안정화 교육지원」 사업 모집공고를 진행합니다.",
      "☞ 공고일 기준 경기도 1년 이상 거주하였으며, 도내 창업을 희망하는 만 40세 이상 중장년인 자",
      "- 국세청(세무서) 사업자등록(법인ㆍ일반ㆍ간이 등) 등록 이력이 없는 자(예비창업자)",
      "☞ 창업 교육, 전문가 컨설팅, 우수창업가 사업화지원(최대 1천만원 이내), 홍보마케팅, 창업자금 이자비 지원"
    ].join("\n");

    const program = extractProgramRequirements(noticeText);
    expect(program.title).toContain("생애 최초 경영안정화 교육지원");
    expect(program.organization).toBe("경기도시장상권진흥원");
    expect(program.regions).toContain("경기");
    expect(program.eligibleBusinessForms).toEqual(["예비창업자"]);
    expect(program.minYearsInBusiness).toBeNull();
    expect(program.maxYearsInBusiness).toBe(0);
    expect(program.additionalEligibilityConditions ?? []).toEqual(
      expect.arrayContaining([
        expect.stringContaining("경기도 1년 이상 거주"),
        expect.stringContaining("만 40세 이상")
      ])
    );
  });

  it("기업마당 창업 공모 공고에서 7년 이내 창업자와 신산업 예외 조건을 분리한다", () => {
    const noticeText = [
      "지원사업 공고",
      "사업수행기관: 경기도경제과학진흥원",
      "신청기간: 2026.06.08 ~ 2026.06.30",
      "2026 경기 창업 공모「G스타 오디션」“도약리그” 참가자를 모집합니다.",
      "☞ 공고일 기준 경기도 거주 예비 창업가 및 경기도 소재 7년 이내(신산업분야 10년 이내) 창업자",
      "- 참가분야 : AI, ICT, 반도체, 모빌리티, 친환경ㆍ에너지, 로봇, 바이오ㆍ헬스 등 기술ㆍ지식ㆍ신산업 사업화 아이템",
      "☞ 총 상금 5천만원 시상 및 상장 수여, 결선참가자 대상 역량강화 프로그램 지원"
    ].join("\n");

    const program = extractProgramRequirements(noticeText);
    expect(program.title).toContain("G스타 오디션");
    expect(program.regions).toContain("경기");
    expect(program.eligibleBusinessForms).toEqual(expect.arrayContaining(["예비창업자", "개인사업자", "법인"]));
    expect(program.maxYearsInBusiness).toBe(7);
    expect(program.deadline).toBe("2026-06-30");
    expect(program.targetBusinessTypes).toEqual(expect.arrayContaining(["IT/소프트웨어", "제조업"]));
    expect(program.additionalEligibilityConditions ?? []).toEqual(
      expect.arrayContaining([
        expect.stringContaining("경기도 거주"),
        expect.stringContaining("신산업분야 10년 이내"),
        expect.stringContaining("참가분야")
      ])
    );
  });

  it("기업마당 기초지자체 청년 창업 공고에서 화성시와 나이 조건을 보존한다", () => {
    const noticeText = [
      "지원사업 공고",
      "사업수행기관: 기초자치단체",
      "신청기간: 2026.04.06 ~ 2026.06.30",
      "화성시에서는 「2026년 화성시 청년 창업 컨설팅 지원」 사업 대상자를 모집합니다.",
      "☞ 신청일 현재 화성시에 거주하는 19~39세 관내 (예비)창업 청년",
      "☞ 창업 전문 컨설턴트 1:1 매칭하여 2회 컨설팅 진행"
    ].join("\n");

    const program = extractProgramRequirements(noticeText);
    expect(program.title).toContain("화성시 청년 창업 컨설팅 지원");
    expect(program.regions).toContain("화성");
    expect(program.eligibleBusinessForms).toEqual(expect.arrayContaining(["예비창업자", "개인사업자", "법인"]));
    expect(program.deadline).toBe("2026-06-30");
    expect(program.additionalEligibilityConditions ?? []).toEqual(
      expect.arrayContaining([
        expect.stringContaining("화성시에 거주"),
        expect.stringContaining("19~39세")
      ])
    );
  });

  it("데이터바우처 공고에서 바우처형 제출서류와 연도 생략 마감일을 구조화한다", () => {
    const noticeText = [
      "2026년 데이터바우처 지원사업 수요기업 모집 공고",
      "전담기관: 한국데이터산업진흥원",
      "지원대상: 중소기업, 소상공인, 예비창업자, 공공기관, 연구기관, 대학연구팀 등",
      "지원내용: 데이터 구매·가공·분석 바우처 지원, 일반부문 최대 4,500만원, 공개·활용부문 최대 7,500만원",
      "신청기간: 2026.02.27 ~ 03.31 18:00",
      "신청 전 공급기업과 과제협의 및 견적서 준비 필요",
      "민간부담금 부담 여부 확인 필요",
      "제출서류: 사업수행계획서, 발표자료, 과제협의서, 견적서, 납세증명서, 중소기업확인서",
      "평가기준: 과제 목표의 타당성, 추진계획의 구체성 및 실현가능성, 활용성 및 시장성, 성장성"
    ].join("\n");

    const program = extractProgramRequirements(noticeText);
    expect(program.title).toContain("데이터바우처");
    expect(program.organization).toBe("한국데이터산업진흥원");
    expect(program.eligibleBusinessForms).toEqual(
      expect.arrayContaining(["예비창업자", "법인", "소상공인", "기타"])
    );
    expect(program.targetBusinessTypes).toContain("IT/소프트웨어");
    expect(program.deadline).toBe("2026-03-31");
    expect(program.requiredDocuments).toEqual(expect.arrayContaining(["사업수행계획서", "견적서"]));
    expect(program.additionalEligibilityConditions ?? []).toEqual(
      expect.arrayContaining([
        expect.stringContaining("과제협의"),
        expect.stringContaining("민간부담금")
      ])
    );
  });

  it("스마트상점 공고에서 정상 영업 조건과 연도 생략 마감일을 구조화한다", () => {
    const noticeText = [
      "2026년 스마트상점 기술보급사업 참여 소상공인 모집공고",
      "사업수행기관: 소상공인시장진흥공단",
      "지원대상: 소상공인기본법 제2조에 따른 소상공인으로 신청일 현재 정상적으로 영업 중인 점포",
      "지원내용: 배리어프리 키오스크, 서빙로봇, 사이니지, 경영지원 S/W 등 스마트기술 도입 지원",
      "신청기간: 2026년 3월 13일 10시 ~ 4월 1일 17시까지",
      "대표자 본인이 신청해야 하며 대리신청은 제한",
      "지원제외: 소상공인 지원제외 업종, 비영리사업자, 신청일 기준 현재 사업장을 영업하지 않는 경우, 세금체납",
      "제출서류: 소상공인확인서, 사업자등록증명원, 건강보험자격득실확인서",
      "평가항목: 도입필요성 및 추진의지, 실행가능성 및 운영역량, 사업이해도 및 참여적정성, 기술적합성"
    ].join("\n");

    const program = extractProgramRequirements(noticeText);
    expect(program.title).toContain("스마트상점");
    expect(program.organization).toBe("소상공인시장진흥공단");
    expect(program.eligibleBusinessForms).toContain("소상공인");
    expect(program.deadline).toBe("2026-04-01");
    expect(program.requiredDocuments).toEqual(expect.arrayContaining(["소상공인확인서", "사업자등록증명원"]));
    expect(program.additionalEligibilityConditions ?? []).toEqual(
      expect.arrayContaining([
        expect.stringContaining("정상적으로 영업"),
        expect.stringContaining("대표자 본인")
      ])
    );
  });
});

describe("find_relevant_programs", () => {
  it("일반 사장님 질문 흐름에 맞춰 로컬 DB에서 검토 후보를 찾는다", async () => {
    clearProgramsCache();
    const profile: BusinessProfile = {
      businessForm: "예비창업자",
      isRegistered: false,
      age: 41,
      region: "경기",
      yearsInBusiness: 0,
      businessType: "음식점/카페",
      fundingPurpose: "창업자금",
      keywords: ["카페", "창업"],
      missingFields: [],
      summary: "경기도에서 카페 창업을 준비 중인 예비창업자"
    };

    const result = await findRelevantPrograms(profile, "2026-06-27");
    expect(result.programs.length).toBeGreaterThan(0);
    expect(result.programs[0].rank).toBe(1);
    expect(result.programs[0].title).toContain("생애 최초");
    expect(result.answerMarkdown).toContain("현재 정보 기준");
    expect(result.answerMarkdown).toContain("생애 최초");
    expect(result.missingFields).toEqual([]);
    expect(result.followUpQuestions).toEqual([]);
    expect(result.programs[0].matchedReasons.length).toBeGreaterThan(0);
    expect(result.programs[0].matchedReasons.some((reason) => reason.includes("41세"))).toBe(true);
    expect(result.programs[0].nextAction).not.toContain("선정");
  });

  it("업종과 목적이 비어도 유용한 후보가 있으면 먼저 보여주고 보완 질문은 별도로 제공한다", async () => {
    clearProgramsCache();
    const profile: BusinessProfile = {
      businessForm: "예비창업자",
      isRegistered: false,
      age: 41,
      region: "경기",
      yearsInBusiness: 0,
      businessType: null,
      fundingPurpose: null,
      keywords: ["경기", "예비창업"],
      missingFields: ["businessType", "fundingPurpose"],
      summary: "만 41세 경기도 예비창업자"
    };

    const result = await findRelevantPrograms(profile, "2026-06-28");
    expect(result.programs[0].title).toContain("생애 최초");
    expect(result.missingFields).toEqual([]);
    expect(result.followUpQuestions).toEqual(expect.arrayContaining(["창업하려는 업종", "필요한 지원 목적"]));
    expect(result.answerMarkdown).toContain("더 정확히 좁히려면");
  });
});

describe("age eligibility", () => {
  it("입력된 나이로 만 40세 이상 조건을 직접 판단한다", () => {
    const profile: BusinessProfile = {
      businessForm: "예비창업자",
      isRegistered: false,
      age: 41,
      region: "경기",
      yearsInBusiness: 0,
      businessType: "음식점/카페",
      fundingPurpose: "창업자금",
      keywords: [],
      missingFields: [],
      summary: ""
    };
    const program: ProgramRequirements = {
      title: "경기 중장년 예비창업",
      organization: "샘플기관",
      regions: ["경기"],
      eligibleBusinessForms: ["예비창업자"],
      targetBusinessTypes: [],
      excludedBusinessTypes: [],
      minYearsInBusiness: null,
      maxYearsInBusiness: 0,
      support: null,
      additionalEligibilityConditions: ["만 40세 이상 여부 확인 필요"],
      deadline: null,
      requiredDocuments: [],
      evaluationCriteria: [],
      evidence: [],
      missingFields: []
    };

    const result = checkEligibility(profile, program);
    expect(result.hardBlockers).toHaveLength(0);
    expect(result.matchedConditions.some((condition) => condition.field === "age")).toBe(true);
    expect(result.conditionalNotes.some((condition) => condition.reason.includes("만 40세"))).toBe(false);
  });
});

describe("detect_application_risks", () => {
  const profile: BusinessProfile = {
    businessForm: "법인",
    isRegistered: true,
    region: "부산",
    yearsInBusiness: 10,
    businessType: "IT/소프트웨어",
    fundingPurpose: "R&D/사업화",
    keywords: [],
    missingFields: [],
    summary: ""
  };
  const program: ProgramRequirements = {
    title: "대전 기술창업 R&D",
    organization: "샘플기관",
    regions: ["대전"],
    eligibleBusinessForms: ["법인"],
    targetBusinessTypes: ["IT/소프트웨어"],
    excludedBusinessTypes: [],
    minYearsInBusiness: 0,
    maxYearsInBusiness: 7,
    support: null,
    deadline: "2026-07-05",
    requiredDocuments: ["사업자등록증"],
    evaluationCriteria: [],
    evidence: [],
    missingFields: []
  };

  it("업력 초과·지역 불일치·마감 임박을 위험으로 탐지한다", () => {
    const report = detectApplicationRisks(profile, program, "2026-07-01");
    const types = report.risks.map((risk) => risk.type);
    expect(types).toContain("업력초과");
    expect(types).toContain("지역불일치");
    expect(types).toContain("마감임박");
    // 공통 확인 항목도 항상 포함한다.
    expect(types).toContain("세금체납가능");
  });
});

describe("generate_application_plan", () => {
  it("공고 제출서류·평가항목을 반영하고 다음 행동을 만든다", () => {
    const profile: BusinessProfile = {
      businessForm: "소상공인",
      isRegistered: true,
      region: "서울",
      yearsInBusiness: 2,
      businessType: "음식점/카페",
      fundingPurpose: "디지털 전환",
      keywords: [],
      missingFields: [],
      summary: ""
    };
    const program: ProgramRequirements = {
      title: "서울 소상공인 AI 바우처",
      organization: "샘플기관",
      regions: ["서울"],
      eligibleBusinessForms: ["소상공인"],
      targetBusinessTypes: ["음식점/카페"],
      excludedBusinessTypes: [],
      minYearsInBusiness: 1,
      maxYearsInBusiness: null,
      support: "최대 500만원",
      deadline: "2026-08-29",
      requiredDocuments: ["AI 도입 계획서"],
      evaluationCriteria: ["AI 활용 적합성"],
      evidence: [],
      missingFields: []
    };
    const plan = generateApplicationPlan(profile, program);
    expect(plan.requiredDocuments.some((doc) => doc.includes("AI 도입 계획서"))).toBe(true);
    expect(plan.businessPlanDirection.some((line) => line.includes("AI 활용 적합성"))).toBe(true);
    expect(plan.nextActions.length).toBeGreaterThan(0);
  });
});

describe("data/programs.json", () => {
  it("모든 큐레이션 공고는 sample:true이며 필수 구조화 필드를 갖춘다", async () => {
    clearProgramsCache();
    const programs = await loadPrograms();
    expect(programs.length).toBeGreaterThan(0);
    expect(programs.every((program) => program.sample === true)).toBe(true);
    expect(programs.every((program) => program.sourceUrl.length > 0)).toBe(true);
    expect(programs.every((program) => Array.isArray(program.evidence))).toBe(true);
  });
});

describe("응답 표현 정책", () => {
  it("판정 라벨과 안내 문구에 선정·합격·수령 보장 표현을 쓰지 않는다", () => {
    const banned = ["선정 가능", "합격", "지원금 받을 수 있", "수령 보장", "무조건"];
    const text = [STANDARD_DISCLAIMER, ...Object.values(VERDICT_LABELS)].join(" ");
    for (const phrase of banned) {
      expect(text).not.toContain(phrase);
    }
  });
});
