// Sends a log line and an error, then exits. Good first check that the token works:
//   APE_TOKEN=ape_live_... APE_ENDPOINT=http://localhost:4000 node examples/send-test-data.mjs
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
