"use client"

import type { Incident } from "../schemas"
import { FixPanel } from "./fix-panel"
import { InvestigationPanel } from "./investigation-panel"
import { StoryChapter, type ChapterState } from "./story-chapter"
import { TimelineList } from "./timeline-list"
import { VerificationPanel } from "./verification-panel"

interface IncidentStoryProps {
  workspaceId: string
  incident: Incident
  canAct: boolean
}

const FIX_STATUSES = ["fix_proposed", "validation", "awaiting_review", "validation_failed"]
const PROOF_STATUSES = ["monitoring", "verification_inconclusive", "resolved"]

export function chapterStates(
  status: string
): [ChapterState, ChapterState, ChapterState, ChapterState] {
  const fixStarted = FIX_STATUSES.includes(status) || PROOF_STATUSES.includes(status)
  const proofStarted = PROOF_STATUSES.includes(status)
  return [
    "done",
    fixStarted ? "done" : status === "closed_without_fix" ? "done" : "active",
    FIX_STATUSES.includes(status) ? "active" : proofStarted ? "done" : "pending",
    status === "resolved" ? "done" : proofStarted ? "active" : "pending",
  ]
}

function summaries(incident: Incident, states: ChapterState[]) {
  const since = new Date(incident.firstSeenAt).toLocaleString()
  return [
    `${incident.eventCount.toLocaleString()} events since ${since}. Here is what we saw, in order.`,
    states[1] === "active"
      ? "The AI is reading the logs, errors and code to find the cause. Every claim points to evidence."
      : "This is what the AI found, with the evidence behind each claim.",
    states[2] === "pending"
      ? "Once the cause is clear, a fix is drafted and tested here. Nothing changes without a person approving it."
      : states[2] === "active"
        ? "A tested fix is ready. Read the change, then approve or reject it."
        : "The approved fix and its test results.",
    states[3] === "pending"
      ? "After a fix ships, we watch production until the error rate is back to normal."
      : states[3] === "done"
        ? "Production is healthy again. This is the proof."
        : "We are watching production to prove the fix worked.",
  ]
}

export function IncidentStory({ workspaceId, incident, canAct }: IncidentStoryProps) {
  const states = chapterStates(incident.status)
  const text = summaries(incident, states)

  return (
    <ol aria-label="Incident story" className="grid">
      <StoryChapter index={1} title="What happened" summary={text[0]!} state={states[0]}>
        <TimelineList workspaceId={workspaceId} incidentId={incident.id} />
      </StoryChapter>
      <StoryChapter index={2} title="Why it happened" summary={text[1]!} state={states[1]}>
        <InvestigationPanel workspaceId={workspaceId} incident={incident} canAct={canAct} />
      </StoryChapter>
      <StoryChapter index={3} title="The fix" summary={text[2]!} state={states[2]}>
        <FixPanel workspaceId={workspaceId} incident={incident} canAct={canAct} />
      </StoryChapter>
      <StoryChapter index={4} title="Proof it is fixed" summary={text[3]!} state={states[3]} last>
        <VerificationPanel workspaceId={workspaceId} incidentId={incident.id} />
      </StoryChapter>
    </ol>
  )
}
