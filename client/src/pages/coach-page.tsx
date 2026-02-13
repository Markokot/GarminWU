import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ChatMessage, Workout } from "@shared/schema";
import { sportTypeLabels } from "@shared/schema";
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
} from "lucide-react";

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function WorkoutPreview({ workout, onSave, onPushToGarmin, onPushToIntervals, saving, pushing, pushingIntervals, showGarmin, showIntervals }: {
  workout: Workout;
  onSave: () => void;
  onPushToGarmin: () => void;
  onPushToIntervals: () => void;
  saving: boolean;
  pushing: boolean;
  pushingIntervals: boolean;
  showGarmin: boolean;
  showIntervals: boolean;
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
          <p className="text-xs text-muted-foreground mb-2">{workout.description}</p>
        )}
        {workout.scheduledDate && (
          <div className="flex items-center gap-1.5 mb-3 text-xs text-muted-foreground">
            <CalendarDays className="w-3 h-3" />
            <span>
              {new Date(workout.scheduledDate + "T12:00:00").toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "long",
                weekday: "long",
              })}
            </span>
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
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={onSave} disabled={saving} data-testid="button-save-workout">
            {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Dumbbell className="w-3 h-3 mr-1" />}
            Сохранить
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

const quickPrompts = [
  "Легкая восстановительная пробежка на 30 минут",
  "Интервальная тренировка для улучшения скорости",
  "Длительная тренировка для подготовки к полумарафону",
  "Велосипедная тренировка на выносливость 1.5 часа",
  "Тренировка по плаванию для подготовки к Ironman",
];

export default function CoachPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: messages = [], isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat/messages"],
  });

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", "/api/chat/send", { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/messages"] });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (workout: Workout) => {
      const res = await apiRequest("POST", "/api/workouts", workout);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Тренировка сохранена" });
      queryClient.invalidateQueries({ queryKey: ["/api/workouts"] });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка сохранения", description: error.message, variant: "destructive" });
    },
  });

  const pushMutation = useMutation({
    mutationFn: async (workout: Workout & { scheduledDate?: string | null }) => {
      const res = await apiRequest("POST", "/api/garmin/push-workout", workout);
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
        toast({ title: "Тренировка отправлена на Garmin", description: `Запланирована на ${dateStr}` });
      } else {
        toast({ title: "Тренировка отправлена на Garmin" });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/workouts"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/workouts"] });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка отправки в Intervals.icu", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sendMutation.isPending]);

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed || sendMutation.isPending) return;
    sendMutation.mutate(trimmed);
    setMessage("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold" data-testid="text-coach-title">AI Тренер</h1>
            <p className="text-xs text-muted-foreground">
              Опишите желаемую тренировку — AI создаст план и загрузит на часы
            </p>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1" ref={scrollRef}>
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
                  Опишите желаемую тренировку, и AI создаст структурированный план, который можно загрузить на часы Garmin
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
                  className={`max-w-[80%] min-w-0 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-md rounded-br-sm px-4 py-3"
                      : "space-y-1"
                  }`}
                >
                  {msg.role === "user" ? (
                    <p className="text-sm whitespace-pre-wrap break-words overflow-hidden">{msg.content}</p>
                  ) : (
                    <>
                      <div className="text-sm whitespace-pre-wrap leading-relaxed break-words overflow-hidden">{msg.content}</div>
                      {msg.workoutJson && (
                        <WorkoutPreview
                          workout={msg.workoutJson}
                          onSave={() => saveMutation.mutate(msg.workoutJson!)}
                          onPushToGarmin={() => pushMutation.mutate(msg.workoutJson!)}
                          onPushToIntervals={() => pushIntervalsMutation.mutate(msg.workoutJson!)}
                          saving={saveMutation.isPending}
                          pushing={pushMutation.isPending}
                          pushingIntervals={pushIntervalsMutation.isPending}
                          showGarmin={!!user?.garminConnected}
                          showIntervals={!!user?.intervalsConnected}
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

          {sendMutation.isPending && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-primary-foreground" />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                AI думает...
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t p-3 sm:p-4">
        <div className="max-w-3xl mx-auto flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Опишите тренировку, например: интервальная тренировка 5x1000м с пульсом 160-170"
            className="resize-none min-h-[44px] max-h-[120px] text-sm"
            rows={1}
            data-testid="input-chat-message"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!message.trim() || sendMutation.isPending}
            data-testid="button-send-message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
