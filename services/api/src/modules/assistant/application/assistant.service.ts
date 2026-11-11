import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq } from 'drizzle-orm';
import type {
  ChatConversationDetail,
  ChatConversationView,
  ChatMessageView,
  ChatSource,
} from '@ape/api-contracts';
import { ApiException, notFound } from '../../../core/common/errors';
import type { ActorContext } from '../../../core/common/request-context';
import { ENV, type ApiEnv } from '../../../core/config/config.module';
import { DB } from '../../../core/db/database.module';
import type { Database } from '../../../core/db/client';
import { chatConversations, chatMessages } from '../../../core/db/schema';
import { WorkspaceContext } from './workspace-context';

type MessageRow = typeof chatMessages.$inferSelect;

interface WorkerReply {
  answer: string;
  sources: string[];
}

const HISTORY_TURNS = 10;
const TITLE_CHARS = 60;

const toMessage = (m: MessageRow): ChatMessageView => ({
  id: m.id,
  role: m.role as 'user' | 'assistant',
  content: m.content,
  sources: m.sources,
  createdAt: m.createdAt.toISOString(),
});

@Injectable()
export class AssistantService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: ApiEnv,
    private readonly context: WorkspaceContext,
  ) {}

  async list(actor: ActorContext): Promise<ChatConversationView[]> {
    const rows = await this.db
      .select()
      .from(chatConversations)
      .where(
        and(
          eq(chatConversations.workspaceId, actor.workspaceId),
          eq(chatConversations.userId, actor.userId),
        ),
      )
      .orderBy(desc(chatConversations.updatedAt))
      .limit(50);
    return rows.map((r) => ({ id: r.id, title: r.title, updatedAt: r.updatedAt.toISOString() }));
  }

  private async find(actor: ActorContext, id: string) {
    const [row] = await this.db
      .select()
      .from(chatConversations)
      .where(
        and(
          eq(chatConversations.id, id),
          eq(chatConversations.workspaceId, actor.workspaceId),
          eq(chatConversations.userId, actor.userId),
        ),
      );
    if (!row) throw notFound('Conversation');
    return row;
  }

  async get(actor: ActorContext, id: string): Promise<ChatConversationDetail> {
    const row = await this.find(actor, id);
    const messages = await this.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, id))
      .orderBy(asc(chatMessages.createdAt), asc(chatMessages.id));
    return {
      id: row.id,
      title: row.title,
      updatedAt: row.updatedAt.toISOString(),
      messages: messages.map(toMessage),
    };
  }

  async remove(actor: ActorContext, id: string): Promise<void> {
    await this.find(actor, id);
    await this.db.delete(chatConversations).where(eq(chatConversations.id, id));
  }

  async ask(
    actor: ActorContext,
    conversationId: string | null,
    message: string,
  ): Promise<ChatConversationDetail> {
    const conversation = conversationId
      ? await this.find(actor, conversationId)
      : (
          await this.db
            .insert(chatConversations)
            .values({
              workspaceId: actor.workspaceId,
              userId: actor.userId,
              title: message.slice(0, TITLE_CHARS),
            })
            .returning()
        )[0]!;
    const history = await this.db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, conversation.id))
      .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
      .limit(HISTORY_TURNS);
    const items = await this.context.build(actor, message);
    const reply = await this.callWorker({
      messages: [
        ...history.reverse().map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: message },
      ],
      items: items.map(({ id: _id, ...item }) => item),
    });

    const sources: ChatSource[] = reply.sources.flatMap((ref) => {
      const item = items.find((i) => i.ref === ref);
      return item ? [{ ref, kind: item.kind, id: item.id, title: item.title }] : [];
    });
    await this.db.insert(chatMessages).values([
      { conversationId: conversation.id, role: 'user', content: message },
      { conversationId: conversation.id, role: 'assistant', content: reply.answer, sources },
    ]);
    await this.db
      .update(chatConversations)
      .set({ updatedAt: new Date() })
      .where(eq(chatConversations.id, conversation.id));
    return this.get(actor, conversation.id);
  }

  private async callWorker(body: unknown): Promise<WorkerReply> {
    let res: Response;
    try {
      res = await fetch(`${this.env.AI_WORKER_URL}/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.env.AI_CHAT_TIMEOUT_MS),
      });
    } catch {
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'assistant_unavailable',
        'The assistant is not reachable right now. Try again in a moment.',
      );
    }
    if (!res.ok) {
      const detail = (await res.json().catch(() => ({}))) as { reason?: string };
      const notConfigured = detail.reason === 'no_model_configured';
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        notConfigured ? 'assistant_not_configured' : 'assistant_failed',
        notConfigured
          ? 'No AI model is configured for this deployment yet.'
          : 'The assistant could not answer right now. Try again.',
      );
    }
    return (await res.json()) as WorkerReply;
  }
}
