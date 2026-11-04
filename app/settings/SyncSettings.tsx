"use client";

import { useEffect, useState } from "react";
import { Download, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SyncPanel } from "@/components/SyncPanel";
import { DesktopUpdater, useIsDesktopApp } from "@/components/DesktopUpdater";
import { SettingRow, SettingsCard, SettingsSection } from "./settings-ui";

export function SyncSettings() {
  const isDesktopApp = useIsDesktopApp();

  return (
    <SettingsSection
      id="sync"
      icon={RefreshCw}
      title="Sync & apps"
      description="The desktop app, the website, and installing Study Flow."
    >
      <SettingsCard>
        {/* SyncPanel decides for itself whether sync applies: what matters is
            which DATABASE this server talks to, and only the server knows that. */}
        <SettingRow
          id="sync"
          stacked
          label="Sync with the website"
          description="Keeps the desktop app and your website account in step. Changes go across on their own."
        >
          <div className="mt-1">
            <SyncPanel
              unavailable={
                <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                  You are using the website, so everything is already saved to your account. Sync is
                  for the desktop app: sign in there with this username and your work follows you
                  between the two.
                </p>
              }
            />
          </div>
        </SettingRow>
        {isDesktopApp ? (
          <SettingRow id="app" stacked label="Desktop app" description="Check for and install a newer version of Study Flow.">
            <div className="mt-1 sm:max-w-md">
              <DesktopUpdater />
            </div>
          </SettingRow>
        ) : (
          <InstallAppRow />
        )}
      </SettingsCard>
    </SettingsSection>
  );
}

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * "Install as an app" for browsers that offer it. The browser decides when an
 * install is possible and fires `beforeinstallprompt`; until it does, the
 * row says how to do it from the browser menu instead of showing nothing.
 */
function InstallAppRow() {
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
    <SettingRow
      id="app"
      label="Install as an app"
      description={
        installed
          ? "Installed. Open it from your Start menu, dock or home screen."
          : prompt
            ? "Open Study Flow in its own window. Your browser can install it now."
            : "Open Study Flow in its own window: choose Install app from your browser’s menu or address bar."
      }
    >
      {prompt && !installed && (
        <Button variant="outline" onClick={() => void install()} className="gap-1.5">
          <Download className="size-4" /> Install
        </Button>
      )}
    </SettingRow>
  );
}
