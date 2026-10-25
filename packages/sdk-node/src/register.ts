// `node --require @ape/agent/register app.js` (or NODE_OPTIONS) starts the agent from env vars,
// before any app code loads, with no code change.
import { start } from './index.ts';

start();
