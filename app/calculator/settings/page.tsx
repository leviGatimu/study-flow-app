"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Cpu, History, Palette, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Page, PageBody } from "@/components/ui/page";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, PanelTitle } from "@/components/ui/panel";
import { Pill } from "@/components/ui/list-row";
import { cn } from "@/lib/utils";
import {
  CALCULATOR_EVENT,
  DEFAULT_CALCULATOR_SETTINGS,
  loadCalculatorHistory,
  loadCalculatorSettings,
  saveCalculatorHistory,
  saveCalculatorSettings,
} from "@/lib/calculator";

export default function CalculatorSettingsPage() {
  const [settings, setSettings] = useState(DEFAULT_CALCULATOR_SETTINGS);
  const [historyCount, setHistoryCount] = useState(0);
  const [dirty, setDirty] = useState(false);

  // Read local storage after mount: the server render has none, and reading it
  // during the first render would not match what the server sent. The
  // calculator page announces its own writes with CALCULATOR_EVENT.
  useEffect(() => {
    const sync = () => {
      setSettings(loadCalculatorSettings());
      setHistoryCount(loadCalculatorHistory().length);
    };
    sync();
    window.addEventListener(CALCULATOR_EVENT, sync);
    return () => window.removeEventListener(CALCULATOR_EVENT, sync);
  }, []);

  const updateSetting = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => {
    setDirty(true);
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const persistSettings = () => {
    saveCalculatorSettings(settings);
    setDirty(false);
    toast.success("Calculator settings saved on this device.");
  };

  const resetDefaults = () => {
    setSettings(DEFAULT_CALCULATOR_SETTINGS);
    saveCalculatorSettings(DEFAULT_CALCULATOR_SETTINGS);
    setDirty(false);
    toast.success("Defaults restored.");
  };

  const clearHistory = () => {
    saveCalculatorHistory([]);
    setHistoryCount(0);
    toast.success("Calculator history cleared.");
  };

  return (
    <Page>
      <PageHeader
        title="Calculator settings"
        description="How results are rounded, how the keypad behaves, and how much history is kept. Stored on this device."
        meta={dirty ? "Unsaved changes" : undefined}
        actions={
          <>
            <Button asChild variant="outline" size="lg">
              <Link href="/calculator">
                <ArrowLeft />
                Calculator
              </Link>
            </Button>
            <Button variant="outline" size="lg" onClick={resetDefaults}>
              <RotateCcw />
              Defaults
            </Button>
            <Button size="lg" onClick={persistSettings} disabled={!dirty}>
              <Save />
              Save
            </Button>
          </>
        }
      />
      <PageBody>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            <Panel>
              <PanelTitle icon={<Cpu />}>Results</PanelTitle>
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="calc-precision" className="text-base font-semibold">
                      Decimal places
                    </Label>
                    <Pill tone="primary">{settings.precision} places</Pill>
                  </div>
                  <p className="text-sm text-muted-foreground">How far results are rounded, in both modes.</p>
                  <Slider
                    id="calc-precision"
                    value={[settings.precision]}
                    onValueChange={(value) => updateSetting("precision", value[0])}
                    max={12}
                    step={1}
                    aria-label="Decimal places"
                    className="py-2"
                  />
                </div>

                <Divider />

                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p id="calc-angle-label" className="text-base font-semibold">
                      Angles
                    </p>
                    <p className="text-sm text-muted-foreground">Whether sin, cos and tan work in degrees or radians.</p>
                  </div>
                  <div role="group" aria-labelledby="calc-angle-label" className="flex rounded-xl border border-border/60 bg-muted/40 p-1">
                    {[
                      { label: "Degrees", value: true },
                      { label: "Radians", value: false },
                    ].map((option) => (
                      <button
                        key={option.label}
                        type="button"
                        onClick={() => updateSetting("useDegrees", option.value)}
                        aria-pressed={settings.useDegrees === option.value}
                        className={cn(
                          "rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors",
                          settings.useDegrees === option.value
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Panel>

            <Panel>
              <PanelTitle icon={<Palette />}>Keypad</PanelTitle>
              <div className="space-y-6">
                <ToggleRow
                  id="calc-large-buttons"
                  label="Large buttons"
                  description="Taller keys with a bigger hit area."
                  checked={settings.largeButtons}
                  onCheckedChange={(checked) => updateSetting("largeButtons", checked)}
                />
                <Divider />
                <ToggleRow
                  id="calc-animations"
                  label="Animations"
                  description="Fade new entries into the history list."
                  checked={settings.animationsEnabled}
                  onCheckedChange={(checked) => updateSetting("animationsEnabled", checked)}
                />
                <Divider />
                <ToggleRow
                  id="calc-sound"
                  label="Key sound"
                  description="A short click on every key press."
                  checked={settings.soundEnabled}
                  onCheckedChange={(checked) => updateSetting("soundEnabled", checked)}
                />
                <Divider />
                <ToggleRow
                  id="calc-scientific-default"
                  label="Open in scientific mode"
                  description="Show the scientific keys every time the calculator opens."
                  checked={settings.useScientificByDefault}
                  onCheckedChange={(checked) => updateSetting("useScientificByDefault", checked)}
                />
              </div>
            </Panel>
          </div>

          <div className="lg:col-span-4">
            <Panel>
              <PanelTitle icon={<History />}>History</PanelTitle>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="calc-history-limit" className="text-base font-semibold">
                    Keep up to
                  </Label>
                  <Pill tone="primary">{settings.historyLimit}</Pill>
                </div>
                <Slider
                  id="calc-history-limit"
                  value={[settings.historyLimit]}
                  onValueChange={(value) => updateSetting("historyLimit", value[0])}
                  max={200}
                  min={10}
                  step={5}
                  aria-label="History limit"
                  className="py-2"
                />
                <p className="text-sm text-muted-foreground">{historyCount} saved right now.</p>
              </div>
              <Button
                variant="outline"
                onClick={clearHistory}
                disabled={historyCount === 0}
                className="mt-6 w-full hover:bg-destructive/10 hover:text-destructive"
              >
                Clear history
              </Button>
            </Panel>
          </div>
        </div>
      </PageBody>
    </Page>
  );
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="space-y-1">
        <Label htmlFor={id} className="text-base font-semibold">
          {label}
        </Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function Divider() {
  return <div className="h-px w-full bg-border/60" />;
}
