# 사장님 머니핏 PlayMCP 출품 체크리스트

이미지 준비는 완료된 상태입니다. 대표 이미지는 `assets/moneyfit-logo-source-600.png`를 사용하세요.

## 1. 로컬 최종 확인

PowerShell에서 실행:

```powershell
cd "C:\Users\wjd0h\OneDrive\Documents\프로젝트 구체화\sajangnim-support-mcp"
npm install
npm test
npm run build
npm run dev
```

확인:

- `http://127.0.0.1:3000/health`는 브라우저에서 열었을 때 `ok: true`가 보이면 정상입니다.
- `http://127.0.0.1:3000/mcp`는 브라우저에서 열면 `405 Method not allowed`가 나올 수 있습니다. 정상입니다. MCP는 Inspector에서 POST 방식으로 테스트합니다.
- `npm run dev`를 켜둔 터미널은 서버 실행용으로 그대로 두고, 테스트/브라우저 확인은 새 터미널이나 브라우저에서 진행하세요.

## 2. MCP Inspector 테스트

로컬 테스트:

```text
Streamable HTTP
http://127.0.0.1:3000/mcp
```

배포 후 테스트:

```text
Streamable HTTP
https://배포주소/mcp
```

보여야 하는 툴:

- `extract_business_profile`
- `find_relevant_programs`
- `extract_program_requirements`
- `check_eligibility`
- `detect_application_risks`
- `generate_application_plan`

## 3. 서버 배포

PlayMCP 등록에는 로컬 주소가 아니라 공개 HTTPS 주소가 필요합니다.

최종 URL 형태:

```text
https://배포주소/mcp
```

배포 환경변수:

```env
MCP_TRANSPORT=http
HOST=0.0.0.0
PORT=3000
MCP_PATH=/mcp
PROGRAM_DB_PATH=data/programs.json
CORS_ORIGIN=
```

일반 Node 배포 설정:

```text
Build command: npm ci && npm run build
Start command: npm start
Port: 3000
```

Docker 배포 설정:

```powershell
docker build -t moneyfit-mcp .
docker run --rm -p 3000:3000 moneyfit-mcp
```

배포 플랫폼에서는 Dockerfile을 그대로 사용하거나 위 Node 배포 설정을 사용하면 됩니다.

## 4. PlayMCP 콘솔 입력값

| 항목 | 입력값 |
| --- | --- |
| 제작자 정보 | 현재 팀프로필 선택. `정영하@BizFit` 그대로 사용 가능 |
| 대표 이미지 | `assets/moneyfit-logo-source-600.png` |
| MCP 이름 | `사장님 머니핏` |
| MCP 식별자 | `moneyfit` |
| MCP 설명 | 아래 설명문 복사 |
| MCP Server URL | `https://배포주소/mcp` |

MCP 설명:

```text
사장님 머니핏은 사장님의 사업 조건과 정부지원금·정책자금 공고를 연결해 공고 판독, 신청 자격 판단, 탈락 위험 점검, 준비서류와 다음 행동까지 안내하는 맞춤 자금 매칭 MCP입니다. 선정이나 지원금 수령을 보장하지 않으며, 공고 원문 기준으로 확인이 필요한 항목을 함께 제공합니다.
```

## 5. 임시 등록 후 확인

먼저 `임시 등록`을 권장합니다.

확인할 것:

- 대표 이미지가 깨지지 않는지
- MCP 이름과 설명이 의도대로 보이는지
- 배포 URL이 `https://.../mcp`인지
- 툴 6개가 보이는지
- 간단한 테스트 호출이 되는지

정상 확인 후 `등록 및 심사 요청`을 누르세요.

## 6. 심사 요청 전 최종 체크

- MCP 이름과 Tool 이름에 `kakao` 단어가 없음
- 공개 HTTPS `/mcp` 접속 가능
- `/health` 정상 응답
- MCP Inspector에서 툴 6개 확인
- 대표 이미지 등록 완료
- 설명에 선정/합격/지원금 수령 보장 표현 없음
- 개인정보 입력 유도 없음
- `data/programs.json`의 데모 공고는 `sample:true` 유지
