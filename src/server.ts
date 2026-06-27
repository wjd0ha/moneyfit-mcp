import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { extractBusinessProfile } from "./tools/extractBusinessProfile.js";
import { findRelevantPrograms } from "./tools/findRelevantPrograms.js";
import { extractProgramRequirements } from "./tools/extractProgramRequirements.js";
import { checkEligibility } from "./tools/checkEligibility.js";
import { detectApplicationRisks } from "./tools/detectApplicationRisks.js";
import { generateApplicationPlan } from "./tools/generateApplicationPlan.js";
import type { BusinessProfile, ProgramRequirements } from "./types.js";

const businessFormSchema = z.enum(["예비창업자", "개인사업자", "법인", "소상공인", "기타"]);

const businessProfileShape = {
  businessForm: businessFormSchema.nullable(),
  isRegistered: z.boolean().nullable(),
  region: z.string().nullable(),
  yearsInBusiness: z.number().nullable(),
  businessType: z.string().nullable(),
  fundingPurpose: z.string().nullable(),
  keywords: z.array(z.string()).default([]),
  missingFields: z.array(z.string()).default([]),
  summary: z.string().default("")
};

const evidenceSchema = z.object({ field: z.string(), text: z.string() });

const programRequirementsShape = {
  title: z.string().nullable(),
  organization: z.string().nullable(),
  regions: z.array(z.string()).default([]),
  eligibleBusinessForms: z.array(businessFormSchema).default([]),
  targetBusinessTypes: z.array(z.string()).default([]),
  excludedBusinessTypes: z.array(z.string()).default([]),
  minYearsInBusiness: z.number().nullable(),
  maxYearsInBusiness: z.number().nullable(),
  support: z.string().nullable(),
  additionalEligibilityConditions: z.array(z.string()).default([]),
  deadline: z.string().nullable(),
  requiredDocuments: z.array(z.string()).default([]),
  evaluationCriteria: z.array(z.string()).default([]),
  evidence: z.array(evidenceSchema).default([]),
  missingFields: z.array(z.string()).default([])
};

const businessProfileSchema = z.object(businessProfileShape);
const programRequirementsSchema = z.object(programRequirementsShape).passthrough();

const verdictSchema = z.enum(["HIGHLY_LIKELY", "CONDITIONAL", "INSUFFICIENT_INFO", "NOT_ELIGIBLE"]);
const conditionSchema = z.object({ field: z.string(), reason: z.string() });
const hardBlockerSchema = z.object({ field: z.string(), reason: z.string(), evidence: z.string().optional() });
const riskSchema = z.object({
  type: z.string(),
  severity: z.enum(["높음", "중간", "낮음"]),
  message: z.string(),
  recommendation: z.string(),
  evidence: z.string().optional()
});

