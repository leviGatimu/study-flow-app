"use client";

import * as React from "react";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel, PanelTitle } from "@/components/ui/panel";
import type { getSettingsData } from "@/lib/actions";

/** Everything the settings page loads on the server, keys reduced to hints. */
export type SettingsData = NonNullable<Awaited<ReturnType<typeof getSettingsData>>>;

/** The native <select> look, matched to <Input>. Native because the timezone list is 400+ long. */
export const selectClass =
  "h-9 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

/**
 * One settings panel: the contract's Panel with its h3, plus a sentence on
 * what the settings inside it change.
 */
export function SettingsPanel({
  title,
  icon,
  description,
  action,
  children,
  className,
  tone = "default",
}: {
  title: React.ReactNode;
  icon?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  tone?: "default" | "danger";
}) {
  return (
    <Panel className={cn(tone === "danger" && "border-destructive/30", className)}>
      <PanelTitle icon={icon} action={action} className={cn(description && "mb-1")}>
        {title}
      </PanelTitle>
      {description && <p className="mb-5 text-sm text-muted-foreground">{description}</p>}
      {children}
    </Panel>
  );
}

/**
 * A label-and-control line inside a panel. Stacks on narrow screens so a
 * select or a button group never pushes the page sideways.
 */
export function SettingRow({
  label,
  description,
  htmlFor,
  children,
  className,
}: {
  label: React.ReactNode;
  description?: React.ReactNode;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="min-w-0 space-y-0.5">
        {htmlFor ? (
          <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
            {label}
          </Label>
        ) : (
          <p className="text-sm font-medium text-foreground">{label}</p>
        )}
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/** A labelled field stacked label-over-input. */
export function Field({
  id,
  label,
  hint,
  children,
  className,
}: {
  id: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** A password input with a show/hide toggle. */
export function PasswordField({
  id,
  name,
  label,
  autoComplete,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <Field id={id} label={label}>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          className="h-9 pr-10"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </Field>
  );
}

/**
 * A small set of mutually exclusive options (theme, primary AI provider),
 * exposed as a radio group so a screen reader announces the choice.
 */
export function ChoiceGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  className,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; description?: string; icon?: React.ReactNode }[];
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid gap-2", className)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex min-w-0 flex-col items-start gap-0.5 rounded-xl border px-4 py-3 text-left transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              selected
                ? "border-primary bg-primary/5 text-foreground"
                : "border-border text-foreground hover:bg-muted/60"
            )}
          >
            <span className="flex items-center gap-2 text-sm font-semibold [&_svg]:size-4 [&_svg]:text-muted-foreground">
              {option.icon}
              {option.label}
            </span>
            {option.description && (
              <span className="text-xs text-muted-foreground">{option.description}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Log the real error for whoever reads the console; give the user a sentence. */
export function reportError(context: string, error: unknown) {
  console.error(`[settings] ${context}`, error);
}
