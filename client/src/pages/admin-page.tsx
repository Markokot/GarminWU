import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Users,
  MessageSquare,
  Watch,
  FlaskConical,
  Activity,
  TrendingUp,
  Clock,
  Star,
  User,
  Dumbbell,
  Target,
  Calendar,
  HeartPulse,
} from "lucide-react";
import { sportTypeLabels, fitnessLevelLabels, garminWatchLabels } from "@shared/schema";
import type { SportType, FitnessLevel, GarminWatchModel, ChatMessage } from "@shared/schema";

interface UserStat {
  id: string;
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

interface UserProfile {
  id: string;
  username: string;
  garminEmail?: string;
  garminConnected: boolean;
  intervalsAthleteId?: string;
  intervalsConnected: boolean;
  sportTypes: SportType[];
  goals: string;
  fitnessLevel?: FitnessLevel;
  age?: number;
  weeklyHours?: number;
  experienceYears?: number;
  injuries?: string;
  personalRecords?: string;
  preferences?: string;
  garminWatch?: GarminWatchModel;
  garminPushCount?: number;
  intervalsPushCount?: number;
  favoritesCount?: number;
  lastLogin?: string;
}

function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateFull(dateStr: string | null | undefined): string {
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

function UserDetailDialog({ userId, open, onOpenChange }: { userId: string | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: profile, isLoading: profileLoading } = useQuery<UserProfile>({
    queryKey: ["/api/admin/users", userId, "profile"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${userId}/profile`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!userId && open,
  });

  const { data: messages, isLoading: messagesLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/admin/users", userId, "messages"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${userId}/messages`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!userId && open,
  });

  const isLoading = profileLoading || messagesLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col" data-testid="dialog-user-detail">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            {profile?.username || "Загрузка..."}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <ScrollArea className="flex-1 overflow-y-auto pr-2" style={{ maxHeight: "calc(85vh - 80px)" }}>
            <div className="space-y-4">
              {profile && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Dumbbell className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Виды спорта:</span>
                        <span className="font-medium">
                          {profile.sportTypes.length > 0
                            ? profile.sportTypes.map(s => sportTypeLabels[s] || s).join(", ")
                            : "—"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Target className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Уровень:</span>
                        <span className="font-medium">
                          {profile.fitnessLevel ? fitnessLevelLabels[profile.fitnessLevel] || profile.fitnessLevel : "—"}
                        </span>
                      </div>
                      {profile.age && (
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Возраст:</span>
                          <span className="font-medium">{profile.age} лет</span>
                        </div>
                      )}
                      {profile.experienceYears !== undefined && profile.experienceYears !== null && (
                        <div className="flex items-center gap-2 text-sm">
                          <TrendingUp className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Стаж:</span>
                          <span className="font-medium">{profile.experienceYears} лет</span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Watch className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Часы:</span>
                        <span className="font-medium">
                          {profile.garminWatch ? garminWatchLabels[profile.garminWatch] || profile.garminWatch : "—"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Watch className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Garmin:</span>
                        <Badge variant={profile.garminConnected ? "default" : "secondary"} className="text-xs">
                          {profile.garminConnected ? "Подключён" : "Нет"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <FlaskConical className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Intervals.icu:</span>
                        <Badge variant={profile.intervalsConnected ? "default" : "secondary"} className="text-xs">
                          {profile.intervalsConnected ? "Подключён" : "Нет"}
                        </Badge>
                      </div>
                      {profile.weeklyHours !== undefined && profile.weeklyHours !== null && (
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Часов/нед:</span>
                          <span className="font-medium">{profile.weeklyHours}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {profile.goals && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Цели: </span>
                      <span>{profile.goals}</span>
                    </div>
                  )}
                  {profile.injuries && (
                    <div className="text-sm">
                      <HeartPulse className="w-4 h-4 text-muted-foreground inline mr-1" />
                      <span className="text-muted-foreground">Травмы: </span>
                      <span>{profile.injuries}</span>
                    </div>
                  )}
                  {profile.personalRecords && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Рекорды: </span>
                      <span>{profile.personalRecords}</span>
                    </div>
                  )}

                  <div className="flex gap-4 text-xs text-muted-foreground border-t pt-2">
                    <span>Garmin: {profile.garminPushCount || 0} отправок</span>
                    <span>Intervals: {profile.intervalsPushCount || 0} отправок</span>
                    <span>Избранное: {profile.favoritesCount || 0}</span>
                    <span>Логин: {formatDateShort(profile.lastLogin)}</span>
                  </div>
                </div>
              )}

              <div className="border-t pt-3">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  История чата
                  {messages && <span className="text-muted-foreground font-normal">({messages.length} сообщений)</span>}
                </h3>

                {messages && messages.length > 0 ? (
                  <div className="space-y-3">
                    {messages.filter(m => m.role !== "system").map((msg) => (
                      <div
                        key={msg.id}
                        className={`text-sm rounded-lg p-3 ${
                          msg.role === "user"
                            ? "bg-primary/10 border border-primary/20 ml-0 mr-8"
                            : "bg-muted/50 border border-border ml-8 mr-0"
                        }`}
                        data-testid={`message-${msg.id}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium">
                            {msg.role === "user" ? profile?.username || "Пользователь" : "AI Тренер"}
                          </span>
                          <span className="text-xs text-muted-foreground">{formatDateShort(msg.timestamp)}</span>
                        </div>
                        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                          {msg.content.length > 2000 ? msg.content.substring(0, 2000) + "..." : msg.content}
                        </p>
                        {msg.workoutJson && (
                          <Badge variant="outline" className="mt-1 text-xs">Тренировка</Badge>
                        )}
                        {msg.workoutsJson && msg.workoutsJson.length > 0 && (
                          <Badge variant="outline" className="mt-1 text-xs">План ({msg.workoutsJson.length} тренировок)</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Нет сообщений</p>
                )}
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function AdminPage() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: stats, isLoading, error } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
  });

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
                  <tr
                    key={user.username}
                    className="border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors"
                    data-testid={`row-user-${idx}`}
                    onClick={() => {
                      setSelectedUserId(user.id);
                      setDialogOpen(true);
                    }}
                  >
                    <td className="py-2.5 sticky left-0 bg-card z-10 pr-3">
                      <span className="font-medium text-primary underline-offset-2 hover:underline">{user.username}</span>
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

      <UserDetailDialog
        userId={selectedUserId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
