import { Loader2 } from "lucide-react";

/**
 * The session screen is a full-screen overlay, so its loading state is one
 * too: a page skeleton here would flash the app chrome's layout underneath
 * a screen that is about to cover it.
 */
export default function Loading() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background">
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Loading focus session" />
    </div>
  );
}
