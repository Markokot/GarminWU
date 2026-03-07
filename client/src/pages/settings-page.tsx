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
import { garminConnectSchema, intervalsConnectSchema, sportTypes, fitnessLevels, garminWatchModels, garminWatchLabels, swimStructuredWatchModels } from "@shared/schema";
import type { GarminWatchModel } from "@shared/schema";
import type { GarminConnectInput, IntervalsConnectInput } from "@shared/schema";
import { useTranslation } from "@/i18n/context";
import { languages } from "@/i18n/types";
import type { Language } from "@/i18n/types";
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
  Globe,
} from "lucide-react";

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const { t, language, setLanguage } = useTranslation();

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
      toast({ title: t("settings.garminConnected") });
      garminForm.reset({ garminEmail: data.garminEmail || "", garminPassword: "" });
    },
    onError: (error: Error) => {
      toast({ title: t("settings.connectionError"), description: error.message, variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/garmin/disconnect");
      return res.json();
    },
    onSuccess: (data) => {
      updateUser(data);
      toast({ title: t("settings.garminDisconnected") });
    },
    onError: (error: Error) => {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
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
      toast({ title: t("settings.intervalsConnected") });
      intervalsForm.reset({ athleteId: data.intervalsAthleteId || "", apiKey: "" });
    },
    onError: (error: Error) => {
      toast({ title: t("settings.connectionError"), description: error.message, variant: "destructive" });
    },
  });

  const intervalsDisconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/intervals/disconnect");
      return res.json();
    },
    onSuccess: (data) => {
      updateUser(data);
      toast({ title: t("settings.intervalsDisconnected") });
    },
    onError: (error: Error) => {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await apiRequest("PATCH", "/api/auth/profile", data);
      return res.json();
    },
    onSuccess: (data) => {
      updateUser(data);
      toast({ title: t("settings.profileUpdated") });
    },
    onError: (error: Error) => {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
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
  const [garminWatch, setGarminWatch] = useState(user?.garminWatch || "");

  const sportLabelMap: Record<string, string> = {
    running: t("sport.running"),
    cycling: t("sport.cycling"),
    swimming: t("sport.swimming"),
    trail_running: t("sport.trail_running"),
    strength_training: t("sport.strength_training"),
    walking: t("sport.walking"),
    hiking: t("sport.hiking"),
    yoga: t("sport.yoga"),
    other: t("sport.other"),
  };

  const fitnessLabelMap: Record<string, string> = {
    beginner: t("fitness.beginner"),
    intermediate: t("fitness.intermediate"),
    advanced: t("fitness.advanced"),
    elite: t("fitness.elite"),
  };

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
      garminWatch: garminWatch || undefined,
    });
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-settings-title">
          <Settings className="w-6 h-6 inline mr-2" />
          {t("settings.title")}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t("settings.subtitle")}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-accent flex items-center justify-center flex-shrink-0">
                <Globe className="w-5 h-5 text-accent-foreground" />
              </div>
              <div>
                <h2 className="font-semibold text-sm">{t("settings.language")}</h2>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Select value={language} onValueChange={(val) => setLanguage(val as Language)}>
            <SelectTrigger data-testid="select-language">
              <SelectValue placeholder={t("settings.languagePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {languages.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-accent flex items-center justify-center flex-shrink-0">
                <Watch className="w-5 h-5 text-accent-foreground" />
              </div>
              <div>
                <h2 className="font-semibold text-sm">{t("settings.garminConnect")}</h2>
                <p className="text-xs text-muted-foreground">{t("settings.garminSubtitle")}</p>
              </div>
            </div>
            {user?.garminConnected ? (
              <Badge variant="secondary">
                <div className="w-1.5 h-1.5 rounded-full bg-status-online mr-1.5" />
                {t("common.connected")}
              </Badge>
            ) : (
              <Badge variant="outline">
                <div className="w-1.5 h-1.5 rounded-full bg-status-offline mr-1.5" />
                {t("common.disconnected")}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {user?.garminConnected ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t("settings.account")}: <span className="font-medium text-foreground">{user.garminEmail}</span>
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
                {t("common.disconnect")}
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
                      <FormLabel>{t("settings.garminEmail")}</FormLabel>
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
                      <FormLabel>{t("settings.garminPassword")}</FormLabel>
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
                  {t("settings.connectGarmin")}
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
                <h2 className="font-semibold text-sm">{t("settings.intervalsTitle")}</h2>
                <p className="text-xs text-muted-foreground">{t("settings.intervalsSubtitle")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">
                <FlaskConical className="w-3 h-3 mr-1" />
                {t("common.experiment")}
              </Badge>
              {user?.intervalsConnected ? (
                <Badge variant="secondary">
                  <div className="w-1.5 h-1.5 rounded-full bg-status-online mr-1.5" />
                  {t("common.connected")}
                </Badge>
              ) : (
                <Badge variant="outline">
                  <div className="w-1.5 h-1.5 rounded-full bg-status-offline mr-1.5" />
                  {t("common.disconnected")}
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
                {t("common.disconnect")}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground space-y-2 bg-accent/50 rounded-md p-3">
                <p className="font-medium text-foreground">{t("settings.intervalsWhy")}</p>
                <p>{t("settings.intervalsDesc")}</p>
                <p className="font-medium text-foreground">{t("settings.intervalsHowTo")}</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>
                    {t("settings.intervalsStep1")}{" "}
                    <a href="https://intervals.icu" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-0.5">
                      intervals.icu <ExternalLink className="w-3 h-3" />
                    </a>
                  </li>
                  <li>{t("settings.intervalsStep2")}</li>
                  <li>{t("settings.intervalsStep3")}</li>
                  <li>{t("settings.intervalsStep4Copy")}</li>
                  <li>{t("settings.intervalsStep5")}</li>
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
                        <FormLabel>{t("settings.athleteId")}</FormLabel>
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
                        <FormLabel>{t("settings.apiKey")}</FormLabel>
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
                    {t("settings.connectIntervals")}
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
          <h2 className="font-semibold text-sm">{t("settings.profileTitle")}</h2>
          <p className="text-xs text-muted-foreground">{t("settings.profileSubtitle")}</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <label className="text-sm font-medium mb-2 block">{t("settings.sportTypes")}</label>
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
                  <span className="text-sm">{sportLabelMap[sport] || sport}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">{t("settings.watchModel")}</label>
            <Select value={garminWatch} onValueChange={setGarminWatch}>
              <SelectTrigger data-testid="select-garmin-watch">
                <SelectValue placeholder={t("settings.watchPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {garminWatchModels.map((model) => (
                  <SelectItem key={model} value={model}>
                    {garminWatchLabels[model]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {garminWatch && !swimStructuredWatchModels.includes(garminWatch as GarminWatchModel) && garminWatch !== "other" && selectedSports.includes("swimming") && (
              <p className="text-xs text-muted-foreground mt-2">
                {t("settings.watchSwimWarning", { model: garminWatchLabels[garminWatch as GarminWatchModel] })}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">{t("settings.fitnessLevel")}</label>
              <Select value={fitnessLevel} onValueChange={setFitnessLevel}>
                <SelectTrigger data-testid="select-fitness-level">
                  <SelectValue placeholder={t("settings.fitnessPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {fitnessLevels.map((level) => (
                    <SelectItem key={level} value={level}>
                      {fitnessLabelMap[level] || level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">{t("settings.age")}</label>
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
              <label className="text-sm font-medium mb-2 block">{t("settings.weeklyHours")}</label>
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
              <label className="text-sm font-medium mb-2 block">{t("settings.experienceYears")}</label>
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
            <label className="text-sm font-medium mb-2 block">{t("settings.goals")}</label>
            <Input
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              placeholder={t("settings.goalsPlaceholder")}
              data-testid="input-goals"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">{t("settings.personalRecords")}</label>
            <Textarea
              value={personalRecords}
              onChange={(e) => setPersonalRecords(e.target.value)}
              placeholder={t("settings.personalRecordsPlaceholder")}
              className="resize-none"
              rows={2}
              data-testid="input-personal-records"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">{t("settings.injuries")}</label>
            <Textarea
              value={injuries}
              onChange={(e) => setInjuries(e.target.value)}
              placeholder={t("settings.injuriesPlaceholder")}
              className="resize-none"
              rows={2}
              data-testid="input-injuries"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">{t("settings.preferences")}</label>
            <Textarea
              value={preferences}
              onChange={(e) => setPreferences(e.target.value)}
              placeholder={t("settings.preferencesPlaceholder")}
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
            {t("settings.saveProfile")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
