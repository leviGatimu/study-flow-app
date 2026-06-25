"use client";

import { useState, useEffect } from 'react';
import { 
  updateUserName, 
  updatePassword, 
  clearAllTasks, 
  logoutUser, 
  exportUserData, 
  importUserData, 
  verifyDbIntegrity 
} from '@/lib/actions';
import { saveGeminiKey, saveOpenAIKey, setPrimaryAIProvider, saveOllamaConfig, getAIConnectivity } from '@/lib/ai-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  User, 
  Settings,
  ShieldAlert, 
  Bell, 
  Trash2, 
  CheckCircle2, 
  LogOut, 
  BrainCircuit, 
  Palette, 
  Laptop,
  Sun,
  Lock,
  Sparkles,
  Database,
  Info,
  Key,
  Eye,
  EyeOff,
  Trophy,
  Flame,
  Clock,
  Calendar,
  Shield,
  Volume2,
  VolumeX,
  Download,
  Upload,
  HardDrive,
  Check,
  MessageSquare,
  ChevronRight,
  Zap
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PWAInstaller } from '@/components/PWAInstaller';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/ThemeProvider';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { playNotificationSound } from '@/lib/sound';

interface SettingsInterfaceProps {
  initialData: {
    id: string;
    username: string;
    createdAt: Date;
    currentTerm: string;
    progress: {
      name: string;
      geminiApiKey: string | null;
      openaiApiKey: string | null;
      primaryAiProvider: string;
      ollamaEnabled?: boolean;
      ollamaBaseUrl?: string | null;
      ollamaModel?: string | null;
      ollamaVisionModel?: string | null;
      currentStreak: number;
      longestStreak: number;
      focusSessions: number;
      totalFocusMinutes: number;
      xp: number;
      level: number;
    } | null;
  };
}

const ACCENTS = [
  { id: 'blue', label: 'Blue', color: 'bg-blue-500' },
  { id: 'violet', label: 'Violet', color: 'bg-violet-500' },
  { id: 'emerald', label: 'Green', color: 'bg-emerald-500' },
  { id: 'rose', label: 'Rose', color: 'bg-rose-500' },
  { id: 'orange', label: 'Orange', color: 'bg-orange-500' },
] as const;

// --- Reusable Layout Components ---

function SettingsSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
        {children}
      </div>
    </div>
  );
}

function SettingsRow({ label, description, children, icon: Icon }: { label: string; description?: string; children: React.ReactNode; icon?: React.ElementType }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5 min-h-[52px]">
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{label}</p>
          {description && <p className="text-xs text-muted-foreground truncate">{description}</p>}
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-2">
        {children}
      </div>
    </div>
  );
}

// --- Tab Button ---
function NavItem({ label, icon: Icon, active, onClick, count }: { label: string; icon: React.ElementType; active: boolean; onClick: () => void; count?: number }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {count !== undefined && (
        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{count}</span>
      )}
      <ChevronRight className={cn("w-3.5 h-3.5 shrink-0 transition-colors", active ? "text-primary" : "text-muted-foreground/40")} />
    </button>
  );
}

