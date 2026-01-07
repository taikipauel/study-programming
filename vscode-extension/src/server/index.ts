import http, { IncomingMessage, ServerResponse } from "http";
import { WebSocketServer } from "ws";
import {
  ExplainRequest,
  ExplainRequestSchema,
  RewriteRequest,
  RewriteRequestSchema,
  SuggestRequest,
  SuggestRequestSchema,
  SummarizeRequest,
  SummarizeRequestSchema,
  explainRequestYupSchema,
  rewriteRequestYupSchema,
  suggestRequestYupSchema,
  summarizeRequestYupSchema,
} from "./schema";
import { buildBillingSummary } from "./billing";
import { recordMetrics } from "./metrics";

export type ServerOptions = {
  port: number;
};

type Operation = "rewrite" | "summarize" | "explain" | "suggest";

const requestSchemas = {
  rewrite: RewriteRequestSchema,
  summarize: SummarizeRequestSchema,
  explain: ExplainRequestSchema,
  suggest: SuggestRequestSchema,
} satisfies Record<Operation, unknown>;

const yupSchemas = {
  rewrite: rewriteRequestYupSchema,
  summarize: summarizeRequestYupSchema,
  explain: explainRequestYupSchema,
  suggest: suggestRequestYupSchema,
} satisfies Record<Operation, unknown>;

const countTokens = (text: string): number => {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }
  return trimmed.split(/\s+/).length;
};

const chunkText = (text: string): string[] => {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [text];
  }
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += 4) {
    chunks.push(words.slice(i, i + 4).join(" "));
  }
  return chunks;
};

const generateOutput = (
  operation: Operation,
  request: RewriteRequest | SummarizeRequest | ExplainRequest | SuggestRequest,
): string => {
  switch (operation) {
    case "rewrite":
      return `Rewritten${"tone" in request && request.tone ? ` (${request.tone})` : ""}: ${request.text}`;
    case "summarize": {
      const sentences = request.text.split(/(?<=[.!?])\s+/).filter(Boolean);
      const maxSentences = "maxSentences" in request && request.maxSentences ? request.maxSentences : 2;
      return `Summary: ${sentences.slice(0, maxSentences).join(" ") || request.text}`;
    }
    case "explain":
      return `Explanation${"level" in request && request.level ? ` (${request.level})` : ""}: ${request.text}`;
    case "suggest": {
      const maxSuggestions =
        "maxSuggestions" in request && request.maxSuggestions ? request.maxSuggestions : 3;
      const suggestions = Array.from({ length: maxSuggestions }, (_, index) =>
        `Suggestion ${index + 1}: ${request.text}`,
      );
      return suggestions.join("\n");
    }
  }
};

const getOperationFromPath = (path: string): Operation | null => {
  switch (path) {
    case "/rewrite":
      return "rewrite";
    case "/summarize":
      return "summarize";
    case "/explain":
      return "explain";
    case "/suggest":
      return "suggest";
    default:
      return null;
  }
};

const parseRequestBody = async (req: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf-8");
  return raw ? JSON.parse(raw) : {};
};

const validateRequest = async <T>(operation: Operation, payload: unknown): Promise<T> => {
  const schema = requestSchemas[operation] as { parse: (value: unknown) => T };
  const yupSchema = yupSchemas[operation] as { validate: (value: unknown) => Promise<unknown> };
  const parsed = schema.parse(payload);
  await yupSchema.validate(parsed);
  return parsed;
};

const buildResponse = (operation: Operation, output: string, inputTokens: number, model?: string) => {
  const outputTokens = countTokens(output);
  const billing = buildBillingSummary(inputTokens, outputTokens);
  recordMetrics({
    operation,
    model,
    inputTokens,
    outputTokens,
    costUSD: billing.costUSD,
    timestamp: Date.now(),
  });

  return {
    id: `${operation}-${Date.now()}`,
    operation,
    output,
    usage: {
      inputTokens,
      outputTokens,
    },
    costUSD: billing.costUSD,
  };
};

const streamHttpResponse = (
  res: ServerResponse,
  operation: Operation,
  output: string,
  inputTokens: number,
  model?: string,
) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    Connection: "keep-alive",
    "Cache-Control": "no-cache",
  });
  const chunks = chunkText(output);
  chunks.forEach((chunk, index) => {
    res.write(`data: ${JSON.stringify({ type: "chunk", index, value: chunk })}\n\n`);
  });
  const response = buildResponse(operation, output, inputTokens, model);
  res.write(`data: ${JSON.stringify({ type: "done", response })}\n\n`);
  res.end();
};

const sendJson = (res: ServerResponse, status: number, payload: unknown) => {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
};

const handleHttpRequest = async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const operation = getOperationFromPath(url.pathname);

  if (!operation) {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const payload = await parseRequestBody(req);
    const parsed = await validateRequest<
      RewriteRequest | SummarizeRequest | ExplainRequest | SuggestRequest
    >(operation, payload);
    const output = generateOutput(operation, parsed);
    const inputTokens = countTokens(parsed.text);

    if (parsed.stream) {
      streamHttpResponse(res, operation, output, inputTokens, parsed.model);
      return;
    }

    const response = buildResponse(operation, output, inputTokens, parsed.model);
    sendJson(res, 200, response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    sendJson(res, 400, { error: message });
  }
};

const handleWebSocketConnection = (socket: import("ws").WebSocket) => {
  socket.on("message", async (raw) => {
    try {
      const message = JSON.parse(raw.toString());
      const operation = message.operation as Operation;
      if (!operation || !(operation in requestSchemas)) {
        socket.send(JSON.stringify({ type: "error", error: "Unknown operation" }));
        return;
      }
      const parsed = await validateRequest<
        RewriteRequest | SummarizeRequest | ExplainRequest | SuggestRequest
      >(operation, message.payload);
      const output = generateOutput(operation, parsed);
      const inputTokens = countTokens(parsed.text);

      if (parsed.stream) {
        chunkText(output).forEach((chunk, index) => {
          socket.send(JSON.stringify({ type: "chunk", index, value: chunk }));
        });
      }

      const response = buildResponse(operation, output, inputTokens, parsed.model);
      socket.send(JSON.stringify({ type: "done", response }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid request";
      socket.send(JSON.stringify({ type: "error", error: message }));
    }
  });
};

export const startServer = ({ port }: ServerOptions) => {
  const server = http.createServer((req, res) => {
    void handleHttpRequest(req, res);
  });
  const wss = new WebSocketServer({ server });

  wss.on("connection", (socket) => {
    handleWebSocketConnection(socket);
  });

  server.listen(port);
  return { server, wss };
};
