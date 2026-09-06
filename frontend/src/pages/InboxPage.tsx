import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { MessageSquare, Bot, User, Webhook } from 'lucide-react'
import { cn } from '../lib/utils'
import api from '../lib/api'
import StatusIndicator from '../components/shared/StatusIndicator'
import ErrorBanner from '../components/shared/ErrorBanner'
import CopyButton from '../components/shared/CopyButton'
import { formatListTimestampIST, formatDateTimeIST } from '../lib/dateFormat'
import WebhookLogPanel from '../components/debug/WebhookLogPanel'
import { describeMessage } from '../components/inbox/describeMessage'

type ConversationFilter = 'ALL' | 'OPEN' | 'CLOSED'

interface Conversation {
  id: string
  // String, like every other TSID here. It was serialized as a JSON number
  // until 2026-09-04, which silently truncated it past
  // Number.MAX_SAFE_INTEGER — 882515538725572608 arrived as ...600. Nothing
  // read it, so nothing was visibly broken; it was a trap for whoever wired
  // up "jump to this agent".
  agentId: string
  externalId: string
  status: 'open' | 'closed'
  lastMessageAt: string | null
  channel: string
  // Which of the account's several business numbers this conversation came
  // in on — resolved via the owning agent, since Conversation itself has no
  // phone number field (founder, 2026-08-13: "we have 7-8 phone numbers, how
  // should I identify which number it is pinged to"). Null if the agent was
  // deleted or the number never synced.
  displayPhoneNumber: string | null
  agentDisplayName: string | null
}

interface Message {
  id: string
  direction: 'inbound' | 'outbound'
  contentType: string
  content: string | null
  contentJson: string | null
  receivedAt: string
  // Null for messages that predate this linkage, or whose originating webhook
  // couldn't be determined (e.g. a delivered/read status update, which only
  // touches an existing row rather than creating one).
  webhookRawId: string | null
}

