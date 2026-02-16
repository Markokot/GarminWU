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
import type { ChatMessage, Workout, GarminWatchModel } from "@shared/schema";
import { sportTypeLabels, garminWatchLabels, swimStructuredWatchModels } from "@shared/schema";
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
} from "lucide-react";

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    weekday: "short",
  });
}

function WorkoutPreview({ workout, onFavorite, onPushToGarmin, onPushToIntervals, savingFavorite, pushing, pushingIntervals, showGarmin, showIntervals, swimWarning }: {
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
}) {
  return (
    <Card className="mt-3">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <Dumbbell className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="font-medium text-sm truncate">{workout.name}</span>
          </div>
          <Badge variant="outline" className="text-xs flex-shrink-0">
            {sportTypeLabels[workout.sportType]}
          </Badge>
        </div>
        {workout.description && (
          <p className="text-xs text-muted-foreground mb-2" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>{workout.description}</p>
        )}
        {workout.scheduledDate && (
          <div className="flex items-center gap-1.5 mb-3 text-xs text-muted-foreground">
            <CalendarDays className="w-3 h-3" />
            <span>{formatDate(workout.scheduledDate)}</span>
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
                    ? `${step.durationValue}м`
                    : "по кнопке"}
                </span>
              )}
              {step.targetType !== "no.target" && step.targetValueLow && step.targetValueHigh && (
                <Badge variant="secondary" className="text-[10px]">
                  {step.targetType === "heart.rate.zone"
                    ? `Зона ${step.targetValueLow}`
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
        {swimWarning && workout.sportType === "swimming" && (
          <div className="flex items-start gap-2 mb-3 p-2 rounded-md bg-accent/50 text-xs text-muted-foreground">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{swimWarning}</span>
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={onFavorite} disabled={savingFavorite} data-testid="button-save-favorite">
            {savingFavorite ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Star className="w-3 h-3 mr-1" />}
            В избранное
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
      </CardContent>
    </Card>
  );
}

function TrainingPlanPreview({ workouts, showGarmin, showIntervals, onBulkPushGarmin, onBulkPushIntervals, onBulkFavorite, onPushGarmin, onPushIntervals, onFavorite, bulkPushing, bulkPushingIntervals, bulkSaving, pushingIdx, pushingIntervalsIdx, savingIdx }: {
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
}) {
  const [expanded, setExpanded] = useState(false);

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
              Тренировочный план
            </span>
            <Badge variant="outline" className="text-xs flex-shrink-0">
              {workouts.length} тренировок
            </Badge>
          </div>
        </div>

        {dateRange && (
          <div className="flex items-center gap-1.5 mb-3 text-xs text-muted-foreground">
            <CalendarDays className="w-3 h-3" />
            <span>{formatDate(dateRange.from)} — {formatDate(dateRange.to)}</span>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap mb-3">
          <Button size="sm" variant="outline" onClick={onBulkFavorite} disabled={bulkSaving} data-testid="button-plan-save-all">
            {bulkSaving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Star className="w-3 h-3 mr-1" />}
            Все в избранное
          </Button>
          {showGarmin && (
            <Button size="sm" onClick={onBulkPushGarmin} disabled={bulkPushing} data-testid="button-plan-push-garmin">
              {bulkPushing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Watch className="w-3 h-3 mr-1" />}
              Все на Garmin
            </Button>
          )}
          {showIntervals && (
            <Button size="sm" variant="secondary" onClick={onBulkPushIntervals} disabled={bulkPushingIntervals} data-testid="button-plan-push-intervals">
              {bulkPushingIntervals ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <BarChart3 className="w-3 h-3 mr-1" />}
              Все в Intervals
            </Button>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="w-full justify-between text-xs text-muted-foreground"
          data-testid="button-plan-expand"
        >
          <span>{expanded ? "Свернуть" : "Показать все тренировки"}</span>
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </Button>

        {expanded && (
          <div className="mt-3 space-y-4">
            {weekGroups.map(([weekKey, weekWorkouts]) => (
              <div key={weekKey}>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  {weekKey === "no-date" ? "Без даты" : `Неделя с ${formatDate(weekKey)}`}
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
                            {sportTypeLabels[w.sportType]}
                          </Badge>
                        </div>
                      </div>
                      {w.scheduledDate && (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <CalendarDays className="w-2.5 h-2.5" />
                          <span>{formatDate(w.scheduledDate)}</span>
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
                                  ? `${step.durationValue}м`
                                  : "по кнопке"}
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

const quickPrompts = [
  "Легкая восстановительная пробежка на 30 минут",
  "Интервальная тренировка для улучшения скорости",
  "Длительная тренировка для подготовки к полумарафону",
  "Велосипедная тренировка на выносливость 1.5 часа",
  "План на 2 недели для подготовки к забегу на 10 км",
];

export default function CoachPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [bulkPushing, setBulkPushing] = useState(false);

  const swimWarning = (() => {
    if (!user?.garminWatch || user.garminWatch === "other") return null;
    if (swimStructuredWatchModels.includes(user.garminWatch as GarminWatchModel)) return null;
    const watchName = garminWatchLabels[user.garminWatch as GarminWatchModel] || user.garminWatch;
    return `${watchName} не поддерживает структурированные плавательные тренировки. Тренировка появится в Garmin Connect, но может не синхронизироваться на часы.`;
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
              reject(new Error(err.message || "Ошибка сервера"));
            } catch {
              reject(new Error("Ошибка сервера"));
            }
            return;
          }
          if (streamError) {
            reject(new Error(streamError));
            return;
          }
          resolve();
        };

        xhr.onerror = () => reject(new Error("Ошибка сети"));
        xhr.ontimeout = () => reject(new Error("Время ожидания истекло"));
        xhr.timeout = 300000;
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      xhr.send(JSON.stringify({ content, timezone }));
      });

      await queryClient.refetchQueries({ queryKey: ["/api/chat/messages"] });
      setStreamingText("");
    } catch (error: any) {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
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
      toast({ title: "Добавлено в избранное" });
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка сохранения", description: error.message, variant: "destructive" });
    },
  });

  const clearChatMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/chat/messages");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/messages"] });
      toast({ title: "История чата очищена" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка очистки", description: error.message, variant: "destructive" });
    },
  });

  const pushMutation = useMutation({
    mutationFn: async (workout: Workout & { scheduledDate?: string | null }) => {
      const res = await apiRequest("POST", "/api/garmin/push-workout", workout);
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.swimIncompatible) {
        toast({ title: "Плавание не поддерживается", description: data.message, variant: "destructive", duration: 8000 });
        return;
      }
      if (data.scheduled && data.scheduledDate) {
        const raw = String(data.scheduledDate).split("T")[0];
        const dateStr = new Date(raw + "T12:00:00").toLocaleDateString("ru-RU", {
          day: "numeric",
          month: "long",
          weekday: "long",
        });
        toast({ title: "Тренировка отправлена на Garmin", description: `Запланирована на ${dateStr}` });
      } else {
        toast({ title: "Тренировка отправлена на Garmin" });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка отправки", description: error.message, variant: "destructive" });
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
        const dateStr = new Date(raw + "T12:00:00").toLocaleDateString("ru-RU", {
          day: "numeric",
          month: "long",
          weekday: "long",
        });
        toast({ title: "Тренировка отправлена в Intervals.icu", description: `Запланирована на ${dateStr}` });
      } else {
        toast({ title: "Тренировка отправлена в Intervals.icu" });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка отправки в Intervals.icu", description: error.message, variant: "destructive" });
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
      toast({ title: `Garmin: ${success} отправлено, ${swimSkipped} плавательных пропущено (часы не поддерживают)`, variant: "destructive", duration: 8000 });
    } else if (failed > 0) {
      toast({ title: `Garmin: ${success} отправлено, ${failed} с ошибкой`, variant: "destructive" });
    } else {
      toast({ title: `${success} тренировок отправлено на Garmin` });
    }
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
      toast({ title: `Intervals.icu: ${success} отправлено, ${failed} с ошибкой`, variant: "destructive" });
    } else {
      toast({ title: `${success} тренировок отправлено в Intervals.icu` });
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
      toast({ title: `${success} сохранено, ${failed} с ошибкой`, variant: "destructive" });
    } else {
      toast({ title: `${success} тренировок сохранено в избранное` });
    }
  };

  const handleSinglePushGarmin = async (workout: Workout, idx: number) => {
    setSinglePushIdx(idx);
    try {
      const res = await apiRequest("POST", "/api/garmin/push-workout", workout);
      const data = await res.json();
      if (data.swimIncompatible) {
        toast({ title: "Плавание не поддерживается", description: data.message, variant: "destructive", duration: 8000 });
      } else if (data.scheduled && data.scheduledDate) {
        const raw = String(data.scheduledDate).split("T")[0];
        const dateStr = new Date(raw + "T12:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "long" });
        toast({ title: `${workout.name} → Garmin`, description: `Запланирована на ${dateStr}` });
      } else {
        toast({ title: `${workout.name} → Garmin` });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch (error: any) {
      toast({ title: "Ошибка отправки", description: error.message, variant: "destructive" });
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
        const dateStr = new Date(raw + "T12:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "long" });
        toast({ title: `${workout.name} → Intervals.icu`, description: `Запланирована на ${dateStr}` });
      } else {
        toast({ title: `${workout.name} → Intervals.icu` });
      }
    } catch (error: any) {
      toast({ title: "Ошибка отправки", description: error.message, variant: "destructive" });
    } finally {
      setSinglePushIntervalsIdx(null);
    }
  };

  const handleSingleFavorite = async (workout: Workout, idx: number) => {
    setSingleSaveIdx(idx);
    try {
      await apiRequest("POST", "/api/favorites", workout);
      toast({ title: `${workout.name} → избранное` });
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
    } catch (error: any) {
      toast({ title: "Ошибка сохранения", description: error.message, variant: "destructive" });
    } finally {
      setSingleSaveIdx(null);
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
              <h1 className="text-lg font-semibold" data-testid="text-coach-title">AI Тренер</h1>
              <p className="text-xs text-muted-foreground">
                Опишите тренировку или попросите план на период — AI создаст и загрузит на часы
              </p>
            </div>
          </div>
          {messages.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              data-testid="button-clear-chat"
              disabled={isSending || clearChatMutation.isPending}
              onClick={() => {
                if (window.confirm("Очистить всю историю чата? Это действие нельзя отменить.")) {
                  clearChatMutation.mutate();
                }
              }}
            >
              {clearChatMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              <span className="ml-1">Очистить</span>
            </Button>
          )}
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
                <h2 className="text-lg font-semibold mb-1">Ваш персональный тренер</h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Опишите тренировку или попросите план на период — AI создаст структурированные тренировки для загрузки на часы
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
                        />
                      )}
                    </>
                  )}
                  <p className={`text-[10px] mt-1 ${msg.role === "user" ? "text-primary-foreground/60 text-right" : "text-muted-foreground"}`}>
                    {formatTime(msg.timestamp)}
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
                  AI думает...
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
            placeholder="Опишите тренировку или попросите план: «план на 3 недели для 10 км»"
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
    </div>
  );
}
