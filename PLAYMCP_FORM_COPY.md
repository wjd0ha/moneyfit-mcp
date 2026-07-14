# PlayMCP 등록 화면 복붙용 문구

## MCP 이름

```text
사장님 머니핏
```

## MCP 식별자

```text
moneyfit
```

## MCP 설명

```text
사장님 머니핏은 내 가게나 회사 상황을 말하면 어울리는 정부지원금·정책자금 공고를 찾아보고, 신청 대상인지와 준비서류, 주의할 점, 다음 행동을 쉽게 정리해주는 MCP입니다. 선정이나 지원금 수령을 보장하지 않으며, 공고 원문 기준으로 확인이 필요한 항목을 함께 안내합니다.
```

## 대화 예시 1

```text
서울 성수 카페 2년차 개인사업자야. 경영 컨설팅 찾아줘
```

## 대화 예시 2

```text
올해 특허 출원 완료한 부천 제조업 3년차 법인이야. 출원비 지원 찾아줘
```

## 대화 예시 3

```text
중기부 R&D 수행 중인 서울 IT법인 2년차야. 사업화 지원 찾아줘
```

## 인증 방식

```text
인증 사용하지 않음
```

## MCP Endpoint

로컬 테스트용:

```text
http://127.0.0.1:3000/mcp
```

PlayMCP 심사 등록용:

```text
https://배포된도메인/mcp
```

주의: PlayMCP 심사에는 로컬 주소를 넣을 수 없습니다. Render, Railway, Kakao Cloud, Fly.io 등으로 배포한 뒤 실제 HTTPS 주소를 넣어야 합니다.

예시:

```text
https://moneyfit-mcp.onrender.com/mcp
```

위 예시는 형식 설명용입니다. 실제 등록에는 배포 후 생성된 본인 서버 주소를 사용하세요.

## 대표 이미지

```text
assets/moneyfit-logo-source-600.png
```
