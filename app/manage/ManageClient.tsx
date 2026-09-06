'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  Calendar as CalendarIcon,
  BookOpen,
  Repeat,
  Hourglass,
  CalendarRange,
  Flame,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ManageForm } from '@/components/ManageForm';
import { DeleteTemplateButton } from '@/components/DeleteTemplateButton';
import { EditTemplateForm } from '@/components/EditTemplateForm';

type TemplateType = {
  id: string;
  userId: string;
  dayOfWeek: number;
  subject: string;
  startTime: string;
  endTime: string;
  deadlineDay: string;
  type: string;
};

interface ManageClientProps {
  initialTemplates: TemplateType[];
  subjects: { id: string; name: string }[];
}

const DAYS_OF_WEEK = [
  { index: 1, name: 'Monday' },
  { index: 2, name: 'Tuesday' },
  { index: 3, name: 'Wednesday' },
  { index: 4, name: 'Thursday' },
  { index: 5, name: 'Friday' },
  { index: 6, name: 'Saturday' },
  { index: 0, name: 'Sunday' },
];

const FULL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const parseTimeToMinutes = (timeStr: string) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

const blockMinutes = (startStr: string, endStr: string) => {
  const start = parseTimeToMinutes(startStr);
  let end = parseTimeToMinutes(endStr);
  if (end < start) end += 24 * 60; // overnight blocks
  return end - start;
};

const formatMinutes = (mins: number) => {
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hrs > 0) return `${hrs}h${rem > 0 ? ` ${rem}m` : ''}`;
  return `${rem}m`;
};

