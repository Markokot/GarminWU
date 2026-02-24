import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Link } from "wouter";
import {
  Activity,
  Clock,
  Flame,
  Heart,
  MessageSquare,
  Watch,
  ArrowRight,
  MapPin,
  CalendarDays,
  UserCircle,
  Wifi,
  Dumbbell,
  CheckCircle2,
  Loader2,
  RefreshCw,
  TrendingUp,
  Zap,
  Route,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { GarminActivity, UpcomingWorkout } from "@shared/schema";
import { sportTypeLabels } from "@shared/schema";
import { OnboardingDialog } from "@/components/onboarding-dialog";
import { ReadinessCard } from "@/components/readiness-card";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ru } from "date-fns/locale";

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

const ACTIVITY_COLORS: Record<string, string> = {
  running: "#22c55e",
  trail_running: "#16a34a",
  cycling: "#3b82f6",
  swimming: "#06b6d4",
  strength_training: "#f97316",
  walking: "#a855f7",
  hiking: "#84cc16",
  yoga: "#ec4899",
  other: "#94a3b8",
};

const ACTIVITY_LABELS: Record<string, string> = {
  running: "Бег",
  trail_running: "Трейл",
  cycling: "Велосипед",
  swimming: "Плавание",
  strength_training: "Силовая",
  walking: "Ходьба",
  hiking: "Хайкинг",
  yoga: "Йога",
  other: "Другое",
};

function normalizeActivityType(raw: string): string {
  const lower = raw.toLowerCase().replace(/\s+/g, "_");
  if (lower.includes("run") && !lower.includes("trail")) return "running";
  if (lower.includes("trail")) return "trail_running";
  if (lower.includes("cycl") || lower.includes("bik")) return "cycling";
  if (lower.includes("swim")) return "swimming";
  if (lower.includes("strength") || lower.includes("weight") || lower.includes("gym")) return "strength_training";
  if (lower.includes("walk")) return "walking";
  if (lower.includes("hik")) return "hiking";
  if (lower.includes("yoga")) return "yoga";
  return "other";
}

