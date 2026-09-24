'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CheckCircle2, Plus, Target, TrendingUp } from 'lucide-react';
import { deleteGoal } from '@/lib/goal-actions';
import { useIsArchived } from '@/components/ArchiveContext';
import { Button } from '@/components/ui/button';
import { Page, PageBody } from '@/components/ui/page';
import { PageHeader } from '@/components/ui/page-header';
import { Panel } from '@/components/ui/panel';
import { Section } from '@/components/ui/section';
import { Stat } from '@/components/ui/stat';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import {
  buildSubjectStandings,
  currentAverage,
  currentGradeFor,
  type GoalType,
  type ReportCardType,
} from './goals-model';
import { GoalForm, GOAL_SUBJECT_FIELD_ID } from './GoalForm';
import { GoalCard } from './GoalCard';

interface GoalsClientProps {
  initialReportCards: ReportCardType[];
  initialGoals: GoalType[];
  uniqueSubjects: string[];
}

export function GoalsClient({ initialReportCards, initialGoals, uniqueSubjects }: GoalsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // A finished year's targets are a record, not something to set.
  const archived = useIsArchived();
  const [editingGoal, setEditingGoal] = useState<GoalType | null>(null);

  const standings = useMemo(
    () => buildSubjectStandings(initialReportCards, uniqueSubjects),
    [initialReportCards, uniqueSubjects]
  );
  const average = useMemo(() => currentAverage(initialReportCards, standings), [initialReportCards, standings]);
  const targetAverage =
    initialGoals.length === 0
      ? null
      : parseFloat((initialGoals.reduce((acc, g) => acc + g.targetGrade, 0) / initialGoals.length).toFixed(1));
  const metCount = initialGoals.filter((g) => {
    const current = currentGradeFor(standings, g.subject);
    return current !== undefined && current >= g.targetGrade;
  }).length;

  const focusForm = () => {
    const field = document.getElementById(GOAL_SUBJECT_FIELD_ID);
    field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    field?.focus();
  };

  const handleDelete = (goal: GoalType) => {
    if (!confirm(`Delete the target for ${goal.subject}?`)) return;
    startTransition(async () => {
      try {
        const res = await deleteGoal(goal.id);
        if (res.success) {
          toast.success('Target removed.');
          if (editingGoal?.id === goal.id) setEditingGoal(null);
          router.refresh();
        }
      } catch {
        toast.error('The target could not be deleted. Try again.');
      }
    });
  };

  return (
    <Page>
      <PageHeader
        title="Goals"
        description="A target mark for each subject, next to your latest mark from Marks."
        actions={
          <>
            <Button asChild variant="outline" size="lg">
              <Link href="/marks">
                <TrendingUp />
                Marks
              </Link>
            </Button>
            {!archived && (
              <Button size="lg" onClick={() => { setEditingGoal(null); requestAnimationFrame(focusForm); }}>
                <Plus />
                Add target
              </Button>
            )}
          </>
        }
      />

      <PageBody>
        {initialGoals.length > 0 && (
          <Panel className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3">
            <Stat
              icon={<TrendingUp />}
              label="Latest average"
              value={average === null ? 'No marks' : `${average.toFixed(1)}%`}
              hint={average === null ? 'Add a report card in Marks' : 'From your newest report card'}
            />
            <Stat
              icon={<Target />}
              tone="primary"
              label="Average target"
              value={`${targetAverage?.toFixed(1)}%`}
              hint={
                average === null || targetAverage === null
                  ? `Across ${initialGoals.length} ${initialGoals.length === 1 ? 'subject' : 'subjects'}`
                  : average >= targetAverage
                    ? 'You are above it'
                    : `${(targetAverage - average).toFixed(1)}% above your average`
              }
            />
            <Stat
              icon={<CheckCircle2 />}
              tone={metCount === initialGoals.length ? 'success' : 'default'}
              label="Targets met"
              value={`${metCount} of ${initialGoals.length}`}
              hint="At or above target"
            />
          </Panel>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {!archived && (
            <div className="lg:col-span-4">
              <GoalForm
                key={editingGoal?.id ?? 'new'}
                standings={standings}
                goals={initialGoals}
                editing={editingGoal}
                onFinished={() => setEditingGoal(null)}
              />
            </div>
          )}

          <Section
            title="Your targets"
            className={cn(archived ? 'lg:col-span-12' : 'lg:col-span-8')}
          >
            {initialGoals.length === 0 ? (
              <EmptyState
                icon={<Target />}
                title="No targets yet"
                description={
                  archived
                    ? 'No targets were set in this year.'
                    : 'Pick a subject and a target mark in the form. Each target is compared with your latest mark.'
                }
                action={
                  archived ? undefined : (
                    <Button onClick={focusForm}>Add a target</Button>
                  )
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {initialGoals.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    current={currentGradeFor(standings, goal.subject)}
                    readOnly={archived}
                    busy={isPending}
                    onEdit={() => {
                      setEditingGoal(goal);
                      requestAnimationFrame(focusForm);
                    }}
                    onDelete={() => handleDelete(goal)}
                  />
                ))}
              </div>
            )}
          </Section>
        </div>
      </PageBody>
    </Page>
  );
}
