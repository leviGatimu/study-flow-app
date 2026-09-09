'use server';

/**
 * Talking to other people in the app.
 *
 * MEMBERSHIP IS THE ONLY PERMISSION. Every function that touches a conversation
 * resolves the caller's membership row first and works from that, rather than
 * taking a conversation id on trust. A server action is an HTTP endpoint anyone
 * can call with any id they like, so "they came from the chat page" is not a
 * fact the server ever gets to know.
 *
 * SHARES ARE SNAPSHOTS, NEVER POINTERS. When you share your timetable, the rows
 * are serialised into the message as they are at that moment. A reference to
 * the live table would mean that editing your week next month silently changes
 * what you appear to have sent, and that importing it hands someone something
 * nobody ever offered them.
 *
 * IMPORTING IS ALWAYS THE RECEIVER'S DECISION. A share arrives as a card to
 * read. Nothing is written into anybody's account until they press the button.
 */

import { revalidatePath } from 'next/cache';

import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/auth';
import { requireClassStamp, byClass, getViewScope } from '@/lib/scope';
import { softDelete } from '@/lib/soft-delete';

const MAX_BODY = 4000;
const MAX_GROUP = 25;

export type ChatPerson = { id: string; username: string; name: string | null };

export type ChatSummary = {
  id: string;
  kind: 'DIRECT' | 'GROUP';
  /** What to show in the list: the group's name, or the other person. */
  title: string;
  members: ChatPerson[];
  lastMessage: { body: string; senderId: string; createdAt: Date } | null;
  unread: number;
  updatedAt: Date;
};

export type ChatMessageView = {
  id: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: Date;
  share: { kind: 'TIMETABLE' | 'NOTE'; title: string; summary: string } | null;
};

/** The two ids of a direct chat, in a stable order. */
function pairKeyFor(a: string, b: string): string {
  return [a, b].sort().join(':');
}

function displayName(user: { username: string; progress?: { name: string | null } | null }): string {
  const name = user.progress?.name?.trim();
  return name && name !== user.username ? name : user.username;
}

/**
 * The caller's membership of a conversation, or null.
 *
 * Every read and write goes through this. It is the whole access-control story,
 * which is why it is one function rather than a check repeated at each site
 * where somebody could forget it.
 */
async function membership(userId: string, conversationId: string) {
  return prisma.conversationMember.findFirst({
    where: { conversationId, userId },
    select: { id: true, conversationId: true, lastReadAt: true },
  });
}

/* ------------------------------------------------------------------- people */

/**
 * Everyone else on this deployment.
 *
 * A plain directory, because the deployment is a small group who already know
 * each other. It exposes usernames and display names and nothing else - no
 * activity, no email, nothing about what anyone studies.
 */
export async function listPeople(): Promise<ChatPerson[]> {
  const userId = await getUserId();
  if (!userId) return [];

  const users = await prisma.user.findMany({
    where: { id: { not: userId } },
    select: { id: true, username: true, progress: { select: { name: true } } },
    orderBy: { username: 'asc' },
  });

  return users.map((u) => ({ id: u.id, username: u.username, name: displayName(u) }));
}

/* ------------------------------------------------------------ conversations */

export async function listConversations(): Promise<ChatSummary[]> {
  const userId = await getUserId();
  if (!userId) return [];

  const memberships = await prisma.conversationMember.findMany({
    where: { userId },
    select: {
      lastReadAt: true,
      conversation: {
        select: {
          id: true,
          kind: true,
          title: true,
          updatedAt: true,
          members: {
            select: {
              userId: true,
              user: { select: { username: true, progress: { select: { name: true } } } },
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { body: true, senderId: true, createdAt: true, shareKind: true },
          },
        },
      },
    },
  });

  const summaries = await Promise.all(
    memberships.map(async (m) => {
      const c = m.conversation;
      const others = c.members.filter((x) => x.userId !== userId);
      const people: ChatPerson[] = c.members.map((x) => ({
        id: x.userId,
        username: x.user.username,
        name: displayName(x.user),
      }));

      const unread = await prisma.conversationMessage.count({
        where: {
          conversationId: c.id,
          senderId: { not: userId },
          ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {}),
        },
      });

      const last = c.messages[0] ?? null;

      return {
        id: c.id,
        kind: (c.kind === 'GROUP' ? 'GROUP' : 'DIRECT') as 'DIRECT' | 'GROUP',
        title:
          c.kind === 'GROUP'
            ? c.title || 'Group'
            : others[0]
              ? displayName(others[0].user)
              : 'Just you',
        members: people,
        lastMessage: last
          ? {
              // A share with no words of its own still has to read as something
              // in the list, rather than as an empty row.
              body: last.body || (last.shareKind === 'NOTE' ? 'Shared a note' : 'Shared a timetable'),
              senderId: last.senderId,
              createdAt: last.createdAt,
            }
          : null,
        unread,
        updatedAt: c.updatedAt,
      };
    })
  );

  return summaries.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

/** Open the direct chat with someone, creating it the first time. */
export async function openDirectChat(otherUserId: string) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };
  if (otherUserId === userId) return { error: 'You cannot message yourself.' };

  const other = await prisma.user.findUnique({
    where: { id: otherUserId },
    select: { id: true },
  });
  if (!other) return { error: 'No such person.' };

  const pairKey = pairKeyFor(userId, otherUserId);
  const existing = await prisma.conversation.findUnique({
    where: { pairKey },
    select: { id: true },
  });
  if (existing) return { success: true, conversationId: existing.id };

  const created = await prisma.conversation.create({
    data: {
      kind: 'DIRECT',
      createdById: userId,
      pairKey,
      members: { create: [{ userId }, { userId: otherUserId }] },
    },
    select: { id: true },
  });

  revalidatePath('/chat');
  return { success: true, conversationId: created.id };
}

