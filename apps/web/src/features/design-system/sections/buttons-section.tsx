import { Check, Plus, Search, Trash2 } from "lucide-react"
import { Button, Spinner, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui"
import { Caption, Row, Section } from "../components"

export function ButtonsSection() {
  return (
    <Section
      id="buttons"
      title="Buttons"
      note="Square, 2.5rem tall. They lift on hover, press down on click, and show a brand ring on keyboard focus."
    >
      <Row>
        <Caption>Variants</Caption>
        <Button>Primary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="link">Link</Button>
      </Row>
      <Row>
        <Caption>Sizes</Caption>
        <Button size="xs">Extra small</Button>
        <Button size="sm">Small</Button>
        <Button>Default</Button>
        <Button size="lg">Large</Button>
      </Row>
      <Row>
        <Caption>With icon</Caption>
        <Button>
          <Plus /> New source
        </Button>
        <Button variant="outline">
          <Search /> Search
        </Button>
        <Button variant="destructive">
          <Trash2 /> Delete
        </Button>
        <Tooltip>
          <TooltipTrigger render={<Button size="icon" variant="outline" aria-label="Add" />}>
            <Plus />
          </TooltipTrigger>
          <TooltipContent>Add a source</TooltipContent>
        </Tooltip>
        <Button size="icon-sm" variant="ghost" aria-label="Done">
          <Check />
        </Button>
      </Row>
      <Row>
        <Caption>States</Caption>
        <Button disabled>Disabled</Button>
        <Button variant="outline" disabled>
          Disabled
        </Button>
        <Button>
          <Spinner className="border-on-brand/40 border-t-on-brand" /> Saving
        </Button>
      </Row>
    </Section>
  )
}
