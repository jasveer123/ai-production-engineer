import { z } from "zod"

export const sourceSchema = z.object({
  ref: z.string(),
  kind: z.string(),
  id: z.string().nullable(),
  title: z.string(),
})
export type ChatSource = z.infer<typeof sourceSchema>

export const messageSchema = z.object({
  id: z.number(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  sources: z.array(sourceSchema),
  createdAt: z.string(),
})
export type ChatMessage = z.infer<typeof messageSchema>

export const conversationSchema = z.object({
  id: z.string(),
  title: z.string(),
  updatedAt: z.string(),
})
export type Conversation = z.infer<typeof conversationSchema>

export const conversationDetailSchema = conversationSchema.extend({
  messages: z.array(messageSchema),
})
export type ConversationDetail = z.infer<typeof conversationDetailSchema>
