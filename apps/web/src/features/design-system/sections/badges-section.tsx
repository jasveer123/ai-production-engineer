import { Badge, Kbd, Status, Tag } from "@/components/ui"
import { Caption, Row, Section } from "../components"

export function BadgesSection() {
  return (
    <Section id="badges" title="Badges, status and tags">
      <Row>
        <Caption>Badges</Caption>
        <Badge>Default</Badge>
        <Badge variant="brand">Brand</Badge>
        <Badge variant="ai">AI found</Badge>
        <Badge variant="success">Passing</Badge>
        <Badge variant="warning">Waiting</Badge>
        <Badge variant="destructive">Failed</Badge>
        <Badge variant="info">Info</Badge>
        <Badge variant="outline">Outline</Badge>
      </Row>
      <Row>
        <Caption>Status</Caption>
        <Status state="live">Live</Status>
        <Status state="waiting">Waiting</Status>
        <Status state="failed">Failed</Status>
        <Status>Idle</Status>
      </Row>
      <Row>
        <Caption>Tag, key</Caption>
        <Tag>Running</Tag>
        <Kbd>⌘K</Kbd>
        <Kbd>Esc</Kbd>
      </Row>
    </Section>
  )
}