export default function InboxPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedId = searchParams.get('conversationId')
  const [filter, setFilter] = useState<ConversationFilter>('ALL')
  // Founder-caught gap (2026-08-07): no provision existed to view logged
  // webhooks or copy them at all. Initial value honors ?view=webhooks
  // (2026-08-13) — RootRedirect/ModuleSelectorPage land here right after a
  // fresh login via that query param, per "webhooks on login".
  const [view, setView] = useState<'conversations' | 'webhooks'>(
    searchParams.get('view') === 'webhooks' ? 'webhooks' : 'conversations'
  )
  // Set when a message's webhook icon is clicked — tells WebhookLogPanel which
  // row to open automatically once the Webhooks tab is showing.
  const [focusWebhookId, setFocusWebhookId] = useState<string | null>(null)

  function jumpToWebhook(webhookRawId: string) {
    setFocusWebhookId(webhookRawId)
    setView('webhooks')
  }

  const {
    data: conversations = [],
    isLoading: convsLoading,
    isError: convsError,
    error: convsErrorObj,
    refetch: refetchConversations,
  } = useQuery<Conversation[]>({
    queryKey: ['conversations'],
    queryFn: () => api.get('/conversations').then((r) => r.data.data),
  })

  const {
    data: messages = [],
    isLoading: msgsLoading,
    isError: msgsError,
    error: msgsErrorObj,
    refetch: refetchMessages,
  } = useQuery<Message[]>({
    queryKey: ['messages', selectedId],
    queryFn: () => api.get(`/conversations/${selectedId}/messages`).then((r) => r.data.data),
    enabled: !!selectedId,
    placeholderData: keepPreviousData,
  })

  const openCount = useMemo(() => conversations.filter((c) => c.status === 'open').length, [conversations])

  // Most recent first, sorted here rather than trusting the API's ordering.
  //
  // This used to group open conversations above closed ones (2026-08-05 triage
  // fix). The founder asked for plain recency instead (2026-09-06:
  // "Conversations should show the latest conversation first"), which is what
  // someone scanning for "the message that just came in" actually wants — under
  // the old rule the newest conversation on the account could sit below a
  // week-old open one. The Open filter still isolates unanswered threads.
  //
  // A conversation with no lastMessageAt has nothing to be recent about, so it
  // sorts last rather than to the top on a NaN comparison.
  const sortedConversations = useMemo(() => {
    const at = (c: Conversation) => (c.lastMessageAt ? new Date(c.lastMessageAt).getTime() : -Infinity)
    return [...conversations].sort((a, b) => at(b) - at(a))
  }, [conversations])

  const visibleConversations = useMemo(() => {
    if (filter === 'ALL') return sortedConversations
    return sortedConversations.filter((c) => c.status === filter.toLowerCase())
  }, [sortedConversations, filter])

  // Oldest first, so the newest sits at the bottom where a chat thread ends.
  // Sorted here rather than trusting the API's order, since the bottom of the
  // list is the only thing the user is shown on open.
  const orderedMessages = useMemo(
    () =>
      [...messages].sort(
        (a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime(),
      ),
    [messages],
  )

  const messageScrollRef = useRef<HTMLDivElement | null>(null)

  /**
   * Open a conversation on its latest message.
   *
   * Until now the thread opened at the top — the oldest message — so on a
   * conversation with any history the operator was reading a customer's first
   * message from weeks ago and had to scroll down to find what just arrived
   * (founder, 2026-09-06). Every chat interface in the world opens at the
   * bottom; this one didn't.
   *
   * Keyed on the conversation and the message count so it also follows a new
   * message arriving on the open thread, and jumps rather than smooth-scrolls:
   * animating through the whole history on open is slower to read, not nicer.
   */
  useEffect(() => {
    const node = messageScrollRef.current
    if (!node || msgsLoading) return
    node.scrollTop = node.scrollHeight
  }, [selectedId, orderedMessages.length, msgsLoading])

  const selectedConv = conversations.find((c) => String(c.id) === selectedId) ?? null

  function selectConversation(id: string) {
    setSearchParams({ conversationId: String(id) })
  }

  return (
    <div className="flex h-full flex-col -m-6 overflow-hidden">
      <div className="flex shrink-0 gap-1 border-b bg-white px-4 pt-3">
        <button
          onClick={() => setView('conversations')}
          className={cn(
            'flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-sm font-medium border-b-2 transition-colors',
            view === 'conversations' ? 'border-accent-teal-solid text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Conversations
        </button>
        <button
          onClick={() => setView('webhooks')}
          className={cn(
            'flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-sm font-medium border-b-2 transition-colors',
            view === 'webhooks' ? 'border-accent-teal-solid text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <Webhook className="h-3.5 w-3.5" />
          Webhooks
        </button>
      </div>

      {view === 'webhooks' ? (
        <WebhookLogPanel focusWebhookId={focusWebhookId} onFocusHandled={() => setFocusWebhookId(null)} />
      ) : (
    <div className="flex flex-1 gap-0 overflow-hidden">
      {/* Left panel — conversation list */}
      <div className="flex w-80 shrink-0 flex-col border-r bg-white overflow-hidden">
        <div className="border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Conversations</h2>
            {openCount > 0 && (
              <span className="text-xs font-medium text-foreground">Open ({openCount})</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Read-only audit log</p>
          <div className="mt-2.5 flex gap-1.5">
            {(['ALL', 'OPEN', 'CLOSED'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                  filter === f ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted',
                )}
              >
                {f === 'ALL' ? 'All' : f === 'OPEN' ? 'Open' : 'Closed'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {convsLoading ? (
            <ConversationListSkeleton />
          ) : convsError ? (
            <div className="px-4 py-8">
              <ErrorBanner error={convsErrorObj} onRetry={() => refetchConversations()} />
            </div>
          ) : conversations.length === 0 ? (
            <ConversationEmptyState onGoToAgentsClick={() => navigate('/agents')} />
          ) : visibleConversations.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No {filter.toLowerCase()} conversations.
            </p>
          ) : (
            visibleConversations.map((conv) => (
              <ConversationRow
                key={conv.id}
                conv={conv}
                isSelected={String(conv.id) === selectedId}
                onClick={() => selectConversation(conv.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Right panel — message thread */}
      <div className="flex flex-1 flex-col bg-muted/20 overflow-hidden">
        {!selectedConv ? (
          <SelectConversationPrompt />
        ) : (
          <>
            {/* Thread header */}
            <div className="border-b bg-white px-5 py-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{selectedConv.externalId}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {selectedConv.status} · {selectedConv.channel} · to {selectedConv.displayPhoneNumber ?? '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Messages. Oldest at the top, newest at the bottom, and opened
                scrolled to the bottom — see scrollToLatest. */}
            <div
              ref={messageScrollRef}
              role="log"
              aria-label="Messages"
              className="flex-1 overflow-y-auto p-4 space-y-3"
            >
              {msgsLoading ? (
                <MessagesSkeleton />
              ) : msgsError ? (
                <div className="py-10">
                  <ErrorBanner error={msgsErrorObj} onRetry={() => refetchMessages()} />
                </div>
              ) : messages.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-10">No messages yet.</p>
              ) : (
                orderedMessages.map((msg) => (
                  <MessageBubble key={msg.id} msg={msg} onJumpToWebhook={jumpToWebhook} />
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ConversationRow({
  conv, isSelected, onClick,
}: {
  conv: Conversation
  isSelected: boolean
  onClick: () => void
}) {
  // Not formatTimeIST: a bare time made a thread from last month look like it
  // arrived an hour ago (founder-reported 2026-09-03).
  const time = conv.lastMessageAt ? formatListTimestampIST(conv.lastMessageAt) : '—'

  return (
    <button
      onClick={onClick}
      // Without this the button's accessible name is every scrap of text inside
      // it read end to end — the number, the timestamp, the routing line and the
      // status, as one run-on string.
      aria-label={`Conversation with ${conv.externalId}`}
      aria-current={isSelected ? 'true' : undefined}
      className={cn(
        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors border-b',
        isSelected ? 'bg-primary/5' : 'hover:bg-muted/40'
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <User className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-foreground truncate">{conv.externalId}</p>
          <time
            dateTime={conv.lastMessageAt ?? undefined}
            className="text-xs text-muted-foreground shrink-0"
            title={conv.lastMessageAt ? formatDateTimeIST(conv.lastMessageAt) : undefined}
          >
            {time}
          </time>
        </div>
        {/* Which of the account's several numbers this came in on (2026-08-13
            founder ask) — "to" makes the direction unambiguous next to the
            customer's own number above. */}
        <p className="truncate text-xs text-muted-foreground" title={conv.agentDisplayName ?? undefined}>
          to {conv.displayPhoneNumber ?? '—'}
        </p>
        <div className="mt-0.5 flex items-center gap-1.5">
          <StatusIndicator label={conv.status === 'open' ? 'Open' : 'Closed'} tone={conv.status === 'open' ? 'positive' : 'neutral'} />
          <span className="text-xs text-muted-foreground capitalize">· {conv.channel}</span>
        </div>
      </div>
    </button>
  )
}

function MessageBubble({ msg, onJumpToWebhook }: { msg: Message; onJumpToWebhook: (webhookRawId: string) => void }) {
  const isOutbound = msg.direction === 'outbound'
  const time = formatDateTimeIST(msg.receivedAt)

  // Not `[${contentType}]` any more: that rendered 21 real messages on this
  // account as the literal text "[interactive]", hiding what the customer had
  // actually picked from a list (founder-reported 2026-09-03).
  const described = describeMessage(msg.contentType, msg.content, msg.contentJson)
  const copyValue = msg.content ?? msg.contentJson ?? ''

  return (
    <div className={cn('group flex items-end gap-2', isOutbound ? 'flex-row-reverse' : 'flex-row')}>
      <div className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
        isOutbound ? 'bg-accent-teal/15' : 'bg-muted'
      )}>
        {isOutbound
          ? <Bot className="h-3.5 w-3.5 text-accent-teal-solid" />
          : <User className="h-3.5 w-3.5 text-muted-foreground" />
        }
      </div>
      {/* EL-caught gap (2026-08-07 audit, U5): brand-navy was used as this
          bubble's fill -- banned in content per DESIGN.md, chrome only. */}
      <div className={cn(
        'max-w-[70%] rounded-2xl px-3.5 py-2.5',
        isOutbound
          ? 'rounded-br-sm bg-accent-teal-solid text-white'
          : 'rounded-bl-sm bg-white border text-foreground'
      )}>
        {/* Caption first: it tells the operator the customer tapped a control
            rather than typing, which changes how the reply below reads. */}
        {described.kind && (
          <p className={cn(
            'text-[10px] font-medium uppercase tracking-wide',
            isOutbound ? 'text-white/60' : 'text-muted-foreground'
          )}>
            {described.kind}
          </p>
        )}
        <p className={cn('text-sm leading-relaxed', described.kind && 'mt-0.5')}>{described.text}</p>
        {described.detail && (
          <p className={cn(
            'mt-0.5 text-xs leading-relaxed',
            isOutbound ? 'text-white/70' : 'text-muted-foreground'
          )}>
            {described.detail}
          </p>
        )}
        {/* Date AND time on every message, not a bare time with the date on
            hover (founder, 2026-09-06: "every message should have date and
            time"). A thread can span weeks, and hover is invisible on touch and
            unfindable if you don't know it is there — so a message whose date
            you can only discover by accident may as well not have one. */}
        <time
          dateTime={msg.receivedAt}
          className={cn(
            'mt-1 block text-[10px]',
            isOutbound ? 'text-white/50' : 'text-muted-foreground'
          )}
        >
          {time}
        </time>
      </div>
      {/* Founder-caught gap (2026-08-07): no copy affordance existed on message content. */}
      <CopyButton
        value={copyValue}
        size="icon"
        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
      />
      {msg.webhookRawId && (
        <button
          type="button"
          onClick={() => onJumpToWebhook(msg.webhookRawId!)}
          title="View the raw webhook that produced this message"
          aria-label="View originating webhook"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground
            opacity-0 transition-opacity hover:bg-muted hover:text-foreground
            group-hover:opacity-100 focus-visible:opacity-100
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <Webhook className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

function ConversationEmptyState({ onGoToAgentsClick }: { onGoToAgentsClick: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <p className="text-sm font-medium text-foreground">No conversations yet</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs">
        Your agent hasn't had any conversations yet. Deploy your agent to start receiving messages.
      </p>
      <button
        onClick={onGoToAgentsClick}
        className="mt-5 flex items-center gap-2 rounded-lg bg-accent-teal-solid px-4 py-2
          text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        Go to Agents
      </button>
    </div>
  )
}

function SelectConversationPrompt() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center p-8">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted mb-4">
        <MessageSquare className="h-7 w-7 text-muted-foreground" />
      </div>
      <p className="text-base font-semibold text-foreground">Select a conversation</p>
      <p className="mt-1 text-sm text-muted-foreground max-w-xs">
        Choose a conversation from the left panel to view the message history.
      </p>
    </div>
  )
}

function ConversationListSkeleton() {
  return (
    <div className="space-y-0">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3 border-b animate-pulse">
          <div className="h-8 w-8 rounded-full bg-muted shrink-0" />
          <div className="flex-1 space-y-2 py-0.5">
            <div className="h-3.5 w-3/4 rounded bg-muted" />
            <div className="h-3 w-1/2 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  )
}

function MessagesSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className={cn('flex gap-2', i % 2 === 0 ? 'flex-row-reverse' : '')}>
          <div className="h-7 w-7 rounded-full bg-muted shrink-0 animate-pulse" />
          <div className="h-12 w-48 rounded-2xl bg-muted animate-pulse" />
        </div>
      ))}
    </div>
  )
}