function ActivityDonutChart({ activities }: { activities: GarminActivity[] }) {
  const stats = useMemo(() => {
    if (!activities.length) return null;

    const totalDistance = activities.reduce((s, a) => s + (a.distance || 0), 0);
    const totalDuration = activities.reduce((s, a) => s + (a.duration || 0), 0);
    const totalCount = activities.length;
    const avgHR = Math.round(
      activities.filter((a) => a.averageHR).reduce((s, a) => s + (a.averageHR || 0), 0) /
        (activities.filter((a) => a.averageHR).length || 1)
    );

    const byType: Record<string, { count: number; duration: number; distance: number }> = {};
    for (const a of activities) {
      const type = normalizeActivityType(a.activityType);
      if (!byType[type]) byType[type] = { count: 0, duration: 0, distance: 0 };
      byType[type].count++;
      byType[type].duration += a.duration || 0;
      byType[type].distance += a.distance || 0;
    }

    const chartData = Object.entries(byType)
      .map(([type, data]) => ({
        name: ACTIVITY_LABELS[type] || type,
        value: data.count,
        duration: data.duration,
        distance: data.distance,
        color: ACTIVITY_COLORS[type] || ACTIVITY_COLORS.other,
      }))
      .sort((a, b) => b.value - a.value);

    return { totalDistance, totalDuration, totalCount, avgHR, chartData };
  }, [activities]);

  if (!stats) return null;

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-popover border rounded-lg shadow-lg px-3 py-2 text-sm" data-testid="tooltip-donut">
        <p className="font-medium" style={{ color: d.color }}>{d.name}</p>
        <p className="text-muted-foreground">{d.value} тренировок</p>
        <p className="text-muted-foreground">{formatDuration(d.duration)}</p>
        {d.distance > 0 && <p className="text-muted-foreground">{formatDistance(d.distance)}</p>}
      </div>
    );
  };

  return (
    <Card data-testid="card-activity-stats">
      <CardContent className="p-4 sm:p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Сводка активностей
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-center">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 rounded-xl p-4 text-center" data-testid="stat-total-count">
              <Zap className="w-5 h-5 text-green-500 mx-auto mb-1.5" />
              <p className="text-2xl font-bold">{stats.totalCount}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Тренировок</p>
            </div>
            <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-xl p-4 text-center" data-testid="stat-total-distance">
              <Route className="w-5 h-5 text-blue-500 mx-auto mb-1.5" />
              <p className="text-2xl font-bold">{stats.totalDistance >= 1000 ? `${(stats.totalDistance / 1000).toFixed(0)}` : `${Math.round(stats.totalDistance)}`}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stats.totalDistance >= 1000 ? "км" : "м"}</p>
            </div>
            <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 rounded-xl p-4 text-center" data-testid="stat-total-duration">
              <Clock className="w-5 h-5 text-orange-500 mx-auto mb-1.5" />
              <p className="text-2xl font-bold">{Math.round(stats.totalDuration / 3600)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Часов</p>
            </div>
            <div className="bg-gradient-to-br from-red-500/10 to-red-600/5 rounded-xl p-4 text-center" data-testid="stat-avg-hr">
              <Heart className="w-5 h-5 text-red-500 mx-auto mb-1.5" />
              <p className="text-2xl font-bold">{stats.avgHR || "—"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Ср. пульс</p>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <div className="relative w-[180px] h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {stats.chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} className="transition-opacity hover:opacity-80" />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-2xl font-bold">{stats.chartData.length}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">видов<br/>спорта</p>
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 max-w-[220px]">
              {stats.chartData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-1.5 text-xs" data-testid={`legend-${entry.name}`}>
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                  <span className="text-muted-foreground">{entry.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: typeof UserCircle;
  completed: boolean;
  href: string;
  buttonText: string;
}

function OnboardingSteps({ steps }: { steps: OnboardingStep[] }) {
  const completedCount = steps.filter((s) => s.completed).length;
  const totalSteps = steps.length;
  const allDone = completedCount === totalSteps;

  if (allDone) return null;

  const progressPercent = Math.round((completedCount / totalSteps) * 100);

  return (
    <Card data-testid="card-onboarding-steps">
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold" data-testid="text-onboarding-title">Начало работы</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {completedCount} из {totalSteps} шагов выполнено
            </p>
          </div>
          <span className="text-2xl font-bold text-primary" data-testid="text-onboarding-progress">
            {progressPercent}%
          </span>
        </div>
        <Progress value={progressPercent} className="h-2 mb-5" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.id}
                className={`relative rounded-lg border p-4 transition-colors ${
                  step.completed
                    ? "bg-muted/50 border-muted"
                    : "bg-card border-border hover:border-primary/50"
                }`}
                data-testid={`onboarding-step-${step.id}`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                      step.completed
                        ? "bg-primary/10 text-primary"
                        : "bg-accent text-accent-foreground"
                    }`}
                  >
                    {step.completed ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3
                      className={`text-sm font-medium ${
                        step.completed ? "line-through text-muted-foreground" : ""
                      }`}
                    >
                      {step.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {step.description}
                    </p>
                    {!step.completed && (
                      <Link href={step.href}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 h-7 text-xs"
                          data-testid={`button-onboarding-${step.id}`}
                        >
                          {step.buttonText}
                          <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [rescheduleWorkout, setRescheduleWorkout] = useState<UpcomingWorkout | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    if (user && !user.onboardingShown) {
      setShowOnboarding(true);
    }
  }, [user]);

  const rescheduleMutation = useMutation({
    mutationFn: async ({ workout, newDate }: { workout: UpcomingWorkout; newDate: string }) => {
      const workoutId = workout.workoutId || workout.id.replace(/^(garmin|intervals)-/, "");
      if (!workoutId) throw new Error("Не удалось определить ID тренировки");
      const url = workout.source === "garmin"
        ? "/api/garmin/reschedule-workout"
        : "/api/intervals/reschedule-workout";
      const res = await apiRequest("POST", url, {
        workoutId,
        newDate,
        currentDate: workout.date,
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.message || "Ошибка переноса");
    },
    onSuccess: () => {
      toast({ title: "Тренировка перенесена" });
      queryClient.invalidateQueries({ queryKey: ["/api/upcoming-workouts"] });
      setRescheduleWorkout(null);
      setSelectedDate(undefined);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка переноса",
        description: error.message || "Попробуйте позже",
        variant: "destructive",
      });
    },
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/refresh-data");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/upcoming-workouts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/readiness"] });
      toast({ title: "Данные обновлены" });
    },
    onError: () => {
      toast({ title: "Ошибка обновления", variant: "destructive" });
    },
  });

  const hasAnyConnection = !!user?.garminConnected || !!user?.intervalsConnected;

  const profileFilled = !!(
    user &&
    user.sportTypes &&
    user.sportTypes.length > 0 &&
    user.fitnessLevel &&
    user.goals
  );

  const hasWorkout = !!(
    (user?.garminPushCount && user.garminPushCount > 0) ||
    (user?.intervalsPushCount && user.intervalsPushCount > 0)
  );

  const onboardingSteps: OnboardingStep[] = [
    {
      id: "profile",
      title: "Заполните профиль",
      description: "Укажите виды спорта, уровень и цели",
      icon: UserCircle,
      completed: profileFilled,
      href: "/settings",
      buttonText: "Заполнить",
    },
    {
      id: "device",
      title: "Подключите устройство",
      description: "Garmin Connect или Intervals.icu",
      icon: Wifi,
      completed: hasAnyConnection,
      href: "/settings",
      buttonText: "Подключить",
    },
    {
      id: "workout",
      title: "Создайте тренировку",
      description: "Попросите AI тренера составить план",
      icon: Dumbbell,
      completed: hasWorkout,
      href: "/coach",
      buttonText: "Создать",
    },
  ];

  const showOnboardingSteps = onboardingSteps.some((s) => !s.completed);

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


  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-welcome">
            Привет, {user?.username}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {showOnboardingSteps
              ? "Выполните несколько шагов, чтобы начать тренироваться"
              : "Обзор ваших тренировок и активности"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasAnyConnection && (
            <Button
              variant="outline"
              size="sm"
              disabled={refreshMutation.isPending}
              onClick={() => refreshMutation.mutate()}
              data-testid="button-refresh-data"
            >
              <RefreshCw className={`w-4 h-4 mr-1.5 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
              Обновить
            </Button>
          )}
          <Link href="/coach">
            <Button data-testid="button-goto-coach">
              <MessageSquare className="w-4 h-4 mr-2" />
              AI Тренер
            </Button>
          </Link>
        </div>
      </div>

      {showOnboardingSteps && <OnboardingSteps steps={onboardingSteps} />}

      {hasAnyConnection && <ReadinessCard />}

      {hasAnyConnection && activities && activities.length > 0 && (
        <ActivityDonutChart activities={activities} />
      )}

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
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {w.isToday && (
                          <Badge className="text-xs" data-testid="badge-today">Сегодня</Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-muted-foreground"
                          data-testid={`button-reschedule-${w.id}`}
                          onClick={() => {
                            setRescheduleWorkout(w);
                            setSelectedDate(undefined);
                          }}
                        >
                          <CalendarDays className="w-3 h-3 mr-1" />
                          Перенести
                        </Button>
                      </div>
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

      <Dialog
        open={!!rescheduleWorkout}
        onOpenChange={(open) => {
          if (!open) {
            setRescheduleWorkout(null);
            setSelectedDate(undefined);
          }
        }}
      >
        <DialogContent className="sm:max-w-md" data-testid="dialog-reschedule">
          <DialogHeader>
            <DialogTitle>Перенести тренировку</DialogTitle>
            <DialogDescription>
              {rescheduleWorkout && (
                <>
                  <span className="font-medium text-foreground">{rescheduleWorkout.name}</span>
                  {" — "}
                  {new Date(rescheduleWorkout.date + "T12:00:00").toLocaleDateString("ru-RU", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              locale={ru}
              disabled={(date) => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                return date < today;
              }}
              data-testid="calendar-reschedule"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRescheduleWorkout(null);
                setSelectedDate(undefined);
              }}
              data-testid="button-reschedule-cancel"
            >
              Отмена
            </Button>
            <Button
              disabled={!selectedDate || rescheduleMutation.isPending}
              onClick={() => {
                if (!rescheduleWorkout || !selectedDate) return;
                const y = selectedDate.getFullYear();
                const m = String(selectedDate.getMonth() + 1).padStart(2, "0");
                const d = String(selectedDate.getDate()).padStart(2, "0");
                const newDate = `${y}-${m}-${d}`;
                rescheduleMutation.mutate({ workout: rescheduleWorkout, newDate });
              }}
              data-testid="button-reschedule-confirm"
            >
              {rescheduleMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Переносим...
                </>
              ) : (
                "Перенести"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <OnboardingDialog open={showOnboarding} onClose={() => setShowOnboarding(false)} />
    </div>
  );
}
