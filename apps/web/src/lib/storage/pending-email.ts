const PENDING_EMAIL_KEY = "pramaan-pending-email"

export function savePendingEmail(email: string) {
  try {
    sessionStorage.setItem(PENDING_EMAIL_KEY, email)
  } catch {
    return
  }
}

export function readPendingEmail(): string | null {
  try {
    return sessionStorage.getItem(PENDING_EMAIL_KEY)
  } catch {
    return null
  }
}
