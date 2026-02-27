import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Sparkles, Bug } from "lucide-react";

const CURRENT_VERSION = "1.010";

interface ChangelogEntry {
  version: string;
  date: string;
  changes: {
    type: "feature" | "fix";
    text: string;
  }[];
}

const changelog: ChangelogEntry[] = [
  {
    version: "1.010",
    date: "27.02.2026",
    changes: [
      { type: "feature", text: "Кэширование активностей в базе данных с 4-часовым интервалом обновления" },
      { type: "feature", text: "Прогрессивная синхронизация данных для минимизации обращений к Garmin API" },
      { type: "feature", text: "Статистика на дашборде строго за последние 30 дней" },
      { type: "feature", text: "Отображение времени последней синхронизации данных" },
      { type: "feature", text: "Предупреждение о частоте обновлений для защиты аккаунта Garmin" },
      { type: "fix", text: "Исправлена ошибка переполнения при сохранении ID активностей Garmin" },
      { type: "fix", text: "Исправлено отображение пустого дашборда при ошибках загрузки данных" },
      { type: "fix", text: "Корректная работа cooldown после перезапуска сервера" },
    ],
  },
  {
    version: "1.000",
    date: "25.02.2026",
    changes: [
      { type: "feature", text: "AI-тренер с генерацией персональных тренировок по бегу, велоспорту и плаванию" },
      { type: "feature", text: "Создание многонедельных тренировочных планов" },
      { type: "feature", text: "Стриминг ответов AI в реальном времени" },
      { type: "feature", text: "Подключение и интеграция с Garmin Connect" },
      { type: "feature", text: "Отправка структурированных тренировок на часы Garmin" },
      { type: "feature", text: "Планирование и перенос тренировок на конкретные даты" },
      { type: "feature", text: "Подключение и интеграция с Intervals.icu" },
      { type: "feature", text: "Учёт погоды и геолокации при составлении тренировок" },
      { type: "feature", text: "Адаптация тренировок под модель часов Garmin" },
      { type: "feature", text: "Дашборд с онбордингом, предстоящими тренировками и статистикой" },
      { type: "feature", text: "Избранные тренировки" },
      { type: "feature", text: "Профиль пользователя с настройками спорта и целей" },
      { type: "feature", text: "Тёмная и светлая темы оформления" },
      { type: "feature", text: "Страница FAQ и отправка баг-репортов" },
    ],
  },
];

export default function VersionPage() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold" data-testid="text-version-title">История обновлений</h1>
        <Badge variant="secondary" className="text-base px-3 py-1" data-testid="text-version-number">
          v{CURRENT_VERSION}
        </Badge>
      </div>

      <div className="space-y-6">
        {changelog.map((entry, idx) => (
          <Card key={entry.version} data-testid={`card-version-${entry.version}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  Версия {entry.version}
                  {idx === 0 && (
                    <Badge variant="default" className="text-xs">Текущая</Badge>
                  )}
                </CardTitle>
                <span className="text-sm text-muted-foreground">{entry.date}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {entry.changes.map((change, i) => (
                <div key={i} className="flex items-start gap-2" data-testid={`text-change-${entry.version}-${i}`}>
                  {change.type === "feature" ? (
                    <Sparkles className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                  ) : (
                    <Bug className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                  )}
                  <span className="text-sm">{change.text}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
