"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Home,
  Calendar,
  CheckCircle,
  Settings,
  FolderOpen,
  FileText,
  LayoutGrid,
  BrainCircuit,
  Zap,
  StickyNote,
  Brain,
  Search,
  Loader2,
  BookOpen,
  Activity
} from "lucide-react";
import { universalSearch } from "@/lib/actions";

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    tasks: any[];
    stickyNotes: any[];
    tutorModules: any[];
    projects: any[];
    homeworks: any[];
  }>({ tasks: [], stickyNotes: [], tutorModules: [], projects: [], homeworks: [] });

  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "e" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSearch = useCallback(
    debounce(async (q: string) => {
      if (q.length < 2) {
        setResults({ tasks: [], stickyNotes: [], tutorModules: [], projects: [], homeworks: [] });
        setLoading(false);
        return;
      }
      const res = await universalSearch(q);
      setResults(res as any);
      setLoading(false);
    }, 300),
    []
  );

  useEffect(() => {
    if (query) {
      setLoading(true);
      handleSearch(query);
    } else {
      setResults({ tasks: [], stickyNotes: [], tutorModules: [], projects: [], homeworks: [] });
      setLoading(false);
    }
  }, [query, handleSearch]);

  const runCommand = (command: () => void) => {
    setOpen(false);
    setQuery("");
    command();
  };

  const hasResults = results.tasks.length > 0 || results.stickyNotes.length > 0 || results.tutorModules.length > 0 || results.projects.length > 0 || results.homeworks.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <div className="relative">
        <CommandInput 
          placeholder="Search everything (tasks, notes, tutor modules...)" 
          value={query}
          onValueChange={setQuery}
        />
        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
      <CommandList className="max-h-[400px]">
        <CommandEmpty>{loading ? "Searching..." : "No results found."}</CommandEmpty>
        
        {/* UNIVERSAL RESULTS */}
        {results.homeworks.length > 0 && (
          <CommandGroup heading="Homework Vault">
            {results.homeworks.map((hw) => (
              <CommandItem key={hw.id} onSelect={() => runCommand(() => router.push(`/homeworks`))}>
                <BookOpen className="mr-2 h-4 w-4 text-primary" />
                <div className="flex flex-col">
                  <span className="font-bold">{hw.title}</span>
                  <span className="text-[10px] uppercase text-muted-foreground">{hw.subject}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.tutorModules.length > 0 && (
          <CommandGroup heading="AI Tutor Modules">
            {results.tutorModules.map((m) => (
              <CommandItem key={m.id} onSelect={() => runCommand(() => router.push(`/tutor/${m.id}`))}>
                <Brain className="mr-2 h-4 w-4 text-primary" />
                <div className="flex flex-col">
                  <span className="font-bold">{m.title}</span>
                  <span className="text-[10px] uppercase text-muted-foreground">{m.subject}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.stickyNotes.length > 0 && (
          <CommandGroup heading="Sticky Notes">
            {results.stickyNotes.map((n) => (
              <CommandItem key={n.id} onSelect={() => runCommand(() => router.push(`/notes`))}>
                <StickyNote className="mr-2 h-4 w-4 text-amber-500" />
                <span>{n.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.tasks.length > 0 && (
          <CommandGroup heading="Scheduled Tasks">
            {results.tasks.map((t) => (
              <CommandItem key={t.id} onSelect={() => runCommand(() => router.push(`/`))}>
                <Zap className="mr-2 h-4 w-4 text-blue-500" />
                <span>{t.subject}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.projects.length > 0 && (
          <CommandGroup heading="Projects">
            {results.projects.map((p) => (
              <CommandItem key={p.id} onSelect={() => runCommand(() => router.push(`/projects/${p.id}`))}>
                <FolderOpen className="mr-2 h-4 w-4 text-purple-500" />
                <span>{p.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {!query && (
          <>
            <CommandGroup heading="Quick Navigation">
              <CommandItem onSelect={() => runCommand(() => router.push("/"))}>
                <Home className="mr-2 h-4 w-4" />
                <span>Dashboard</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => router.push("/homeworks"))}>
                <BookOpen className="mr-2 h-4 w-4" />
                <span>Homework Vault</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => router.push("/tutor"))}>
                <Brain className="mr-2 h-4 w-4" />
                <span>AI Tutor Hub</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => router.push("/focus"))}>
                <Zap className="mr-2 h-4 w-4" />
                <span>Focus Mode</span>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Tools">
              <CommandItem onSelect={() => runCommand(() => router.push("/insights"))}>
                <Activity className="mr-2 h-4 w-4" />
                <span>Insights</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => router.push("/summaries"))}>
                <FileText className="mr-2 h-4 w-4" />
                <span>Weekly Summaries</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => router.push("/settings"))}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

// Simple debounce if lodash isn't there
function debounce(fn: Function, ms: number) {
  let timeoutId: ReturnType<typeof setTimeout>;
  return function(this: any, ...args: any[]) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), ms);
  };
}
