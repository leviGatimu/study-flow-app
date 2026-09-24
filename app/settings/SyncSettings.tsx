"use client";

import { useEffect, useState } from "react";
import { Download, MonitorDown, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SyncPanel } from "@/components/SyncPanel";
import { DesktopUpdater, useIsDesktopApp } from "@/components/DesktopUpdater";
import { SettingRow, SettingsPanel } from "./settings-ui";

export function SyncSettings() {
  const isDesktopApp = useIsDesktopApp();

  return (
    <div className="space-y-6">
      {/* SyncPanel decides for itself whether sync applies: what matters is
          which DATABASE this server talks to, and only the server knows that. */}
      <SettingsPanel
        title="Sync with the website"
        icon={<RefreshCw />}
        description="Keeps the desktop app and your website account in step. Changes go across on their own."
      >
        <SyncPanel
          unavailable={
            <p className="text-sm text-muted-foreground">
              You are using the website, so everything is already saved to your account. Sync is
              for the desktop app: sign in there with this username and your work follows you
              between the two.
            </p>
          }
        />
      </SettingsPanel>

      {isDesktopApp ? (
        <SettingsPanel
          title="Desktop app"
          icon={<MonitorDown />}
          description="Check for and install a newer version of Study Flow."
        >
          <div className="sm:max-w-md">
            <DesktopUpdater />
          </div>
        </SettingsPanel>
      ) : (
        <InstallAppPanel />
      )}
    </div>
  );
}

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * "Install as an app" for browsers that offer it. The browser decides when an
 * install is possible and fires `beforeinstallprompt`; until it does, the
 * panel says how to do it from the browser menu instead of showing nothing.
 */
function InstallAppPanel() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") {
      setInstalled(true);
      setPrompt(null);
    }
  };

  return (
    <SettingsPanel title="Install as an app" icon={<Download />}>
      <SettingRow
        label="Open Study Flow in its own window"
        description={
          installed
            ? "Installed. Open it from your Start menu, dock or home screen."
            : prompt
              ? "Your browser can install it now."
              : "If your browser supports it, choose Install app from its menu or address bar."
        }
      >
        {prompt && !installed && (
          <Button variant="outline" onClick={() => void install()} className="gap-1.5">
            <Download className="size-4" /> Install
          </Button>
        )}
      </SettingRow>
    </SettingsPanel>
  );
}
