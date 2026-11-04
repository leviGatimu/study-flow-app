"use client";

import { useSyncExternalStore } from "react";
import { Laptop, Moon, Palette, Sun } from "lucide-react";

import { useTheme } from "@/components/ThemeProvider";
import { ChoiceGroup, SettingRow, SettingsCard, SettingsSection } from "./settings-ui";
import styles from "./Settings.module.css";

type Mode = "light" | "dark" | "system";

const noopSubscribe = () => () => {};

/**
 * Light, dark, or follow the computer.
 *
 * The old accent-colour picker and the "Glass" theme are gone: neither had any
 * CSS behind it, so choosing them changed nothing. A stored "glass" choice
 * already resolves like "system" in ThemeProvider, so it is shown as System.
 */
export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  // The theme is read from localStorage, which the server cannot see.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const value: Mode = theme === "light" || theme === "dark" ? theme : "system";

  return (
    <SettingsSection id="appearance" icon={Palette} title="Appearance" description="Light, dark, or follow your device. Saved on this device.">
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
      </SettingsCard>
    </SettingsSection>
  );
}
