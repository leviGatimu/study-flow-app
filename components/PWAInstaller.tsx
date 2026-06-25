"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Monitor } from "lucide-react";

export function PWAInstaller() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      setIsInstallable(false);
      setDeferredPrompt(null);
    }
  };

  if (!isInstallable) return null;

  return (
    <Button 
      onClick={handleInstallClick}
      className="w-full h-12 rounded-xl font-black gap-2 bg-primary text-white shadow-lg shadow-primary/20 hover:shadow-primary/40 active:scale-95 transition-all"
    >
      <Monitor className="w-4 h-4" /> INSTALL AS APP
    </Button>
  );
}
