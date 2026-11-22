import { SignJWT, jwtVerify } from 'jose';

/**
 * Proof that the server agreed to a direct upload.
 *
 * Starting an upload mints an object name and checks the file; finishing it
 * creates the record that points at that name. Without a ticket, finishing
 * would take a name from the client, and since owning a record that names a
 * file is what grants access to it (lib/file-access.ts ownsUpload), anyone who
 * learned another user's object name could claim it. The ticket binds the
 * name to the account, the place and the size that were approved.
 *
 * Signed with a key derived from JWT_SECRET but distinct from the session
 * key, and carrying no `userId` claim, so a ticket can never pass as a
 * session token.
 */

export type UploadTicket = {
  /** The approved object name in the bucket. */
  name: string;
  userId: string;
  subject: string;
  folder: string;
  /** The file's own name, which becomes the resource title. */
  title: string;
  size: number;
};

const AUDIENCE = 'study-flow-direct-upload';

function key(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set.');
  return new TextEncoder().encode(`${secret}:direct-upload-ticket`);
}

export async function signUploadTicket(ticket: UploadTicket): Promise<string> {
  return new SignJWT({ t: ticket })
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience(AUDIENCE)
    .setIssuedAt()
    // Signed upload URLs last two hours; a ticket never outlives its URL.
    .setExpirationTime('2h')
    .sign(key());
}

export async function readUploadTicket(token: string): Promise<UploadTicket | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { audience: AUDIENCE, algorithms: ['HS256'] });
    const t = payload.t as Partial<UploadTicket> | undefined;
    if (
      !t ||
      typeof t.name !== 'string' ||
      typeof t.userId !== 'string' ||
      typeof t.subject !== 'string' ||
      typeof t.folder !== 'string' ||
      typeof t.title !== 'string' ||
      typeof t.size !== 'number'
    ) {
      return null;
    }
    return t as UploadTicket;
  } catch {
    return null;
  }
}
