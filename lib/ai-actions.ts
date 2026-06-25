'use server';

import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/lib/auth';
import { createQuickTask, getAllTasks, getEvents, syncStreak } from '@/lib/actions';
import { revalidatePath } from 'next/cache';
import { addXp } from './gamification';
import { startOfDay, isSameDay } from 'date-fns';

type Provider = 'gemini' | 'openai' | 'anthropic' | 'groq';

type HistoryMessage = { role: string; parts: { text: string }[]; file?: { data: string; mimeType: string } };
type PersistedMessage = { role: 'user' | 'model'; text: string; file?: { data: string; mimeType: string } };
type ToolArgs = {
  subject: string;
  startTime: string;
  endTime: string;
  type: string;
  date?: string;
};

type DetectedProvider = {
  provider: Provider;
  label: string;
  model: string;
  models: string[];
};

const SYSTEM_INSTRUCTION = `You are a helpful study buddy. Help the user plan study time, understand workload, and stay consistent.
Keep your answers in clear, simple, and direct English. Break down tasks into easy steps.
You can analyze images (graphs, equations, handwritten notes, etc.) to help the user.
If the user asks you to schedule something and any required detail is missing, ask specifically for it.
When you use tools, only call them with precise arguments.
Today's date is ${new Date().toDateString()}.`;

const FUNCTION_TOOLS = [
  {
    name: 'scheduleTask',
    description: 'Schedule a new task or study session for the user.',
    inputSchema: {
      type: 'object',
      properties: {
        subject: { type: 'string', description: 'The subject or title of the task.' },
        startTime: { type: 'string', description: 'The start time in HH:mm format.' },
        endTime: { type: 'string', description: 'The end time in HH:mm format.' },
        type: { type: 'string', description: "The type of task: 'HOMEWORK', 'REVISION', or 'EXAM'." },
        date: { type: 'string', description: 'Optional date in YYYY-MM-DD format.' },
      },
      required: ['subject', 'startTime', 'endTime', 'type'],
      additionalProperties: false,
    },
  },
  {
    name: 'getScheduleSummary',
    description: "Get a summary of the user's current tasks, weekly school timetable, and streak.",
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
];

const PROVIDER_LABELS: Record<Provider, string> = {
  gemini: 'Google Gemini',
  openai: 'OpenAI',
  anthropic: 'Anthropic Claude',
  groq: 'Groq',
};

const PREFERRED_MODELS: Record<Provider, string[]> = {
  gemini: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  anthropic: ['claude-3-5-sonnet-20240620', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
  groq: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
};

async function safeJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url: string, options: any, timeout = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

function pickModel(provider: Provider, models: string[]) {
  const preferred = PREFERRED_MODELS[provider];
  const matched = preferred.find((model) => models.includes(model));
  return matched ?? models[0] ?? preferred[0];
}

async function probeGemini(apiKey: string): Promise<DetectedProvider | null> {
  const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`, {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) return null;
  const data = await safeJson(response);
  const models = Array.isArray(data?.models)
    ? data.models
        .map((model: { name?: string }) => model.name?.replace(/^models\//, ''))
        .filter(Boolean)
    : [];

  return {
    provider: 'gemini',
    label: PROVIDER_LABELS.gemini,
    model: pickModel('gemini', models),
    models,
  };
}

async function probeOpenAI(apiKey: string): Promise<DetectedProvider | null> {
  const response = await fetchWithTimeout('https://api.openai.com/v1/models', {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  });

  if (!response.ok) return null;
  const data = await safeJson(response);
  const models = Array.isArray(data?.data) ? data.data.map((model: { id?: string }) => model.id).filter(Boolean) : [];

  return {
    provider: 'openai',
    label: PROVIDER_LABELS.openai,
    model: pickModel('openai', models),
    models,
  };
}

async function probeAnthropic(apiKey: string): Promise<DetectedProvider | null> {
  const response = await fetchWithTimeout('https://api.anthropic.com/v1/models', {
    method: 'GET',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    cache: 'no-store',
  });

  if (!response.ok) return null;
  const data = await safeJson(response);
  const models = Array.isArray(data?.data) ? data.data.map((model: { id?: string }) => model.id).filter(Boolean) : [];

  return {
    provider: 'anthropic',
    label: PROVIDER_LABELS.anthropic,
    model: pickModel('anthropic', models),
    models,
  };
}

async function probeGroq(apiKey: string): Promise<DetectedProvider | null> {
  const response = await fetchWithTimeout('https://api.groq.com/openai/v1/models', {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  });

  if (!response.ok) return null;
  const data = await safeJson(response);
  const models = Array.isArray(data?.data) ? data.data.map((model: { id?: string }) => model.id).filter(Boolean) : [];

  return {
    provider: 'groq',
    label: PROVIDER_LABELS.groq,
    model: pickModel('groq', models),
    models,
  };
}

// ----- Ollama (local, offline) -----

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

function normalizeOllamaUrl(url?: string | null) {
  const trimmed = (url || '').trim();
  return (trimmed || DEFAULT_OLLAMA_URL).replace(/\/+$/, '');
}

/**
 * Probe a local Ollama server and return its installed models, or null if it
 * is not reachable (not installed / not running). Kept short so it never hangs
 * the request when Ollama is absent.
 */
export async function probeOllama(baseUrl?: string): Promise<{ models: string[] } | null> {
  const url = normalizeOllamaUrl(baseUrl);
  try {
    const response = await fetchWithTimeout(`${url}/api/tags`, { method: 'GET', cache: 'no-store' }, 2500);
    if (!response.ok) return null;
    const data = await safeJson(response);
    const models = Array.isArray(data?.models)
      ? data.models.map((m: { name?: string }) => m.name).filter(Boolean)
      : [];
    return { models };
  } catch {
    return null;
  }
}

// Tiny module-level cache so a single request batch doesn't re-probe the network.
let onlineCache: { value: boolean; at: number } | null = null;
const ONLINE_CACHE_MS = 5000;

/**
 * Fast best-effort check for outbound internet. Used to decide whether to try
 * cloud providers at all before falling back to Ollama. On failure we assume
 * offline so the app degrades to the local model quickly instead of hanging.
 */
export async function isLikelyOnline(): Promise<boolean> {
  const now = Date.now();
  if (onlineCache && now - onlineCache.at < ONLINE_CACHE_MS) return onlineCache.value;

  let value = false;
  try {
    const response = await fetchWithTimeout(
      'https://generativelanguage.googleapis.com/',
      { method: 'HEAD', cache: 'no-store' },
      2500
    );
    // Any HTTP response (even 4xx) proves we reached the internet.
    value = !!response;
  } catch {
    value = false;
  }

  onlineCache = { value, at: now };
  return value;
}

async function askOllama(
  baseUrl: string,
  model: string,
  prompt: string,
  history: PersistedMessage[],
  file?: { data: string; mimeType: string },
  systemInstruction: string = SYSTEM_INSTRUCTION
) {
  const url = normalizeOllamaUrl(baseUrl);
  const stripDataUri = (data: string) => data.split(',')[1] || data;

  const messages: any[] = [{ role: 'system', content: systemInstruction }];

  for (const m of history) {
    const msg: any = { role: m.role === 'model' ? 'assistant' : 'user', content: m.text };
    if (m.file) msg.images = [stripDataUri(m.file.data)];
    messages.push(msg);
  }

  const userMsg: any = { role: 'user', content: prompt };
  if (file) userMsg.images = [stripDataUri(file.data)];
  messages.push(userMsg);

  const tools = FUNCTION_TOOLS.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }));

  let iterations = 0;
  const MAX_ITERATIONS = 5;

  // Not every local model supports tool-calling; drop tools and retry if so.
  let useTools = true;

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    const response = await fetchWithTimeout(
      `${url}/api/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, ...(useTools ? { tools } : {}), stream: false }),
        cache: 'no-store',
      },
      120000
    );

    const data = await safeJson(response);
    if (!response.ok) {
      const errMsg = String(data?.error || '');
      if (useTools && /tool/i.test(errMsg)) {
        // Model rejected tools — retry the same turn as a plain text chat.
        useTools = false;
        iterations--;
        continue;
      }
      throw new Error(data?.error || 'Ollama request failed.');
    }

    const message = data?.message;
    const toolCalls = Array.isArray(message?.tool_calls) ? message.tool_calls : [];

    if (toolCalls.length === 0) {
      return { text: message?.content || 'No response returned.' };
    }

    // Small local models can emit malformed tool calls; degrade gracefully to text.
    messages.push(message);
    try {
      for (const call of toolCalls) {
        const rawArgs = call?.function?.arguments;
        const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs || '{}') : rawArgs || {};
        const toolOutput = await executeTool(call.function.name, args);
        messages.push({ role: 'tool', content: JSON.stringify(toolOutput) });
      }
    } catch (err) {
      return { text: message?.content || 'I tried to use a tool but the local model returned an invalid request.' };
    }
  }

  return { text: 'Too many tool call iterations.' };
}

