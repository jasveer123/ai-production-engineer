import {
  Avatar,
  AvatarFallback,
  Progress,
  ProgressLabel,
  ProgressValue,
  Skeleton,
  Spinner,
} from "@/components/ui"
import { Caption, Row, Section } from "../components"

export function FeedbackSection() {
  return (
    <Section id="feedback" title="Loading and progress">
      <Row>
        <Caption>Spinner</Caption>
        <Spinner />
        <Spinner className="size-6" />
      </Row>
      <Row>
        <Caption>Skeleton</Caption>
        <div className="grid w-full max-w-sm gap-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-16 w-full" />
        </div>
      </Row>
      <Row>
        <Caption>Progress</Caption>
        <Progress value={64} className="w-full max-w-sm">
          <ProgressLabel>Log volume</ProgressLabel>
          <ProgressValue />
        </Progress>
      </Row>
      <Row>
        <Caption>Avatar</Caption>
        <Avatar>
          <AvatarFallback>JS</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback>AI</AvatarFallback>
        </Avatar>
      </Row>
    </Section>
  )
}
