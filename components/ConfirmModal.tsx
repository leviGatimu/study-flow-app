'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  isPending?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  isPending
}: ConfirmModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <div className="flex flex-col items-center text-center space-y-5 pt-2">
          <div className="p-3 bg-destructive/10 rounded-full text-destructive">
            <AlertTriangle className="size-6" />
          </div>
          
          <div className="space-y-2">
            <DialogTitle className="text-xl font-heading font-bold">
              {title}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground font-medium">
              {description}
            </DialogDescription>
          </div>

          <DialogFooter className="w-full flex flex-col-reverse sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isPending}
              className="flex-1 h-10"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirm}
              disabled={isPending}
              className="flex-1 h-10"
            >
              {isPending ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
