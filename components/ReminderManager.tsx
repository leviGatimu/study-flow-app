'use client';

import { useEffect, useState } from 'react';
import { getTodayTasks } from '@/lib/actions';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';

export function ReminderManager() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [showPrompt, setShowPrompt] = useState(false);
  const [notifiedTasks, setNotifiedTasks] = useState<Set<string>>(new Set());

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (typeof window !== 'undefined') {
      timeoutId = setTimeout(() => {
        setPermission(p => p === Notification.permission ? p : Notification.permission);
        if (Notification.permission === 'default') {
          setShowPrompt(true);
        }
      }, 0);
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (permission !== 'granted') return;

    const checkTasks = async () => {
      const todayTasks = await getTodayTasks();
      const now = new Date();
      
      todayTasks.forEach(task => {
        if (task.isDone || task.isMissed || notifiedTasks.has(task.id)) return;

        const [h, m] = task.startTime.split(':').map(Number);
        const startTime = new Date();
        startTime.setHours(h, m, 0, 0);

        const diffMinutes = (startTime.getTime() - now.getTime()) / (1000 * 60);

        // Notify if start time is in exactly 5 minutes (allowing for 1 minute window)
        if (diffMinutes > 4 && diffMinutes <= 5) {
          new Notification('Study Flow Reminder', {
            body: `${task.subject} starts in 5 minutes! Get your notes ready. 🚀`,
            icon: '/favicon.ico'
          });
          
          setNotifiedTasks(prev => new Set(prev).add(task.id));
        }
      });
    };

    const interval = setInterval(checkTasks, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [permission, notifiedTasks]);

  const requestPermission = async () => {
    const result = await Notification.requestPermission();
    setPermission(result);
    setShowPrompt(false);
  };

  return (
    <>
      {/* Mini Status Indicator in Sidebar or Layout if needed, but for now just the prompt */}
      <Dialog open={showPrompt} onOpenChange={setShowPrompt}>
        <DialogContent className="sm:max-w-[400px] rounded-[32px] p-8 border-none shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="p-4 bg-primary/10 rounded-full text-primary">
              <Bell className="w-10 h-10" />
            </div>
            
            <div className="space-y-2">
              <DialogTitle className="text-2xl font-heading font-black">
                Enable Reminders?
              </DialogTitle>
              <DialogDescription className="text-muted-foreground font-medium">
                Receive a gentle nudge 5 minutes before your study sessions start so you never miss a beat.
              </DialogDescription>
            </div>

            <div className="flex w-full gap-3">
               <Button
                variant="ghost"
                onClick={() => setShowPrompt(false)}
                className="flex-1 h-12 rounded-2xl font-bold"
              >
                Later
              </Button>
              <Button
                onClick={requestPermission}
                className="flex-1 h-12 rounded-2xl font-heading font-black shadow-lg shadow-primary/20 active:scale-95 transition-all"
              >
                Enable
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
