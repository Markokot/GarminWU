import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, ChevronRight, X, Settings, User, MessageSquare, Watch, CalendarDays } from "lucide-react";

import stepConnect from "@assets/onboarding-step1-connect.png";
import stepProfile from "@assets/onboarding-step2-profile.png";
import stepChat from "@assets/onboarding-step3-chat.png";
import stepPush from "@assets/onboarding-step4-push.png";
import stepPlan from "@assets/onboarding-step5-plan.png";

const STORAGE_KEY = "onboarding_dismissed";

const steps = [
  {
    title: "Подключите Garmin",
    description: "Зайдите в Настройки и привяжите аккаунт Garmin Connect, чтобы тренировки отправлялись прямо на часы.",
    image: stepConnect,
    icon: Settings,
  },
  {
    title: "Заполните профиль",
    description: "Укажите вид спорта, уровень подготовки, цели и модель часов — AI-тренер будет давать персональные рекомендации.",
    image: stepProfile,
    icon: User,
  },
  {
    title: "Опишите тренировку",
    description: "Напишите тренеру что хотите: «интервалы 5×1км» или «лёгкий бег 40 минут» — он создаст структурированную тренировку.",
    image: stepChat,
    icon: MessageSquare,
  },
  {
    title: "Отправьте на часы",
    description: "Нажмите кнопку «На Garmin» — тренировка появится в Garmin Connect и на ваших часах.",
    image: stepPush,
    icon: Watch,
  },
  {
    title: "Запросите план",
    description: "Попросите план на несколько недель (например, «план на полумарафон 8 недель») — все тренировки отправятся на часы сразу.",
    image: stepPlan,
    icon: CalendarDays,
  },
];

interface OnboardingDialogProps {
  open: boolean;
  onClose: () => void;
}

export function OnboardingDialog({ open, onClose }: OnboardingDialogProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (open) setCurrentStep(0);
  }, [open]);

  if (!open) return null;

  const step = steps[currentStep];
  const StepIcon = step.icon;

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem(STORAGE_KEY, "true");
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4" onClick={handleClose}>
      <div className="absolute inset-0 bg-black/60" />
      <Card
        className="relative z-10 w-full max-w-sm flex flex-col"
        style={{ maxHeight: "calc(100vh - 1rem)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 sm:p-4 flex flex-col min-h-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <StepIcon className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="font-semibold text-xs text-muted-foreground">
                {currentStep + 1} / {steps.length}
              </span>
            </div>
            <Button size="icon" variant="ghost" onClick={handleClose} data-testid="button-close-onboarding">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <h2 className="text-base font-bold mb-1" data-testid="text-onboarding-title">{step.title}</h2>
          <p className="text-sm text-muted-foreground mb-3" data-testid="text-onboarding-description">{step.description}</p>

          <div className="flex justify-center flex-1 min-h-0 mb-3">
            <img
              src={step.image}
              alt={step.title}
              className="object-contain max-h-[35vh] sm:max-h-[40vh]"
              data-testid={`img-onboarding-step-${currentStep}`}
            />
          </div>

          {currentStep === steps.length - 1 && (
            <label className="flex items-center gap-2 mb-3 cursor-pointer" data-testid="checkbox-dont-show">
              <Checkbox
                checked={dontShowAgain}
                onCheckedChange={(checked) => setDontShowAgain(checked === true)}
              />
              <span className="text-xs text-muted-foreground">Больше не показывать</span>
            </label>
          )}

          <div className="flex items-center justify-between gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentStep((s) => s - 1)}
              disabled={currentStep === 0}
              data-testid="button-onboarding-prev"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Назад
            </Button>

            <div className="flex gap-1">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 w-3 rounded-full transition-colors ${
                    i === currentStep ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>

            {currentStep < steps.length - 1 ? (
              <Button
                size="sm"
                onClick={() => setCurrentStep((s) => s + 1)}
                data-testid="button-onboarding-next"
              >
                Далее
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button size="sm" onClick={handleClose} data-testid="button-onboarding-done">
                Понятно!
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

export function shouldShowOnboarding(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== "true";
}
