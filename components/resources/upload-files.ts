import { beginResourceUploads, finishResourceUploads, uploadResourceFiles } from "@/lib/library-actions";
import { putToSignedUrl } from "@/lib/signed-upload";

/**
 * Upload files into a subject folder, whichever way this build stores them.
 *
 * The server decides: with the bucket configured (the website), each file is
 * PUT straight to storage and then confirmed; otherwise (the desktop) the
 * files are posted to the server action as they always were. Callers get the
 * same { added, errors } either way.
 */
export async function uploadIntoResources(
  files: File[],
  subject: string,
  folder: string
): Promise<{ added: number; errors: string[] }> {
  const plan = await beginResourceUploads(
    subject,
    folder,
    files.map((f) => ({ name: f.name, size: f.size, type: f.type }))
  );

  if (plan.mode === "error") return { added: 0, errors: [plan.error] };

  if (plan.mode === "form") {
    const form = new FormData();
    form.set("subject", subject);
    form.set("folder", folder);
    for (const f of files) form.append("file", f);
    return uploadResourceFiles(form);
  }

  const errors: string[] = [];
  const tickets: string[] = [];
  // Three at a time: fast on a good connection, gentle on a phone's.
  const queue = plan.files.map((entry, index) => ({ entry, file: files[index] }));
  const worker = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const { entry, file } = next;
      if (!entry.ok) {
        errors.push(entry.error);
        continue;
      }
      try {
        await putToSignedUrl(entry.uploadUrl, file, file.type);
        tickets.push(entry.ticket);
      } catch (error) {
        errors.push(`${file.name}: ${(error as Error).message}`);
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);

  if (tickets.length === 0) return { added: 0, errors };
  const finished = await finishResourceUploads(tickets);
  return { added: finished.added, errors: [...errors, ...finished.errors] };
}