export async function detectAIProvider(apiKey: string): Promise<DetectedProvider | null> {
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) return null;

  // Faster detection based on key prefixes
  if (trimmedKey.startsWith('sk-')) {
    const openai = await probeOpenAI(trimmedKey);
    if (openai) return openai;
  }
  
  if (trimmedKey.startsWith('gsk_')) {
    const groq = await probeGroq(trimmedKey);
    if (groq) return groq;
  }

  // Fallback to searching all
  const probes = [probeGemini, probeOpenAI, probeAnthropic, probeGroq];
  for (const probe of probes) {
    try {
      const match = await probe(trimmedKey);
      if (match) return match;
    } catch {
      continue;
    }
  }

  return null;
}

const SCHOOL_TIMETABLE_DATA = `
SCHOOL TIMETABLE (Weekly):
- Monday: 07:30-09:00 Devotion, 09:00-10:40 Networking, 11:00-11:50 Citizenship, 11:50-12:40 C, 13:40-15:20 JS, 15:40-17:20 Embedded.
- Tuesday: 07:30-09:00 Devotion, 09:00-10:40 PHP, 11:00-12:40 GUI, 13:40-15:20 English, 15:40-17:20 Clubs.
- Wednesday: 07:30-09:00 Devotion, 09:00-10:40 C, 11:00-12:40 Database, 13:40-14:30 Entrepreneurship, 14:30-15:20 Computer Basics, 15:40-17:20 Circuits.
- Thursday: 07:30-09:00 Devotion, 09:00-10:40 Circuits, 11:00-12:40 Web UI, 13:40-14:30 JS Extra, 14:30-15:20 JS, 15:40-17:20 C.
- Friday: 07:30-09:00 Devotion, 09:00-11:50 Math, 11:50-12:40 Embedded, 13:40-14:30 Kinyarwanda, 14:30-15:20 Math, 15:40-17:20 Lab.
`;

async function executeTool(name: string, args: unknown) {
  if (name === 'scheduleTask') {
    const payload = args as ToolArgs;
    await createQuickTask({
      subject: payload.subject,
      startTime: payload.startTime,
      endTime: payload.endTime,
      type: payload.type,
      date: payload.date ? new Date(payload.date) : undefined,
    });

    return {
      success: true,
      message: `Scheduled ${payload.subject} from ${payload.startTime} to ${payload.endTime}.`,
    };
  }

  if (name === 'getScheduleSummary') {
    const [tasks, events, streak] = await Promise.all([getAllTasks(), getEvents(), syncStreak()]);
    return { 
      tasks, 
      events, 
      streak,
      schoolTimetable: SCHOOL_TIMETABLE_DATA
    };
  }

  return { success: false, message: `Unknown tool: ${name}` };
}

function toPlainHistory(history: HistoryMessage[]): any[] {
  return history.map((message) => ({
    role: message.role === 'user' ? 'user' : 'model',
    text: message.parts.map((part) => part.text).join('\n'),
    file: message.file,
  }));
}

