import { redirect } from 'next/navigation';

import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/auth';
import { listConversations, listPeople } from '@/lib/chat-actions';
import { ChatClient } from './ChatClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Chat lives on the server only.
 *
 * The desktop app reads it over the network like the website does, and says so
 * when there is no network. It is deliberately outside the sync engine: that
 * engine merges rows last-writer-wins, which is right for a timetable and wrong
 * for a conversation.
 */
export default async function ChatPage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const [me, conversations, people] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true } }),
    listConversations(),
    listPeople(),
  ]);
  if (!me) redirect('/welcome');

  return <ChatClient me={me} initialConversations={conversations} people={people} />;
}
