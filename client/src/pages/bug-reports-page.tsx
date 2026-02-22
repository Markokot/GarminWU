import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Bug,
  CheckCircle,
  Eye,
  Trash2,
  Loader2,
  Zap,
  Filter,
} from "lucide-react";
import type { BugReport, ErrorLog } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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

type UnifiedItem =
  | { type: "bug"; data: BugReport }
  | { type: "error-log"; data: ErrorLog };

export default function BugReportsPage() {
  const { data: bugReports, isLoading: bugsLoading, error: bugsError } = useQuery<BugReport[]>({
    queryKey: ["/api/admin/bug-reports"],
  });
  const { data: errorLogs, isLoading: errorLogsLoading, error: errorLogsError } = useQuery<ErrorLog[]>({
    queryKey: ["/api/admin/error-logs"],
  });
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "bugs" | "errors">("all");
  const { toast } = useToast();

  const updateStatus = async (id: string, status: "read" | "resolved") => {
    setUpdatingId(id);
    try {
      await apiRequest("PATCH", `/api/admin/bug-reports/${id}`, { status });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bug-reports"] });
    } catch {
      toast({ title: "Ошибка", variant: "destructive" });
    }
    setUpdatingId(null);
  };

  const deleteReport = async (id: string) => {
    setUpdatingId(id);
    try {
      await apiRequest("DELETE", `/api/admin/bug-reports/${id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/bug-reports"] });
      toast({ title: "Удалено" });
    } catch {
      toast({ title: "Ошибка при удалении", variant: "destructive" });
    }
    setUpdatingId(null);
  };

  const isLoading = bugsLoading || errorLogsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (bugsError || errorLogsError) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Доступ запрещён</p>
      </div>
    );
  }

  const newBugCount = bugReports?.filter((r) => r.status === "new").length || 0;
  const newErrorCount = errorLogs?.filter((e) => e.status === "new").length || 0;
  const totalNewCount = newBugCount + newErrorCount;

  const unified: UnifiedItem[] = [];
  if (filter !== "errors" && bugReports) {
    bugReports.forEach((b) => unified.push({ type: "bug", data: b }));
  }
  if (filter !== "bugs" && errorLogs) {
    errorLogs.forEach((e) => unified.push({ type: "error-log", data: e }));
  }
  unified.sort((a, b) => {
    const ta = new Date(a.data.timestamp).getTime();
    const tb = new Date(b.data.timestamp).getTime();
    return tb - ta;
  });

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Bug className="w-5 h-5 text-destructive" />
        <h1 className="text-xl font-bold" data-testid="text-bug-reports-title">Ошибки</h1>
        {totalNewCount > 0 && (
          <Badge variant="destructive" className="text-xs">
            {totalNewCount} новых
          </Badge>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button
          size="sm"
          variant={filter === "all" ? "default" : "outline"}
          onClick={() => setFilter("all")}
          data-testid="button-filter-all"
        >
          <Filter className="w-3.5 h-3.5 mr-1.5" />
          Все ({(bugReports?.length || 0) + (errorLogs?.length || 0)})
        </Button>
        <Button
          size="sm"
          variant={filter === "bugs" ? "default" : "outline"}
          onClick={() => setFilter("bugs")}
          data-testid="button-filter-bugs"
        >
          <Bug className="w-3.5 h-3.5 mr-1.5" />
          Баг-репорты ({bugReports?.length || 0})
        </Button>
        <Button
          size="sm"
          variant={filter === "errors" ? "default" : "outline"}
          onClick={() => setFilter("errors")}
          data-testid="button-filter-errors"
        >
          <Zap className="w-3.5 h-3.5 mr-1.5" />
          Ошибки ({errorLogs?.length || 0})
        </Button>
      </div>

      {unified.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bug className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Нет ошибок</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {unified.map((item) => {
            if (item.type === "bug") {
              const report = item.data;
              return (
                <Card
                  key={`bug-${report.id}`}
                  className={`${
                    report.status === "new"
                      ? "border-destructive/30"
                      : report.status === "read"
                        ? "border-yellow-500/30"
                        : "border-green-500/30 opacity-60"
                  }`}
                  data-testid={`bug-report-${report.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Badge variant="outline" className="text-xs gap-1">
                            <Bug className="w-3 h-3" />
                            Баг
                          </Badge>
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
                            disabled={updatingId === report.id}
                            onClick={() => updateStatus(report.id, "read")}
                            title="Отметить прочитанным"
                            data-testid={`button-mark-read-${report.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        )}
                        {report.status !== "resolved" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            disabled={updatingId === report.id}
                            onClick={() => updateStatus(report.id, "resolved")}
                            title="Отметить решённым"
                            data-testid={`button-mark-resolved-${report.id}`}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          disabled={updatingId === report.id}
                          onClick={() => deleteReport(report.id)}
                          title="Удалить"
                          data-testid={`button-delete-${report.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            }

            const errLog = item.data;
            const sourceLabels: Record<string, string> = { ai: "AI", garmin: "Garmin", intervals: "Intervals.icu" };
            const sourceLabel = sourceLabels[errLog.source] || errLog.source;
            return (
              <Card
                key={`err-${errLog.id}`}
                className={errLog.status === "new" ? "border-orange-500/30" : "border-green-500/30 opacity-60"}
                data-testid={`error-log-${errLog.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge variant="outline" className="text-xs gap-1 border-orange-500/50 text-orange-600 dark:text-orange-400">
                          <Zap className="w-3 h-3" />
                          {sourceLabel}
                        </Badge>
                        <span className="font-medium text-sm">{errLog.username}</span>
                        <span className="text-xs text-muted-foreground">{formatDateShort(errLog.timestamp)}</span>
                        <Badge
                          variant={errLog.status === "new" ? "destructive" : "outline"}
                          className="text-xs"
                        >
                          {errLog.status === "new" ? "Новое" : "Решено"}
                        </Badge>
                      </div>
                      <p className="text-sm text-destructive font-medium mb-1">{errLog.errorMessage}</p>
                      {errLog.context && (
                        <p className="text-xs text-muted-foreground">{errLog.context}</p>
                      )}
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {errLog.status === "new" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={updatingId === errLog.id}
                          onClick={async () => {
                            setUpdatingId(errLog.id);
                            try {
                              await apiRequest("PATCH", `/api/admin/error-logs/${errLog.id}`, { status: "resolved" });
                              queryClient.invalidateQueries({ queryKey: ["/api/admin/error-logs"] });
                            } catch {
                              toast({ title: "Ошибка", variant: "destructive" });
                            }
                            setUpdatingId(null);
                          }}
                          title="Отметить решённым"
                          data-testid={`button-resolve-error-${errLog.id}`}
                        >
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={updatingId === errLog.id}
                        onClick={async () => {
                          setUpdatingId(errLog.id);
                          try {
                            await apiRequest("DELETE", `/api/admin/error-logs/${errLog.id}`);
                            queryClient.invalidateQueries({ queryKey: ["/api/admin/error-logs"] });
                            toast({ title: "Удалено" });
                          } catch {
                            toast({ title: "Ошибка при удалении", variant: "destructive" });
                          }
                          setUpdatingId(null);
                        }}
                        title="Удалить"
                        data-testid={`button-delete-error-${errLog.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
