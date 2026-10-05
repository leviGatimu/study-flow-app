/**
 * The lifecycle of one Ask AI turn, keyed by a client-minted requestId.
 *
 *   begin    -> the user's message, saved once per (session, requestId);
 *               a retry reuses it, and a turn that already has its answer
 *               returns that answer instead of asking the model again
 *   finish   -> saves the reply and marks the turn DONE - unless it was
 *               stopped meanwhile, in which case the reply is discarded
 *   fail     -> marks the turn FAILED, so the UI offers Retry in place
 *
 * Takes the database as a parameter (no runtime imports) so the sync harness
 * can test it against real SQLite, concurrency included.
 */

type Row = { id: string; role: string; content: string; status: string; requestId: string | null; sources: string | null; createdAt: Date };

type Db = {
  chatMessage: {
    findFirst: (args: unknown) => Promise<Row | null>;
    findUnique: (args: unknown) => Promise<{ status: string } | null>;
    create: (args: unknown) => Promise<Row>;
    update: (args: unknown) => Promise<Row>;
  };
};

const SELECT = { id: true, role: true, content: true, status: true, requestId: true, sources: true, createdAt: true } as const;

export type BeginResult = { userMessage: Row; answered: Row | null };

export async function beginTurn(dbIn: unknown, sessionId: string, requestId: string, question: string): Promise<BeginResult> {
  const db = dbIn as Db;
  let userMessage = await db.chatMessage.findFirst({ where: { sessionId, requestId }, select: SELECT });

  if (userMessage?.status === 'DONE') {
    const answered = await db.chatMessage.findFirst({
      where: { sessionId, role: 'model', createdAt: { gte: userMessage.createdAt } },
      select: SELECT,
      orderBy: { createdAt: 'asc' },
    });
    if (answered) return { userMessage, answered };
  }

  if (!userMessage) {
    try {
      userMessage = await db.chatMessage.create({
        data: { sessionId, role: 'user', content: question, requestId, status: 'PENDING' },
        select: SELECT,
      });
    } catch {
      // A concurrent duplicate of the same send won the unique index.
      userMessage = await db.chatMessage.findFirst({ where: { sessionId, requestId }, select: SELECT });
      if (!userMessage) throw new Error('Could not save your message. Try again.');
    }
  } else {
    userMessage = await db.chatMessage.update({ where: { id: userMessage.id }, data: { status: 'PENDING' }, select: SELECT });
  }
  return { userMessage, answered: null };
}

/** Save the reply - or, if the turn was stopped while answering, discard it. */
export async function finishTurn(
  dbIn: unknown,
  sessionId: string,
  userMessageId: string,
  reply: string,
  sources: string | null
): Promise<{ userMessage: Row; reply: Row } | { stopped: true }> {
  const db = dbIn as Db;
  const current = await db.chatMessage.findUnique({ where: { id: userMessageId }, select: { status: true } });
  if (current?.status !== 'PENDING') return { stopped: true };
  const saved = await db.chatMessage.create({ data: { sessionId, role: 'model', content: reply, sources }, select: SELECT });
  const done = await db.chatMessage.update({ where: { id: userMessageId }, data: { status: 'DONE' }, select: SELECT });
  return { userMessage: done, reply: saved };
}

export async function failTurn(dbIn: unknown, userMessageId: string): Promise<Row> {
  const db = dbIn as Db;
  return db.chatMessage.update({ where: { id: userMessageId }, data: { status: 'FAILED' }, select: SELECT });
}