export function createSajangnimSupportMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: "moneyfit-mcp",
      version: "0.2.0"
    },
    {
      capabilities: { logging: {} }
    }
  );

  server.registerTool(
    "extract_business_profile",
    {
      title: "사업자 조건 추출",
      description:
        "Extracts a business owner profile from Korean natural language for MoneyFit(사장님 머니핏). It returns business form, registration status, region, years in business, business type, and funding purpose without guessing unclear fields.",
      annotations: readOnlyAnnotations("Extract business profile"),
      inputSchema: {
        freeText: z.string().min(2).describe("사용자가 말한 사업 상황 자연어")
      },
      outputSchema: businessProfileShape
    },
    async ({ freeText }) => toJsonToolResult(extractBusinessProfile(freeText))
  );

  server.registerTool(
    "find_relevant_programs",
    {
      title: "맞춤 공고 찾기",
      description:
        "Finds relevant support program candidates from MoneyFit(사장님 머니핏)'s local curated notice database using a structured business profile. It returns review fit scores, matched reasons, cautions, and next actions without guaranteeing selection or funding.",
      annotations: readOnlyAnnotations("Find relevant programs"),
      inputSchema: {
        businessProfile: businessProfileSchema,
        today: z.string().optional().describe("기준 날짜(YYYY-MM-DD). 생략 시 오늘 날짜")
      },
      outputSchema: {
        programs: z.array(
          z.object({
            programId: z.string(),
            title: z.string(),
            organization: z.string(),
            target: z.string(),
            support: z.string().nullable(),
            deadline: z.string().nullable(),
            sourceUrl: z.string(),
            reviewFitScore: z.number(),
            reviewFitLevel: z.enum(["높음", "보통", "낮음"]),
            matchedReasons: z.array(z.string()),
            cautions: z.array(z.string()),
            nextAction: z.string()
          })
        ),
        missingFields: z.array(z.string()),
        disclaimer: z.string()
      }
    },
    async ({ businessProfile, today }) =>
      toJsonToolResult(await findRelevantPrograms(businessProfile as BusinessProfile, today))
  );

  server.registerTool(
    "extract_program_requirements",
    {
      title: "공고 요건 판독",
      description:
        "Extracts structured eligibility requirements from a Korean support program notice for MoneyFit(사장님 머니핏), including target region, business form, years in business, exclusions, support details, deadline, documents, criteria, and evidence.",
      annotations: readOnlyAnnotations("Extract program requirements"),
      inputSchema: {
        noticeText: z.string().min(5).describe("정부지원사업 공고문 본문 텍스트")
      },
      outputSchema: programRequirementsShape
    },
    async ({ noticeText }) => toJsonToolResult(extractProgramRequirements(noticeText))
  );

  server.registerTool(
    "check_eligibility",
    {
      title: "신청 가능성 판정",
      description:
        "Compares a business profile with program requirements for MoneyFit(사장님 머니핏) and returns one of four review verdicts: HIGHLY_LIKELY, CONDITIONAL, INSUFFICIENT_INFO, or NOT_ELIGIBLE. It prioritizes hard blockers and never guarantees selection or funding.",
      annotations: readOnlyAnnotations("Check eligibility"),
      inputSchema: {
        businessProfile: businessProfileSchema,
        programRequirements: programRequirementsSchema
      },
      outputSchema: {
        verdict: verdictSchema,
        verdictLabel: z.string(),
        hardBlockers: z.array(hardBlockerSchema),
        missingFields: z.array(z.string()),
        matchedConditions: z.array(conditionSchema),
        conditionalNotes: z.array(conditionSchema),
        summary: z.string(),
        disclaimer: z.string()
      }
    },
    async ({ businessProfile, programRequirements }) =>
      toJsonToolResult(
        checkEligibility(
          businessProfile as BusinessProfile,
          programRequirements as unknown as ProgramRequirements
        )
      )
  );

  server.registerTool(
    "detect_application_risks",
    {
      title: "탈락 위험 점검",
      description:
        "Detects application risks for MoneyFit(사장님 머니핏), such as region mismatch, years-in-business mismatch, excluded industries, duplicate funding, tax arrears, missing documents, deadlines, and extra eligibility conditions.",
      annotations: readOnlyAnnotations("Detect application risks"),
      inputSchema: {
        businessProfile: businessProfileSchema,
        programRequirements: programRequirementsSchema,
        today: z.string().optional().describe("기준 날짜(YYYY-MM-DD). 생략 시 오늘 날짜")
      },
      outputSchema: {
        risks: z.array(riskSchema),
        disclaimer: z.string()
      }
    },
    async ({ businessProfile, programRequirements, today }) =>
      toJsonToolResult(
        detectApplicationRisks(
          businessProfile as BusinessProfile,
          programRequirements as unknown as ProgramRequirements,
          today
        )
      )
  );

  server.registerTool(
    "generate_application_plan",
    {
      title: "신청 준비 계획",
      description:
        "Creates an application preparation plan for MoneyFit(사장님 머니핏), including required documents, preparation order, business plan direction, and next actions based on the parsed program requirements.",
      annotations: readOnlyAnnotations("Generate application plan"),
      inputSchema: {
        businessProfile: businessProfileSchema,
        programRequirements: programRequirementsSchema
      },
      outputSchema: {
        requiredDocuments: z.array(z.string()),
        preparationOrder: z.array(z.string()),
        businessPlanDirection: z.array(z.string()),
        nextActions: z.array(z.string()),
        disclaimer: z.string()
      }
    },
    async ({ businessProfile, programRequirements }) =>
      toJsonToolResult(
        generateApplicationPlan(
          businessProfile as BusinessProfile,
          programRequirements as unknown as ProgramRequirements
        )
      )
  );

  return server;
}

function toJsonToolResult<T extends object>(output: T) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(output, null, 2)
      }
    ],
    structuredContent: output as unknown as Record<string, unknown>
  };
}

function readOnlyAnnotations(title: string) {
  return {
    title,
    readOnlyHint: true,
    destructiveHint: false,
    openWorldHint: false,
    idempotentHint: true
  };
}
