'use client';

import { useState } from 'react';
import { Homework } from '@/lib/types';
import { HomeworkCard } from './HomeworkCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, CheckCircle2, History, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CreateHomeworkForm } from './CreateHomeworkForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface HomeworkListProps {
  homeworks: Homework[];
  subjects: { id: string; name: string }[];
}

export function HomeworkList({ homeworks, subjects }: HomeworkListProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const activeHomeworks = homeworks.filter(h => !h.isCompleted);
  const completedHomeworks = homeworks.filter(h => h.isCompleted);

  return (
    <div className="space-y-8 w-full">
      <Tabs defaultValue="active" className="w-full space-y-8">
        <div className="flex items-center justify-between flex-wrap gap-6">
          <TabsList className="h-16 bg-muted/60 p-2 rounded-2xl border border-border/40 shadow-inner">
            <TabsTrigger value="active" className="rounded-xl px-8 py-3 font-black text-base gap-3 data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-primary transition-all duration-200">
              <BookOpen className="w-5 h-5" /> ACTIVE ({activeHomeworks.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="rounded-xl px-8 py-3 font-black text-base gap-3 data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:text-primary transition-all duration-200">
              <History className="w-5 h-5" /> COMPLETED ({completedHomeworks.length})
            </TabsTrigger>
          </TabsList>

          <Button 
            onClick={() => setShowAddForm(true)}
            className="h-16 rounded-2xl font-black px-8 text-base shadow-xl shadow-primary/10 gap-3 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-5 h-5" /> ADD NEW HOMEWORK
          </Button>
        </div>

        {/* Pop-up form for adding homework */}
        <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
          <DialogContent className="sm:max-w-3xl rounded-[32px] p-8 md:p-10 border shadow-2xl bg-card">
            <DialogHeader className="space-y-2">
              <DialogTitle className="text-3xl font-heading font-black text-foreground uppercase tracking-tight">New Homework</DialogTitle>
              <DialogDescription className="text-sm font-semibold text-muted-foreground">Add an assignment to track, plan, and complete.</DialogDescription>
            </DialogHeader>
            <div className="mt-6">
              <CreateHomeworkForm onSuccess={() => setShowAddForm(false)} subjects={subjects} />
            </div>
          </DialogContent>
        </Dialog>

        <TabsContent value="active" className="mt-0 focus-visible:outline-none">
          {activeHomeworks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 bg-muted/5 border-2 border-dashed border-border/20 rounded-[32px] text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-muted-foreground/30" />
              <h3 className="text-xl font-heading font-black">All caught up!</h3>
              <p className="text-sm font-semibold text-muted-foreground/60 max-w-xs mt-1">No pending homework. Time for some revision?</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              <AnimatePresence mode="popLayout">
                {activeHomeworks.map((hw) => (
                  <HomeworkCard key={hw.id} homework={hw} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-0 focus-visible:outline-none">
          {completedHomeworks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 bg-muted/5 border-2 border-dashed border-border/20 rounded-[32px] text-center space-y-4">
              <History className="w-12 h-12 text-muted-foreground/30" />
              <h3 className="text-xl font-heading font-black">No history yet.</h3>
              <p className="text-sm font-semibold text-muted-foreground/60 max-w-xs mt-1">Completed homework will appear here once submitted.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              <AnimatePresence mode="popLayout">
                {completedHomeworks.map((hw) => (
                  <HomeworkCard key={hw.id} homework={hw} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
