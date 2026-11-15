import { z } from "zod"

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), "Use an http or https address")

export const settingsFormSchema = z.object({
  name: z.string().trim().min(1, "Enter a company name").max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "At least 3 characters")
    .max(40)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single dashes"),
  description: z.string().trim().max(300),
  logoUrl: optionalUrl,
  logoDarkUrl: optionalUrl,
  homepageUrl: optionalUrl,
  contactUrl: optionalUrl,
  theme: z.enum(["system", "light", "dark"]),
  headerLayout: z.enum(["logo_and_name", "logo_only", "name_only"]),
  hideFromSearch: z.boolean(),
})
export type SettingsFormValues = z.infer<typeof settingsFormSchema>

export const maintenanceFormSchema = z
  .object({
    title: z.string().trim().min(1, "Enter a title").max(120),
    description: z.string().trim().max(2000),
    startsAt: z.string().min(1, "Pick a start"),
    endsAt: z.string().min(1, "Pick an end"),
    timezone: z.string().min(1),
    resourceIds: z.array(z.string()),
    notifySubscribers: z.boolean(),
  })
  .refine((m) => m.endsAt > m.startsAt, {
    message: "The end must be after the start",
    path: ["endsAt"],
  })
export type MaintenanceFormValues = z.infer<typeof maintenanceFormSchema>
