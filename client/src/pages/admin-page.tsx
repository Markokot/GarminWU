import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  MessageSquare,
  Watch,
  FlaskConical,
  Activity,
  TrendingUp,
  Clock,
  Star,
  Bug,
  CheckCircle,
  Eye,
} from "lucide-react";
import { sportTypeLabels, fitnessLevelLabels } from "@shared/schema";
import type { SportType, FitnessLevel, BugReport } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface UserStat {
  username: string;
  garminConnected: boolean;
  intervalsConnected: boolean;
  sportTypes: SportType[];
  fitnessLevel: FitnessLevel | null;
  messageCount: number;
  totalMessages: number;
  garminPushCount: number;
  intervalsPushCount: number;
  favoritesCount: number;
  lastMessageDate: string | null;
  lastLogin: string | null;
}

interface AdminStats {
  totalUsers: number;
  garminConnected: number;
  intervalsConnected: number;
  totalGarminPushes: number;
  totalIntervalsPushes: number;
  totalFavorites: number;
  totalUserMessages: number;
  totalAiMessages: number;
  lastGlobalMessageDate: string | null;
  sportDistribution: Record<string, number>;
  fitnessDistribution: Record<string, number>;
  recentUsers: UserStat[];
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "только что";
  if (diffMin < 60) return `${diffMin} мин назад`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} ч назад`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} дн назад`;
  return "";
}

