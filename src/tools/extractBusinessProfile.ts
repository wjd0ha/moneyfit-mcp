import type { BusinessForm, BusinessProfile, BusinessProfileMissingField } from "../types.js";
import {
  BUSINESS_TYPE_RULES,
  PURPOSE_RULES,
  REGION_RULES,
  findOneByRules,
  normalize
} from "../text/lexicon.js";

const PRE_FOUNDER_KEYWORDS = [
  "예비창업",
  "창업준비",
  "창업예정",
  "사업자전",
  "사업자등록전",
  "아직사업자",
  "사업자없",
  "준비중"
];

const KEYWORD_CANDIDATES = [
  "소상공인",
  "자영업자",
  "예비창업",
  "초기창업",
  "청년",
  "여성기업",
  "재창업",
  "정책자금",
  "운영자금",
  "마케팅",
  "판로",
  "디지털",
  "스마트상점",
  "키오스크",
  "시설",
  "장비",
  "제조",
  "고용",
  "컨설팅",
  "수출"
];

/**
 * 사용자 자연어에서 사업자 유형, 등록 여부, 지역, 업력, 업종, 자금 목적을 추출한다.
 * 불명확한 항목은 추측하지 않고 missingFields에 담는다.
 */
export function extractBusinessProfile(freeText: string): BusinessProfile {
  const text = normalize(freeText);

  const { businessForm, isRegistered } = inferBusinessForm(text);
  const age = inferAge(text);
  const region = findOneByRules(text, REGION_RULES);
  const businessType = findOneByRules(text, BUSINESS_TYPE_RULES);
  const fundingPurpose = findOneByRules(text, PURPOSE_RULES);
  const yearsInBusiness = inferYears(text, isRegistered);
  const keywords = collectKeywords(text, [region, businessType, fundingPurpose]);

  const missingFields: BusinessProfileMissingField[] = [];
  if (!businessForm) missingFields.push("businessForm");
  if (isRegistered === null) missingFields.push("isRegistered");
  if (!region) missingFields.push("region");
  if (yearsInBusiness === null) missingFields.push("yearsInBusiness");
  if (!businessType) missingFields.push("businessType");
  if (!fundingPurpose) missingFields.push("fundingPurpose");

  return {
    businessForm,
    isRegistered,
    age,
    region,
    yearsInBusiness,
    businessType,
    fundingPurpose,
    keywords,
    missingFields,
    summary: buildSummary({
      businessForm,
      isRegistered,
      age,
      region,
      yearsInBusiness,
      businessType,
      fundingPurpose,
      missingFields
    })
  };
}

function inferAge(text: string): number | null {
  const ageMatch =
    text.match(/만(\d{1,2})세/) ??
    text.match(/나이(\d{1,2})/) ??
    text.match(/(\d{1,2})세/);

  if (!ageMatch) return null;
  const age = Number(ageMatch[1]);
  if (!Number.isFinite(age) || age < 14 || age > 100) return null;
  return age;
}

function inferBusinessForm(text: string): {
  businessForm: BusinessForm | null;
  isRegistered: boolean | null;
} {
  if (PRE_FOUNDER_KEYWORDS.some((keyword) => text.includes(normalize(keyword)))) {
    return { businessForm: "예비창업자", isRegistered: false };
  }

  if (["법인", "주식회사", "주식회사를", "유한회사", "(주)"].some((keyword) => text.includes(normalize(keyword)))) {
    return { businessForm: "법인", isRegistered: true };
  }

  if (["개인사업자", "개인사업", "자영업"].some((keyword) => text.includes(normalize(keyword)))) {
    return { businessForm: "개인사업자", isRegistered: true };
  }

  if (text.includes(normalize("소상공인"))) {
    return { businessForm: "소상공인", isRegistered: true };
  }

  // 등록 여부 단서는 있으나 형태가 불명확한 경우.
  if (["사업자등록", "사업자등록증", "운영중", "영업중", "년차", "매장운영", "가게운영"].some((keyword) =>
    text.includes(normalize(keyword))
  )) {
    return { businessForm: null, isRegistered: true };
  }

  return { businessForm: null, isRegistered: null };
}

function inferYears(text: string, isRegistered: boolean | null): number | null {
  if (isRegistered === false) {
    return 0;
  }

  const yearAndMonth = text.match(/(\d+(?:\.\d+)?)년(\d+)개월/);
  if (yearAndMonth) {
    return Number((Number(yearAndMonth[1]) + Number(yearAndMonth[2]) / 12).toFixed(1));
  }

  // "N년차" / "N년째" / "N년" 형태.
  const yearMatch = text.match(/(\d+(?:\.\d+)?)년/);
  if (yearMatch) {
    return Number(yearMatch[1]);
  }

  const monthMatch = text.match(/(\d+)개월/);
  if (monthMatch) {
    return Number((Number(monthMatch[1]) / 12).toFixed(1));
  }

  return null;
}

function collectKeywords(text: string, derived: Array<string | null>): string[] {
  const keywords = new Set<string>();
  for (const value of derived) {
    if (value) keywords.add(value);
  }
  for (const candidate of KEYWORD_CANDIDATES) {
    if (text.includes(normalize(candidate))) {
      keywords.add(candidate);
    }
  }
  return Array.from(keywords).slice(0, 16);
}

function buildSummary(input: Omit<BusinessProfile, "keywords" | "summary">): string {
  const years =
    input.yearsInBusiness === null
      ? "미확인"
      : input.yearsInBusiness === 0
        ? "예비 또는 1년 미만"
        : `${input.yearsInBusiness}년`;

  const registered =
    input.isRegistered === null ? "미확인" : input.isRegistered ? "사업자등록 있음" : "미등록(예비창업)";

  const parts = [
    `사업자 유형: ${input.businessForm ?? "미확인"}`,
    `등록 여부: ${registered}`,
    `나이: ${input.age === null || input.age === undefined ? "미확인" : `${input.age}세`}`,
    `지역: ${input.region ?? "미확인"}`,
    `업력: ${years}`,
    `업종: ${input.businessType ?? "미확인"}`,
    `자금 목적: ${input.fundingPurpose ?? "미확인"}`
  ];

  if (input.missingFields.length > 0) {
    parts.push(`추가 확인 필요: ${input.missingFields.join(", ")}`);
  }

  return parts.join(" / ");
}
