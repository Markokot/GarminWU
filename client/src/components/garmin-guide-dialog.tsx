import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, X, Watch, Smartphone, Calendar, ArrowRightLeft } from "lucide-react";
import { useTranslation } from "@/i18n/context";

import garminCalendar from "@assets/IMAGE_2026-02-16_23:43:51_1771274633188.jpg";
import garminDaily from "@assets/IMAGE_2026-02-16_23:43:42_1771274623997.jpg";
import garminWorkout from "@assets/IMAGE_2026-02-16_23:43:36_1771274617930.jpg";
import garminWatch from "@assets/garmin-watch-clean.png";

const stepImages = [garminCalendar, garminDaily, garminWorkout, garminCalendar, garminWatch];
const stepIcons = [Calendar, Smartphone, Smartphone, ArrowRightLeft, Watch];
const stepIsPhone = [true, true, true, true, false];
const stepKeys = [
  { title: "garminGuide.step1Title", desc: "garminGuide.step1Desc" },
  { title: "garminGuide.step2Title", desc: "garminGuide.step2Desc" },
  { title: "garminGuide.step3Title", desc: "garminGuide.step3Desc" },
  { title: "garminGuide.step4Title", desc: "garminGuide.step4Desc" },
  { title: "garminGuide.step5Title", desc: "garminGuide.step5Desc" },
];

interface GarminGuideDialogProps {
  open: boolean;
  onClose: () => void;
}

export function GarminGuideDialog({ open, onClose }: GarminGuideDialogProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const { t } = useTranslation();

  useEffect(() => {
    if (open) setCurrentStep(0);
  }, [open]);

  if (!open) return null;

  const StepIcon = stepIcons[currentStep];
  const stepTitle = t(stepKeys[currentStep].title);
  const stepDescription = t(stepKeys[currentStep].desc);

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
                {currentStep + 1} / {stepKeys.length}
              </span>
            </div>
            <Button size="icon" variant="ghost" onClick={onClose} data-testid="button-close-guide">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <h2 className="text-base font-bold mb-1" data-testid="text-guide-title">{stepTitle}</h2>
          <p className="text-xs text-muted-foreground mb-2" data-testid="text-guide-description">{stepDescription}</p>

          <div className="flex justify-center flex-1 min-h-0 mb-2">
            {stepIsPhone[currentStep] ? (
              <img
                src={stepImages[currentStep]}
                alt={stepTitle}
                className="rounded-lg object-contain max-h-[45vh] sm:max-h-[50vh]"
                data-testid={`img-guide-step-${currentStep}`}
              />
            ) : (
              <img
                src={stepImages[currentStep]}
                alt={stepTitle}
                className="object-contain max-h-[40vh] sm:max-h-[45vh]"
                data-testid={`img-guide-step-${currentStep}`}
              />
            )}
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
              {t("common.back")}
            </Button>

            <div className="flex gap-1">
              {stepKeys.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 w-4 rounded-full transition-colors ${
                    i === currentStep ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>

            {currentStep < stepKeys.length - 1 ? (
              <Button
                size="sm"
                onClick={() => setCurrentStep((s) => s + 1)}
                data-testid="button-guide-next"
              >
                {t("common.next")}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button size="sm" onClick={onClose} data-testid="button-guide-done">
                {t("common.gotIt")}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
