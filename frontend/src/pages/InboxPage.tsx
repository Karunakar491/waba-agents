import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MessageSquare, Bot, User } from 'lucide-react'
import { cn } from '../lib/utils'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'

interface Conversation {
  id: number
  agentName: string
  customerPhone: string
  lastMessageAt: string
  lastMessagePreview: string | null
  status: 'open' | 'resolved'
}

interface Message {
  id: number
  direction: 'inbound' | 'outbound'
  contentType: string
  textBody: string | null
  contentJson: string | null
  createdAt: string
}

export default function InboxPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedId = searchParams.get('conversationId')
  const accountId = useAuthStore((s) => s.user?.accountId)

  const { data: conversations = [], isLoading: convsLoading } = useQuery<Conversation[]>({
    queryKey: ['conversations', accountId],
    queryFn: () => api.get('/conversations', { params: { accountId } }).then((r) => r.data),
    enabled: !!accountId,
  })

  const { data: messages = [], isLoading: msgsLoading } = useQuery<Message[]>({
    queryKey: ['messages', selectedId],
    queryFn: () => api.get(`/conversations/${selectedId}/messages`).then((r) => r.data),
    enabled: !!selectedId,
  })

  const selectedConv = conversations.find((c) => String(c.id) === selectedId) ?? null

  function selectConversation(id: number) {
    setSearchParams({ conversationId: String(id) })
  }

  return (
    <div className="flex h-full gap-0 -m-6 overflow-hidden">
      {/* Left panel — conversation list */}
      <div className="flex w-80 shrink-0 flex-col border-r bg-white overflow-hidden">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">Conversations</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Read-only audit log</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {convsLoading ? (
            <ConversationListSkeleton />
          ) : conversations.length === 0 ? (
            <ConversationEmptyState />
          ) : (
            conversations.map((conv) => (
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
                  <p className="text-sm font-semibold text-foreground">{selectedConv.customerPhone}</p>
                  <p className="text-xs text-muted-foreground">{selectedConv.agentName}</p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {msgsLoading ? (
                <MessagesSkeleton />
              ) : messages.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-10">No messages yet.</p>
              ) : (
                messages.map((msg) => (
                  <MessageBubble key={msg.id} msg={msg} />
                ))
              )}
            </div>
          </>
        )}
      </div>
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
  const time = new Date(conv.lastMessageAt).toLocaleTimeString('en', {
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <button
      onClick={onClick}
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
          <p className="text-sm font-medium text-foreground truncate">{conv.customerPhone}</p>
          <span className="text-xs text-muted-foreground shrink-0">{time}</span>
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {conv.lastMessagePreview ?? 'No preview available'}
        </p>
        <p className="text-xs text-muted-foreground/60 mt-0.5">{conv.agentName}</p>
      </div>
    </button>
  )
}

function MessageBubble({ msg }: { msg: Message }) {
  const isOutbound = msg.direction === 'outbound'
  const time = new Date(msg.createdAt).toLocaleTimeString('en', {
    hour: '2-digit', minute: '2-digit',
  })

  const content = msg.textBody ?? (msg.contentJson ? `[${msg.contentType}]` : '—')

  return (
    <div className={cn('flex items-end gap-2', isOutbound ? 'flex-row-reverse' : 'flex-row')}>
      <div className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
        isOutbound ? 'bg-brand-pink/10' : 'bg-muted'
      )}>
        {isOutbound
          ? <Bot className="h-3.5 w-3.5 text-brand-pink" />
          : <User className="h-3.5 w-3.5 text-muted-foreground" />
        }
      </div>
      <div className={cn(
        'max-w-[70%] rounded-2xl px-3.5 py-2.5',
        isOutbound
          ? 'rounded-br-sm bg-brand-navy text-white'
          : 'rounded-bl-sm bg-white border text-foreground'
      )}>
        <p className="text-sm leading-relaxed">{content}</p>
        <p className={cn(
          'mt-1 text-[10px]',
          isOutbound ? 'text-white/50' : 'text-muted-foreground'
        )}>
          {time}
        </p>
      </div>
    </div>
  )
}

function ConversationEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <MessageSquare className="h-10 w-10 text-muted-foreground mb-3" />
      <p className="text-sm font-medium text-foreground">No conversations yet</p>
      <p className="text-xs text-muted-foreground mt-1">
        Your agent hasn't had any conversations yet. Deploy your agent to start receiving messages.
      </p>
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
