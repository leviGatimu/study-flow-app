"use client";

import { useSyncExternalStore } from "react";
import { Laptop, Moon, Palette, Sun } from "lucide-react";

import { useTheme } from "@/components/ThemeProvider";
import { ChoiceGroup, SettingsPanel } from "./settings-ui";

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
    <SettingsPanel
      title="Theme"
      icon={<Palette />}
      description="Saved in this browser. The sun and moon button in the header switches it too."
    >
      <ChoiceGroup<Mode>
        label="Theme"
        value={mounted ? value : "system"}
        onChange={setTheme}
        className="sm:max-w-xl sm:grid-cols-3"
        options={[
          { value: "light", label: "Light", icon: <Sun /> },
          { value: "dark", label: "Dark", icon: <Moon /> },
          { value: "system", label: "Match my computer", icon: <Laptop /> },
        ]}
      />
    </SettingsPanel>
  );
}
