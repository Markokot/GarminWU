import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";

const CURRENT_VERSION = "1.010";

const features = [
  {
    category: "AI Тренер",
    items: [
      "Генерация персональных тренировок по бегу, велоспорту и плаванию через AI",
      "Создание многонедельных тренировочных планов",
      "Стриминг ответов AI в реальном времени (SSE)",
      "Анализ истории активностей и профиля пользователя",
      "Учёт прогноза погоды и геолокации при составлении тренировок",
      "Адаптация тренировок под конкретную модель часов Garmin",
    ],
  },
  {
    category: "Garmin Connect",
    items: [
      "Подключение аккаунта Garmin Connect",
      "Отправка структурированных тренировок на часы Garmin",
      "Планирование тренировок на конкретную дату",
      "Перенос запланированных тренировок на другую дату",
      "Удаление тренировок из Garmin",
      "Просмотр истории активностей из Garmin",
      "Кэширование API-запросов (5 мин) для снижения нагрузки",
      "Кэширование активностей в БД с 4-часовым cooldown (v1.010)",
      "Прогрессивная дельта-синхронизация 3→10→30 для минимизации API-вызовов (v1.010)",
    ],
  },
  {
    category: "Intervals.icu",
    items: [
      "Подключение аккаунта Intervals.icu",
      "Отправка тренировок в Intervals.icu",
      "Перенос тренировок в календаре Intervals.icu",
      "Просмотр активностей из Intervals.icu",
    ],
  },
  {
    category: "Дашборд",
    items: [
      "Онбординг для новых пользователей (профиль, устройство, первая тренировка)",
      "Список предстоящих тренировок на 14 дней из Garmin и Intervals.icu",
      "Перенос тренировок прямо с дашборда через календарь",
      "Ручное обновление данных с очисткой кэша",
      "Статистика строго за 30 дней, карточки — до 10 последних активностей (v1.010)",
      "Отображение времени последней синхронизации и предупреждения о rate limiting (v1.010)",
      "Отображение ошибок загрузки активностей вместо пустого списка (v1.010)",
    ],
  },
  {
    category: "Общее",
    items: [
      "Регистрация и авторизация пользователей",
      "Сохранение избранных тренировок",
      "Профиль пользователя с настройками видов спорта и целей",
      "Шифрование паролей и API-ключей (AES-256-GCM)",
      "Тёмная и светлая темы оформления",
      "Отправка баг-репортов",
      "Страница FAQ",
    ],
  },
];

export default function VersionPage() {
  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold" data-testid="text-version-title">Версия</h1>
        <Badge variant="secondary" className="text-base px-3 py-1" data-testid="text-version-number">
          {CURRENT_VERSION}
        </Badge>
      </div>

      <p className="text-muted-foreground" data-testid="text-version-description">
        Текущая версия GarminCoach AI и список реализованного функционала.
      </p>

      {features.map((section) => (
        <Card key={section.category}>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{section.category}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {section.items.map((item, idx) => (
              <div key={idx} className="flex items-start gap-2" data-testid={`text-feature-${section.category}-${idx}`}>
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                <span className="text-sm">{item}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
