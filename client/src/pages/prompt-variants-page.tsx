import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { AiPromptVariant } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  FlaskConical,
  Plus,
  Pencil,
  Trash2,
  BarChart3,
  Loader2,
  TrendingUp,
} from "lucide-react";

interface VariantMetrics {
  variantId: string;
  variantName: string;
  totalRequests: number;
  avgRating: number;
  ratedCount: number;
  workoutRate: number;
  planRate: number;
  avgResponseTime: number;
}

interface VariantForm {
  name: string;
  instructions: string;
  weight: number;
  isActive: boolean;
}

const emptyForm: VariantForm = {
  name: "",
  instructions: "",
  weight: 1,
  isActive: true,
};

export default function PromptVariantsPage() {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState<VariantForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const {
    data: variants,
    isLoading: variantsLoading,
    error: variantsError,
  } = useQuery<AiPromptVariant[]>({
    queryKey: ["/api/admin/prompt-variants"],
  });

  const {
    data: metrics,
    isLoading: metricsLoading,
  } = useQuery<VariantMetrics[]>({
    queryKey: ["/api/admin/prompt-variants/metrics"],
  });

  const handleCreate = async () => {
    setSubmitting(true);
    try {
      await apiRequest("POST", "/api/admin/prompt-variants", formData);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/prompt-variants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/prompt-variants/metrics"] });
      setCreateOpen(false);
      setFormData(emptyForm);
      toast({ title: "Вариант создан" });
    } catch (error: any) {
      let msg = "Неизвестная ошибка";
      try {
        const parsed = JSON.parse(error?.message?.replace(/^\d+:\s*/, "") || "{}");
        msg = parsed.message || error?.message || msg;
      } catch {
        msg = error?.message || msg;
      }
      toast({ title: "Ошибка при создании", description: msg, variant: "destructive" });
    }
    setSubmitting(false);
  };

  const handleEdit = async () => {
    if (!editId) return;
    setSubmitting(true);
    try {
      await apiRequest("PATCH", `/api/admin/prompt-variants/${editId}`, formData);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/prompt-variants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/prompt-variants/metrics"] });
      setEditId(null);
      setFormData(emptyForm);
      toast({ title: "Вариант обновлён" });
    } catch {
      toast({ title: "Ошибка при обновлении", variant: "destructive" });
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await apiRequest("DELETE", `/api/admin/prompt-variants/${id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/prompt-variants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/prompt-variants/metrics"] });
      toast({ title: "Вариант удалён" });
    } catch {
      toast({ title: "Ошибка при удалении", variant: "destructive" });
    }
    setDeletingId(null);
    setConfirmDeleteId(null);
  };

  const handleToggleActive = async (variant: AiPromptVariant) => {
    try {
      await apiRequest("PATCH", `/api/admin/prompt-variants/${variant.id}`, {
        isActive: !variant.isActive,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/prompt-variants"] });
    } catch {
      toast({ title: "Ошибка", variant: "destructive" });
    }
  };

  const openEditDialog = (variant: AiPromptVariant) => {
    setFormData({
      name: variant.name,
      instructions: variant.instructions,
      weight: variant.weight,
      isActive: variant.isActive,
    });
    setEditId(variant.id);
  };

  if (variantsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (variantsError) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Доступ запрещён</p>
      </div>
    );
  }

  const variantFormContent = (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-1.5 block">Название</label>
        <Input
          data-testid="input-variant-name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Название варианта"
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">Инструкции</label>
        <Textarea
          data-testid="input-variant-instructions"
          value={formData.instructions}
          onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
          placeholder="Системные инструкции для AI"
          rows={6}
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">Вес (weight)</label>
        <Input
          data-testid="input-variant-weight"
          type="number"
          min={0}
          step={1}
          value={formData.weight}
          onChange={(e) => setFormData({ ...formData, weight: Number(e.target.value) })}
        />
      </div>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Активен</label>
        <Switch
          data-testid="switch-variant-active"
          checked={formData.isActive}
          onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
        />
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <FlaskConical className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold" data-testid="text-prompt-variants-title">
            A/B тест промптов
          </h1>
        </div>

        <Dialog open={createOpen} onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setFormData(emptyForm);
        }}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-variant">
              <Plus className="w-4 h-4 mr-2" />
              Добавить вариант
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Новый вариант промпта</DialogTitle>
            </DialogHeader>
            {variantFormContent}
            <Button
              data-testid="button-submit-create"
              onClick={handleCreate}
              disabled={submitting || !formData.name.trim()}
              className="w-full"
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Создать
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={editId !== null} onOpenChange={(open) => {
        if (!open) {
          setEditId(null);
          setFormData(emptyForm);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать вариант</DialogTitle>
          </DialogHeader>
          {variantFormContent}
          <Button
            data-testid="button-submit-edit"
            onClick={handleEdit}
            disabled={submitting || !formData.name.trim()}
            className="w-full"
          >
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Сохранить
          </Button>
        </DialogContent>
      </Dialog>

      {!variants || variants.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FlaskConical className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Нет вариантов промптов</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {variants.map((variant) => (
            <Card key={variant.id} data-testid={`card-variant-${variant.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="font-medium text-sm" data-testid={`text-variant-name-${variant.id}`}>
                        {variant.name}
                      </span>
                      <Badge
                        variant={variant.isActive ? "default" : "secondary"}
                        className="text-xs"
                        data-testid={`badge-variant-status-${variant.id}`}
                      >
                        {variant.isActive ? "Активен" : "Неактивен"}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        Вес: {variant.weight}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2" data-testid={`text-variant-instructions-${variant.id}`}>
                      {variant.instructions || (variant.id === "base" ? "Стандартный промпт без дополнительных инструкций" : "")}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Switch
                      data-testid={`switch-toggle-active-${variant.id}`}
                      checked={variant.isActive}
                      onCheckedChange={() => handleToggleActive(variant)}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openEditDialog(variant)}
                      title="Редактировать"
                      data-testid={`button-edit-variant-${variant.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    {variant.id !== "base" && (
                      confirmDeleteId === variant.id ? (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={deletingId === variant.id}
                            onClick={() => handleDelete(variant.id)}
                            data-testid={`button-confirm-delete-${variant.id}`}
                          >
                            {deletingId === variant.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              "Да"
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setConfirmDeleteId(null)}
                            data-testid={`button-cancel-delete-${variant.id}`}
                          >
                            Нет
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => setConfirmDeleteId(variant.id)}
                          title="Удалить"
                          data-testid={`button-delete-variant-${variant.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="pt-4">
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold" data-testid="text-metrics-title">Метрики вариантов</h2>
        </div>

        {metricsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !metrics || metrics.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <TrendingUp className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Нет данных для отображения</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto relative">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="p-3 font-medium sticky left-0 bg-card z-10">Вариант</th>
                      <th className="p-3 font-medium text-right">Запросов</th>
                      <th className="p-3 font-medium text-right">Ср. оценка</th>
                      <th className="p-3 font-medium text-right whitespace-nowrap">Тренировки %</th>
                      <th className="p-3 font-medium text-right whitespace-nowrap">Планы %</th>
                      <th className="p-3 font-medium text-right whitespace-nowrap">Время (мс)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.map((m) => (
                      <tr key={m.variantId} className="border-b last:border-0" data-testid={`row-metric-${m.variantId}`}>
                        <td className="p-3 sticky left-0 bg-card z-10">
                          <span className="font-medium" data-testid={`text-metric-name-${m.variantId}`}>{m.variantName}</span>
                        </td>
                        <td className="p-3 text-right tabular-nums" data-testid={`text-metric-requests-${m.variantId}`}>
                          {m.totalRequests}
                        </td>
                        <td className="p-3 text-right tabular-nums" data-testid={`text-metric-rating-${m.variantId}`}>
                          {m.avgRating > 0 ? m.avgRating.toFixed(1) : "—"}
                          {m.ratedCount > 0 && (
                            <span className="text-xs text-muted-foreground ml-1">({m.ratedCount})</span>
                          )}
                        </td>
                        <td className="p-3 text-right tabular-nums" data-testid={`text-metric-workout-rate-${m.variantId}`}>
                          {m.workoutRate}%
                        </td>
                        <td className="p-3 text-right tabular-nums" data-testid={`text-metric-plan-rate-${m.variantId}`}>
                          {m.planRate}%
                        </td>
                        <td className="p-3 text-right tabular-nums" data-testid={`text-metric-response-time-${m.variantId}`}>
                          {Math.round(m.avgResponseTime)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
