import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import type { DeliveryAttemptView, NotificationChannel } from '@ape/api-contracts';
import type { App } from 'supertest/types';
import { OutboxPublisher } from '../src/core/temporal/outbox-publisher.service';
import { TemporalService } from '../src/core/temporal/temporal.service';
import { createTestApp, createWorkspace, loginAs, resetDatabase } from './helpers';

interface Received {
  path: string;
  headers: IncomingHttpHeaders;
  body: string;
}

describe('SMS, phone and push channels (e2e)', () => {
  let app: INestApplication<App>;
  let receiver: Server;
  let base: string;
  const received: Received[] = [];

  beforeAll(async () => {
    receiver = createServer((req, res) => {
      let body = '';
      req.on('data', (c: Buffer) => (body += c.toString()));
      req.on('end', () => {
        received.push({ path: req.url ?? '', headers: req.headers, body });
        res.writeHead(201).end('{}');
      });
    });
    await new Promise<void>((r) => receiver.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${(receiver.address() as AddressInfo).port}`;
    Object.assign(process.env, {
      TWILIO_API_URL: base,
      TWILIO_ACCOUNT_SID: 'ACtest',
      TWILIO_AUTH_TOKEN: 'secret-token',
      TWILIO_FROM: '+15550001111',
    });
    app = await createTestApp();
    jest.spyOn(app.get(TemporalService), 'startIncidentWorkflow').mockResolvedValue('started');
  });
  beforeEach(async () => {
    await resetDatabase();
    received.length = 0;
  });
  afterAll(async () => {
    receiver.close();
    await app.close();
    for (const key of ['TWILIO_API_URL', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM'])
      delete process.env[key];
  });

  it('texts, calls and pushes when an incident opens, and masks the phone number', async () => {
    const owner = await loginAs(app, 'owner@channels.test');
    const ws = (await createWorkspace(owner, 'Channels')).id;
    const add = (body: Record<string, unknown>) =>
      owner
        .post(`/workspaces/${ws}/notifications/channels`)
        .send({ events: ['incident.detected'], ...body });

    const sms = (await add({ kind: 'sms', name: 'Oncall SMS', phone: '+14155550123' }).expect(201))
      .body as NotificationChannel;
    expect(sms.target).toBe('+14••••123');
    await add({ kind: 'phone', name: 'Oncall call', phone: '+14155550124' }).expect(201);
    await add({ kind: 'push', name: 'Phone push', url: `${base}/my-topic` }).expect(201);
    await add({ kind: 'sms', name: 'Bad', phone: '4155550123' }).expect(400);

    await owner
      .post(`/workspaces/${ws}/incidents`)
      .send({ title: 'Checkout <b>down</b>', severity: 'critical' })
      .expect(201);
    await app.get(OutboxPublisher).publishBatch();

    const byPath = (part: string) => received.find((r) => r.path.includes(part))!;
    const message = byPath('/Messages.json');
    expect(message.path).toBe('/2010-04-01/Accounts/ACtest/Messages.json');
    expect(message.headers.authorization).toBe(
      `Basic ${Buffer.from('ACtest:secret-token').toString('base64')}`,
    );
    const form = new URLSearchParams(message.body);
    expect(form.get('To')).toBe('+14155550123');
    expect(form.get('From')).toBe('+15550001111');
    expect(form.get('Body')).toContain('Checkout <b>down</b>');

    const call = new URLSearchParams(byPath('/Calls.json').body);
    expect(call.get('To')).toBe('+14155550124');
    expect(call.get('Twiml')).toContain('Checkout &lt;b&gt;down&lt;/b&gt;');

    const push = byPath('/my-topic');
    expect(push.headers.priority).toBe('4');
    expect(push.headers.title).toContain('critical incident');
    expect(push.body).toContain('Checkout');

    const deliveries = (await owner.get(`/workspaces/${ws}/notifications/deliveries`).expect(200))
      .body as DeliveryAttemptView[];
    expect(deliveries).toHaveLength(3);
    for (const d of deliveries) expect(['delivered', 'provider_accepted']).toContain(d.state);
  });
});
