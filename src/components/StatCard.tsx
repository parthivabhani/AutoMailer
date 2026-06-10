import type { ComponentType } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  trend,
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ComponentType<{ className?: string }>;
  trend?: "up" | "down" | "neutral";
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/10",
        className,
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <CardContent className="p-6 relative">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
              {label}
            </p>
            <p className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              {value}
            </p>
            {hint && (
              <div className="flex items-center gap-2">
                {trend === "up" && (
                  <div className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                      />
                    </svg>
                    Increased
                  </div>
                )}
                {trend === "down" && (
                  <div className="flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
                      />
                    </svg>
                    Decreased
                  </div>
                )}
                <p className="text-xs text-muted-foreground">{hint}</p>
              </div>
            )}
          </div>
          {Icon && (
            <div className="rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 p-3 text-primary shadow-sm group-hover:scale-110 transition-transform duration-300">
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
