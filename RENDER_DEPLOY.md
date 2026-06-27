# Render로 MCP Endpoint 만들기

PlayMCP의 `MCP Endpoint`에는 로컬 주소가 아니라 공개 HTTPS 주소를 넣어야 합니다.

예:

```text
https://moneyfit-mcp.onrender.com/mcp
```

## 1. GitHub에 프로젝트 올리기

Render는 GitHub 저장소를 연결해서 배포하는 방식이 가장 쉽습니다.

```powershell
cd "C:\Users\wjd0h\OneDrive\Documents\프로젝트 구체화\sajangnim-support-mcp"
git init
git add .
git commit -m "Prepare MoneyFit MCP submission"
```

그다음 GitHub에서 새 저장소를 만든 뒤 안내되는 `git remote add origin ...`, `git push ...` 명령을 실행하세요.

## 2. Render Web Service 만들기

1. Render 접속
2. `New` → `Web Service`
3. GitHub 저장소 연결
4. Runtime은 `Docker` 또는 `Node` 중 하나 선택

Docker를 선택하면 이 프로젝트의 `Dockerfile`을 그대로 사용합니다.

Node로 배포할 경우:

```text
Build Command: npm ci && npm run build
Start Command: npm start
```

## 3. 환경변수 설정

Render 환경변수:

```env
MCP_TRANSPORT=http
HOST=0.0.0.0
MCP_PATH=/mcp
PROGRAM_DB_PATH=data/programs.json
CORS_ORIGIN=
```

`PORT`는 Render가 자동으로 넣어주는 값을 쓰는 편이 안전합니다. 직접 넣지 않아도 됩니다.

## 4. 배포 완료 후 확인

Render 배포가 끝나면 이런 주소가 생깁니다.

```text
https://서비스이름.onrender.com
```

브라우저에서 확인:

```text
https://서비스이름.onrender.com/health
```

정상 예:

```json
{
  "ok": true,
  "name": "moneyfit-mcp",
  "transport": "streamable-http",
  "mcpPath": "/mcp"
}
```

PlayMCP와 MCP Inspector에 넣을 Endpoint:

```text
https://서비스이름.onrender.com/mcp
```

## 5. 주의

- `/mcp`를 브라우저에서 직접 열면 `405 Method not allowed`가 나올 수 있습니다. 정상입니다.
- MCP Inspector에서 `Streamable HTTP` 방식으로 `https://서비스이름.onrender.com/mcp`를 테스트하세요.
- 툴 6개가 보여야 합니다.
