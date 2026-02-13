import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { garminConnectSchema, intervalsConnectSchema, sportTypes, sportTypeLabels, fitnessLevels, fitnessLevelLabels } from "@shared/schema";
import type { GarminConnectInput, IntervalsConnectInput } from "@shared/schema";
import {
  Watch,
  Loader2,
  CheckCircle,
  XCircle,
  Settings,
  Unlink,
  BarChart3,
  FlaskConical,
  ExternalLink,
} from "lucide-react";

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();

  const garminForm = useForm<GarminConnectInput>({
    resolver: zodResolver(garminConnectSchema),
    defaultValues: {
      garminEmail: user?.garminEmail || "",
      garminPassword: "",
    },
  });

  const connectMutation = useMutation({
    mutationFn: async (data: GarminConnectInput) => {
      const res = await apiRequest("POST", "/api/garmin/connect", data);
      return res.json();
    },
    onSuccess: (data) => {
      updateUser(data);
      toast({ title: "Garmin подключён" });
      garminForm.reset({ garminEmail: data.garminEmail || "", garminPassword: "" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка подключения", description: error.message, variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/garmin/disconnect");
      return res.json();
    },
    onSuccess: (data) => {
      updateUser(data);
      toast({ title: "Garmin отключён" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const intervalsForm = useForm<IntervalsConnectInput>({
    resolver: zodResolver(intervalsConnectSchema),
    defaultValues: {
      athleteId: user?.intervalsAthleteId || "",
      apiKey: "",
    },
  });

  const intervalsConnectMutation = useMutation({
    mutationFn: async (data: IntervalsConnectInput) => {
      const res = await apiRequest("POST", "/api/intervals/connect", data);
      return res.json();
    },
    onSuccess: (data) => {
      updateUser(data);
      toast({ title: "Intervals.icu подключён" });
      intervalsForm.reset({ athleteId: data.intervalsAthleteId || "", apiKey: "" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка подключения", description: error.message, variant: "destructive" });
    },
  });

  const intervalsDisconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/intervals/disconnect");
      return res.json();
    },
    onSuccess: (data) => {
      updateUser(data);
      toast({ title: "Intervals.icu отключён" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await apiRequest("PATCH", "/api/auth/profile", data);
      return res.json();
    },
    onSuccess: (data) => {
      updateUser(data);
      toast({ title: "Профиль обновлён" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const [selectedSports, setSelectedSports] = useState<string[]>(user?.sportTypes || ["running"]);
  const [goals, setGoals] = useState(user?.goals || "");
  const [fitnessLevel, setFitnessLevel] = useState(user?.fitnessLevel || "");
  const [age, setAge] = useState(user?.age?.toString() || "");
  const [weeklyHours, setWeeklyHours] = useState(user?.weeklyHours?.toString() || "");
  const [experienceYears, setExperienceYears] = useState(user?.experienceYears?.toString() || "");
  const [injuries, setInjuries] = useState(user?.injuries || "");
  const [personalRecords, setPersonalRecords] = useState(user?.personalRecords || "");
  const [preferences, setPreferences] = useState(user?.preferences || "");

  const handleSaveProfile = () => {
    updateProfileMutation.mutate({
      sportTypes: selectedSports,
      goals,
      fitnessLevel: fitnessLevel || undefined,
      age: age ? parseInt(age) : null,
      weeklyHours: weeklyHours ? parseFloat(weeklyHours) : null,
      experienceYears: experienceYears ? parseInt(experienceYears) : null,
      injuries: injuries || undefined,
      personalRecords: personalRecords || undefined,
      preferences: preferences || undefined,
    });
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-settings-title">
          <Settings className="w-6 h-6 inline mr-2" />
          Настройки
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Управление аккаунтом и подключениями
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-accent flex items-center justify-center flex-shrink-0">
                <Watch className="w-5 h-5 text-accent-foreground" />
              </div>
              <div>
                <h2 className="font-semibold text-sm">Garmin Connect</h2>
                <p className="text-xs text-muted-foreground">Подключение к часам</p>
              </div>
            </div>
            {user?.garminConnected ? (
              <Badge variant="secondary">
                <div className="w-1.5 h-1.5 rounded-full bg-status-online mr-1.5" />
                Подключено
              </Badge>
            ) : (
              <Badge variant="outline">
                <div className="w-1.5 h-1.5 rounded-full bg-status-offline mr-1.5" />
                Не подключено
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {user?.garminConnected ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Аккаунт: <span className="font-medium text-foreground">{user.garminEmail}</span>
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
                data-testid="button-disconnect-garmin"
              >
                {disconnectMutation.isPending ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <Unlink className="w-3 h-3 mr-1" />
                )}
                Отключить
              </Button>
            </div>
          ) : (
            <Form {...garminForm}>
              <form
                onSubmit={garminForm.handleSubmit((d) => connectMutation.mutate(d))}
                className="space-y-4"
              >
                <FormField
                  control={garminForm.control}
                  name="garminEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Garmin Connect</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="your@email.com"
                          {...field}
                          data-testid="input-garmin-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={garminForm.control}
                  name="garminPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Пароль Garmin Connect</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          {...field}
                          data-testid="input-garmin-password"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  disabled={connectMutation.isPending}
                  data-testid="button-connect-garmin"
                >
                  {connectMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Watch className="w-4 h-4 mr-2" />
                  )}
                  Подключить Garmin
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-accent flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-5 h-5 text-accent-foreground" />
              </div>
              <div>
                <h2 className="font-semibold text-sm">Intervals.icu</h2>
                <p className="text-xs text-muted-foreground">Zwift, Polar, Suunto, COROS, Huawei</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">
                <FlaskConical className="w-3 h-3 mr-1" />
                Эксперимент
              </Badge>
              {user?.intervalsConnected ? (
                <Badge variant="secondary">
                  <div className="w-1.5 h-1.5 rounded-full bg-status-online mr-1.5" />
                  Подключено
                </Badge>
              ) : (
                <Badge variant="outline">
                  <div className="w-1.5 h-1.5 rounded-full bg-status-offline mr-1.5" />
                  Не подключено
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {user?.intervalsConnected ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Athlete ID: <span className="font-medium text-foreground">{user.intervalsAthleteId}</span>
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => intervalsDisconnectMutation.mutate()}
                disabled={intervalsDisconnectMutation.isPending}
                data-testid="button-disconnect-intervals"
              >
                {intervalsDisconnectMutation.isPending ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <Unlink className="w-3 h-3 mr-1" />
                )}
                Отключить
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground space-y-2 bg-accent/50 rounded-md p-3">
                <p className="font-medium text-foreground">Для чего это нужно?</p>
                <p>
                  Intervals.icu — бесплатная платформа для анализа тренировок. Через неё можно отправлять
                  тренировки в <span className="font-medium text-foreground">Zwift</span> и другие сервисы.
                  Подходит для часов <span className="font-medium text-foreground">Polar, Suunto, COROS, Huawei</span> и всех,
                  кто не использует Garmin.
                </p>
                <p className="font-medium text-foreground">Как подключить:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>
                    Зарегистрируйтесь на{" "}
                    <a href="https://intervals.icu" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-0.5">
                      intervals.icu <ExternalLink className="w-3 h-3" />
                    </a>
                  </li>
                  <li>Подключите Zwift/Strava/часы в настройках Intervals.icu</li>
                  <li>Откройте Settings &rarr; Developer Settings</li>
                  <li>Скопируйте <span className="font-medium text-foreground">Athlete ID</span> (начинается с &quot;i&quot;) и <span className="font-medium text-foreground">API Key</span></li>
                  <li>Вставьте их ниже</li>
                </ol>
              </div>
              <Form {...intervalsForm}>
                <form
                  onSubmit={intervalsForm.handleSubmit((d) => intervalsConnectMutation.mutate(d))}
                  className="space-y-4"
                >
                  <FormField
                    control={intervalsForm.control}
                    name="athleteId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Athlete ID</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="i12345"
                            {...field}
                            data-testid="input-intervals-athlete-id"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={intervalsForm.control}
                    name="apiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>API Key</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            {...field}
                            data-testid="input-intervals-api-key"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    disabled={intervalsConnectMutation.isPending}
                    data-testid="button-connect-intervals"
                  >
                    {intervalsConnectMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <BarChart3 className="w-4 h-4 mr-2" />
                    )}
                    Подключить Intervals.icu
                  </Button>
                </form>
              </Form>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader className="pb-4">
          <h2 className="font-semibold text-sm">Профиль спортсмена</h2>
          <p className="text-xs text-muted-foreground">Чем больше тренер знает о вас, тем точнее рекомендации</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <label className="text-sm font-medium mb-2 block">Виды спорта</label>
            <div className="flex flex-wrap gap-4">
              {sportTypes.map((sport) => (
                <label key={sport} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={selectedSports.includes(sport)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedSports((prev) => [...prev, sport]);
                      } else {
                        setSelectedSports((prev) => prev.filter((s) => s !== sport));
                      }
                    }}
                    data-testid={`checkbox-setting-sport-${sport}`}
                  />
                  <span className="text-sm">{sportTypeLabels[sport]}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Уровень подготовки</label>
              <Select value={fitnessLevel} onValueChange={setFitnessLevel}>
                <SelectTrigger data-testid="select-fitness-level">
                  <SelectValue placeholder="Выберите уровень" />
                </SelectTrigger>
                <SelectContent>
                  {fitnessLevels.map((level) => (
                    <SelectItem key={level} value={level}>
                      {fitnessLevelLabels[level]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Возраст</label>
              <Input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="35"
                min={10}
                max={100}
                data-testid="input-age"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Часов тренировок в неделю</label>
              <Input
                type="number"
                value={weeklyHours}
                onChange={(e) => setWeeklyHours(e.target.value)}
                placeholder="5"
                min={0}
                max={40}
                step={0.5}
                data-testid="input-weekly-hours"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Лет в спорте</label>
              <Input
                type="number"
                value={experienceYears}
                onChange={(e) => setExperienceYears(e.target.value)}
                placeholder="3"
                min={0}
                max={50}
                data-testid="input-experience-years"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Цели</label>
            <Input
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              placeholder="Марафон за 3:30, Ironman 70.3, выбежать 5 км из 20 мин"
              data-testid="input-goals"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Личные рекорды</label>
            <Textarea
              value={personalRecords}
              onChange={(e) => setPersonalRecords(e.target.value)}
              placeholder="5 км — 22:30, 10 км — 48:00, полумарафон — 1:50"
              className="resize-none"
              rows={2}
              data-testid="input-personal-records"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Травмы и ограничения</label>
            <Textarea
              value={injuries}
              onChange={(e) => setInjuries(e.target.value)}
              placeholder="Колено беспокоит после длительных, проблемы с ахиллом..."
              className="resize-none"
              rows={2}
              data-testid="input-injuries"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Предпочтения по тренировкам</label>
            <Textarea
              value={preferences}
              onChange={(e) => setPreferences(e.target.value)}
              placeholder="Люблю интервалы, не люблю длительные больше 2 часов, тренируюсь утром"
              className="resize-none"
              rows={2}
              data-testid="input-preferences"
            />
          </div>

          <Button
            variant="outline"
            onClick={handleSaveProfile}
            disabled={updateProfileMutation.isPending}
            data-testid="button-save-profile"
          >
            {updateProfileMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : null}
            Сохранить профиль
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