export async function createGroupChat(input: { title: string; memberIds: string[] }) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const title = input.title.trim().slice(0, 80);
  if (!title) return { error: 'Give the group a name.' };

  const ids = [...new Set(input.memberIds.filter((id) => id !== userId))];
  if (ids.length === 0) return { error: 'Add at least one other person.' };
  if (ids.length + 1 > MAX_GROUP) return { error: `Groups are limited to ${MAX_GROUP} people.` };

  // Ids come from the client, so confirm every one is a real account rather
  // than creating memberships for whatever was posted.
  const real = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  if (real.length !== ids.length) return { error: 'One of those people no longer exists.' };

  const created = await prisma.conversation.create({
    data: {
      kind: 'GROUP',
      title,
      createdById: userId,
      members: { create: [{ userId }, ...real.map((r) => ({ userId: r.id }))] },
    },
    select: { id: true },
  });

  revalidatePath('/chat');
  return { success: true, conversationId: created.id };
}

export async function leaveConversation(conversationId: string) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const mine = await membership(userId, conversationId);
  if (!mine) return { error: 'Not your conversation.' };

  // Soft, like every other delete in this app. The read filter hides it, and
  // rejoining later is then a matter of clearing one column rather than
  // reconstructing a membership.
  await softDelete(prisma, 'conversationMember', { id: mine.id });
  revalidatePath('/chat');
  return { success: true };
}

/* ---------------------------------------------------------------- messages */

export async function getMessages(
  conversationId: string,
  sinceId?: string
): Promise<ChatMessageView[]> {
  const userId = await getUserId();
  if (!userId) return [];

  const mine = await membership(userId, conversationId);
  if (!mine) return [];

  // Polling asks for "anything after this one" so a long thread is fetched once
  // and then only grows.
  let after: Date | undefined;
  if (sinceId) {
    const anchor = await prisma.conversationMessage.findFirst({
      where: { id: sinceId, conversationId },
      select: { createdAt: true },
    });
    after = anchor?.createdAt;
  }

  const rows = await prisma.conversationMessage.findMany({
    where: { conversationId, ...(after ? { createdAt: { gt: after } } : {}) },
    orderBy: { createdAt: 'asc' },
    take: after ? 100 : 200,
    select: {
      id: true,
      senderId: true,
      body: true,
      createdAt: true,
      shareKind: true,
      shareTitle: true,
      sharePayload: true,
      sender: { select: { username: true, progress: { select: { name: true } } } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    senderId: r.senderId,
    senderName: displayName(r.sender),
    body: r.body,
    createdAt: r.createdAt,
    share: r.shareKind
      ? {
          kind: r.shareKind === 'NOTE' ? 'NOTE' : 'TIMETABLE',
          title: r.shareTitle || 'Shared',
          summary: summarise(r.shareKind, r.sharePayload),
        }
      : null,
  }));
}

/** One line describing a share, so the card says something before it is opened. */
function summarise(kind: string, payload: string | null): string {
  if (!payload) return '';
  try {
    const parsed = JSON.parse(payload);
    if (kind === 'TIMETABLE') {
      const blocks = Array.isArray(parsed?.blocks) ? parsed.blocks.length : 0;
      const subjects = new Set(
        (parsed?.blocks ?? []).map((b: { subject?: string }) => b.subject).filter(Boolean)
      );
      return `${blocks} weekly block${blocks === 1 ? '' : 's'} · ${subjects.size} subject${
        subjects.size === 1 ? '' : 's'
      }`;
    }
    const words = String(parsed?.content ?? '').trim().split(/\s+/).filter(Boolean).length;
    return `${words} word${words === 1 ? '' : 's'}`;
  } catch {
    return '';
  }
}

export async function sendMessage(conversationId: string, body: string) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const text = body.trim().slice(0, MAX_BODY);
  if (!text) return { error: 'Nothing to send.' };

  const mine = await membership(userId, conversationId);
  if (!mine) return { error: 'Not your conversation.' };

  await prisma.conversationMessage.create({
    data: { conversationId, senderId: userId, body: text },
  });
  // The list is ordered by this, so it has to move when anything is said.
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  revalidatePath('/chat');
  return { success: true };
}

