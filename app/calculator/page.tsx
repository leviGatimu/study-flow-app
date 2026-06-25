"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Calculator as CalcIcon,
  ChevronLeft,
  ChevronRight,
  Delete,
  Equal,
  History,
  MemoryStick,
  Menu,
  Parentheses,
  Percent,
  Settings,
  Sigma,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CALCULATOR_EVENT, CalculatorHistoryEntry, DEFAULT_CALCULATOR_SETTINGS, appendToken, evaluateExpression, formatNumber, loadCalculatorHistory, loadCalculatorMemory, loadCalculatorSettings, percentOfCurrent, saveCalculatorHistory, saveCalculatorMemory, wrapWithFunction } from "@/lib/calculator";

type SideTab = "history" | "memory";

function CalculatorKey({
  children,
  onClick,
  variant = "num",
  className = "",
  largeButtons = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "num" | "op" | "fn" | "eq" | "sci";
  className?: string;
  largeButtons?: boolean;
}) {
  return (
    <Button
      onClick={onClick}
      variant="ghost"
      className={cn(
        "h-full w-full rounded-lg border border-transparent shadow-sm transition-all duration-100 active:scale-95",
        largeButtons ? "min-h-18 text-2xl" : "min-h-14 text-xl",
        variant === "num" && "bg-card/40 font-bold text-foreground hover:bg-secondary/80 border-border/10",
        variant === "op" && "bg-secondary/20 text-2xl font-light text-primary hover:bg-primary/20",
        variant === "fn" && "bg-muted/10 text-base text-muted-foreground hover:bg-muted/30",
        variant === "sci" && "bg-muted/5 text-sm font-mono text-muted-foreground hover:bg-primary/5",
        variant === "eq" && "bg-primary text-2xl text-primary-foreground shadow-xl shadow-primary/20 hover:bg-primary/90",
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
  const [isExpandedSidebar, setIsExpandedSidebar] = useState(false);
  const [sideTab, setSideTab] = useState<SideTab>("history");
  const [useExponential, setUseExponential] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAnswer, setLastAnswer] = useState<number | null>(null);
  const [settings, setSettings] = useState(DEFAULT_CALCULATOR_SETTINGS);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Expand the history/memory sidebar by default on wide screens, but keep it
  // collapsed on small screens so the calculator never overflows horizontally.
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      setIsExpandedSidebar(true);
    }
  }, []);

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

  return (
    <div className="flex h-[calc(100vh-2rem)] w-full overflow-hidden bg-background animate-in fade-in duration-700">
      <div className="w-16 border-r border-border/60 bg-muted/5 flex flex-col items-center gap-8 py-8">
        <div className="rounded-xl bg-primary/10 p-3 text-primary">
          <CalcIcon className="h-6 w-6" />
        </div>
        <div className="flex flex-col gap-4">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle history & memory panel"
            title="Toggle history & memory panel"
            onClick={() => setIsExpandedSidebar((current) => !current)}
            className="rounded-xl hover:bg-primary/10 hover:text-primary"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle scientific mode"
            title="Toggle scientific mode"
            onClick={() => setIsScientific((current) => !current)}
            className={cn(
              "rounded-xl transition-colors",
              isScientific ? "bg-primary/10 text-primary" : "hover:bg-primary/10 hover:text-primary"
            )}
          >
            <Activity className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle fixed-point / engineering notation"
            title="Toggle fixed-point / engineering notation"
            onClick={() => setUseExponential((current) => !current)}
            className={cn(
              "rounded-xl text-[11px] font-black",
              useExponential ? "bg-primary/10 text-primary" : "hover:bg-primary/10 hover:text-primary"
            )}
          >
            FE
          </Button>
        </div>
        <div className="mt-auto">
          <Link href="/calculator/settings">
            <Button variant="ghost" size="icon" aria-label="Calculator settings" title="Calculator settings" className="rounded-xl hover:bg-primary/10 hover:text-primary">
              <Settings className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex-1 flex min-w-0 flex-col relative">
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />

        <div className="flex-[0.42] flex flex-col justify-end px-6 md:px-12 py-8 md:py-12 relative">
          <div className="absolute top-8 md:top-12 left-6 md:left-12 flex items-center gap-4 text-xs font-black uppercase tracking-[0.3em] text-muted-foreground/30">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            {settings.useDegrees ? "Degree" : "Radian"} Precision Core
          </div>

          <div className="flex flex-col items-end gap-4 overflow-hidden">
            <div className="h-8 w-full truncate text-right font-mono text-2xl tracking-tight text-muted-foreground/40">
              {expression}
            </div>
            <div className="w-full select-all truncate text-right font-heading text-6xl md:text-8xl font-black tracking-tighter xl:text-9xl">
              {display}
            </div>
            {error ? (
              <div className="text-sm font-bold text-destructive">{error}</div>
            ) : (
              <div className="text-xs font-bold uppercase tracking-[0.25em] text-muted-foreground/40">
                {lastAnswer !== null ? `Ans ${formatNumber(lastAnswer, settings.precision, useExponential)}` : "Ready"}
              </div>
            )}
          </div>
        </div>

        <div className="px-12 py-4 border-y border-border/40 bg-muted/5 flex items-center justify-between">
          <div className="flex gap-2">
            {(["MC", "MR", "M+", "M-", "MS"] as const).map((item) => (
              <Button
                key={item}
                variant="ghost"
                onClick={() => handleMemory(item)}
                className={cn(
                  "h-9 rounded-lg px-4 text-xs font-black tracking-widest transition-all hover:text-primary hover:bg-primary/5",
                  item === "MR" && memory !== null ? "text-primary" : "text-muted-foreground/60"
                )}
              >
                {item}
              </Button>
            ))}
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-2 rounded-full border border-border/40 bg-muted/20 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
              {settings.useDegrees ? "Deg" : "Rad"}
            </div>
            <div className="flex items-center gap-2 rounded-full border border-border/40 bg-muted/20 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
              {useExponential ? "F-E" : "Std"}
            </div>
          </div>
        </div>

        <div className={cn("flex-1 bg-gradient-to-b from-transparent to-muted/5", isScientific ? "grid grid-cols-[1.15fr_1.85fr]" : "grid grid-cols-1")}>
          {isScientific ? (
            <div className="border-r border-border/30 p-6 grid grid-cols-3 gap-2">
              <CalculatorKey largeButtons={settings.largeButtons} variant="fn" onClick={() => setIsSecond((current) => !current)} className={cn("font-bold", isSecond ? "bg-primary text-primary-foreground" : "text-primary")}>
                2nd
              </CalculatorKey>
              <CalculatorKey largeButtons={settings.largeButtons} variant="fn" onClick={() => appendToExpression("(")}>
                (
              </CalculatorKey>
              <CalculatorKey largeButtons={settings.largeButtons} variant="fn" onClick={() => appendToExpression(")")}>
                )
              </CalculatorKey>
              <CalculatorKey largeButtons={settings.largeButtons} variant="sci" onClick={() => applyFunctionToExpression(isSecond ? "asin" : "sin")}>
                {isSecond ? "asin" : "sin"}
              </CalculatorKey>
              <CalculatorKey largeButtons={settings.largeButtons} variant="sci" onClick={() => applyFunctionToExpression(isSecond ? "acos" : "cos")}>
                {isSecond ? "acos" : "cos"}
              </CalculatorKey>
              <CalculatorKey largeButtons={settings.largeButtons} variant="sci" onClick={() => applyFunctionToExpression(isSecond ? "atan" : "tan")}>
                {isSecond ? "atan" : "tan"}
              </CalculatorKey>
              <CalculatorKey largeButtons={settings.largeButtons} variant="sci" onClick={() => applyFunctionToExpression("ln")}>
                ln
              </CalculatorKey>
              <CalculatorKey largeButtons={settings.largeButtons} variant="sci" onClick={() => applyFunctionToExpression("log")}>
                log
              </CalculatorKey>
              <CalculatorKey largeButtons={settings.largeButtons} variant="sci" onClick={() => applyFunctionToExpression("sqrt")}>
                sqrt
              </CalculatorKey>
              <CalculatorKey largeButtons={settings.largeButtons} variant="sci" onClick={() => applyUnaryResult((value) => value ** 2)}>
                x²
              </CalculatorKey>
              <CalculatorKey largeButtons={settings.largeButtons} variant="sci" onClick={() => appendToExpression("^")}>
                xʸ
              </CalculatorKey>
              <CalculatorKey largeButtons={settings.largeButtons} variant="sci" onClick={() => applyUnaryResult((value) => 1 / value)}>
                1/x
              </CalculatorKey>
              <CalculatorKey largeButtons={settings.largeButtons} variant="sci" onClick={() => applyFunctionToExpression("exp")}>
                exp
              </CalculatorKey>
              <CalculatorKey largeButtons={settings.largeButtons} variant="sci" onClick={() => appendToExpression("π")}>
                π
              </CalculatorKey>
              <CalculatorKey largeButtons={settings.largeButtons} variant="sci" onClick={() => appendToExpression("e")}>
                e
              </CalculatorKey>
              <CalculatorKey largeButtons={settings.largeButtons} variant="fn" onClick={() => appendToExpression(lastAnswer !== null ? String(lastAnswer) : "0")}>
                Ans
              </CalculatorKey>
              <CalculatorKey largeButtons={settings.largeButtons} variant="fn" onClick={handlePercent}>
                <Percent className="h-4 w-4" />
              </CalculatorKey>
              <CalculatorKey largeButtons={settings.largeButtons} variant="fn" onClick={() => applyUnaryResult((value) => Math.abs(value))}>
                |x|
              </CalculatorKey>
            </div>
          ) : null}

          <div className="p-6 grid grid-cols-4 gap-2">
            <CalculatorKey largeButtons={settings.largeButtons} variant="fn" onClick={clearAll} className="text-destructive font-black">
              C
            </CalculatorKey>
            <CalculatorKey largeButtons={settings.largeButtons} variant="fn" onClick={clearEntry}>
              CE
            </CalculatorKey>
            <CalculatorKey largeButtons={settings.largeButtons} variant="fn" onClick={() => appendToExpression("(")}>
              <Parentheses className="h-5 w-5" />
            </CalculatorKey>
            <CalculatorKey largeButtons={settings.largeButtons} variant="fn" onClick={deleteLast} className="text-primary">
              <Delete className="h-6 w-6" />
            </CalculatorKey>

            <CalculatorKey largeButtons={settings.largeButtons} onClick={() => appendToExpression("7")}>7</CalculatorKey>
            <CalculatorKey largeButtons={settings.largeButtons} onClick={() => appendToExpression("8")}>8</CalculatorKey>
            <CalculatorKey largeButtons={settings.largeButtons} onClick={() => appendToExpression("9")}>9</CalculatorKey>
            <CalculatorKey largeButtons={settings.largeButtons} variant="op" onClick={() => appendToExpression("/")}>
              ÷
            </CalculatorKey>

            <CalculatorKey largeButtons={settings.largeButtons} onClick={() => appendToExpression("4")}>4</CalculatorKey>
            <CalculatorKey largeButtons={settings.largeButtons} onClick={() => appendToExpression("5")}>5</CalculatorKey>
            <CalculatorKey largeButtons={settings.largeButtons} onClick={() => appendToExpression("6")}>6</CalculatorKey>
            <CalculatorKey largeButtons={settings.largeButtons} variant="op" onClick={() => appendToExpression("*")}>
              ×
            </CalculatorKey>

            <CalculatorKey largeButtons={settings.largeButtons} onClick={() => appendToExpression("1")}>1</CalculatorKey>
            <CalculatorKey largeButtons={settings.largeButtons} onClick={() => appendToExpression("2")}>2</CalculatorKey>
            <CalculatorKey largeButtons={settings.largeButtons} onClick={() => appendToExpression("3")}>3</CalculatorKey>
            <CalculatorKey largeButtons={settings.largeButtons} variant="op" onClick={() => appendToExpression("-")}>
              -
            </CalculatorKey>

            <CalculatorKey largeButtons={settings.largeButtons} onClick={toggleSign}>+/-</CalculatorKey>
            <CalculatorKey largeButtons={settings.largeButtons} onClick={() => appendToExpression("0")}>0</CalculatorKey>
            <CalculatorKey largeButtons={settings.largeButtons} onClick={() => appendToExpression(".")}>.</CalculatorKey>
            <CalculatorKey largeButtons={settings.largeButtons} variant="op" onClick={() => appendToExpression("+")}>
              +
            </CalculatorKey>

            <CalculatorKey largeButtons={settings.largeButtons} variant="fn" onClick={handlePercent}>
              %
            </CalculatorKey>
            <CalculatorKey largeButtons={settings.largeButtons} variant="fn" onClick={() => appendToExpression("^")}>
              xʸ
            </CalculatorKey>
            <CalculatorKey largeButtons={settings.largeButtons} variant="fn" onClick={() => appendToExpression(")")}>
              )
            </CalculatorKey>
            <CalculatorKey largeButtons={settings.largeButtons} variant="eq" onClick={handleEvaluate}>
              <Equal className="h-8 w-8" />
            </CalculatorKey>
          </div>
        </div>
      </div>

      <div className={cn("border-l border-border/60 bg-card/50 backdrop-blur-xl flex flex-col transition-all shrink-0", isExpandedSidebar ? "w-[75vw] max-w-[450px] sm:w-[450px]" : "w-16 sm:w-20")}>
        <div className="h-20 px-6 border-b border-border/40 flex items-center justify-between">
          {isExpandedSidebar ? (
            <div className="flex gap-8">
              <button
                className={cn(
                  "pb-2 text-xs font-black uppercase tracking-[0.3em] transition-colors",
                  sideTab === "history" ? "border-b-2 border-primary text-primary" : "text-muted-foreground/40 hover:text-muted-foreground"
                )}
                onClick={() => setSideTab("history")}
              >
                History
              </button>
              <button
                className={cn(
                  "pb-2 text-xs font-black uppercase tracking-[0.3em] transition-colors",
                  sideTab === "memory" ? "border-b-2 border-primary text-primary" : "text-muted-foreground/40 hover:text-muted-foreground"
                )}
                onClick={() => setSideTab("memory")}
              >
                Memory
              </button>
            </div>
          ) : (
            <div className="w-full flex justify-center text-primary">
              {sideTab === "history" ? <History className="h-5 w-5" /> : <MemoryStick className="h-5 w-5" />}
            </div>
          )}
          <div className="flex items-center gap-2">
            {isExpandedSidebar && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => (sideTab === "history" ? setHistory([]) : setMemory(null))}
                className="h-10 w-10 rounded-2xl hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => setIsExpandedSidebar((current) => !current)} className="rounded-2xl hover:bg-primary/10 hover:text-primary">
              {isExpandedSidebar ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {isExpandedSidebar ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar p-10">
            {sideTab === "history" ? (
              history.length === 0 ? (
                <div className="py-32 text-center flex flex-col items-center justify-center space-y-6">
                  <div className="w-20 h-20 rounded-[32px] bg-muted/20 border-2 border-dashed border-border/40 flex items-center justify-center">
                    <History className="w-8 h-8 text-muted-foreground/20" />
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-black uppercase tracking-widest text-muted-foreground/40">Logs Empty</p>
                    <p className="text-xs font-medium text-muted-foreground/30">Your calculations will appear here for rapid recall.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-10">
                  {history.map((item, index) => (
                    <div
                      key={`${item.timestamp}-${index}`}
                      className={cn(
                        "group relative cursor-pointer rounded-[28px] p-6 border border-transparent hover:border-border/40 hover:bg-muted/30 transition-all flex flex-col items-end gap-3",
                        settings.animationsEnabled && "animate-in slide-in-from-bottom-4 duration-500"
                      )}
                      onClick={() => {
                        setExpression(item.expr);
                        setDisplay(item.res);
                        setError(null);
                      }}
                      style={settings.animationsEnabled ? { animationDelay: `${index * 35}ms` } : undefined}
                    >
                      <div className="absolute top-6 left-6 text-[10px] font-mono font-black text-muted-foreground/20 transition-colors group-hover:text-primary/40">
                        {item.timestamp}
                      </div>
                      <p className="max-w-full truncate text-right font-mono text-lg text-muted-foreground/40 transition-colors group-hover:text-muted-foreground">
                        {item.expr} =
                      </p>
                      <p className="w-full truncate text-right font-heading text-4xl font-black tracking-tighter transition-colors group-hover:text-primary">
                        {item.res}
                      </p>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="space-y-8">
                <div className="rounded-[28px] border border-border/60 bg-background p-8">
                  <div className="mb-3 text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/40">Stored Register</div>
                  <div className="text-5xl font-heading font-black tracking-tighter text-primary">
                    {memory !== null ? formatNumber(memory, settings.precision, useExponential) : "--"}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {(["MC", "MR", "M+", "M-", "MS"] as const).map((item) => (
                    <Button key={item} onClick={() => handleMemory(item)} className="h-14 rounded-2xl font-black">
                      {item}
                    </Button>
                  ))}
                </div>
                <div className="rounded-[28px] border border-border/60 bg-muted/20 p-6 text-sm font-medium text-muted-foreground">
                  Memory is persistent across calculator visits. `MS` stores the current evaluated result, `MR` restores it, and `M+` / `M-` adjust it.
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center gap-4 pt-6">
            <Button variant="ghost" size="icon" onClick={() => { setSideTab("history"); setIsExpandedSidebar(true); }} className={cn("rounded-xl", sideTab === "history" && "bg-primary/10 text-primary")}>
              <History className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => { setSideTab("memory"); setIsExpandedSidebar(true); }} className={cn("rounded-xl", sideTab === "memory" && "bg-primary/10 text-primary")}>
              <MemoryStick className="h-5 w-5" />
            </Button>
          </div>
        )}

        {isExpandedSidebar ? (
          <div className="p-10 border-t border-border/40 bg-muted/20 space-y-6">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
              <span>Session Intelligence</span>
              <Sigma className="w-3 h-3" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-border/60 bg-background p-4 space-y-1">
                <div className="text-[10px] font-bold text-muted-foreground/40">Operations</div>
                <div className="text-xl font-black">{history.length}</div>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background p-4 space-y-1">
                <div className="text-[10px] font-bold text-muted-foreground/40">Precision</div>
                <div className="text-xl font-black">{settings.precision} dp</div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
