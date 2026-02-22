import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ChevronUp,
  Activity,
  Zap,
  BedDouble,
  HeartPulse,
} from "lucide-react";

interface ReadinessFactor {
  name: string;
  score: number;
  maxScore: number;
  label: string;
  description: string;
}

interface ReadinessResult {
  score: number;
  level: "green" | "yellow" | "red";
  label: string;
  factors: ReadinessFactor[];
  summary: string;
}

const factorIcons: Record<string, typeof Activity> = {
  weeklyLoad: Activity,
  consecutiveIntense: Zap,
  restDays: BedDouble,
  recovery: HeartPulse,
};

const factorNames: Record<string, string> = {
  weeklyLoad: "Нагрузка 7д",
  consecutiveIntense: "Интенсивность",
  restDays: "Дни отдыха",
  recovery: "Восстановление",
};

const levelColors: Record<string, { bg: string; text: string; ring: string; dot: string }> = {
  green: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-500/30",
    dot: "bg-emerald-500",
  },
  yellow: {
    bg: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    ring: "ring-amber-500/30",
    dot: "bg-amber-500",
  },
  red: {
    bg: "bg-red-500/10",
    text: "text-red-600 dark:text-red-400",
    ring: "ring-red-500/30",
    dot: "bg-red-500",
  },
};

export function ReadinessCard() {
  const [expanded, setExpanded] = useState(false);

  const { data: readiness, isLoading, error } = useQuery<ReadinessResult>({
    queryKey: ["/api/readiness"],
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-3 bg-muted rounded w-2/3" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !readiness) return null;

  const colors = levelColors[readiness.level];

  return (
    <Card
      className={`cursor-pointer transition-all ${colors.bg} ring-1 ${colors.ring}`}
      onClick={() => setExpanded(!expanded)}
      data-testid="card-readiness"
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`relative w-12 h-12 rounded-full flex items-center justify-center ${colors.bg} ring-2 ${colors.ring}`}>
            <span className={`text-lg font-bold ${colors.text}`} data-testid="text-readiness-score">
              {readiness.score}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
              <span className={`text-sm font-semibold ${colors.text}`} data-testid="text-readiness-label">
                {readiness.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {readiness.summary}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs hidden sm:flex">
              {readiness.score}/100
            </Badge>
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </div>

        {expanded && (
          <div className="mt-4 space-y-2.5 border-t pt-3" data-testid="readiness-factors">
            {readiness.factors.map((factor) => {
              const Icon = factorIcons[factor.name] || Activity;
              const pct = (factor.score / factor.maxScore) * 100;
              return (
                <div key={factor.name} className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">
                        {factorNames[factor.name] || factor.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {factor.label}
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div
                        className={`rounded-full h-1.5 transition-all ${
                          pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{factor.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
