import { z } from "zod"

export const updateSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  state: z.string(),
  createdAt: z.string(),
})
export type StatusUpdate = z.infer<typeof updateSchema>

export const pageSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  monitorIds: z.array(z.string()),
  updates: z.array(updateSchema),
  createdAt: z.string(),
})
export type StatusPage = z.infer<typeof pageSchema>

export const publicSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  overall: z.string(),
  components: z.array(
    z.object({
      name: z.string(),
      state: z.string(),
      uptime: z.number().nullable(),
      days: z.array(z.object({ date: z.string(), uptime: z.number().nullable() })),
    })
  ),
  updates: z.array(updateSchema),
  generatedAt: z.string(),
})
export type PublicStatus = z.infer<typeof publicSchema>

export interface PageRequest {
  name: string
  slug: string
  description?: string
  monitorIds: string[]
}

export interface UpdateRequest {
  title: string
  body: string
  state: string
}
