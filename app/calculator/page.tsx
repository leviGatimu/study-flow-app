"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Activity, Delete, Equal, History, MemoryStick, Parentheses, Percent, Settings, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Page, PageBody } from "@/components/ui/page";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { Pill } from "@/components/ui/list-row";
import { Stat } from "@/components/ui/stat";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { CALCULATOR_EVENT, CalculatorHistoryEntry, DEFAULT_CALCULATOR_SETTINGS, appendToken, evaluateExpression, formatNumber, loadCalculatorHistory, loadCalculatorMemory, loadCalculatorSettings, percentOfCurrent, saveCalculatorHistory, saveCalculatorMemory, wrapWithFunction } from "@/lib/calculator";

type SideTab = "history" | "memory";

function CalculatorKey({
  children,
  onClick,
  variant = "num",
  className = "",
  largeButtons = false,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "num" | "op" | "fn" | "eq" | "sci";
  className?: string;
  largeButtons?: boolean;
  /** Spoken name, for keys whose face is a symbol or an icon. */
  label?: string;
}) {
  return (
    <Button
      onClick={onClick}
      variant="ghost"
      aria-label={label}
      className={cn(
        "h-full w-full rounded-xl border border-transparent transition-colors",
        largeButtons ? "min-h-16 text-2xl" : "min-h-12 text-xl md:min-h-14",
        variant === "num" && "bg-muted/60 font-bold text-foreground hover:bg-muted",
        variant === "op" && "bg-primary/10 text-2xl text-primary hover:bg-primary/20",
        variant === "fn" && "bg-muted/30 text-base text-muted-foreground hover:bg-muted",
        variant === "sci" && "bg-muted/30 font-mono text-sm text-muted-foreground hover:bg-muted",
        variant === "eq" && "bg-primary text-2xl text-primary-foreground hover:bg-primary/90",
        className
      )}
    >
      {children}
    </Button>
  );
}

