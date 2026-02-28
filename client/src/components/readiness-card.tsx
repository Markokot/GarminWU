import { useState, useRef, useEffect, useCallback } from "react";
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
  Brain,
  Battery,
  Footprints,
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
  dailyStats?: {
    stressLevel: number | null;
    bodyBattery: number | null;
    steps: number | null;
  };
}

const factorIcons: Record<string, typeof Activity> = {
  weeklyLoad: Activity,
  consecutiveIntense: Zap,
  restDays: BedDouble,
  recovery: HeartPulse,
  stress: Brain,
  bodyBattery: Battery,
  steps: Footprints,
};

const factorNames: Record<string, string> = {
  weeklyLoad: "Нагрузка 7д",
  consecutiveIntense: "Интенсивность",
  restDays: "Дни отдыха",
  recovery: "Восстановление",
  stress: "Стресс",
  bodyBattery: "Body Battery",
  steps: "Шаги",
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

export function ReadinessBadge() {
  const [expanded, setExpanded] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});

  const { data: readiness, isLoading, error } = useQuery<ReadinessResult>({
    queryKey: ["/api/readiness"],
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const updatePosition = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const popupW = 288;
    let left = rect.left;
    if (left + popupW > window.innerWidth - 8) {
      left = window.innerWidth - popupW - 8;
    }
    if (left < 8) left = 8;
    setPopupStyle({
      position: "fixed" as const,
      top: rect.bottom + 8,
      left,
      width: Math.min(popupW, window.innerWidth - 16),
      zIndex: 9999,
    });
  }, []);

  useEffect(() => {
    if (!expanded) return;
    updatePosition();
    const onClickOutside = (e: MouseEvent) => {
      if (
        btnRef.current?.contains(e.target as Node) ||
        popupRef.current?.contains(e.target as Node)
      ) return;
      setExpanded(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("resize", updatePosition);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("resize", updatePosition);
    };
  }, [expanded, updatePosition]);

  if (isLoading || error || !readiness) return null;

  const colors = levelColors[readiness.level];

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setExpanded(!expanded)}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${colors.bg} ring-1 ${colors.ring} hover:ring-2`}
        data-testid="badge-readiness"
      >
        <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
        <span className={colors.text}>Готовность {readiness.score}</span>
        {expanded ? (
          <ChevronUp className={`w-3.5 h-3.5 ${colors.text}`} />
        ) : (
          <ChevronDown className={`w-3.5 h-3.5 ${colors.text}`} />
        )}
      </button>

      {expanded && (
        <div ref={popupRef} style={popupStyle} className="rounded-lg border bg-popover p-3 shadow-lg" data-testid="readiness-popup">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
            <span className={`text-sm font-semibold ${colors.text}`}>{readiness.label}</span>
            <span className="text-xs text-muted-foreground ml-auto">{readiness.score}/100</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">{readiness.summary}</p>
          {(() => {
            const trainingFactors = readiness.factors.filter(f =>
              ["weeklyLoad", "consecutiveIntense", "restDays", "recovery"].includes(f.name)
            );
            const healthFactors = readiness.factors.filter(f =>
              ["stress", "bodyBattery", "steps"].includes(f.name)
            );
            const renderBadgeFactor = (factor: ReadinessFactor) => {
              const Icon = factorIcons[factor.name] || Activity;
              const pct = (factor.score / factor.maxScore) * 100;
              return (
                <div key={factor.name} className="flex items-center gap-2.5">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-medium">
                        {factorNames[factor.name] || factor.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
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
                  </div>
                </div>
              );
            };
            return (
              <div className="border-t pt-2.5">
                <div className="space-y-2.5">
                  {trainingFactors.map(renderBadgeFactor)}
                </div>
                {healthFactors.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 mt-2.5 mb-2">
                      <div className="flex-1 border-t" />
                      <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Здоровье</span>
                      <div className="flex-1 border-t" />
                    </div>
                    <div className="space-y-2.5">
                      {healthFactors.map(renderBadgeFactor)}
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </>
  );
}

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

        {expanded && (() => {
          const trainingFactors = readiness.factors.filter(f =>
            ["weeklyLoad", "consecutiveIntense", "restDays", "recovery"].includes(f.name)
          );
          const healthFactors = readiness.factors.filter(f =>
            ["stress", "bodyBattery", "steps"].includes(f.name)
          );

          const renderFactor = (factor: ReadinessFactor) => {
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
          };

          return (
            <div className="mt-4 border-t pt-3" data-testid="readiness-factors">
              <div className="space-y-2.5">
                {trainingFactors.map(renderFactor)}
              </div>
              {healthFactors.length > 0 && (
                <>
                  <div className="flex items-center gap-2 mt-3 mb-2.5">
                    <div className="flex-1 border-t" />
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Здоровье</span>
                    <div className="flex-1 border-t" />
                  </div>
                  <div className="space-y-2.5">
                    {healthFactors.map(renderFactor)}
                  </div>
                </>
              )}
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}
