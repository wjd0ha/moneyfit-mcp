import type { BusinessForm, ProgramRequirements, RequirementEvidence } from "../types.js";
import {
  BUSINESS_TYPE_RULES,
  COMMON_EXCLUDED_TYPE_RULES,
  REGION_RULES,
  findAllByRules,
  normalize
} from "../text/lexicon.js";

const BUSINESS_FORM_KEYWORDS: Array<{ value: BusinessForm; aliases: string[] }> = [
  { value: "예비창업자", aliases: ["예비창업자", "예비창업", "창업예정자", "창업준비자"] },
  { value: "개인사업자", aliases: ["개인사업자", "개인 사업자"] },
  { value: "법인", aliases: ["법인", "법인사업자", "중소기업"] },
  { value: "소상공인", aliases: ["소상공인", "자영업자"] },
  { value: "기타", aliases: ["공공기관", "연구기관", "대학연구팀", "의료기관"] }
];

const EXCLUSION_MARKERS = ["제외", "지원제외", "신청제외", "불가", "지원불가"];

/**
 * 공고문 텍스트에서 신청대상, 지역, 업력, 사업자 유형, 제외 업종, 지원내용, 마감일,
 * 제출서류, 평가항목을 구조화 필드로 추출하고 원문 근거를 evidence에 담는다.
 */
export function extractProgramRequirements(noticeText: string): ProgramRequirements {
  const lines = splitLines(noticeText);
  const normalizedFull = normalize(noticeText);
  const evidence: RequirementEvidence[] = [];
  const addEvidence = (field: string, text: string | null) => {
    if (text) evidence.push({ field, text: text.trim() });
  };

  const title = extractTitle(lines, noticeText);
  addEvidence("title", title);

  const organizationLine = findLine(lines, ["사업수행기관", "주관", "운영기관", "주최", "시행기관", "전담기관", "기관"]);
  const organization = organizationLine ? valueAfterLabel(organizationLine) : null;
  addEvidence("organization", organizationLine);

  const { regions, regionEvidence } = extractRegions(normalizedFull, lines);
  addEvidence("regions", regionEvidence);

  const eligibleBusinessForms = extractBusinessForms(normalizedFull);
  addEvidence("eligibleBusinessForms", findLine(lines, ["신청대상", "지원대상", "대상", "신청자격"]));

  const { targetBusinessTypes, excludedBusinessTypes, exclusionEvidence } = extractBusinessTypes(
    normalizedFull,
    lines
  );
  if (exclusionEvidence) addEvidence("excludedBusinessTypes", exclusionEvidence);

  const { minYearsInBusiness, maxYearsInBusiness, yearsEvidence } = extractYears(lines, normalizedFull);
  if (yearsEvidence) addEvidence("yearsInBusiness", yearsEvidence);

  const supportLine = findSupportLine(lines);
  const support = supportLine ? valueAfterLabel(supportLine) : null;
  addEvidence("support", supportLine);

  const { additionalEligibilityConditions, additionalEvidence } = extractAdditionalEligibilityConditions(lines);
  if (additionalEvidence) addEvidence("additionalEligibilityConditions", additionalEvidence);

  const { deadline, deadlineEvidence } = extractDeadline(lines, noticeText);
  if (deadlineEvidence) addEvidence("deadline", deadlineEvidence);

  const requiredDocuments = extractListField(lines, ["제출서류", "구비서류", "신청서류", "필요서류"]);
  if (requiredDocuments.length > 0) {
    addEvidence("requiredDocuments", findLine(lines, ["제출서류", "구비서류", "신청서류", "필요서류"]));
  }

  const evaluationCriteria = extractListField(lines, ["평가항목", "심사기준", "평가기준", "배점", "심사항목"]);
  if (evaluationCriteria.length > 0) {
    addEvidence("evaluationCriteria", findLine(lines, ["평가항목", "심사기준", "평가기준", "배점", "심사항목"]));
  }

  const missingFields: string[] = [];
  if (!title) missingFields.push("title");
  if (!organization) missingFields.push("organization");
  if (regions.length === 0) missingFields.push("regions");
  if (eligibleBusinessForms.length === 0) missingFields.push("eligibleBusinessForms");
  if (targetBusinessTypes.length === 0 && excludedBusinessTypes.length === 0)
    missingFields.push("businessTypes");
  if (minYearsInBusiness === null && maxYearsInBusiness === null) missingFields.push("yearsInBusiness");
  if (!deadline) missingFields.push("deadline");
  if (requiredDocuments.length === 0) missingFields.push("requiredDocuments");
  if (evaluationCriteria.length === 0) missingFields.push("evaluationCriteria");

  return {
    title,
    organization,
    regions,
    eligibleBusinessForms,
    targetBusinessTypes,
    excludedBusinessTypes,
    minYearsInBusiness,
    maxYearsInBusiness,
    support,
    additionalEligibilityConditions,
    deadline,
    requiredDocuments,
    evaluationCriteria,
    evidence,
    missingFields
  };
}

