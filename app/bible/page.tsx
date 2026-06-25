'use client';

import { useEffect, useState } from 'react';
import { Book, Bookmark, History, ArrowLeft, Trash2, Calendar, Quote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

type Verse = {
  text: string;
  ref: string;
  savedAt?: string;
  shownAt?: string;
};

export default function BiblePage() {
  const [activeTab, setActiveTab] = useState<'saved' | 'history'>('saved');
  const [savedVerses, setSavedVerses] = useState<Verse[]>([]);
  const [historyVerses, setHistoryVerses] = useState<Verse[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Load data from localStorage
    const loadData = () => {
      try {
        const saved = localStorage.getItem('study-flow-bible-bookmarked');
        if (saved) {
          setSavedVerses(JSON.parse(saved));
        }

        const history = localStorage.getItem('study-flow-bible-history');
        if (history) {
          setHistoryVerses(JSON.parse(history));
        }
      } catch (e) {
        console.error("Failed to load bible data", e);
      }
    };

    loadData();
  }, []);

  const removeBookmark = (ref: string) => {
    try {
      const updated = savedVerses.filter(v => v.ref !== ref);
      setSavedVerses(updated);
      localStorage.setItem('study-flow-bible-bookmarked', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  const clearHistory = () => {
    if (confirm("Are you sure you want to clear your daily verses history?")) {
      try {
        setHistoryVerses([]);
        localStorage.removeItem('study-flow-bible-history');
      } catch (e) {
        console.error(e);
      }
    }
  };

  if (!mounted) return null;

  return (
    <div className="flex flex-col space-y-8 max-w-[1200px] mx-auto pb-16 px-4 md:px-8 pt-8">
      {/* Top Header Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <Link href="/" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors mb-2">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </Link>
          <h1 className="text-5xl font-heading font-black tracking-tight text-foreground flex items-center gap-3">
            <Book className="w-10 h-10 text-primary" /> Scriptures & Wisdom
          </h1>
          <p className="text-muted-foreground font-medium">Your personal repository of encouragement and spiritual guidance.</p>
        </div>

        {/* Tab Selection Switcher */}
        <div className="flex bg-muted/60 p-1.5 rounded-2xl border border-border/40 shrink-0 self-start md:self-center">
          <button
            onClick={() => setActiveTab('saved')}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all",
              activeTab === 'saved'
                ? "bg-card text-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Bookmark className="w-4 h-4" /> Saved Verses
            {savedVerses.length > 0 && (
              <span className="ml-1 text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-black">
                {savedVerses.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all",
              activeTab === 'history'
                ? "bg-card text-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <History className="w-4 h-4" /> History
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'saved' ? (
          <div className="space-y-6">
            {savedVerses.length === 0 ? (
              <div className="text-center py-20 bg-card border border-border/40 rounded-[32px] p-8 space-y-4 max-w-xl mx-auto shadow-sm">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto border border-primary/20 text-primary mb-4">
                  <Bookmark className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black">No bookmarked verses yet</h3>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                  Click the bookmark button in the upper-right corner of the Daily Quote card on your dashboard to save encouraging scriptures here.
                </p>
                <div className="pt-2">
                  <Link href="/">
                    <Button className="rounded-xl font-bold">Go to Dashboard</Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <AnimatePresence mode="popLayout">
                  {savedVerses.map((verse) => (
                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 300, damping: 28 }}
                      key={verse.ref}
                      className="bg-card border border-border/60 border-l-4 border-l-primary p-6 sm:p-8 rounded-[28px] shadow-sm relative overflow-hidden flex flex-col justify-between hover:shadow-md hover:-translate-y-0.5 transition-all group"
                    >
                      <div className="absolute right-4 top-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeBookmark(verse.ref)}
                          className="h-9 w-9 rounded-xl hover:bg-destructive/10 hover:text-destructive text-muted-foreground/60 transition-colors"
                          title="Remove Bookmark"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="space-y-4 pr-6">
                        <Quote className="w-8 h-8 text-primary/15 shrink-0" />
                        <blockquote className="italic text-muted-foreground text-lg leading-relaxed">
                          &quot;{verse.text}&quot;
                        </blockquote>
                      </div>

                      <div className="mt-6 pt-4 border-t border-border/40 flex items-center justify-between flex-wrap gap-2 text-xs font-bold text-muted-foreground">
                        <span className="text-foreground font-black text-sm flex items-center gap-1.5">
                          <span className="w-3.5 h-[2px] bg-primary rounded-full"></span>
                          {verse.ref}
                        </span>
                        {verse.savedAt && (
                          <span className="flex items-center gap-1 opacity-70">
                            <Calendar className="w-3.5 h-3.5" />
                            Saved {new Date(verse.savedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-muted-foreground uppercase tracking-widest px-1">Daily Verses History</h2>
              {historyVerses.length > 0 && (
                <Button onClick={clearHistory} variant="ghost" size="sm" className="text-xs font-bold hover:bg-destructive/10 hover:text-destructive text-muted-foreground/60 gap-1.5 rounded-xl">
                  <Trash2 className="w-3.5 h-3.5" /> Clear History
                </Button>
              )}
            </div>

            {historyVerses.length === 0 ? (
              <div className="text-center py-20 bg-card border border-border/40 rounded-[32px] p-8 space-y-4 max-w-xl mx-auto shadow-sm">
                <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto border border-border/60 text-muted-foreground/60 mb-4">
                  <History className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black">History is empty</h3>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                  As the daily scriptures rotate on your dashboard over time, they will automatically be recorded here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {historyVerses.map((verse, index) => (
                  <div 
                    key={`${verse.ref}-${index}`}
                    className="bg-card border border-border/40 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-border/80 transition-colors shadow-sm"
                  >
                    <div className="space-y-2 flex-1">
                      <blockquote className="italic text-muted-foreground text-base leading-relaxed">
                        &quot;{verse.text}&quot;
                      </blockquote>
                      <p className="text-sm font-black text-foreground flex items-center gap-1.5">
                        <span className="w-3 h-[2px] bg-primary/60 rounded-full"></span>
                        {verse.ref}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-4 border-t md:border-t-0 pt-4 md:pt-0 border-border/40 shrink-0 text-xs font-bold text-muted-foreground">
                      {verse.shownAt && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          Shown {new Date(verse.shownAt).toLocaleDateString()} at {new Date(verse.shownAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
