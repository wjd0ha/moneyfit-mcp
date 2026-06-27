# AGENTS.md — 사장님 머니핏 (MoneyFit) MCP

이 파일은 코딩 에이전트(Codex, Claude Code 등)가 이 프로젝트를 이어서 작업할 때 읽는 컨텍스트 문서입니다.

## 1. 프로젝트 정체성

- **브랜드: 머니핏(MoneyFit)** · 서비스 풀네임: **사장님 머니핏**
- **역할**: 사장님의 사업 조건에 핏(fit) 맞춰 **지원금 공고를 판독 → 신청 자격 판단 → 신청 준비까지** 도와주는 카카오톡형 AI 도구
- **브랜드 문장**: 사업에 맞는 지원금, 찾기부터 신청까지
- **영문 태그라인**: MONEY FIT FOR OWNERS
- **브랜드 컨셉**: 사장님의 사업과 정부지원금·정책자금을 연결해 찾기부터 신청까지 함께하는 맞춤 자금 매칭 서비스
- **시각 아이덴티티**: 사업(네이비)과 지원금·정책자금(그린)을 머니핏이 연결하고 동행한다는 의미. 중앙 골드 포인트는 맞춤 매칭/기회/신청 연결점을 의미한다.
- **컬러 팔레트**: Navy `#0B1D3A`, Green `#11865B`, Gold `#D4AF37`
- **출품 대회**: 카카오 PlayMCP / AGENTIC PLAYER 10
  - 예선 마감 2026-07-14, PlayMCP 심사 최대 7영업일 → **2026-07-07까지 등록 권장**
  - 본선(2026-07-30~08-27)은 Kakao Tools 공개 + 사용자 투표
- **플랫폼**: Streamable HTTP 기반 Remote MCP Server (PlayMCP 등록 방식)

## 2. 현재 상태 (2026-06-27 기준)

예선 MVP 구현 완료. **`npm run build` 성공, `npm test` 30개 전부 통과.**

기존 "지원사업 추천기"(검색·점수화)에서 **"공고 판독기 + 신청 가능성 체크기"**로 전면 전환을 마친 상태입니다. 전국 자동 추천은 MVP에서 제외했습니다.

`data/programs.json`은 기업마당 3건과 데이터바우처·스마트상점 공고를 반영한 5개 데모 데이터로 교체되어 있습니다. 모든 항목은 제출 전 원문 재검증이 필요하므로 `sample:true`를 유지합니다.

## 3. 기술 스택 / 실행

- TypeScript (ESM, NodeNext), Node 20+, `@modelcontextprotocol/sdk`, express, zod v4, vitest
- 명령:
  ```bash
  npm install
  npm run build   # tsc 타입 빌드
  npm test        # vitest (판정 케이스 + 추출기 + 정책 검증)
  npm run dev     # HTTP 서버 (기본 http://127.0.0.1:3000/mcp)
  # stdio 모드: MCP_TRANSPORT=stdio npm run dev
  ```

## 4. 디렉토리 구조

```
src/
  index.ts                  HTTP/stdio 부트스트랩
  server.ts                 MCP 서버 + 6개 툴 등록(zod 스키마)
  types.ts                  도메인 타입 + STANDARD_DISCLAIMER, VERDICT_LABELS
  text/lexicon.ts           지역/업종/목적 어휘 룰 + normalize (두 추출기 공유)
  tools/
    extractBusinessProfile.ts    자연어 → 사업자 조건
    findRelevantPrograms.ts      사업자 조건 → 로컬 DB 후보 찾기
    extractProgramRequirements.ts 공고문 → 구조화 + evidence(원문 근거)
    checkEligibility.ts          ★ 핵심 판정 로직 (하드컷 우선)
    detectApplicationRisks.ts    탈락 위험 탐지
    generateApplicationPlan.ts   준비서류·순서·계획서 방향·다음행동
  data/loadPrograms.ts      data/programs.json 로더 + 스키마 검증
data/programs.json          실제 공고 기반 데모 데이터 5개 (모두 sample:true)
tests/
  cases.json                판정 케이스 12개 (프로필+공고+기대 verdict)
  tools.test.ts             케이스 기반 + 단위 테스트
```

