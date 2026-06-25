'use client';

import { useRef, useEffect, useState, createContext, useContext } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import Link from 'next/link';
import { BrainCircuit, Target, LayoutGrid, BarChart3, Lock, Zap, ChevronRight, Clock, Compass, Shield, Rocket, FileText, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import Lenis from 'lenis';

// --- Global Scroll Context for Framer Motion ---
const ScrollContext = createContext<React.RefObject<HTMLDivElement | null> | null>(null);

// --- Parallax Background Elements ---
const FloatingIcons = () => {
  const containerRef = useContext(ScrollContext);
  const { scrollYProgress } = useScroll({ container: containerRef! });
  const y1 = useTransform(scrollYProgress, [0, 1], [0, -500]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -800]);
  const y3 = useTransform(scrollYProgress, [0, 1], [0, -300]);
  const rotate1 = useTransform(scrollYProgress, [0, 1], [0, 360]);
  const rotate2 = useTransform(scrollYProgress, [0, 1], [0, -360]);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10 opacity-50 dark:opacity-30">
      <motion.div style={{ y: y1, rotate: rotate1 }} className="absolute top-[20%] left-[10%] text-blue-400/20 dark:text-blue-500/20">
        <Target className="w-32 h-32" />
      </motion.div>
      <motion.div style={{ y: y2, rotate: rotate2 }} className="absolute top-[60%] right-[15%] text-purple-400/20 dark:text-purple-500/20">
        <BrainCircuit className="w-48 h-48" />
      </motion.div>
      <motion.div style={{ y: y3, rotate: rotate1 }} className="absolute top-[80%] left-[20%] text-pink-400/20 dark:text-pink-500/20">
        <Zap className="w-24 h-24" />
      </motion.div>
      <motion.div style={{ y: y1, rotate: rotate2 }} className="absolute top-[40%] right-[5%] text-emerald-400/20 dark:text-green-500/20">
        <LayoutGrid className="w-32 h-32" />
      </motion.div>
    </div>
  );
};

