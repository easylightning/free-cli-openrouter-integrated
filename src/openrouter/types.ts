import { z } from "zod";

// ─── Pricing ────────────────────────────────────────────────────────────────

export const PricingSchema = z
  .object({
    prompt: z.string(),
    completion: z.string(),
    request: z.string().optional(),
    image: z.string().optional(),
    audio: z.string().optional(),
    web_search: z.string().optional(),
  })
  .catchall(z.string()); // unknown pricing fields are captured

export type Pricing = z.infer<typeof PricingSchema>;

// ─── Architecture ────────────────────────────────────────────────────────────

export const ArchitectureSchema = z.object({
  input_modalities: z.array(z.string()).optional(),
  output_modalities: z.array(z.string()).optional(),
  tokenizer: z.string().optional(),
  instruct_type: z.string().nullable().optional(),
});

export type Architecture = z.infer<typeof ArchitectureSchema>;

// ─── TopProvider ─────────────────────────────────────────────────────────────

export const TopProviderSchema = z.object({
  max_completion_tokens: z.number().nullable().optional(),
  is_moderated: z.boolean().optional(),
});

export type TopProvider = z.infer<typeof TopProviderSchema>;

// ─── OpenRouter Model ────────────────────────────────────────────────────────

export const OpenRouterModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  context_length: z.number().optional(),
  pricing: PricingSchema.optional(),
  architecture: ArchitectureSchema.optional(),
  top_provider: TopProviderSchema.optional(),
  supported_parameters: z.array(z.string()).optional(),
  created: z.number().optional(),
});

export type OpenRouterModel = z.infer<typeof OpenRouterModelSchema>;

// ─── Models API Response ─────────────────────────────────────────────────────

export const ModelsResponseSchema = z.object({
  data: z.array(OpenRouterModelSchema),
});

export type ModelsResponse = z.infer<typeof ModelsResponseSchema>;

// ─── Chat Message ────────────────────────────────────────────────────────────

export const MessageRoleSchema = z.enum(["system", "user", "assistant"]);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

export const ChatMessageSchema = z.object({
  role: MessageRoleSchema,
  content: z.string(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

// ─── Chat Request ─────────────────────────────────────────────────────────────

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  stream: boolean;
  max_tokens?: number;
}

// ─── Chat Response (non-streaming) ───────────────────────────────────────────

export const ChatChoiceSchema = z.object({
  message: ChatMessageSchema,
  finish_reason: z.string().nullable().optional(),
  index: z.number().optional(),
});

export const ChatResponseSchema = z.object({
  id: z.string().optional(),
  choices: z.array(ChatChoiceSchema),
  usage: z
    .object({
      prompt_tokens: z.number().optional(),
      completion_tokens: z.number().optional(),
      total_tokens: z.number().optional(),
    })
    .optional(),
});

export type ChatResponse = z.infer<typeof ChatResponseSchema>;

// ─── Streaming Delta ─────────────────────────────────────────────────────────

export const StreamDeltaSchema = z.object({
  role: MessageRoleSchema.optional(),
  content: z.string().nullable().optional(),
});

export const StreamChoiceSchema = z.object({
  delta: StreamDeltaSchema,
  finish_reason: z.string().nullable().optional(),
  index: z.number().optional(),
});

export const StreamChunkSchema = z.object({
  id: z.string().optional(),
  choices: z.array(StreamChoiceSchema),
});

export type StreamChunk = z.infer<typeof StreamChunkSchema>;

// ─── OpenRouter Error ────────────────────────────────────────────────────────

export const OpenRouterErrorSchema = z.object({
  error: z.object({
    message: z.string(),
    code: z.number().optional(),
    type: z.string().optional(),
  }),
});

export type OpenRouterError = z.infer<typeof OpenRouterErrorSchema>;
