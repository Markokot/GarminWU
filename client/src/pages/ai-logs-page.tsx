import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AiRequestLog } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Brain, Clock, Star, Dumbbell, Filter, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function formatDateShort(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function RatingStars({
  logId,
  rating,
  onRate,
  disabled,
}: {
  logId: string;
  rating?: number;
  onRate: (id: string, rating: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Button
          key={star}
          size="icon"
          variant="ghost"
          className="w-6 h-auto p-0"
          disabled={disabled}
          onClick={() => onRate(logId, star)}
          data-testid={`button-rate-${logId}-${star}`}
        >
          <Star
            className={`w-4 h-4 ${
              rating && star <= rating
                ? "fill-yellow-500 text-yellow-500"
                : "text-muted-foreground"
            }`}
          />
        </Button>
      ))}
    </div>
  );
}

export default function AiLogsPage() {
  const {
    data: logs,
    isLoading,
    error,
  } = useQuery<AiRequestLog[]>({
    queryKey: ["/api/admin/ai-logs"],
  });

  const { toast } = useToast();
  const [ratingId, setRatingId] = useState<string | null>(null);

  const [usernameFilter, setUsernameFilter] = useState("");
  const [variantFilter, setVariantFilter] = useState("all");
  const [workoutFilter, setWorkoutFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");

  const variantNames = useMemo(() => {
    if (!logs) return [];
    const names = new Set(logs.map((l) => l.promptVariantName));
    return Array.from(names).sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    return logs.filter((log) => {
      if (
        usernameFilter &&
        !log.username.toLowerCase().includes(usernameFilter.toLowerCase())
      )
        return false;
      if (variantFilter !== "all" && log.promptVariantName !== variantFilter)
        return false;
      if (workoutFilter === "yes" && !log.hadWorkout) return false;
      if (workoutFilter === "no" && log.hadWorkout) return false;
      if (planFilter === "yes" && !log.hadPlan) return false;
      if (planFilter === "no" && log.hadPlan) return false;
      if (ratingFilter === "yes" && !log.rating) return false;
      if (ratingFilter === "no" && log.rating) return false;
      return true;
    });
  }, [logs, usernameFilter, variantFilter, workoutFilter, planFilter, ratingFilter]);

  const stats = useMemo(() => {
    if (!logs || logs.length === 0)
      return { total: 0, avgTime: 0, workoutRate: 0, ratedCount: 0 };
    const total = logs.length;
    const avgTime =
      logs.reduce((sum, l) => sum + l.responseTimeMs, 0) / total / 1000;
    const workoutRate = (logs.filter((l) => l.hadWorkout).length / total) * 100;
    const ratedCount = logs.filter((l) => l.rating).length;
    return { total, avgTime, workoutRate, ratedCount };
  }, [logs]);

  const handleRate = async (id: string, rating: number) => {
    setRatingId(id);
    try {
      await apiRequest("PATCH", `/api/admin/ai-logs/${id}`, { rating });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai-logs"] });
    } catch {
      toast({ title: "Ошибка", variant: "destructive" });
    }
    setRatingId(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Доступ запрещён</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold" data-testid="text-ai-logs-title">
          AI логи запросов
        </h1>
        <p className="text-sm text-muted-foreground">
          Журнал запросов к AI и оценки ответов
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Brain className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Всего запросов</span>
            </div>
            <p className="text-2xl font-bold" data-testid="text-total-logs">
              {stats.total}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Ср. время ответа</span>
            </div>
            <p className="text-2xl font-bold" data-testid="text-avg-response-time">
              {stats.avgTime.toFixed(1)}с
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Dumbbell className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">С тренировкой</span>
            </div>
            <p className="text-2xl font-bold" data-testid="text-workout-rate">
              {stats.workoutRate.toFixed(0)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Star className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Оценено</span>
            </div>
            <p className="text-2xl font-bold" data-testid="text-rated-count">
              {stats.ratedCount}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Фильтры</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <Input
              placeholder="Имя пользователя"
              value={usernameFilter}
              onChange={(e) => setUsernameFilter(e.target.value)}
              data-testid="input-filter-username"
            />

            <Select value={variantFilter} onValueChange={setVariantFilter}>
              <SelectTrigger data-testid="select-filter-variant">
                <SelectValue placeholder="Вариант промпта" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все варианты</SelectItem>
                {variantNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={workoutFilter} onValueChange={setWorkoutFilter}>
              <SelectTrigger data-testid="select-filter-workout">
                <SelectValue placeholder="Тренировка" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Тренировка: все</SelectItem>
                <SelectItem value="yes">С тренировкой</SelectItem>
                <SelectItem value="no">Без тренировки</SelectItem>
              </SelectContent>
            </Select>

            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger data-testid="select-filter-plan">
                <SelectValue placeholder="План" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">План: все</SelectItem>
                <SelectItem value="yes">С планом</SelectItem>
                <SelectItem value="no">Без плана</SelectItem>
              </SelectContent>
            </Select>

            <Select value={ratingFilter} onValueChange={setRatingFilter}>
              <SelectTrigger data-testid="select-filter-rating">
                <SelectValue placeholder="Оценка" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Оценка: все</SelectItem>
                <SelectItem value="yes">С оценкой</SelectItem>
                <SelectItem value="no">Без оценки</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {filteredLogs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Brain className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Нет записей</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => (
            <Card key={log.id} data-testid={`card-ai-log-${log.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm" data-testid={`text-username-${log.id}`}>
                        {log.username}
                      </span>
                      <span className="text-xs text-muted-foreground" data-testid={`text-timestamp-${log.id}`}>
                        {formatDateShort(log.timestamp)}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {log.promptVariantName}
                      </Badge>
                      {log.hadWorkout && (
                        <Badge variant="default" className="text-xs" data-testid={`badge-workout-${log.id}`}>
                          <Dumbbell className="w-3 h-3 mr-1" />
                          Тренировка
                        </Badge>
                      )}
                      {log.hadPlan && (
                        <Badge variant="default" className="text-xs" data-testid={`badge-plan-${log.id}`}>
                          План
                        </Badge>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground line-clamp-2" data-testid={`text-message-${log.id}`}>
                      {log.userMessage}
                    </p>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      <span data-testid={`text-response-length-${log.id}`}>
                        Ответ: {log.responseLength} симв.
                      </span>
                      <span data-testid={`text-response-time-${log.id}`}>
                        <Clock className="w-3 h-3 inline mr-1" />
                        {(log.responseTimeMs / 1000).toFixed(1)}с
                      </span>
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    <RatingStars
                      logId={log.id}
                      rating={log.rating}
                      onRate={handleRate}
                      disabled={ratingId === log.id}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
