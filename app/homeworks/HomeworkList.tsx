'use client';

import { useState } from 'react';
import { Homework } from '@/lib/types';
import { HomeworkCard } from './HomeworkCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AnimatePresence } from 'framer-motion';
import { BookOpen, History, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CreateHomeworkForm } from './CreateHomeworkForm';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useIsArchived } from '@/components/ArchiveContext';

interface HomeworkListProps {
  homeworks: Homework[];
  subjects: { id: string; name: string }[];
}

export function HomeworkList({ homeworks, subjects }: HomeworkListProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const archived = useIsArchived();
  const activeHomeworks = homeworks.filter(h => !h.isCompleted);
  const completedHomeworks = homeworks.filter(h => h.isCompleted);

  return (
    <div className="space-y-8 w-full">
      <Tabs defaultValue="active" className="w-full space-y-8">
        <div className="flex items-center justify-between flex-wrap gap-6">
          <TabsList className="h-12 bg-muted/60 p-1.5 rounded-2xl border border-border/40">
            <TabsTrigger value="active" className="rounded-xl px-6 py-2 font-semibold text-sm gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary transition-colors duration-200">
              <BookOpen className="w-4 h-4" /> Active ({activeHomeworks.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="rounded-xl px-6 py-2 font-semibold text-sm gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary transition-colors duration-200">
              <History className="w-4 h-4" /> Completed ({completedHomeworks.length})
            </TabsTrigger>
          </TabsList>

          {!archived && (
            <Button
              onClick={() => setShowAddForm(true)}
              className="h-11 rounded-xl font-bold px-6 text-sm shadow-sm gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add homework
            </Button>
          )}
        </div>

        {/* Pop-up form for adding homework */}
        <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
          <DialogContent className="sm:max-w-3xl rounded-2xl p-8 md:p-10 border shadow-2xl bg-card">
            <DialogHeader className="space-y-2">
              <DialogTitle className="text-2xl font-heading font-bold tracking-tight text-foreground">New homework</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">Add an assignment to track, plan, and complete.</DialogDescription>
            </DialogHeader>
            <div className="mt-6">
              <CreateHomeworkForm onSuccess={() => setShowAddForm(false)} subjects={subjects} />
            </div>
          </DialogContent>
        </Dialog>

        <TabsContent value="active" className="mt-0 focus-visible:outline-none">
          {activeHomeworks.length === 0 ? (
            <p className="text-sm font-medium text-muted-foreground text-center py-6 bg-muted/50 rounded-2xl border border-border/50">
              All caught up. No pending homework — add one above, or start a revision session.
            </p>
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
            <p className="text-sm font-medium text-muted-foreground text-center py-6 bg-muted/50 rounded-2xl border border-border/50">
              No history yet. Completed homework will appear here once submitted.
            </p>
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
