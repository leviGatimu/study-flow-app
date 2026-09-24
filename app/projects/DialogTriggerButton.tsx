"use client";

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useIsArchived } from '@/components/ArchiveContext';
import { CreateProjectForm } from './CreateProjectForm';

export function DialogTriggerButton({ size }: { size?: 'default' | 'lg' }) {
  const archived = useIsArchived();
  if (archived) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size={size}>
          <Plus />
          New project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>It opens straight away so you can write its first doc.</DialogDescription>
        </DialogHeader>
        <CreateProjectForm />
      </DialogContent>
    </Dialog>
  );
}
