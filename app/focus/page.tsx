import { getTodayTasks } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Play, Sparkles, Brain, Clock, Zap } from 'lucide-react';
import Link from 'next/link';
import { TaskWithTemplate } from '@/lib/types';
import { getUserId } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function FocusHubPage() {
  const userId = await getUserId();
  if (!userId) redirect('/welcome');

  const todayTasks = await getTodayTasks();

  return (
    <div className="space-y-12 max-w-[1000px] mx-auto animate-in fade-in duration-500 pb-16">
      <div className="pt-6 pb-2 border-b border-border/40">
        <h1 className="text-5xl font-heading font-black tracking-tight text-foreground">Focus Mode</h1>
        <p className="text-xl text-muted-foreground font-semibold mt-3">Enter the flow state and crush your objectives.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Quick Start Card */}
        <Card className="rounded-[32px] border-border/60 shadow-sm overflow-hidden bg-primary/5 border-primary/20">
          <CardHeader className="p-8 pb-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                <Brain className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-2xl font-heading font-black">Free Focus</CardTitle>
                <CardDescription className="font-medium">No task assigned. Just you and the zone.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8 pt-4 space-y-6">
            <p className="text-sm text-muted-foreground font-medium leading-relaxed">
              Start a custom session with a flexible timer. Perfect for creative work or unplanned study bursts.
            </p>
            <Link href="/focus/free">
              <Button className="w-full h-14 rounded-2xl font-bold text-lg shadow-lg shadow-primary/20 gap-3 mt-4">
                <Play className="w-5 h-5 fill-current" /> Start Free Session
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="rounded-[32px] border-border/60 shadow-sm overflow-hidden">
          <CardHeader className="p-8 pb-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-500/10 rounded-2xl text-orange-600">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-2xl font-heading font-black">Deep Focus Tips</CardTitle>
                <CardDescription className="font-medium">Optimize your environment for results.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8 pt-4 space-y-4">
            <ul className="space-y-3">
              {[
                { icon: Clock, text: "Work in 50-minute chunks for maximum retention." },
                { icon: Sparkles, text: "Put your phone in another room to avoid distractions." },
              ].map((tip, i) => (
                <li key={i} className="flex items-start gap-3 text-sm font-medium text-muted-foreground">
                  <tip.icon className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  {tip.text}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Task List Section */}
      <div className="space-y-6">
        <h3 className="text-2xl font-heading font-black px-2">Scheduled for Today</h3>
        <div className="grid grid-cols-1 gap-4">
          {todayTasks.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed border-border/40 rounded-[32px]">
              <p className="text-muted-foreground font-bold italic">No tasks scheduled for today. Start a free session above!</p>
            </div>
          ) : (
            todayTasks.map((task: TaskWithTemplate) => (
              <div key={task.id} className="group p-6 rounded-[32px] bg-card border border-border/60 shadow-sm hover:border-primary/40 hover:shadow-md transition-all flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="p-4 bg-muted rounded-2xl font-black text-primary text-xl tracking-tighter">
                    {task.startTime}
                  </div>
                  <div>
                    <h4 className="text-xl font-heading font-black">{task.subject}</h4>
                    <p className="text-sm text-muted-foreground font-bold uppercase tracking-widest">{task.type} • {task.endTime} Finish</p>
                  </div>
                </div>
                <Link href={`/focus/${task.id}`}>
                  <Button variant="outline" className="rounded-2xl h-12 px-8 font-black border-border/60 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all">
                    FOCUS
                  </Button>
                </Link>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
