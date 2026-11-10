import { Check, Info, TriangleAlert } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui"
import { Section } from "../components"

export function AlertsSection() {
  return (
    <Section id="alerts" title="Alerts">
      <Alert>
        <Info />
        <AlertTitle>The AI found a cause</AlertTitle>
        <AlertDescription>Checkout fails when there is no coupon.</AlertDescription>
      </Alert>
      <Alert variant="success">
        <Check />
        <AlertTitle>Fix verified</AlertTitle>
        <AlertDescription>12 tests passed and errors dropped to 0.</AlertDescription>
      </Alert>
      <Alert variant="warning">
        <TriangleAlert />
        <AlertTitle>Waiting for approval</AlertTitle>
        <AlertDescription>Nothing changes until you say yes.</AlertDescription>
      </Alert>
      <Alert variant="destructive">
        <TriangleAlert />
        <AlertTitle>Teams could not connect</AlertTitle>
        <AlertDescription>The webhook returned 403.</AlertDescription>
      </Alert>
    </Section>
  )
}
