import { z } from 'zod';
import { severitySchema } from './incidents';

export const severityRuleSchema = z.object({
  environment: z.string().max(40).optional(),
  serviceName: z.string().max(100).optional(),
  errorType: z.string().max(200).optional(),
  severity: severitySchema,
});
export const severityRulesSchema = z.object({ rules: z.array(severityRuleSchema).max(50) });
export type SeverityRule = z.infer<typeof severityRuleSchema>;
