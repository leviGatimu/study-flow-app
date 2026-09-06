import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The app's one surface treatment: a bordered card on the card background.
 *
 * Deliberately has no hover lift, no gradient, no blurred glow orb and no
 * arbitrary radius — those are the four things that made every panel in the app
 * look like it came from a different product. Use `Card` from ui/card when you
 * need the header/footer slots; use `Panel` for a plain surface.
 */
export function Panel({
  className,
  padded = true,
  ...props
}: React.ComponentProps<"div"> & { padded?: boolean }) {
  return (
    <div
      data-slot="panel"
      className={cn(
        "rounded-2xl border border-border bg-card text-card-foreground",
        padded && "p-5",
        className
      )}
      {...props}
    />
  );
}