async function askGemini(
  apiKey: string,
  model: string,
  prompt: string,
  history: PersistedMessage[],
  file?: { data: string; mimeType: string },
  systemInstruction: string = SYSTEM_INSTRUCTION
) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiTools = [
    {
      functionDeclarations: FUNCTION_TOOLS.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'OBJECT',
          properties: Object.fromEntries(
            Object.entries(tool.inputSchema.properties).map(([key, value]) => [key, { ...value, type: String(value.type).toUpperCase() }])
          ),
          required: tool.inputSchema.required,
        },
      })),
    },
  ];

  const geminiHistory = history.map((m) => {
    const parts: any[] = [{ text: m.text }];
    if (m.file) {
      parts.push({
        inlineData: {
          mimeType: m.file.mimeType,
          data: m.file.data.split(',')[1] || m.file.data,
        },
      });
    }
    return { role: m.role, parts };
  });

  const chat = genAI
    .getGenerativeModel({ model, tools: geminiTools as any })
    .startChat({
      history: [
        { role: 'user', parts: [{ text: `System Instruction: ${systemInstruction}` }] },
        ...geminiHistory,
      ],
    });

  const messageParts: any[] = [{ text: prompt }];
  if (file) {
    messageParts.push({
      inlineData: {
        mimeType: file.mimeType,
        data: file.data.split(',')[1] || file.data,
      },
    });
  }

  let result = await chat.sendMessage(messageParts);
  let iterations = 0;
  const MAX_ITERATIONS = 5;

  while (iterations < MAX_ITERATIONS) {
    const calls = result.response.functionCalls();
    if (!calls?.length) {
      return { text: result.response.text() };
    }

    iterations++;
    const toolResults = await Promise.all(
      calls.map(async (call) => ({
        functionResponse: {
          name: call.name,
          response: await executeTool(call.name, call.args),
        },
      }))
    );

    result = await chat.sendMessage(toolResults as any);
  }
  
  return { text: result.response.text() };
}

async function askOpenAI(
  apiKey: string,
  model: string,
  prompt: string,
  history: PersistedMessage[],
  file?: string,
  systemInstruction: string = SYSTEM_INSTRUCTION
) {
  const inputList: any[] = [];

  for (const m of history) {
    const content: any[] = [{ type: 'text', text: m.text }];
    if (m.file) {
      content.push({
        type: 'image_url',
        image_url: { url: m.file.data },
      });
    }
    inputList.push({
      role: m.role === 'model' ? 'assistant' : 'user',
      content,
    });
  }

  const userContent: any[] = [{ type: 'text', text: prompt }];
  if (file) {
    userContent.push({
      type: 'image_url',
      image_url: { url: file },
    });
  }
  inputList.push({
    role: 'user',
    content: userContent,
  });

  let iterations = 0;
  const MAX_ITERATIONS = 5;

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemInstruction },
          ...inputList
        ],
        tools: FUNCTION_TOOLS.map((tool) => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema,
          }
        })),
      }),
      cache: 'no-store',
    });

    const data = await safeJson(response);
    if (!response.ok) {
      throw new Error(data?.error?.message || 'OpenAI request failed.');
    }

    const message = data?.choices?.[0]?.message;
    if (!message?.tool_calls?.length) {
      return { text: message?.content || 'No response returned.' };
    }

    inputList.push(message);

    for (const call of message.tool_calls) {
      const toolOutput = await executeTool(call.function.name, JSON.parse(call.function.arguments));
      inputList.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(toolOutput),
      });
    }
  }
  
  return { text: "Too many tool call iterations." };
}

async function askAnthropic(
  apiKey: string,
  model: string,
  prompt: string,
  history: PersistedMessage[],
  file?: string,
  systemInstruction: string = SYSTEM_INSTRUCTION
) {
  const messages: any[] = [];

  for (const m of history) {
    const content: any[] = [{ type: 'text', text: m.text }];
    if (m.file) {
      const match = m.file.data.match(/^data:(image\/\w+);base64,(.+)$/);
      if (match) {
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: match[1],
            data: match[2],
          },
        });
      }
    }
    messages.push({ role: m.role === 'model' ? 'assistant' : 'user', content });
  }

  const userContent: any[] = [{ type: 'text', text: prompt }];
  if (file) {
    const match = file.match(/^data:(image\/\w+);base64,(.+)$/);
    if (match) {
      userContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: match[1],
          data: match[2],
        },
      });
    }
  }
  messages.push({ role: 'user', content: userContent });

  let iterations = 0;
  const MAX_ITERATIONS = 5;

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        system: systemInstruction,
        tools: FUNCTION_TOOLS.map((tool) => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.inputSchema,
        })),
        messages,
      }),
      cache: 'no-store',
    });

    const data = await safeJson(response);
    if (!response.ok) {
      throw new Error(data?.error?.message || 'Anthropic request failed.');
    }

    const content = Array.isArray(data?.content) ? data.content : [];
    messages.push({ role: 'assistant', content });

    const toolBlocks = content.filter((block: { type?: string }) => block.type === 'tool_use');
    if (toolBlocks.length === 0) {
      const text = content
        .filter((block: { type?: string }) => block.type === 'text')
        .map((block: { text?: string }) => block.text || '')
        .join('\n')
        .trim();
      return { text: text || 'No response returned.' };
    }

    const toolResults = await Promise.all(
      toolBlocks.map(async (block: { id: string; name: string; input: unknown }) => ({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(await executeTool(block.name, block.input)),
      }))
    );

    messages.push({ role: 'user', content: toolResults });
  }
  
  return { text: "Too many tool call iterations." };
}

async function askGroq(
  apiKey: string,
  model: string,
  prompt: string,
  history: PersistedMessage[],
  systemInstruction: string = SYSTEM_INSTRUCTION
) {
  const messages = [
    { role: 'system', content: systemInstruction },
    ...history.map((message) => ({
      role: message.role === 'model' ? 'assistant' : 'user',
      content: message.text,
    })),
    { role: 'user', content: prompt },
  ];

  const response = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.4,
    }),
    cache: 'no-store',
  });

  const data = await safeJson(response);
  if (!response.ok) {
    throw new Error(data?.error?.message || 'Groq request failed.');
  }

  return { text: data?.choices?.[0]?.message?.content || 'No response returned.' };
}

