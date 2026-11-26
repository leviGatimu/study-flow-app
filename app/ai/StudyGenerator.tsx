'use client';

/**
 * Practice: turn a document into questions, then answer them.
 *
 * One route, several stages. A student arrives with a PDF and wants to be
 * tested on it; every extra page between those two facts is a place to lose
 * them. So the library, the upload, the configuration, the run and the results
 * are all here, and the only thing that changes is what is on screen. The open
 * set is mirrored into the URL (?set=<id>) so a refresh, or a link from another
 * page, lands on the same set.
 *
 * THE FILE NEVER LEAVES THE BROWSER. readStudyDocument extracts the text here
 * and the File object is dropped immediately afterwards - only the text is sent.
 * That is what makes this work on a serverless host with a read-only filesystem,
 * and it means nothing private is left lying in an uploads directory.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { createRunSaveQueue } from '@/lib/run-save-queue';
import type { RunDraft, RunSnapshot } from '@/lib/run-draft';
import type { StudyDocument } from '@/lib/file-extract';
import {
  generateFlashcards,
  getStudySet,
  submitAttempt,
  saveStudyRun,
  startStudyRun,
  type AttemptResult,
  type StudySetDetail,
  type StudySetSummary,
} from '@/lib/study-actions';
import { PracticeWorkspace, type SaveStatus } from './PracticeWorkspace';
import { QuestionRunner, type RunnerMode } from './QuestionRunner';
import { FlashcardRunner } from './FlashcardRunner';
import { PracticeBuilder, PracticeWriting } from './PracticeBuilder';
import { LibraryView, Results, SetOverview } from './PracticeViews';

type Stage = 'library' | 'configure' | 'generating' | 'set' | 'running' | 'cards' | 'results';

const MODE_LABEL: Record<RunnerMode, string> = {
  PRACTICE: 'Practice',
  EXAM: 'Mock exam',
};



/**
 * Keep the address bar in step with what is on screen, without a server round
 * trip: the page already has everything it needs.
 */
function syncUrl(setId: string | null) {
  if (typeof window === 'undefined') return;
  window.history.replaceState(null, '', setId ? `/ai/practices?set=${encodeURIComponent(setId)}` : '/ai/practices');
}

