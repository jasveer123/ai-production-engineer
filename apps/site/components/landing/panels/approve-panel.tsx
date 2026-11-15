import { GitPullRequest, ShieldCheck, UserRound } from 'lucide-react';

export function ApprovePanel() {
  return (
    <div className="px-panel">
      <div className="px-panel-head">
        <GitPullRequest size={14} />
        <span>Pull request #2291</span>
        <span className="px-pending">Awaiting review</span>
      </div>
      <h4>fix(checkout): restore query timeout and bound pool waits</h4>
      <ul className="px-attached">
        <li>Root cause report with 24 citations</li>
        <li>Sandbox run: reproduction and 128 tests</li>
        <li>Rollback plan</li>
      </ul>
      <div className="px-reviewer">
        <span className="px-avatar">
          <UserRound size={14} />
        </span>
        <span>On-call engineer reviewing</span>
      </div>
      <div className="px-approve-row">
        <span className="px-approve-btn">Approve and merge</span>
        <span className="px-ghost-btn">Request changes</span>
      </div>
      <p className="px-panel-foot">
        <ShieldCheck size={14} /> Policy: production writes need one human approval.
      </p>
    </div>
  );
}
