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
import { sportTypes } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Watch, Activity, Zap } from "lucide-react";
import { useTranslation } from "@/i18n/context";
import { LanguageSwitcher } from "@/components/language-switcher";

export default function AuthPage() {
  const [tab, setTab] = useState<"login" | "register">("login");
  const { login } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regSportTypes, setRegSportTypes] = useState<string[]>(["running"]);
  const [regGoals, setRegGoals] = useState("");

  const [loginErrors, setLoginErrors] = useState<Record<string, string>>({});
  const [regErrors, setRegErrors] = useState<Record<string, string>>({});

  const VALIDATION_SENTINEL = "__validation_error__";

  const loginMutation = useMutation({
    mutationFn: async () => {
      const errors: Record<string, string> = {};
      if (loginUsername.length < 2) errors.username = t("common.min2chars");
      if (loginPassword.length < 4) errors.password = t("common.min4chars");
      if (Object.keys(errors).length > 0) {
        setLoginErrors(errors);
        throw new Error(VALIDATION_SENTINEL);
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
    },
    onError: (error: Error) => {
      if (error.message !== VALIDATION_SENTINEL) {
        toast({ title: t("auth.loginError"), description: error.message, variant: "destructive" });
      }
    },
  });

  const registerMutation = useMutation({
    mutationFn: async () => {
      const errors: Record<string, string> = {};
      if (regUsername.length < 2) errors.username = t("common.min2chars");
      if (regPassword.length < 4) errors.password = t("common.min4chars");
      if (regSportTypes.length === 0) errors.sportTypes = t("common.selectAtLeastOneSport");
      if (Object.keys(errors).length > 0) {
        setRegErrors(errors);
        throw new Error(VALIDATION_SENTINEL);
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
    },
    onError: (error: Error) => {
      if (error.message !== VALIDATION_SENTINEL) {
        toast({ title: t("auth.registerError"), description: error.message, variant: "destructive" });
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

  const sportTranslationKey: Record<string, string> = {
    running: "sport.running",
    cycling: "sport.cycling",
    swimming: "sport.swimming",
    trail_running: "sport.trail_running",
    strength_training: "sport.strength_training",
    walking: "sport.walking",
    hiking: "sport.hiking",
    yoga: "sport.yoga",
    other: "sport.other",
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-5xl flex flex-col lg:flex-row gap-8 items-center">
        <div className="flex-1 space-y-6 text-center lg:text-left">
          <div className="flex items-center gap-3 justify-center lg:justify-start">
            <div className="w-12 h-12 rounded-md bg-primary flex items-center justify-center">
              <Watch className="w-7 h-7 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight" data-testid="text-app-title">GarminCoach AI</h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-md mx-auto lg:mx-0">
            {t("auth.appSubtitle")}
          </p>
          <div className="space-y-4 max-w-sm mx-auto lg:mx-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-accent flex items-center justify-center flex-shrink-0">
                <Activity className="w-4 h-4 text-accent-foreground" />
              </div>
              <span className="text-sm text-muted-foreground">{t("auth.feature1")}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-accent flex items-center justify-center flex-shrink-0">
                <Watch className="w-4 h-4 text-accent-foreground" />
              </div>
              <span className="text-sm text-muted-foreground">{t("auth.feature2")}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-accent flex items-center justify-center flex-shrink-0">
                <Zap className="w-4 h-4 text-accent-foreground" />
              </div>
              <span className="text-sm text-muted-foreground">{t("auth.feature3")}</span>
            </div>
          </div>
        </div>

        <Card className="w-full max-w-md">
          <CardHeader className="pb-4">
            <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "register")}>
              <TabsList className="w-full">
                <TabsTrigger value="login" className="flex-1" data-testid="tab-login">{t("auth.login")}</TabsTrigger>
                <TabsTrigger value="register" className="flex-1" data-testid="tab-register">{t("auth.register")}</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {tab === "login" ? (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-username">{t("auth.username")}</Label>
                  <Input
                    id="login-username"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    data-testid="input-login-username"
                  />
                  {loginErrors.username && <p className="text-sm text-destructive">{loginErrors.username}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">{t("auth.password")}</Label>
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
                  {loginMutation.isPending ? t("auth.loggingIn") : t("auth.loginButton")}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-username">{t("auth.username")}</Label>
                  <Input
                    id="reg-username"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    data-testid="input-register-username"
                  />
                  {regErrors.username && <p className="text-sm text-destructive">{regErrors.username}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password">{t("auth.password")}</Label>
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
                  <Label>{t("auth.sportTypes")}</Label>
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
                          {t(sportTranslationKey[sport] || `sport.${sport}`)}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {regErrors.sportTypes && <p className="text-sm text-destructive">{regErrors.sportTypes}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-goals">{t("auth.goals")}</Label>
                  <Input
                    id="reg-goals"
                    placeholder={t("auth.goalsPlaceholder")}
                    value={regGoals}
                    onChange={(e) => setRegGoals(e.target.value)}
                    data-testid="input-register-goals"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={registerMutation.isPending} data-testid="button-register">
                  {registerMutation.isPending ? t("auth.registering") : t("auth.registerButton")}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
