import "dotenv/config";
import type { Request, Response } from "express";
import cors from "cors";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createSajangnimSupportMcpServer } from "./server.js";

const transportMode = (process.env.MCP_TRANSPORT ?? "http").toLowerCase();

if (transportMode === "stdio") {
  await startStdioServer();
} else {
  startHttpServer();
}

async function startStdioServer(): Promise<void> {
  const server = createSajangnimSupportMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function startHttpServer(): void {
  const host = process.env.HOST ?? "127.0.0.1";
  const port = Number(process.env.PORT ?? "3000");
  const mcpPath = normalizePath(process.env.MCP_PATH ?? "/mcp");
  const app = createMcpExpressApp({ host });

  const corsOrigin = process.env.CORS_ORIGIN?.trim();
  if (corsOrigin) {
    app.use(cors({ origin: corsOrigin.split(",").map((origin) => origin.trim()) }));
  } else {
    app.use(cors());
  }

  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      name: "moneyfit-mcp",
      transport: "streamable-http",
      mcpPath
    });
  });

  app.post(mcpPath, async (req: Request, res: Response) => {
    const server = createSajangnimSupportMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("Error handling MCP request:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error"
          },
          id: null
        });
      }
    } finally {
      res.on("close", () => {
        void transport.close();
        void server.close();
      });
    }
  });

  app.get(mcpPath, (_req: Request, res: Response) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed. Use POST for Streamable HTTP MCP requests."
      },
      id: null
    });
  });

  app.delete(mcpPath, (_req: Request, res: Response) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Method not allowed for stateless MVP server."
      },
      id: null
    });
  });

  // TODO(PlayMCP): If the official PlayMCP console requires custom auth headers,
  // add that verification middleware here instead of guessing the private spec.
  const httpServer = app.listen(port, host, () => {
    console.log(`Sajangnim Support MCP listening on http://${host}:${port}${mcpPath}`);
  });

  process.on("SIGINT", () => {
    httpServer.close(() => process.exit(0));
  });
}

function normalizePath(value: string): string {
  return value.startsWith("/") ? value : `/${value}`;
}