function splitLines(text: string): string[] {
  return text
    .split(/[\r\n]+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function extractTitle(lines: string[], fullText: string): string | null {
  const labelled = findLine(lines, ["사업명", "공고명", "사업공고명", "지원사업명"]);
  if (labelled) {
    const value = valueAfterLabel(labelled);
    if (value && !isGenericTitle(value)) return value;
  }

  const first = lines[0] ?? null;
  if (first && !isGenericTitle(first)) return first;

  const bracketed = [...fullText.matchAll(/[「『](.{4,90}?)[」』]/g)]
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value));
  const titleLike = bracketed.find((value) =>
    /(지원|사업|공모|오디션|교육|컨설팅|창업)/.test(value)
  );
  if (titleLike) return titleLike;

  // 라벨이 없으면 첫 줄을 제목 후보로 사용(공고문 관행).
  return first;
}

function isGenericTitle(value: string): boolean {
  const n = normalize(value);
  return ["지원사업공고", "사업공고", "공고", "상세", "지원사업"].includes(n);
}

function findLine(lines: string[], labelAliases: string[]): string | null {
  const normalizedAliases = labelAliases.map(normalize);
  for (const line of lines) {
    const normalizedLine = normalize(line);
    if (normalizedAliases.some((alias) => normalizedLine.includes(alias))) {
      return line;
    }
  }
  return null;
}

function valueAfterLabel(line: string): string {
  const separatorMatch = line.match(/[:：\-–]\s*(.+)$/);
  if (separatorMatch) {
    return separatorMatch[1].trim();
  }
  return line.trim();
}

function extractRegions(
  normalizedFull: string,
  lines: string[]
): { regions: string[]; regionEvidence: string | null } {
  if (normalizedFull.includes("전국")) {
    return { regions: ["전국"], regionEvidence: findLine(lines, ["전국", "지역", "신청대상", "지원대상"]) };
  }
  const regions = findAllByRules(normalizedFull, REGION_RULES);
  const evidence = regions.length > 0 ? findLine(lines, [regions[0], "지역", "소재", "신청대상"]) : null;
  return { regions, regionEvidence: evidence };
}

function extractBusinessForms(normalizedFull: string): BusinessForm[] {
  if (hasNoBusinessRegistrationHistory(normalizedFull) && normalizedFull.includes(normalize("예비창업"))) {
    return ["예비창업자"];
  }

  const forms: BusinessForm[] = [];
  for (const entry of BUSINESS_FORM_KEYWORDS) {
    if (entry.aliases.some((alias) => normalizedFull.includes(normalize(alias)))) {
      forms.push(entry.value);
    }
  }

  if (
    ["창업기업", "기창업자", "창업자", "창업가", "창업청년"].some((keyword) =>
      normalizedFull.includes(normalize(keyword))
    ) &&
    !hasNoBusinessRegistrationHistory(normalizedFull)
  ) {
    forms.push("개인사업자", "법인");
  }

  return Array.from(new Set(forms));
}

