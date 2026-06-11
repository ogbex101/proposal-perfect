import * as React from "react";
import { cn } from "@/lib/utils";

/** A card framed with technical-drawing crop marks at each corner. */
export function CropCard({
  className,
  children,
  glow = "teal",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { glow?: "teal" | "gold" | "none" }) {
  return (
    <div
      className={cn(
        "relative rounded-lg border bg-card/70 backdrop-blur-sm",
        glow === "teal" && "glow-teal",
        glow === "gold" && "glow-gold",
        className,
      )}
      {...props}
    >
      <Corner className="left-[-1px] top-[-1px] border-l-2 border-t-2" />
      <Corner className="right-[-1px] top-[-1px] border-r-2 border-t-2" />
      <Corner className="bottom-[-1px] left-[-1px] border-b-2 border-l-2" />
      <Corner className="bottom-[-1px] right-[-1px] border-b-2 border-r-2" />
      {children}
    </div>
  );
}

function Corner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("pointer-events-none absolute h-3 w-3 border-gold/70", className)}
    />
  );
}

/** Monospace eyebrow label, optionally numbered like a drafting stage. */
export function Eyebrow({
  children,
  index,
  className,
}: {
  children: React.ReactNode;
  index?: string;
  className?: string;
}) {
  return (
    <span className={cn("annotation inline-flex items-center gap-2", className)}>
      {index && <span className="text-gold/80">{index}</span>}
      {index && <span className="h-px w-5 bg-teal/40" />}
      {children}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <CropCard className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-lg border border-teal/30 bg-teal/5">
        <Icon className="h-5 w-5 text-teal" />
      </span>
      <h3 className="mt-4 text-base font-semibold text-white">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </CropCard>
  );
}

export function Logo({
  className,
  withText = true,
}: {
  className?: string;
  withText?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative grid h-8 w-8 place-items-center rounded-md border border-gold/40 bg-gold/10">
        <span className="absolute inset-1.5 rounded-[3px] border border-teal/40" />
        <span className="h-1.5 w-1.5 rounded-full bg-gold" />
      </span>
      {withText && (
        <span className="font-display text-[15px] font-bold tracking-tight text-white">
          Xperience<span className="text-gold"> Props</span>
        </span>
      )}
    </span>
  );
}