export default function CalculatorPage() {
  const [expression, setExpression] = useState("0");
  const [display, setDisplay] = useState("0");
  const [history, setHistory] = useState<CalculatorHistoryEntry[]>([]);
  const [memory, setMemory] = useState<number | null>(null);
  const [isScientific, setIsScientific] = useState(false);
  const [isSecond, setIsSecond] = useState(false);
  const [sideTab, setSideTab] = useState<SideTab>("history");
  const [useExponential, setUseExponential] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAnswer, setLastAnswer] = useState<number | null>(null);
  const [settings, setSettings] = useState(DEFAULT_CALCULATOR_SETTINGS);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const syncFromStorage = () => {
      const loadedSettings = loadCalculatorSettings();
      setSettings(loadedSettings);
      setHistory(loadCalculatorHistory().slice(0, loadedSettings.historyLimit));
      setMemory(loadCalculatorMemory());
      setIsScientific((current) => current || loadedSettings.useScientificByDefault);
    };

    syncFromStorage();
    window.addEventListener("storage", syncFromStorage);
    window.addEventListener(CALCULATOR_EVENT, syncFromStorage);
    return () => {
      window.removeEventListener("storage", syncFromStorage);
      window.removeEventListener(CALCULATOR_EVENT, syncFromStorage);
    };
  }, []);

  useEffect(() => {
    saveCalculatorHistory(history.slice(0, settings.historyLimit));
  }, [history, settings.historyLimit]);

  useEffect(() => {
    saveCalculatorMemory(memory);
  }, [memory]);

  const playSound = useCallback(() => {
    if (!settings.soundEnabled || typeof window === "undefined") return;

    try {
      const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const context = audioContextRef.current ?? new AudioCtx();
      audioContextRef.current = context;

      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 660;
      gain.gain.value = 0.015;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.04);
    } catch {
      // Ignore audio failures; calculator behavior should remain uninterrupted.
    }
  }, [settings.soundEnabled]);

  const setCalculatedValue = useCallback(
    (value: number, nextExpression?: string) => {
      const formatted = formatNumber(value, settings.precision, useExponential);
      setDisplay(formatted);
      setExpression(nextExpression ?? formatted);
      setLastAnswer(value);
      setError(formatted === "Error" ? "Invalid result" : null);
    },
    [settings.precision, useExponential]
  );

  const previewExpression = useCallback(
    (nextExpression: string) => {
      setExpression(nextExpression);
      try {
        const result = evaluateExpression(nextExpression, settings.useDegrees);
        setDisplay(formatNumber(result, settings.precision, useExponential));
        setError(null);
      } catch {
        setDisplay(nextExpression || "0");
      }
    },
    [settings.precision, settings.useDegrees, useExponential]
  );

  const appendToExpression = useCallback(
    (token: string) => {
      playSound();
      setError(null);
      const base = expression === "Error" ? "0" : expression;
      const next = appendToken(base, token);
      previewExpression(next);
    },
    [expression, playSound, previewExpression]
  );

  const clearAll = useCallback(() => {
    playSound();
    setExpression("0");
    setDisplay("0");
    setError(null);
  }, [playSound]);

  const clearEntry = useCallback(() => {
    playSound();
    setDisplay("0");
    setExpression("0");
    setError(null);
  }, [playSound]);

  const deleteLast = useCallback(() => {
    playSound();
    setError(null);
    const next = expression.length <= 1 ? "0" : expression.slice(0, -1);
    previewExpression(next);
  }, [expression, playSound, previewExpression]);

  const handleEvaluate = useCallback(() => {
    playSound();

    try {
      const result = evaluateExpression(expression, settings.useDegrees);
      const formatted = formatNumber(result, settings.precision, useExponential);
      const entry = {
        expr: expression,
        res: formatted,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setHistory((current) => [entry, ...current].slice(0, settings.historyLimit));
      setCalculatedValue(result, formatted);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Invalid expression");
      setDisplay("Error");
      setExpression("Error");
    }
  }, [
    expression,
    playSound,
    setCalculatedValue,
    settings.historyLimit,
    settings.precision,
    settings.useDegrees,
    useExponential,
  ]);

  const applyFunctionToExpression = useCallback(
    (fn: string) => {
      playSound();
      setError(null);
      const source = expression === "Error" ? "0" : expression;
      const next = wrapWithFunction(source, fn);
      previewExpression(next);
    },
    [expression, playSound, previewExpression]
  );

  const applyUnaryResult = useCallback(
    (fn: (value: number) => number) => {
      playSound();

      try {
        const current = evaluateExpression(expression, settings.useDegrees);
        const next = fn(current);
        setCalculatedValue(next);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Invalid operation");
        setDisplay("Error");
        setExpression("Error");
      }
    },
    [expression, playSound, setCalculatedValue, settings.useDegrees]
  );

  const handlePercent = useCallback(() => {
    playSound();
    setError(null);
    const next = percentOfCurrent(expression === "Error" ? "0" : expression);
    previewExpression(next);
  }, [expression, playSound, previewExpression]);

  const toggleSign = useCallback(() => {
    playSound();

    try {
      const current = evaluateExpression(expression, settings.useDegrees);
      setCalculatedValue(current * -1);
    } catch {
      const next = expression.startsWith("-") ? expression.slice(1) : `-${expression}`;
      previewExpression(next);
    }
  }, [expression, playSound, previewExpression, setCalculatedValue, settings.useDegrees]);

  const handleMemory = useCallback(
    (op: "MC" | "MR" | "M+" | "M-" | "MS") => {
      playSound();

      let currentValue = 0;
      try {
        currentValue = evaluateExpression(expression, settings.useDegrees);
      } catch {
        currentValue = Number(display) || 0;
      }

      switch (op) {
        case "MC":
          setMemory(null);
          return;
        case "MR":
          if (memory !== null) {
            setCalculatedValue(memory);
          }
          return;
        case "M+":
          setMemory((memory ?? 0) + currentValue);
          return;
        case "M-":
          setMemory((memory ?? 0) - currentValue);
          return;
        case "MS":
          setMemory(currentValue);
          return;
      }
    },
    [display, expression, memory, playSound, setCalculatedValue, settings.useDegrees]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      // Leave typing in a field (the header search, a dialog) alone.
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;

      if (/\d/.test(event.key)) {
        event.preventDefault();
        appendToExpression(event.key);
        return;
      }

      const simpleKeys = new Set(["+", "-", "*", "/", "(", ")", "^", "."]);
      if (simpleKeys.has(event.key)) {
        event.preventDefault();
        appendToExpression(event.key);
        return;
      }

      if (event.key === "%") {
        event.preventDefault();
        handlePercent();
        return;
      }

      if (event.key === "Enter" || event.key === "=") {
        event.preventDefault();
        handleEvaluate();
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        deleteLast();
        return;
      }

      if (event.key === "Delete" || event.key === "Escape") {
        event.preventDefault();
        clearAll();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [appendToExpression, clearAll, deleteLast, handleEvaluate, handlePercent]);

  const keySize = settings.largeButtons;

  return (
    <Page>
      <PageHeader
        title="Calculator"
        description="Standard and scientific, with history and memory. Your keyboard works too."
        actions={
          <>
            <Button
              variant={isScientific ? "default" : "outline"}
              size="lg"
              aria-pressed={isScientific}
              onClick={() => setIsScientific((current) => !current)}
            >
              <Activity />
              Scientific
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/calculator/settings">
                <Settings />
                Settings
              </Link>
            </Button>
          </>
        }
      />
      <PageBody>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <Panel padded={false} className="overflow-hidden lg:col-span-8">
            <div className="flex flex-col items-end gap-2 px-6 pb-6 pt-8 md:px-10">
              <div className="h-7 w-full truncate text-right font-mono text-xl text-muted-foreground" aria-label="Expression">
                {expression}
              </div>
              <output
                aria-live="polite"
                className="w-full select-all truncate text-right font-heading text-5xl font-black tracking-tight tabular-nums md:text-7xl"
              >
                {display}
              </output>
              {error ? (
                <p className="text-sm font-bold text-destructive">{error}</p>
              ) : (
                <p className="text-xs font-medium text-muted-foreground">
                  {lastAnswer !== null ? `Ans ${formatNumber(lastAnswer, settings.precision, useExponential)}` : "Ready"}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-y border-border/40 bg-muted/20 px-4 py-2 md:px-6">
              <div className="flex flex-wrap gap-1" role="group" aria-label="Memory">
                {(["MC", "MR", "M+", "M-", "MS"] as const).map((item) => (
                  <Button
                    key={item}
                    variant="ghost"
                    size="sm"
                    onClick={() => handleMemory(item)}
                    className={cn(
                      "font-semibold",
                      item === "MR" && memory !== null ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    {item}
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Pill>{settings.useDegrees ? "Deg" : "Rad"}</Pill>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-pressed={useExponential}
                  aria-label="Toggle scientific notation"
                  title="Toggle scientific notation"
                  onClick={() => setUseExponential((current) => !current)}
                  className={cn("font-semibold", useExponential ? "text-primary" : "text-muted-foreground")}
                >
                  {useExponential ? "F-E" : "Std"}
                </Button>
              </div>
            </div>

            <div className={cn("grid grid-cols-1", isScientific && "md:grid-cols-[1.15fr_1.85fr]")}>
              {isScientific ? (
                <div className="grid grid-cols-6 gap-2 border-b border-border/30 p-4 md:grid-cols-3 md:border-b-0 md:border-r md:p-6">
                  <CalculatorKey largeButtons={keySize} variant="fn" onClick={() => setIsSecond((current) => !current)} label="Second functions" className={cn("font-bold", isSecond ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-primary")}>
                    2nd
                  </CalculatorKey>
                  <CalculatorKey largeButtons={keySize} variant="fn" onClick={() => appendToExpression("(")} label="Open bracket">
                    (
                  </CalculatorKey>
                  <CalculatorKey largeButtons={keySize} variant="fn" onClick={() => appendToExpression(")")} label="Close bracket">
                    )
                  </CalculatorKey>
                  <CalculatorKey largeButtons={keySize} variant="sci" onClick={() => applyFunctionToExpression(isSecond ? "asin" : "sin")}>
                    {isSecond ? "asin" : "sin"}
                  </CalculatorKey>
                  <CalculatorKey largeButtons={keySize} variant="sci" onClick={() => applyFunctionToExpression(isSecond ? "acos" : "cos")}>
                    {isSecond ? "acos" : "cos"}
                  </CalculatorKey>
                  <CalculatorKey largeButtons={keySize} variant="sci" onClick={() => applyFunctionToExpression(isSecond ? "atan" : "tan")}>
                    {isSecond ? "atan" : "tan"}
                  </CalculatorKey>
                  <CalculatorKey largeButtons={keySize} variant="sci" onClick={() => applyFunctionToExpression("ln")}>
                    ln
                  </CalculatorKey>
                  <CalculatorKey largeButtons={keySize} variant="sci" onClick={() => applyFunctionToExpression("log")}>
                    log
                  </CalculatorKey>
                  <CalculatorKey largeButtons={keySize} variant="sci" onClick={() => applyFunctionToExpression("sqrt")} label="Square root">
                    sqrt
                  </CalculatorKey>
                  <CalculatorKey largeButtons={keySize} variant="sci" onClick={() => applyUnaryResult((value) => value ** 2)} label="Square">
                    x²
                  </CalculatorKey>
                  <CalculatorKey largeButtons={keySize} variant="sci" onClick={() => appendToExpression("^")} label="Power">
                    xʸ
                  </CalculatorKey>
                  <CalculatorKey largeButtons={keySize} variant="sci" onClick={() => applyUnaryResult((value) => 1 / value)} label="Reciprocal">
                    1/x
                  </CalculatorKey>
                  <CalculatorKey largeButtons={keySize} variant="sci" onClick={() => applyFunctionToExpression("exp")}>
                    exp
                  </CalculatorKey>
                  <CalculatorKey largeButtons={keySize} variant="sci" onClick={() => appendToExpression("π")} label="Pi">
                    π
                  </CalculatorKey>
                  <CalculatorKey largeButtons={keySize} variant="sci" onClick={() => appendToExpression("e")}>
                    e
                  </CalculatorKey>
                  <CalculatorKey largeButtons={keySize} variant="fn" onClick={() => appendToExpression(lastAnswer !== null ? String(lastAnswer) : "0")} label="Last answer">
                    Ans
                  </CalculatorKey>
                  <CalculatorKey largeButtons={keySize} variant="fn" onClick={handlePercent} label="Percent">
                    <Percent className="size-4" />
                  </CalculatorKey>
                  <CalculatorKey largeButtons={keySize} variant="fn" onClick={() => applyUnaryResult((value) => Math.abs(value))} label="Absolute value">
                    |x|
                  </CalculatorKey>
                </div>
              ) : null}

              <div className="grid grid-cols-4 gap-2 p-4 md:p-6">
                <CalculatorKey largeButtons={keySize} variant="fn" onClick={clearAll} label="Clear all" className="font-bold text-destructive">
                  C
                </CalculatorKey>
                <CalculatorKey largeButtons={keySize} variant="fn" onClick={clearEntry} label="Clear entry">
                  CE
                </CalculatorKey>
                <CalculatorKey largeButtons={keySize} variant="fn" onClick={() => appendToExpression("(")} label="Open bracket">
                  <Parentheses className="size-5" />
                </CalculatorKey>
                <CalculatorKey largeButtons={keySize} variant="fn" onClick={deleteLast} label="Delete last" className="text-primary">
                  <Delete className="size-6" />
                </CalculatorKey>

                <CalculatorKey largeButtons={keySize} onClick={() => appendToExpression("7")}>7</CalculatorKey>
                <CalculatorKey largeButtons={keySize} onClick={() => appendToExpression("8")}>8</CalculatorKey>
                <CalculatorKey largeButtons={keySize} onClick={() => appendToExpression("9")}>9</CalculatorKey>
                <CalculatorKey largeButtons={keySize} variant="op" onClick={() => appendToExpression("/")} label="Divide">
                  ÷
                </CalculatorKey>

                <CalculatorKey largeButtons={keySize} onClick={() => appendToExpression("4")}>4</CalculatorKey>
                <CalculatorKey largeButtons={keySize} onClick={() => appendToExpression("5")}>5</CalculatorKey>
                <CalculatorKey largeButtons={keySize} onClick={() => appendToExpression("6")}>6</CalculatorKey>
                <CalculatorKey largeButtons={keySize} variant="op" onClick={() => appendToExpression("*")} label="Multiply">
                  ×
                </CalculatorKey>

                <CalculatorKey largeButtons={keySize} onClick={() => appendToExpression("1")}>1</CalculatorKey>
                <CalculatorKey largeButtons={keySize} onClick={() => appendToExpression("2")}>2</CalculatorKey>
                <CalculatorKey largeButtons={keySize} onClick={() => appendToExpression("3")}>3</CalculatorKey>
                <CalculatorKey largeButtons={keySize} variant="op" onClick={() => appendToExpression("-")} label="Subtract">
                  -
                </CalculatorKey>

                <CalculatorKey largeButtons={keySize} onClick={toggleSign} label="Change sign">+/-</CalculatorKey>
                <CalculatorKey largeButtons={keySize} onClick={() => appendToExpression("0")}>0</CalculatorKey>
                <CalculatorKey largeButtons={keySize} onClick={() => appendToExpression(".")} label="Decimal point">.</CalculatorKey>
                <CalculatorKey largeButtons={keySize} variant="op" onClick={() => appendToExpression("+")} label="Add">
                  +
                </CalculatorKey>

                <CalculatorKey largeButtons={keySize} variant="fn" onClick={handlePercent} label="Percent">
                  %
                </CalculatorKey>
                <CalculatorKey largeButtons={keySize} variant="fn" onClick={() => appendToExpression("^")} label="Power">
                  xʸ
                </CalculatorKey>
                <CalculatorKey largeButtons={keySize} variant="fn" onClick={() => appendToExpression(")")} label="Close bracket">
                  )
                </CalculatorKey>
                <CalculatorKey largeButtons={keySize} variant="eq" onClick={handleEvaluate} label="Equals">
                  <Equal className="size-7" />
                </CalculatorKey>
              </div>
            </div>
          </Panel>

          <Panel className="lg:col-span-4">
            <Tabs value={sideTab} onValueChange={(value) => setSideTab(value as SideTab)}>
              <div className="flex items-center justify-between gap-3">
                <TabsList>
                  <TabsTrigger value="history">
                    <History />
                    History
                  </TabsTrigger>
                  <TabsTrigger value="memory">
                    <MemoryStick />
                    Memory
                  </TabsTrigger>
                </TabsList>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => (sideTab === "history" ? setHistory([]) : setMemory(null))}
                  disabled={sideTab === "history" ? history.length === 0 : memory === null}
                  aria-label={sideTab === "history" ? "Clear history" : "Clear memory"}
                  title={sideTab === "history" ? "Clear history" : "Clear memory"}
                  className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 />
                </Button>
              </div>

              <TabsContent value="history" className="mt-4">
                {history.length === 0 ? (
                  <EmptyState
                    icon={<History />}
                    title="No calculations yet"
                    description="Press = and the result is kept here. Pick one to bring it back."
                  />
                ) : (
                  <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
                    {history.map((item, index) => (
                      <li key={`${item.timestamp}-${index}`}>
                        <button
                          type="button"
                          className={cn(
                            "group flex w-full flex-col items-end gap-1 rounded-2xl border border-border/40 bg-muted/40 px-4 py-3 text-right transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                            settings.animationsEnabled && "animate-in fade-in duration-300"
                          )}
                          onClick={() => {
                            setExpression(item.expr);
                            setDisplay(item.res);
                            setError(null);
                          }}
                        >
                          <span className="flex w-full items-center justify-between gap-3 text-xs font-medium text-muted-foreground">
                            <span>{item.timestamp}</span>
                            <span className="truncate font-mono">{item.expr} =</span>
                          </span>
                          <span className="w-full truncate font-heading text-2xl font-black tracking-tight tabular-nums transition-colors group-hover:text-primary">
                            {item.res}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="memory" className="mt-4 space-y-4">
                <div className="rounded-2xl border border-border/40 bg-muted/40 px-5 py-4">
                  <Stat
                    label="Stored value"
                    value={memory !== null ? formatNumber(memory, settings.precision, useExponential) : "–"}
                    tone={memory !== null ? "primary" : "default"}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(["MC", "MR", "M+", "M-", "MS"] as const).map((item) => (
                    <Button key={item} variant="outline" onClick={() => handleMemory(item)} className="font-bold">
                      {item}
                    </Button>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  Memory is kept between visits. MS stores the current result, MR brings it back, and M+ and M−
                  add to or take from it.
                </p>
              </TabsContent>
            </Tabs>
          </Panel>
        </div>
      </PageBody>
    </Page>
  );
}