// --- Sticky Split Section ---
const SplitStorytelling = () => {
  const containerRef = useContext(ScrollContext);
  const targetRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: targetRef,
    container: containerRef!,
    offset: ["start start", "end end"]
  });

  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 20 });
  
  const textOpacity1 = useTransform(smoothProgress, [0, 0.15, 0.3], [0, 1, 0]);
  const textOpacity2 = useTransform(smoothProgress, [0.3, 0.45, 0.6], [0, 1, 0]);
  const textOpacity3 = useTransform(smoothProgress, [0.6, 0.8, 1], [0, 1, 1]);

  const cardY = useTransform(smoothProgress, [0, 1], ["0%", "-66.66%"]);

  return (
    <section ref={targetRef} className="h-[400vh] relative bg-background/50 dark:bg-background border-b border-border/40 backdrop-blur-3xl">
      <div className="sticky top-0 h-screen w-full flex flex-col md:flex-row overflow-hidden max-w-[1600px] mx-auto">
        {/* Left Side: Sticky Text */}
        <div className="w-full md:w-1/2 h-full flex items-center justify-center relative p-8 md:p-16">
          <motion.div style={{ opacity: textOpacity1 }} className="absolute">
            <h2 className="text-5xl md:text-7xl font-heading font-black tracking-tighter leading-tight text-foreground">
              The old way <br/> <span className="opacity-30 dark:opacity-40">is broken.</span>
            </h2>
            <p className="mt-6 text-xl text-muted-foreground max-w-md font-medium leading-relaxed">Fragmented notes, endless distractions, and losing track of what matters. You need a system that works for you, not against you.</p>
          </motion.div>
          
          <motion.div style={{ opacity: textOpacity2 }} className="absolute pointer-events-none text-center md:text-left">
            <h2 className="text-5xl md:text-7xl font-heading font-black tracking-tighter leading-tight text-foreground">
              Absolute <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-500 dark:from-blue-400 dark:to-indigo-400">Focus.</span>
            </h2>
            <p className="mt-6 text-xl text-muted-foreground max-w-md font-medium leading-relaxed">Enter a cinematic focus state. No tabs, no notifications. Just you, the material, and deep work.</p>
          </motion.div>

          <motion.div style={{ opacity: textOpacity3 }} className="absolute pointer-events-none text-center md:text-left">
            <h2 className="text-5xl md:text-7xl font-heading font-black tracking-tighter leading-tight text-foreground">
              A second <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-500 dark:from-purple-400 dark:to-pink-400">brain.</span>
            </h2>
            <p className="mt-6 text-xl text-muted-foreground max-w-md font-medium leading-relaxed">AI-integrated workflows. Drag and drop documents and let the embedded neural engine extract exactly what you need to know.</p>
          </motion.div>
        </div>

        {/* Right Side: Scrolling Cards */}
        <div className="w-full md:w-1/2 h-full relative overflow-hidden hidden md:block">
          <motion.div style={{ y: cardY }} className="absolute w-full h-[300%] flex flex-col pt-[20vh]">
            <div className="h-screen flex items-center justify-center p-8">
              <div className="w-full max-w-md aspect-square bg-white/60 dark:bg-neutral-900/80 backdrop-blur-3xl border border-white/40 dark:border-white/10 rounded-[40px] p-8 shadow-2xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 rounded-full blur-[80px]" />
                <Lock className="w-16 h-16 text-foreground/10 mb-8" />
                <div className="space-y-4">
                  <div className="w-3/4 h-8 bg-foreground/10 rounded-lg" />
                  <div className="w-full h-8 bg-foreground/5 rounded-lg" />
                  <div className="w-5/6 h-8 bg-foreground/5 rounded-lg" />
                </div>
              </div>
            </div>
            <div className="h-screen flex items-center justify-center p-8">
              <div className="w-full max-w-md aspect-square bg-blue-50/60 dark:bg-blue-900/20 backdrop-blur-3xl border border-blue-200/50 dark:border-border/60 rounded-[40px] p-8 shadow-2xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 rounded-full blur-[80px]" />
                <Target className="w-16 h-16 text-blue-500 mb-8" />
                <div className="flex gap-4 h-32">
                  <div className="flex-1 bg-blue-500/10 rounded-2xl" />
                  <div className="flex-1 bg-foreground/5 rounded-2xl" />
                </div>
              </div>
            </div>
            <div className="h-screen flex items-center justify-center p-8">
              <div className="w-full max-w-md aspect-square bg-purple-50/60 dark:bg-purple-900/20 backdrop-blur-3xl border border-purple-200/50 dark:border-border/60 rounded-[40px] p-8 shadow-2xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-[80px]" />
                <img src="/logo.png" alt="Logo" className="w-16 h-16 object-contain mb-8 dark:invert-0 invert" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-16 bg-purple-500/10 rounded-2xl" />
                  <div className="h-16 bg-foreground/5 rounded-2xl" />
                  <div className="h-16 bg-foreground/5 rounded-2xl" />
                  <div className="h-16 bg-foreground/5 rounded-2xl" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

// --- Tightly Packed Horizontal Scroll ---
const HorizontalScrollCarousel = () => {
  const containerRef = useContext(ScrollContext);
  const targetRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({ 
    target: targetRef,
    container: containerRef!,
    offset: ["start start", "end end"]
  });

  const smoothProgress = useSpring(scrollYProgress, { stiffness: 40, damping: 25, mass: 1 });
  
  const x = useTransform(smoothProgress, [0, 1], ["0%", "-75%"]);
  const textX = useTransform(smoothProgress, [0, 1], ["0%", "-30%"]);

  return (
    <section ref={targetRef} className="relative h-[400vh] bg-background border-b border-border/40">
      <div className="sticky top-0 flex flex-col justify-center h-screen overflow-hidden">
        
        {/* Parallax running text positioned ABOVE the cards track */}
        <motion.div 
          style={{ x: textX }}
          className="whitespace-nowrap text-[10vw] md:text-[12vw] font-black text-foreground/5 font-heading pointer-events-none uppercase tracking-tighter mb-12 pl-12"
        >
          ELITE ACADEMIC WORKSTATION • ELITE ACADEMIC WORKSTATION
        </motion.div>

        {/* The horizontal card track */}
        <motion.div style={{ x }} className="flex gap-6 px-8 md:px-24 z-10 relative">
          
          <div className="group relative h-[450px] w-[85vw] md:w-[700px] overflow-hidden rounded-[48px] bg-white/60 dark:bg-card border border-border/60 backdrop-blur-3xl flex flex-col justify-between p-12 flex-shrink-0 shadow-2xl transition-all hover:border-blue-500/30 hover:shadow-blue-500/10">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="flex justify-between items-start relative z-10">
              <LayoutGrid className="w-20 h-20 text-blue-600 dark:text-blue-500" />
              <div className="px-4 py-2 rounded-full border border-border bg-background/80 dark:bg-muted/80 text-muted-foreground text-sm font-bold shadow-sm">01</div>
            </div>
            <div className="relative z-10">
              <h3 className="text-5xl font-heading font-black text-foreground mb-6">Fluid Timetable</h3>
              <p className="text-2xl text-muted-foreground font-medium">Drag, drop, and construct your week with zero friction. The smartest calendar built for academics.</p>
            </div>
          </div>

          <div className="group relative h-[500px] w-[85vw] md:w-[700px] overflow-hidden rounded-[48px] bg-white/60 dark:bg-card border border-border/60 backdrop-blur-3xl flex flex-col justify-between p-12 flex-shrink-0 shadow-2xl transition-all hover:border-orange-500/30 hover:shadow-orange-500/10">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="flex justify-between items-start relative z-10">
              <Target className="w-20 h-20 text-orange-600" />
              <div className="px-4 py-2 rounded-full border border-border bg-background/80 dark:bg-muted/80 text-muted-foreground text-sm font-bold shadow-sm">02</div>
            </div>
            <div className="relative z-10">
              <h3 className="text-5xl font-heading font-black text-foreground mb-6">Deep Focus</h3>
              <p className="text-2xl text-muted-foreground font-medium">Enter the zone. Full-screen immersive timers that block distractions and force you to execute.</p>
            </div>
          </div>

          <div className="group relative h-[500px] w-[85vw] md:w-[700px] overflow-hidden rounded-[48px] bg-white/60 dark:bg-card border border-border/60 backdrop-blur-3xl flex flex-col justify-between p-12 flex-shrink-0 shadow-2xl transition-all hover:border-purple-500/30 hover:shadow-purple-500/10">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="flex justify-between items-start relative z-10">
              <BrainCircuit className="w-20 h-20 text-purple-600" />
              <div className="px-4 py-2 rounded-full border border-border bg-background/80 dark:bg-muted/80 text-muted-foreground text-sm font-bold shadow-sm">03</div>
            </div>
            <div className="relative z-10">
              <h3 className="text-5xl font-heading font-black text-foreground mb-6">AI Architect</h3>
              <p className="text-2xl text-muted-foreground font-medium">Drag in PDFs and images. Your personal AI extracts knowledge and tests your mastery instantly.</p>
            </div>
          </div>

          <div className="group relative h-[500px] w-[85vw] md:w-[700px] overflow-hidden rounded-[48px] bg-white/60 dark:bg-card border border-border/60 backdrop-blur-3xl flex flex-col justify-between p-12 flex-shrink-0 shadow-2xl transition-all hover:border-green-500/30 hover:shadow-green-500/10">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="flex justify-between items-start relative z-10">
              <BarChart3 className="w-20 h-20 text-green-600" />
              <div className="px-4 py-2 rounded-full border border-border bg-background/80 dark:bg-muted/80 text-muted-foreground text-sm font-bold shadow-sm">04</div>
            </div>
            <div className="relative z-10">
              <h3 className="text-5xl font-heading font-black text-foreground mb-6">Live Analytics</h3>
              <p className="text-2xl text-muted-foreground font-medium">Watch your stats grow. Track your XP, maintain your streak, and visually map your syllabus mastery.</p>
            </div>
          </div>

        </motion.div>
      </div>
    </section>
  );
};

// --- Dense Bento Grid ---
const BentoGrid = () => {
  const containerRef = useContext(ScrollContext);
  
  return (
    <section className="py-32 px-6 max-w-[1600px] mx-auto bg-background relative z-10">
      <div className="text-center mb-24 space-y-6">
         <h2 className="text-5xl md:text-7xl font-heading font-black tracking-tighter text-foreground">
           Every detail, <span className="opacity-30 dark:opacity-40">obsessed over.</span>
         </h2>
         <p className="text-xl text-muted-foreground font-medium leading-relaxed">A dense ecosystem of tools designed for seamless flow.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 auto-rows-[300px]">
        {/* Large Bento Box */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ root: containerRef || undefined, once: true, margin: "100px" }}
          transition={{ duration: 0.8 }}
          className="md:col-span-2 lg:col-span-2 row-span-2 rounded-[40px] bg-white/60 dark:bg-gradient-to-br dark:from-card dark:to-background border border-border/60 backdrop-blur-3xl p-10 flex flex-col justify-between relative overflow-hidden group shadow-sm hover:border-primary/30 transition-all"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent opacity-50" />
          <div className="relative z-10">
            <LayoutGrid className="w-12 h-12 text-blue-600 dark:text-blue-500 mb-6" />
            <h3 className="text-4xl font-heading font-black text-foreground mb-4">Command Center</h3>
            <p className="text-lg text-muted-foreground max-w-md font-medium leading-relaxed">Your entire academic life, visualized on a single dashboard. Synchronized, real-time, and lightning fast.</p>
          </div>
          <div className="relative z-10 grid grid-cols-3 gap-4 mt-8 h-40">
             <div className="bg-muted/50 dark:bg-muted/30 rounded-2xl border border-border/40 shadow-inner" />
             <div className="bg-blue-500/10 rounded-2xl border border-blue-500/20 shadow-inner" />
             <div className="bg-muted/50 dark:bg-muted/30 rounded-2xl border border-border/40 shadow-inner" />
          </div>
        </motion.div>

        {/* Small Bento Box 1 */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ root: containerRef || undefined, once: true, margin: "100px" }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="rounded-[40px] bg-white/60 dark:bg-card border border-border/60 backdrop-blur-3xl p-8 flex flex-col justify-between relative overflow-hidden group hover:border-orange-500/50 transition-colors shadow-sm"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <Clock className="w-10 h-10 text-orange-600 dark:text-orange-500 relative z-10" />
          <div className="relative z-10">
            <h4 className="text-2xl font-bold text-foreground mb-2">Time Tracking</h4>
            <p className="text-sm text-muted-foreground font-medium">Every second accounted for.</p>
          </div>
        </motion.div>

        {/* Small Bento Box 2 */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ root: containerRef || undefined, once: true, margin: "100px" }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="rounded-[40px] bg-white/60 dark:bg-card border border-border/60 backdrop-blur-3xl p-8 flex flex-col justify-between relative overflow-hidden group hover:border-purple-500/50 transition-colors shadow-sm"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <FileText className="w-10 h-10 text-purple-600 dark:text-purple-500 relative z-10" />
          <div className="relative z-10">
            <h4 className="text-2xl font-bold text-foreground mb-2">Smart Notes</h4>
            <p className="text-sm text-muted-foreground font-medium">Markdown support out of the box.</p>
          </div>
        </motion.div>

        {/* Medium Bento Box */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ root: containerRef || undefined, once: true, margin: "100px" }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="md:col-span-2 rounded-[40px] bg-white/60 dark:bg-card border border-border/60 backdrop-blur-3xl p-8 flex flex-col sm:flex-row items-center gap-8 relative overflow-hidden group hover:border-green-500/50 transition-colors shadow-sm"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex-1 space-y-4 relative z-10 text-center sm:text-left">
            <Globe className="w-10 h-10 text-green-600 dark:text-green-500 mx-auto sm:mx-0" />
            <h4 className="text-3xl font-bold text-foreground tracking-tight">Global Sync</h4>
            <p className="text-muted-foreground font-medium">Your data travels with you, encrypted and secure.</p>
          </div>
          <div className="w-32 h-32 rounded-full border-[8px] border-green-600/20 dark:border-green-500/20 border-t-green-600 dark:border-t-green-500 animate-spin relative z-10" style={{ animationDuration: '4s' }} />
        </motion.div>
      </div>
    </section>
  );
};

