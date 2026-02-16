import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, X, Watch, Smartphone, Calendar } from "lucide-react";

import garminCalendar from "@assets/IMAGE_2026-02-16_23:43:51_1771274633188.jpg";
import garminDaily from "@assets/IMAGE_2026-02-16_23:43:42_1771274623997.jpg";
import garminWorkout from "@assets/IMAGE_2026-02-16_23:43:36_1771274617930.jpg";
import garminWatch from "@assets/images/garmin-watch-workout.png";

const steps = [
  {
    title: "Календарь Garmin Connect",
    description: "Откройте приложение Garmin Connect на телефоне. Перейдите в раздел «Календарь». Тренировка появится в виде цветной полоски на запланированную дату.",
    image: garminCalendar,
    icon: Calendar,
  },
  {
    title: "Нажмите на дату",
    description: "Нажмите на день, на который запланирована тренировка. Внизу экрана появится карточка с названием тренировки. Нажмите на неё, чтобы увидеть детали.",
    image: garminDaily,
    icon: Smartphone,
  },
  {
    title: "Детали тренировки",
    description: "Здесь вы увидите все шаги тренировки: разминку, основной блок, заминку. Все целевые пульсовые зоны и интервалы настроены автоматически.",
    image: garminWorkout,
    icon: Smartphone,
  },
  {
    title: "На часах",
    description: "Если тренировка назначена на сегодня — просто выберите активность на часах (например, «Бег»). Часы автоматически предложат запланированную тренировку. Также тренировку можно найти: Часы → Тренировки → Мои тренировки.",
    image: garminWatch,
    icon: Watch,
  },
];

interface GarminGuideDialogProps {
  open: boolean;
  onClose: () => void;
}

export function GarminGuideDialog({ open, onClose }: GarminGuideDialogProps) {
  const [currentStep, setCurrentStep] = useState(0);

  if (!open) return null;

  const step = steps[currentStep];
  const StepIcon = step.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <Card
        className="relative z-10 w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <StepIcon className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold text-sm">
                Шаг {currentStep + 1} из {steps.length}
              </h3>
            </div>
            <Button size="icon" variant="ghost" onClick={onClose} data-testid="button-close-guide">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <h2 className="text-lg font-bold mb-2" data-testid="text-guide-title">{step.title}</h2>
          <p className="text-sm text-muted-foreground mb-4" data-testid="text-guide-description">{step.description}</p>

          <div className="flex justify-center mb-4">
            <img
              src={step.image}
              alt={step.title}
              className="max-h-[400px] w-auto rounded-lg object-contain"
              data-testid={`img-guide-step-${currentStep}`}
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentStep((s) => s - 1)}
              disabled={currentStep === 0}
              data-testid="button-guide-prev"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Назад
            </Button>

            <div className="flex gap-1">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 w-6 rounded-full transition-colors ${
                    i === currentStep ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>

            {currentStep < steps.length - 1 ? (
              <Button
                size="sm"
                onClick={() => setCurrentStep((s) => s + 1)}
                data-testid="button-guide-next"
              >
                Далее
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button size="sm" onClick={onClose} data-testid="button-guide-done">
                Понятно
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