## 5. 핵심 설계 원칙 (반드시 지킬 것)

1. **verdict는 4단계만 사용**: `HIGHLY_LIKELY` / `CONDITIONAL` / `INSUFFICIENT_INFO` / `NOT_ELIGIBLE`. 다른 값 추가 금지.
2. **하드 컷 우선**: 지역·업력·사업자유형·제외업종 결격은 점수보다 우선해 즉시 `NOT_ELIGIBLE`.
   판정 우선순위: `hardBlockers > missingFields > conditionalNotes > matchedConditions`.
3. **추측 금지**: 판정에 필요한데 비어 있는 정보는 절대 추정하지 말고 `missingFields`에 담는다.
4. **모든 판정에 근거**: hardBlocker/matched/conditional 모두 reason을 동반한다.
5. **공고는 구조화 필드로 처리**: 자유 텍스트로 판정하지 않는다. `extract_program_requirements`로 구조화한 뒤 비교한다.
6. **표현 정책**: "선정/합격/지원금 받을 수 있음/수령 보장/무조건" 금지 → "신청 검토 가능 / 조건 확인 필요 / 현재 정보로 판단 불가" 사용. 모든 응답에 `STANDARD_DISCLAIMER` 부착.
7. **개인정보 비수집**: 사업자등록번호·주민번호·계좌·인증번호는 입력받지 않는다.
8. 판정 로직은 **결정론적**으로 유지(같은 입력 → 같은 verdict). 테스트가 이를 검증한다.

## 6. 다음 할 일 (우선순위 순)

1. **시연 시나리오 작성** — 5개 공고별 대표 질문/답변 흐름을 만들고, 머니핏의 "찾기부터 신청까지" 메시지가 드러나게 정리한다.
2. **PlayMCP Inspector 검증** — 6개 MCP 툴이 가이드 요구사항(name/description/inputSchema/annotations)을 만족하는지 재확인한다.
3. **배포 준비** — 카카오 클라우드 또는 공개 HTTPS 엔드포인트에 Streamable HTTP 서버 배포 → PlayMCP 개발자 콘솔 등록 → 심사 요청(7/7까지 권장).
4. **실제 제출 전 원문 재검증** — `data/programs.json`의 `sourceUrl`, 제출서류, 평가항목, 마감 상태를 공고 원문/첨부파일 기준으로 확인한다.
5. **(본선) 사업계획서 리핏 기능** — 기존 사업계획서 내용을 선택 공고의 평가항목에 맞게 재구성하는 툴을 추가한다.
6. **(본선) Kakao Tools 카드형 UX** — 판정 결과 카드, 준비서류 체크 카드 등.

## 7. 건드릴 때 주의

- 새 툴/필드를 추가하면 `tests/cases.json`과 `tools.test.ts`에 대응 케이스를 반드시 추가하고 `npm test` 통과를 확인한다.
- npm 패키지명/폴더명은 `sajangnim-support-mcp`로 유지(외부 노출 이름만 머니핏). 내부 식별자 변경은 import 경로에 영향.
- `data/programs.json`의 모든 항목은 `sample:true`와 필수 구조화 필드(regions, eligibleBusinessForms, evidence 등)를 갖춰야 로더 검증을 통과한다.

## 8. 기획/맥락 참고 파일 (상위 폴더)

- `../사장님_공고판독기_AGENTIC_PLAYER10_기획안.md` — 서비스 기획안(타깃·페인포인트·시나리오·일정)
- `../지원금되나요_브랜딩_MVP전략.md` — 브랜딩/MVP 전략
