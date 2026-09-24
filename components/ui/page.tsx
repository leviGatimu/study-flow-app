import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The frame every page sits in. It copies the dashboard's geometry exactly:
 * a 1600px column, the px-4/md:px-8 gutter, a header band ruled off with
 * border-border/40, then the body at space-y-8. Pages compose
 * <Page><PageHeader/><PageBody/></Page> and never re-type these classes, which
 * is what let every page drift apart before.
 *
 * `bleed` is for the few screens that are one full-height tool (the resource
 * explorer): no bottom padding and no max width, so the tool can fill the pane.
 */
export function Page({
  className,
  bleed = false,
  ...props
}: React.ComponentProps<"div"> & { bleed?: boolean }) {
  return (
    <div
      data-slot="page"
      className={cn(
        "flex flex-col animate-in fade-in duration-500",
        bleed ? "h-full" : "max-w-[1600px] mx-auto w-full pb-16",
        className
      )}
      {...props}
    />
  );
}

/** Everything below the page header, on the dashboard's gutter and rhythm. */
export function PageBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="page-body"
      className={cn("px-4 md:px-8 pt-8 space-y-8", className)}
      {...props}
    />
  );
}
