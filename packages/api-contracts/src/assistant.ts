import { z } from 'zod';
import type { IsoTimestamp, Uuid } from './common';

export const MAX_QUESTION_CHARS = 2000;

export const askSchema = z.object({ message: z.string().trim().min(1).max(MAX_QUESTION_CHARS) });
export type AskInput = z.infer<typeof askSchema>;

export interface ChatSource {
  ref: string;
  kind: string;
  id: Uuid | null;
  title: string;
}

export interface ChatMessageView {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  sources: ChatSource[];
  createdAt: IsoTimestamp;
}

export interface ChatConversationView {
  id: Uuid;
  title: string;
  updatedAt: IsoTimestamp;
}

export interface ChatConversationDetail extends ChatConversationView {
  messages: ChatMessageView[];
}