export async function checkAIAvailability() {
  const userId = await getUserId();
  if (!userId) return { available: false, error: 'Unauthorized' };

  const progress = await prisma.userProgress.findUnique({ where: { userId } });
  if (progress?.geminiApiKey || progress?.openaiApiKey) return { available: true };

  // An offline-only user with no cloud key can still use a running local model.
  if (progress?.ollamaEnabled) {
    const ollama = await probeOllama(progress.ollamaBaseUrl);
    if (ollama && ollama.models.length > 0) return { available: true };
  }

  return { available: false };
}

/**
 * Connectivity snapshot for the AI UI: whether we appear online, whether a
 * local Ollama server is reachable, its installed models, and which mode would
 * be used right now. Purely informational — routing is decided in askAIBuddy.
 */
export async function getAIConnectivity() {
  const userId = await getUserId();
  if (!userId) return { online: false, ollamaReachable: false, ollamaModels: [] as string[], activeMode: 'none' as 'cloud' | 'ollama' | 'none', ollamaModel: null as string | null };

  const progress = await prisma.userProgress.findUnique({ where: { userId } });
  const hasCloudKey = !!progress?.geminiApiKey || !!progress?.openaiApiKey;

  const [online, ollama] = await Promise.all([
    isLikelyOnline(),
    progress?.ollamaEnabled ? probeOllama(progress.ollamaBaseUrl) : Promise.resolve(null),
  ]);

  const ollamaReachable = !!ollama && ollama.models.length > 0;
  const preferOllama = progress?.primaryAiProvider === 'ollama';

  let activeMode: 'cloud' | 'ollama' | 'none' = 'none';
  if ((preferOllama || !online || !hasCloudKey) && ollamaReachable) activeMode = 'ollama';
  else if (online && hasCloudKey) activeMode = 'cloud';
  else if (ollamaReachable) activeMode = 'ollama';
  else if (hasCloudKey) activeMode = 'cloud';

  return {
    online,
    ollamaReachable,
    ollamaModels: ollama?.models ?? [],
    activeMode,
    ollamaModel: progress?.ollamaModel ?? null,
  };
}

export async function saveOllamaConfig(config: {
  enabled?: boolean;
  baseUrl?: string;
  model?: string | null;
  visionModel?: string | null;
}) {
  const userId = await getUserId();
  if (!userId) return { success: false, error: 'Unauthorized' };

  const data: any = {};
  if (config.enabled !== undefined) data.ollamaEnabled = config.enabled;
  if (config.baseUrl !== undefined) data.ollamaBaseUrl = normalizeOllamaUrl(config.baseUrl);
  if (config.model !== undefined) data.ollamaModel = config.model?.trim() || null;
  if (config.visionModel !== undefined) data.ollamaVisionModel = config.visionModel?.trim() || null;

  await prisma.userProgress.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });

  revalidatePath('/ai');
  revalidatePath('/settings');
  return { success: true };
}

export async function saveAIKey(rawKey: string) {
  const userId = await getUserId();
  if (!userId) return { success: false, error: 'Unauthorized' };

  const key = rawKey.trim();
  if (!key) return { success: false, error: 'API key is required.' };

  const detected = await detectAIProvider(key);
  if (!detected) {
    return { success: false, error: 'This key did not validate against the supported providers.' };
  }

  const updateData: any = {};
  if (detected.provider === 'gemini') {
    updateData.geminiApiKey = key;
    updateData.primaryAiProvider = 'gemini';
  } else if (detected.provider === 'openai') {
    updateData.openaiApiKey = key;
    updateData.primaryAiProvider = 'openai';
  } else {
    updateData.geminiApiKey = key;
    updateData.primaryAiProvider = 'gemini';
  }

  await prisma.userProgress.upsert({
    where: { userId },
    update: updateData,
    create: { userId, ...updateData },
  });

  revalidatePath('/ai');
  revalidatePath('/settings');

  return {
    success: true,
    provider: detected.label,
    model: detected.model,
  };
}

export async function saveGeminiKey(rawKey: string) {
  const userId = await getUserId();
  if (!userId) return { success: false, error: 'Unauthorized' };

  const key = rawKey.trim();
  if (key) {
    const detected = await probeGemini(key);
    if (!detected) {
      return { success: false, error: 'Invalid Gemini API key. Please check your key and billing status.' };
    }
  }

  await prisma.userProgress.upsert({
    where: { userId },
    update: { geminiApiKey: key || null },
    create: { userId, geminiApiKey: key || null },
  });

  revalidatePath('/ai');
  revalidatePath('/settings');
  return { success: true };
}

export async function saveOpenAIKey(rawKey: string) {
  const userId = await getUserId();
  if (!userId) return { success: false, error: 'Unauthorized' };

  const key = rawKey.trim();
  if (key) {
    const detected = await probeOpenAI(key);
    if (!detected) {
      return { success: false, error: 'Invalid OpenAI API key. Please check your key and billing status.' };
    }
  }

  await prisma.userProgress.upsert({
    where: { userId },
    update: { openaiApiKey: key || null },
    create: { userId, openaiApiKey: key || null },
  });

  revalidatePath('/ai');
  revalidatePath('/settings');
  return { success: true };
}

export async function setPrimaryAIProvider(provider: 'gemini' | 'openai' | 'ollama') {
  const userId = await getUserId();
  if (!userId) return { success: false, error: 'Unauthorized' };

  await prisma.userProgress.upsert({
    where: { userId },
    update: { primaryAiProvider: provider },
    create: { userId, primaryAiProvider: provider },
  });

  revalidatePath('/ai');
  revalidatePath('/settings');
  return { success: true };
}

export async function createChatSession(title: string = 'New Chat') {
  const userId = await getUserId();
  if (!userId) throw new Error('Unauthorized');

  const session = await prisma.chatSession.create({
    data: { userId, title },
  });

  revalidatePath('/ai');
  return session;
}

