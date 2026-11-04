"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BrainCircuit, CheckCircle2, Cloud, Laptop, Loader2, Send, XCircle } from "lucide-react";

import {
  getAIConnectivity,
  saveGeminiKey,
  saveOllamaConfig,
  saveOpenAIKey,
  setPrimaryAIProvider,
  testAIConnection,
  type AIConnectionTest,
} from "@/lib/ai-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Pill } from "@/components/ui/list-row";
import {
  ChoiceGroup,
  Field,
  SettingRow,
  SettingsCard,
  SettingsSection,
  reportError,
  selectClass,
  type SettingsData,
} from "./settings-ui";

type Provider = "gemini" | "openai" | "ollama";
type OllamaStatus = "checking" | "reachable" | "unreachable";

const PROVIDER_LABEL: Record<Provider, string> = {
  gemini: "Google Gemini",
  openai: "OpenAI",
  ollama: "Offline (Ollama)",
};

const couldNotSave = "It could not be saved. Check your connection and try again.";

export function AISettings({ data }: { data: SettingsData }) {
  const router = useRouter();
  const progress = data.progress;

  const [provider, setProvider] = useState<Provider>(
    (progress?.primaryAiProvider as Provider) || "gemini"
  );
  const [savingProvider, startSavingProvider] = useTransition();

  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus>("checking");

  const refreshOllama = useCallback(async () => {
    setOllamaStatus("checking");
    try {
      const info = await getAIConnectivity();
      setOllamaModels(info.ollamaModels);
      setOllamaStatus(info.ollamaReachable ? "reachable" : "unreachable");
    } catch (error) {
      reportError("check ollama", error);
      setOllamaStatus("unreachable");
    }
  }, []);

  // First check on mount; status already starts as "checking".
  useEffect(() => {
    let alive = true;
    getAIConnectivity()
      .then((info) => {
        if (!alive) return;
        setOllamaModels(info.ollamaModels);
        setOllamaStatus(info.ollamaReachable ? "reachable" : "unreachable");
      })
      .catch((error) => {
        reportError("check ollama", error);
        if (alive) setOllamaStatus("unreachable");
      });
    return () => {
      alive = false;
    };
  }, []);

  const chooseProvider = (next: Provider) => {
    if (next === provider) return;
    startSavingProvider(async () => {
      try {
        const res = await setPrimaryAIProvider(next);
        if (res.success) {
          setProvider(next);
          toast.success(`${PROVIDER_LABEL[next]} is now your main AI.`);
          router.refresh();
        } else {
          toast.error(`Your main AI could not be changed. ${couldNotSave}`);
        }
      } catch (error) {
        reportError("set primary provider", error);
        toast.error(`Your main AI could not be changed. ${couldNotSave}`);
      }
    });
  };

  const anyKey = data.aiKeys.gemini.configured || data.aiKeys.openai.configured;

  return (
    // data-tour: the guided tour explains here that every AI feature is inert
    // until something in this section is filled in.
    <SettingsSection
      id="ai"
      tour="settings-ai"
      icon={BrainCircuit}
      title="AI"
      description="Which AI answers, your keys, and the offline model. Ask AI, practice marking and the study planner all use these."
    >
      <SettingsCard>
        <SettingRow
          id="main-ai"
          stacked
          label="Main AI"
          description="Answers first. If it fails (no key, out of quota, offline) the app tries the others, then your offline model."
        >
          <ChoiceGroup<Provider>
            label="Main AI"
            value={provider}
            disabled={savingProvider}
            onChange={chooseProvider}
            className="mt-1 sm:grid-cols-3"
            options={[
              { value: "gemini", label: "Google Gemini", description: data.aiKeys.gemini.configured ? "Cloud. Key saved." : "Cloud. Needs a key (free).", icon: <Cloud /> },
              { value: "openai", label: "OpenAI", description: data.aiKeys.openai.configured ? "Cloud. Key saved." : "Cloud. Needs a key (paid).", icon: <Cloud /> },
              { value: "ollama", label: "Offline (Ollama)", description: "Runs on this computer.", icon: <Laptop /> },
            ]}
          />
        </SettingRow>
      </SettingsCard>

      <SettingsCard title="Cloud keys">
        <KeyRow
          id="gemini-key"
          label="Google Gemini key"
          hint={data.aiKeys.gemini}
          description={
            <>
              Free from{" "}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                Google AI Studio
              </a>
              . Recommended model: gemini-flash-latest.
            </>
          }
          placeholder="Paste your Gemini API key"
          save={saveGeminiKey}
        />
        <KeyRow
          id="openai-key"
          label="OpenAI key"
          hint={data.aiKeys.openai}
          description={
            <>
              Paid, from{" "}
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                platform.openai.com
              </a>
              . Recommended model: gpt-4o-mini.
            </>
          }
          placeholder="Paste your OpenAI API key (sk-...)"
          save={saveOpenAIKey}
        />
        <TestRow hasSomething={anyKey || Boolean(progress?.ollamaEnabled)} />
      </SettingsCard>

      <OllamaCard progress={progress} models={ollamaModels} status={ollamaStatus} onDetect={refreshOllama} />
    </SettingsSection>
  );
}

