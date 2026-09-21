import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Send, Undo2 } from 'lucide-react'
import api from '../../lib/api'
import { cn } from '../../lib/utils'

/**
 * Where a person answers a customer.
 *
 * Sending is not only sending: per Meta's handover protocol
 * (docs/meta-api/thread-control.md) a message from us TAKES thread control, and
 * the agent then stays silent on this conversation until it is handed back. The
 * operator has to be able to see that, which is what the hand-back button and
 * the line above it are for — an operator who does not know the agent has gone
 * quiet will walk away from a customer mid-conversation.
 */
export default function ReplyComposer({
  conversationId,
  needsHuman,
}: {
  conversationId: string
  needsHuman: boolean
}) {
  const [text, setText] = useState('')
  const queryClient = useQueryClient()

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
    void queryClient.invalidateQueries({ queryKey: ['conversations'] })
  }

  const send = useMutation({
    mutationFn: (body: string) =>
      api.post(`/conversations/${conversationId}/reply`, { text: body }),
    onSuccess: () => {
      setText('')
      invalidate()
    },
  })

  const handBack = useMutation({
    mutationFn: () => api.post(`/conversations/${conversationId}/release`),
    onSuccess: invalidate,
  })

  const trimmed = text.trim()
  const busy = send.isPending || handBack.isPending

  const submit = () => {
    if (!trimmed || busy) return
    send.mutate(trimmed)
  }

  const errorOf = (e: unknown) =>
    (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
    'That did not send. Try again.'

  return (
    <div className="border-t bg-white px-5 py-3 shrink-0">
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter makes a new line — what every messaging
            // app does, and what an operator's hands already expect.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          rows={1}
          disabled={busy}
          aria-label="Reply to this customer"
          placeholder="Type a reply…"
          className={cn(
            'flex-1 resize-none rounded-lg border px-3 py-2 text-sm',
            'focus:outline-none focus:ring-2 focus:ring-primary/40',
            'disabled:opacity-60'
          )}
        />
        <button
          onClick={submit}
          disabled={!trimmed || busy}
          aria-label="Send reply"
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white',
            'bg-accent-teal-solid transition-opacity hover:opacity-90',
            'disabled:cursor-not-allowed disabled:opacity-40'
          )}
        >
          <Send className="h-4 w-4" />
          {send.isPending ? 'Sending…' : 'Send'}
        </button>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {needsHuman
            ? 'The agent has stopped replying to this customer. It resumes when you hand the conversation back.'
            : 'The agent is handling this conversation. Sending a reply takes it over.'}
        </p>
        {needsHuman && (
          <button
            onClick={() => handBack.mutate()}
            disabled={busy}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5',
              'text-xs font-medium text-foreground transition-colors hover:bg-muted',
              'disabled:cursor-not-allowed disabled:opacity-40'
            )}
          >
            <Undo2 className="h-3.5 w-3.5" />
            {handBack.isPending ? 'Handing back…' : 'Hand back to agent'}
          </button>
        )}
      </div>

      {send.isError && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {errorOf(send.error)}
        </p>
      )}
      {handBack.isError && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {errorOf(handBack.error)}
        </p>
      )}
    </div>
  )
}
