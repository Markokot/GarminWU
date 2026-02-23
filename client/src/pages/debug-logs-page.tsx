import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, RefreshCw, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DebugLogEntry {
  id: number;
  timestamp: string;
  category: string;
  message: string;
  data?: any;
}

export default function DebugLogsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.username === "Andrey";

  const { data: logs, isLoading, refetch } = useQuery<DebugLogEntry[]>({
    queryKey: ["/api/admin/debug-logs"],
    enabled: isAdmin,
    refetchInterval: 5000,
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/admin/debug-logs");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/debug-logs"] });
      toast({ title: "Логи очищены" });
    },
  });

  if (!isAdmin) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Доступ запрещён</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" data-testid="text-debug-logs-title">Отладочные логи</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            data-testid="button-refresh-debug-logs"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Обновить
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => clearMutation.mutate()}
            disabled={clearMutation.isPending || !logs?.length}
            data-testid="button-clear-debug-logs"
          >
            {clearMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 mr-1" />
            )}
            Очистить все
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : !logs?.length ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Логов пока нет
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Всего записей: {logs.length}</p>
          {logs.map((entry) => (
            <Card key={entry.id} className="overflow-hidden" data-testid={`debug-log-entry-${entry.id}`}>
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className="shrink-0 text-xs font-mono">
                    {entry.category}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted-foreground font-mono mb-1">
                      {new Date(entry.timestamp).toLocaleString("ru-RU")}
                    </div>
                    <div className="text-sm break-all">{entry.message}</div>
                    {entry.data && (
                      <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-x-auto max-h-40 font-mono">
                        {typeof entry.data === "string" ? entry.data : JSON.stringify(entry.data, null, 2)}
                      </pre>
                    )}
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
