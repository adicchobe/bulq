import { redirect } from 'next/navigation'
import type { Message } from 'ai/react'
import { createClient } from '@/lib/db/server'
import { getMessages, getOrCreateConversation } from '@/lib/db/chat'
import { ChatThread } from './chat-thread'

// Protected: the chat is private. No session → /login.
export default async function ChatPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const conversationId = await getOrCreateConversation(user.id)
  const rows = await getMessages(conversationId)

  const initialMessages: Message[] = rows.map((r) => ({
    id: r.id,
    role: r.role,
    content: r.content,
  }))

  return <ChatThread conversationId={conversationId} initialMessages={initialMessages} />
}
