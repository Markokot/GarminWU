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
import type { Workout } from "@shared/schema";
import { sportTypeLabels, stepTypeLabels } from "@shared/schema";
import {
  Dumbbell,
  Watch,
  Trash2,
  MessageSquare,
  Loader2,
  Clock,
  ArrowRight,
} from "lucide-react";

function StepSummary({ workout }: { workout: Workout }) {
  return (
    <div className="space-y-1">
      {workout.steps.map((step, i) => {
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

export default function WorkoutsPage() {
  const { toast } = useToast();

  const { data: workouts = [], isLoading } = useQuery<Workout[]>({
    queryKey: ["/api/workouts"],
  });

  const pushMutation = useMutation({
    mutationFn: async (workout: Workout) => {
      const res = await apiRequest("POST", "/api/garmin/push-workout", workout);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Тренировка отправлена на Garmin" });
      queryClient.invalidateQueries({ queryKey: ["/api/workouts"] });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/workouts/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Тренировка удалена" });
      queryClient.invalidateQueries({ queryKey: ["/api/workouts"] });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-workouts-title">Тренировки</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Управление созданными тренировками
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
      ) : workouts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Dumbbell className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Нет тренировок</h2>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
              Попросите AI-тренера создать тренировку, и она появится здесь
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
          {workouts.map((workout) => (
            <Card key={workout.id} data-testid={`card-workout-${workout.id}`}>
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <h3 className="font-semibold truncate">{workout.name}</h3>
                      <Badge variant="outline" className="text-xs">
                        {sportTypeLabels[workout.sportType]}
                      </Badge>
                      {workout.sentToGarmin && (
                        <Badge variant="secondary" className="text-xs">
                          <Watch className="w-3 h-3 mr-1" />
                          На часах
                        </Badge>
                      )}
                    </div>
                    {workout.description && (
                      <p className="text-sm text-muted-foreground mb-3">{workout.description}</p>
                    )}
                    <StepSummary workout={workout} />
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-3">
                      <Clock className="w-3 h-3" />
                      {new Date(workout.createdAt).toLocaleDateString("ru-RU", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                  <div className="flex sm:flex-col gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      onClick={() => pushMutation.mutate(workout)}
                      disabled={pushMutation.isPending}
                      data-testid={`button-push-${workout.id}`}
                    >
                      {pushMutation.isPending ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Watch className="w-3 h-3 mr-1" />
                      )}
                      На часы
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          data-testid={`button-delete-${workout.id}`}
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Удалить
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Удалить тренировку?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Тренировка "{workout.name}" будет удалена. Это действие нельзя отменить.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Отмена</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(workout.id)}>
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
