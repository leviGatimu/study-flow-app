"use client";

import { useSyncExternalStore } from "react";
import { Check, Laptop, Moon, Palette, Sun } from "lucide-react";

import { useTheme, type Accent } from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";
import { ChoiceGroup, SettingRow, SettingsCard, SettingsSection } from "./settings-ui";
import styles from "./Settings.module.css";

type Mode = "light" | "dark" | "system";

const noopSubscribe = () => () => {};

/**
 * The accent colours, with a swatch for each (the light-mode shade). The CSS
 * that recolours the app lives in globals.css under "Accent colours". Orange
 * is left out on purpose: it already means revision blocks.
 */
const ACCENT_CHOICES: { value: Accent; label: string; swatch: string }[] = [
  { value: "blue", label: "Blue", swatch: "oklch(0.5 0.15 260)" },
  { value: "indigo", label: "Indigo", swatch: "oklch(0.5 0.19 277)" },
  { value: "violet", label: "Violet", swatch: "oklch(0.52 0.2 300)" },
  { value: "teal", label: "Teal", swatch: "oklch(0.5 0.1 195)" },
  { value: "emerald", label: "Green", swatch: "oklch(0.5 0.13 155)" },
  { value: "rose", label: "Rose", swatch: "oklch(0.54 0.2 12)" },
  { value: "slate", label: "Graphite", swatch: "oklch(0.32 0.02 264)" },
];

/**
 * Light, dark, or follow the computer, and the app's main colour.
 *
 * The "Glass" theme is gone (it had no CSS behind it); a stored "glass" choice
 * already resolves like "system" in ThemeProvider, so it is shown as System.
 */
export function AppearanceSettings() {
  const { theme, setTheme, accent, setAccent } = useTheme();
  // The theme is read from localStorage, which the server cannot see.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const value: Mode = theme === "light" || theme === "dark" ? theme : "system";

  return (
    <SettingsSection id="appearance" icon={Palette} title="Appearance" description="Light or dark, and the app's main colour. Saved on this device.">
      <SettingsCard>
        <SettingRow id="theme" stacked label="Theme" description="Changes straight away.">
          <ChoiceGroup<Mode>
            label="Theme"
            value={mounted ? value : "system"}
            onChange={setTheme}
            className="mt-1 sm:grid-cols-3"
            options={[
              { value: "light", label: "Light", description: "A bright workspace", icon: <Sun /> },
              { value: "dark", label: "Dark", description: "Easier at night", icon: <Moon /> },
              { value: "system", label: "System", description: "Follow your device", icon: <Laptop /> },
            ]}
            renderPreview={(mode) => (
              <span aria-hidden="true" className={styles.preview} data-mode={mode}>
                <span className={styles.previewWindow}>
                  <span className={styles.previewRail}>
                    <span /><span /><span />
                  </span>
                  <span className={styles.previewLines}>
                    <span /><span /><span />
                  </span>
                </span>
              </span>
            )}
          />
        </SettingRow>
        <SettingRow
          id="accent"
          stacked
          label="Main colour"
          description="Used for buttons, links, the selected page and highlights. Changes straight away."
        >
          <div role="radiogroup" aria-label="Main colour" className="mt-1 flex flex-wrap gap-2">
            {ACCENT_CHOICES.map((c) => {
              const selected = (mounted ? accent : "blue") === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setAccent(c.value)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    selected ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="flex size-5 items-center justify-center rounded-full text-white ring-1 ring-black/10"
                    style={{ backgroundColor: c.swatch }}
                  >
                    {selected && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  {c.label}
                </button>
              );
            })}
          </div>
        </SettingRow>
      </SettingsCard>
    </SettingsSection>
  );
}
