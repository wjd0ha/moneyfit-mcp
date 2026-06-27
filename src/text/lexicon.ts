// 사업자 프로필 추출과 공고 요건 추출이 공유하는 어휘/매칭 유틸.

export interface RuleEntry {
  value: string;
  aliases: string[];
}

export const REGION_RULES: RuleEntry[] = [
  { value: "화성", aliases: ["화성", "화성시"] },
  { value: "수원", aliases: ["수원", "수원시"] },
  { value: "성남", aliases: ["성남", "성남시"] },
  { value: "용인", aliases: ["용인", "용인시"] },
  { value: "고양", aliases: ["고양", "고양시"] },
  { value: "부천", aliases: ["부천", "부천시"] },
  { value: "안산", aliases: ["안산", "안산시"] },
  { value: "안양", aliases: ["안양", "안양시"] },
  { value: "평택", aliases: ["평택", "평택시"] },
  { value: "서울", aliases: ["서울", "서울특별시", "강남", "마포", "성수", "홍대", "송파", "종로"] },
  { value: "부산", aliases: ["부산", "부산광역시", "해운대", "서면"] },
  { value: "대구", aliases: ["대구", "대구광역시"] },
  { value: "인천", aliases: ["인천", "인천광역시", "송도", "부평"] },
  { value: "광주", aliases: ["광주", "광주광역시"] },
  { value: "대전", aliases: ["대전", "대전광역시"] },
  { value: "울산", aliases: ["울산", "울산광역시"] },
  { value: "세종", aliases: ["세종", "세종시", "세종특별자치시"] },
  {
    value: "경기",
    aliases: ["경기", "경기도", "수원", "성남", "용인", "고양", "화성", "부천", "안산", "안양", "평택"]
  },
  { value: "강원", aliases: ["강원", "강원도", "춘천", "원주", "강릉"] },
  { value: "충북", aliases: ["충북", "충청북도", "청주", "충주", "제천"] },
  { value: "충남", aliases: ["충남", "충청남도", "천안", "아산", "공주", "논산"] },
  { value: "전북", aliases: ["전북", "전라북도", "전주", "군산", "익산"] },
  { value: "전남", aliases: ["전남", "전라남도", "여수", "순천", "목포"] },
  { value: "경북", aliases: ["경북", "경상북도", "포항", "구미", "경주", "안동"] },
  { value: "경남", aliases: ["경남", "경상남도", "창원", "김해", "양산", "진주"] },
  { value: "제주", aliases: ["제주", "제주도", "제주시", "서귀포"] }
];

export const BUSINESS_TYPE_RULES: RuleEntry[] = [
  { value: "음식점/카페", aliases: ["음식점", "식당", "요식", "카페", "디저트", "베이커리", "분식"] },
  { value: "뷰티/미용", aliases: ["미용", "뷰티", "네일", "헤어", "피부관리", "에스테틱"] },
  { value: "제조업", aliases: ["제조", "공장", "생산", "스마트공장", "반도체", "모빌리티", "친환경", "에너지"] },
  { value: "도소매/전자상거래", aliases: ["도소매", "소매", "쇼핑몰", "온라인몰", "이커머스", "전자상거래"] },
  { value: "생활서비스/피트니스", aliases: ["헬스", "피트니스", "운동", "체육", "필라테스", "요가"] },
  { value: "교육서비스", aliases: ["학원", "교육", "강의", "클래스", "교습"] },
  { value: "콘텐츠/디자인/마케팅", aliases: ["콘텐츠", "디자인", "마케팅", "광고", "영상", "브랜딩"] },
  {
    value: "IT/소프트웨어",
    aliases: [
      "it",
      "ict",
      "소프트웨어",
      "sw",
      "s/w",
      "앱",
      "웹서비스",
      "saas",
      "ai",
      "데이터",
      "데이터분석",
      "데이터바우처",
      "플랫폼",
      "로봇",
      "바이오",
      "헬스",
      "신산업",
      "기술"
    ]
  },
  { value: "관광/숙박", aliases: ["관광", "숙박", "게스트하우스", "여행", "호텔"] },
  { value: "농식품", aliases: ["농식품", "농산물", "식품제조", "로컬푸드"] }
];

export const PURPOSE_RULES: RuleEntry[] = [
  { value: "운영자금", aliases: ["운영자금", "운전자금", "자금난", "현금흐름", "인건비", "임대료", "대출"] },
  { value: "창업자금", aliases: ["창업자금", "초기자금", "사업자금", "창업비용"] },
  { value: "시설/장비", aliases: ["시설", "장비", "인테리어", "기계", "공정", "리모델링", "설비"] },
  { value: "마케팅/판로", aliases: ["마케팅", "홍보", "광고", "판로", "온라인판매", "라이브커머스", "브랜드"] },
  { value: "디지털 전환", aliases: ["디지털", "키오스크", "스마트상점", "pos", "예약", "자동화"] },
  { value: "고용/인력", aliases: ["고용", "채용", "인력", "직원", "4대보험"] },
  { value: "R&D/사업화", aliases: ["연구개발", "시제품", "기술개발", "사업화", "r&d"] },
  { value: "교육/컨설팅", aliases: ["컨설팅", "멘토링", "교육", "진단", "코칭"] },
  { value: "수출", aliases: ["수출", "해외", "글로벌", "바이어"] }
];

/** 일반적으로 정부지원사업에서 자주 제외되는 업종 키워드. */
export const COMMON_EXCLUDED_TYPE_RULES: RuleEntry[] = [
  { value: "유흥/사행성", aliases: ["유흥", "사행", "도박", "단란주점", "유흥주점"] },
  { value: "부동산/임대업", aliases: ["부동산", "임대업", "부동산임대"] },
  { value: "금융/보험업", aliases: ["금융업", "보험업", "대부업"] }
];

export function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[.,!?()[\]{}"'`~:;|\\/_·•※-]/g, "");
}

/** 규칙 목록에서 텍스트에 매칭되는 첫 번째 value를 반환. */
export function findOneByRules(normalizedText: string, rules: RuleEntry[]): string | null {
  for (const rule of rules) {
    if (rule.aliases.some((alias) => normalizedText.includes(normalize(alias)))) {
      return rule.value;
    }
  }
  return null;
}

/** 규칙 목록에서 텍스트에 매칭되는 모든 value를 반환. */
export function findAllByRules(normalizedText: string, rules: RuleEntry[]): string[] {
  const found: string[] = [];
  for (const rule of rules) {
    if (rule.aliases.some((alias) => normalizedText.includes(normalize(alias)))) {
      found.push(rule.value);
    }
  }
  return found;
}

/** 두 지역 문자열이 같은 권역을 가리키는지(부분 일치 포함). */
export function regionEquivalent(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;

  // 사업자가 기초지자체를 말했고 공고가 광역 단위인 경우는 같은 권역으로 본다.
  // 반대로 공고가 기초지자체인데 사업자가 광역만 말한 경우는 충분히 특정되지 않았으므로 일치 처리하지 않는다.
  const provinceOfA = CITY_TO_PROVINCE[na];
  return provinceOfA === nb;
}

const CITY_TO_PROVINCE: Record<string, string> = {
  화성: "경기",
  수원: "경기",
  성남: "경기",
  용인: "경기",
  고양: "경기",
  부천: "경기",
  안산: "경기",
  안양: "경기",
  평택: "경기"
};
