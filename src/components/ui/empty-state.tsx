import type { ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  actionLabel,
  onAction,
  className,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <Card className={cn("border-dashed border-2 border-border/50 bg-muted/30", className)}>
      <CardContent className="flex flex-col items-center justify-center p-12 text-center space-y-4">
        {Icon && (
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary">
            <Icon className="h-8 w-8" />
          </div>
        )}
        <div className="space-y-2 max-w-md">
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        </div>
        {action && onAction && (
          <Button onClick={onAction} className="shadow-lg shadow-primary/25">
            {actionLabel || action}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function EmptyStateSimple({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center p-12 text-center space-y-4", className)}>
      {Icon && (
        <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <div className="space-y-2">
        <h3 className="text-base font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
