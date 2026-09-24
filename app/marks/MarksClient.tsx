"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Award, Download, Plus, PlusCircle, Target, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Page, PageBody } from "@/components/ui/page";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsArchived } from "@/components/ArchiveContext";
import { deleteReportCard } from "@/lib/marks-actions";
import { AddGradeDialog, CreateTermDialog, UploadReportDialog } from "./MarksDialogs";
import { GradeRow } from "./GradeRow";
import { TermOverview } from "./TermOverview";
import { exportReportCardPdf, subjectKey, type GoalTarget, type ReportCardType } from "./marks-model";

export function MarksClient({
  initialReportCards,
  currentTermSetting,
  subjects = [],
  goals = [],
}: {
  initialReportCards: ReportCardType[];
  currentTermSetting: string;
  subjects?: { id: string; name: string }[];
  goals?: GoalTarget[];
}) {
  // A finished year's report cards are a record: viewable, not editable.
  const archived = useIsArchived();
  const [selectedTerm, setSelectedTerm] = useState(currentTermSetting);
  const [createOpen, setCreateOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [addGradeOpen, setAddGradeOpen] = useState(false);

  const availableTerms = useMemo(() => {
    const terms = Array.from(new Set(initialReportCards.map((rc) => rc.term)));
    if (!terms.includes(currentTermSetting)) terms.push(currentTermSetting);
    return terms.sort();
  }, [initialReportCards, currentTermSetting]);

  const activeReportCard = initialReportCards.find((rc) => rc.term === selectedTerm);

  const targets = useMemo(() => {
    const map = new Map<string, number>();
    goals.forEach((g) => map.set(subjectKey(g.subject), g.targetGrade));
    return map;
  }, [goals]);

  const handleDeleteTerm = async (id: string) => {
    if (!confirm(`Delete ${selectedTerm}? Every mark on it is deleted too.`)) return;
    try {
      const result = await deleteReportCard(id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`${selectedTerm} deleted.`);
      const remaining = availableTerms.filter((t) => t !== selectedTerm);
      if (remaining.length > 0) setSelectedTerm(remaining[0]);
    } catch {
      toast.error("The term could not be deleted. Try again.");
    }
  };

  return (
    <Page>
      <PageHeader
        title="Marks"
        description="Your report cards, term by term, with each subject's mark and how to improve it."
        actions={
          <>
            <Button asChild variant="outline" size="lg">
              <Link href="/goals">
                <Target />
                Goals
              </Link>
            </Button>
            {!archived && (
              <>
                <Button variant="outline" size="lg" onClick={() => setCreateOpen(true)}>
                  <PlusCircle />
                  New term
                </Button>
                <Button size="lg" onClick={() => setUploadOpen(true)}>
                  <Upload />
                  Scan report card
                </Button>
              </>
            )}
          </>
        }
      />

      <PageBody>
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="marks-term" className="sr-only">Term</label>
          <Select value={selectedTerm} onValueChange={setSelectedTerm}>
            <SelectTrigger id="marks-term" className="h-9 w-full rounded-xl font-semibold sm:w-56">
              <SelectValue placeholder="Choose a term" />
            </SelectTrigger>
            <SelectContent>
              {availableTerms.map((term) => (
                <SelectItem key={term} value={term}>
                  {term}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {activeReportCard && (
            <>
              <Button variant="outline" onClick={() => exportReportCardPdf(activeReportCard, selectedTerm)}>
                <Download />
                Download PDF
              </Button>
              {!archived && (
                <Button
                  variant="ghost"
                  onClick={() => handleDeleteTerm(activeReportCard.id)}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 />
                  Delete term
                </Button>
              )}
            </>
          )}
        </div>

        {!activeReportCard ? (
          <EmptyState
            icon={<Award />}
            title={`No marks for ${selectedTerm} yet`}
            description={
              archived
                ? "No report card was added for this term."
                : "Scan the term's report card and the marks are read off it, or start the term and add each subject yourself."
            }
            action={
              archived ? undefined : (
                <>
                  <Button onClick={() => setUploadOpen(true)}>
                    <Upload />
                    Scan report card
                  </Button>
                  <Button variant="outline" onClick={() => setCreateOpen(true)}>
                    Add marks by hand
                  </Button>
                </>
              )
            }
          />
        ) : (
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <TermOverview card={activeReportCard} allCards={initialReportCards} />
            </div>

            <Section
              title="Subjects"
              description={
                goals.length > 0
                  ? "Open a subject for its note, its target from Goals and a practice set."
                  : "Open a subject for its note and a practice set."
              }
              actions={
                !archived ? (
                  <Button onClick={() => setAddGradeOpen(true)}>
                    <Plus />
                    Add subject
                  </Button>
                ) : undefined
              }
              className="lg:col-span-7"
            >
              {activeReportCard.grades.length === 0 ? (
                <EmptyState
                  title="No subjects on this report card"
                  description={archived ? "This term was started but no marks were added." : "Add each subject's mark to see this term's average."}
                  action={
                    archived ? undefined : (
                      <Button onClick={() => setAddGradeOpen(true)}>
                        <Plus />
                        Add subject
                      </Button>
                    )
                  }
                />
              ) : (
                <div className="space-y-3">
                  {activeReportCard.grades.map((grade) => (
                    <GradeRow
                      key={grade.id}
                      grade={grade}
                      target={targets.get(subjectKey(grade.subject))}
                      subjects={subjects}
                      readOnly={archived}
                    />
                  ))}
                  {goals.length === 0 && (
                    <p className="pt-2 text-sm text-muted-foreground">
                      Know what you are aiming for?{" "}
                      <Link href="/goals" className="font-medium text-primary hover:underline">
                        Set a target for each subject
                      </Link>
                      .
                    </p>
                  )}
                </div>
              )}
            </Section>
          </div>
        )}
      </PageBody>

      {!archived && (
        <>
          <CreateTermDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={setSelectedTerm} />
          <UploadReportDialog
            open={uploadOpen}
            onOpenChange={setUploadOpen}
            defaultTerm={currentTermSetting}
            onUploaded={setSelectedTerm}
          />
          {activeReportCard && (
            <AddGradeDialog
              open={addGradeOpen}
              onOpenChange={setAddGradeOpen}
              reportCardId={activeReportCard.id}
              subjects={subjects}
            />
          )}
        </>
      )}
    </Page>
  );
}
