'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileEdit } from "lucide-react";

interface ValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
}

/** Explains why an action was refused and what to do instead. */
export function ValidationModal({
  isOpen,
  onClose,
  title,
  description,
}: ValidationModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <div className="flex flex-col items-center text-center space-y-5 pt-2">
          <div className="p-3 bg-primary/10 rounded-full text-primary">
            <FileEdit className="size-6" />
          </div>

          <div className="space-y-2">
            <DialogTitle className="text-xl font-heading font-bold">{title}</DialogTitle>
            <DialogDescription className="text-muted-foreground">{description}</DialogDescription>
          </div>

          <Button onClick={onClose} size="lg" className="w-full h-10">
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