export default function SettingsInterface({ initialData }: SettingsInterfaceProps) {
  const router = useRouter();
  const { theme, setTheme, accent, setAccent } = useTheme();
  
  const [activeTab, setActiveTab] = useState('account');

  // Updating locks
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  
  // Password forms
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Form states
  const [userName, setUserName] = useState(initialData.progress?.name || '');
  const [currentTerm, setCurrentTerm] = useState(initialData.currentTerm || 'Term 1');
  const [geminiKey, setGeminiKey] = useState(initialData.progress?.geminiApiKey || '');
  const [openaiKey, setOpenaiKey] = useState(initialData.progress?.openaiApiKey || '');
  const [primaryAiProvider, setPrimaryAiProviderState] = useState(initialData.progress?.primaryAiProvider || 'gemini');

  // Offline (Ollama) config
  const [ollamaEnabled, setOllamaEnabled] = useState(initialData.progress?.ollamaEnabled ?? true);
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState(initialData.progress?.ollamaBaseUrl || 'http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState(initialData.progress?.ollamaModel || '');
  const [ollamaVisionModel, setOllamaVisionModel] = useState(initialData.progress?.ollamaVisionModel || '');
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'reachable' | 'unreachable'>('checking');

  // Custom Local Settings
  const [preset1, setPreset1] = useState(25);
  const [preset2, setPreset2] = useState(50);
  const [preset3, setPreset3] = useState(90);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundVolume, setSoundVolume] = useState(0.5);
  const [soundEffect, setSoundEffect] = useState<'beep' | 'chime' | 'gong'>('chime');

  const [aiPersona, setAiPersona] = useState('default');

  // Diagnostics status
  const [dbStatus, setDbStatus] = useState<any>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Load from local storage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedPresets = localStorage.getItem('study-flow-focus-presets');
      if (storedPresets) {
        try {
          const parsed = JSON.parse(storedPresets);
          if (Array.isArray(parsed) && parsed.length === 3) {
            setPreset1(parsed[0]);
            setPreset2(parsed[1]);
            setPreset3(parsed[2]);
          }
        } catch (e) {}
      }
      setSoundEnabled(localStorage.getItem('study-flow-sound-enabled') !== 'false');
      setSoundVolume(parseFloat(localStorage.getItem('study-flow-sound-volume') || '0.5'));
      setSoundEffect((localStorage.getItem('study-flow-sound-effect') as any) || 'chime');
      setAiPersona(localStorage.getItem('study-flow-ai-persona') || 'default');
    }
  }, []);

  // Detect installed Ollama models for the offline-model pickers.
  const refreshOllama = async () => {
    setOllamaStatus('checking');
    try {
      const info = await getAIConnectivity();
      setOllamaModels(info.ollamaModels);
      setOllamaStatus(info.ollamaReachable ? 'reachable' : 'unreachable');
    } catch {
      setOllamaStatus('unreachable');
    }
  };

  useEffect(() => {
    refreshOllama();
  }, []);

  const handleUpdateProfile = async () => {
    setIsUpdating(true);
    try {
      await updateUserName(userName);
      const { updateCurrentTerm } = await import('@/lib/actions');
      await updateCurrentTerm(currentTerm);
      toast.success("Profile updated.");
      router.refresh();
    } catch (e: any) {
      toast.error(`Update failed: ${e.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsUpdatingPassword(true);
    setPasswordError(null);
    setPasswordSuccess(false);
    try {
      const formData = new FormData(e.currentTarget);
      const result = await updatePassword(formData);
      if (result.error) {
        setPasswordError(result.error);
        toast.error(result.error);
      } else {
        setPasswordSuccess(true);
        toast.success("Password updated.");
        (e.target as HTMLFormElement).reset();
      }
    } catch (err: any) {
      setPasswordError(err.message);
      toast.error(`Failed: ${err.message}`);
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleUpdateGeminiKey = async () => {
    setIsUpdating(true);
    try {
      const res = await saveGeminiKey(geminiKey);
      if (res.success) {
        toast.success("Gemini API key saved successfully.");
        router.refresh();
      } else {
        toast.error(res.error || "Failed to validate Gemini key.");
      }
    } catch (e: any) {
      toast.error(`Failed to save Gemini key: ${e.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateOpenAIKey = async () => {
    setIsUpdating(true);
    try {
      const res = await saveOpenAIKey(openaiKey);
      if (res.success) {
        toast.success("OpenAI API key saved successfully.");
        router.refresh();
      } else {
        toast.error(res.error || "Failed to validate OpenAI key.");
      }
    } catch (e: any) {
      toast.error(`Failed to save OpenAI key: ${e.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdatePrimaryProvider = async (provider: 'gemini' | 'openai' | 'ollama') => {
    setIsUpdating(true);
    try {
      const res = await setPrimaryAIProvider(provider);
      if (res.success) {
        setPrimaryAiProviderState(provider);
        const label = provider === 'gemini' ? 'Google Gemini' : provider === 'openai' ? 'OpenAI' : 'Offline (Ollama)';
        toast.success(`Primary AI provider set to ${label}.`);
        router.refresh();
      } else {
        toast.error("Failed to update primary AI provider.");
      }
    } catch (e: any) {
      toast.error(`Error: ${e.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveOllama = async () => {
    setIsUpdating(true);
    try {
      const res = await saveOllamaConfig({
        enabled: ollamaEnabled,
        baseUrl: ollamaBaseUrl,
        model: ollamaModel || null,
        visionModel: ollamaVisionModel || null,
      });
      if (res.success) {
        toast.success("Offline model settings saved.");
        await refreshOllama();
        router.refresh();
      } else {
        toast.error(res.error || "Failed to save offline settings.");
      }
    } catch (e: any) {
      toast.error(`Failed to save offline settings: ${e.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSavePresets = () => {
    if (preset1 <= 0 || preset2 <= 0 || preset3 <= 0) {
      toast.error("Durations must be greater than zero.");
      return;
    }
    localStorage.setItem('study-flow-focus-presets', JSON.stringify([preset1, preset2, preset3]));
    toast.success("Timer presets saved.");
  };

  const handleToggleSound = (enabled: boolean) => {
    setSoundEnabled(enabled);
    localStorage.setItem('study-flow-sound-enabled', String(enabled));
  };

  const handleVolumeChange = (vol: number) => {
    setSoundVolume(vol);
    localStorage.setItem('study-flow-sound-volume', String(vol));
  };

  const handleSoundEffectChange = (effect: 'beep' | 'chime' | 'gong') => {
    setSoundEffect(effect);
    localStorage.setItem('study-flow-sound-effect', effect);
    playNotificationSound(effect, soundVolume);
  };

  const handleAiPersonaChange = (val: string) => {
    setAiPersona(val);
    localStorage.setItem('study-flow-ai-persona', val);
    toast.success(`Persona: ${val.charAt(0).toUpperCase() + val.slice(1)}`);
  };

  const handleExportData = async () => {
    try {
      const res = await exportUserData();
      if (res.error) { toast.error(res.error); return; }
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(res.data, null, 2))}`;
      const a = document.createElement('a');
      a.setAttribute('href', jsonString);
      a.setAttribute('download', `studyflow-backup-${format(new Date(), 'yyyy-MM-dd')}.json`);
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Backup downloaded.");
    } catch (e: any) {
      toast.error(`Export failed: ${e.message}`);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (confirm("This will overwrite your current data with this backup. Continue?")) {
          setIsImporting(true);
          const res = await importUserData(parsed);
          if (res.success) {
            toast.success("Data restored.");
            router.refresh();
          } else {
            toast.error(res.error || "Restore failed.");
          }
        }
      } catch (err: any) {
        toast.error(`Parse error: ${err.message}`);
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleVerifyDb = async () => {
    setIsVerifying(true);
    try {
      const res = await verifyDbIntegrity();
      if (res.success) {
        setDbStatus(res.details);
        toast.success("Database OK.");
      } else {
        toast.error(res.error || "Check failed.");
      }
    } catch (err: any) {
      toast.error(`Failed: ${err.message}`);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleReset = async () => {
    if (confirm("This will permanently delete all your tasks, history, templates, and progress. This cannot be undone. Are you sure?")) {
      await clearAllTasks();
      toast.success("All data cleared.");
      router.push('/');
    }
  };

  const tabs = [
    { id: 'account', label: 'Account', icon: User },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'focus', label: 'Focus & Timers', icon: Clock },
    { id: 'ai', label: 'AI Assistant', icon: BrainCircuit },
    { id: 'data', label: 'Data & Backup', icon: Database },
    { id: 'about', label: 'About', icon: Info },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 pt-8 pb-24 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account, preferences, and data.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Sidebar */}
        <nav className="lg:w-56 shrink-0">
          <div className="lg:sticky lg:top-8 space-y-1">
            {tabs.map((tab) => (
              <NavItem
                key={tab.id}
                label={tab.label}
                icon={tab.icon}
                active={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
              />
            ))}
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-8">
          
          {/* ===== ACCOUNT ===== */}
          {activeTab === 'account' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-border bg-card p-4 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-amber-500 mb-1">
                    <Trophy className="w-4 h-4" />
                  </div>
                  <p className="text-xl font-bold">{initialData.progress?.level || 1}</p>
                  <p className="text-[11px] text-muted-foreground">Level</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-orange-500 mb-1">
                    <Flame className="w-4 h-4" />
                  </div>
                  <p className="text-xl font-bold">{initialData.progress?.currentStreak || 0}</p>
                  <p className="text-[11px] text-muted-foreground">Day streak</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-blue-500 mb-1">
                    <Clock className="w-4 h-4" />
                  </div>
                  <p className="text-xl font-bold">{Math.round((initialData.progress?.totalFocusMinutes || 0) / 60)}h</p>
                  <p className="text-[11px] text-muted-foreground">Focus time</p>
                </div>
              </div>

              {/* Profile */}
              <SettingsSection title="Profile">
                <SettingsRow label="Username" description="Your login ID — cannot be changed" icon={User}>
                  <span className="text-sm text-muted-foreground font-mono">{initialData.username}</span>
                </SettingsRow>
                <div className="px-4 py-3.5 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Display Name</Label>
                      <Input 
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        placeholder="Your name" 
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Academic Term</Label>
                      <Input 
                        value={currentTerm}
                        onChange={(e) => setCurrentTerm(e.target.value)}
                        placeholder="e.g. Term 1" 
                        className="h-9"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <p className="text-xs text-muted-foreground">
                      Joined {format(new Date(initialData.createdAt), 'MMM d, yyyy')}
                    </p>
                    <Button 
                      size="sm"
                      disabled={isUpdating || (userName === initialData.progress?.name && currentTerm === initialData.currentTerm)}
                      onClick={handleUpdateProfile}
                    >
                      {isUpdating ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              </SettingsSection>

              {/* Password */}
              <SettingsSection title="Password" description="Change your account password">
                <form onSubmit={handleUpdatePassword} className="px-4 py-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Current</Label>
                      <div className="relative">
                        <Input 
                          name="currentPassword"
                          type={showCurrentPassword ? "text" : "password"}
                          placeholder="••••••••"
                          className="h-9 pr-9"
                        />
                        <button 
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">New</Label>
                      <div className="relative">
                        <Input 
                          name="newPassword"
                          type={showNewPassword ? "text" : "password"}
                          placeholder="••••••••"
                          className="h-9 pr-9"
                        />
                        <button 
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Confirm</Label>
                      <div className="relative">
                        <Input 
                          name="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="••••••••"
                          className="h-9 pr-9"
                        />
                        <button 
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {passwordError && (
                    <p className="text-xs text-destructive font-medium flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5" /> {passwordError}
                    </p>
                  )}
                  {passwordSuccess && (
                    <p className="text-xs text-emerald-600 font-medium flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Password updated.
                    </p>
                  )}

                  <div className="flex justify-end">
                    <Button type="submit" size="sm" disabled={isUpdatingPassword}>
                      {isUpdatingPassword ? "Updating..." : "Update Password"}
                    </Button>
                  </div>
                </form>
              </SettingsSection>

              {/* Session */}
              <SettingsSection title="Session">
                <SettingsRow label="Log out" description="End your current session" icon={LogOut}>
                  <form action={logoutUser}>
                    <Button variant="outline" size="sm" type="submit" className="text-destructive border-destructive/20 hover:bg-destructive/5">
                      Log Out
                    </Button>
                  </form>
                </SettingsRow>
              </SettingsSection>
            </div>
          )}

          {/* ===== APPEARANCE ===== */}
          {activeTab === 'appearance' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              
              <SettingsSection title="Theme" description="Choose your preferred color scheme">
                <SettingsRow label="Mode" icon={Sun}>
                  <div className="flex bg-muted rounded-lg p-0.5 gap-0.5">
                    <button 
                      onClick={() => setTheme('light')}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                        theme === 'light' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Light
                    </button>
                    <button 
                      onClick={() => setTheme('dark')}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                        theme === 'dark' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Dark
                    </button>
                    <button 
                      onClick={() => setTheme('glass')}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                        theme === 'glass' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Glass
                    </button>
                  </div>
                </SettingsRow>
              </SettingsSection>

              <SettingsSection title="Accent Color" description="Tint used across buttons, links, and highlights">
                <div className="px-4 py-4">
                  <div className="flex gap-3">
                    {ACCENTS.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setAccent(item.id as any)}
                        className="flex flex-col items-center gap-1.5 group"
                        title={item.label}
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-full transition-all flex items-center justify-center",
                          item.color,
                          accent === item.id 
                            ? "ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110" 
                            : "opacity-70 group-hover:opacity-100 group-hover:scale-105"
                        )}>
                          {accent === item.id && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                        </div>
                        <span className={cn("text-[10px] font-medium", accent === item.id ? "text-foreground" : "text-muted-foreground")}>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </SettingsSection>

              <SettingsSection title="Notifications" description="Sound alerts for focus timer completion">
                <SettingsRow label="Sound notifications" icon={Bell}>
                  <button
                    onClick={() => handleToggleSound(!soundEnabled)}
                    className={cn(
                      "w-11 h-6 rounded-full flex items-center px-0.5 transition-colors duration-200",
                      soundEnabled ? "bg-primary" : "bg-muted-foreground/30"
                    )}
                  >
                    <div className={cn(
                      "h-5 w-5 bg-white rounded-full shadow transition-transform duration-200",
                      soundEnabled ? "translate-x-5" : "translate-x-0"
                    )} />
                  </button>
                </SettingsRow>

                {soundEnabled && (
                  <>
                    <SettingsRow label="Volume" icon={Volume2}>
                      <div className="flex items-center gap-3 w-40">
                        <input 
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={soundVolume}
                          onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                        />
                        <span className="text-xs text-muted-foreground w-8 text-right">{Math.round(soundVolume * 100)}%</span>
                      </div>
                    </SettingsRow>
                    <SettingsRow label="Sound effect" description="Click to preview">
                      <div className="flex gap-1.5">
                        {(['beep', 'chime', 'gong'] as const).map((eff) => (
                          <button
                            key={eff}
                            type="button"
                            onClick={() => handleSoundEffectChange(eff)}
                            className={cn(
                              "px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize",
                              soundEffect === eff 
                                ? "bg-primary text-primary-foreground" 
                                : "bg-muted text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {eff}
                          </button>
                        ))}
                      </div>
                    </SettingsRow>
                  </>
                )}
              </SettingsSection>

              <SettingsSection title="Install App" description="Add Study Flow to your desktop">
                <div className="px-4 py-3">
                  <PWAInstaller />
                </div>
              </SettingsSection>
            </div>
          )}

          {/* ===== FOCUS & TIMERS ===== */}
          {activeTab === 'focus' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              
              <SettingsSection title="Pomodoro Presets" description="Customize the quick-start timer durations on your dashboard">
                <div className="px-4 py-4 space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Short</Label>
                      <div className="relative">
                        <Input 
                          type="number"
                          value={preset1}
                          min={1}
                          max={180}
                          onChange={(e) => setPreset1(parseInt(e.target.value) || 0)}
                          className="h-9 text-center pr-10"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">min</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Standard</Label>
                      <div className="relative">
                        <Input 
                          type="number"
                          value={preset2}
                          min={1}
                          max={180}
                          onChange={(e) => setPreset2(parseInt(e.target.value) || 0)}
                          className="h-9 text-center pr-10"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">min</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground">Deep</Label>
                      <div className="relative">
                        <Input 
                          type="number"
                          value={preset3}
                          min={1}
                          max={180}
                          onChange={(e) => setPreset3(parseInt(e.target.value) || 0)}
                          className="h-9 text-center pr-10"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">min</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" onClick={handleSavePresets}>
                      Save Presets
                    </Button>
                  </div>
                </div>
              </SettingsSection>

              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Info className="w-4 h-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">How presets work</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      These three durations appear as quick-start buttons on the Focus Mode widget. 
                      Choose values that match your study patterns — for example, 25 min for a quick review, 
                      50 min for a standard session, and 90 min for deep work.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===== AI ASSISTANT ===== */}
          {activeTab === 'ai' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              
              <SettingsSection title="AI Persona" description="Choose how the AI study assistant communicates">
                <div className="px-4 py-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { id: 'default', label: 'Balanced', desc: 'Standard companion' },
                      { id: 'socratic', label: 'Socratic', desc: 'Teaches via questions' },
                      { id: 'coach', label: 'Strict', desc: 'Focus-driven coach' },
                      { id: 'encourager', label: 'Supportive', desc: 'Warm feedback' }
                    ].map((per) => (
                      <button
                        key={per.id}
                        type="button"
                        onClick={() => handleAiPersonaChange(per.id)}
                        className={cn(
                          "p-3 rounded-lg border text-left transition-all",
                          aiPersona === per.id
                            ? "bg-primary/10 border-primary text-foreground"
                            : "bg-transparent border-border hover:border-primary/30 text-foreground"
                        )}
                      >
                        <span className="text-sm font-medium block">{per.label}</span>
                        <span className="text-[11px] text-muted-foreground block mt-0.5">{per.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </SettingsSection>

              <SettingsSection title="AI Providers & Keys" description="Configure cloud keys (Gemini/OpenAI) and a local offline model (Ollama). The app uses your cloud key when online and automatically falls back to Ollama when offline.">
                <div className="px-4 py-4 space-y-6">
                  {/* Primary Selector */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">Primary AI Provider</Label>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => handleUpdatePrimaryProvider('gemini')}
                        className={cn(
                          "flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all",
                          primaryAiProvider === 'gemini'
                            ? "border-primary bg-primary/5 text-foreground shadow-sm font-semibold"
                            : "border-border hover:border-muted-foreground/30 text-muted-foreground"
                        )}
                      >
                        <span className="font-bold text-sm">Google Gemini</span>
                        <span className="text-[10px] text-muted-foreground mt-1">Cloud · falls back to OpenAI/offline</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleUpdatePrimaryProvider('openai')}
                        className={cn(
                          "flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all",
                          primaryAiProvider === 'openai'
                            ? "border-primary bg-primary/5 text-foreground shadow-sm font-semibold"
                            : "border-border hover:border-muted-foreground/30 text-muted-foreground"
                        )}
                      >
                        <span className="font-bold text-sm">OpenAI</span>
                        <span className="text-[10px] text-muted-foreground mt-1">Cloud · falls back to Gemini/offline</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleUpdatePrimaryProvider('ollama')}
                        className={cn(
                          "flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all",
                          primaryAiProvider === 'ollama'
                            ? "border-primary bg-primary/5 text-foreground shadow-sm font-semibold"
                            : "border-border hover:border-muted-foreground/30 text-muted-foreground"
                        )}
                      >
                        <span className="font-bold text-sm">Offline (Ollama)</span>
                        <span className="text-[10px] text-muted-foreground mt-1">Local · always tried first</span>
                      </button>
                    </div>
                  </div>

                  {/* Gemini Key Input */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold tracking-wider uppercase text-muted-foreground flex items-center gap-1.5">
                        Google Gemini API Key
                      </Label>
                      {initialData.progress?.geminiApiKey && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-medium">Configured</span>
                      )}
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-3 flex items-center text-muted-foreground">
                        <Key className="w-3.5 h-3.5" />
                      </div>
                      <Input 
                        type="password"
                        value={geminiKey}
                        onChange={(e) => setGeminiKey(e.target.value)}
                        placeholder="Paste your Gemini API key here" 
                        className="h-10 pl-9 font-mono text-xs"
                      />
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-muted-foreground">
                        Recommended: <span className="font-medium text-foreground">gemini-2.0-flash</span>.
                      </span>
                      <Button 
                        size="xs"
                        disabled={isUpdating || geminiKey === (initialData.progress?.geminiApiKey || '')}
                        onClick={handleUpdateGeminiKey}
                        className="h-7 text-xs px-3"
                      >
                        {isUpdating ? "Saving..." : "Save Gemini Key"}
                      </Button>
                    </div>
                  </div>

                  {/* OpenAI Key Input */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold tracking-wider uppercase text-muted-foreground flex items-center gap-1.5">
                        OpenAI API Key
                      </Label>
                      {initialData.progress?.openaiApiKey && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-medium">Configured</span>
                      )}
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-3 flex items-center text-muted-foreground">
                        <Key className="w-3.5 h-3.5" />
                      </div>
                      <Input 
                        type="password"
                        value={openaiKey}
                        onChange={(e) => setOpenaiKey(e.target.value)}
                        placeholder="Paste your OpenAI API key here (sk-...)" 
                        className="h-10 pl-9 font-mono text-xs"
                      />
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-muted-foreground">
                        Recommended: <span className="font-medium text-foreground">gpt-4o-mini</span>.
                      </span>
                      <Button 
                        size="xs"
                        disabled={isUpdating || openaiKey === (initialData.progress?.openaiApiKey || '')}
                        onClick={handleUpdateOpenAIKey}
                        className="h-7 text-xs px-3"
                      >
                        {isUpdating ? "Saving..." : "Save OpenAI Key"}
                      </Button>
                    </div>
                  </div>
                  
                  {/* Offline Model (Ollama) */}
                  <div className="space-y-3 rounded-xl border border-border p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Laptop className="w-4 h-4 text-muted-foreground" />
                        <Label className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">Offline Model (Ollama)</Label>
                      </div>
                      {ollamaStatus === 'checking' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">Checking…</span>
                      )}
                      {ollamaStatus === 'reachable' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-medium">Detected — {ollamaModels.length} model{ollamaModels.length === 1 ? '' : 's'}</span>
                      )}
                      {ollamaStatus === 'unreachable' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 font-medium">Ollama not running</span>
                      )}
                    </div>

                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      When the internet is unavailable, the app uses a model running locally via Ollama. Install from ollama.com and pull a model (e.g. <code className="font-mono">ollama pull llama3.1</code>).
                    </p>

                    {/* Enabled toggle */}
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={ollamaEnabled}
                        onChange={(e) => setOllamaEnabled(e.target.checked)}
                        className="h-4 w-4 rounded border-border accent-primary"
                      />
                      <span className="text-xs text-foreground">Enable offline fallback</span>
                    </label>

                    {/* Base URL */}
                    <div className="space-y-1.5">
                      <Label className="text-[10px] tracking-wider uppercase text-muted-foreground">Server URL</Label>
                      <div className="flex gap-2">
                        <Input
                          value={ollamaBaseUrl}
                          onChange={(e) => setOllamaBaseUrl(e.target.value)}
                          placeholder="http://localhost:11434"
                          className="h-9 font-mono text-xs"
                        />
                        <Button size="xs" variant="outline" onClick={refreshOllama} className="h-9 text-xs px-3 shrink-0">Detect</Button>
                      </div>
                    </div>

                    {/* Text model */}
                    <div className="space-y-1.5">
                      <Label className="text-[10px] tracking-wider uppercase text-muted-foreground">Text / chat model</Label>
                      {ollamaModels.length > 0 ? (
                        <select
                          value={ollamaModel}
                          onChange={(e) => setOllamaModel(e.target.value)}
                          className="h-9 w-full rounded-md border border-border bg-background px-2 text-xs"
                        >
                          <option value="">Auto (first available)</option>
                          {ollamaModels.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      ) : (
                        <Input
                          value={ollamaModel}
                          onChange={(e) => setOllamaModel(e.target.value)}
                          placeholder="e.g. llama3.1"
                          className="h-9 font-mono text-xs"
                        />
                      )}
                    </div>

                    {/* Vision model */}
                    <div className="space-y-1.5">
                      <Label className="text-[10px] tracking-wider uppercase text-muted-foreground">Vision model (for images, optional)</Label>
                      {ollamaModels.length > 0 ? (
                        <select
                          value={ollamaVisionModel}
                          onChange={(e) => setOllamaVisionModel(e.target.value)}
                          className="h-9 w-full rounded-md border border-border bg-background px-2 text-xs"
                        >
                          <option value="">None</option>
                          {ollamaModels.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      ) : (
                        <Input
                          value={ollamaVisionModel}
                          onChange={(e) => setOllamaVisionModel(e.target.value)}
                          placeholder="e.g. llama3.2-vision"
                          className="h-9 font-mono text-xs"
                        />
                      )}
                    </div>

                    <div className="flex justify-end">
                      <Button size="xs" onClick={handleSaveOllama} disabled={isUpdating} className="h-7 text-xs px-3">
                        {isUpdating ? "Saving..." : "Save Offline Settings"}
                      </Button>
                    </div>
                  </div>

                  {/* Explanatory Info Card */}
                  <div className="rounded-xl border border-primary/10 bg-primary/5 p-3 text-xs text-muted-foreground leading-relaxed flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-foreground">Smart Failover Enabled:</span> When online, your primary cloud provider is used (falling back to the secondary key on quota/rate-limit errors). When you go offline, the app automatically switches to your local Ollama model — so chat, notes, and quizzes keep working without internet.
                    </div>
                  </div>
                </div>
              </SettingsSection>
            </div>
          )}

          {/* ===== DATA & BACKUP ===== */}
          {activeTab === 'data' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Shield className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Your data stays local</p>
                    <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">
                      Everything is stored in a local SQLite database on this machine. Nothing is sent to any server.
                    </p>
                  </div>
                </div>
              </div>

              <SettingsSection title="Backup" description="Export or restore your data">
                <SettingsRow label="Export data" description="Download a JSON backup of all your data" icon={Download}>
                  <Button size="sm" variant="outline" onClick={handleExportData}>
                    Export
                  </Button>
                </SettingsRow>
                <SettingsRow label="Import data" description="Restore from a previous backup" icon={Upload}>
                  <div className="relative">
                    <input 
                      type="file"
                      accept=".json"
                      onChange={handleImportFile}
                      disabled={isImporting}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Button size="sm" variant="outline" disabled={isImporting}>
                      {isImporting ? "Importing..." : "Import"}
                    </Button>
                  </div>
                </SettingsRow>
              </SettingsSection>

              <SettingsSection title="Diagnostics" description="Check database health and record counts">
                <div className="px-4 py-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                        <HardDrive className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Database integrity</p>
                        <p className="text-xs text-muted-foreground">Verify connections and count records</p>
                      </div>
                    </div>
                    <Button 
                      size="sm"
                      variant="outline"
                      disabled={isVerifying} 
                      onClick={handleVerifyDb}
                    >
                      {isVerifying ? "Checking..." : "Run Check"}
                    </Button>
                  </div>

                  {dbStatus && (
                    <div className="mt-4 p-3 bg-muted/50 rounded-lg border border-border text-xs space-y-1.5 animate-in fade-in duration-300">
                      <p className="text-emerald-600 font-medium flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" /> All checks passed
                      </p>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-muted-foreground pt-1">
                        <span>Provider:</span> <span className="text-foreground font-medium">{dbStatus.provider}</span>
                        <span>Tasks:</span> <span className="text-foreground font-medium">{dbStatus.tasks}</span>
                        <span>Templates:</span> <span className="text-foreground font-medium">{dbStatus.templates}</span>
                        <span>Homeworks:</span> <span className="text-foreground font-medium">{dbStatus.homeworks}</span>
                        <span>Projects:</span> <span className="text-foreground font-medium">{dbStatus.projects}</span>
                      </div>
                    </div>
                  )}
                </div>
              </SettingsSection>

              {/* Danger Zone */}
              <SettingsSection title="Danger Zone">
                <div className="px-4 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-destructive">Delete all data</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Permanently remove all tasks, templates, history, and progress. This cannot be undone.</p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleReset}
                      className="text-destructive border-destructive/20 hover:bg-destructive/5 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete All
                    </Button>
                  </div>
                </div>
              </SettingsSection>
            </div>
          )}

          {/* ===== ABOUT ===== */}
          {activeTab === 'about' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="rounded-xl border border-border bg-card p-8 text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-xl font-bold">Study Flow</h2>
                <p className="text-sm text-muted-foreground mt-1">Version 0.1.8</p>
                <div className="h-px bg-border my-6 max-w-xs mx-auto" />
                <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                  A private, offline-first study tracker built to help you manage your schedule, 
                  track assignments, and stay focused during exam season.
                </p>
                <div className="flex items-center justify-center gap-6 mt-6 text-xs text-muted-foreground">
                  <div>
                    <span className="font-bold text-foreground block">Local</span>
                    <span>Data storage</span>
                  </div>
                  <div className="w-px h-8 bg-border" />
                  <div>
                    <span className="font-bold text-foreground block">Offline</span>
                    <span>First design</span>
                  </div>
                  <div className="w-px h-8 bg-border" />
                  <div>
                    <span className="font-bold text-foreground block">Next.js</span>
                    <span>Framework</span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
