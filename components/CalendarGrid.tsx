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

export function CalendarGrid({ tasks, exams = [], markedDays = [], subjects = [], schoolEndDate = null }: { tasks: TaskType[], exams?: ExamType[], markedDays?: Date[], subjects?: { id: string; name: string }[], schoolEndDate?: Date | string | null }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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

  const schoolEnd = schoolEndDate ? new Date(schoolEndDate) : null;
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
    <div className="flex flex-col bg-card rounded-[32px] border border-border/60 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-500">
      <ConfirmModal 
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={onConfirmDelete}
        title="Remove Session?"
        description="This will permanently remove this study session from your calendar."
        isPending={isPending}
      />

      {/* Calendar Header */}
      <div className="flex items-center justify-between p-8 border-b bg-muted/10 shrink-0">
        <h2 className="text-4xl font-heading font-black text-foreground tracking-tighter">
          {format(currentDate, 'MMMM yyyy')}
        </h2>
        <div className="flex items-center space-x-4">
          <Button variant="outline" className="rounded-2xl bg-background border hover:bg-secondary active:scale-95 transition-all shadow-sm font-bold px-6 h-12" onClick={goToday}>
            Today
          </Button>
          <div className="flex items-center space-x-1 bg-background rounded-2xl p-1.5 border shadow-sm">
            <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 hover:bg-secondary active:scale-95 transition-all" onClick={prevMonth}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 hover:bg-secondary active:scale-95 transition-all" onClick={nextMonth}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Days of Week */}
      <div className="grid grid-cols-7 bg-muted/30 border-b shrink-0">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="py-4 text-center text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">{day}</div>
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
            <div 
              key={date.toString()} 
              onClick={() => handleDayClick(date)}
              className={`bg-card p-4 cursor-pointer transition-all duration-300 hover:bg-muted/50 flex flex-col space-y-4 relative overflow-hidden group min-h-[140px]
                ${today ? 'bg-primary/[0.03]' : ''}
                ${isMarked ? 'bg-destructive/[0.03]' : ''}
                ${isLastDay ? 'bg-amber-500/[0.05] border-2 border-amber-500/30' : ''}
              `}
            >
              <div className="absolute top-0 left-0 w-full h-1 flex gap-px">
                {today && <div className="flex-1 bg-primary h-full" />}
                {isMarked && <div className="flex-1 bg-destructive h-full" />}
                {isLastDay && <div className="flex-1 bg-amber-500 h-full shadow-[0_0_10px_rgba(245,158,11,0.5)]" />}
              </div>

              <div className="flex justify-between items-center">
                <span className={`text-xl font-heading font-black tracking-tighter w-10 h-10 flex items-center justify-center rounded-2xl transition-all
                  ${today ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-110' : 
                    isMarked ? 'bg-destructive text-white shadow-lg shadow-destructive/30' : 
                    isLastDay ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/40 scale-105' :
                    'text-foreground group-hover:text-primary group-hover:bg-primary/10'}`}>
                  {format(date, 'd')}
                </span>
                {(dayTasks.length > 0 || dayExams.length > 0) && (
                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-tighter shadow-sm border
                    ${isMarked ? 'bg-destructive/10 text-destructive border-destructive/20' : 
                      dayExams.length > 0 ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                      'bg-muted text-muted-foreground border-border/40'}`}>
                    {dayTasks.length + dayExams.length} {dayTasks.length + dayExams.length === 1 ? 'Item' : 'Items'}
                  </span>
                )}
              </div>
              
              <div className="flex flex-col gap-2 z-10 flex-1">
                {dayExams.map(exam => (
                  <div 
                    key={exam.id} 
                    className="text-[10px] truncate px-3 py-1.5 rounded-xl font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 border border-amber-500/20 shadow-sm"
                  >
                    🚀 EXAM: {exam.title}
                  </div>
                ))}
                {dayTasks.slice(0, 2 - dayExams.length).map(task => {
                  const isHomework = task.type === 'HOMEWORK';
                  return (
                    <div 
                      key={task.id} 
                      className={`text-[10px] truncate px-3 py-1.5 rounded-xl font-black uppercase tracking-wider transition-all duration-300 border shadow-sm
                        ${task.isDone 
                          ? 'bg-success/10 text-success border-success/20 line-through opacity-50 scale-95' 
                          : task.isMissed
                            ? 'bg-destructive/10 text-destructive border-destructive/20 line-through opacity-50 scale-95'
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
            </div>
          );
        })}
      </div>

      {/* Day Detail Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className={`sm:max-w-3xl w-[90vw] rounded-[40px] p-0 overflow-hidden border-none shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] animate-in fade-in zoom-in-95 duration-300`}>
          <div className="bg-card">
            <DialogHeader className="p-8 border-b bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                   <DialogTitle className="text-3xl font-heading font-black text-foreground tracking-tighter leading-none">
                    {selectedDate ? format(selectedDate, 'EEEE') : ''}
                  </DialogTitle>
                  <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">
                    {selectedDate ? format(selectedDate, 'MMMM do, yyyy') : ''}
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  {selectedDate && (
                    <QuickAddForm
                      initialDate={selectedDate}
                      subjects={subjects}
                      trigger={
                        <Button variant="outline" size="sm" className="rounded-2xl h-10 px-4 font-black text-[10px] uppercase tracking-widest hover:bg-primary/10 hover:text-primary border-border/60 mr-2">
                          <Plus className="w-3.5 h-3.5 mr-2" /> Add Task
                        </Button>
                      }
                    />
                  )}
                  {selectedDate && isToday(selectedDate) && (
                    <span className="text-[10px] font-black tracking-widest uppercase bg-primary text-primary-foreground px-4 py-2 rounded-2xl shadow-lg shadow-primary/20 mr-2">Today</span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleToggleLastDay}
                    disabled={isPending}
                    title="Mark this as your last day of school — your streak pauses after it until you resume."
                    className={`rounded-2xl h-10 px-4 transition-all font-black text-[10px] uppercase tracking-widest mr-2 ${isSelectedLastDay ? 'bg-amber-500/15 text-amber-600 hover:bg-amber-500/25' : 'bg-muted/50 text-muted-foreground hover:bg-amber-500/10 hover:text-amber-600'}`}
                  >
                    <GraduationCap className="w-4 h-4 mr-2" />
                    {isSelectedLastDay ? 'Last Day ✓' : 'Last Day of School'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleToggleMark}
                    disabled={isPending}
                    className={`rounded-2xl h-10 px-4 transition-all font-black text-[10px] uppercase tracking-widest ${isSelectedDateMarked ? 'bg-destructive/10 text-destructive hover:bg-destructive/20' : 'bg-muted/50 text-muted-foreground hover:bg-destructive/10 hover:text-destructive'}`}
                  >
                    {isSelectedDateMarked ? <BookmarkCheck className="w-4 h-4 mr-2" /> : <Bookmark className="w-4 h-4 mr-2" />}
                    {isSelectedDateMarked ? 'Unmark' : 'Mark Day'}
                  </Button>
                </div>
              </div>
            </DialogHeader>
            
            <div className="p-8 max-h-[60vh] overflow-y-auto space-y-6">
              {selectedExams.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Scheduled Exams</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedExams.map(exam => (
                      <div key={exam.id} className="bg-amber-500/5 border border-amber-500/20 p-6 rounded-[32px] flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-600">
                             <Bookmark className="w-6 h-6 fill-current" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-amber-600/60 uppercase tracking-widest mb-1">Upcoming Exam</p>
                            <h4 className="font-heading font-black text-xl text-foreground uppercase tracking-tight">{exam.title}</h4>
                          </div>
                        </div>
                        {exam.priority === 'HIGH' && (
                          <span className="bg-red-500 text-white text-[8px] font-black px-2 py-1 rounded-lg uppercase tracking-widest">High Priority</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedTasks.length === 0 && selectedExams.length === 0 ? (
                <div className="py-20 border-2 border-dashed border-border/40 rounded-[32px] flex flex-col items-center justify-center text-center text-muted-foreground bg-muted/5">
                  <p className="font-bold uppercase tracking-widest text-xs opacity-50">No activity scheduled</p>
                </div>
              ) : (
                <div className="space-y-4">
                   {selectedTasks.length > 0 && <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Study Sessions</h4>}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedTasks.map((task, index) => {
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
                          className={`relative overflow-hidden bg-card border p-6 rounded-[32px] transition-all duration-300 hover:shadow-xl flex flex-col
                            ${task.isDone 
                              ? 'bg-success/5 border-success/30 opacity-70' 
                              : task.isMissed
                                ? 'bg-destructive/5 border-destructive/30 opacity-70'
                                : 'border-border/60'
                            }`}
                          style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
                        >
                          <div className="flex items-start justify-between relative z-10 gap-4 mb-4">
                            <div className="flex items-start gap-4">
                               <TaskCheckbox 
                                taskId={task.id} 
                                isDone={task.isDone} 
                                isMissed={task.isMissed} 
                                hasProof={!!task.workDescription || !!task.proofPdfUrl}
                               />
                               <p className={`font-heading font-black text-xl tracking-tight transition-colors mt-0.5 ${task.isDone ? 'line-through text-success' : task.isMissed ? 'line-through text-destructive' : 'text-foreground'}`}>
                                  {task.subject}
                                </p>
                            </div>
                            <span className={`text-[10px] font-black px-3 py-1 rounded-xl uppercase tracking-widest border
                              ${isHomework ? 'bg-primary/5 text-primary border-primary/10' : 'bg-orange-500/5 text-orange-600 border-orange-500/10'}`}>
                              {task.type}
                            </span>
                          </div>

                          <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/40 relative z-10">
                            <div className="bg-muted px-3 py-1.5 rounded-xl border border-border/40 flex items-center gap-2 shadow-sm">
                              <Clock className="w-3.5 h-3.5 text-primary" />
                              <span className="text-xs font-black text-foreground">
                                {task.startTime} — {task.endTime}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                               <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => setEditingTaskId(task.id)}
                                className="h-9 w-9 rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => setDeleteConfirmId(task.id)}
                                className="h-9 w-9 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
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

  return (
    <div className="bg-muted/30 border border-border/60 p-6 rounded-[32px] animate-in zoom-in-95 duration-200">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex items-center justify-between border-b border-border/40 pb-4">
          <h4 className="font-heading font-black text-xl tracking-tight text-foreground">{task.subject}</h4>
          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Editing Session</span>
        </div>
        
        <div className="space-y-2">
          <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Move to Date</Label>
          <Input 
            type="date" 
            required 
            value={dateStr} 
            onChange={e => setDateStr(e.target.value)}
            className="h-12 rounded-2xl bg-background font-bold border-border/60 focus:ring-primary/20"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Start Time</Label>
            <Input 
              type="time" 
              required 
              value={startTime} 
              onChange={e => setStartTime(e.target.value)}
              className="h-12 rounded-2xl bg-background font-bold border-border/60 focus:ring-primary/20"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">End Time</Label>
            <Input 
              type="time" 
              required 
              value={endTime} 
              onChange={e => setEndTime(e.target.value)}
              className="h-12 rounded-2xl bg-background font-bold border-border/60 focus:ring-primary/20"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button variant="ghost" type="button" onClick={onClose} disabled={isPending} className="flex-1 h-12 rounded-2xl font-bold">Cancel</Button>
          <Button type="submit" disabled={isPending} className="flex-[2] h-12 rounded-2xl font-heading font-black shadow-lg shadow-primary/20">Save Changes</Button>
        </div>
      </form>
    </div>
  );
}