function KeyRow({
  id,
  label,
  hint,
  description,
  placeholder,
  save,
}: {
  id: string;
  label: string;
  hint: { configured: boolean; last4: string | null };
  description: React.ReactNode;
  placeholder: string;
  save: (key: string) => Promise<{ success: boolean; error?: string }>;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [saving, startSaving] = useTransition();
  const inputId = `settings-${id}`;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    startSaving(async () => {
      try {
        const res = await save(value.trim());
        if (res.success) {
          setValue("");
          toast.success(`${label} saved and tested.`);
          router.refresh();
        } else {
          toast.error(res.error || `That key was not accepted. Check it and try again.`);
        }
      } catch (error) {
        reportError(`save ${id}`, error);
        toast.error(`The key could not be saved. Check your connection and try again.`);
      }
    });
  };

  return (
    <SettingRow
      id={id}
      stacked
      label={label}
      htmlFor={inputId}
      aside={hint.configured ? <Pill tone="success">Saved · ends {hint.last4}</Pill> : <Pill tone="warning">Not set</Pill>}
      description={description}
    >
      <form onSubmit={submit} className="mt-1 flex flex-col gap-2 sm:flex-row">
        <Input
          id={inputId}
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={hint.configured ? "Paste a new key to replace the saved one" : placeholder}
          className="h-10 font-mono text-sm"
        />
        <Button type="submit" size="lg" disabled={saving || value.trim() === ""} className="h-10 shrink-0 gap-1.5">
          {saving && <Loader2 className="size-4 animate-spin" />}
          {saving ? "Checking key…" : hint.configured ? "Replace key" : "Save key"}
        </Button>
      </form>
    </SettingRow>
  );
}

