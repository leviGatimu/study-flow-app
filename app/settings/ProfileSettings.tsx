"use client";

import { useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { Check, CheckCircle2, Compass, KeyRound, LogOut, Rocket, ShieldAlert, User, X } from "lucide-react";

import { logoutEverywhere, logoutUser, updatePassword, updateUserName } from "@/lib/actions";
import { passwordStrength } from "@/lib/password-strength";
import { Button } from "@/components/ui/button";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { Input } from "@/components/ui/input";
import {
  PasswordField,
  SettingRow,
  SettingsCard,
  SettingsSection,
  reportError,
  type SettingsData,
} from "./settings-ui";

/**
 * Account settings. On /settings it is the Account section; /profile reuses
 * it without the details card (that page has its own profile editor).
 */
export function ProfileSettings({ data, showDetails = true }: { data: SettingsData; showDetails?: boolean }) {
  const cards = (
    <>
      {showDetails && <DetailsCard data={data} />}
      <SettingsCard title="Security">
        <PasswordRow />
        <SettingRow id="log-out" label="Log out" description="End your session on this device.">
          <form action={logoutUser}>
            <LogOutButton />
          </form>
        </SettingRow>
        <SettingRow
          id="log-out-everywhere"
          label="Log out everywhere"
          description="Signs out every browser and desktop app on your account, this one included. Desktop apps need to connect again to keep syncing."
        >
          <form action={logoutEverywhere}>
            <LogOutButton everywhere />
          </form>
        </SettingRow>
      </SettingsCard>
      {/* The way back into onboarding. Both can be dismissed for good from the
          dashboard, so without a permanent door here a user who skipped setup on
          day one would never find it again. */}
      <GettingStartedCard />
    </>
  );

  // /profile: the two cards side by side, equal height.
  if (!showDetails) return <div className="grid gap-6 lg:grid-cols-2">{cards}</div>;
  return (
    <SettingsSection id="profile" icon={User} title="Account" description="Your name, password and getting-started help.">
      {cards}
    </SettingsSection>
  );
}

function DetailsCard({ data }: { data: SettingsData }) {
  const router = useRouter();
  const savedName = data.progress?.name ?? "";
  const [name, setName] = useState(savedName);
  const [saving, startSaving] = useTransition();
  const nameChanged = name.trim() !== savedName && name.trim() !== "";

  const saveName = () =>
    startSaving(async () => {
      try {
        await updateUserName(name.trim());
        toast.success("Name saved.");
        router.refresh();
      } catch (error) {
        reportError("update name", error);
        toast.error("Your name could not be saved. Check your connection and try again.");
      }
    });

  return (
    <SettingsCard>
      <div className="flex items-center gap-4 border-b border-border px-6 py-5 max-sm:px-[18px]">
        <ProfileAvatar name={savedName || data.username} url={data.progress?.avatarUrl} className="size-14 text-lg" />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{savedName || data.username}</p>
          <p className="truncate text-sm text-muted-foreground">@{data.username}</p>
        </div>
      </div>

      <SettingRow
        id="display-name"
        label="Display name"
        htmlFor="settings-display-name"
        description="Used in your greeting and reports."
      >
        <form
          className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (nameChanged) saveName();
          }}
        >
          <Input
            id="settings-display-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
            className="h-10 sm:w-64"
          />
          {nameChanged && (
            <Button type="submit" size="lg" disabled={saving} className="h-10">
              {saving ? "Saving…" : "Save"}
            </Button>
          )}
        </form>
      </SettingRow>
      <SettingRow
        id="username"
        label="Username"
        description={`You sign in with this. Joined ${format(new Date(data.createdAt), "d MMMM yyyy")}.`}
      >
        <span className="rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-sm">{data.username}</span>
      </SettingRow>
      <SettingRow id="full-profile" label="Profile and photo" description="Your photo, school and bio.">
        <Button variant="outline" asChild>
          <Link href="/profile">Edit profile</Link>
        </Button>
      </SettingRow>
    </SettingsCard>
  );
}

