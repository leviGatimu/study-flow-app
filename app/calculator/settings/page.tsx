"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Cpu,
  History,
  Info,
  Palette,
  RotateCcw,
  Save,
  Settings,
  Sparkles,
  Volume2,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  DEFAULT_CALCULATOR_SETTINGS,
  loadCalculatorHistory,
  loadCalculatorSettings,
  saveCalculatorHistory,
  saveCalculatorSettings,
} from "@/lib/calculator";

export default function CalculatorSettingsPage() {
  const [settings, setSettings] = useState(() => loadCalculatorSettings());
  const [savedMessage, setSavedMessage] = useState("");

  const updateSetting = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => {
    setSavedMessage("");
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const persistSettings = () => {
    saveCalculatorSettings(settings);
    setSavedMessage("Preferences saved locally.");
  };

  const resetDefaults = () => {
    setSettings(DEFAULT_CALCULATOR_SETTINGS);
    saveCalculatorSettings(DEFAULT_CALCULATOR_SETTINGS);
    setSavedMessage("Defaults restored.");
  };

  const purgeHistory = () => {
    saveCalculatorHistory([]);
    setSavedMessage("Calculator history cleared.");
  };

  const historyCount = loadCalculatorHistory().length;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background animate-in fade-in duration-700">
      <header className="h-24 border-b border-border/60 bg-card/40 backdrop-blur-xl flex items-center justify-between px-12">
        <div className="flex items-center gap-8">
          <Link href="/calculator">
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-primary/10">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary shadow-inner">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-heading font-black tracking-tight">Calculator Preferences</h1>
              <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60">Engine & UI Configuration</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {savedMessage ? <span className="text-sm font-bold text-primary">{savedMessage}</span> : null}
          <Button variant="outline" onClick={resetDefaults} className="h-12 rounded-2xl px-8 border-2 font-bold">
            <RotateCcw className="w-4 h-4 mr-2" />
            Defaults
          </Button>
          <Button onClick={persistSettings} className="h-12 rounded-2xl px-8 font-black shadow-lg shadow-primary/20">
            <Save className="w-4 h-4 mr-2" />
            Save Preferences
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto custom-scrollbar p-12">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-8 space-y-12">
            <section className="space-y-6">
              <div className="flex items-center gap-3 px-2">
                <Cpu className="w-5 h-5 text-primary" />
                <h2 className="text-sm font-black uppercase tracking-[0.3em] text-muted-foreground">Computational Core</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="rounded-[32px] border-2 border-border/40 bg-card/40 backdrop-blur-sm p-8 space-y-8">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label className="text-base font-bold">Decimal Precision</Label>
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-black text-primary">{settings.precision} Places</span>
                    </div>
                    <p className="text-xs font-medium text-muted-foreground">Controls result rounding for standard and scientific output.</p>
                  </div>
                  <Slider value={[settings.precision]} onValueChange={(value) => updateSetting("precision", value[0])} max={12} step={1} className="py-2" />
                </Card>

                <Card className="rounded-[32px] border-2 border-border/40 bg-card/40 backdrop-blur-sm p-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-base font-bold">Angular Unit</Label>
                      <p className="text-xs font-medium text-muted-foreground">Trigonometric calculations can use degrees or radians.</p>
                    </div>
                    <div className="flex p-1 rounded-xl border border-border/60 bg-muted/40">
                      <button
                        onClick={() => updateSetting("useDegrees", true)}
                        className={cn("px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all", settings.useDegrees ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground")}
                      >
                        Deg
                      </button>
                      <button
                        onClick={() => updateSetting("useDegrees", false)}
                        className={cn("px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all", !settings.useDegrees ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground")}
                      >
                        Rad
                      </button>
                    </div>
                  </div>
                </Card>
              </div>
            </section>

            <section className="space-y-6">
              <div className="flex items-center gap-3 px-2">
                <Palette className="w-5 h-5 text-primary" />
                <h2 className="text-sm font-black uppercase tracking-[0.3em] text-muted-foreground">User Interface</h2>
              </div>

              <Card className="rounded-[40px] border-2 border-border/40 bg-card/20 p-10 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8">
                  <div className={cn("w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary", settings.largeButtons ? "scale-125" : "scale-100")}>
                    <Zap className="w-6 h-6" />
                  </div>
                </div>

                <div className="space-y-8">
                  <ToggleRow
                    label="Large Button Layout"
                    description="Increase key height and hit area for a denser desktop/numpad workflow."
                    checked={settings.largeButtons}
                    onCheckedChange={(checked) => updateSetting("largeButtons", checked)}
                  />
                  <Divider />
                  <ToggleRow
                    label="Motion Engine"
                    description="Enable animated panel reveals and calculation history transitions."
                    checked={settings.animationsEnabled}
                    onCheckedChange={(checked) => updateSetting("animationsEnabled", checked)}
                  />
                  <Divider />
                  <ToggleRow
                    label="Acoustic Feedback"
                    description="Play a short synthetic click on keypress."
                    checked={settings.soundEnabled}
                    onCheckedChange={(checked) => updateSetting("soundEnabled", checked)}
                    icon={<Volume2 className="w-4 h-4 text-primary" />}
                  />
                  <Divider />
                  <ToggleRow
                    label="Scientific Mode by Default"
                    description="Open the calculator with the scientific panel already expanded."
                    checked={settings.useScientificByDefault}
                    onCheckedChange={(checked) => updateSetting("useScientificByDefault", checked)}
                    icon={<Sparkles className="w-4 h-4 text-primary" />}
                  />
                </div>
              </Card>
            </section>
          </div>

          <div className="lg:col-span-4 space-y-12">
            <section className="space-y-6">
              <div className="flex items-center gap-3 px-2">
                <History className="w-5 h-5 text-primary" />
                <h2 className="text-sm font-black uppercase tracking-[0.3em] text-muted-foreground">Log Management</h2>
              </div>

              <Card className="rounded-[40px] border-2 border-primary/20 bg-foreground text-background p-10 space-y-8 overflow-hidden relative group">
                <div className="absolute inset-0 bg-primary opacity-0 group-hover:opacity-10 transition-opacity" />
                <div className="relative space-y-6">
                  <div className="space-y-2">
                    <Label className="text-lg font-black text-white">History Buffer</Label>
                    <p className="text-xs font-medium leading-relaxed text-white/40">
                      Controls how many completed calculations are kept in local history.
                    </p>
                  </div>

                  <div className="pt-4 space-y-6">
                    <div className="flex justify-between text-xs font-black uppercase tracking-widest opacity-60">
                      <span>Stored States</span>
                      <span>{settings.historyLimit} Max</span>
                    </div>
                    <Slider value={[settings.historyLimit]} onValueChange={(value) => updateSetting("historyLimit", value[0])} max={200} min={10} step={5} className="py-2" />
                    <div className="text-sm font-semibold text-white/70">{historyCount} currently saved</div>
                  </div>

                  <Button variant="ghost" onClick={purgeHistory} className="w-full h-12 rounded-2xl border border-white/10 bg-white/5 text-white font-bold hover:bg-white/10">
                    Purge History Cache
                  </Button>
                </div>
              </Card>
            </section>

            <Card className="rounded-[32px] border-2 border-border/60 bg-muted/20 p-8 space-y-4">
              <div className="flex items-center gap-3 text-primary">
                <Info className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Metadata</span>
              </div>
              <p className="text-xs font-medium leading-relaxed text-muted-foreground/60">
                Preferences are stored locally in your browser. The calculator engine supports chained expressions, parentheses, exponentiation, inverse trig functions, and persistent memory/history.
              </p>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
  icon,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {icon}
          <Label className="text-lg font-black">{label}</Label>
        </div>
        <p className="max-w-md text-sm font-medium text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function Divider() {
  return <div className="h-px w-full bg-border/60" />;
}