function extractBusinessTypes(
  normalizedFull: string,
  lines: string[]
): { targetBusinessTypes: string[]; excludedBusinessTypes: string[]; exclusionEvidence: string | null } {
  const exclusionLines = lines.filter((line) => {
    const normalizedLine = normalize(line);
    return EXCLUSION_MARKERS.some((marker) => normalizedLine.includes(marker));
  });
  const normalizedExclusion = exclusionLines.map(normalize).join(" ");

  const excludedFromLines = findAllByRules(normalizedExclusion, BUSINESS_TYPE_RULES);
  const excludedCommon = findAllByRules(normalizedFull, COMMON_EXCLUDED_TYPE_RULES);
  const excludedBusinessTypes = Array.from(new Set([...excludedFromLines, ...excludedCommon]));

  // 전체 텍스트에서 잡힌 업종 중 제외 목록에 든 것은 대상에서 뺀다.
  const allTypes = findAllByRules(normalizedFull, BUSINESS_TYPE_RULES);
  const targetBusinessTypes = allTypes.filter((type) => !excludedFromLines.includes(type));

  const exclusionEvidence = exclusionLines.length > 0 ? exclusionLines[0] : null;
  return { targetBusinessTypes, excludedBusinessTypes, exclusionEvidence };
}

function extractYears(
  lines: string[],
  normalizedFull: string
): { minYearsInBusiness: number | null; maxYearsInBusiness: number | null; yearsEvidence: string | null } {
  if (["업력제한없음", "업력무관", "업력관계없이"].some((token) => normalizedFull.includes(token))) {
    return { minYearsInBusiness: null, maxYearsInBusiness: null, yearsEvidence: findLine(lines, ["업력"]) };
  }

  let min: number | null = null;
  let max: number | null = null;
  let evidence: string | null = null;

  if (hasNoBusinessRegistrationHistory(normalizedFull)) {
    max = 0;
    evidence = findLine(lines, ["사업자등록", "등록 이력", "등록이력", "예비창업"]);
  }

  for (const line of lines) {
    const n = normalize(line);
    if (!hasBusinessYearContext(n)) continue;

    const minMatch = n.match(/업력(\d+(?:\.\d+)?)년이상/) ?? n.match(/(\d+(?:\.\d+)?)년이상/);
    const maxMatch =
      n.match(/(\d+(?:\.\d+)?)년이하/) ??
      n.match(/(\d+(?:\.\d+)?)년이내/) ??
      n.match(/(\d+(?:\.\d+)?)년미만/) ??
      n.match(/창업(\d+(?:\.\d+)?)년/);

    if (minMatch && (n.includes("업력") || n.includes("이상")) && !isResidenceOnlyMinimum(n)) {
      min = Number(minMatch[1]);
      evidence ??= line;
    }
    if (maxMatch && (n.includes("이하") || n.includes("이내") || n.includes("미만") || n.includes("창업"))) {
      max = Number(maxMatch[1]);
      evidence ??= line;
    }
  }

  return { minYearsInBusiness: min, maxYearsInBusiness: max, yearsEvidence: evidence };
}

function hasBusinessYearContext(normalizedLine: string): boolean {
  return ["업력", "창업", "사업자등록", "기업", "영위"].some((token) => normalizedLine.includes(token));
}

function hasNoBusinessRegistrationHistory(normalizedText: string): boolean {
  return (
    (normalizedText.includes("사업자등록") &&
      (normalizedText.includes("등록이력이없는") ||
        normalizedText.includes("등록이력없는") ||
        normalizedText.includes("등록한사실이없") ||
        normalizedText.includes("사업자등록전"))) ||
    normalizedText.includes("미등록예비창업")
  );
}

function isResidenceOnlyMinimum(normalizedLine: string): boolean {
  return normalizedLine.includes("거주") && !normalizedLine.includes("업력");
}

function findSupportLine(lines: string[]): string | null {
  const labelled = findLine(lines, ["지원내용", "지원규모", "지원금", "지원한도", "지원사항"]);
  if (labelled) return labelled;

  return (
    lines.find((line) => {
      const n = normalize(line);
      return (
        n.includes("☞") &&
        ["지원", "상금", "컨설팅", "교육", "사업화", "자금"].some((keyword) => n.includes(normalize(keyword))) &&
        !["신청대상", "지원대상", "문의", "공고문참조"].some((keyword) => n.includes(normalize(keyword)))
      );
    }) ?? null
  );
}