export function WelcomeClient() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateMousePosition = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', updateMousePosition);
    return () => window.removeEventListener('mousemove', updateMousePosition);
  }, []);

  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    const lenis = new Lenis({
      wrapper: scrollContainer,
      content: scrollContainer.firstElementChild as HTMLElement,
      lerp: 0.1,
      smoothWheel: true,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, []);

  return (
    <ScrollContext.Provider value={scrollRef}>
      <div 
        ref={scrollRef}
        className="absolute inset-0 z-50 overflow-y-auto overflow-x-hidden bg-background text-foreground selection:bg-primary/30 selection:text-primary font-sans scroll-smooth"
      >
        {/* Physical Texture Overlay */}
        <div className="fixed inset-0 pointer-events-none z-[100] opacity-[0.04] mix-blend-overlay bg-[url('/textures/carbon-fibre.png')]" />

        {/* Interactive Cursor Glow */}
        <motion.div 
          className="fixed top-0 left-0 w-[400px] h-[400px] rounded-full bg-primary/10 dark:bg-primary/5 blur-[100px] pointer-events-none z-0 hidden md:block"
          animate={{ x: mousePosition.x - 200, y: mousePosition.y - 200 }}
          transition={{ type: 'spring', stiffness: 50, damping: 30, mass: 0.5 }}
        />

        {/* Dynamic Background Mesh (Light Mode) */}
        <div className="fixed inset-0 -z-20 pointer-events-none dark:hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(at_top_left,_rgba(59,130,246,0.3),_transparent_60%),radial-gradient(at_bottom_right,_rgba(168,85,247,0.3),_transparent_60%),radial-gradient(at_top_right,_rgba(236,72,153,0.15),_transparent_60%)] animate-pulse" style={{ animationDuration: '12s' }} />
        </div>

        <FloatingIcons />

        {/* Navbar */}
        <nav className="fixed top-0 left-0 right-0 z-[60] px-8 py-6 pointer-events-none">
          <div className="flex items-center justify-between max-w-[1600px] mx-auto">
            <div className="flex items-center gap-3 font-heading font-black text-2xl text-foreground mix-blend-difference pointer-events-auto group">
              <div className="p-1.5 bg-foreground text-background rounded transition-transform group-hover:rotate-12">
                <img src="/logo.png" alt="Logo" className="h-6 w-6 object-contain invert dark:invert-0" />
              </div>
              <span>StudyFlow</span>
            </div>
            <div className="flex items-center gap-6 pointer-events-auto bg-white/40 dark:bg-background/40 backdrop-blur-3xl border border-white/50 dark:border-border/40 px-6 py-2 rounded-full shadow-2xl shadow-black/5 dark:shadow-none transition-all">
              <ThemeToggle />
              <div className="h-6 w-px bg-border/60 mx-2" />
              <Link href="/login" className="text-sm font-bold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest hidden sm:block">Login</Link>
              <Link href="/register">
                <Button className="rounded-full px-6 h-10 font-bold shadow-xl active:scale-95 transition-all bg-foreground text-background">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <HeroSection />

        <div id="features" className="relative z-10">
          <SplitStorytelling />
          <HorizontalScrollCarousel />
          <BentoGrid />
        </div>

        {/* Final Call to Action */}
        <FooterCTA />

      </div>
    </ScrollContext.Provider>
  );
}

