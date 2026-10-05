import { Segmented, type SegmentedOption } from "@/app/insights/Segmented";

/**
 * Two views of one page, switched by the URL (?view=...), so each view stays
 * server-rendered and a reload or a link lands on the right one. Used where two
 * pages were merged: History (completed work / overview) and Marks (report
 * cards / goals).
 */
export function PageTabs({ label, value, options }: { label: string; value: string; options: SegmentedOption[] }) {
  return (
    <div className="px-4 pt-6 md:px-8">
      <Segmented label={label} value={value} options={options} />
    </div>
  );
}

export function historyTabs(view: "log" | "overview") {
  return (
    <PageTabs
      label="History view"
      value={view}
      options={[
        { value: "log", label: "Completed work", href: "/history" },
        { value: "overview", label: "Overview", href: "/history?view=overview" },
      ]}
    />
  );
}

export function marksTabs(view: "marks" | "goals") {
  return (
    <PageTabs
      label="Marks view"
      value={view}
      options={[
        { value: "marks", label: "Report cards", href: "/marks" },
        { value: "goals", label: "Goals", href: "/marks?view=goals" },
      ]}
    />
  );
}