function extractAdditionalEligibilityConditions(lines: string[]): {
  additionalEligibilityConditions: string[];
  additionalEvidence: string | null;
} {
  const conditions: string[] = [];
  const evidenceLines: string[] = [];

  for (const line of lines) {
    const normalizedLine = normalize(line);
    const cleanLine = line.replace(/^[-–·•☞]\s*/, "").trim();
    if (cleanLine.length === 0) continue;

    if (/만\s*\d{1,2}\s*세\s*이상/.test(line) || /\d{1,2}\s*[~～-]\s*\d{1,2}\s*세/.test(line)) {
      conditions.push(cleanLine);
      evidenceLines.push(line);
    }

    if (normalizedLine.includes("거주") && !normalizedLine.includes("사업장")) {
      conditions.push(cleanLine);
      evidenceLines.push(line);
    }

    if (normalizedLine.includes("도내창업") || normalizedLine.includes("관내창업")) {
      conditions.push(cleanLine);
      evidenceLines.push(line);
    }

    if (normalizedLine.includes("신산업분야") && normalizedLine.includes("10년이내")) {
      conditions.push(cleanLine);
      evidenceLines.push(line);
    }

    if (normalizedLine.includes("참가분야")) {
      conditions.push(cleanLine);
      evidenceLines.push(line);
    }

    if (normalizedLine.includes("과제협의") || normalizedLine.includes("공급기업") || normalizedLine.includes("견적서")) {
      conditions.push(cleanLine);
      evidenceLines.push(line);
    }

    if (normalizedLine.includes("민간부담금") || normalizedLine.includes("자부담")) {
      conditions.push(cleanLine);
      evidenceLines.push(line);
    }

    if (normalizedLine.includes("정상영업") || normalizedLine.includes("영업중인점포")) {
      conditions.push(cleanLine);
      evidenceLines.push(line);
    }

    if (normalizedLine.includes("대표자본인") || normalizedLine.includes("대리신청")) {
      conditions.push(cleanLine);
      evidenceLines.push(line);
    }

    if (normalizedLine.includes("소상공인확인서") || normalizedLine.includes("중소기업확인서")) {
      conditions.push(cleanLine);
      evidenceLines.push(line);
    }
  }

  return {
    additionalEligibilityConditions: Array.from(new Set(conditions)),
    additionalEvidence: evidenceLines[0] ?? null
  };
}

function extractDeadline(
  lines: string[],
  fullText: string
): { deadline: string | null; deadlineEvidence: string | null } {
  const deadlineLine = findLine(lines, ["마감", "접수기간", "접수마감", "신청기간", "모집기간"]);
  const searchText = deadlineLine ?? fullText;

  // YYYY.MM.DD ~ M.D / YYYY년 M월 D일 ~ M월 D일처럼 종료일의 연도가 생략된 범위는 종료일을 사용한다.
  const implicitYearRange = searchText.match(
    /(\d{4})[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})[일.]?.{0,40}?[~～]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})/
  );
  if (implicitYearRange) {
    const iso = `${implicitYearRange[1]}-${pad(implicitYearRange[4])}-${pad(implicitYearRange[5])}`;
    return { deadline: iso, deadlineEvidence: deadlineLine ?? implicitYearRange[0] };
  }

  // YYYY-MM-DD / YYYY.MM.DD / YYYY년 M월 D일 형태에서 마지막 날짜(마감일)를 사용.
  const isoMatches = [...searchText.matchAll(/(\d{4})[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})/g)];
  if (isoMatches.length > 0) {
    const last = isoMatches[isoMatches.length - 1];
    const iso = `${last[1]}-${pad(last[2])}-${pad(last[3])}`;
    return { deadline: iso, deadlineEvidence: deadlineLine ?? last[0] };
  }

  return { deadline: null, deadlineEvidence: deadlineLine };
}

function extractListField(lines: string[], labelAliases: string[]): string[] {
  const line = findLine(lines, labelAliases);
  if (!line) return [];
  const value = valueAfterLabel(line);
  return value
    .split(/[,，·•\/]|\s{2,}/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && !labelAliases.some((label) => item === label));
}

function pad(value: string): string {
  return value.padStart(2, "0");
}