export function StudyGenerator({
  sets,
  subjects,
  aiReady,
  initialDetail,
  initialSubject,
  missingSet,
}: {
  sets: StudySetSummary[];
  subjects: string[];
  aiReady: boolean;
  initialDetail: StudySetDetail | null;
  initialSubject: string | null;
  missingSet: boolean;
}) {
  const router = useRouter();
  // Keep the library and tool navigation visible until the student chooses
  // to create a set, or follows an explicit subject link into the generator.
  const [stage, setStage] = useState<Stage>(() =>
    initialDetail ? 'set' : initialSubject ? 'configure' : 'library'
  );
  const [doc, setDoc] = useState<StudyDocument | null>(null);
  const [detail, setDetail] = useState<StudySetDetail | null>(initialDetail);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [runnerMode, setRunnerMode] = useState<RunnerMode>('PRACTICE');
  // The saved run being worked on: answers so far and an exam's deadline.
  const [draft, setDraft] = useState<RunDraft | null>(null);
  const [runKey, setRunKey] = useState(0);
  const [configSubject, setConfigSubject] = useState<string | null>(initialSubject);
  const [writingSubject, setWritingSubject] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');

  const openSet = useCallback(
    async (setId: string) => {
      setBusy(true);
      const loaded = await getStudySet(setId);
      setBusy(false);
      if (!loaded) {
        toast.error('That set could not be found. It may have been deleted.');
        router.refresh();
        return;
      }
      setDetail(loaded);
      setResult(null);
      setStage('set');
      syncUrl(loaded.id);
    },
    [router]
  );

  const toLibrary = () => {
    setDetail(null);
    setResult(null);
    setStage('library');
    syncUrl(null);
  };

  const toConfigure = (subject: string | null) => {
    setConfigSubject(subject);
    setStage('configure');
    syncUrl(null);
  };

  // Autosave. Debounced so typing does not send a request per keystroke, and
  // flushed when the run ends or the tab is hidden, so leaving loses nothing.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveQueue] = useState(() => createRunSaveQueue<{
    setId: string; mode: RunnerMode; snapshot: RunSnapshot;
  }>(async (pending) => {
    const res = await saveStudyRun(pending.setId, pending.mode, pending.snapshot);
    if ('error' in res) throw new Error(res.error);
  }, setSaveStatus));

  const flushSave = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    return saveQueue.flush();
  }, [saveQueue]);

  const queueSave = useCallback((snapshot: RunSnapshot) => {
    if (!detail) return;
    saveQueue.queue({ setId: detail.id, mode: runnerMode, snapshot });
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void flushSave(), 700);
  }, [detail, runnerMode, flushSave, saveQueue]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flushSave();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      void flushSave();
    };
  }, [flushSave]);

  const startRun = async (mode: RunnerMode, fresh = false) => {
    if (!detail) return;
    setBusy(true);
    try {
      const res = await startStudyRun(detail.id, mode, fresh);
      if ('error' in res) {
        toast.error(res.error);
        return;
      }
      setDraft(res.draft);
      setSaveStatus('saved');
      setRunnerMode(mode);
      setResult(null);
      setRunKey((k) => k + 1);
      setStage('running');
    } catch {
      toast.error('Could not start the run. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const leaveRun = async () => {
    if (!(await flushSave())) return;
    if (detail) await openSet(detail.id);
    else setStage('set');
  };

  const submitting = useRef(false);
  const finish = async (answers: { id: string; answer: string }[], durationSec: number) => {
    if (!detail || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    // Anything typed in the last moments is saved first, so a failed hand-in
    // still leaves the run resumable.
    await flushSave();
    let res: Awaited<ReturnType<typeof submitAttempt>>;
    try {
      res = await submitAttempt({
        setId: detail.id,
        mode: runnerMode,
        answers,
        durationSec,
      });
    } catch {
      res = { error: 'Could not reach the marker. Your answers are saved - try handing in again.' };
    } finally {
      setBusy(false);
      submitting.current = false;
    }

    if ('error' in res) {
      toast.error(res.error);
      return;
    }
    saveQueue.clear();
    setDraft(null);
    setResult(res);
    setStage('results');
    router.refresh();
    // Refresh the attempts list behind the results, so "Back to the set"
    // shows this attempt.
    const reloaded = await getStudySet(detail.id);
    if (reloaded) setDetail(reloaded);
  };

  if (stage === 'configure') {
    return (
      <PracticeBuilder
        key={configSubject ?? ''}
        subjects={subjects}
        initialSubject={configSubject}
        aiReady={aiReady}
        doc={doc}
        setDoc={setDoc}
        onBack={toLibrary}
        onGenerating={(subject) => { setWritingSubject(subject); setStage('generating'); }}
        onDone={async (setId) => {
          setDoc(null);
          await openSet(setId);
          router.refresh();
        }}
        onFailed={() => setStage('configure')}
      />
    );
  }

  if (stage === 'generating') return <PracticeWriting doc={doc} subject={writingSubject} />;

  if (stage === 'set' && detail) {
    return (
      <SetOverview
        detail={detail}
        busy={busy}
        onBack={toLibrary}
        onStart={startRun}
        onCards={() => setStage('cards')}
        onMakeCards={async () => {
          setBusy(true);
          const res = await generateFlashcards(detail.id);
          setBusy(false);
          if ('error' in res) {
            toast.error(res.error);
            return;
          }
          toast.success(`${res.count} flashcards ready.`);
          await openSet(detail.id);
        }}
      />
    );
  }

  if (stage === 'running' && detail) {
    return (
      <PracticeWorkspace title={detail.title} subject={detail.subject} mode={MODE_LABEL[runnerMode]} saveStatus={saveStatus} busy={busy} onLeave={() => void leaveRun()} onRetry={() => void flushSave()}>
        <QuestionRunner key={runKey} items={detail.items} mode={runnerMode} initial={draft ?? undefined} onProgress={queueSave} busy={busy} onFinish={finish} />
      </PracticeWorkspace>
    );
  }

  if (stage === 'cards' && detail) {
    return (
      <PracticeWorkspace title={detail.title} subject={detail.subject} mode="Flashcards">
        <div className="mx-auto max-w-3xl"><FlashcardRunner setId={detail.id} cards={detail.cards} onDone={async () => { await openSet(detail.id); }} /></div>
      </PracticeWorkspace>
    );
  }

  if (stage === 'results' && result && detail) {
    return (
      <Results
        result={result}
        onRemarked={(next) => setResult((prev) => (prev ? { ...prev, ...next } : prev))}
        detail={detail}
        mode={runnerMode}
        onRetake={() => startRun(runnerMode)}
        onSet={() => setStage('set')}
        onNewSet={() => toConfigure(detail.subject)}
        onLibrary={toLibrary}
      />
    );
  }

  return (
    <LibraryView
      sets={sets}
      aiReady={aiReady}
      busy={busy}
      missingSet={missingSet && !detail}
      onNew={() => toConfigure(null)}
      onOpen={openSet}
    />
  );
}
