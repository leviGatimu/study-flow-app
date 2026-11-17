/**
 * Replies the Study chat gives straight away, without asking the AI.
 *
 * "hello", "thanks", "ok" and the like have one sensible answer, and sending
 * them to the AI costs a request (and the student's quota) and a few seconds
 * of waiting for a line we could have written. Only a message that is NOTHING
 * BUT one of these gets a quick reply: "hi, explain recursion" still goes to
 * the AI.
 *
 * Pure, so it is tested on its own (test/quick-replies.test.mjs).
 */

type Kind = 'greeting' | 'howAreYou' | 'thanks' | 'bye' | 'ack' | 'whoAreYou';

/** Whole messages, after normalise(), for each kind. */
const PHRASES: Record<Kind, string[]> = {
  greeting: [
    'hi', 'hii', 'hey', 'heyy', 'hello', 'helo', 'hallo', 'yo', 'sup', 'wassup', 'whats up', 'hiya', 'howdy',
    'good morning', 'good afternoon', 'good evening', 'morning', 'evening', 'hey there', 'hi there', 'hello there',
    'hey buddy', 'hi buddy', 'hello buddy', 'hey bro', 'hi bro', 'yo bro', 'hey man',
  ],
  howAreYou: [
    'how are you', 'how r u', 'how are u', 'how you doing', 'how are you doing', 'hows it going', 'how is it going',
    'you good', 'u good', 'hey how are you', 'hi how are you', 'hello how are you',
  ],
  thanks: [
    'thanks', 'thank you', 'thx', 'ty', 'tysm', 'thanks a lot', 'thank you so much', 'thanks so much', 'cheers',
    'thanks bro', 'thank you bro', 'appreciate it', 'much appreciated', 'thanks man',
  ],
  bye: ['bye', 'goodbye', 'good bye', 'see you', 'see ya', 'cya', 'later', 'good night', 'gn', 'bye bye', 'see you later', 'catch you later'],
  ack: ['ok', 'okay', 'k', 'kk', 'okk', 'alright', 'cool', 'nice', 'great', 'got it', 'gotcha', 'sure', 'yep', 'yup', 'awesome', 'perfect', 'noted', 'makes sense', 'ok thanks', 'okay thanks', 'ok cool', 'nice one'],
  whoAreYou: ['who are you', 'what are you', 'what can you do', 'what do you do', 'help', 'what can i ask', 'what can i ask you'],
};

const REPLIES: Record<Kind, string[]> = {
  greeting: [
    'Hey! What are we studying today? I can explain a topic, quiz you, make a practice set, or tell you what is coming up this week.',
    'Hi! Ready when you are. Ask me about a topic, ask for a practice set, or ask what you should study next.',
  ],
  howAreYou: [
    'All good and ready to help. What are you working on? I can explain something, quiz you, or check what is coming up.',
  ],
  thanks: ['Any time! Anything else you want to go over?', 'Glad it helped. Ask whenever you need more.'],
  bye: ['See you! Good luck with your studying.', 'Bye for now. Come back any time you get stuck.'],
  ack: ['Great. Anything else you want to go over?', 'Got it. Ask me whenever you are ready for the next thing.'],
  whoAreYou: [
    'I am your study helper. I know your subjects, timetable, homework, exams and marks, so you can ask things like:\n\n- "Explain recursion simply"\n- "Make me a practice set on Physics"\n- "What should I study tonight?"\n- "How am I doing in Maths?"',
  ],
};

/**
 * Lower case, without punctuation or emoji, spaces collapsed, and a word
 * repeated back to back said once ("hello hello", "hiiii" stays hiiii).
 */
export function normalise(message: string): string {
  const words = message
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  return words.filter((word, i) => word !== words[i - 1]).join(' ');
}

/** Stretched letters said once: "hiiii" -> "hi", "heyyy" -> "hey", "okkkk" -> "ok". */
const unstretch = (text: string) => text.replace(/(\p{L})\1{2,}/gu, '$1');

const LOOKUP = new Map<string, Kind>();
for (const [kind, phrases] of Object.entries(PHRASES) as [Kind, string[]][]) {
  for (const phrase of phrases) LOOKUP.set(phrase, kind);
}

/** A ready reply for a message that is only a greeting, thanks and so on; null for anything else. */
export function quickReply(message: string, seed = ''): string | null {
  if (message.length > 60) return null;
  const text = normalise(message);
  if (!text) return null;
  const kind = LOOKUP.get(text) ?? LOOKUP.get(unstretch(text)) ?? LOOKUP.get(normalise(unstretch(text)));
  if (!kind) return null;
  const options = REPLIES[kind];
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return options[hash % options.length];
}
