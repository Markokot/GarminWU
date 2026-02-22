import { useState, useEffect } from "react";
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
  Star,
  MapPin,
  CalendarDays,
} from "lucide-react";
import type { GarminActivity, FavoriteWorkout, UpcomingWorkout } from "@shared/schema";
import { sportTypeLabels } from "@shared/schema";
import { OnboardingDialog } from "@/components/onboarding-dialog";
import { ReadinessCard } from "@/components/readiness-card";

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
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (user && !user.onboardingShown) {
      setShowOnboarding(true);
    }
  }, [user]);

  const hasAnyConnection = !!user?.garminConnected || !!user?.intervalsConnected;

  const { data: activitiesData, isLoading: activitiesLoading } = useQuery<{ activities: GarminActivity[]; source: string }>({
    queryKey: ["/api/activities"],
    enabled: hasAnyConnection,
  });

  const activities = activitiesData?.activities;
  const activitiesSource = activitiesData?.source;

  const { data: upcomingData, isLoading: upcomingLoading } = useQuery<{ workouts: UpcomingWorkout[]; sources: { garmin: boolean; intervals: boolean } }>({
    queryKey: ["/api/upcoming-workouts"],
    enabled: hasAnyConnection,
  });

  const { data: favorites, isLoading: favoritesLoading } = useQuery<FavoriteWorkout[]>({
    queryKey: ["/api/favorites"],
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
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

      {hasAnyConnection && <ReadinessCard />}

      {hasAnyConnection && (
        <div>
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2" data-testid="text-upcoming-header">
              <CalendarDays className="w-5 h-5" />
              Предстоящие тренировки
            </h2>
            {upcomingData?.sources && (
              <div className="flex gap-1">
                {upcomingData.sources.garmin && (
                  <Badge variant="secondary" className="text-xs" data-testid="badge-source-garmin">Garmin</Badge>
                )}
                {upcomingData.sources.intervals && (
                  <Badge variant="secondary" className="text-xs" data-testid="badge-source-intervals">Intervals.icu</Badge>
                )}
              </div>
            )}
          </div>
          {upcomingLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4 space-y-3">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : upcomingData?.workouts && upcomingData.workouts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcomingData.workouts.map((w) => (
                <Card key={w.id} className={w.isToday ? "border-primary" : ""} data-testid={`card-upcoming-${w.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-medium text-sm truncate">{w.name}</h3>
                      {w.isToday && (
                        <Badge className="text-xs flex-shrink-0" data-testid="badge-today">Сегодня</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">
                        {new Date(w.date + "T12:00:00").toLocaleDateString("ru-RU", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {w.sportType === "running" ? "Бег" : w.sportType === "cycling" ? "Велосипед" : w.sportType === "swimming" ? "Плавание" : w.sportType}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {w.source === "garmin" ? "Garmin" : "Intervals"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm" data-testid="text-no-upcoming">
                Нет запланированных тренировок на ближайшие 14 дней
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {!hasAnyConnection && (
        <Card>
          <CardContent className="flex flex-col sm:flex-row items-center gap-4 py-6">
            <div className="w-12 h-12 rounded-md bg-accent flex items-center justify-center flex-shrink-0">
              <Watch className="w-6 h-6 text-accent-foreground" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h3 className="font-semibold">Подключите устройство</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Подключите Garmin Connect или Intervals.icu, чтобы видеть свои активности и загружать тренировки
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

      {hasAnyConnection && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Последние активности</h2>
            {activitiesSource && (
              <Badge variant="secondary" className="text-xs">
                <div className="w-1.5 h-1.5 rounded-full bg-status-online mr-1.5" />
                {activitiesSource === "garmin" ? "Garmin" : "Intervals.icu"}
              </Badge>
            )}
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
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-muted-foreground">
                            {new Date(activity.startTimeLocal).toLocaleDateString("ru-RU", {
                              day: "numeric",
                              month: "short",
                            })}
                          </p>
                          {activity.locationName && (
                            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                              <MapPin className="w-3 h-3" />
                              {activity.locationName}
                            </span>
                          )}
                        </div>
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Избранное</h2>
          {favorites && favorites.length > 0 && (
            <Link href="/favorites">
              <Button variant="ghost" size="sm" data-testid="button-view-all-favorites">
                Все
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          )}
        </div>
        {favoritesLoading ? (
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
        ) : favorites && favorites.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {favorites.slice(0, 3).map((fav) => (
              <Card key={fav.id} className="hover-elevate" data-testid={`card-favorite-${fav.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-medium text-sm truncate">{fav.name}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                    {fav.description || "Без описания"}
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {sportTypeLabels[fav.sportType]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {fav.steps.length} шагов
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <Star className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-3">Нет избранных тренировок</p>
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
      <OnboardingDialog open={showOnboarding} onClose={() => setShowOnboarding(false)} />
    </div>
  );
}
