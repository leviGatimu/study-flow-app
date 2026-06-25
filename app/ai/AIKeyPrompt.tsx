"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BrainCircuit, KeyRound, Orbit, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveAIKey } from "@/lib/ai-actions";

const PROVIDERS = ["Gemini", "OpenAI", "Anthropic", "Groq"];

export function AIKeyPrompt() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setStatus(null);

    const result = await saveAIKey(key);
    setIsSaving(false);

    if (!result.success) {
      setError(result.error ?? "Unable to validate this API key.");
      return;
    }

    setStatus(`Connected to ${result.provider} using ${result.model}. Refreshing...`);
    // Soft navigation keeps the app shell mounted instead of a full page reload.
    router.push('/');
    router.refresh();
  };

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-background px-6 py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-6rem] top-[-4rem] h-72 w-72 rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute bottom-[-8rem] right-[-4rem] h-80 w-80 rounded-full bg-sky-400/10 blur-3xl dark:bg-sky-500/10" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom_right,transparent,rgba(0,0,0,0.03))] dark:bg-[linear-gradient(to_bottom_right,transparent,rgba(255,255,255,0.03))]" />
      </div>

      <div className="relative z-10 grid w-full max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Intentional marketing/launch panel: stays dark in both light and dark themes for contrast against the activation card. */}
        <section className="rounded-[40px] border border-border/60 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-8 text-white shadow-2xl shadow-slate-900/10 md:p-10">
          <div className="inline-flex rounded-full border border-sky-300/15 bg-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.3em] text-sky-200/80">
            AI Workstation
          </div>

          <div className="mt-8 flex items-center gap-4">
            <div className="rounded-[26px] bg-white/10 p-4 text-sky-200">
              <BrainCircuit className="h-10 w-10" />
            </div>
            <div className="rounded-[26px] bg-white/10 p-4 text-sky-200">
              <Orbit className="h-10 w-10" />
            </div>
          </div>

          <h2 className="mt-8 max-w-xl text-5xl font-heading font-black tracking-tight md:text-6xl">
            Connect one key. Route it to the right model.
          </h2>
          <p className="mt-6 max-w-xl text-lg font-medium leading-relaxed text-slate-300">
            This screen should feel like a launch panel, not a default auth card. Paste a provider key and the app will verify who owns it before turning the assistant on.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            {PROVIDERS.map((provider) => (
              <div
                key={provider}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-slate-200"
              >
                {provider}
              </div>
            ))}
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
              <ShieldCheck className="h-6 w-6 text-sky-200" />
              <p className="mt-4 text-sm font-black uppercase tracking-[0.22em] text-sky-200/80">Verified Routing</p>
              <p className="mt-2 text-sm font-medium leading-relaxed text-slate-300">
                The backend tests the pasted key and only uses the provider that actually accepts it.
              </p>
            </div>
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
              <Sparkles className="h-6 w-6 text-sky-200" />
              <p className="mt-4 text-sm font-black uppercase tracking-[0.22em] text-sky-200/80">Adaptive Model Pick</p>
              <p className="mt-2 text-sm font-medium leading-relaxed text-slate-300">
                Once validated, the assistant chooses a sensible live model for that provider.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[40px] border border-border/60 bg-card/88 p-8 shadow-xl backdrop-blur-xl md:p-10">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Activation</p>
              <h3 className="mt-2 text-3xl font-heading font-black tracking-tight">Bring AI Buddy online</h3>
            </div>
            <div className="rounded-[24px] bg-primary/10 p-4 text-primary">
              <KeyRound className="h-6 w-6" />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="rounded-[28px] border border-border/60 bg-muted/25 p-5">
              <Label className="ml-1 text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">API Key</Label>
              <div className="relative mt-3">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <KeyRound className="h-5 w-5" />
                </div>
                <Input
                  name="key"
                  type="password"
                  value={key}
                  onChange={(event) => setKey(event.target.value)}
                  placeholder="Paste your provider key here..."
                  className="h-14 rounded-2xl border-border/60 bg-background pl-12 font-bold"
                  required
                  disabled={isSaving}
                />
              </div>
            </div>

            {error ? <p className="text-sm font-semibold text-destructive">{error}</p> : null}
            {status ? <p className="text-sm font-semibold text-primary">{status}</p> : null}

            <Button
              type="submit"
              disabled={isSaving || !key.trim()}
              className="h-14 w-full rounded-2xl text-base font-black shadow-lg shadow-primary/20"
            >
              {isSaving ? "Testing Key..." : "Activate AI Buddy"}
            </Button>

            <p className="text-sm font-medium leading-relaxed text-muted-foreground">
              Supported providers are tested automatically. No manual selector, no guesswork.
            </p>

            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
              <p className="text-sm font-semibold text-foreground">No internet? Use a local model.</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Run a model offline with <span className="font-mono">Ollama</span> and enable it under Settings → AI. The assistant turns on automatically once a local model is detected.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/settings')}
                className="mt-3 h-10 w-full rounded-xl text-sm font-bold"
              >
                Set up offline model
              </Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
