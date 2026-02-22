import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { BugReportDialog } from "@/components/bug-report-dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  MessageSquare,
  Star,
  Settings,
  LogOut,
  Watch,
  HelpCircle,
  FlaskConical,
  BarChart3,
  Bug,
  Brain,
  ScrollText,
} from "lucide-react";
import type { BugReport, ErrorLog } from "@shared/schema";

const menuItems = [
  { title: "Дашборд", url: "/", icon: LayoutDashboard },
  { title: "AI Тренер", url: "/coach", icon: MessageSquare },
  { title: "Избранное", url: "/favorites", icon: Star },
  { title: "Настройки", url: "/settings", icon: Settings },
  { title: "FAQ", url: "/faq", icon: HelpCircle },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { setOpenMobile, isMobile } = useSidebar();

  const isAdmin = user?.username === "Andrey";
  const { data: bugReports } = useQuery<BugReport[]>({
    queryKey: ["/api/admin/bug-reports"],
    enabled: isAdmin,
    refetchInterval: 30000,
  });
  const { data: errorLogs } = useQuery<ErrorLog[]>({
    queryKey: ["/api/admin/error-logs"],
    enabled: isAdmin,
    refetchInterval: 30000,
  });
  const newBugCount = (bugReports?.filter((r) => r.status === "new").length || 0) + (errorLogs?.filter((e) => e.status === "new").length || 0);

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
            <Watch className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-sm truncate">GarminCoach AI</span>
            <span className="text-xs text-muted-foreground truncate">AI-тренер</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Навигация</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      data-testid={`nav-${item.url.replace("/", "") || "dashboard"}`}
                    >
                      <Link href={item.url} onClick={handleNavClick}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              {isAdmin && (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/admin"}
                      data-testid="nav-admin"
                    >
                      <Link href="/admin" onClick={handleNavClick}>
                        <BarChart3 className="w-4 h-4" />
                        <span>Статистика</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/bug-reports"}
                      data-testid="nav-bug-reports"
                    >
                      <Link href="/bug-reports" onClick={handleNavClick} className="relative">
                        <Bug className="w-4 h-4" />
                        <span>Ошибки</span>
                        {newBugCount > 0 && (
                          <span className="ml-auto flex items-center gap-1.5" data-testid="status-bug-report-count">
                            <span className="relative flex h-2.5 w-2.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive" />
                            </span>
                            <Badge variant="destructive" className="text-[10px] leading-none">
                              {newBugCount}
                            </Badge>
                          </span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/ai-logs"}
                      data-testid="nav-ai-logs"
                    >
                      <Link href="/ai-logs" onClick={handleNavClick}>
                        <ScrollText className="w-4 h-4" />
                        <span>Логи AI</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/prompt-variants"}
                      data-testid="nav-prompt-variants"
                    >
                      <Link href="/prompt-variants" onClick={handleNavClick}>
                        <Brain className="w-4 h-4" />
                        <span>A/B промпты</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/test-workouts"}
                      data-testid="nav-test-workouts"
                    >
                      <Link href="/test-workouts" onClick={handleNavClick}>
                        <FlaskConical className="w-4 h-4" />
                        <span>Push-тесты</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/auto-tests"}
                      data-testid="nav-auto-tests"
                    >
                      <Link href="/auto-tests" onClick={handleNavClick}>
                        <FlaskConical className="w-4 h-4" />
                        <span>Автотесты</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {user && (
          <SidebarGroup>
            <SidebarGroupLabel>Garmin</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="px-3 py-2">
                {user.garminConnected ? (
                  <Badge variant="secondary" className="text-xs" data-testid="status-garmin-connected">
                    <div className="w-1.5 h-1.5 rounded-full bg-status-online mr-1.5" />
                    Подключено
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs" data-testid="status-garmin-disconnected">
                    <div className="w-1.5 h-1.5 rounded-full bg-status-offline mr-1.5" />
                    Не подключено
                  </Badge>
                )}
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {user && (
          <SidebarGroup>
            <SidebarGroupLabel>Intervals.icu</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="px-3 py-2">
                {user.intervalsConnected ? (
                  <Badge variant="secondary" className="text-xs" data-testid="status-intervals-connected">
                    <div className="w-1.5 h-1.5 rounded-full bg-status-online mr-1.5" />
                    Подключено
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs" data-testid="status-intervals-disconnected">
                    <div className="w-1.5 h-1.5 rounded-full bg-status-offline mr-1.5" />
                    Не подключено
                  </Badge>
                )}
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="p-3 space-y-2">
        {user && <BugReportDialog />}
        {user && (
          <div className="flex items-center gap-3">
            <Avatar className="w-8 h-8 flex-shrink-0">
              <AvatarFallback className="text-xs">
                {user.username.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium truncate flex-1">{user.username}</span>
            <Button size="icon" variant="ghost" onClick={logout} data-testid="button-logout">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
