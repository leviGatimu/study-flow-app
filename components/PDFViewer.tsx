'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, X, ExternalLink } from 'lucide-react';

export function PDFViewer({ url, title }: { url: string, title: string }) {
  const [isOpen, setIsOpen] = useState(false);

  const isPdf = url.toLowerCase().endsWith('.pdf');

  if (!isPdf) {
    return (
      <a 
        href={url} 
        target="_blank" 
        rel="noopener noreferrer"
        className="h-10 w-10 flex items-center justify-center rounded-full bg-muted/50 text-muted-foreground hover:bg-primary hover:text-white transition-all shadow-sm active:scale-90"
        title="Open File"
      >
        <ExternalLink className="w-4 h-4" />
      </a>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-10 w-10 rounded-full bg-muted/50 text-muted-foreground hover:bg-primary hover:text-white transition-all shadow-sm active:scale-90"
          title="View PDF"
        >
          <FileText className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      {/* We use showCloseButton={false} to avoid the absolute positioned X in the corner */}
      <DialogContent 
        showCloseButton={false}
        className="fixed top-0 left-0 translate-x-0 translate-y-0 w-screen h-screen max-w-none sm:max-w-none m-0 rounded-none p-0 overflow-hidden border-none shadow-none bg-black/20 backdrop-blur-3xl transition-none"
      >
        <div className="flex flex-col h-full w-full bg-card/95">
          <DialogHeader className="p-4 border-b bg-muted/20 flex flex-row items-center justify-between space-y-0 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <FileText className="w-5 h-5" />
              </div>
              <DialogTitle className="text-xl font-heading font-black truncate max-w-[60vw]">
                {title}
              </DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="rounded-full font-bold gap-2 bg-background/50"
                onClick={() => window.open(url, '_blank')}
              >
                <ExternalLink className="w-4 h-4" /> Open in New Tab
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors" 
                onClick={() => setIsOpen(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </DialogHeader>
          
          <div className="flex-1 w-full bg-black overflow-hidden relative">
            <iframe 
              src={`${url}#view=FitH&toolbar=1`} 
              className="absolute inset-0 w-full h-full border-none"
              title={title}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
