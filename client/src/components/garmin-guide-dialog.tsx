import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, X, Watch, Smartphone, Calendar } from "lucide-react";

import garminCalendar from "@assets/IMAGE_2026-02-16_23:43:51_1771274633188.jpg";
import garminDaily from "@assets/IMAGE_2026-02-16_23:43:42_1771274623997.jpg";
import garminWorkout from "@assets/IMAGE_2026-02-16_23:43:36_1771274617930.jpg";
import garminWatch from "@assets/garmin-watch-workout.png";

const steps = [
  {
    title: "Календарь",
    description: "В Garmin Connect откройте «Календарь» — тренировка будет на нужную дату.",
    image: garminCalendar,
    icon: Calendar,
    isPhone: true,
  },
  {
    title: "Нажмите на дату",
    description: "Внизу появится карточка тренировки — нажмите на неё для деталей.",
    image: garminDaily,
    icon: Smartphone,
    isPhone: true,
  },
  {
    title: "Детали тренировки",
    description: "Все шаги, пульсовые зоны и интервалы уже настроены.",
    image: garminWorkout,
    icon: Smartphone,
    isPhone: true,
  },
  {
    title: "На часах",
    description: "Выберите активность (например, «Бег») — часы предложат тренировку. Или: Тренировки → Мои тренировки.",
    image: garminWatch,
    icon: Watch,
    isPhone: false,
  },
];

interface GarminGuideDialogProps {
  open: boolean;
  onClose: () => void;
}

export function GarminGuideDialog({ open, onClose }: GarminGuideDialogProps) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (open) setCurrentStep(0);
  }, [open]);

  if (!open) return null;

  const step = steps[currentStep];
  const StepIcon = step.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <Card
        className="relative z-10 w-full max-w-sm flex flex-col"
        style={{ maxHeight: "calc(100vh - 1rem)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 sm:p-4 flex flex-col min-h-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <StepIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="font-semibold text-xs text-muted-foreground">
                {currentStep + 1} / {steps.length}
              </span>
            </div>
            <Button size="icon" variant="ghost" onClick={onClose} data-testid="button-close-guide">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <h2 className="text-base font-bold mb-1" data-testid="text-guide-title">{step.title}</h2>
          <p className="text-xs text-muted-foreground mb-2" data-testid="text-guide-description">{step.description}</p>

          <div className="flex justify-center flex-1 min-h-0 mb-2">
            <img
              src={step.image}
              alt={step.title}
              className={`rounded-lg object-contain ${step.isPhone ? "max-h-[45vh] sm:max-h-[50vh]" : "max-h-[35vh] sm:max-h-[40vh]"}`}
              data-testid={`img-guide-step-${currentStep}`}
            />
          </div>

          <div className="flex items-center justify-between gap-2 flex-shrink-0">
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
                  className={`h-1.5 w-4 rounded-full transition-colors ${
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
