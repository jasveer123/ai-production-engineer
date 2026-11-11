import { bigserial, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users, workspaceRef } from './identity-and-tenancy';
import { id, timestamps } from './helpers';

export interface StoredSource {
  ref: string;
  kind: string;
  id: string | null;
  title: string;
}

export const chatConversations = pgTable(
  'chat_conversations',
  {
    id: id(),
    workspaceId: workspaceRef(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    ...timestamps(),
  },
  (t) => [index('chat_conversations_user_idx').on(t.workspaceId, t.userId, t.updatedAt)],
);

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => chatConversations.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    content: text('content').notNull(),
    sources: jsonb('sources').$type<StoredSource[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('chat_messages_conversation_idx').on(t.conversationId, t.createdAt)],
);
