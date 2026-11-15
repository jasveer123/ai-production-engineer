"use client"

import * as React from "react"
import { Plus, Send, Trash2 } from "lucide-react"
import { Button, Spinner, Textarea } from "@/components/ui"
import { useCurrentWorkspace } from "@/features/auth"
import { PageHeading } from "@/features/integrations"
import { ACTOR_ROLES } from "@/lib/constants/roles"
import { notifyError } from "@/lib/toast"
import { cn } from "@/lib/utils"
import { SUGGESTIONS } from "../constants"
import { useAsk, useConversation, useConversations, useDeleteConversation } from "../hooks"
import { MessageBubble } from "./message-bubble"

export function AssistantPage() {
  const { workspace, isPending } = useCurrentWorkspace()
  const conversations = useConversations(workspace?.id)
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const active = useConversation(workspace?.id, activeId)
  const ask = useAsk(workspace?.id ?? "")
  const remove = useDeleteConversation(workspace?.id ?? "")
  const [draft, setDraft] = React.useState("")
  const [pendingQuestion, setPendingQuestion] = React.useState<string | null>(null)

  if (isPending) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (!workspace) return null

  const canAsk = ACTOR_ROLES.includes(workspace.role)
  const messages = activeId ? (active.data?.messages ?? []) : []

  const send = (text: string) => {
    const message = text.trim()
    if (!message || ask.isPending) return
    setPendingQuestion(message)
    setDraft("")
    ask.mutate(
      { id: activeId, message },
      {
        onSuccess: (detail) => setActiveId(detail.id),
        onError: (error) => {
          setDraft(message)
          notifyError(error)
        },
        onSettled: () => setPendingQuestion(null),
      }
    )
  }

  return (
    <div className="grid min-w-0 gap-6">
      <PageHeading workspaceName={workspace.name} title="Ask AI" />
      <div className="grid gap-5 lg:grid-cols-[16rem_1fr]">
        <aside className="grid content-start gap-2" aria-label="Conversations">
          <Button size="sm" variant="outline" onClick={() => setActiveId(null)}>
            <Plus /> New chat
          </Button>
          {(conversations.data ?? []).map((item) => (
            <div key={item.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveId(item.id)}
                className={cn(
                  "min-w-0 flex-1 truncate border border-line px-3 py-2 text-left text-[0.8125rem] hover:bg-panel-2",
                  activeId === item.id && "border-brand bg-brand-soft"
                )}
              >
                {item.title}
              </button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete ${item.title}`}
                disabled={remove.isPending}
                onClick={() => {
                  remove.mutate(item.id)
                  if (activeId === item.id) setActiveId(null)
                }}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </aside>
        <section className="grid content-start gap-4">
          <div className="grid min-h-64 content-start gap-5 border border-line bg-panel p-5">
            {messages.length === 0 && !pendingQuestion ? (
              <div className="grid gap-4">
                <p className="max-w-prose text-sm text-muted-foreground">
                  Ask about incidents, errors, monitors, logs or who is on call. Every answer cites
                  the records it used so you can check it.
                </p>
                <ul className="divide-y divide-line border border-line">
                  {SUGGESTIONS.map((text) => (
                    <li key={text}>
                      <button
                        type="button"
                        disabled={!canAsk || ask.isPending}
                        onClick={() => send(text)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-[0.8125rem] outline-none hover:bg-panel-2 focus-visible:bg-panel-2 disabled:opacity-50"
                      >
                        {text}
                        <span className="text-muted-foreground">Ask</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              messages.map((message) => <MessageBubble key={message.id} message={message} />)
            )}
            {pendingQuestion && (
              <>
                <MessageBubble
                  message={{
                    id: -1,
                    role: "user",
                    content: pendingQuestion,
                    sources: [],
                    createdAt: "",
                  }}
                />
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner /> Reading incidents, errors, monitors and logs
                </p>
              </>
            )}
          </div>
          {canAsk ? (
            <form
              method="post"
              className="flex items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                send(draft)
              }}
            >
              <Textarea
                aria-label="Your question"
                className="min-h-16"
                rows={2}
                maxLength={2000}
                value={draft}
                placeholder="Ask a question"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault()
                    send(draft)
                  }
                }}
              />
              <Button type="submit" disabled={!draft.trim() || ask.isPending}>
                {ask.isPending ? <Spinner /> : <Send />} Ask
              </Button>
            </form>
          ) : (
            <p className="text-[0.8125rem] text-muted-foreground">
              Viewers can read past conversations but cannot ask new questions.
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
