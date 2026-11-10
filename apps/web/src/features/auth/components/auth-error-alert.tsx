import { TriangleAlert } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui"

interface AuthErrorAlertProps {
  title: string
  message: string
}

export function AuthErrorAlert({ title, message }: AuthErrorAlertProps) {
  return (
    <Alert variant="destructive">
      <TriangleAlert />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}