export function ManageClient({ initialTemplates, subjects }: ManageClientProps) {
  // activeTab is 'all' or a day index (0-6)
  const [activeTab, setActiveTab] = useState<string | number>('all');

  const grouped = useMemo(() => {
    return initialTemplates.reduce((acc, curr) => {
      (acc[curr.dayOfWeek] ||= []).push(curr);
      return acc;
    }, {} as Record<number, TemplateType[]>);
  }, [initialTemplates]);

  const sortedGrouped = useMemo(() => {
    const result: Record<number, TemplateType[]> = {};
    Object.keys(grouped).forEach((key) => {
      const dayIndex = Number(key);
      result[dayIndex] = [...grouped[dayIndex]].sort(
        (a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime),
      );
    });
    return result;
  }, [grouped]);

  const stats = useMemo(() => {
    const totalBlocks = initialTemplates.length;
    const homeworkCount = initialTemplates.filter((t) => t.type === 'HOMEWORK').length;
    const revisionCount = initialTemplates.filter((t) => t.type === 'REVISION').length;

    const dayMinutes = [0, 0, 0, 0, 0, 0, 0];
    let totalMinutes = 0;
    initialTemplates.forEach((t) => {
      const mins = blockMinutes(t.startTime, t.endTime);
      totalMinutes += mins;
      dayMinutes[t.dayOfWeek] += mins;
    });

    const maxMins = Math.max(0, ...dayMinutes);
    const peakDayName = maxMins > 0 ? FULL_DAY_NAMES[dayMinutes.indexOf(maxMins)] : 'None';

    return {
      totalBlocks,
      homeworkCount,
      revisionCount,
      totalHoursStr: formatMinutes(totalMinutes),
      peakDayName,
      peakDayMins: maxMins,
    };
  }, [initialTemplates]);

  return (
    <div className="flex flex-col space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-500 pb-16 px-4 md:px-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-10">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight text-foreground">Manage Schedule</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl">
            Define and coordinate your recurring classes, homework sessions, and revision blocks.
          </p>
        </div>
        <div className="shrink-0">
          <ManageForm subjects={subjects} />
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Hourglass className="w-5 h-5" />}
          label="Weekly study time"
          value={stats.totalHoursStr}
        />
        <StatCard
          icon={<Layers className="w-5 h-5" />}
          label="Total blocks"
          value={`${stats.totalBlocks}`}
          sub={`${stats.homeworkCount} homework · ${stats.revisionCount} revision`}
        />
        <StatCard
          icon={<Flame className="w-5 h-5" />}
          label="Peak focus day"
          value={stats.peakDayName}
          sub={stats.peakDayMins > 0 ? formatMinutes(stats.peakDayMins) : undefined}
        />
        <StatCard
          icon={<Repeat className="w-5 h-5" />}
          label="Revision blocks"
          value={`${stats.revisionCount}`}
          sub={`of ${stats.totalBlocks} total`}
        />
      </div>

      {/* Day filter — segmented pills */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterPill
          active={activeTab === 'all'}
          onClick={() => setActiveTab('all')}
          icon={<CalendarRange className="w-3.5 h-3.5" />}
          label="All Days"
          count={stats.totalBlocks}
        />
        <div className="w-px h-6 bg-border/60 mx-1 hidden sm:block" />
        {DAYS_OF_WEEK.map((day) => (
          <FilterPill
            key={day.index}
            active={activeTab === day.index}
            onClick={() => setActiveTab(day.index)}
            label={day.name}
            count={(grouped[day.index] || []).length}
          />
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={String(activeTab)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="space-y-12"
        >
          {activeTab === 'all' ? (
            <>
              {DAYS_OF_WEEK.map((day) => {
                const dayTemplates = sortedGrouped[day.index] || [];
                if (dayTemplates.length === 0) return null;
                return (
                  <DaySection
                    key={day.index}
                    name={day.name}
                    templates={dayTemplates}
                    subjects={subjects}
                  />
                );
              })}
              {initialTemplates.length === 0 && (
                <EmptyState text="Your timetable is empty. Add a recurring study block to get started." />
              )}
            </>
          ) : (
            <DaySection
              name={FULL_DAY_NAMES[Number(activeTab)]}
              templates={sortedGrouped[Number(activeTab)] || []}
              subjects={subjects}
              emptyText='No study blocks scheduled for this day yet. Use "Add New Study Block" above to create one.'
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ---------- Day section ---------- */
function DaySection({
  name,
  templates,
  subjects,
  emptyText,
}: {
  name: string;
  templates: TemplateType[];
  subjects: { id: string; name: string }[];
  emptyText?: string;
}) {
  const totalMins = templates.reduce((sum, t) => sum + blockMinutes(t.startTime, t.endTime), 0);

  return (
    <section className="space-y-5">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-heading font-bold tracking-tight text-foreground">{name}</h2>
        {templates.length > 0 && (
          <span className="text-xs font-medium text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-full">
            {templates.length} block{templates.length > 1 ? 's' : ''} · {formatMinutes(totalMins)}
          </span>
        )}
        <div className="h-px flex-1 bg-gradient-to-r from-border/60 to-transparent ml-1" />
      </div>

      {templates.length === 0 ? (
        <EmptyState text={emptyText || 'No study blocks scheduled. Use "Add New Study Block" above to create one.'} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {templates.map((t) => (
            <TemplateCard key={t.id} template={t} subjects={subjects} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------- Template card ---------- */
function TemplateCard({
  template,
  subjects,
}: {
  template: TemplateType;
  subjects: { id: string; name: string }[];
}) {
  const isHomework = template.type === 'HOMEWORK';

  return (
    <div className="group relative overflow-hidden bg-card border border-border/60 shadow-sm rounded-2xl p-5 hover:shadow-md transition-shadow duration-200">
      {/* Left accent bar (homework = solid primary, revision = orange) */}
      <span
        className={cn(
          'absolute left-0 top-0 h-full w-1.5',
          isHomework ? 'bg-primary' : 'bg-orange-500',
        )}
      />
      {/* Watermark icon */}
      <div className="absolute -right-3 -bottom-3 opacity-[0.06] rotate-12 pointer-events-none">
        {isHomework ? <BookOpen size={96} /> : <Repeat size={96} />}
      </div>

      <div className="relative z-10 space-y-4 pl-2">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <span
            className={cn(
              'inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium',
              isHomework
                ? 'bg-primary/10 text-primary'
                : 'bg-orange-500/10 text-orange-600',
            )}
          >
            {isHomework ? 'Homework' : 'Revision'}
          </span>
          <div className="flex items-center -mt-1">
            <EditTemplateForm template={template} subjects={subjects} />
            <DeleteTemplateButton id={template.id} />
          </div>
        </div>

        {/* Subject */}
        <h3 className="text-base font-heading font-bold leading-snug text-foreground line-clamp-2">
          {template.subject}
        </h3>

        {/* Meta */}
        <div className="grid grid-cols-2 gap-2.5 text-xs">
          <Meta
            icon={<Clock className="w-3.5 h-3.5" />}
            label="Time"
            value={`${template.startTime}–${template.endTime}`}
          />
          <Meta
            icon={<Hourglass className="w-3.5 h-3.5" />}
            label="Duration"
            value={formatMinutes(blockMinutes(template.startTime, template.endTime))}
          />
        </div>

        {/* Deadline */}
        <div className="flex items-center justify-between bg-muted/30 rounded-xl px-3 py-2 text-xs">
          <span className="text-xs font-medium text-muted-foreground">
            Deadline
          </span>
          <span className="flex items-center gap-1.5 font-semibold text-foreground">
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full',
                isHomework ? 'bg-primary' : 'bg-orange-500',
              )}
            />
            {template.deadlineDay}
          </span>
        </div>
      </div>
    </div>
  );
}

function Meta({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-muted/30 rounded-xl px-3 py-2 flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <span className="flex items-center gap-1.5 font-semibold text-foreground leading-none">
        <span className="text-muted-foreground">{icon}</span>
        {value}
      </span>
    </div>
  );
}

/* ---------- Stat card ---------- */
function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-card border border-border/60 shadow-sm rounded-2xl p-5 flex items-center gap-3.5">
      <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground leading-none mb-1.5 truncate">
          {label}
        </p>
        <p className="text-lg font-heading font-bold text-foreground leading-none truncate">
          {value}
        </p>
        {sub && <p className="text-xs text-muted-foreground mt-1 truncate">{sub}</p>}
      </div>
    </div>
  );
}

/* ---------- Filter pill ---------- */
function FilterPill({
  active,
  onClick,
  label,
  count,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-colors',
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {icon}
      <span>{label}</span>
      {count > 0 && (
        <span
          className={cn(
            'text-xs px-1.5 py-0.5 rounded-full font-semibold min-w-[18px] text-center',
            active ? 'bg-white/20 text-primary-foreground' : 'bg-background/70 text-muted-foreground',
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/* ---------- Empty state ---------- */
function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 text-center py-6 bg-muted/50 rounded-2xl border border-border/50">
      <CalendarIcon className="w-8 h-8 text-muted-foreground/40" />
      <p className="text-sm font-medium text-muted-foreground max-w-sm">{text}</p>
    </div>
  );
}
