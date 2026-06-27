# 사장님 머니핏 (MoneyFit)

> 브랜드: **머니핏** · 서비스 풀네임: **사장님 머니핏**

카카오 PlayMCP / AGENTIC PLAYER 10 예선 제출용 TypeScript MCP 서버입니다. 정부지원사업 공고문과 사업자 조건을 비교해 **신청 가능성, 부족 정보, 탈락 위험, 준비서류, 다음 행동**을 알려줍니다.

전국 지원사업을 자동으로 추천하지 않습니다. 사용자가 가진 공고(텍스트·URL 요약·구조화 데이터)를 **판독하고 신청 가능성을 점검**하는 데 집중합니다.

브랜드 문장: **사업에 맞는 지원금, 찾기부터 신청까지**  
영문 태그라인: **MONEY FIT FOR OWNERS**  
브랜드 컬러: Navy `#0B1D3A`, Green `#11865B`, Gold `#D4AF37`

## 1. 서비스 콘셉트

- 포지션: 지원사업 추천기 ❌ → **공고 판독기 + 신청 가능성 체크기** ✅
- 브랜드 컨셉: 사장님의 사업과 정부지원금·정책자금을 연결해 찾기부터 신청까지 함께하는 맞춤 자금 매칭 서비스
- 사용자가 공고문을 입력하면, 사업자 조건과 비교해 다음을 제공합니다.
  - 신청 가능성 4단계 판정과 근거
  - 판정에 필요한데 비어 있는 정보(missingFields)
  - 탈락 위험 요소
  - 준비서류와 다음 행동
- 판정은 4단계로만 표현합니다.
  - `HIGHLY_LIKELY` 신청 검토 가능(현재 정보 기준 결격사유 없음)
  - `CONDITIONAL` 조건 확인 필요
  - `INSUFFICIENT_INFO` 현재 정보로 판단 불가
  - `NOT_ELIGIBLE` 신청 부적합 가능성 높음

### 설계 원칙

- 전국 지원사업 자동 추천은 MVP에서 제외합니다.
- AI가 선정·합격·지원금 수령을 보장하지 않습니다.
- 모든 판정에는 근거를 함께 제공합니다.
- 필수 정보가 없으면 추측하지 않고 `missingFields`에 담습니다.
- 공고 데이터는 자유 텍스트가 아니라 구조화된 필드로 처리합니다.
- **하드 컷 조건(지역·업력·사업자 유형·제외 업종)은 점수보다 우선합니다.**

## 2. 설치 / 실행

```bash
npm install
npm run build   # 타입 빌드
npm test        # 판정 로직 검증(케이스 기반)
npm run dev     # HTTP 서버(기본 http://127.0.0.1:3000/mcp)
```

stdio 모드:

```powershell
$env:MCP_TRANSPORT="stdio"; npm run dev
```

환경변수는 `.env.example` 참고. 공고 데이터셋 경로는 `PROGRAM_DB_PATH`로 바꿀 수 있습니다.

## 3. MCP Tool 6종

### 1) extract_business_profile

사용자 자연어에서 사업자 유형·등록 여부·지역·업력·업종·자금 목적을 추출합니다. 불명확한 항목은 추측하지 않고 `missingFields`로 반환합니다.

- 입력: `{ "freeText": "서울 성수에서 카페를 2년째 운영하는 개인사업자예요" }`
- 출력: `businessForm`, `isRegistered`, `region`, `yearsInBusiness`, `businessType`, `fundingPurpose`, `keywords`, `missingFields`, `summary`

### 2) find_relevant_programs

구조화된 사업자 조건을 기준으로 로컬 데모 공고 DB에서 검토 후보를 찾습니다. 선정 가능성 대신 `reviewFitScore`, `matchedReasons`, `cautions`, `nextAction`을 반환합니다.

- 입력: `{ "businessProfile": { ... } }`
- 출력: `programs`, `missingFields`, `disclaimer`

### 3) extract_program_requirements

공고문 텍스트에서 신청대상·지역·업력·사업자 유형·제외 업종·지원내용·마감일·제출서류·평가항목을 구조화하고, 각 항목의 **원문 근거를 `evidence` 배열**에 저장합니다.

- 입력: `{ "noticeText": "<공고문 본문>" }`
- 출력: `regions`, `eligibleBusinessForms`, `targetBusinessTypes`, `excludedBusinessTypes`, `minYearsInBusiness`, `maxYearsInBusiness`, `support`, `deadline`, `requiredDocuments`, `evaluationCriteria`, `evidence`, `missingFields`

### 4) check_eligibility

