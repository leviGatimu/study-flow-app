import { Task, ScheduleTemplate, Project, ProjectDoc, ChatSession, ChatMessage, ExamEvent, UserProgress, Resource, MasteryItem, WeeklySummary, StickyNote, TutorModule, StudioNote, Homework, Song } from '../node_modules/.prisma/client-custom-v8';

export type TaskWithTemplate = Task & {
  template: ScheduleTemplate | null;
  isUrgent?: boolean;
  workDescription?: string | null;
};

/** A user's music playlist, sent to the client as a lightweight membership list. */
export type PlaylistInfo = {
  id: string;
  name: string;
  songIds: string[];
};

export type ProjectWithDocs = Project & {
  docs: ProjectDoc[];
};

export type ChatSessionWithMessages = ChatSession & {
  messages: ChatMessage[];
};

/**
 * UserProgress without the AI API keys.
 *
 * The keys are the user's own, billing-linked credentials. They belong on the
 * server only: nothing that renders in a browser needs them, and anything
 * passed to a client component is serialised into the page payload where a
 * browser extension or injected script can read it.
 *
 * syncStreak used to return the whole row, so the keys were shipped to /ai,
 * /history, /ranks, /streak and /exams - none of which ever read them. Type
 * every client-facing prop as this, so re-introducing the leak fails to
 * compile rather than going unnoticed.
 */
export type SafeUserProgress = Omit<UserProgress, 'geminiApiKey' | 'openaiApiKey'>;

export {
  type Task,
  type ScheduleTemplate,
  type Project, 
  type ProjectDoc, 
  type ChatSession, 
  type ChatMessage, 
  type ExamEvent, 
  type UserProgress,
  type Resource,
  type MasteryItem,
  type WeeklySummary,
  type StickyNote,
  type TutorModule,
  type StudioNote,
  type Homework,
  type Song
};
