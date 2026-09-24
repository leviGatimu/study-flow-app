'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bookmark, Calendar, History, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Page, PageBody } from '@/components/ui/page';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmModal } from '@/components/ConfirmModal';

type Verse = {
  text: string;
  ref: string;
  savedAt?: string;
  shownAt?: string;
};

// Written by the dashboard's daily verse card (DailyQuote).
const SAVED_KEY = 'study-flow-bible-bookmarked';
const HISTORY_KEY = 'study-flow-bible-history';

function readList(key: string): Verse[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to read saved verses', e);
    return [];
  }
}

export default function BiblePage() {
  const [tab, setTab] = useState<'saved' | 'history'>('saved');
  const [savedVerses, setSavedVerses] = useState<Verse[]>([]);
  const [historyVerses, setHistoryVerses] = useState<Verse[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  // Both lists live in this browser's storage, which the server render cannot
  // see, so they are read after mount, and again if another tab changes them.
  useEffect(() => {
    const sync = () => {
      setSavedVerses(readList(SAVED_KEY));
      setHistoryVerses(readList(HISTORY_KEY));
      setLoaded(true);
    };
    sync();
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const removeBookmark = (ref: string) => {
    const updated = savedVerses.filter((v) => v.ref !== ref);
    setSavedVerses(updated);
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  const clearHistory = () => {
    setHistoryVerses([]);
    setConfirmClear(false);
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Page>
      <PageHeader
        title="Bible"
        description="Verses you saved from Today, and every daily verse you have been shown."
        actions={
          tab === 'history' &&
          historyVerses.length > 0 && (
            <Button
              variant="outline"
              size="lg"
              onClick={() => setConfirmClear(true)}
              className="hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 />
              Clear history
            </Button>
          )
        }
      />
      <PageBody>
        <Tabs value={tab} onValueChange={(value) => setTab(value as 'saved' | 'history')}>
          <TabsList>
            <TabsTrigger value="saved">
              <Bookmark />
              Saved{loaded && savedVerses.length > 0 ? ` (${savedVerses.length})` : ''}
            </TabsTrigger>
            <TabsTrigger value="history">
              <History />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="saved" className="mt-6">
            {!loaded ? (
              <VerseSkeleton />
            ) : savedVerses.length === 0 ? (
              <EmptyState
                icon={<Bookmark />}
                title="No saved verses yet"
                description="Press the bookmark on the daily verse card in Today to keep a verse here."
                action={
                  <Button asChild variant="outline">
                    <Link href="/">Go to Today</Link>
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {savedVerses.map((verse) => (
                  <Panel key={verse.ref} className="flex flex-col justify-between gap-6">
                    <div className="flex items-start justify-between gap-3">
                      <blockquote className="text-lg italic leading-relaxed text-muted-foreground">
                        &ldquo;{verse.text}&rdquo;
                      </blockquote>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeBookmark(verse.ref)}
                        className="-mr-2 -mt-1 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Remove ${verse.ref} from saved verses`}
                        title="Remove"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-4 text-xs font-medium text-muted-foreground">
                      <span className="text-sm font-bold text-foreground">{verse.ref}</span>
                      {verse.savedAt && (
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3.5" />
                          Saved {new Date(verse.savedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </Panel>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            {!loaded ? (
              <VerseSkeleton />
            ) : historyVerses.length === 0 ? (
              <EmptyState
                icon={<History />}
                title="No verses shown yet"
                description="Each day's verse on Today is recorded here once you have seen it."
                action={
                  <Button asChild variant="outline">
                    <Link href="/">Go to Today</Link>
                  </Button>
                }
              />
            ) : (
              <Panel>
                <ul className="space-y-3">
                  {historyVerses.map((verse, index) => (
                    <li
                      key={`${verse.ref}-${index}`}
                      className="flex flex-col justify-between gap-3 rounded-2xl border border-border/40 bg-muted/40 px-5 py-4 md:flex-row md:items-center md:gap-6"
                    >
                      <div className="min-w-0 space-y-1">
                        <blockquote className="italic leading-relaxed text-muted-foreground">
                          &ldquo;{verse.text}&rdquo;
                        </blockquote>
                        <p className="text-sm font-bold text-foreground">{verse.ref}</p>
                      </div>
                      {verse.shownAt && (
                        <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
                          <Calendar className="size-3.5" />
                          {new Date(verse.shownAt).toLocaleDateString()} at{' '}
                          {new Date(verse.shownAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </TabsContent>
        </Tabs>
      </PageBody>

      <ConfirmModal
        isOpen={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={clearHistory}
        title="Clear verse history?"
        description="The list of daily verses you have been shown will be emptied. Saved verses are kept."
      />
    </Page>
  );
}

function VerseSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-40 rounded-2xl" />
    </div>
  );
}
