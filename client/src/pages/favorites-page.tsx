import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import type { FavoriteWorkout } from "@shared/schema";
import { sportTypeLabels, stepTypeLabels } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import {
  Star,
  Watch,
  Trash2,
  MessageSquare,
  Loader2,
  Clock,
  ArrowRight,
  BarChart3,
} from "lucide-react";

function StepSummary({ steps }: { steps: FavoriteWorkout["steps"] }) {
  return (
    <div className="space-y-1">
      {steps.map((step, i) => {
        const label = stepTypeLabels[step.stepType] || step.stepType;
        let duration = "";
        if (step.durationValue) {
          if (step.durationType === "time") {
            const m = Math.floor(step.durationValue / 60);
            const s = step.durationValue % 60;
            duration = s > 0 ? `${m}:${s.toString().padStart(2, "0")}` : `${m} мин`;
          } else if (step.durationType === "distance") {
            duration = step.durationValue >= 1000
              ? `${(step.durationValue / 1000).toFixed(1)} км`
              : `${step.durationValue} м`;
          }
        } else if (step.durationType === "lap.button") {
          duration = "по кнопке";
        }

        return (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="w-5 h-5 rounded-md bg-accent flex items-center justify-center flex-shrink-0 text-[10px] font-medium text-accent-foreground">
              {i + 1}
            </div>
            <span className="font-medium">{label}</span>
            {duration && <span className="text-muted-foreground">{duration}</span>}
            {step.stepType === "repeat" && step.repeatCount && (
              <Badge variant="secondary" className="text-[10px]">x{step.repeatCount}</Badge>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function FavoritesPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: favorites = [], isLoading } = useQuery<FavoriteWorkout[]>({
    queryKey: ["/api/favorites"],
  });

  const pushMutation = useMutation({
    mutationFn: async (fav: FavoriteWorkout) => {
      const res = await apiRequest("POST", "/api/garmin/push-workout", fav);
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
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const pushIntervalsMutation = useMutation({
    mutationFn: async (fav: FavoriteWorkout) => {
      const res = await apiRequest("POST", "/api/intervals/push-workout", fav);
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
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/favorites/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Удалено из избранного" });
      queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-favorites-title">Избранное</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Сохранённые тренировки для быстрой отправки на часы
          </p>
        </div>
        <Link href="/coach">
          <Button data-testid="button-create-workout">
            <MessageSquare className="w-4 h-4 mr-2" />
            Создать с AI
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-4 w-2/3" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-8 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : favorites.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Star className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Нет избранных тренировок</h2>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
              Создайте тренировку в чате с AI-тренером и нажмите "В избранное", чтобы сохранить
            </p>
            <Link href="/coach">
              <Button data-testid="button-go-to-coach">
                <MessageSquare className="w-4 h-4 mr-2" />
                Перейти к AI тренеру
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {favorites.map((fav) => (
            <Card key={fav.id} data-testid={`card-favorite-${fav.id}`}>
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <h3 className="font-semibold truncate">{fav.name}</h3>
                      <Badge variant="outline" className="text-xs">
                        {sportTypeLabels[fav.sportType]}
                      </Badge>
                    </div>
                    {fav.description && (
                      <p className="text-sm text-muted-foreground mb-3">{fav.description}</p>
                    )}
                    <StepSummary steps={fav.steps} />
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-3">
                      <Clock className="w-3 h-3" />
                      {new Date(fav.savedAt).toLocaleDateString("ru-RU", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                  <div className="flex sm:flex-col gap-2 flex-shrink-0">
                    {user?.garminConnected && (
                      <Button
                        size="sm"
                        onClick={() => pushMutation.mutate(fav)}
                        disabled={pushMutation.isPending}
                        data-testid={`button-push-garmin-${fav.id}`}
                      >
                        {pushMutation.isPending ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <Watch className="w-3 h-3 mr-1" />
                        )}
                        Garmin
                      </Button>
                    )}
                    {user?.intervalsConnected && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => pushIntervalsMutation.mutate(fav)}
                        disabled={pushIntervalsMutation.isPending}
                        data-testid={`button-push-intervals-${fav.id}`}
                      >
                        {pushIntervalsMutation.isPending ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <BarChart3 className="w-3 h-3 mr-1" />
                        )}
                        Intervals
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          data-testid={`button-delete-${fav.id}`}
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Удалить
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Удалить из избранного?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Тренировка "{fav.name}" будет удалена из избранного.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Отмена</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(fav.id)}>
                            Удалить
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
