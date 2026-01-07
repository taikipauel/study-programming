import { z } from "zod";
import * as yup from "yup";

export const OperationSchema = z.enum(["rewrite", "summarize", "explain", "suggest"]);
export type Operation = z.infer<typeof OperationSchema>;

export const BaseRequestSchema = z.object({
  text: z.string().min(1),
  stream: z.boolean().optional().default(false),
  locale: z.string().optional(),
  model: z.string().optional(),
});

export const RewriteRequestSchema = BaseRequestSchema.extend({
  tone: z.string().optional(),
});

export const SummarizeRequestSchema = BaseRequestSchema.extend({
  maxSentences: z.number().int().min(1).max(10).optional(),
});

export const ExplainRequestSchema = BaseRequestSchema.extend({
  level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
});

export const SuggestRequestSchema = BaseRequestSchema.extend({
  maxSuggestions: z.number().int().min(1).max(10).optional(),
});

export const ResponseSchema = z.object({
  id: z.string(),
  operation: OperationSchema,
  output: z.string(),
  usage: z.object({
    inputTokens: z.number().int().min(0),
    outputTokens: z.number().int().min(0),
  }),
  costUSD: z.number().min(0).optional(),
});

export type BaseRequest = z.infer<typeof BaseRequestSchema>;
export type RewriteRequest = z.infer<typeof RewriteRequestSchema>;
export type SummarizeRequest = z.infer<typeof SummarizeRequestSchema>;
export type ExplainRequest = z.infer<typeof ExplainRequestSchema>;
export type SuggestRequest = z.infer<typeof SuggestRequestSchema>;
export type ServerResponse = z.infer<typeof ResponseSchema>;

export const baseRequestYupSchema = yup.object({
  text: yup.string().required(),
  stream: yup.boolean().optional(),
  locale: yup.string().optional(),
  model: yup.string().optional(),
});

export const rewriteRequestYupSchema = baseRequestYupSchema.shape({
  tone: yup.string().optional(),
});

export const summarizeRequestYupSchema = baseRequestYupSchema.shape({
  maxSentences: yup.number().integer().min(1).max(10).optional(),
});

export const explainRequestYupSchema = baseRequestYupSchema.shape({
  level: yup.mixed<"beginner" | "intermediate" | "advanced">().oneOf([
    "beginner",
    "intermediate",
    "advanced",
  ]),
});

export const suggestRequestYupSchema = baseRequestYupSchema.shape({
  maxSuggestions: yup.number().integer().min(1).max(10).optional(),
});

export const responseYupSchema = yup.object({
  id: yup.string().required(),
  operation: yup
    .mixed<Operation>()
    .oneOf(["rewrite", "summarize", "explain", "suggest"])
    .required(),
  output: yup.string().required(),
  usage: yup
    .object({
      inputTokens: yup.number().integer().min(0).required(),
      outputTokens: yup.number().integer().min(0).required(),
    })
    .required(),
  costUSD: yup.number().min(0).optional(),
});
