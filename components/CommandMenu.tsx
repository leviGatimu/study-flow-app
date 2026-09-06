"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  Brain,
  BookOpen,
  FileText,
  FolderOpen,
  GraduationCap,
  Layers,
  Library,
  Loader2,
  StickyNote,
  TrendingUp,
  Zap,
} from "lucide-react";
import { universalSearch } from "@/lib/actions";
import { NAV_LEAVES } from "@/lib/nav";

const OPEN_EVENT = "studyflow:open-command-menu";

/**
 * Open the command palette from anywhere (the header search field, a button,
 * a keyboard shortcut) without threading a context through the tree. The
 * palette is a singleton mounted once in the app shell.
 */
export function openCommandMenu() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

type Results = {
  tasks: any[];
  stickyNotes: any[];
  tutorModules: any[];
  projects: any[];
  homeworks: any[];
  subjects: any[];
  exams: any[];
  resources: any[];
  notes: any[];
  marks: any[];
};

const EMPTY: Results = {
  tasks: [],
  stickyNotes: [],
  tutorModules: [],
  projects: [],
  homeworks: [],
  subjects: [],
  exams: [],
  resources: [],
  notes: [],
  marks: [],
};

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Results>(EMPTY);
  const router = useRouter();

  // Ctrl/Cmd+K is the near-universal binding for this. Ctrl/Cmd+E is kept as an
  // alias because that is what the app used to advertise.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if ((key === "k" || key === "e") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    const onOpen = () => setOpen(true);

    document.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  // Debounced search. The timer lives in a ref so re-renders cannot strand a
  // pending callback (the previous implementation memoised a debounced
  // function with an empty dep list, which captured stale state).
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestQuery = useRef("");

  useEffect(() => {
    const trimmed = query.trim();
    latestQuery.current = trimmed;

    if (timer.current) clearTimeout(timer.current);

    if (trimmed.length < 2) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }

    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await universalSearch(trimmed);
        // Ignore responses that arrived after the query moved on.
        if (latestQuery.current === trimmed) setResults(res as Results);
      } finally {
        if (latestQuery.current === trimmed) setLoading(false);
      }
    }, 250);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query]);

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  const hasResults = useMemo(
    () => Object.values(results).some((group) => group.length > 0),
    [results]
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <div className="relative">
        <CommandInput
          placeholder="Search tasks, notes, subjects..."
          value={query}
          onValueChange={setQuery}
        />
        {loading && (
          <div className="absolute top-1/2 right-4 -translate-y-1/2">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      <CommandList className="max-h-[400px]">
        <CommandEmpty>{loading ? "Searching..." : "No results found."}</CommandEmpty>

        {results.homeworks.length > 0 && (
          <CommandGroup heading="Homework">
            {results.homeworks.map((hw) => (
              <CommandItem
                key={hw.id}
                value={`homework-${hw.id}-${hw.title}`}
                onSelect={() => go("/homeworks")}
              >
                <BookOpen className="mr-2 size-4 text-muted-foreground" />
                <span className="truncate">{hw.title}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {hw.subject}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.tutorModules.length > 0 && (
          <CommandGroup heading="Tutor Modules">
            {results.tutorModules.map((m) => (
              <CommandItem
                key={m.id}
                value={`module-${m.id}-${m.title}`}
                onSelect={() => go(`/tutor/${m.id}`)}
              >
                <Brain className="mr-2 size-4 text-muted-foreground" />
                <span className="truncate">{m.title}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {m.subject}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.tasks.length > 0 && (
          <CommandGroup heading="Tasks">
            {results.tasks.map((t) => (
              <CommandItem
                key={t.id}
                value={`task-${t.id}-${t.subject}`}
                onSelect={() => go("/")}
              >
                <Zap className="mr-2 size-4 text-muted-foreground" />
                <span className="truncate">{t.subject}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.stickyNotes.length > 0 && (
          <CommandGroup heading="Sticky Notes">
            {results.stickyNotes.map((n) => (
              <CommandItem
                key={n.id}
                value={`note-${n.id}-${n.title}`}
                onSelect={() => go("/notes")}
              >
                <StickyNote className="mr-2 size-4 text-muted-foreground" />
                <span className="truncate">{n.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.projects.length > 0 && (
          <CommandGroup heading="Projects">
            {results.projects.map((p) => (
              <CommandItem
                key={p.id}
                value={`project-${p.id}-${p.title}`}
                onSelect={() => go(`/projects/${p.id}`)}
              >
                <FolderOpen className="mr-2 size-4 text-muted-foreground" />
                <span className="truncate">{p.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.subjects.length > 0 && (
          <CommandGroup heading="Subjects">
            {results.subjects.map((s) => (
              <CommandItem
                key={s.id}
                value={`subject-${s.id}-${s.name}`}
                onSelect={() => go("/subjects")}
              >
                <Library className="mr-2 size-4 text-muted-foreground" />
                <span className="truncate">{s.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.exams.length > 0 && (
          <CommandGroup heading="Exams">
            {results.exams.map((e) => (
              <CommandItem
                key={e.id}
                value={`exam-${e.id}-${e.title}`}
                onSelect={() => go(`/exams/${e.id}`)}
              >
                <GraduationCap className="mr-2 size-4 text-muted-foreground" />
                <span className="truncate">{e.title}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {e.subject?.name ?? new Date(e.date).toLocaleDateString()}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.resources.length > 0 && (
          <CommandGroup heading="Resources">
            {results.resources.map((r) => (
              <CommandItem
                key={r.id}
                value={`resource-${r.id}-${r.title}`}
                onSelect={() => go(`/resources/${encodeURIComponent(r.subject)}`)}
              >
                <Layers className="mr-2 size-4 text-muted-foreground" />
                <span className="truncate">{r.title}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {r.subject}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.notes.length > 0 && (
          <CommandGroup heading="Subject Notes">
            {results.notes.map((n) => (
              <CommandItem
                key={n.id}
                value={`studionote-${n.id}-${n.subject}`}
                onSelect={() => go("/subjects")}
              >
                <FileText className="mr-2 size-4 text-muted-foreground" />
                <span className="truncate">{n.subject}</span>
                <span className="ml-auto shrink-0 max-w-[50%] truncate text-xs text-muted-foreground">
                  {n.content}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results.marks.length > 0 && (
          <CommandGroup heading="Marks">
            {results.marks.map((m) => (
              <CommandItem
                key={m.id}
                value={`mark-${m.id}-${m.subject}`}
                onSelect={() => go("/marks")}
              >
                <TrendingUp className="mr-2 size-4 text-muted-foreground" />
                <span className="truncate">{m.subject}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {m.grade} · {m.reportCard?.term}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {hasResults && <CommandSeparator />}

        {/* Every destination in the app, from the same source the sidebar uses.
            This is what makes a six-item sidebar safe: nothing is unreachable. */}
        <CommandGroup heading="Go to">
          {NAV_LEAVES.map((leaf) => {
            const Icon = leaf.icon;
            return (
              <CommandItem
                key={leaf.href}
                value={`${leaf.name} ${leaf.keywords ?? ""}`}
                onSelect={() => go(leaf.href)}
              >
                <Icon className="mr-2 size-4 text-muted-foreground" />
                <span>{leaf.name}</span>
              </CommandItem>
            );
          })}
          <CommandItem value="Focus mode concentrate timer" onSelect={() => go("/focus")}>
            <Zap className="mr-2 size-4 text-muted-foreground" />
            <span>Focus Mode</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
