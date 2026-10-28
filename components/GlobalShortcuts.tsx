"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function GlobalShortcuts() {
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.querySelector('.practice-workspace')) return;

      // Alt + F for Focus Mode
      if (e.altKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        router.push("/focus");
      }

      // Alt + D for Dashboard
      if (e.altKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        router.push("/");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  return null;
}
