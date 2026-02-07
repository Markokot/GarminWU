import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { sportTypes, sportTypeLabels } from "@shared/schema";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { Watch, Activity, Zap } from "lucide-react";

export default function AuthPage() {
  const [tab, setTab] = useState<"login" | "register">("login");
  const { login } = useAuth();
  const { toast } = useToast();

  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regSportTypes, setRegSportTypes] = useState<string[]>(["running"]);
  const [regGoals, setRegGoals] = useState("");

  const [loginErrors, setLoginErrors] = useState<Record<string, string>>({});
  const [regErrors, setRegErrors] = useState<Record<string, string>>({});

  const loginMutation = useMutation({
    mutationFn: async () => {
      const errors: Record<string, string> = {};
      if (loginUsername.length < 2) errors.username = "Минимум 2 символа";
      if (loginPassword.length < 4) errors.password = "Минимум 4 символа";
      if (Object.keys(errors).length > 0) {
        setLoginErrors(errors);
        throw new Error("Заполните все поля");
      }
      setLoginErrors({});
      const res = await apiRequest("POST", "/api/auth/login", {
        username: loginUsername,
        password: loginPassword,
      });
      return res.json();
    },
    onSuccess: (data) => {
      login(data);
      queryClient.prefetchQuery({ queryKey: ["/api/workouts"], queryFn: getQueryFn({ on401: "throw" }) });
    },
    onError: (error: Error) => {
      if (error.message !== "Заполните все поля") {
        toast({ title: "Ошибка входа", description: error.message, variant: "destructive" });
      }
    },
  });

  const registerMutation = useMutation({
    mutationFn: async () => {
      const errors: Record<string, string> = {};
      if (regUsername.length < 2) errors.username = "Минимум 2 символа";
      if (regPassword.length < 4) errors.password = "Минимум 4 символа";
      if (regSportTypes.length === 0) errors.sportTypes = "Выберите хотя бы один вид спорта";
      if (Object.keys(errors).length > 0) {
        setRegErrors(errors);
        throw new Error("Заполните все поля");
      }
      setRegErrors({});
      const res = await apiRequest("POST", "/api/auth/register", {
        username: regUsername,
        password: regPassword,
        sportTypes: regSportTypes,
        goals: regGoals,
      });
      return res.json();
    },
    onSuccess: (data) => {
      login(data);
      queryClient.prefetchQuery({ queryKey: ["/api/workouts"], queryFn: getQueryFn({ on401: "throw" }) });
    },
    onError: (error: Error) => {
      if (error.message !== "Заполните все поля") {
        toast({ title: "Ошибка регистрации", description: error.message, variant: "destructive" });
      }
    },
  });

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate();
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    registerMutation.mutate();
  };

  const toggleSport = (sport: string) => {
    setRegSportTypes((prev) =>
      prev.includes(sport)
        ? prev.filter((s) => s !== sport)
        : [...prev, sport]
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-5xl flex flex-col lg:flex-row gap-8 items-center">
        <div className="flex-1 space-y-6 text-center lg:text-left">
          <div className="flex items-center gap-3 justify-center lg:justify-start">
            <div className="w-12 h-12 rounded-md bg-primary flex items-center justify-center">
              <Watch className="w-7 h-7 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight" data-testid="text-app-title">GarminCoach AI</h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-md mx-auto lg:mx-0">
            Персональный AI-тренер с интеграцией Garmin. Умные тренировки прямо на ваших часах.
          </p>
          <div className="space-y-4 max-w-sm mx-auto lg:mx-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-accent flex items-center justify-center flex-shrink-0">
                <Activity className="w-4 h-4 text-accent-foreground" />
              </div>
              <span className="text-sm text-muted-foreground">AI анализирует ваши тренировки и предлагает план</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-accent flex items-center justify-center flex-shrink-0">
                <Watch className="w-4 h-4 text-accent-foreground" />
              </div>
              <span className="text-sm text-muted-foreground">Тренировки загружаются прямо на часы Garmin</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-accent flex items-center justify-center flex-shrink-0">
                <Zap className="w-4 h-4 text-accent-foreground" />
              </div>
              <span className="text-sm text-muted-foreground">Бег, велосипед, плавание — включая подготовку к Ironman</span>
            </div>
          </div>
        </div>

        <Card className="w-full max-w-md">
          <CardHeader className="pb-4">
            <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "register")}>
              <TabsList className="w-full">
                <TabsTrigger value="login" className="flex-1" data-testid="tab-login">Вход</TabsTrigger>
                <TabsTrigger value="register" className="flex-1" data-testid="tab-register">Регистрация</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {tab === "login" ? (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-username">Имя пользователя</Label>
                  <Input
                    id="login-username"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    data-testid="input-login-username"
                  />
                  {loginErrors.username && <p className="text-sm text-destructive">{loginErrors.username}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Пароль</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    data-testid="input-login-password"
                  />
                  {loginErrors.password && <p className="text-sm text-destructive">{loginErrors.password}</p>}
                </div>
                <Button type="submit" className="w-full" disabled={loginMutation.isPending} data-testid="button-login">
                  {loginMutation.isPending ? "Вход..." : "Войти"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-username">Имя пользователя</Label>
                  <Input
                    id="reg-username"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    data-testid="input-register-username"
                  />
                  {regErrors.username && <p className="text-sm text-destructive">{regErrors.username}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password">Пароль</Label>
                  <Input
                    id="reg-password"
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    data-testid="input-register-password"
                  />
                  {regErrors.password && <p className="text-sm text-destructive">{regErrors.password}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Виды спорта</Label>
                  <div className="flex flex-wrap gap-4">
                    {sportTypes.map((sport) => (
                      <div key={sport} className="flex items-center gap-2">
                        <Checkbox
                          id={`sport-${sport}`}
                          checked={regSportTypes.includes(sport)}
                          onCheckedChange={() => toggleSport(sport)}
                          data-testid={`checkbox-sport-${sport}`}
                        />
                        <Label htmlFor={`sport-${sport}`} className="text-sm font-normal cursor-pointer">
                          {sportTypeLabels[sport]}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {regErrors.sportTypes && <p className="text-sm text-destructive">{regErrors.sportTypes}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-goals">Цели (необязательно)</Label>
                  <Input
                    id="reg-goals"
                    placeholder="Например: пробежать марафон за 3:30"
                    value={regGoals}
                    onChange={(e) => setRegGoals(e.target.value)}
                    data-testid="input-register-goals"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={registerMutation.isPending} data-testid="button-register">
                  {registerMutation.isPending ? "Регистрация..." : "Зарегистрироваться"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
