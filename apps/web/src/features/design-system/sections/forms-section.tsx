import { Search } from "lucide-react"
import {
  Field,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/components/ui"
import { Section } from "../components"

const REGIONS = { mum: "Mumbai", fra: "Frankfurt", iad: "Virginia" }

export function FormsSection() {
  return (
    <Section
      id="forms"
      title="Inputs and labels"
      note="Border turns brand with a soft ring on focus. Errors turn red."
    >
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Work email" htmlFor="email" help="We never share it.">
          <Input id="email" type="email" placeholder="you@company.com" />
        </Field>
        <Field label="Password" htmlFor="pw" error="Use at least 12 characters.">
          <Input id="pw" type="password" defaultValue="short" aria-invalid />
        </Field>
        <Field label="Disabled" htmlFor="dis">
          <Input id="dis" disabled placeholder="Not editable" />
        </Field>
        <Field label="Search" htmlFor="search">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="search" className="pl-9" placeholder="Search integrations" />
          </div>
        </Field>
        <Field label="Region" htmlFor="region">
          <Select defaultValue="mum" items={REGIONS}>
            <SelectTrigger id="region" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(REGIONS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Notes" htmlFor="notes">
          <Textarea id="notes" placeholder="Anything the AI should know about this service" />
        </Field>
      </div>
    </Section>
  )
}
