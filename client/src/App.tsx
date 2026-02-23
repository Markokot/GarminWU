import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/lib/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthProvider, useAuth } from "@/lib/auth";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import DashboardPage from "@/pages/dashboard-page";
import CoachPage from "@/pages/coach-page";
import FavoritesPage from "@/pages/favorites-page";
import SettingsPage from "@/pages/settings-page";
import FaqPage from "@/pages/faq-page";
import AdminPage from "@/pages/admin-page";
import TestWorkoutsPage from "@/pages/test-workouts-page";
import AutoTestsPage from "@/pages/auto-tests-page";
import BugReportsPage from "@/pages/bug-reports-page";
import AiLogsPage from "@/pages/ai-logs-page";
import PromptVariantsPage from "@/pages/prompt-variants-page";
import DebugLogsPage from "@/pages/debug-logs-page";
import VersionPage from "@/pages/version-page";
import { Loader2 } from "lucide-react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/coach" component={CoachPage} />
      <Route path="/favorites" component={FavoritesPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/faq" component={FaqPage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/test-workouts" component={TestWorkoutsPage} />
      <Route path="/auto-tests" component={AutoTestsPage} />
      <Route path="/bug-reports" component={BugReportsPage} />
      <Route path="/ai-logs" component={AiLogsPage} />
      <Route path="/prompt-variants" component={PromptVariantsPage} />
      <Route path="/debug-logs" component={DebugLogsPage} />
      <Route path="/version" component={VersionPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedLayout() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-dvh w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <header className="flex items-center justify-between gap-2 p-2 border-b sticky top-0 z-50 bg-background">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-y-auto overflow-x-hidden">
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return <AuthenticatedLayout />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