export async function getChatSessions() {
  const userId = await getUserId();
  if (!userId) return [];

  return prisma.chatSession.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function getChatMessages(sessionId: string) {
  const userId = await getUserId();
  if (!userId) return [];

  return prisma.chatMessage.findMany({
    where: { sessionId, session: { userId } },
    orderBy: { createdAt: 'asc' },
  });
}

export async function deleteChatSession(sessionId: string) {
  const userId = await getUserId();
  if (!userId) return;

  await prisma.chatSession.deleteMany({ where: { id: sessionId, userId } });
  revalidatePath('/ai');
}

type AskAIResult = {
  text: string; // always a string ('' when an error is returned)
  error?: string;
  provider?: string;
  model?: string;
  xpInfo?: Awaited<ReturnType<typeof addXp>>;
};

export async function askAIBuddy(prompt: string, history: HistoryMessage[], sessionId?: string, file?: { data: string; mimeType: string }, systemInstructionOverride?: string): Promise<AskAIResult> {
  const userId = await getUserId();
  if (!userId) throw new Error('Unauthorized');

  const progress = await prisma.userProgress.findUnique({ where: { userId } });

  // Build list of cloud providers to try based on primary choice and set keys
  const primaryProvider = progress?.primaryAiProvider === 'openai' ? 'openai' : 'gemini';
  const providersToTry: { provider: 'gemini' | 'openai'; key: string }[] = [];

  if (primaryProvider === 'gemini') {
    if (progress?.geminiApiKey?.trim()) {
      providersToTry.push({ provider: 'gemini', key: progress.geminiApiKey.trim() });
    }
    if (progress?.openaiApiKey?.trim()) {
      providersToTry.push({ provider: 'openai', key: progress.openaiApiKey.trim() });
    }
  } else {
    if (progress?.openaiApiKey?.trim()) {
      providersToTry.push({ provider: 'openai', key: progress.openaiApiKey.trim() });
    }
    if (progress?.geminiApiKey?.trim()) {
      providersToTry.push({ provider: 'gemini', key: progress.geminiApiKey.trim() });
    }
  }

  // Detect a local Ollama server for offline use / fallback.
  let ollamaConfig: { baseUrl: string; model: string; visionModel?: string } | null = null;
  if (progress?.ollamaEnabled) {
    const ollama = await probeOllama(progress.ollamaBaseUrl);
    if (ollama && ollama.models.length > 0) {
      const baseUrl = normalizeOllamaUrl(progress.ollamaBaseUrl);
      const model = progress.ollamaModel?.trim() && ollama.models.includes(progress.ollamaModel.trim())
        ? progress.ollamaModel.trim()
        : ollama.models[0];
      const visionModel = progress.ollamaVisionModel?.trim() && ollama.models.includes(progress.ollamaVisionModel.trim())
        ? progress.ollamaVisionModel.trim()
        : undefined;
      ollamaConfig = { baseUrl, model, visionModel };
    }
  }

  if (providersToTry.length === 0 && !ollamaConfig) {
    return { text: '', error: 'No AI configured. Add an API key, or start a local Ollama model, in settings.' };
  }

  let activeSessionId = sessionId;
  if (activeSessionId) {
    const ownedSession = await prisma.chatSession.findFirst({
      where: { id: activeSessionId, userId },
      select: { id: true },
    });
    if (!ownedSession) activeSessionId = undefined;
  }

  if (activeSessionId) {
    await prisma.chatMessage.create({
      data: { sessionId: activeSessionId, role: 'user', content: prompt },
    });
    await prisma.chatSession.update({
      where: { id: activeSessionId },
      data: { updatedAt: new Date() },
    });
  }

  const plainHistory = toPlainHistory(history);
  let lastError = 'Failed to communicate with AI.';

  // Persist the AI reply + award XP. Shared by every successful attempt.
  const finalize = async (text: string, providerLabel: string, model: string) => {
    if (activeSessionId && text) {
      await prisma.chatMessage.create({
        data: { sessionId: activeSessionId, role: 'model', content: text },
      });
      await prisma.chatSession.update({
        where: { id: activeSessionId },
        data: { updatedAt: new Date() },
      });
    }
    const xpInfo = await addXp(userId, 20);
    return { text, provider: providerLabel, model, xpInfo };
  };

  // Try each configured cloud provider/model. Returns a result or null on total failure.
  const tryCloud = async () => {
    for (const { provider, key } of providersToTry) {
      try {
        let detected: DetectedProvider | null =
          provider === 'gemini' ? await probeGemini(key) : await probeOpenAI(key);
        if (!detected) {
          detected = provider === 'gemini'
            ? { provider: 'gemini', label: PROVIDER_LABELS.gemini, model: 'gemini-2.0-flash', models: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'] }
            : { provider: 'openai', label: PROVIDER_LABELS.openai, model: 'gpt-4o-mini', models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'] };
        }

        const preferred = PREFERRED_MODELS[detected.provider] || [];
        const availableModels = detected.models.length > 0 ? detected.models : [detected.model];
        const modelsToTry = availableModels
          .filter((m) => preferred.includes(m))
          .sort((a, b) => preferred.indexOf(a) - preferred.indexOf(b));
        availableModels.forEach((m) => { if (!modelsToTry.includes(m)) modelsToTry.push(m); });
        if (!modelsToTry.includes(detected.model)) modelsToTry.unshift(detected.model);

        for (const modelToUse of modelsToTry.slice(0, 2)) {
          try {
            const result =
              detected.provider === 'gemini'
                ? await askGemini(key, modelToUse, prompt, plainHistory, file, systemInstructionOverride)
                : await askOpenAI(key, modelToUse, prompt, plainHistory, file?.data, systemInstructionOverride);
            return await finalize(result.text, detected.label, modelToUse);
          } catch (error: any) {
            lastError = error.message || String(error);
            console.warn(`Model ${modelToUse} for ${provider} failed: ${lastError}`);
          }
        }
      } catch (error: any) {
        lastError = error.message || String(error);
        console.warn(`Provider ${provider} failed: ${lastError}`);
      }
    }
    return null;
  };

  // Try the local Ollama model (offline). Returns a result or null on failure.
  const tryOllama = async () => {
    if (!ollamaConfig) return null;
    try {
      const model = file && ollamaConfig.visionModel ? ollamaConfig.visionModel : ollamaConfig.model;
      const result = await askOllama(ollamaConfig.baseUrl, model, prompt, plainHistory, file, systemInstructionOverride);
      return await finalize(result.text, 'Ollama (offline)', model);
    } catch (error: any) {
      lastError = error.message || String(error);
      console.warn(`Ollama failed: ${lastError}`);
      return null;
    }
  };

  // Decide order: offline or Ollama-primary → local first; otherwise cloud first.
  const online = providersToTry.length > 0 ? await isLikelyOnline() : false;
  const preferOllama = progress?.primaryAiProvider === 'ollama' || !online;

  const attempts = preferOllama ? [tryOllama, tryCloud] : [tryCloud, tryOllama];
  for (const attempt of attempts) {
    const result = await attempt();
    if (result) return result;
  }

  return { text: '', error: `AI unavailable: ${lastError}. Checked cloud providers and local Ollama.` };
}

export async function organizeStickyNotes() {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const notes = await prisma.stickyNote.findMany({ where: { userId, isDone: false } });
  if (notes.length === 0) return { error: 'No active notes to organize.' };

  const notesText = notes.map(n => `- Title: ${n.title}\n  Content: ${n.content}`).join('\n\n');
  const prompt = `Please review these sticky notes and provide a structured summary and study action plan. Group related notes together logically.\n\n${notesText}`;

  const result = await askAIBuddy(prompt, []);
  
  if (result.error) return { error: result.error };
  return { success: true, plan: result.text };
}

export async function getAiNotes() {
  const userId = await getUserId();
  if (!userId) return [];

  return prisma.aiNote.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createAiNote(title: string, content: string, sourceName?: string, stylePreset?: string) {
  const userId = await getUserId();
  if (!userId) throw new Error('Unauthorized');

  const note = await prisma.aiNote.create({
    data: {
      userId,
      title,
      content,
      sourceName,
      stylePreset,
    },
  });

  revalidatePath('/notes-ai');
  return note;
}

export async function updateAiNote(id: string, title: string, content: string) {
  const userId = await getUserId();
  if (!userId) throw new Error('Unauthorized');

  const note = await prisma.aiNote.update({
    where: { id, userId },
    data: {
      title,
      content,
    },
  });

  revalidatePath('/notes-ai');
  return note;
}

export async function deleteAiNote(id: string) {
  const userId = await getUserId();
  if (!userId) throw new Error('Unauthorized');

  await prisma.aiNote.deleteMany({
    where: { id, userId },
  });

  revalidatePath('/notes-ai');
  return { success: true };
}

type FlowQuizQuestion = { question: string; options: string[]; answer: number; explanation: string };

function parseJsonLoose(raw: string): any | null {
  if (!raw) return null;
  let text = raw.trim();
  // Strip markdown code fences if the model wrapped the JSON.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) text = fenced[1].trim();
  // Otherwise slice from the first { to the last } to drop any chatter.
  if (!text.startsWith('{')) {
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first !== -1 && last !== -1 && last > first) {
      text = text.slice(first, last + 1);
    }
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ----- Flow AI: in-session study workspace -----
// Generate a genuine, complete study guide from the student's own material.
export async function generateFlowNotes(
  material: string,
  subject: string,
  file?: { data: string; mimeType: string }
): Promise<{ success: true; title: string; notes: string } | { error: string }> {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const trimmed = (material || '').trim().slice(0, 30000);
  if (!trimmed && !file) {
    return { error: 'Add some material (upload a file or paste text) so Flow has something to work with.' };
  }

  const systemInstruction = `You are Flow, an expert tutor who writes the clearest, most genuinely helpful study notes a student has ever read. Your notes TEACH the material — they do not just list it.
Write ONLY Markdown — no conversational preamble, no "here are your notes".

For every important concept:
- Name it, then explain it in plain, simple language as if teaching a friend.
- Give the intuition: WHY it works or why it matters, not just what it is.
- Add a concrete example, analogy, or worked step when it helps the idea click.

Structure and style:
- Start with one "# Topic Title".
- Break the material into logical "## Sections" (one per major concept), with "###" subsections where useful.
- **Bold** key terms the first time they appear and define them right there.
- Use bullet lists for breakdowns, numbered lists for processes/steps, tables for comparisons, and "> blockquotes" for important rules, definitions, or "remember this" takeaways.
- Use fenced code blocks for code or formulas.
- End with a "## Key Takeaways" section: 4-6 punchy, high-yield bullets.

Be thorough, accurate, and faithful to the source — do NOT invent facts the material does not support — but DO add explanation, intuition, and examples so the concepts are truly understood. Favor clarity and depth over brevity.`;

  const prompt = `Subject: ${subject || 'General study'}.
${file ? 'The study material is in the attached file (plus any text below).' : ''}
${trimmed ? `Material:\n"""\n${trimmed}\n"""` : ''}

Write the full Markdown study guide now.`;

  const result = await askAIBuddy(prompt, [], undefined, file, systemInstruction);
  if (result.error) return { error: result.error };

  const notes = (result.text || '').trim();
  if (!notes) return { error: 'Flow could not generate notes from that material. Try a clearer source.' };

  // Title comes from the first H1 if the model wrote one, otherwise the subject.
  const h1 = notes.match(/^#\s+(.+)$/m);
  const title = h1 ? h1[1].trim() : (subject || 'Study Notes');

  return { success: true, title, notes };
}

// Live tutor grounded in the notes the student is currently reading.
export async function askFlowTutor(
  question: string,
  notes: string,
  history: HistoryMessage[],
  file?: { data: string; mimeType: string }
): Promise<{ text: string } | { error: string }> {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const systemInstruction = `You are Flow, a friendly, sharp study tutor sitting beside the student during a focus session.
The student is reading the study notes below. Answer their questions about this material clearly and concisely, using simple explanations, analogies, and small examples. If they ask about something outside the notes you may still help, but keep the goal on understanding and remembering this material.
Keep answers tight and skimmable. Use Markdown.

THE STUDENT'S CURRENT NOTES:
"""
${(notes || '').slice(0, 16000)}
"""`;

  const result = await askAIBuddy(question, history, undefined, file, systemInstruction);
  if (result.error) return { error: result.error };
  return { text: result.text || '' };
}

// A multiple-choice quiz is built on demand once the student is done reading.
export async function generateFlowQuiz(
  notes: string,
  subject: string
): Promise<{ success: true; questions: FlowQuizQuestion[] } | { error: string }> {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const source = (notes || '').trim().slice(0, 24000);
  if (!source) return { error: 'Generate notes first, then create a quiz from them.' };

  const systemInstruction = `You write high-quality multiple-choice quizzes that test real understanding.
Respond with ONLY a single valid JSON object — no prose, no markdown fences:
{ "questions": [{ "question": string, "options": [string, string, string, string], "answer": number, "explanation": string }] }
Rules:
- Make 5-8 questions covering the most important, testable points from the notes.
- Every question MUST have exactly 4 distinct options.
- "answer" is the 0-based index (0-3) of the correct option.
- Vary the position of the correct answer across questions.
- Write plausible distractors (wrong options that a student might pick), not obvious throwaways.
- "explanation" briefly explains why the correct option is right.
- Base everything strictly on the provided notes.`;

  const prompt = `Subject: ${subject || 'General study'}.
Notes to turn into a multiple-choice quiz:
"""
${source}
"""
Produce the JSON now.`;

  const result = await askAIBuddy(prompt, [], undefined, undefined, systemInstruction);
  if (result.error) return { error: result.error };

  const parsed = parseJsonLoose(result.text || '');
  const questions: FlowQuizQuestion[] = Array.isArray(parsed?.questions)
    ? parsed.questions
        .map((q: any) => {
          if (!q || typeof q.question !== 'string') return null;
          const options = Array.isArray(q.options)
            ? q.options.filter((o: any) => typeof o === 'string' && o.trim()).map((o: string) => o.trim())
            : [];
          if (options.length < 2) return null;
          let answer = Number.isInteger(q.answer) ? q.answer : 0;
          if (answer < 0 || answer >= options.length) answer = 0;
          return {
            question: q.question.trim(),
            options,
            answer,
            explanation: typeof q.explanation === 'string' ? q.explanation.trim() : '',
          };
        })
        .filter(Boolean)
        .slice(0, 10)
    : [];

  if (questions.length === 0) return { error: 'Flow could not build a quiz from these notes.' };
  return { success: true, questions };
}

export async function generateAiNoteFromText(text: string, title: string, stylePreset: string) {
  const userId = await getUserId();
  if (!userId) throw new Error('Unauthorized');

  let stylePrompt = '';
  if (stylePreset === 'Detailed Study Guide') {
    stylePrompt = `Create an exhaustive, deeply structured study guide for the topic "${title}". Use bold headings, structured paragraphs, subheadings, bullet points, definitions of key terms, and comprehensive notes. Keep it informative, clear, and easy to study from.`;
  } else if (stylePreset === 'Concise Summary') {
    stylePrompt = `Create a brief, high-level summary of the topic "${title}". Start with an Executive Summary (1 paragraph), followed by 5-7 core bullet points of key takeaways, and a conclusion. Keep it succinct and fast to read.`;
  } else if (stylePreset === 'Question & Answer') {
    stylePrompt = `Create an active recall revision guide for "${title}". Divide the notes into 10 key questions and answers. Each question should address a core concept, and the answer should explain it clearly using bullet points and simple terms.`;
  } else if (stylePreset === 'Concept Map Outline') {
    stylePrompt = `Create a hierarchical visual outline (concept map format) for "${title}". Use nested bullet lists (up to 3 levels deep) showing the relationship between concepts. For each term, provide a short 1-line definition. Organize it logically by categories.`;
  } else {
    stylePrompt = `Create a beautifully structured, comprehensive set of study notes for "${title}". Structure it with clear sections, main concepts, and summaries.`;
  }

  const prompt = `${stylePrompt}

Here is the source text to base the notes on:
"""
${text}
"""

Instructions:
1. ONLY write facts that are present in or directly inferred from the source text.
2. Structure the notes beautifully using rich markdown styling (headers, bolding, lists, codeblocks if needed, tables if helpful).
3. Do not include introductory conversational text like "Here are your notes...". Start directly with the note content.
4. If there is a key term, bold it and define it.
5. End with a "Review Checklist" or "Takeaway Checklist" with 3-5 action items.`;

  const systemInstruction = `You are a master study assistant and notes architect. 
Your goal is to parse raw text documents and convert them into beautifully structured, styled, and highly readable study guides in Markdown.
Ensure you use headers (h1, h2, h3), bold text, tables, lists, and spacing to make it look premium and easy to study.
Do not talk back or add chat pleasantries. Answer ONLY in Markdown content.`;

  const result = await askAIBuddy(prompt, [], undefined, undefined, systemInstruction);
  if (result.error) {
    throw new Error(result.error);
  }

  return result.text;
}

// ----- Timetable upload: AI parses exams + builds a revision plan -----

export type PlannedExam = { subject: string; date: string; priority: 'LOW' | 'NORMAL' | 'HIGH' };
export type PlannedRevision = { subject: string; date: string; startTime: string; endTime: string; focus?: string };
export type TimetablePlan = { exams: PlannedExam[]; revision: PlannedRevision[] };

const MAX_PLANNED_EXAMS = 40;
const MAX_PLANNED_REVISION = 80;
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseYmd(value: unknown): Date | null {
  if (typeof value !== 'string' || !YMD_RE.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

function normalizePriority(value: unknown): 'LOW' | 'NORMAL' | 'HIGH' {
  const v = String(value || '').toUpperCase();
  return v === 'HIGH' || v === 'LOW' ? v : 'NORMAL';
}

/**
 * Clean and validate a raw AI plan: drop malformed entries, reject past dates,
 * and ensure each revision block falls strictly before its exam's date.
 */
function sanitizePlan(raw: any): TimetablePlan {
  const today = startOfDay(new Date());

  const exams: PlannedExam[] = Array.isArray(raw?.exams)
    ? raw.exams
        .map((e: any) => {
          const subject = typeof e?.subject === 'string' ? e.subject.trim() : '';
          const date = parseYmd(e?.date);
          if (!subject || !date || date < today) return null;
          return { subject, date: e.date as string, priority: normalizePriority(e?.priority) };
        })
        .filter(Boolean)
        .slice(0, MAX_PLANNED_EXAMS)
    : [];

  // Latest exam date per subject — revision must land before its subject's exam.
  const examDateBySubject = new Map<string, Date>();
  for (const ex of exams) {
    const d = parseYmd(ex.date)!;
    const key = ex.subject.toLowerCase();
    const existing = examDateBySubject.get(key);
    if (!existing || d > existing) examDateBySubject.set(key, d);
  }

  const revision: PlannedRevision[] = Array.isArray(raw?.revision)
    ? raw.revision
        .map((r: any) => {
          const subject = typeof r?.subject === 'string' ? r.subject.trim() : '';
          const date = parseYmd(r?.date);
          const startTime = typeof r?.startTime === 'string' ? r.startTime.trim() : '';
          const endTime = typeof r?.endTime === 'string' ? r.endTime.trim() : '';
          if (!subject || !date || date < today) return null;
          if (!HHMM_RE.test(startTime) || !HHMM_RE.test(endTime) || endTime <= startTime) return null;
          const examDate = examDateBySubject.get(subject.toLowerCase());
          if (examDate && date >= examDate) return null; // must be before the exam
          return {
            subject,
            date: r.date as string,
            startTime,
            endTime,
            focus: typeof r?.focus === 'string' ? r.focus.trim().slice(0, 200) : undefined,
          };
        })
        .filter(Boolean)
        .slice(0, MAX_PLANNED_REVISION)
    : [];

  return { exams, revision };
}

/**
 * Step 1: AI reads an uploaded timetable (image via vision, or extracted text)
 * and returns a proposed plan of exams + revision sessions. No DB writes.
 */
export async function analyzeTimetable(
  input: { text?: string; image?: { data: string; mimeType: string } }
): Promise<{ success: true; plan: TimetablePlan } | { error: string }> {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const text = (input.text || '').trim().slice(0, 30000);
  if (!text && !input.image) {
    return { error: 'Upload a timetable image, PDF, or Word document first.' };
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const systemInstruction = `You read a student's exam timetable and produce a study plan.
Today's date is ${todayStr}.

${SCHOOL_TIMETABLE_DATA}

Respond with ONLY one valid JSON object — no prose, no markdown fences:
{
  "exams": [{ "subject": string, "date": "YYYY-MM-DD", "priority": "LOW" | "NORMAL" | "HIGH" }],
  "revision": [{ "subject": string, "date": "YYYY-MM-DD", "startTime": "HH:mm", "endTime": "HH:mm", "focus": string }]
}

Rules:
- "exams": one entry per exam you can identify, with its real calendar date. Infer the year if obvious; never output a date in the past (before ${todayStr}).
- "priority": HIGH if the exam is very soon or clearly important, otherwise NORMAL.
- "revision": build a realistic revision plan leading up to each exam.
  - Schedule revision ONLY on dates from ${todayStr} up to (but NOT including) that exam's date.
  - Spread sessions across the days of the week(s) before each exam — do not cram everything into one day.
  - Use EVENING slots between 17:30 and 22:00, because school occupies daytime (see timetable above). Each block 60–120 minutes.
  - Give exams that are sooner or HIGH priority more sessions. Balance multiple subjects so no single day is overloaded.
  - "subject" of a revision block MUST match the exam subject it prepares for. "focus" is a short note on what to study.
- If you cannot find any exams, return {"exams": [], "revision": []}.`;

  const prompt = input.image
    ? `Read the exam timetable in the attached image and produce the JSON plan now.${text ? `\n\nExtra context:\n"""\n${text}\n"""` : ''}`
    : `Here is the exam timetable text. Produce the JSON plan now.\n"""\n${text}\n"""`;

  const result = await askAIBuddy(prompt, [], undefined, input.image, systemInstruction);
  if (result.error) return { error: result.error };

  const parsed = parseJsonLoose(result.text || '');
  if (!parsed) return { error: 'The AI response could not be understood. Try a clearer file.' };

  const plan = sanitizePlan(parsed);
  return { success: true, plan };
}

/**
 * Step 2: Persist a (user-reviewed) plan — create exam events + revision tasks.
 * Re-validates and dedupes server-side; never trusts the client echo blindly.
 */
export async function commitTimetablePlan(
  plan: TimetablePlan
): Promise<{ success: true; examsAdded: number; revisionAdded: number } | { error: string }> {
  const userId = await getUserId();
  if (!userId) return { error: 'Unauthorized' };

  const clean = sanitizePlan(plan);
  if (clean.exams.length === 0 && clean.revision.length === 0) {
    return { error: 'Nothing to add — no valid exams or revision sessions in the plan.' };
  }

  const existing = await getEvents();

  let examsAdded = 0;
  for (const exam of clean.exams) {
    const date = parseYmd(exam.date)!;
    const isDuplicate = existing.some(
      (e) => e.title.trim().toLowerCase() === exam.subject.toLowerCase() && isSameDay(new Date(e.date), date)
    );
    if (isDuplicate) continue;
    await prisma.examEvent.create({
      data: { userId, title: exam.subject, date: startOfDay(date), priority: exam.priority },
    });
    examsAdded++;
  }

  let revisionAdded = 0;
  for (const r of clean.revision) {
    const date = parseYmd(r.date)!;
    await prisma.task.create({
      data: {
        userId,
        subject: `${r.subject} (revision)`,
        startTime: r.startTime,
        endTime: r.endTime,
        type: 'REVISION',
        date: startOfDay(date),
        isDone: false,
        isMissed: false,
        isDeleted: false,
      },
    });
    revisionAdded++;
  }

  revalidatePath('/');
  revalidatePath('/exams');
  revalidatePath('/calendar');

  return { success: true, examsAdded, revisionAdded };
}
