import { captureException, log, shutdown, start } from '@ape/agent';

start({ service: 'agent-smoke-test', environment: 'development' });
log('info', 'Hello from @ape/agent');
try {
  JSON.parse('{oops');
} catch (err) {
  captureException(err, { route: '/smoke-test' });
}
await shutdown();
console.log('sent');
