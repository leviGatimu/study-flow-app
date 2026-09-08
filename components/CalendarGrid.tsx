'use client';

import { useState, useTransition } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
import { Plus, ChevronLeft, ChevronRight, Clock, Edit2, Bookmark, BookmarkCheck, Trash2, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TaskCheckbox } from '@/components/TaskCheckbox';
import { toggleMarkedDay, updateTask, deleteTask, setSchoolEndDate } from '@/lib/actions';
import { QuickAddForm } from '@/components/QuickAddForm';
import { useIsArchived } from '@/components/ArchiveContext';
import { cn } from '@/lib/utils';
import { ConfirmModal } from '@/components/ConfirmModal';

type TaskType = {
  id: string;
  subject: string;
  isDone: boolean;
  isMissed: boolean;
  type: string;
  startTime: string;
  endTime: string;
  workDescription?: string | null;
  proofPdfUrl?: string | null;
  template: {
    startTime: string;
    endTime: string;
    deadlineDay: string;
  } | null;
  date: Date;
};

type ExamType = {
  id: string;
  title: string;
  date: Date;
  priority: string;
};

export function CalendarGrid({ tasks, exams = [], markedDays = [], subjects = [], termEndDate = null }: { tasks: TaskType[], exams?: ExamType[], markedDays?: Date[], subjects?: { id: string; name: string }[], termEndDate?: Date | string | null }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const archived = useIsArchived();

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Handle filling the start of the week
  const startDay = monthStart.getDay();
  const prefixDays = Array.from({ length: startDay }).map((_, i) => null);

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToday = () => setCurrentDate(new Date());

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setIsModalOpen(true);
    setEditingTaskId(null);
  };

  const selectedTasks = selectedDate 
    ? tasks.filter(t => isSameDay(new Date(t.date), selectedDate))
    : [];

  const selectedExams = selectedDate
    ? exams.filter(e => isSameDay(new Date(e.date), selectedDate))
    : [];
    
  const isSelectedDateMarked = selectedDate
    ? markedDays.some(md => isSameDay(new Date(md), selectedDate))
    : false;

  const schoolEnd = termEndDate ? new Date(termEndDate) : null;
  const isSelectedLastDay = selectedDate && schoolEnd
    ? isSameDay(schoolEnd, selectedDate)
    : false;

  const handleToggleMark = () => {
    if (!selectedDate) return;
    startTransition(() => {
      toggleMarkedDay(selectedDate, !isSelectedDateMarked);
    });
  };

  const handleToggleLastDay = () => {
    if (!selectedDate) return;
    startTransition(() => {
      setSchoolEndDate(isSelectedLastDay ? null : selectedDate);
    });
  };

  const onConfirmDelete = () => {
    if (!deleteConfirmId) return;
    startTransition(async () => {
      await deleteTask(deleteConfirmId);
      setDeleteConfirmId(null);
    });
  };

  return (
    <div className="flex flex-col bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
      <ConfirmModal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={onConfirmDelete}
        title="Remove Session?"
        description="This will permanently remove this study session from your calendar."
        isPending={isPending}
      />

      {/* Calendar Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-8 border-b bg-muted/10 shrink-0">
        <h2 className="text-2xl font-heading font-bold tracking-tight text-foreground">
          {format(currentDate, 'MMMM yyyy')}
        </h2>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="rounded-xl bg-background border hover:bg-secondary transition-colors font-semibold px-5 h-11" onClick={goToday}>
            Today
          </Button>
          <div className="flex items-center gap-1 bg-background rounded-xl p-1.5 border shadow-sm">
            <Button variant="ghost" size="icon" aria-label="Previous month" className="rounded-lg h-9 w-9 hover:bg-secondary transition-colors" onClick={prevMonth}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Next month" className="rounded-lg h-9 w-9 hover:bg-secondary transition-colors" onClick={nextMonth}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile: agenda list (the 7-column grid below is unusable under ~500px) */}
      <div className="sm:hidden divide-y divide-border/60">
        {days.map((date) => {
          const dayTasks = tasks.filter(t => isSameDay(new Date(t.date), date));
          const dayExams = exams.filter(e => isSameDay(new Date(e.date), date));
          const today = isToday(date);
          const isMarked = markedDays.some(md => isSameDay(new Date(md), date));
          const isLastDay = schoolEnd ? isSameDay(date, schoolEnd) : false;
          const hasHomework = dayTasks.some(t => t.type === 'HOMEWORK');
          const hasRevision = dayTasks.some(t => t.type === 'REVISION');
          const itemCount = dayTasks.length + dayExams.length;

          return (
            <button
              key={date.toString()}
              type="button"
              onClick={() => handleDayClick(date)}
              className={`w-full flex items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${today ? 'bg-primary/[0.03]' : ''} ${isMarked ? 'bg-destructive/[0.03]' : ''}`}
            >
              <span className={`text-sm font-heading font-bold w-9 h-9 shrink-0 flex items-center justify-center rounded-xl
                ${today ? 'bg-primary text-primary-foreground' :
                  isMarked ? 'bg-destructive text-white' :
                  isLastDay ? 'bg-amber-500 text-white' :
                  'bg-muted text-foreground'}`}>
                {format(date, 'd')}
              </span>

              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-foreground">{format(date, 'EEEE')}</span>
                {itemCount > 0 ? (
                  <span className="mt-1 flex items-center gap-1.5 flex-wrap">
                    {dayExams.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden="true" />}
                    {hasHomework && <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden="true" />}
                    {hasRevision && <span className="w-1.5 h-1.5 rounded-full bg-orange-500" aria-hidden="true" />}
                    <span className="text-xs text-muted-foreground">
                      {itemCount} {itemCount === 1 ? 'item' : 'items'}
                    </span>
                  </span>
                ) : (
                  <span className="block text-xs text-muted-foreground mt-1">No activity</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Desktop / tablet: full month grid */}
      <div className="hidden sm:block">
      {/* Days of Week */}
      <div className="grid grid-cols-7 bg-muted/30 border-b shrink-0">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="py-4 text-center text-xs font-medium text-muted-foreground">{day}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 bg-border/40 gap-px">
        {prefixDays.map((_, i) => (
          <div key={`prefix-${i}`} className="bg-muted/5 min-h-[140px]" />
        ))}
        {days.map((date) => {
          const dayTasks = tasks.filter(t => isSameDay(new Date(t.date), date));
          const dayExams = exams.filter(e => isSameDay(new Date(e.date), date));
          const today = isToday(date);
          const isMarked = markedDays.some(md => isSameDay(new Date(md), date));
          const isLastDay = schoolEnd ? isSameDay(date, schoolEnd) : false;
          
          return (
            <button
              key={date.toString()}
              type="button"
              onClick={() => handleDayClick(date)}
              className={`bg-card p-4 text-left transition-colors duration-200 hover:bg-muted/50 flex flex-col space-y-4 relative overflow-hidden group min-h-[140px] w-full
                ${today ? 'bg-primary/[0.03]' : ''}
                ${isMarked ? 'bg-destructive/[0.03]' : ''}
                ${isLastDay ? 'bg-amber-500/[0.05] border-2 border-amber-500/30' : ''}
              `}
            >
              <div className="absolute top-0 left-0 w-full h-1 flex gap-px">
                {today && <div className="flex-1 bg-primary h-full" />}
                {isMarked && <div className="flex-1 bg-destructive h-full" />}
                {isLastDay && <div className="flex-1 bg-amber-500 h-full" />}
              </div>

              <div className="flex justify-between items-center">
                <span className={`text-xl font-heading font-bold w-10 h-10 flex items-center justify-center rounded-2xl transition-colors
                  ${today ? 'bg-primary text-primary-foreground' :
                    isMarked ? 'bg-destructive text-white' :
                    isLastDay ? 'bg-amber-500 text-white' :
                    'text-foreground group-hover:text-primary group-hover:bg-primary/10'}`}>
                  {format(date, 'd')}
                </span>
                {(dayTasks.length > 0 || dayExams.length > 0) && (
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border
                    ${isMarked ? 'bg-destructive/10 text-destructive border-destructive/20' :
                      dayExams.length > 0 ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                      'bg-muted text-muted-foreground border-border/40'}`}>
                    {dayTasks.length + dayExams.length} {dayTasks.length + dayExams.length === 1 ? 'item' : 'items'}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-2 z-10 flex-1">
                {dayExams.map(exam => (
                  <div
                    key={exam.id}
                    className="text-xs font-medium truncate px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-500/20"
                  >
                    Exam: {exam.title}
                  </div>
                ))}
                {dayTasks.slice(0, 2 - dayExams.length).map(task => {
                  const isHomework = task.type === 'HOMEWORK';
                  return (
                    <div
                      key={task.id}
                      className={`text-xs font-medium truncate px-3 py-1.5 rounded-xl transition-colors duration-200 border
                        ${task.isDone
                          ? 'bg-success/10 text-success border-success/20 line-through opacity-60'
                          : task.isMissed
                            ? 'bg-destructive/10 text-destructive border-destructive/20 line-through opacity-60'
                            : isHomework
                              ? 'bg-primary/5 text-primary border-primary/10 hover:bg-primary/10'
                              : 'bg-orange-500/5 text-orange-600 border-orange-500/10 hover:bg-orange-500/10'
                        }`}
                      title={task.subject}
                    >
                      {task.subject}
                    </div>
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>
      </div>

      {/* Day Detail Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-3xl w-[90vw] rounded-2xl p-0 overflow-hidden border-none shadow-xl">
          <div className="bg-card">
            <DialogHeader className="p-8 border-b bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                   <DialogTitle className="text-2xl font-heading font-bold tracking-tight text-foreground leading-none">
                    {selectedDate ? format(selectedDate, 'EEEE') : ''}
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground">
                    {selectedDate ? format(selectedDate, 'MMMM do, yyyy') : ''}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {selectedDate && (
                    <QuickAddForm
                      initialDate={selectedDate}
                      subjects={subjects}
                      trigger={
                        <Button variant="outline" size="sm" className="rounded-xl h-10 px-4 font-medium text-xs hover:bg-primary/10 hover:text-primary border-border/60 mr-2">
                          <Plus className="w-3.5 h-3.5 mr-2" /> Add task
                        </Button>
                      }
                    />
                  )}
                  {selectedDate && isToday(selectedDate) && (
                    <span className="text-xs font-semibold bg-primary text-primary-foreground px-3 py-1.5 rounded-full mr-2">Today</span>
                  )}
                  {!archived && (
                  <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleToggleLastDay}
                    disabled={isPending}
                    title="Mark this as your last day of school — your streak pauses after it until you resume."
                    className={`rounded-xl h-10 px-4 transition-colors font-medium text-xs mr-2 ${isSelectedLastDay ? 'bg-amber-500/15 text-amber-600 hover:bg-amber-500/25' : 'bg-muted/50 text-muted-foreground hover:bg-amber-500/10 hover:text-amber-600'}`}
                  >
                    <GraduationCap className="w-4 h-4 mr-2" />
                    {isSelectedLastDay ? 'Last day ✓' : 'Last day of school'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleToggleMark}
                    disabled={isPending}
                    className={`rounded-xl h-10 px-4 transition-colors font-medium text-xs ${isSelectedDateMarked ? 'bg-destructive/10 text-destructive hover:bg-destructive/20' : 'bg-muted/50 text-muted-foreground hover:bg-destructive/10 hover:text-destructive'}`}
                  >
                    {isSelectedDateMarked ? <BookmarkCheck className="w-4 h-4 mr-2" /> : <Bookmark className="w-4 h-4 mr-2" />}
                    {isSelectedDateMarked ? 'Unmark' : 'Mark day'}
                  </Button>
                  </>
                  )}
                </div>
              </div>
            </DialogHeader>

            <div className="p-8 max-h-[60vh] overflow-y-auto space-y-6">
              {selectedExams.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-xs font-medium text-muted-foreground ml-1">Scheduled exams</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedExams.map(exam => (
                      <div key={exam.id} className="bg-amber-500/5 border border-amber-500/20 p-6 rounded-2xl flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-600">
                             <Bookmark className="w-6 h-6 fill-current" />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-amber-600/70 mb-1">Upcoming exam</p>
                            <h4 className="font-heading font-bold text-xl text-foreground tracking-tight">{exam.title}</h4>
                          </div>
                        </div>
                        {exam.priority === 'HIGH' && (
                          <span className="bg-red-500 text-white text-xs font-semibold px-2.5 py-1 rounded-lg">High priority</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedTasks.length === 0 && selectedExams.length === 0 ? (
                <p className="text-sm font-medium text-muted-foreground text-center py-6 bg-muted/50 rounded-2xl border border-border/50">
                  No activity scheduled for this day. Use &quot;Add task&quot; above to create one.
                </p>
              ) : (
                <div className="space-y-4">
                   {selectedTasks.length > 0 && <h4 className="text-xs font-medium text-muted-foreground ml-1">Study sessions</h4>}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedTasks.map((task) => {
                      const isHomework = task.type === 'HOMEWORK';
                      const isEditing = editingTaskId === task.id;

                      if (isEditing) {
                        return (
                          <div key={task.id} className="md:col-span-2">
                            <EditTaskForm
                              task={task}
                              onClose={() => setEditingTaskId(null)}
                            />
                          </div>
                        );
                      }

                      return (
                        <div
                          key={task.id}
                          className={`relative overflow-hidden bg-card border shadow-sm p-6 rounded-2xl hover:shadow-md transition-shadow duration-200 flex flex-col
                            ${task.isDone
                              ? 'bg-success/5 border-success/30 opacity-70'
                              : task.isMissed
                                ? 'bg-destructive/5 border-destructive/30 opacity-70'
                                : 'border-border/60'
                            }`}
                        >
                          <div className="flex items-start justify-between relative z-10 gap-4 mb-4">
                            <div className="flex items-start gap-4">
                               <TaskCheckbox
                                taskId={task.id}
                                isDone={task.isDone}
                                isMissed={task.isMissed}
                                hasProof={!!task.workDescription || !!task.proofPdfUrl}
                               />
                               <p className={`font-heading font-bold text-xl tracking-tight transition-colors mt-0.5 ${task.isDone ? 'line-through text-success' : task.isMissed ? 'line-through text-destructive' : 'text-foreground'}`}>
                                  {task.subject}
                                </p>
                            </div>
                            <span className={`text-xs font-medium px-3 py-1 rounded-xl border
                              ${isHomework ? 'bg-primary/5 text-primary border-primary/10' : 'bg-orange-500/5 text-orange-600 border-orange-500/10'}`}>
                              {isHomework ? 'Homework' : 'Revision'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/40 relative z-10">
                            <div className="bg-muted px-3 py-1.5 rounded-xl border border-border/40 flex items-center gap-2">
                              <Clock className="w-3.5 h-3.5 text-primary" />
                              <span className="text-xs font-semibold text-foreground">
                                {task.startTime} — {task.endTime}
                              </span>
                            </div>

                            <div className={cn("flex items-center gap-1", archived && "hidden")}>
                               <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Edit session"
                                onClick={() => setEditingTaskId(task.id)}
                                className="h-9 w-9 rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Remove session"
                                onClick={() => setDeleteConfirmId(task.id)}
                                className="h-9 w-9 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Subcomponent for editing a task within the modal
function EditTaskForm({ task, onClose }: { task: TaskType, onClose: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [dateStr, setDateStr] = useState(format(new Date(task.date), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState(task.startTime);
  const [endTime, setEndTime] = useState(task.endTime);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const dateParts = dateStr.split('-');
      const newDate = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
      
      await updateTask(task.id, {
        date: newDate,
        startTime,
        endTime
      });
      onClose();
    });
  };

  const dateId = `${task.id}-date`;
  const startId = `${task.id}-start`;
  const endId = `${task.id}-end`;

  return (
    <div className="bg-muted/30 border border-border/60 p-6 rounded-2xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex items-center justify-between border-b border-border/40 pb-4">
          <h4 className="font-heading font-bold text-xl tracking-tight text-foreground">{task.subject}</h4>
          <span className="text-xs font-medium text-muted-foreground">Editing session</span>
        </div>

        <div className="space-y-2">
          <Label htmlFor={dateId} className="text-xs font-medium text-muted-foreground ml-1">Move to date</Label>
          <Input
            id={dateId}
            type="date"
            required
            value={dateStr}
            onChange={e => setDateStr(e.target.value)}
            className="h-12 rounded-xl bg-background font-semibold border-border/60 focus:ring-primary/20"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={startId} className="text-xs font-medium text-muted-foreground ml-1">Start time</Label>
            <Input
              id={startId}
              type="time"
              required
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              className="h-12 rounded-xl bg-background font-semibold border-border/60 focus:ring-primary/20"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={endId} className="text-xs font-medium text-muted-foreground ml-1">End time</Label>
            <Input
              id={endId}
              type="time"
              required
              value={endTime}
              onChange={e => setEndTime(e.target.value)}
              className="h-12 rounded-xl bg-background font-semibold border-border/60 focus:ring-primary/20"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button variant="ghost" type="button" onClick={onClose} disabled={isPending} className="flex-1 h-12 rounded-xl font-medium">Cancel</Button>
          <Button type="submit" disabled={isPending} className="flex-[2] h-12 rounded-xl font-heading font-semibold">Save changes</Button>
        </div>
      </form>
    </div>
  );
}
