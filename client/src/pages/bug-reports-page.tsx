import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Bug,
  CheckCircle,
  Eye,
  Trash2,
  Loader2,
} from "lucide-react";
import type { BugReport } from "@shared/schema";
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

export default function BugReportsPage() {
  const { data: bugReports, isLoading, error } = useQuery<BugReport[]>({
    queryKey: ["/api/admin/bug-reports"],
  });
  const [updatingId, setUpdatingId] = useState<string | null>(null);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
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

  const newCount = bugReports?.filter((r) => r.status === "new").length || 0;

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Bug className="w-5 h-5 text-destructive" />
        <h1 className="text-xl font-bold" data-testid="text-bug-reports-title">Сообщения об ошибках</h1>
        {newCount > 0 && (
          <Badge variant="destructive" className="text-xs">
            {newCount} новых
          </Badge>
        )}
      </div>

      {!bugReports || bugReports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bug className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Нет сообщений об ошибках</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {bugReports.map((report) => (
            <Card
              key={report.id}
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
          ))}
        </div>
      )}
    </div>
  );
}
