"use client";

import * as React from "react";
import { useState } from "react";
import { Eye, EyeOff, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import styles from "./Settings.module.css";
import type { getSettingsData } from "@/lib/actions";

/** Everything the settings page loads on the server, keys reduced to hints. */
export type SettingsData = NonNullable<Awaited<ReturnType<typeof getSettingsData>>>;

/** The native <select> look, matched to <Input>. Native because the timezone list is 400+ long. */
export const selectClass =
  "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

/** DOM id of a setting row, so search and the setup status can jump to it. */
export const settingAnchor = (id: string) => `setting-${id}`;

/**
 * One area of the settings page (Account, AI, ...). The id doubles as the
 * ?tab= value, so old deep links still land on the right section.
 */
export function SettingsSection({
  id,
  icon: Icon,
  title,
  description,
  tone = "default",
  tour,
  children,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  tone?: "default" | "danger";
  /** Anchor for the guided tour (data-tour). */
  tour?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      data-settings-section
      data-tour={tour}
      className={cn(styles.section, tone === "danger" && styles.danger)}
    >
      <header className={styles.sectionHeader}>
        <span className={styles.sectionIcon} aria-hidden="true">
          <Icon />
        </span>
        <div className="min-w-0">
          <h2 id={`${id}-title`}>{title}</h2>
          <p>{description}</p>
        </div>
      </header>
      <div className={styles.cards}>{children}</div>
    </section>
  );
}

/** A bordered group of rows inside a section, with an optional small heading. */
export function SettingsCard({
  title,
  action,
  children,
  className,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(styles.card, className)}>
      {(title || action) && (
        <div className={styles.cardHeader}>
          {title && <h3>{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * One setting: what it is on the left, its control on the right. `stacked`
 * puts the control under the text for wide controls (theme cards, key forms).
 * Stacks on narrow screens either way, so nothing pushes the page sideways.
 */
export function SettingRow({
  id,
  label,
  description,
  htmlFor,
  aside,
  stacked = false,
  children,
  className,
}: {
  /** Search/status anchor; becomes the element id `setting-<id>`. */
  id?: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  htmlFor?: string;
  /** Small status next to the label, e.g. a "Saved" pill. */
  aside?: React.ReactNode;
  stacked?: boolean;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      id={id ? settingAnchor(id) : undefined}
      className={cn(styles.row, stacked && styles.stacked, className)}
    >
      <div className={styles.rowText}>
        <div className="flex flex-wrap items-center gap-2">
          {htmlFor ? (
            <Label htmlFor={htmlFor} className={styles.rowLabel}>
              {label}
            </Label>
          ) : (
            <p className={styles.rowLabel}>{label}</p>
          )}
          {aside}
        </div>
        {description && <div className={styles.rowDescription}>{description}</div>}
      </div>
      {children && <div className={styles.rowControl}>{children}</div>}
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
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

/** A password input with a show/hide toggle. */
export function PasswordField({
  id,
  name,
  label,
  autoComplete,
  describedBy,
  onValueChange,
  hint,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  describedBy?: string;
  onValueChange?: (value: string) => void;
  hint?: React.ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <Field id={id} label={label} hint={hint}>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          aria-describedby={describedBy}
          onChange={(e) => onValueChange?.(e.target.value)}
          className="h-10 pr-10"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
          className="absolute right-1 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
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
  renderPreview,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; description?: string; icon?: React.ReactNode }[];
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
  renderPreview?: (value: T) => React.ReactNode;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid gap-3", className)}>
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
            className={styles.choice}
          >
            {renderPreview?.(option.value)}
            <span className="flex w-full items-center gap-2 text-sm font-semibold [&_svg]:size-4 [&_svg]:text-muted-foreground">
              {option.icon}
              {option.label}
              <span className={styles.choiceDot} aria-hidden="true" />
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
