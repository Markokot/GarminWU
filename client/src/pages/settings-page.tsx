import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { garminConnectSchema, sportTypes, sportTypeLabels } from "@shared/schema";
import type { GarminConnectInput } from "@shared/schema";
import {
  Watch,
  Loader2,
  CheckCircle,
  XCircle,
  Settings,
  Unlink,
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

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { sportTypes: string[]; goals: string }) => {
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

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
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
                <CheckCircle className="w-3 h-3 mr-1" />
                Подключено
              </Badge>
            ) : (
              <Badge variant="outline">
                <XCircle className="w-3 h-3 mr-1" />
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

      <Separator />

      <Card>
        <CardHeader className="pb-4">
          <h2 className="font-semibold text-sm">Профиль тренировок</h2>
          <p className="text-xs text-muted-foreground">AI будет учитывать эти данные при создании тренировок</p>
        </CardHeader>
        <CardContent className="space-y-4">
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
          <div>
            <label className="text-sm font-medium mb-2 block">Цели</label>
            <Input
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              placeholder="Например: подготовка к Ironman, марафон за 3:30"
              data-testid="input-goals"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => updateProfileMutation.mutate({ sportTypes: selectedSports, goals })}
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
