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
      <DialogContent className="sm:max-w-[400px] rounded-[32px] p-8 border-none shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="p-4 bg-destructive/10 rounded-full text-destructive">
            <AlertTriangle className="w-10 h-10" />
          </div>
          
          <div className="space-y-2">
            <DialogTitle className="text-2xl font-heading font-black">
              {title}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground font-medium">
              {description}
            </DialogDescription>
          </div>

          <DialogFooter className="w-full flex sm:flex-row gap-3 sm:gap-0">
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={isPending}
              className="flex-1 h-12 rounded-2xl font-bold"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirm}
              disabled={isPending}
              className="flex-1 h-12 rounded-2xl font-heading font-black shadow-lg shadow-destructive/20 active:scale-95 transition-all"
            >
              {isPending ? "Removing..." : "Yes, Remove"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
