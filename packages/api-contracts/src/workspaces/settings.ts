import { z } from 'zod';
import { roleSchema } from '../common';
import { severitySchema } from '../incidents/status';

export const approvalPolicySchema = z.object({ prMinRole: roleSchema.exclude(['viewer']) });
export type ApprovalPolicyInput = z.infer<typeof approvalPolicySchema>;

export const severityRuleSchema = z.object({
  environment: z.string().max(40).optional(),
  serviceName: z.string().max(100).optional(),
  errorType: z.string().max(200).optional(),
  severity: severitySchema,
});
export const severityRulesSchema = z.object({ rules: z.array(severityRuleSchema).max(50) });
export type SeverityRule = z.infer<typeof severityRuleSchema>;
