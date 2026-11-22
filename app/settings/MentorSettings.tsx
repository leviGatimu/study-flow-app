"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Eye, Loader2, UserPlus, UserX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmModal } from "@/components/ConfirmModal";
import { createMentorAccess, listMentorAccess, revokeMentorAccess, type MentorAccessRow } from "@/lib/mentor-actions";
import { formatWhen } from "@/components/resources/file-kind";
import { Field, PasswordField, SettingRow, SettingsCard } from "./settings-ui";

/**
 * Settings > Account > Mentor access. The student makes a username and
 * password for their mentor; the mentor signs in on the website with them and
 * sees this account read-only. Turning access off signs the mentor out.
 */
export function MentorSettings() {
  const [state, setState] = useState<{ available: boolean; mentors: MentorAccessRow[] } | null>(null);
  const [adding, setAdding] = useState(false);
  const [revoking, setRevoking] = useState<MentorAccessRow | null>(null);
  const [pending, start] = useTransition();

  const load = () => {
    listMentorAccess()
      .then(setState)
      .catch(() => setState({ available: false, mentors: [] }));
  };
  useEffect(load, []);

  const add = (form: FormData) =>
    start(async () => {
      const result = await createMentorAccess({
        username: String(form.get("mentor-username") ?? ""),
        password: String(form.get("mentor-password") ?? ""),
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Mentor added", {
        description: "Send them the username and password. They sign in on the Study Flow website.",
      });
      setAdding(false);
      load();
    });

  const revoke = (mentor: MentorAccessRow) =>
    start(async () => {
      const result = await revokeMentorAccess(mentor.id);
      if ("error" in result) toast.error(result.error);
      else toast.success(`${mentor.username} can no longer see your Study Flow`);
      setRevoking(null);
      load();
    });

  return (
    <SettingsCard title="Mentor access">
      <SettingRow
        id="mentor-access"
        label="Let a mentor see your progress"
        description="Your mentor signs in on the Study Flow website and sees your schedule, study logs, reports, marks and streak. They can't change anything, and they don't see your AI chats, notes, homework answers or settings."
        stacked
      >
        {state === null ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </p>
        ) : !state.available ? (
          <p className="text-sm text-muted-foreground">Set this up on the Study Flow website. Mentors sign in there.</p>
        ) : (
          <div className="space-y-3">
            {state.mentors.length > 0 && (
              <ul className="divide-y divide-border/60 rounded-xl border border-border/60">
                {state.mentors.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                    <Eye className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{m.username}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.lastSeenAt ? `Last looked ${formatWhen(m.lastSeenAt)}` : "Hasn't signed in yet"}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setRevoking(m)} disabled={pending}>
                      <UserX /> Turn off
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {adding ? (
              <form action={add} className="grid gap-3 rounded-xl border border-border/60 p-3 sm:grid-cols-2">
                <Field id="mentor-username" label="Username for your mentor" hint="3–32 letters, numbers, dots, dashes or underscores.">
                  <Input id="mentor-username" name="mentor-username" autoComplete="off" className="h-10" required minLength={3} maxLength={32} />
                </Field>
                <PasswordField id="mentor-password" name="mentor-password" label="Password" autoComplete="new-password" hint="At least 8 characters." />
                <div className="flex gap-2 sm:col-span-2">
                  <Button type="submit" disabled={pending}>
                    {pending ? <Loader2 className="animate-spin" /> : <UserPlus />} Add mentor
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setAdding(false)} disabled={pending}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <Button variant="outline" onClick={() => setAdding(true)}>
                <UserPlus /> Add a mentor
              </Button>
            )}
          </div>
        )}
      </SettingRow>

      <ConfirmModal
        isOpen={revoking !== null}
        onClose={() => !pending && setRevoking(null)}
        onConfirm={() => revoking && revoke(revoking)}
        title={`Turn off ${revoking?.username ?? ""}'s access?`}
        description="They are signed out straight away and can't sign in with this username again."
        isPending={pending}
        confirmLabel="Turn off"
        pendingLabel="Turning off..."
      />
    </SettingsCard>
  );
}
