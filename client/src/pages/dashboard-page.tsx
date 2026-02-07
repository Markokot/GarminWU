import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  Activity,
  Clock,
  Flame,
  Heart,
  MessageSquare,
  Watch,
  ArrowRight,
  Dumbbell,
} from "lucide-react";
import type { GarminActivity, Workout } from "@shared/schema";
import { sportTypeLabels } from "@shared/schema";

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}ч ${m}м`;
  return `${m}м`;
}

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} км`;
  return `${Math.round(meters)} м`;
}

function formatPace(secondsPerKm: number | undefined): string {
  if (!secondsPerKm) return "-";
  const m = Math.floor(secondsPerKm / 60);
  const s = Math.round(secondsPerKm % 60);
  return `${m}:${s.toString().padStart(2, "0")} /км`;
}

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: activities, isLoading: activitiesLoading } = useQuery<GarminActivity[]>({
    queryKey: ["/api/garmin/activities"],
    enabled: !!user?.garminConnected,
  });

  const { data: workouts, isLoading: workoutsLoading } = useQuery<Workout[]>({
    queryKey: ["/api/workouts"],
  });

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-welcome">
            Привет, {user?.username}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Обзор ваших тренировок и активности
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/coach">
            <Button data-testid="button-goto-coach">
              <MessageSquare className="w-4 h-4 mr-2" />
              AI Тренер
            </Button>
          </Link>
        </div>
      </div>

      {!user?.garminConnected && (
        <Card>
          <CardContent className="flex flex-col sm:flex-row items-center gap-4 py-6">
            <div className="w-12 h-12 rounded-md bg-accent flex items-center justify-center flex-shrink-0">
              <Watch className="w-6 h-6 text-accent-foreground" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h3 className="font-semibold">Подключите Garmin</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Подключите аккаунт Garmin Connect, чтобы видеть свои активности и загружать тренировки на часы
              </p>
            </div>
            <Link href="/settings">
              <Button variant="outline" data-testid="button-connect-garmin">
                Подключить
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {user?.garminConnected && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Последние активности</h2>
            <Badge variant="secondary" className="text-xs">
              <div className="w-1.5 h-1.5 rounded-full bg-status-online mr-1.5" />
              Garmin
            </Badge>
          </div>
          {activitiesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4 space-y-3">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                    <div className="flex gap-4">
                      <Skeleton className="h-8 w-16" />
                      <Skeleton className="h-8 w-16" />
                      <Skeleton className="h-8 w-16" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : activities && activities.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activities.slice(0, 6).map((activity) => (
                <Card key={activity.activityId} data-testid={`card-activity-${activity.activityId}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <h3 className="font-medium text-sm truncate">{activity.activityName}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(activity.startTimeLocal).toLocaleDateString("ru-RU", {
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs flex-shrink-0">
                        {activity.activityType}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        <span>{formatDistance(activity.distance)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{formatDuration(activity.duration)}</span>
                      </div>
                      {activity.averageHR && (
                        <div className="flex items-center gap-1">
                          <Heart className="w-3 h-3" />
                          <span>{activity.averageHR}</span>
                        </div>
                      )}
                    </div>
                    {activity.averagePace && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                        <Flame className="w-3 h-3" />
                        <span>Темп: {formatPace(activity.averagePace)}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                Нет недавних активностей
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div>
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Мои тренировки</h2>
        </div>
        {workoutsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-3">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : workouts && workouts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workouts.slice(0, 3).map((workout) => (
              <Card key={workout.id} className="hover-elevate" data-testid={`card-workout-${workout.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-medium text-sm truncate">{workout.name}</h3>
                    {workout.sentToGarmin && (
                      <Badge variant="secondary" className="text-xs flex-shrink-0">
                        <Watch className="w-3 h-3 mr-1" />
                        Garmin
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                    {workout.description || "Без описания"}
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {sportTypeLabels[workout.sportType]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {workout.steps.length} шагов
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <Dumbbell className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-3">Пока нет тренировок</p>
              <Link href="/coach">
                <Button size="sm" data-testid="button-create-first-workout">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Попросить AI создать
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
