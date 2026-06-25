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
import { FileEdit, Sparkles, X } from "lucide-react";
import { motion } from "framer-motion";

interface ValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
}

export function ValidationModal({
  isOpen,
  onClose,
  title,
  description,
}: ValidationModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[440px] rounded-[40px] p-0 border-none shadow-2xl overflow-hidden bg-card/90 backdrop-blur-xl">
        <div className="relative p-10 flex flex-col items-center text-center space-y-8">
          
          {/* Decorative background glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 bg-primary/20 rounded-full blur-[80px] -z-10" />

          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative"
          >
            <div className="p-6 bg-primary/10 rounded-[32px] text-primary shadow-inner border border-primary/20">
              <FileEdit className="w-12 h-12" />
            </div>
            <div className="absolute -top-2 -right-2 p-2 bg-background rounded-full border shadow-sm">
               <Sparkles className="w-4 h-4 text-primary animate-pulse" />
            </div>
          </motion.div>
          
          <div className="space-y-3">
            <DialogTitle className="text-3xl font-heading font-black tracking-tight leading-tight">
              {title}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground font-semibold text-lg px-4">
              {description}
            </DialogDescription>
          </div>

          <div className="w-full pt-4">
            <Button
              onClick={onClose}
              className="w-full h-16 rounded-3xl font-black text-xl shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3"
            >
              GOT IT! <Sparkles className="w-5 h-5" />
            </Button>
          </div>

          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/40">
            System Protocol // Accuracy Required
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
