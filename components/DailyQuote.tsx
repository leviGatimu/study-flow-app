'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bookmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { getVerseText } from '@/lib/verse-actions';
import { fallbackVerseForHour, verseRefForHour, type Verse } from '@/lib/verses';

/** Verse texts already fetched, by reference, so each is fetched once per device. */
const TEXT_KEY = 'study-flow-verse-text';
const HISTORY_KEY = 'study-flow-bible-history';

function readTexts(): Record<string, string> {
  try {
    const saved = JSON.parse(localStorage.getItem(TEXT_KEY) ?? '{}');
    return saved && typeof saved === 'object' ? saved : {};
  } catch {
    return {};
  }
}

function keepText(verse: Verse) {
  try {
    localStorage.setItem(TEXT_KEY, JSON.stringify({ ...readTexts(), [verse.ref]: verse.text }));
  } catch {
    // Storage full or blocked: the verse is fetched again next time.
  }
}

/** Shown verses, newest first, for the Bible page's history. */
function addToHistory(verse: Verse) {
  try {
    const history: { ref: string }[] = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
    if (history.some((h) => h.ref === verse.ref)) return;
    const next = [{ text: verse.text, ref: verse.ref, shownAt: new Date().toISOString() }, ...history];
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next.slice(0, 50)));
  } catch (e) {
    console.error('Failed to update bible history', e);
  }
}

/** This hour's verse: from this device's store, else bible-api.com, else a built-in one. */
async function verseForHour(hour: number): Promise<Verse> {
  const ref = verseRefForHour(hour);
  const kept = readTexts()[ref];
  if (kept) return { ref, text: kept };
  const fetched = await getVerseText(ref).catch(() => null);
  if (fetched) {
    keepText(fetched);
    return fetched;
  }
  return fallbackVerseForHour(hour);
}

export function DailyQuote() {
  const [verse, setVerse] = useState<Verse | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

  useEffect(() => {
    setMounted(true);
    let shownHour = -1;
    let cancelled = false;

    // Checked every minute; only a new hour brings a new verse.
    const update = async () => {
      const hour = Math.floor(Date.now() / (1000 * 60 * 60));
      if (hour === shownHour) return;
      shownHour = hour;
      const next = await verseForHour(hour);
      if (cancelled) return;
      setVerse(next);
      addToHistory(next);
    };

    void update();
    const interval = setInterval(update, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (mounted && verse) {
      try {
        const savedBookmarked = localStorage.getItem('study-flow-bible-bookmarked');
        const bookmarkedList = savedBookmarked ? JSON.parse(savedBookmarked) : [];
        setIsBookmarked(bookmarkedList.some((b: { ref: string }) => b.ref === verse.ref));
      } catch {
        // Fallback
      }
    }
  }, [verse, mounted]);

  const toggleBookmark = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!verse) return;

    try {
      const savedBookmarked = localStorage.getItem('study-flow-bible-bookmarked');
      let bookmarkedList = savedBookmarked ? JSON.parse(savedBookmarked) : [];
      
      let nextState = false;
      if (isBookmarked) {
        bookmarkedList = bookmarkedList.filter((b: { ref: string }) => b.ref !== verse.ref);
        nextState = false;
      } else {
        bookmarkedList.push({ text: verse.text, ref: verse.ref, savedAt: new Date().toISOString() });
        nextState = true;
      }
      localStorage.setItem('study-flow-bible-bookmarked', JSON.stringify(bookmarkedList));
      setIsBookmarked(nextState);
    } catch (err) {
      console.error(err);
    }
  };

  if (!mounted || !verse) return null;

  // The card links to the reader; the bookmark sits beside the link rather
  // than inside it, so it is its own control and not a button nested in an <a>.
  return (
    <div className="blur-in relative">
      <Link
        href="/bible"
        className="block bg-card border border-border/60 border-l-4 border-l-primary p-6 sm:p-8 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <blockquote key={verse.ref} className="blur-in italic text-muted-foreground text-lg leading-relaxed pr-10">
          &quot;{verse.text}&quot;
          <footer className="mt-4 text-sm font-bold text-foreground/80 not-italic flex items-center gap-2">
            <span aria-hidden className="w-4 h-0.5 bg-primary rounded-full"></span> {verse.ref}
          </footer>
        </blockquote>
      </Link>

      <Button
        variant="ghost"
        size="icon"
        onClick={toggleBookmark}
        aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this verse'}
        aria-pressed={isBookmarked}
        className={cn(
          "absolute top-4 right-4 size-9 rounded-xl hover:bg-muted",
          isBookmarked ? "text-primary" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Bookmark key={String(isBookmarked)} className={cn("size-5", isBookmarked && "fill-current bookmark-pop")} />
      </Button>
    </div>
  );
}

