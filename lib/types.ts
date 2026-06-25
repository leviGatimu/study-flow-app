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
