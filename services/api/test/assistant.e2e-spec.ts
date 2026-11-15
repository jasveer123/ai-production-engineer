import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import type { ChatConversationDetail, ChatConversationView } from '@ape/api-contracts';
import type { App } from 'supertest/types';
import { createTestApp, createWorkspace, loginAs, resetDatabase } from './helpers';

interface Seen {
  messages: { role: string; content: string }[];
  items: { ref: string; kind: string; title: string; content: string }[];
}

describe('AI assistant chat (e2e)', () => {
  let app: INestApplication<App>;
  let worker: Server;
  let seen: Seen[] = [];
  let mode: 'ok' | 'no_model' | 'down' = 'ok';

  beforeAll(async () => {
    worker = createServer((req, res) => {
      let body = '';
      req.on('data', (c: Buffer) => (body += c.toString()));
      req.on('end', () => {
        seen.push(JSON.parse(body) as Seen);
        res.setHeader('content-type', 'application/json');
        if (mode === 'no_model') {
          res.statusCode = 503;
          res.end(JSON.stringify({ reason: 'no_model_configured' }));
          return;
        }
        res.end(JSON.stringify({ answer: 'Checkout is failing.', sources: ['C2', 'C99'] }));
      });
    });
    await new Promise<void>((resolve) => worker.listen(0, '127.0.0.1', resolve));
    process.env.AI_WORKER_URL = `http://127.0.0.1:${(worker.address() as AddressInfo).port}`;
    app = await createTestApp();
  });
  beforeEach(async () => {
    seen = [];
    mode = 'ok';
    await resetDatabase();
  });
  afterAll(async () => {
    await new Promise((resolve) => worker.close(resolve));
    await app.close();
  });

  it('answers from workspace context, keeps history and only real sources', async () => {
    const owner = await loginAs(app, 'owner@assistant.test');
    const ws = (await createWorkspace(owner, 'Assistant')).id;
    await owner
      .post(`/workspaces/${ws}/incidents`)
      .send({ title: 'Checkout fails', severity: 'high' })
      .expect(201);

    const first = (
      await owner
        .post(`/workspaces/${ws}/assistant/conversations`)
        .send({ message: 'What is broken right now?' })
        .expect(201)
    ).body as ChatConversationDetail;
    expect(first.messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(first.title).toBe('What is broken right now?');
    expect(seen[0]!.items[0]).toMatchObject({ ref: 'C1', kind: 'summary' });
    expect(seen[0]!.items[0]!.content).toContain('Open incidents: 1');
    expect(seen[0]!.items[1]).toMatchObject({
      ref: 'C2',
      kind: 'incident',
      title: 'Checkout fails',
    });
    const answer = first.messages[1]!;
    expect(answer.sources).toHaveLength(1);
    expect(answer.sources[0]).toMatchObject({
      ref: 'C2',
      kind: 'incident',
      title: 'Checkout fails',
    });
    expect(answer.sources[0]!.id).toBeTruthy();

    const second = (
      await owner
        .post(`/workspaces/${ws}/assistant/conversations/${first.id}/messages`)
        .send({ message: 'Who owns it?' })
        .expect(200)
    ).body as ChatConversationDetail;
    expect(second.messages).toHaveLength(4);
    expect(seen[1]!.messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);

    const list = (await owner.get(`/workspaces/${ws}/assistant/conversations`).expect(200))
      .body as ChatConversationView[];
    expect(list).toHaveLength(1);
  });

  it('reports a missing model clearly and keeps conversations private', async () => {
    const owner = await loginAs(app, 'owner@assistant2.test');
    const ws = (await createWorkspace(owner, 'Assistant2')).id;
    mode = 'no_model';
    const res = await owner
      .post(`/workspaces/${ws}/assistant/conversations`)
      .send({ message: 'hello' })
      .expect(503);
    expect((res.body as { code: string }).code).toBe('assistant_not_configured');

    mode = 'ok';
    const convo = (
      await owner
        .post(`/workspaces/${ws}/assistant/conversations`)
        .send({ message: 'hi' })
        .expect(201)
    ).body as ChatConversationDetail;
    await owner
      .post(`/workspaces/${ws}/invitations`)
      .send({ email: 'eng@assistant2.test', role: 'engineer' })
      .expect(201);
    const eng = await loginAs(app, 'eng@assistant2.test');
    await eng.get(`/workspaces/${ws}/assistant/conversations/${convo.id}`).expect(404);
    await owner.delete(`/workspaces/${ws}/assistant/conversations/${convo.id}`).expect(204);
  });
});
