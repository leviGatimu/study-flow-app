'use client';

import { useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { BrainCircuit, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { loginUser } from '@/lib/actions';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export function LoginClient() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    
    startTransition(async () => {
      const result = await loginUser(formData);
      if (result?.error) {
        setError(result.error);
        toast.error("Authentication Failed", {
          description: result.error
        });
      } else {
        toast.success("Welcome back!", {
          description: "Accessing your workstation..."
        });
        router.push('/');
        router.refresh();
      }
    });
  };

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground font-sans selection:bg-primary/30 selection:text-primary">
      
      {/* Left Panel: Visual/Story */}
      <div className="relative hidden lg:flex flex-col w-1/2 h-screen overflow-hidden border-r border-border/40 bg-muted/30 dark:bg-neutral-950">
        
        {/* Abstract Animated Background */}
        <div className="absolute inset-0 overflow-hidden bg-background dark:bg-black flex items-center justify-center">
            {/* Animated glowing orbs */}
            <motion.div 
              animate={{ 
                scale: [1, 1.2, 1],
                rotate: [0, 90, 0],
              }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute w-[80vw] h-[80vw] max-w-[800px] max-h-[800px] bg-gradient-to-tr from-blue-500/10 dark:from-blue-600/20 to-purple-500/10 dark:to-purple-600/20 rounded-full blur-[120px]"
            />
            <motion.div 
              animate={{ 
                scale: [1, 1.5, 1],
                x: [0, 100, 0],
                y: [0, -100, 0]
              }}
              transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
              className="absolute w-[60vw] h-[60vw] max-w-[600px] max-h-[600px] bg-gradient-to-br from-indigo-500/5 dark:from-indigo-500/10 to-fuchsia-500/5 dark:to-fuchsia-500/10 rounded-full blur-[100px]"
            />
            
            {/* Grid overlay with radial mask */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_80%_80%_at_50%_50%,#000_20%,transparent_100%)]" />
            
            {/* 3D Floating Glass Panels */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none perspective-[1200px]">
              <motion.div 
                animate={{ rotateY: [-10, 10, -10], rotateX: [5, -5, 5], y: [-20, 20, -20] }}
                transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
                className="absolute w-[300px] h-[400px] bg-white/5 dark:bg-white/5 backdrop-blur-3xl border border-black/5 dark:border-white/10 rounded-[40px] shadow-2xl transform-gpu -translate-x-20 -translate-y-20"
              />
              <motion.div 
                animate={{ rotateY: [10, -10, 10], rotateX: [-5, 5, -5], y: [20, -20, 20] }}
                transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
                className="absolute w-[350px] h-[250px] bg-white/5 dark:bg-white/5 backdrop-blur-3xl border border-black/5 dark:border-white/10 rounded-[40px] shadow-2xl transform-gpu translate-x-32 translate-y-32"
              />
            </div>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full p-16 justify-between pointer-events-none">
          <Link href="/" className="inline-flex items-center gap-3 font-heading font-black text-2xl hover:opacity-80 transition-opacity pointer-events-auto w-fit">
            <div className="p-2 bg-foreground text-background rounded-xl">
              <BrainCircuit className="h-6 w-6" />
            </div>
            StudyFlow
          </Link>

          <div className="max-w-md pointer-events-auto">
            <h1 className="text-5xl lg:text-7xl font-heading font-black tracking-tighter leading-[0.9] text-foreground mb-6">
              Enter the <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-500">Nexus.</span>
            </h1>
            <p className="text-xl text-muted-foreground font-medium leading-relaxed">
              Your hyper-focused workstation awaits. Synchronize your mind and dominate your syllabus.
            </p>
          </div>

          <div className="text-[10px] font-bold uppercase tracking-[0.5em] text-muted-foreground/40">
            System version 2.0 • Secure Connection
          </div>
        </div>
      </div>

      {/* Right Panel: Login Form */}
      <div className="flex flex-col justify-center w-full lg:w-1/2 h-screen p-8 sm:p-16 lg:p-24 relative bg-background">
        {/* Mobile Header */}
        <div className="absolute top-8 left-8 lg:hidden">
          <Link href="/" className="inline-flex items-center gap-3 font-heading font-black text-xl">
            <BrainCircuit className="h-6 w-6 text-foreground" />
            StudyFlow
          </Link>
        </div>

        <div className="w-full max-w-md mx-auto">
          <div className="mb-12">
            <h2 className="text-4xl font-heading font-black tracking-tighter text-foreground mb-3">Sign In</h2>
            <p className="text-lg text-muted-foreground font-medium">Continue your journey.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  className="bg-destructive/10 border border-destructive/20 p-4 rounded-2xl flex items-center gap-3 text-destructive text-sm font-bold overflow-hidden"
                >
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-2 group">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 group-focus-within:text-foreground transition-colors ml-2">Username</label>
              <div className="relative">
                <input 
                  name="username" 
                  required 
                  placeholder="e.g. levi" 
                  className="w-full h-16 bg-muted/30 dark:bg-white/5 border border-border/60 rounded-[24px] px-6 text-lg text-foreground font-bold placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/50 focus:bg-muted/50 dark:focus:bg-white/10 transition-all"
                />
              </div>
            </div>

            <div className="space-y-2 group">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 group-focus-within:text-foreground transition-colors ml-2">Password</label>
              <div className="relative">
                <input 
                  name="password" 
                  type="password" 
                  required 
                  placeholder="••••••••" 
                  className="w-full h-16 bg-muted/30 dark:bg-white/5 border border-border/60 rounded-[24px] px-6 text-lg text-foreground font-bold placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/50 focus:bg-muted/50 dark:focus:bg-white/10 transition-all"
                />
              </div>
            </div>

            <div className="pt-4">
              <Button 
                disabled={isPending}
                className="w-full h-16 rounded-[24px] bg-foreground text-background hover:opacity-90 text-lg font-heading font-black shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 group relative overflow-hidden"
              >
                <span className="relative z-10 flex items-center gap-2">
                  {isPending ? "Authenticating" : "Access Workspace"}
                  {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Button>
            </div>
          </form>

          <div className="mt-12 text-center lg:text-left">
            <p className="text-sm text-muted-foreground/60 font-medium flex items-center justify-center lg:justify-start gap-2">
              No access yet? 
              <Link href="/register" className="text-foreground hover:text-primary font-bold transition-colors inline-flex items-center gap-1 group">
                Register <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
