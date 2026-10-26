import { z } from 'zod';

export const approvalPolicySchema = z.object({
  /** Lowest role allowed to approve opening a pull request. */
  prMinRole: z.enum(['owner', 'admin', 'engineer']),
});
export type ApprovalPolicyInput = z.infer<typeof approvalPolicySchema>;
