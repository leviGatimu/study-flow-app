"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BrainCircuit, Cloud, Key, Laptop } from "lucide-react";

import {
  getAIConnectivity,
  saveGeminiKey,
  saveOllamaConfig,
  saveOpenAIKey,
  setPrimaryAIProvider,
} from "@/lib/ai-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Pill } from "@/components/ui/list-row";
import {
  ChoiceGroup,
  Field,
  SettingRow,
  SettingsPanel,
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

  return (
    <div className="space-y-6">
      <SettingsPanel
        title="Main AI"
        icon={<BrainCircuit />}
        description="Which AI answers first. If it fails (no key, out of quota, offline) the app tries the others, and falls back to your offline model when there is no internet."
      >
        <ChoiceGroup<Provider>
          label="Main AI"
          value={provider}
          disabled={savingProvider}
          onChange={chooseProvider}
          className="sm:grid-cols-3"
          options={[
            { value: "gemini", label: "Google Gemini", description: "Cloud. Needs a Gemini key.", icon: <Cloud /> },
            { value: "openai", label: "OpenAI", description: "Cloud. Needs an OpenAI key.", icon: <Cloud /> },
            { value: "ollama", label: "Offline (Ollama)", description: "Runs on this computer.", icon: <Laptop /> },
          ]}
        />
      </SettingsPanel>

      <SettingsPanel
        title="Cloud keys"
        icon={<Key />}
        description="Keys are stored on the server and never sent back to this page. Leave a field empty to keep the saved key."
      >
        <div className="divide-y divide-border/60">
          <KeyField
            id="settings-gemini-key"
            label="Google Gemini API key"
            hint={data.aiKeys.gemini}
            recommended="gemini-2.0-flash"
            placeholder="Paste your Gemini API key"
            save={saveGeminiKey}
          />
          <KeyField
            id="settings-openai-key"
            label="OpenAI API key"
            hint={data.aiKeys.openai}
            recommended="gpt-4o-mini"
            placeholder="Paste your OpenAI API key (sk-...)"
            save={saveOpenAIKey}
          />
        </div>
      </SettingsPanel>

      <OllamaPanel
        progress={progress}
        models={ollamaModels}
        status={ollamaStatus}
        onDetect={refreshOllama}
      />
    </div>
  );
}

function KeyField({
  id,
  label,
  hint,
  recommended,
  placeholder,
  save,
}: {
  id: string;
  label: string;
  hint: { configured: boolean; last4: string | null };
  recommended: string;
  placeholder: string;
  save: (key: string) => Promise<{ success: boolean; error?: string }>;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [saving, startSaving] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    startSaving(async () => {
      try {
        const res = await save(value.trim());
        if (res.success) {
          setValue("");
          toast.success(`${label} saved.`);
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
    <form onSubmit={submit} className="space-y-2 py-4 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
        {hint.configured ? <Pill tone="success">Saved, ends {hint.last4}</Pill> : <Pill>Not set</Pill>}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id={id}
          type="password"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={hint.configured ? "Paste a new key to replace the saved one" : placeholder}
          className="h-9 font-mono text-sm"
        />
        <Button type="submit" size="lg" disabled={saving || value.trim() === ""} className="shrink-0">
          {saving ? "Checking…" : "Save key"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Recommended model: <span className="font-medium text-foreground">{recommended}</span>
      </p>
    </form>
  );
}

function OllamaPanel({
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
        Running, {models.length} model{models.length === 1 ? "" : "s"}
      </Pill>
    ) : (
      <Pill tone="warning">Not running</Pill>
    );

  return (
    <SettingsPanel
      title="Offline model"
      icon={<Laptop />}
      action={statusPill}
      description={
        <>
          Used when there is no internet. Install Ollama from ollama.com, then pull a model, for
          example <code className="font-mono text-foreground">ollama pull llama3.1</code>.
        </>
      }
    >
      <form onSubmit={save} className="space-y-4">
        <SettingRow
          label="Use the offline model"
          htmlFor="settings-ollama-enabled"
          description="Fall back to Ollama when the cloud is unreachable."
        >
          <Switch id="settings-ollama-enabled" checked={enabled} onCheckedChange={setEnabled} />
        </SettingRow>

        <Field id="settings-ollama-url" label="Ollama address">
          <div className="flex gap-2">
            <Input
              id="settings-ollama-url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="http://localhost:11434"
              className="h-9 font-mono text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={status === "checking"}
              onClick={() => void onDetect()}
              className="shrink-0"
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

        <Button type="submit" size="lg" disabled={saving}>
          {saving ? "Saving…" : "Save offline settings"}
        </Button>
      </form>
    </SettingsPanel>
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
          className="h-9 font-mono text-sm"
        />
      )}
    </Field>
  );
}
