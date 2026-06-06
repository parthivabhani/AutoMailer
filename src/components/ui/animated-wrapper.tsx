import { cn } from "@/lib/utils";

export function FadeIn({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <div
      className={cn("animate-in fade-in duration-500", className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export function SlideIn({ children, className, direction = "up", delay = 0 }: { 
  children: React.ReactNode; 
  className?: string; 
  direction?: "up" | "down" | "left" | "right";
  delay?: number;
}) {
  const directionClasses = {
    up: "slide-in-from-bottom-4",
    down: "slide-in-from-top-4",
    left: "slide-in-from-right-4",
    right: "slide-in-from-left-4",
  };

  return (
    <div
      className={cn("animate-in slide-in duration-500", directionClasses[direction], className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export function ScaleIn({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <div
      className={cn("animate-in zoom-in duration-300", className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export function Pulse({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("animate-pulse", className)}>
      {children}
    </div>
  );
}

export function Bounce({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("animate-bounce", className)}>
      {children}
    </div>
  );
}

export function Spin({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("animate-spin", className)}>
      {children}
    </div>
  );
}