const HeroSection = () => {
  const containerRef = useContext(ScrollContext);
  const heroRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: heroRef,
    container: containerRef!,
    offset: ["start start", "end start"]
  });

  const opacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const y = useTransform(scrollYProgress, [0, 1], [0, 200]);

  return (
    <section ref={heroRef} className="relative h-screen flex flex-col justify-center px-8 md:px-24 max-w-[1600px] mx-auto z-10">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 right-1/4 w-[50vw] h-[50vw] bg-blue-500/20 dark:bg-blue-600/20 blur-[150px] rounded-full mix-blend-multiply dark:mix-blend-screen pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-[40vw] h-[40vw] bg-purple-500/20 dark:bg-purple-600/20 blur-[120px] rounded-full mix-blend-multiply dark:mix-blend-screen pointer-events-none" />
      
      <motion.div 
        style={{ opacity, y }}
        className="space-y-12 max-w-5xl relative z-10"
      >
        <motion.h1 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="text-[5rem] md:text-[10rem] lg:text-[12rem] font-heading font-black tracking-tighter leading-[0.8] text-foreground"
        >
          Focus. <br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 dark:from-blue-400 dark:via-purple-400 dark:to-indigo-400 animate-gradient-x">Rebuilt.</span>
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="text-xl md:text-4xl text-muted-foreground max-w-3xl font-medium leading-tight tracking-tight"
        >
          An incredibly fluid, cinematic workstation designed strictly for elite performance.
        </motion.p>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="pt-8 flex items-center gap-6"
        >
          <Link href="/register">
            <Button className="h-16 px-12 rounded-full text-xl font-bold transition-all hover:scale-105 active:scale-95 group flex items-center gap-3 shadow-2xl shadow-primary/20 dark:shadow-none bg-foreground text-background">
              Start Now <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
          <Link href="#features" className="hidden sm:flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-bold uppercase tracking-widest text-sm">
            <Compass className="w-5 h-5" /> Explore
          </Link>
        </motion.div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
        className="absolute bottom-12 right-12 flex flex-col items-center gap-4 text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/30"
      >
        <div className="w-[1px] h-16 bg-border" />
        Scroll
      </motion.div>
    </section>
  );
};

