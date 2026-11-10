import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Status,
} from "@/components/ui"
import { Section } from "../components"

export function CardsSection() {
  return (
    <Section
      id="cards"
      title="Cards"
      note="Plain, with corner dots (ticked), and interactive (lifts on hover)."
    >
      <div className="grid gap-5 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Plain card</CardTitle>
            <CardDescription>Panel surface with a thin line.</CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground">Use for grouped content.</CardContent>
        </Card>
        <Card ticked className="[--tick:var(--brand)]">
          <CardHeader>
            <CardTitle>Ticked card</CardTitle>
            <CardDescription>Four corner dots.</CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            Use for the hero or key panel.
          </CardContent>
          <CardFooter>
            <Status state="live">Live</Status>
          </CardFooter>
        </Card>
        <Card interactive tabIndex={0}>
          <CardHeader>
            <CardTitle>Interactive</CardTitle>
            <CardDescription>Hover or focus me.</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="brand">Recommended</Badge>
          </CardContent>
        </Card>
      </div>
    </Section>
  )
}