`businessProfile`과 `programRequirements`를 비교해 판정합니다. 하드 컷 결격이 하나라도 있으면 `NOT_ELIGIBLE`, 판정에 필요한 정보가 비면 `INSUFFICIENT_INFO`, 애매하면 `CONDITIONAL`, 깨끗하면 `HIGHLY_LIKELY`입니다.

- 출력: `verdict`, `verdictLabel`, `hardBlockers`, `missingFields`, `matchedConditions`, `conditionalNotes`, `summary`, `disclaimer`

판정 우선순위:

```
hardBlockers 존재    → NOT_ELIGIBLE
missingFields 존재   → INSUFFICIENT_INFO
conditionalNotes 존재 → CONDITIONAL
matchedConditions만   → HIGHLY_LIKELY
```

### 5) detect_application_risks

업력 초과/미달, 지역 불일치, 제외 업종, 중복 수혜 가능성, 세금 체납 가능성, 서류 미비, 마감 임박을 위험 요소로 반환합니다. 각 위험에 심각도(`높음`/`중간`/`낮음`)와 권장 행동을 붙입니다.

### 6) generate_application_plan

공고에 명시된 제출서류·평가항목을 반영해 준비서류, 준비 순서, 사업계획서 작성 방향, 다음 행동을 생성합니다.

## 4. 권장 호출 흐름

```
extract_business_profile   (사업자 자연어 → 구조화)
find_relevant_programs     (사업자 조건 → 로컬 DB 후보 찾기)
extract_program_requirements (공고문 → 구조화 + 근거)
        │
        ▼
check_eligibility          (둘을 비교 → 4단계 판정)
detect_application_risks   (탈락 위험 점검)
generate_application_plan  (준비서류·다음 행동)
```

## 5. 데이터 구조

`data/programs.json`은 구조화된 데모 공고 데이터셋입니다. 현재는 기업마당 공고 3건과 사용자가 제공한 데이터바우처·스마트상점 공고 자료를 기준으로 정리했습니다. 각 항목은 다음 필드를 가집니다.

`title`, `organization`, `sourceUrl`, `sourceDate`, `target`, `support`, `deadline`, `regions`, `eligibleBusinessForms`, `targetBusinessTypes`, `excludedBusinessTypes`, `minYearsInBusiness`, `maxYearsInBusiness`, `requiredDocuments`, `evaluationCriteria`, `evidence`, `missingFields`

모든 데모 데이터는 `sample: true`로 표시됩니다. 실제 제출 전에는 공고 원문·첨부파일·마감 상태를 다시 확인하고 `sourceUrl`·`sourceDate`·제출서류·평가항목을 최신 원문 기준으로 갱신해야 합니다. placeholder URL은 실제 공고 원문 링크로 교체해야 합니다.

## 6. 응답 표현 정책

금지: "선정 가능", "합격 가능", "지원금 받을 수 있음", "수령 보장", "무조건"

사용: "신청 검토 가능", "조건 확인 필요", "현재 정보로 판단 불가"

모든 결과에는 근거와 확인 필요 항목, 그리고 다음 안내 문구가 포함됩니다.

> 이 결과는 입력한 정보와 공고문 기준의 사전 판단입니다. 최종 신청 가능 여부는 공고 원문과 운영기관 확인을 기준으로 판단하세요.

## 7. 테스트

`tests/cases.json`에 12개 판정 케이스(사용자 프로필 + 공고 조건 + 기대 verdict)가 있습니다. `npm test`가 각 케이스의 판정 결과를 기대값과 대조합니다. 추출기·위험탐지·준비계획·데이터 로더·표현 정책도 함께 검증합니다.

## 8. PlayMCP 등록 전 확인

- PlayMCP는 Streamable HTTP 기반 Remote MCP Server를 등록합니다. 이 서버의 MCP 엔드포인트는 기본 `/mcp`입니다.
- 카카오 클라우드에서 엔드포인트를 띄운 뒤 PlayMCP 개발자 콘솔에서 등록 → 심사 요청 → 전체 공개 순으로 진행합니다.
- 심사는 영업일 기준 최대 7일이므로 마감 전 여유를 두고 등록하세요.
- 개인정보(사업자등록번호·주민번호·계좌·인증번호)는 입력받지 않습니다. 판정에는 업종·지역·업력·사업자 유형 정도만 사용합니다.
- 실제 접수 순서는 [`SUBMISSION_CHECKLIST.md`](./SUBMISSION_CHECKLIST.md)를 따라 진행하세요.

## 참고

- [PlayMCP 개발 가이드](https://tech.kakao.com/posts/734)
- [PlayMCP](https://playmcp.kakao.com/)
- [AGENTIC PLAYER 10 안내](https://b.kakao.com/views/PlayMCP/AGENTIC_PlAYER_10)
