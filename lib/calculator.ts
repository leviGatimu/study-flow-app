export type CalculatorSettings = {
  precision: number;
  historyLimit: number;
  useDegrees: boolean;
  largeButtons: boolean;
  soundEnabled: boolean;
  animationsEnabled: boolean;
  useScientificByDefault: boolean;
};

export type CalculatorHistoryEntry = {
  expr: string;
  res: string;
  timestamp: string;
};

export const CALCULATOR_SETTINGS_KEY = "study-flow-calculator-settings";
export const CALCULATOR_HISTORY_KEY = "study-flow-calculator-history";
export const CALCULATOR_MEMORY_KEY = "study-flow-calculator-memory";
export const CALCULATOR_EVENT = "study-flow-calculator-updated";

export const DEFAULT_CALCULATOR_SETTINGS: CalculatorSettings = {
  precision: 4,
  historyLimit: 50,
  useDegrees: true,
  largeButtons: false,
  soundEnabled: false,
  animationsEnabled: true,
  useScientificByDefault: false,
};

type Operator = "+" | "-" | "*" | "/" | "%" | "^" | "NEG";

type Token =
  | { type: "number"; value: number }
  | { type: "operator"; value: Operator }
  | { type: "paren"; value: "(" | ")" }
  | { type: "function"; value: string };

const FUNCTION_NAMES = new Set([
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
  "sqrt",
  "abs",
  "ln",
  "log",
  "exp",
]);

const OPERATOR_PRECEDENCE: Record<Operator, number> = {
  "+": 1,
  "-": 1,
  "*": 2,
  "/": 2,
  "%": 2,
  "^": 4,
  NEG: 3,
};

const RIGHT_ASSOCIATIVE = new Set<Operator>(["^", "NEG"]);

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function loadCalculatorSettings(): CalculatorSettings {
  if (typeof window === "undefined") return DEFAULT_CALCULATOR_SETTINGS;

  try {
    const raw = window.localStorage.getItem(CALCULATOR_SETTINGS_KEY);
    if (!raw) return DEFAULT_CALCULATOR_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<CalculatorSettings>;
    return {
      ...DEFAULT_CALCULATOR_SETTINGS,
      ...parsed,
      precision: clamp(Number(parsed.precision ?? DEFAULT_CALCULATOR_SETTINGS.precision), 0, 12),
      historyLimit: clamp(Number(parsed.historyLimit ?? DEFAULT_CALCULATOR_SETTINGS.historyLimit), 10, 200),
    };
  } catch {
    return DEFAULT_CALCULATOR_SETTINGS;
  }
}

export function saveCalculatorSettings(settings: CalculatorSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CALCULATOR_SETTINGS_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent(CALCULATOR_EVENT));
}

export function loadCalculatorHistory(): CalculatorHistoryEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(CALCULATOR_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CalculatorHistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCalculatorHistory(history: CalculatorHistoryEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CALCULATOR_HISTORY_KEY, JSON.stringify(history));
}

export function loadCalculatorMemory(): number | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(CALCULATOR_MEMORY_KEY);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export function saveCalculatorMemory(memory: number | null) {
  if (typeof window === "undefined") return;

  if (memory === null) {
    window.localStorage.removeItem(CALCULATOR_MEMORY_KEY);
  } else {
    window.localStorage.setItem(CALCULATOR_MEMORY_KEY, String(memory));
  }
}

