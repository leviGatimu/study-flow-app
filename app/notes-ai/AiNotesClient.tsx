"use client";

import dynamic from 'next/dynamic';

interface Note {
  id: string;
  title: string;
  content: string;
  sourceName: string | null;
  stylePreset: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const AiNotesInterface = dynamic(
  () => import('./AiNotesInterface').then((mod) => mod.AiNotesInterface),
  { ssr: false }
);

export default function AiNotesClient({ initialNotes }: { initialNotes: Note[] }) {
  return <AiNotesInterface initialNotes={initialNotes} />;
}
