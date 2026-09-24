"use client";

import { useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { CheckCircle2, Compass, KeyRound, LogOut, Rocket, ShieldAlert, User } from "lucide-react";

import { logoutUser, updatePassword, updateUserName } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, PasswordField, SettingRow, SettingsPanel, reportError, type SettingsData } from "./settings-ui";

export function ProfileSettings({ data }: { data: SettingsData }) {
  const router = useRouter();
  const savedName = data.progress?.name ?? "";
  const [name, setName] = useState(savedName);
  const [savingName, startSavingName] = useTransition();

  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [savingPassword, startSavingPassword] = useTransition();

  const saveName = () =>
    startSavingName(async () => {
      try {
        await updateUserName(name.trim());
        toast.success("Name saved.");
        router.refresh();
      } catch (error) {
        reportError("update name", error);
        toast.error("Your name could not be saved. Check your connection and try again.");
      }
    });

  const changePassword = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setPasswordError(null);
    setPasswordSaved(false);
    startSavingPassword(async () => {
      try {
        const result = await updatePassword(formData);
        if (result.error) {
          setPasswordError(result.error);
        } else {
          setPasswordSaved(true);
          toast.success("Password changed.");
          form.reset();
        }
      } catch (error) {
        reportError("update password", error);
        setPasswordError("Your password could not be changed. Check your connection and try again.");
      }
    });
  };

  const nameChanged = name.trim() !== savedName && name.trim() !== "";

  return (
    <div className="space-y-6">
      <SettingsPanel
        title="Your details"
        icon={<User />}
        description={`Signed in as ${data.username} since ${format(new Date(data.createdAt), "d MMMM yyyy")}. Your username is how you log in and cannot be changed.`}
      >
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (nameChanged) saveName();
          }}
        >
          <Field id="settings-display-name" label="Display name" className="flex-1 sm:max-w-sm">
            <Input
              id="settings-display-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
              className="h-9"
            />
          </Field>
          <Button type="submit" size="lg" disabled={savingName || !nameChanged}>
            {savingName ? "Saving…" : "Save name"}
          </Button>
        </form>
      </SettingsPanel>

      <SettingsPanel
        title="Password"
        icon={<KeyRound />}
        description="Enter your current password, then the new one twice."
      >
        <form onSubmit={changePassword} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <PasswordField
              id="settings-current-password"
              name="currentPassword"
              label="Current password"
              autoComplete="current-password"
            />
            <PasswordField
              id="settings-new-password"
              name="newPassword"
              label="New password"
              autoComplete="new-password"
            />
            <PasswordField
              id="settings-confirm-password"
              name="confirmPassword"
              label="Confirm new password"
              autoComplete="new-password"
            />
          </div>

          {passwordError && (
            <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-destructive">
              <ShieldAlert className="size-4 shrink-0" /> {passwordError}
            </p>
          )}
          {passwordSaved && (
            <p role="status" className="flex items-center gap-1.5 text-sm font-medium text-success">
              <CheckCircle2 className="size-4 shrink-0" /> Password changed.
            </p>
          )}

          <Button type="submit" size="lg" disabled={savingPassword}>
            {savingPassword ? "Changing…" : "Change password"}
          </Button>
        </form>
      </SettingsPanel>

      {/* The way back into onboarding. Both can be dismissed for good from the
          dashboard, so without a permanent door here a user who skipped setup on
          day one would never find it again. */}
      <SettingsPanel
        title="Getting started"
        icon={<Rocket />}
        description="Run the setup questions again, or take the guided tour."
      >
        <div className="divide-y divide-border/60">
          <SettingRow
            label="Set up your year"
            description="Your class, term dates, subjects, AI key and study week, in one pass."
          >
            <Button variant="outline" asChild>
              <Link href="/setup">Open setup</Link>
            </Button>
          </SettingRow>
          <SettingRow
            label="Guided tour"
            description="Walks you through the app page by page. About three minutes."
          >
            <Button variant="outline" onClick={() => router.push("/?tour=1")} className="gap-1.5">
              <Compass className="size-4" /> Start tour
            </Button>
          </SettingRow>
        </div>
      </SettingsPanel>

      <SettingsPanel title="Session" icon={<LogOut />}>
        <SettingRow label="Log out" description="End your session on this device.">
          <form action={logoutUser}>
            <LogOutButton />
          </form>
        </SettingRow>
      </SettingsPanel>
    </div>
  );
}

function LogOutButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" disabled={pending} className="gap-1.5">
      <LogOut className="size-4" />
      {pending ? "Logging out…" : "Log out"}
    </Button>
  );
}
