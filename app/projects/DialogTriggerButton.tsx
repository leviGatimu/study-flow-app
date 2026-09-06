"use client";

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CreateProjectForm } from './CreateProjectForm';
import { cn } from '@/lib/utils';

export function DialogTriggerButton({ className }: { className?: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className={cn("h-12 rounded-xl font-bold px-8 shadow-lg shadow-primary/20 gap-2", className)}>
          <Plus className="w-5 h-5" /> Start new project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl rounded-2xl p-8 border shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-3xl font-heading font-bold">New Project</DialogTitle>
        </DialogHeader>
        <CreateProjectForm />
      </DialogContent>
    </Dialog>
  );
}