export async function markConversationRead(conversationId: string) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const mine = await membership(userId, conversationId);
  if (!mine) return { error: 'Not your conversation.' };

  await prisma.conversationMember.update({
    where: { id: mine.id },
    data: { lastReadAt: new Date() },
  });
  return { success: true };
}

/** Total unread across every conversation, for the sidebar badge. */
export async function getUnreadCount(): Promise<number> {
  const userId = await getUserId();
  if (!userId) return 0;

  const memberships = await prisma.conversationMember.findMany({
    where: { userId },
    select: { conversationId: true, lastReadAt: true },
  });
  if (memberships.length === 0) return 0;

  const counts = await Promise.all(
    memberships.map((m) =>
      prisma.conversationMessage.count({
        where: {
          conversationId: m.conversationId,
          senderId: { not: userId },
          ...(m.lastReadAt ? { createdAt: { gt: m.lastReadAt } } : {}),
        },
      })
    )
  );
  return counts.reduce((a, b) => a + b, 0);
}

/* ------------------------------------------------------------------ sharing */

/** What the sender can offer: their own week, and their own notes. */
export async function getShareables(): Promise<{
  timetable: { count: number; subjects: string[] };
  notes: { id: string; subject: string; words: number }[];
}> {
  const userId = await getUserId();
  if (!userId) return { timetable: { count: 0, subjects: [] }, notes: [] };

  const scope = await getViewScope(userId);
  const [templates, notes] = await Promise.all([
    prisma.scheduleTemplate.findMany({
      where: { userId, ...byClass(scope) },
      select: { subject: true },
    }),
    prisma.studioNote.findMany({
      where: { userId, ...byClass(scope) },
      select: { id: true, subject: true, content: true },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    }),
  ]);

  return {
    timetable: {
      count: templates.length,
      subjects: [...new Set(templates.map((t) => t.subject))],
    },
    notes: notes
      .filter((n) => n.content.trim())
      .map((n) => ({
        id: n.id,
        subject: n.subject,
        words: n.content.trim().split(/\s+/).filter(Boolean).length,
      })),
  };
}

export async function shareTimetable(conversationId: string, note: string) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const mine = await membership(userId, conversationId);
  if (!mine) return { error: 'Not your conversation.' };

  const scope = await getViewScope(userId);
  const blocks = await prisma.scheduleTemplate.findMany({
    where: { userId, ...byClass(scope) },
    select: {
      dayOfWeek: true,
      subject: true,
      startTime: true,
      endTime: true,
      type: true,
      deadlineDay: true,
    },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });
  if (blocks.length === 0) return { error: 'You have no weekly timetable to share yet.' };

  await prisma.conversationMessage.create({
    data: {
      conversationId,
      senderId: userId,
      body: note.trim().slice(0, MAX_BODY),
      shareKind: 'TIMETABLE',
      shareTitle: 'My weekly timetable',
      sharePayload: JSON.stringify({ blocks }),
    },
  });
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  revalidatePath('/chat');
  return { success: true };
}

export async function shareNote(conversationId: string, noteId: string, note: string) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const mine = await membership(userId, conversationId);
  if (!mine) return { error: 'Not your conversation.' };

  const source = await prisma.studioNote.findFirst({
    where: { id: noteId, userId },
    select: { subject: true, content: true },
  });
  if (!source) return { error: 'That note is gone.' };
  if (!source.content.trim()) return { error: 'That note is empty.' };

  await prisma.conversationMessage.create({
    data: {
      conversationId,
      senderId: userId,
      body: note.trim().slice(0, MAX_BODY),
      shareKind: 'NOTE',
      shareTitle: source.subject,
      sharePayload: JSON.stringify({ subject: source.subject, content: source.content }),
    },
  });
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  revalidatePath('/chat');
  return { success: true };
}

