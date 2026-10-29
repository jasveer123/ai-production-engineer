import {
  booleanFlag,
  boundedInt,
  DAY,
  MINUTE,
  nonNegativeInt,
  positiveInt,
  SECOND,
} from './helpers';

export const workflowsEnv = {
  AUTO_INVESTIGATE: booleanFlag.default('true'),
  VERIFY_GRACE_MS: nonNegativeInt(2 * MINUTE),
  VERIFY_WINDOW_MS: positiveInt(30 * MINUTE),
  VERIFY_MAX_WINDOWS: boundedInt(1, 10, 3),
  VERIFY_SETTLE_MS: nonNegativeInt(45 * SECOND),
  VERIFY_CHECK_EVERY_MS: positiveInt(5 * MINUTE),
  VERIFY_DEPLOY_WAIT_MS: positiveInt(7 * DAY),
  VERIFY_DEPLOY_POLL_MS: positiveInt(5 * MINUTE),
  VERIFY_MIN_ERRORS: positiveInt(3),
  VERIFY_MIN_REQUESTS: positiveInt(20),
  HEARTBEAT_CHECK_INTERVAL_MS: positiveInt(15 * SECOND),
  REALTIME_ENABLED: booleanFlag.default('true'),
  REALTIME_BATCH_MS: positiveInt(500),
  REALTIME_RECHECK_MS: positiveInt(MINUTE),
};
