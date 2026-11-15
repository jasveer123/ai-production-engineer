import { hostname } from 'node:os';
import { checkDns } from './checkers/dns';
import { checkHttp } from './checkers/http';
import { checkMail } from './checkers/mail';
import { checkPing } from './checkers/ping';
import { checkTcp } from './checkers/tcp';
import { checkUdp } from './checkers/udp';
import type { CheckContext, CheckResult, CheckTarget } from './checkers/types';

export type { CheckContext, CheckResult, CheckTarget } from './checkers/types';
export { certificateExpiry, domainExpiry } from './checkers/expiry';

// There is one probe today: the machine running the API. Results say so instead of claiming a region.
export const PROBE_LOCATION = `This server (${hostname()})`;

export function checkMonitor(target: CheckTarget, ctx: CheckContext): Promise<CheckResult> {
  switch (target.monitorKind) {
    case 'http':
    case 'keyword':
    case 'status':
      return checkHttp(target, ctx);
    case 'ping':
      return checkPing(target, ctx);
    case 'tcp':
      return checkTcp(target, ctx);
    case 'udp':
      return checkUdp(target, ctx);
    case 'smtp':
    case 'pop3':
    case 'imap':
      return checkMail(target, ctx);
    case 'dns':
      return checkDns(target, ctx);
  }
}
