import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ChatMessage, Workout, GarminWatchModel, RescheduleData, WorkoutExplanation } from "@shared/schema";
import { garminWatchLabels, swimStructuredWatchModels } from "@shared/schema";
import {
  Send,
  Bot,
  User,
  Dumbbell,
  Watch,
  Loader2,
  Sparkles,
  CalendarDays,
  BarChart3,
  Star,
  ChevronDown,
  ChevronUp,
  ListChecks,
  AlertTriangle,
  Trash2,
  HelpCircle,
  CalendarClock,
  Check,
  Lightbulb,
} from "lucide-react";
import { GarminGuideDialog } from "@/components/garmin-guide-dialog";
import { ReadinessBadge } from "@/components/readiness-card";
import { useTranslation } from "@/i18n/context";
import type { Language } from "@/i18n/types";

const localeMap: Record<Language, string> = {
  ru: "ru-RU",
  en: "en-US",
  zh: "zh-CN",
  fr: "fr-FR",
};

function formatTime(ts: string, language: Language) {
  return new Date(ts).toLocaleTimeString(localeMap[language], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateStr: string, language: Language) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString(localeMap[language], {
    day: "numeric",
    month: "long",
    weekday: "short",
  });
}

function WorkoutExplanationBlock({ explanation }: { explanation: WorkoutExplanation }) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  const lines = [
    explanation.why ? { label: t("coach.explanationGoal"), value: explanation.why, testId: "text-explanation-why" } : null,
    explanation.adaptation ? { label: t("coach.explanationAdaptation"), value: explanation.adaptation, testId: "text-explanation-adaptation" } : null,
    explanation.successSignal ? { label: t("coach.explanationSuccess"), value: explanation.successSignal, testId: "text-explanation-success" } : null,
  ].filter(Boolean) as { label: string; value: string; testId: string }[];

  if (lines.length === 0) return null;

  return (
    <div className="mb-3" data-testid="card-workout-explanation">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        data-testid="button-toggle-explanation"
      >
        <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
        <span>{t("coach.whyThisWorkout")}</span>
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <div className="mt-2 p-2.5 rounded-md bg-accent/40 space-y-1">
          {lines.map((line) => (
            <p key={line.testId} className="text-xs text-muted-foreground" data-testid={line.testId}>
              <span className="font-medium text-foreground/80">{line.label}:</span> {line.value}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function WorkoutPreview({ workout, onFavorite, onPushToGarmin, onPushToIntervals, savingFavorite, pushing, pushingIntervals, showGarmin, showIntervals, swimWarning, onShowGuide }: {
  workout: Workout;
  onFavorite: () => void;
  onPushToGarmin: () => void;
  onPushToIntervals: () => void;
  savingFavorite: boolean;
  pushing: boolean;
  pushingIntervals: boolean;
  showGarmin: boolean;
  showIntervals: boolean;
  swimWarning?: string | null;
  onShowGuide?: () => void;
}) {
  const { t, language } = useTranslation();
  return (
    <Card className="mt-3">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <Dumbbell className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="font-medium text-sm truncate">{workout.name}</span>
          </div>
          <Badge variant="outline" className="text-xs flex-shrink-0">
            {t(`sport.${workout.sportType}`)}
          </Badge>
        </div>
        {workout.description && (
          <p className="text-xs text-muted-foreground mb-2" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>{workout.description}</p>
        )}
        {workout.scheduledDate && (
          <div className="flex items-center gap-1.5 mb-3 text-xs text-muted-foreground">
            <CalendarDays className="w-3 h-3" />
            <span>{formatDate(workout.scheduledDate, language)}</span>
          </div>
        )}
        <div className="space-y-1.5 mb-4">
          {workout.steps.map((step, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <div className="w-5 h-5 rounded-md bg-accent flex items-center justify-center flex-shrink-0 text-[10px] font-medium text-accent-foreground">
                {i + 1}
              </div>
              <span className="capitalize">{step.stepType}</span>
              {step.durationValue && (
                <span className="text-muted-foreground">
                  {step.durationType === "time"
                    ? `${Math.floor(step.durationValue / 60)}:${(step.durationValue % 60).toString().padStart(2, "0")}`
                    : step.durationType === "distance"
                    ? `${step.durationValue}${t("common.m")}`
                    : t("common.lapButton")}
                </span>
              )}
              {step.targetType !== "no.target" && step.targetValueLow && step.targetValueHigh && (
                <Badge variant="secondary" className="text-[10px]">
                  {step.targetType === "heart.rate.zone"
                    ? `${t("common.zone")} ${step.targetValueLow}`
                    : step.targetType === "pace.zone"
                    ? `${Math.floor(step.targetValueLow / 60)}:${(step.targetValueLow % 60).toString().padStart(2, "0")} - ${Math.floor(step.targetValueHigh / 60)}:${(step.targetValueHigh % 60).toString().padStart(2, "0")}`
                    : `${step.targetValueLow}-${step.targetValueHigh}`}
                </Badge>
              )}
              {step.stepType === "repeat" && step.repeatCount && (
                <Badge variant="secondary" className="text-[10px]">
                  x{step.repeatCount}
                </Badge>
              )}
            </div>
          ))}
        </div>
        {workout.explanation && <WorkoutExplanationBlock explanation={workout.explanation} />}
        {swimWarning && workout.sportType === "swimming" && (
          <div className="flex items-start gap-2 mb-3 p-2 rounded-md bg-accent/50 text-xs text-muted-foreground">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{swimWarning}</span>
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={onFavorite} disabled={savingFavorite} data-testid="button-save-favorite">
            {savingFavorite ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Star className="w-3 h-3 mr-1" />}
            {t("coach.toFavorites")}
          </Button>
          {showGarmin && (
            <Button size="sm" onClick={onPushToGarmin} disabled={pushing} data-testid="button-push-garmin">
              {pushing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Watch className="w-3 h-3 mr-1" />}
              Garmin
            </Button>
          )}
          {showIntervals && (
            <Button size="sm" variant="secondary" onClick={onPushToIntervals} disabled={pushingIntervals} data-testid="button-push-intervals">
              {pushingIntervals ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <BarChart3 className="w-3 h-3 mr-1" />}
              Intervals
            </Button>
          )}
        </div>
        {showGarmin && onShowGuide && (
          <button
            onClick={onShowGuide}
            className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            data-testid="link-garmin-guide"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span className="underline underline-offset-2">{t("coach.howToFindOnWatch")}</span>
          </button>
        )}
      </CardContent>
    </Card>
  );
}

function TrainingPlanPreview({ workouts, showGarmin, showIntervals, onBulkPushGarmin, onBulkPushIntervals, onBulkFavorite, onPushGarmin, onPushIntervals, onFavorite, bulkPushing, bulkPushingIntervals, bulkSaving, pushingIdx, pushingIntervalsIdx, savingIdx, onShowGuide }: {
  workouts: Workout[];
  showGarmin: boolean;
  showIntervals: boolean;
  onBulkPushGarmin: () => void;
  onBulkPushIntervals: () => void;
  onBulkFavorite: () => void;
  onPushGarmin: (workout: Workout, idx: number) => void;
  onPushIntervals: (workout: Workout, idx: number) => void;
  onFavorite: (workout: Workout, idx: number) => void;
  bulkPushing: boolean;
  bulkPushingIntervals: boolean;
  bulkSaving: boolean;
  pushingIdx: number | null;
  pushingIntervalsIdx: number | null;
  savingIdx: number | null;
  onShowGuide?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { t, language } = useTranslation();

  const dateRange = (() => {
    const dates = workouts.filter(w => w.scheduledDate).map(w => w.scheduledDate!).sort();
    if (dates.length === 0) return null;
    return { from: dates[0], to: dates[dates.length - 1] };
  })();

  const weekGroups = (() => {
    const groups: Record<string, Workout[]> = {};
    workouts.forEach(w => {
      if (w.scheduledDate) {
        const d = new Date(w.scheduledDate + "T12:00:00");
        const weekStart = new Date(d);
        const day = weekStart.getDay();
        const diff = day === 0 ? 6 : day - 1;
        weekStart.setDate(weekStart.getDate() - diff);
        const key = weekStart.toISOString().split("T")[0];
        if (!groups[key]) groups[key] = [];
        groups[key].push(w);
      } else {
        if (!groups["no-date"]) groups["no-date"] = [];
        groups["no-date"].push(w);
      }
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  })();

  return (
    <Card className="mt-3">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <ListChecks className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="font-medium text-sm">
              {t("coach.trainingPlan")}
            </span>
            <Badge variant="outline" className="text-xs flex-shrink-0">
              {t("coach.workoutsCount", { count: workouts.length })}
            </Badge>
          </div>
        </div>

        {dateRange && (
          <div className="flex items-center gap-1.5 mb-3 text-xs text-muted-foreground">
            <CalendarDays className="w-3 h-3" />
            <span>{formatDate(dateRange.from, language)} — {formatDate(dateRange.to, language)}</span>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap mb-3">
          <Button size="sm" variant="outline" onClick={onBulkFavorite} disabled={bulkSaving} data-testid="button-plan-save-all">
            {bulkSaving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Star className="w-3 h-3 mr-1" />}
            {t("coach.allToFavorites")}
          </Button>
          {showGarmin && (
            <Button size="sm" onClick={onBulkPushGarmin} disabled={bulkPushing} data-testid="button-plan-push-garmin">
              {bulkPushing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Watch className="w-3 h-3 mr-1" />}
              {t("coach.allToGarmin")}
            </Button>
          )}
          {showIntervals && (
            <Button size="sm" variant="secondary" onClick={onBulkPushIntervals} disabled={bulkPushingIntervals} data-testid="button-plan-push-intervals">
              {bulkPushingIntervals ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <BarChart3 className="w-3 h-3 mr-1" />}
              {t("coach.allToIntervals")}
            </Button>
          )}
        </div>
        {showGarmin && onShowGuide && (
          <button
            onClick={onShowGuide}
            className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            data-testid="link-plan-garmin-guide"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span className="underline underline-offset-2">{t("coach.howToFindOnWatch")}</span>
          </button>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="w-full justify-between text-xs text-muted-foreground"
          data-testid="button-plan-expand"
        >
          <span>{expanded ? t("coach.collapse") : t("coach.showAllWorkouts")}</span>
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </Button>

        {expanded && (
          <div className="mt-3 space-y-4">
            {weekGroups.map(([weekKey, weekWorkouts]) => (
              <div key={weekKey}>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  {weekKey === "no-date" ? t("coach.noDate") : t("coach.weekFrom", { date: formatDate(weekKey, language) })}
                </p>
                <div className="space-y-2">
                  {weekWorkouts.map((w, idx) => (
                    <div key={idx} className="border rounded-md p-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Dumbbell className="w-3 h-3 text-primary flex-shrink-0" />
                          <span className="text-xs font-medium truncate">{w.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Badge variant="outline" className="text-[10px]">
                            {t(`sport.${w.sportType}`)}
                          </Badge>
                        </div>
                      </div>
                      {w.scheduledDate && (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <CalendarDays className="w-2.5 h-2.5" />
                          <span>{formatDate(w.scheduledDate, language)}</span>
                        </div>
                      )}
                      {w.description && (
                        <p className="text-[10px] text-muted-foreground">{w.description}</p>
                      )}
                      <div className="space-y-1">
                        {w.steps.map((step, si) => (
                          <div key={si} className="flex items-center gap-1.5 text-[10px]">
                            <div className="w-4 h-4 rounded bg-accent flex items-center justify-center flex-shrink-0 text-[8px] font-medium text-accent-foreground">
                              {si + 1}
                            </div>
                            <span className="capitalize">{step.stepType}</span>
                            {step.durationValue && (
                              <span className="text-muted-foreground">
                                {step.durationType === "time"
                                  ? `${Math.floor(step.durationValue / 60)}:${(step.durationValue % 60).toString().padStart(2, "0")}`
                                  : step.durationType === "distance"
                                  ? `${step.durationValue}${t("common.m")}`
                                  : t("common.lapButton")}
                              </span>
                            )}
                            {step.stepType === "repeat" && step.repeatCount && (
                              <Badge variant="secondary" className="text-[8px]">
                                x{step.repeatCount}
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-1.5 pt-1.5 flex-wrap">
                        <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2" onClick={() => onFavorite(w, workouts.indexOf(w))} disabled={savingIdx === workouts.indexOf(w)} data-testid={`button-plan-fav-${idx}`}>
                          {savingIdx === workouts.indexOf(w) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Star className="w-3 h-3" />}
                        </Button>
                        {showGarmin && (
                          <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2" onClick={() => onPushGarmin(w, workouts.indexOf(w))} disabled={pushingIdx === workouts.indexOf(w)} data-testid={`button-plan-garmin-${idx}`}>
                            {pushingIdx === workouts.indexOf(w) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Watch className="w-3 h-3" />}
                            <span className="ml-1">Garmin</span>
                          </Button>
                        )}
                        {showIntervals && (
                          <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2" onClick={() => onPushIntervals(w, workouts.indexOf(w))} disabled={pushingIntervalsIdx === workouts.indexOf(w)} data-testid={`button-plan-intervals-${idx}`}>
                            {pushingIntervalsIdx === workouts.indexOf(w) ? <Loader2 className="w-3 h-3 animate-spin" /> : <BarChart3 className="w-3 h-3" />}
                            <span className="ml-1">Intervals</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


function ReschedulePreview({ data, onConfirm, confirming, confirmed }: {
  data: RescheduleData;
  onConfirm: () => void;
  confirming: boolean;
  confirmed: boolean;
}) {
  const { t, language } = useTranslation();
  return (
    <Card className="mt-2 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30" data-testid="reschedule-preview">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <CalendarClock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">{t("coach.rescheduleTitle")}</span>
        </div>
        <div className="text-xs text-muted-foreground space-y-0.5 mb-2">
          <p>{data.currentDate ? `${formatDate(data.currentDate, language)} → ${formatDate(data.newDate, language)}` : `${formatDate(data.newDate, language)}`}</p>
          {data.reason && <p className="italic">{data.reason}</p>}
        </div>
        <Button
          size="sm"
          variant={confirmed ? "outline" : "default"}
          onClick={onConfirm}
          disabled={confirming || confirmed}
          className="h-7 text-xs gap-1"
          data-testid="button-confirm-reschedule"
        >
          {confirming ? (
            <><Loader2 className="h-3 w-3 animate-spin" /> {t("coach.rescheduleRescheduling")}</>
          ) : confirmed ? (
            <><Check className="h-3 w-3" /> {t("coach.rescheduleDone")}</>
          ) : (
            <><CalendarClock className="h-3 w-3" /> {t("coach.rescheduleConfirm")}</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function CoachPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t, language } = useTranslation();
  const [message, setMessage] = useState("");
  const [bulkPushing, setBulkPushing] = useState(false);

  const quickPrompts = [
    t("coach.quickPrompt1"),
    t("coach.quickPrompt2"),
    t("coach.quickPrompt3"),
    t("coach.quickPrompt4"),
    t("coach.quickPrompt5"),
  ];

  const swimWarning = (() => {
    if (!user?.garminWatch || user.garminWatch === "other") return null;
    if (swimStructuredWatchModels.includes(user.garminWatch as GarminWatchModel)) return null;
    const watchName = garminWatchLabels[user.garminWatch as GarminWatchModel] || user.garminWatch;
    return t("settings.watchSwimWarning", { model: watchName });
  })();
  const [bulkPushingIntervals, setBulkPushingIntervals] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [singlePushIdx, setSinglePushIdx] = useState<number | null>(null);
  const [singlePushIntervalsIdx, setSinglePushIntervalsIdx] = useState<number | null>(null);
  const [singleSaveIdx, setSingleSaveIdx] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: messages = [], isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat/messages"],
  });

  const [isSending, setIsSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [showGarminGuide, setShowGarminGuide] = useState(false);
  const [reschedulingMsgId, setReschedulingMsgId] = useState<string | null>(null);
  const [rescheduledMsgIds, setRescheduledMsgIds] = useState<Set<string>>(new Set());
  const garminGuideShown = useRef(!!localStorage.getItem("garminGuideShown"));

  const triggerGarminGuide = () => {
    if (!garminGuideShown.current) {
      setShowGarminGuide(true);
      garminGuideShown.current = true;
      localStorage.setItem("garminGuideShown", "1");
    }
  };
  const streamDoneRef = useRef(false);

  const sendMessage = async (content: string) => {
    setIsSending(true);
    setStreamingText("");
    streamDoneRef.current = false;

    try {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/chat/send", true);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.withCredentials = true;

      let processedLength = 0;
      let streamError: string | null = null;
      let sseBuffer = "";

      const processBuffer = (flush: boolean) => {
        const events = sseBuffer.split("\n\n");
        if (!flush) {
          sseBuffer = events.pop() || "";
        } else {
          sseBuffer = "";
        }
        for (const event of events) {
          if (!event.trim()) continue;
          const dataLine = event.split("\n").find((l) => l.startsWith("data: "));
          if (!dataLine) continue;
          try {
            const parsed = JSON.parse(dataLine.slice(6));
            if (parsed.type === "chunk") {
              setStreamingText((prev) => prev + parsed.content);
            } else if (parsed.type === "done") {
              streamDoneRef.current = true;
            } else if (parsed.type === "error") {
              streamError = parsed.message;
            }
          } catch {}
        }
      };

      await new Promise<void>((resolve, reject) => {
        xhr.onprogress = () => {
          const newText = xhr.responseText.substring(processedLength);
          processedLength = xhr.responseText.length;
          sseBuffer += newText;
          processBuffer(false);
        };

        xhr.onload = () => {
          const remaining = xhr.responseText.substring(processedLength);
          if (remaining) {
            sseBuffer += remaining;
          }
          processBuffer(true);
          if (xhr.status >= 400) {
            try {
              const err = JSON.parse(xhr.responseText);
              reject(new Error(err.message || t("common.serverError")));
            } catch {
              reject(new Error(t("common.serverError")));
            }
            return;
          }
          if (streamError) {
            reject(new Error(streamError));
            return;
          }
          resolve();
        };

        xhr.onerror = () => reject(new Error(t("common.networkError")));
        xhr.ontimeout = () => reject(new Error(t("common.timeoutError")));
        xhr.timeout = 300000;
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      xhr.send(JSON.stringify({ content, timezone }));
      });

      await queryClient.refetchQueries({ queryKey: ["/api/chat/messages"] });
      setStreamingText("");
    } catch (error: any) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
      setStreamingText("");
    } finally {
      setIsSending(false);
    }
  };

  const favoriteMutation = useMutation({
    mutationFn: async (workout: Workout) => {
      const res = await apiRequest("POST", "/api/favorites", workout);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("coach.addedToFavorites") });
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
    },
    onError: (error: Error) => {
      toast({ title: t("coach.saveError"), description: error.message, variant: "destructive" });
    },
  });

  const clearChatMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/chat/messages");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/messages"] });
      toast({ title: t("coach.chatCleared") });
    },
    onError: (error: Error) => {
      toast({ title: t("coach.clearError"), description: error.message, variant: "destructive" });
    },
  });

  const pushMutation = useMutation({
    mutationFn: async (workout: Workout & { scheduledDate?: string | null }) => {
      const res = await apiRequest("POST", "/api/garmin/push-workout", workout);
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.swimIncompatible) {
        toast({ title: t("coach.swimNotSupported"), description: data.message, variant: "destructive", duration: 8000 });
        return;
      }
      const desc = data.scheduled && data.scheduledDate
        ? t("coach.scheduledOn", { date: new Date(String(data.scheduledDate).split("T")[0] + "T12:00:00").toLocaleDateString(localeMap[language], { day: "numeric", month: "long", weekday: "long" }) })
        : undefined;
      toast({ title: t("coach.workoutSentGarmin"), description: desc });
      triggerGarminGuide();
    },
    onError: (error: Error) => {
      toast({ title: t("coach.sendError"), description: error.message, variant: "destructive" });
    },
  });

  const pushIntervalsMutation = useMutation({
    mutationFn: async (workout: Workout & { scheduledDate?: string | null }) => {
      const res = await apiRequest("POST", "/api/intervals/push-workout", workout);
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.scheduled && data.scheduledDate) {
        const raw = String(data.scheduledDate).split("T")[0];
        const dateStr = new Date(raw + "T12:00:00").toLocaleDateString(localeMap[language], {
          day: "numeric",
          month: "long",
          weekday: "long",
        });
        toast({ title: t("coach.workoutSentIntervals"), description: t("coach.scheduledOn", { date: dateStr }) });
      } else {
        toast({ title: t("coach.workoutSentIntervals") });
      }
    },
    onError: (error: Error) => {
      toast({ title: t("coach.sendErrorIntervals"), description: error.message, variant: "destructive" });
    },
  });

  const handleBulkPushGarmin = async (workouts: Workout[]) => {
    setBulkPushing(true);
    let success = 0;
    let failed = 0;
    let swimSkipped = 0;
    for (const w of workouts) {
      try {
        const res = await apiRequest("POST", "/api/garmin/push-workout", w);
        const data = await res.json();
        if (data.swimIncompatible) {
          swimSkipped++;
        } else if (!data.success) {
          failed++;
        } else {
          success++;
        }
      } catch {
        failed++;
      }
    }
    setBulkPushing(false);
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    if (swimSkipped > 0) {
      toast({ title: t("coach.garminSentSwim", { success, skipped: swimSkipped }), variant: "destructive", duration: 8000 });
    } else if (failed > 0) {
      toast({ title: t("coach.garminSent", { success, failed }), variant: "destructive" });
    } else {
      toast({ title: t("coach.workoutsSentGarmin", { count: success }) });
    }
    if (success > 0) triggerGarminGuide();
  };

  const handleBulkPushIntervals = async (workouts: Workout[]) => {
    setBulkPushingIntervals(true);
    let success = 0;
    let failed = 0;
    for (const w of workouts) {
      try {
        const res = await apiRequest("POST", "/api/intervals/push-workout", w);
        if (!res.ok) throw new Error("push failed");
        success++;
      } catch {
        failed++;
      }
    }
    setBulkPushingIntervals(false);
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    if (failed > 0) {
      toast({ title: t("coach.intervalsSent", { success, failed }), variant: "destructive" });
    } else {
      toast({ title: t("coach.workoutsSentIntervals", { count: success }) });
    }
  };

  const handleBulkFavorite = async (workouts: Workout[]) => {
    setBulkSaving(true);
    let success = 0;
    let failed = 0;
    for (const w of workouts) {
      try {
        const res = await apiRequest("POST", "/api/favorites", w);
        if (!res.ok) throw new Error("save failed");
        success++;
      } catch {
        failed++;
      }
    }
    setBulkSaving(false);
    queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    if (failed > 0) {
      toast({ title: t("coach.savedCount", { success, failed }), variant: "destructive" });
    } else {
      toast({ title: t("coach.savedToFavorites", { count: success }) });
    }
  };

  const handleSinglePushGarmin = async (workout: Workout, idx: number) => {
    setSinglePushIdx(idx);
    try {
      const res = await apiRequest("POST", "/api/garmin/push-workout", workout);
      const data = await res.json();
      if (data.swimIncompatible) {
        toast({ title: t("coach.swimNotSupported"), description: data.message, variant: "destructive", duration: 8000 });
      } else if (data.scheduled && data.scheduledDate) {
        const raw = String(data.scheduledDate).split("T")[0];
        const dateStr = new Date(raw + "T12:00:00").toLocaleDateString(localeMap[language], { day: "numeric", month: "long", weekday: "long" });
        toast({ title: `${workout.name} → Garmin`, description: t("coach.scheduledOn", { date: dateStr }) });
      } else {
        toast({ title: `${workout.name} → Garmin` });
      }
      if (!data.swimIncompatible) triggerGarminGuide();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch (error: any) {
      toast({ title: t("coach.sendError"), description: error.message, variant: "destructive" });
    } finally {
      setSinglePushIdx(null);
    }
  };

  const handleSinglePushIntervals = async (workout: Workout, idx: number) => {
    setSinglePushIntervalsIdx(idx);
    try {
      const res = await apiRequest("POST", "/api/intervals/push-workout", workout);
      const data = await res.json();
      if (data.scheduled && data.scheduledDate) {
        const raw = String(data.scheduledDate).split("T")[0];
        const dateStr = new Date(raw + "T12:00:00").toLocaleDateString(localeMap[language], { day: "numeric", month: "long", weekday: "long" });
        toast({ title: `${workout.name} → Intervals.icu`, description: t("coach.scheduledOn", { date: dateStr }) });
      } else {
        toast({ title: `${workout.name} → Intervals.icu` });
      }
    } catch (error: any) {
      toast({ title: t("coach.sendError"), description: error.message, variant: "destructive" });
    } finally {
      setSinglePushIntervalsIdx(null);
    }
  };

  const handleSingleFavorite = async (workout: Workout, idx: number) => {
    setSingleSaveIdx(idx);
    try {
      await apiRequest("POST", "/api/favorites", workout);
      toast({ title: `${workout.name} ${t("coach.toFav")}` });
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
    } catch (error: any) {
      toast({ title: t("coach.saveError"), description: error.message, variant: "destructive" });
    } finally {
      setSingleSaveIdx(null);
    }
  };

  const handleReschedule = async (msgId: string, data: RescheduleData) => {
    setReschedulingMsgId(msgId);
    try {
      const garmin = user?.garminConnected;
      const intervals = user?.intervalsConnected;
      if (!garmin && !intervals) {
        toast({ title: t("coach.noConnectedAccount"), description: t("coach.connectForReschedule"), variant: "destructive" });
        return;
      }

      const payload = {
        workoutId: data.workoutId,
        currentDate: data.currentDate,
        newDate: data.newDate,
      };

      const results: string[] = [];
      const errors: string[] = [];

      if (garmin) {
        try {
          await apiRequest("POST", "/api/garmin/reschedule-workout", payload);
          results.push("Garmin");
        } catch (e: any) {
          if (intervals) {
            console.log("Garmin reschedule failed (will try Intervals):", e.message);
          } else {
            throw e;
          }
        }
      }

      if (intervals) {
        try {
          await apiRequest("POST", "/api/intervals/reschedule-workout", payload);
          results.push("Intervals.icu");
        } catch (e: any) {
          if (garmin && results.length > 0) {
            console.log("Intervals reschedule failed (Garmin succeeded):", e.message);
          } else if (!garmin) {
            throw e;
          }
        }
      }

      if (results.length === 0) {
        throw new Error(t("coach.workoutNotFound"));
      }

      setRescheduledMsgIds(prev => new Set(prev).add(msgId));
      const dateStr = `${data.currentDate ? formatDate(data.currentDate, language) + " → " : ""}${formatDate(data.newDate, language)}`;
      toast({ title: t("coach.workoutRescheduled"), description: `${dateStr} (${results.join(" + ")})` });
    } catch (error: any) {
      toast({ title: t("coach.rescheduleError"), description: error.message, variant: "destructive" });
    } finally {
      setReschedulingMsgId(null);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isSending, streamingText]);

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed || isSending) return;
    sendMessage(trimmed);
    setMessage("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <div className="border-b p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold" data-testid="text-coach-title">{t("coach.title")}</h1>
              <p className="text-xs text-muted-foreground">
                {t("coach.subtitle")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(user?.garminConnected || user?.intervalsConnected) && <ReadinessBadge />}
            {messages.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                data-testid="button-clear-chat"
                disabled={isSending || clearChatMutation.isPending}
                onClick={() => {
                  if (window.confirm(t("coach.clearConfirm"))) {
                    clearChatMutation.mutate();
                  }
                }}
              >
                {clearChatMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span className="ml-1">{t("coach.clearChat")}</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden" ref={scrollRef}>
        <div className="p-4 space-y-4 max-w-3xl mx-auto">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="w-8 h-8 rounded-md flex-shrink-0" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="py-12 text-center space-y-6">
              <div className="w-16 h-16 rounded-md bg-accent flex items-center justify-center mx-auto">
                <Bot className="w-8 h-8 text-accent-foreground" />
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-1">{t("coach.personalTrainer")}</h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  {t("coach.emptyChat")}
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
                {quickPrompts.map((prompt, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      setMessage(prompt);
                      textareaRef.current?.focus();
                    }}
                    data-testid={`button-quick-prompt-${i}`}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
                data-testid={`message-${msg.id}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] sm:max-w-[80%] min-w-0 overflow-hidden ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-md rounded-br-sm px-4 py-3"
                      : "space-y-1"
                  }`}
                >
                  {msg.role === "user" ? (
                    <p className="text-sm whitespace-pre-wrap" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>{msg.content}</p>
                  ) : (
                    <>
                      <div className="text-sm whitespace-pre-wrap leading-relaxed" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>{msg.content}</div>
                      {msg.workoutJson && !(msg.workoutsJson && msg.workoutsJson.length > 0) && (
                        <WorkoutPreview
                          workout={msg.workoutJson}
                          onFavorite={() => favoriteMutation.mutate(msg.workoutJson!)}
                          onPushToGarmin={() => pushMutation.mutate(msg.workoutJson!)}
                          onPushToIntervals={() => pushIntervalsMutation.mutate(msg.workoutJson!)}
                          savingFavorite={favoriteMutation.isPending}
                          pushing={pushMutation.isPending}
                          pushingIntervals={pushIntervalsMutation.isPending}
                          showGarmin={!!user?.garminConnected}
                          showIntervals={!!user?.intervalsConnected}
                          swimWarning={swimWarning}
                          onShowGuide={() => setShowGarminGuide(true)}
                        />
                      )}
                      {msg.workoutsJson && msg.workoutsJson.length > 0 && (
                        <TrainingPlanPreview
                          workouts={msg.workoutsJson}
                          showGarmin={!!user?.garminConnected}
                          showIntervals={!!user?.intervalsConnected}
                          onBulkPushGarmin={() => handleBulkPushGarmin(msg.workoutsJson!)}
                          onBulkPushIntervals={() => handleBulkPushIntervals(msg.workoutsJson!)}
                          onBulkFavorite={() => handleBulkFavorite(msg.workoutsJson!)}
                          onPushGarmin={handleSinglePushGarmin}
                          onPushIntervals={handleSinglePushIntervals}
                          onFavorite={handleSingleFavorite}
                          bulkPushing={bulkPushing}
                          bulkPushingIntervals={bulkPushingIntervals}
                          bulkSaving={bulkSaving}
                          pushingIdx={singlePushIdx}
                          pushingIntervalsIdx={singlePushIntervalsIdx}
                          savingIdx={singleSaveIdx}
                          onShowGuide={() => setShowGarminGuide(true)}
                        />
                      )}
                      {msg.rescheduleData && (
                        <ReschedulePreview
                          data={msg.rescheduleData}
                          onConfirm={() => handleReschedule(msg.id, msg.rescheduleData!)}
                          confirming={reschedulingMsgId === msg.id}
                          confirmed={rescheduledMsgIds.has(msg.id)}
                        />
                      )}
                    </>
                  )}
                  <p className={`text-[10px] mt-1 ${msg.role === "user" ? "text-primary-foreground/60 text-right" : "text-muted-foreground"}`}>
                    {formatTime(msg.timestamp, language)}
                  </p>
                </div>
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-secondary-foreground" />
                  </div>
                )}
              </div>
            ))
          )}

          {(isSending || streamingText) && (
            <div className="flex gap-3 max-w-3xl mx-auto">
              <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-primary-foreground" />
              </div>
              {streamingText ? (
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="text-sm whitespace-pre-wrap leading-relaxed" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>{streamingText}</div>
                  <Loader2 className="w-3 h-3 animate-spin mt-1 text-muted-foreground" />
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("coach.thinking")}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="border-t p-3 sm:p-4">
        <div className="max-w-3xl mx-auto flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("coach.inputPlaceholder")}
            className="resize-none min-h-[44px] max-h-[120px] text-sm"
            rows={1}
            data-testid="input-chat-message"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!message.trim() || isSending}
            data-testid="button-send-message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <GarminGuideDialog open={showGarminGuide} onClose={() => setShowGarminGuide(false)} />
    </div>
  );
}