export function formatNumber(value: number, precision: number, useExponential = false) {
  if (!Number.isFinite(value)) {
    if (Number.isNaN(value)) return "Error";
    return value > 0 ? "Infinity" : "-Infinity";
  }

  if (useExponential) {
    return value.toExponential(clamp(precision, 0, 12)).replace(/\.?0+e/, "e");
  }

  const absolute = Math.abs(value);
  if (absolute !== 0 && (absolute >= 1e12 || absolute < 1e-10)) {
    return value.toExponential(clamp(precision, 0, 12)).replace(/\.?0+e/, "e");
  }

  return value.toFixed(clamp(precision, 0, 12)).replace(/\.?0+$/, "");
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function radiansToDegrees(value: number) {
  return (value * 180) / Math.PI;
}

function normalizeExpression(expression: string) {
  return expression
    .replace(/÷/g, "/")
    .replace(/×/g, "*")
    .replace(/−/g, "-")
    .replace(/π/g, "pi")
    .replace(/\s+/g, "");
}

function tokenize(expression: string): Token[] {
  const normalized = normalizeExpression(expression);
  const tokens: Token[] = [];
  let index = 0;

  while (index < normalized.length) {
    const char = normalized[index];

    if (/\d|\./.test(char)) {
      let number = char;
      index += 1;
      while (index < normalized.length && /[\d.]/.test(normalized[index])) {
        number += normalized[index];
        index += 1;
      }

      const value = Number(number);
      if (!Number.isFinite(value)) throw new Error("Invalid number");
      tokens.push({ type: "number", value });
      continue;
    }

    if (/[a-z]/i.test(char)) {
      let word = char;
      index += 1;
      while (index < normalized.length && /[a-z]/i.test(normalized[index])) {
        word += normalized[index];
        index += 1;
      }

      if (word === "pi") {
        tokens.push({ type: "number", value: Math.PI });
        continue;
      }

      if (word === "e") {
        tokens.push({ type: "number", value: Math.E });
        continue;
      }

      if (FUNCTION_NAMES.has(word)) {
        tokens.push({ type: "function", value: word });
        continue;
      }

      throw new Error(`Unknown token: ${word}`);
    }

    if ("+-*/%^".includes(char)) {
      const previous = tokens[tokens.length - 1];
      const unaryMinus =
        char === "-" &&
        (!previous ||
          previous.type === "operator" ||
          (previous.type === "paren" && previous.value === "("));

      tokens.push({ type: "operator", value: unaryMinus ? "NEG" : (char as Operator) });
      index += 1;
      continue;
    }

    if (char === "(" || char === ")") {
      tokens.push({ type: "paren", value: char });
      index += 1;
      continue;
    }

    throw new Error(`Unexpected token: ${char}`);
  }

  return tokens;
}

function toRpn(tokens: Token[]) {
  const output: Token[] = [];
  const operators: Token[] = [];

  for (const token of tokens) {
    if (token.type === "number") {
      output.push(token);
      continue;
    }

    if (token.type === "function") {
      operators.push(token);
      continue;
    }

    if (token.type === "operator") {
      while (operators.length > 0) {
        const top = operators[operators.length - 1];
        if (top.type === "function") {
          output.push(operators.pop() as Token);
          continue;
        }

        if (top.type === "operator") {
          const topPrecedence = OPERATOR_PRECEDENCE[top.value];
          const tokenPrecedence = OPERATOR_PRECEDENCE[token.value];
          const shouldPop = RIGHT_ASSOCIATIVE.has(token.value)
            ? tokenPrecedence < topPrecedence
            : tokenPrecedence <= topPrecedence;

          if (shouldPop) {
            output.push(operators.pop() as Token);
            continue;
          }
        }

        break;
      }

      operators.push(token);
      continue;
    }

    if (token.type === "paren" && token.value === "(") {
      operators.push(token);
      continue;
    }

    if (token.type === "paren" && token.value === ")") {
      let matched = false;

      while (operators.length > 0) {
        const top = operators.pop() as Token;
        if (top.type === "paren" && top.value === "(") {
          matched = true;
          break;
        }
        output.push(top);
      }

      if (!matched) {
        throw new Error("Mismatched parentheses");
      }

      const maybeFunction = operators[operators.length - 1];
      if (maybeFunction?.type === "function") {
        output.push(operators.pop() as Token);
      }
    }
  }

  while (operators.length > 0) {
    const top = operators.pop() as Token;
    if (top.type === "paren") throw new Error("Mismatched parentheses");
    output.push(top);
  }

  return output;
}

function applyFunction(name: string, value: number, useDegrees: boolean) {
  switch (name) {
    case "sin":
      return Math.sin(useDegrees ? degreesToRadians(value) : value);
    case "cos":
      return Math.cos(useDegrees ? degreesToRadians(value) : value);
    case "tan":
      return Math.tan(useDegrees ? degreesToRadians(value) : value);
    case "asin": {
      const result = Math.asin(value);
      return useDegrees ? radiansToDegrees(result) : result;
    }
    case "acos": {
      const result = Math.acos(value);
      return useDegrees ? radiansToDegrees(result) : result;
    }
    case "atan": {
      const result = Math.atan(value);
      return useDegrees ? radiansToDegrees(result) : result;
    }
    case "sqrt":
      return Math.sqrt(value);
    case "abs":
      return Math.abs(value);
    case "ln":
      return Math.log(value);
    case "log":
      return Math.log10(value);
    case "exp":
      return Math.exp(value);
    default:
      throw new Error(`Unsupported function: ${name}`);
  }
}

function evaluateRpn(tokens: Token[], useDegrees: boolean) {
  const stack: number[] = [];

  for (const token of tokens) {
    if (token.type === "number") {
      stack.push(token.value);
      continue;
    }

    if (token.type === "function") {
      const value = stack.pop();
      if (value === undefined) throw new Error("Invalid expression");
      stack.push(applyFunction(token.value, value, useDegrees));
      continue;
    }

    if (token.type === "operator") {
      if (token.value === "NEG") {
        const value = stack.pop();
        if (value === undefined) throw new Error("Invalid expression");
        stack.push(-value);
        continue;
      }

      const right = stack.pop();
      const left = stack.pop();

      if (left === undefined || right === undefined) {
        throw new Error("Invalid expression");
      }

      switch (token.value) {
        case "+":
          stack.push(left + right);
          break;
        case "-":
          stack.push(left - right);
          break;
        case "*":
          stack.push(left * right);
          break;
        case "/":
          stack.push(left / right);
          break;
        case "%":
          stack.push(left % right);
          break;
        case "^":
          stack.push(left ** right);
          break;
      }
    }
  }

  if (stack.length !== 1) throw new Error("Invalid expression");
  return stack[0];
}

export function evaluateExpression(expression: string, useDegrees: boolean) {
  const tokens = tokenize(expression);
  const rpn = toRpn(tokens);
  return evaluateRpn(rpn, useDegrees);
}

export function appendToken(expression: string, token: string) {
  if (expression === "0" && /\d/.test(token)) return token;
  return `${expression}${token}`;
}

export function wrapWithFunction(expression: string, fn: string) {
  if (!expression || expression === "0") return `${fn}(0)`;
  return `${fn}(${expression})`;
}

export function percentOfCurrent(expression: string) {
  const match = expression.match(/(-?\d*\.?\d+)(?!.*\d)/);
  if (!match) return expression;
  const current = Number(match[1]);
  const percent = current / 100;
  return `${expression.slice(0, match.index)}${percent}`;
}
