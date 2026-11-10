import { Checkbox, Label, RadioGroup, RadioGroupItem, Switch } from "@/components/ui"
import { Caption, Row, Section } from "../components"

const ACCESS_LEVELS = [
  { value: "read", label: "Read only" },
  { value: "pr", label: "Open pull requests" },
  { value: "merge", label: "Auto merge" },
]

export function ChoicesSection() {
  return (
    <Section id="choices" title="Checkbox, radio and switch">
      <Row>
        <Caption>Checkbox</Caption>
        <div className="flex items-center gap-2">
          <Checkbox id="c1" defaultChecked />
          <Label htmlFor="c1">Remember me</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="c2" />
          <Label htmlFor="c2">Email me</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="c3" disabled />
          <Label htmlFor="c3">Disabled</Label>
        </div>
      </Row>
      <Row>
        <Caption>Radio</Caption>
        <RadioGroup defaultValue="read" className="flex w-auto gap-5">
          {ACCESS_LEVELS.map((level) => (
            <div key={level.value} className="flex items-center gap-2">
              <RadioGroupItem id={`r-${level.value}`} value={level.value} />
              <Label htmlFor={`r-${level.value}`}>{level.label}</Label>
            </div>
          ))}
        </RadioGroup>
      </Row>
      <Row>
        <Caption>Switch</Caption>
        <div className="flex items-center gap-2">
          <Switch id="s1" defaultChecked />
          <Label htmlFor="s1">Live tail</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="s2" size="sm" />
          <Label htmlFor="s2">Small</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="s3" disabled />
          <Label htmlFor="s3">Disabled</Label>
        </div>
      </Row>
    </Section>
  )
}