const FooterCTA = () => {
  const containerRef = useContext(ScrollContext);
  
  return (
    <section className="min-h-screen flex flex-col items-center justify-center px-6 relative bg-background border-t border-border/40 z-10 overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
         <div className="w-[80vw] h-[80vw] bg-primary/10 dark:bg-primary/20 blur-[200px] rounded-full mix-blend-multiply dark:mix-blend-screen" />
      </div>
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ root: containerRef || undefined, once: true }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="text-center space-y-12 relative z-10 max-w-4xl"
      >
        <Shield className="w-20 h-20 text-muted-foreground/10 mx-auto" />
        <h2 className="text-6xl md:text-[10rem] font-heading font-black tracking-tighter leading-none text-foreground uppercase">
          Own your <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 dark:from-blue-400 dark:via-purple-400 dark:to-indigo-400">Future.</span>
        </h2>
        <p className="text-2xl text-muted-foreground font-medium leading-relaxed max-w-2xl mx-auto">Join the elite students who have already upgraded their minds.</p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-8">
          <Link href="/register">
            <Button className="h-20 px-14 rounded-full bg-foreground text-background hover:opacity-90 text-2xl font-black transition-all hover:scale-105 active:scale-95 group shadow-2xl shadow-primary/20 dark:shadow-none">
              Launch Workspace
              <Rocket className="w-8 h-8 ml-3 group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </motion.div>

      <div className="absolute bottom-10 text-[10px] font-bold uppercase tracking-[0.5em] text-muted-foreground/20">
        © 2026 StudyFlow Elite Workstation
      </div>
    </section>
  );
};