function PasswordRow() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, startSaving] = useTransition();
  const meter = passwordStrength(password);
  const matches = confirm.length > 0 && confirm === password;

  const close = () => {
    setOpen(false);
    setError(null);
    setPassword("");
    setConfirm("");
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setError(null);
    if (password !== confirm) {
      setError("The new passwords do not match.");
      return;
    }
    startSaving(async () => {
      try {
        const result = await updatePassword(formData);
        if (result.error) {
          setError(result.error);
        } else {
          toast.success("Password changed.");
          setSaved(true);
          form.reset();
          close();
        }
      } catch (error) {
        reportError("update password", error);
        setError("Your password could not be changed. Check your connection and try again.");
      }
    });
  };

  return (
    <SettingRow
      id="password"
      label="Password"
      stacked={open}
      aside={
        saved && !open ? (
          <span role="status" className="inline-flex items-center gap-1 text-xs font-medium text-success">
            <CheckCircle2 className="size-3.5" /> Changed
          </span>
        ) : undefined
      }
      description={open ? "Enter your current password, then the new one twice. Other devices are signed out." : "Change the password you sign in with."}
    >
      {!open ? (
        <Button variant="outline" onClick={() => { setSaved(false); setOpen(true); }} className="gap-1.5">
          <KeyRound className="size-4" /> Change password
        </Button>
      ) : (
        <form onSubmit={submit} className="mt-1 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <PasswordField
              id="settings-current-password"
              name="currentPassword"
              label="Current password"
              autoComplete="current-password"
            />
            <div className="hidden sm:block" />
            <PasswordField
              id="settings-new-password"
              name="newPassword"
              label="New password"
              autoComplete="new-password"
              describedBy="settings-password-meter"
              onValueChange={setPassword}
              hint={
                <span id="settings-password-meter" aria-live="polite" className="flex items-center gap-3 pt-1">
                  <span className="grid flex-1 grid-cols-4 gap-1" aria-hidden="true">
                    {[1, 2, 3, 4].map((i) => (
                      <span key={i} className="h-1 overflow-hidden rounded-full bg-muted">
                        <span
                          className={`block h-full rounded-full transition-all duration-300 ${meter && i <= meter.score ? meter.tone : ""}`}
                          style={{ width: meter && i <= meter.score ? "100%" : "0%" }}
                        />
                      </span>
                    ))}
                  </span>
                  <span className="w-16 text-right">{meter ? meter.label : "8+ characters"}</span>
                </span>
              }
            />
            <PasswordField
              id="settings-confirm-password"
              name="confirmPassword"
              label="Confirm new password"
              autoComplete="new-password"
              describedBy="settings-confirm-hint"
              onValueChange={setConfirm}
              hint={
                <span id="settings-confirm-hint" aria-live="polite" className="flex min-h-5 items-center gap-1.5 pt-1">
                  {confirm &&
                    (matches ? (
                      <>
                        <Check className="size-3.5 text-success" aria-hidden="true" />
                        <span className="text-success">Passwords match</span>
                      </>
                    ) : (
                      <>
                        <X className="size-3.5 text-orange-500" aria-hidden="true" />
                        <span>Doesn’t match yet</span>
                      </>
                    ))}
                </span>
              }
            />
          </div>

          {error && (
            <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-destructive">
              <ShieldAlert className="size-4 shrink-0" /> {error}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="lg" disabled={saving || password.length < 8 || !matches}>
              {saving ? "Changing…" : "Change password"}
            </Button>
            <Button type="button" variant="ghost" size="lg" onClick={close} disabled={saving}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </SettingRow>
  );
}

function GettingStartedCard() {
  const router = useRouter();
  return (
    <SettingsCard title="Getting started">
      <SettingRow
        id="setup"
        label="Set up your year"
        description="Your class, term dates, subjects, AI key and study week, in one pass."
      >
        <Button variant="outline" asChild className="gap-1.5">
          <Link href="/setup">
            <Rocket className="size-4" /> Open setup
          </Link>
        </Button>
      </SettingRow>
      <SettingRow id="tour" label="Guided tour" description="Walks you through the app page by page. About three minutes.">
        <Button variant="outline" onClick={() => router.push("/?tour=1")} className="gap-1.5">
          <Compass className="size-4" /> Start tour
        </Button>
      </SettingRow>
    </SettingsCard>
  );
}

function LogOutButton({ everywhere = false }: { everywhere?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" disabled={pending} className="gap-1.5">
      <LogOut className="size-4" />
      {pending ? "Logging out…" : everywhere ? "Log out everywhere" : "Log out"}
    </Button>
  );
}
