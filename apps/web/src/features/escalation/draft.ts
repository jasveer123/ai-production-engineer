import type { BranchRequest, Condition, Policy, Step, StepRequest, TargetRequest } from "./schemas"

export interface DraftStep {
  waitMinutes: number
  targets: string[]
  channels: string[]
}

export interface DraftBranch {
  name: string
  when: Condition
  steps: DraftStep[]
}

export interface TargetOption {
  key: string
  label: string
}

export const EVERYONE = "everyone"

export const emptyStep = (waitMinutes: number): DraftStep => ({
  waitMinutes,
  targets: [],
  channels: ["email"],
})

const keyOfTarget = (target: Step["targets"][number]) =>
  target.kind === "everyone"
    ? EVERYONE
    : `${target.kind}:${target.scheduleId ?? target.userId ?? target.channelId}`

const toTarget = (key: string): TargetRequest => {
  if (key === EVERYONE) return { kind: "everyone" }
  const [kind, id] = key.split(":") as ["schedule" | "user" | "channel", string]
  if (kind === "schedule") return { kind, scheduleId: id }
  if (kind === "channel") return { kind, channelId: id }
  return { kind, userId: id }
}

export const toDraftSteps = (steps: Step[]): DraftStep[] =>
  steps.map((step) => ({
    waitMinutes: step.waitMinutes,
    targets: step.targets.map(keyOfTarget),
    channels: step.channels,
  }))

export const toDraftBranches = (policy?: Policy): DraftBranch[] =>
  (policy?.branches ?? []).map((branch) => ({
    name: branch.name,
    when: branch.when,
    steps: toDraftSteps(branch.steps),
  }))

export const toStepRequests = (steps: DraftStep[]): StepRequest[] =>
  steps.map((step, index) => ({
    waitMinutes: index === 0 ? 0 : step.waitMinutes,
    targets: step.targets.map(toTarget),
    channels: step.channels,
  }))

export const toBranchRequests = (branches: DraftBranch[]): BranchRequest[] =>
  branches.map((branch) => ({
    name: branch.name.trim(),
    when: branch.when,
    steps: toStepRequests(branch.steps),
  }))

export const stepsValid = (steps: DraftStep[]) =>
  steps.length > 0 && steps.every((step) => step.targets.length > 0 && step.channels.length > 0)