/** The full contents of a share, fetched when the receiver opens the card. */
export async function getShare(messageId: string) {
  const userId = await getUserId();
  if (!userId) return null;

  const message = await prisma.conversationMessage.findUnique({
    where: { id: messageId },
    select: { conversationId: true, shareKind: true, shareTitle: true, sharePayload: true },
  });
  if (!message?.shareKind || !message.sharePayload) return null;

  const mine = await membership(userId, message.conversationId);
  if (!mine) return null;

  try {
    return {
      kind: message.shareKind as 'TIMETABLE' | 'NOTE',
      title: message.shareTitle ?? '',
      payload: JSON.parse(message.sharePayload) as unknown,
    };
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------- importing */

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Copy a shared timetable into your own week.
 *
 * Re-validated here rather than trusted, even though this app wrote the
 * payload: it has been through a JSON column and a client, and a bad "HH:MM"
 * does not throw - it silently sorts and compares wrong, and the day quietly
 * stops matching reality.
 */
export async function importSharedTimetable(messageId: string) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const share = await getShare(messageId);
  if (!share || share.kind !== 'TIMETABLE') return { error: 'That share is gone.' };

  const raw = (share.payload as { blocks?: unknown })?.blocks;
  if (!Array.isArray(raw)) return { error: 'That timetable could not be read.' };

  const stamp = await requireClassStamp(userId);
  const existing = await prisma.scheduleTemplate.findMany({
    where: { userId, ...byClass(await getViewScope(userId)) },
    select: { dayOfWeek: true, subject: true, startTime: true },
  });
  const already = new Set(
    existing.map((e) => `${e.dayOfWeek}|${e.subject.toLowerCase()}|${e.startTime}`)
  );

  let added = 0;
  let skipped = 0;

  for (const row of raw.slice(0, 200)) {
    const block = row as Record<string, unknown>;
    const dayOfWeek = Number(block.dayOfWeek);
    const subject = String(block.subject ?? '').trim().slice(0, 120);
    const startTime = String(block.startTime ?? '');
    const endTime = String(block.endTime ?? '');
    const type = block.type === 'REVISION' ? 'REVISION' : 'HOMEWORK';

    if (
      !Number.isInteger(dayOfWeek) ||
      dayOfWeek < 0 ||
      dayOfWeek > 6 ||
      !subject ||
      !TIME.test(startTime) ||
      !TIME.test(endTime)
    ) {
      skipped++;
      continue;
    }

    // Importing the same share twice must not double your week.
    const key = `${dayOfWeek}|${subject.toLowerCase()}|${startTime}`;
    if (already.has(key)) {
      skipped++;
      continue;
    }
    already.add(key);

    await prisma.scheduleTemplate.create({
      data: {
        userId,
        ...stamp,
        dayOfWeek,
        subject,
        startTime,
        endTime,
        type,
        deadlineDay: String(block.deadlineDay ?? '').trim().slice(0, 40) || 'Monday',
      },
    });
    added++;
  }

  revalidatePath('/manage');
  revalidatePath('/');
  return { success: true, added, skipped };
}

/**
 * Copy a shared note into your own notes.
 *
 * StudioNote is one document per subject, so an existing note is APPENDED to,
 * never replaced - overwriting somebody's own work because a classmate sent
 * something on the same subject would be unforgivable. The appended block says
 * where it came from.
 */
export async function importSharedNote(messageId: string) {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const share = await getShare(messageId);
  if (!share || share.kind !== 'NOTE') return { error: 'That share is gone.' };

  const payload = share.payload as { subject?: string; content?: string };
  const subject = String(payload?.subject ?? '').trim().slice(0, 120);
  const content = String(payload?.content ?? '').trim();
  if (!subject || !content) return { error: 'That note could not be read.' };

  const sender = await prisma.conversationMessage.findUnique({
    where: { id: messageId },
    select: { sender: { select: { username: true } } },
  });
  const from = sender?.sender.username ?? 'someone';
  const stamp = await requireClassStamp(userId);

  const existing = await prisma.studioNote.findFirst({
    where: { userId, subject, ...byClass(await getViewScope(userId)) },
    select: { id: true, content: true },
  });

  if (existing) {
    await prisma.studioNote.update({
      where: { id: existing.id },
      data: {
        content: `${existing.content.trimEnd()}\n\n---\n\n## Shared by ${from}\n\n${content}`,
      },
    });
    return { success: true, appended: true, subject };
  }

  await prisma.studioNote.create({
    data: { userId, ...stamp, subject, content: `## Shared by ${from}\n\n${content}` },
  });

  revalidatePath('/subjects');
  return { success: true, appended: false, subject };
}