export default function AdminPage() {
  const { data: stats, isLoading, error } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
  });
  const { data: bugReports } = useQuery<BugReport[]>({
    queryKey: ["/api/admin/bug-reports"],
    enabled: !!stats,
  });
  const [updatingReport, setUpdatingReport] = useState<string | null>(null);

  const updateReportStatus = async (id: string, status: "read" | "resolved") => {
    setUpdatingReport(id);
    try {
      await apiRequest("PATCH", `/api/admin/bug-reports/${id}`, { status });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bug-reports"] });
    } catch {}
    setUpdatingReport(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
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

  if (!stats) return null;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold" data-testid="text-admin-title">Статистика</h1>
        <p className="text-sm text-muted-foreground">Обзор активности платформы</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Пользователей</span>
            </div>
            <p className="text-2xl font-bold" data-testid="text-total-users">{stats.totalUsers}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Star className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Избранное</span>
            </div>
            <p className="text-2xl font-bold" data-testid="text-total-favorites">{stats.totalFavorites}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Сообщений</span>
            </div>
            <p className="text-2xl font-bold" data-testid="text-total-messages">{stats.totalUserMessages}</p>
            <p className="text-xs text-muted-foreground mt-0.5">от пользователей</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Последнее сообщение</span>
            </div>
            <p className="text-sm font-medium" data-testid="text-last-message-date">
              {formatDateShort(stats.lastGlobalMessageDate)}
            </p>
            {stats.lastGlobalMessageDate && (
              <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(stats.lastGlobalMessageDate)}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Watch className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-sm">Подключения</h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Watch className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Garmin Connect</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold" data-testid="text-garmin-connected">{stats.garminConnected}</span>
                <span className="text-xs text-muted-foreground">из {stats.totalUsers}</span>
              </div>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary rounded-full h-2 transition-all"
                style={{ width: `${stats.totalUsers ? (stats.garminConnected / stats.totalUsers) * 100 : 0}%` }}
              />
            </div>

            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Intervals.icu</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold" data-testid="text-intervals-connected">{stats.intervalsConnected}</span>
                <span className="text-xs text-muted-foreground">из {stats.totalUsers}</span>
              </div>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary rounded-full h-2 transition-all"
                style={{ width: `${stats.totalUsers ? (stats.intervalsConnected / stats.totalUsers) * 100 : 0}%` }}
              />
            </div>

            <div className="border-t pt-3 mt-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Отправлено на Garmin</span>
                <span className="font-medium" data-testid="text-sent-garmin">{stats.totalGarminPushes}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Отправлено на Intervals.icu</span>
                <span className="font-medium" data-testid="text-sent-intervals">{stats.totalIntervalsPushes}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-sm">Распределение</h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-2">Виды спорта</p>
              <div className="space-y-1.5">
                {Object.entries(stats.sportDistribution).map(([sport, count]) => (
                  <div key={sport} className="flex items-center justify-between">
                    <span className="text-sm">{sportTypeLabels[sport as SportType] || sport}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-muted rounded-full h-1.5">
                        <div
                          className="bg-primary rounded-full h-1.5"
                          style={{ width: `${(count / stats.totalUsers) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-6 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t pt-3">
              <p className="text-xs text-muted-foreground mb-2">Уровень подготовки</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.fitnessDistribution).map(([level, count]) => (
                  <Badge key={level} variant="secondary" className="text-xs">
                    {level === "not_set" ? "Не указан" : fitnessLevelLabels[level as FitnessLevel] || level}
                    <span className="ml-1 font-bold">{count}</span>
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-sm">Все пользователи</h2>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto relative">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium sticky left-0 bg-card z-10 pr-3">Пользователь</th>
                  <th className="pb-2 font-medium text-center" title="Подключение Garmin">G</th>
                  <th className="pb-2 font-medium text-center" title="Подключение Intervals.icu">I</th>
                  <th className="pb-2 font-medium text-right">Сообщ.</th>
                  <th className="pb-2 font-medium text-right whitespace-nowrap" title="Отправлено на Garmin">Garmin</th>
                  <th className="pb-2 font-medium text-right whitespace-nowrap" title="Отправлено в Intervals.icu">Int.icu</th>
                  <th className="pb-2 font-medium text-right whitespace-nowrap" title="Избранное">Избр.</th>
                  <th className="pb-2 font-medium text-right whitespace-nowrap">Логин</th>
                  <th className="pb-2 font-medium text-right whitespace-nowrap">Активность</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentUsers.map((user, idx) => (
                  <tr key={user.username} className="border-b last:border-0" data-testid={`row-user-${idx}`}>
                    <td className="py-2.5 sticky left-0 bg-card z-10 pr-3">
                      <span className="font-medium">{user.username}</span>
                    </td>
                    <td className="py-2.5 text-center">
                      <div className={`w-2 h-2 rounded-full mx-auto ${user.garminConnected ? "bg-status-online" : "bg-status-offline"}`} />
                    </td>
                    <td className="py-2.5 text-center">
                      <div className={`w-2 h-2 rounded-full mx-auto ${user.intervalsConnected ? "bg-status-online" : "bg-status-offline"}`} />
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{user.messageCount}</td>
                    <td className="py-2.5 text-right tabular-nums">{user.garminPushCount}</td>
                    <td className="py-2.5 text-right tabular-nums">{user.intervalsPushCount}</td>
                    <td className="py-2.5 text-right tabular-nums">{user.favoritesCount}</td>
                    <td className="py-2.5 text-right text-muted-foreground text-xs whitespace-nowrap">
                      {formatDateShort(user.lastLogin)}
                    </td>
                    <td className="py-2.5 text-right text-muted-foreground text-xs whitespace-nowrap">
                      {formatDateShort(user.lastMessageDate)}
                    </td>
                  </tr>
                ))}
                {stats.recentUsers.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-4 text-center text-muted-foreground">
                      Нет пользователей
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {bugReports && bugReports.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Bug className="w-5 h-5 text-destructive" />
              <h2 className="font-semibold text-sm">Сообщения об ошибках</h2>
              {bugReports.filter((r) => r.status === "new").length > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {bugReports.filter((r) => r.status === "new").length} новых
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {bugReports.map((report) => (
                <div
                  key={report.id}
                  className={`p-3 rounded-lg border ${
                    report.status === "new"
                      ? "border-destructive/30 bg-destructive/5"
                      : report.status === "read"
                        ? "border-yellow-500/30 bg-yellow-500/5"
                        : "border-green-500/30 bg-green-500/5"
                  }`}
                  data-testid={`bug-report-${report.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{report.username}</span>
                        <span className="text-xs text-muted-foreground">{formatDateShort(report.timestamp)}</span>
                        {report.page && (
                          <span className="text-xs text-muted-foreground">@ {report.page}</span>
                        )}
                        <Badge
                          variant={report.status === "new" ? "destructive" : report.status === "read" ? "secondary" : "outline"}
                          className="text-xs"
                        >
                          {report.status === "new" ? "Новое" : report.status === "read" ? "Прочитано" : "Решено"}
                        </Badge>
                      </div>
                      <p className="text-sm whitespace-pre-wrap break-words">{report.message}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {report.status === "new" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          disabled={updatingReport === report.id}
                          onClick={() => updateReportStatus(report.id, "read")}
                          title="Прочитано"
                          data-testid={`button-mark-read-${report.id}`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {report.status !== "resolved" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          disabled={updatingReport === report.id}
                          onClick={() => updateReportStatus(report.id, "resolved")}
                          title="Решено"
                          data-testid={`button-mark-resolved-${report.id}`}
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