/** Sends a real test message through every saved AI and says which answered. */
function TestRow({ hasSomething }: { hasSomething: boolean }) {
  const [result, setResult] = useState<AIConnectionTest | null>(null);
  const [testing, startTesting] = useTransition();

  const run = () =>
    startTesting(async () => {
      try {
        setResult(await testAIConnection());
      } catch (error) {
        reportError("test ai", error);
        toast.error("The test could not run. Check your connection and try again.");
      }
    });

  const lines = result
    ? [
        ...result.cloud.map((c) => ({ key: c.provider, label: c.label, ok: c.ok, text: c.ok ? `Answered with ${c.model}` : c.error })),
        ...(result.ollama.enabled
          ? [{ key: "ollama", label: "Offline (Ollama)", ok: result.ollama.ok, text: result.ollama.ok ? `Answered with ${result.ollama.model}` : result.ollama.error }]
          : []),
      ]
    : [];

  return (
    <SettingRow
      id="test-ai"
      label="Test your AI"
      stacked={result !== null}
      description={hasSomething ? "Sends a short test message to every AI you have set up." : "Save a key first, then test it here."}
    >
      <div className={result ? "mt-1 space-y-3" : undefined}>
        <Button variant="outline" onClick={run} disabled={testing || !hasSomething} className="gap-1.5">
          {testing ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          {testing ? "Sending test…" : result ? "Test again" : "Send test"}
        </Button>
        {result && (
          <ul aria-live="polite" className="space-y-2">
            {lines.length === 0 && <li className="text-sm text-muted-foreground">Nothing to test yet. Save a key first.</li>}
            {lines.map((line) => (
              <li key={line.key} className="flex items-start gap-2.5 rounded-lg border border-border bg-background px-3 py-2.5 text-sm">
                {line.ok ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-label="Working" />
                ) : (
                  <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="Not working" />
                )}
                <span className="min-w-0">
                  <span className="font-medium">{line.label}</span>
                  <span className="block text-muted-foreground">{line.text}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SettingRow>
  );
}

function OllamaCard({
  progress,
  models,
  status,
  onDetect,
}: {
  progress: SettingsData["progress"];
  models: string[];
  status: OllamaStatus;
  onDetect: () => Promise<void>;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(progress?.ollamaEnabled ?? true);
  const [baseUrl, setBaseUrl] = useState(progress?.ollamaBaseUrl || "http://localhost:11434");
  const [model, setModel] = useState(progress?.ollamaModel || "");
  const [visionModel, setVisionModel] = useState(progress?.ollamaVisionModel || "");
  const [saving, startSaving] = useTransition();

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    startSaving(async () => {
      try {
        const res = await saveOllamaConfig({
          enabled,
          baseUrl,
          model: model || null,
          visionModel: visionModel || null,
        });
        if (res.success) {
          toast.success("Offline model settings saved.");
          await onDetect();
          router.refresh();
        } else {
          toast.error(res.error || `The offline settings were not saved. ${couldNotSave}`);
        }
      } catch (error) {
        reportError("save ollama", error);
        toast.error(`The offline settings were not saved. ${couldNotSave}`);
      }
    });
  };

  const statusPill =
    status === "checking" ? (
      <Pill>Checking…</Pill>
    ) : status === "reachable" ? (
      <Pill tone="success">
        Running · {models.length} model{models.length === 1 ? "" : "s"}
      </Pill>
    ) : (
      <Pill tone="warning">Not running</Pill>
    );

  return (
    <SettingsCard title="Offline model (Ollama)" action={statusPill}>
      <form onSubmit={save}>
        <SettingRow
          id="ollama"
          label="Use the offline model"
          htmlFor="settings-ollama-enabled"
          description={
            <>
              Used when there is no internet. Install Ollama from ollama.com, then run{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">ollama pull llama3.1</code>.
            </>
          }
        >
          <Switch id="settings-ollama-enabled" checked={enabled} onCheckedChange={setEnabled} />
        </SettingRow>

        {enabled && (
          <SettingRow stacked label="Connection and models" description="Detect lists the models installed on this computer.">
            <div className="mt-1 space-y-4">
              <Field id="settings-ollama-url" label="Ollama address">
                <div className="flex gap-2">
                  <Input
                    id="settings-ollama-url"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="http://localhost:11434"
                    className="h-10 font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    disabled={status === "checking"}
                    onClick={() => void onDetect()}
                    className="h-10 shrink-0"
                  >
                    {status === "checking" ? "Detecting…" : "Detect"}
                  </Button>
                </div>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <ModelPicker
                  id="settings-ollama-text-model"
                  label="Chat model"
                  value={model}
                  onChange={setModel}
                  models={models}
                  emptyOption="Automatic (first installed)"
                  placeholder="e.g. llama3.1"
                />
                <ModelPicker
                  id="settings-ollama-vision-model"
                  label="Image model (optional)"
                  value={visionModel}
                  onChange={setVisionModel}
                  models={models}
                  emptyOption="None"
                  placeholder="e.g. llama3.2-vision"
                />
              </div>
            </div>
          </SettingRow>
        )}

        <div className="flex justify-end border-t border-border px-6 py-4 max-sm:px-[18px]">
          <Button type="submit" size="lg" disabled={saving}>
            {saving ? "Saving…" : "Save offline settings"}
          </Button>
        </div>
      </form>
    </SettingsCard>
  );
}

/** A dropdown of installed models when Ollama answered, a text box when it did not. */
function ModelPicker({
  id,
  label,
  value,
  onChange,
  models,
  emptyOption,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  models: string[];
  emptyOption: string;
  placeholder: string;
}) {
  return (
    <Field id={id} label={label}>
      {models.length > 0 ? (
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
          <option value="">{emptyOption}</option>
          {value && !models.includes(value) && <option value={value}>{value}</option>}
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      ) : (
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-10 font-mono text-sm"
        />
      )}
    </Field>
  );
}
