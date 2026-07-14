const endpoint = process.env.MCP_ENDPOINT ?? "http://127.0.0.1:3000/mcp";
const headers = {
  Accept: "application/json, text/event-stream",
  "Content-Type": "application/json"
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseSse(text) {
  const dataLine = text.split(/\r?\n/).find((line) => line.startsWith("data: "));
  assert(dataLine, "SSE 응답에서 data를 찾지 못했습니다.");
  return JSON.parse(dataLine.slice(6));
}

async function post(payload) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  assert(response.ok, `HTTP ${response.status}: ${text.slice(0, 300)}`);
  const message = parseSse(text);
  assert(!message.error, `MCP 오류: ${JSON.stringify(message.error)}`);
  return message.result;
}

const healthUrl = endpoint.replace(/\/mcp\/?$/, "/health");
const healthResponse = await fetch(healthUrl);
assert(healthResponse.ok, `health check 실패: HTTP ${healthResponse.status}`);
const health = await healthResponse.json();
assert(health.name === "moneyfit-mcp", `다른 서버가 응답했습니다: ${health.name ?? "이름 없음"}`);

const initialized = await post({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "moneyfit-preflight", version: "1.0.0" }
  }
});
assert(initialized.serverInfo?.name === "moneyfit-mcp", "서버 식별자가 일치하지 않습니다.");

const toolsResult = await post({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
const tools = toolsResult.tools ?? [];
const expectedNames = [
  "extract_business_profile",
  "find_relevant_programs",
  "extract_program_requirements",
  "check_eligibility",
  "detect_application_risks",
  "generate_application_plan"
];

assert(tools.length === expectedNames.length, `도구 개수 불일치: ${tools.length}`);
for (const name of expectedNames) {
  const tool = tools.find((candidate) => candidate.name === name);
  assert(tool, `도구 누락: ${name}`);
  assert(tool.description?.includes("사장님 머니핏"), `[${name}] description에 서비스명이 없습니다.`);
  assert(tool.inputSchema, `입력 스키마 누락: ${name}`);
  assert(tool.outputSchema, `출력 스키마 누락: ${name}`);
  assert(tool.annotations?.readOnlyHint === true, `읽기 전용 표시 누락: ${name}`);
}

const called = await post({
  jsonrpc: "2.0",
  id: 3,
  method: "tools/call",
  params: {
    name: "find_relevant_programs",
    arguments: {
      today: "2026-07-14",
      businessProfile: {
        businessForm: "개인사업자",
        isRegistered: true,
        age: null,
        region: "서울",
        yearsInBusiness: 2,
        businessType: "음식점/카페",
        fundingPurpose: "교육/컨설팅",
        keywords: ["서울", "카페", "컨설팅"],
        missingFields: [],
        summary: "서울에서 카페를 운영하는 2년차 개인사업자"
      }
    }
  }
});

const textContent = called.content?.find((item) => item.type === "text")?.text ?? "";
const result = JSON.parse(textContent);
assert(result.programs?.length > 0, "현재 접수 중인 대표 공고를 찾지 못했습니다.");
assert(result.programs.some((program) => program.title.includes("서리풀 소상공인 창업 클리닉")), "현재 공고 데이터가 반영되지 않았습니다.");
assert(result.programs.every((program) => program.deadline && program.deadline >= "2026-07-14"), "마감된 공고가 후보에 포함됐습니다.");
assert(result.programs.every((program) => program.reviewFitScore >= 45), "낮은 적합도 공고가 후보에 포함됐습니다.");

console.log(`MoneyFit preflight passed: ${endpoint}`);
console.log(`- health: ${health.name}`);
console.log(`- protocol: ${initialized.protocolVersion}`);
console.log(`- tools: ${tools.map((tool) => tool.name).join(", ")}`);
console.log("- descriptions: 6/6 include 사장님 머니핏");
console.log("- active notices: closed/unknown deadlines excluded");
console.log("- relevance: all returned programs score 45+");
