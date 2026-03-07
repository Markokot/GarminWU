import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Shield,
  Watch,
  BarChart3,
  MessageSquare,
  Dumbbell,
  AlertTriangle,
  ExternalLink,
  Key,
  Lock,
  FlaskConical,
  Star,
  ListChecks,
  CalendarDays,
  ArrowRightLeft,
} from "lucide-react";
import { useTranslation } from "@/i18n/context";

export default function FaqPage() {
  const { t } = useTranslation();

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold" data-testid="text-faq-title">{t("faq.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("faq.subtitle")}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">{t("faq.generalSection")}</h2>
          </div>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            <AccordionItem value="what-is">
              <AccordionTrigger data-testid="faq-what-is">
                {t("faq.whatIsTitle")}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>{t("faq.whatIsDesc1")}</p>
                  <p>{t("faq.whatIsDesc2")}</p>
                  <p>{t("faq.whatIsDesc3")}</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="sports">
              <AccordionTrigger data-testid="faq-sports">
                {t("faq.sportsTitle")}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>{t("faq.sportsDesc")}</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>{t("faq.sportsRunning")}</li>
                    <li>{t("faq.sportsCycling")}</li>
                    <li>{t("faq.sportsSwimming")}</li>
                    <li>{t("faq.sportsTriathlon")}</li>
                  </ul>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="how-ai-works">
              <AccordionTrigger data-testid="faq-how-ai-works">
                {t("faq.howAITitle")}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>{t("faq.howAIDesc1")}</p>
                  <p>{t("faq.howAIDesc2")}</p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">{t("faq.workoutsSection")}</h2>
          </div>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            <AccordionItem value="single-workout">
              <AccordionTrigger data-testid="faq-single-workout">
                {t("faq.singleWorkoutTitle")}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>{t("faq.singleWorkoutDesc")}</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>{t("faq.singleWorkoutEx1")}</li>
                    <li>{t("faq.singleWorkoutEx2")}</li>
                    <li>{t("faq.singleWorkoutEx3")}</li>
                    <li>{t("faq.singleWorkoutEx4")}</li>
                  </ul>
                  <p>{t("faq.singleWorkoutNote")}</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="training-plan">
              <AccordionTrigger data-testid="faq-training-plan">
                <div className="flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>{t("faq.planTitle")}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>{t("faq.planDesc")}</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>{t("faq.planEx1")}</li>
                    <li>{t("faq.planEx2")}</li>
                    <li>{t("faq.planEx3")}</li>
                    <li>{t("faq.planEx4")}</li>
                  </ul>
                  <div className="bg-muted rounded-md p-3 space-y-2">
                    <p className="font-medium text-foreground">{t("faq.planWhatYouGet")}</p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>{t("faq.planFeature1")}</li>
                      <li>{t("faq.planFeature2")}</li>
                      <li>{t("faq.planFeature3")}</li>
                      <li>{t("faq.planFeature4")}</li>
                      <li>{t("faq.planFeature5")}</li>
                    </ul>
                  </div>
                  <div className="bg-muted rounded-md p-3 space-y-1">
                    <p className="font-medium text-foreground flex items-center gap-1">
                      <CalendarDays className="w-4 h-4 text-primary" />
                      {t("faq.planLimits")}
                    </p>
                    <p>{t("faq.planLimitsDesc")}</p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="favorites">
              <AccordionTrigger data-testid="faq-favorites">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>{t("faq.favoritesTitle")}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>{t("faq.favoritesDesc1")}</p>
                  <p>{t("faq.favoritesDesc2")}</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="scheduling">
              <AccordionTrigger data-testid="faq-scheduling">
                {t("faq.schedulingTitle")}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>{t("faq.schedulingDesc")}</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>{t("faq.schedulingEx1")}</li>
                    <li>{t("faq.schedulingEx2")}</li>
                    <li>{t("faq.schedulingEx3")}</li>
                    <li>{t("faq.schedulingEx4")}</li>
                  </ul>
                  <p>{t("faq.schedulingNote")}</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="reschedule">
              <AccordionTrigger data-testid="faq-reschedule">
                <div className="flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>{t("faq.rescheduleTitle")}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>{t("faq.rescheduleDesc")}</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>{t("faq.rescheduleEx1")}</li>
                    <li>{t("faq.rescheduleEx2")}</li>
                    <li>{t("faq.rescheduleEx3")}</li>
                  </ul>
                  <div className="bg-muted rounded-md p-3 space-y-2">
                    <p className="font-medium text-foreground">{t("faq.rescheduleHow")}</p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>{t("faq.rescheduleHowStep1")}</li>
                      <li>{t("faq.rescheduleHowStep2")}</li>
                      <li>{t("faq.rescheduleHowStep3")}</li>
                      <li>{t("faq.rescheduleHowStep4")}</li>
                    </ul>
                  </div>
                  <p>{t("faq.rescheduleNote")}</p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Watch className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">{t("faq.garminSection")}</h2>
          </div>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            <AccordionItem value="garmin-connect">
              <AccordionTrigger data-testid="faq-garmin-connect">
                {t("faq.garminConnectTitle")}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>{t("faq.garminConnectDesc1")}</p>
                  <p>{t("faq.garminConnectDesc2")}</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="garmin-block">
              <AccordionTrigger data-testid="faq-garmin-block">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <span>{t("faq.garminBlockTitle")}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>{t("faq.garminBlockDesc")}</p>
                  <div className="bg-muted rounded-md p-3 space-y-2">
                    <p className="font-medium text-foreground">{t("faq.garminBlockFix")}</p>
                    <ol className="list-decimal pl-5 space-y-1">
                      <li>{t("faq.garminBlockFix1")}</li>
                      <li>{t("faq.garminBlockFix2")}</li>
                      <li>{t("faq.garminBlockFix3")}</li>
                      <li>{t("faq.garminBlockFix4")}</li>
                    </ol>
                  </div>
                  <div className="bg-muted rounded-md p-3 space-y-2">
                    <p className="font-medium text-foreground">{t("faq.garminBlockPrevent")}</p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>{t("faq.garminBlockPrevent1")}</li>
                      <li>{t("faq.garminBlockPrevent2")}</li>
                      <li>{t("faq.garminBlockPrevent3")}</li>
                    </ul>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="garmin-push">
              <AccordionTrigger data-testid="faq-garmin-push">
                {t("faq.garminPushTitle")}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>{t("faq.garminPushDesc1")}</p>
                  <ol className="list-decimal pl-5 space-y-1">
                    <li>{t("faq.garminPushStep1")}</li>
                    <li>{t("faq.garminPushStep2")}</li>
                    <li>{t("faq.garminPushStep3")}</li>
                  </ol>
                  <p>{t("faq.garminPushNote")}</p>
                  <p>{t("faq.garminPushBulk")}</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="garmin-swim-compat">
              <AccordionTrigger data-testid="faq-garmin-swim-compat">
                {t("faq.garminSwimTitle")}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>{t("faq.garminSwimDesc")}</p>
                  <p><strong>{t("faq.garminSwimSupported")}</strong></p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Forerunner 245, 255, 265, 745, 945, 955, 965</li>
                    <li>Fenix 5, 6, 7, 8</li>
                    <li>Enduro, Enduro 2, Enduro 3</li>
                    <li>Epix (Gen 2), Epix Pro</li>
                    <li>MARQ</li>
                    <li>Swim 2</li>
                    <li>Instinct 3</li>
                  </ul>
                  <p><strong>{t("faq.garminSwimNotSupported")}</strong></p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Venu, Venu 2, Venu 2S, Venu 3, Venu 3S, Venu Sq</li>
                    <li>Forerunner 55, 165, 645</li>
                    <li>Vivoactive 4, Vivoactive 5</li>
                    <li>Instinct, Instinct 2</li>
                    <li>Fenix E</li>
                  </ul>
                  <p>{t("faq.garminSwimFix")}</p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">{t("faq.intervalsSection")}</h2>
            <Badge variant="secondary" className="text-xs">
              <FlaskConical className="w-3 h-3 mr-1" />
              {t("common.experiment")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            <AccordionItem value="intervals-what">
              <AccordionTrigger data-testid="faq-intervals-what">
                {t("faq.intervalsWhatTitle")}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>{t("faq.intervalsWhatDesc1")}</p>
                  <p>{t("faq.intervalsWhatDesc2")}</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Zwift</strong></li>
                    <li><strong>Garmin</strong></li>
                    <li><strong>Polar</strong></li>
                    <li><strong>Suunto</strong></li>
                    <li><strong>COROS</strong></li>
                    <li><strong>Huawei</strong></li>
                  </ul>
                  <p>{t("faq.intervalsWhatNote")}</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="intervals-register">
              <AccordionTrigger data-testid="faq-intervals-register">
                {t("faq.intervalsRegTitle")}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <ol className="list-decimal pl-5 space-y-2">
                    <li>
                      <a href="https://intervals.icu/signup" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-1">intervals.icu/signup <ExternalLink className="w-3 h-3" /></a>
                    </li>
                  </ol>
                  <p>{t("faq.intervalsRegNote")}</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="intervals-api-key">
              <AccordionTrigger data-testid="faq-intervals-api-key">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>{t("faq.intervalsApiTitle")}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>{t("faq.intervalsApiDesc")}</p>
                  <div className="bg-muted rounded-md p-3 space-y-3">
                    <p className="font-medium text-foreground">{t("faq.intervalsApiInstruction")}</p>
                    <ol className="list-decimal pl-5 space-y-2">
                      <li>
                        <a href="https://intervals.icu" target="_blank" rel="noopener noreferrer" className="text-primary underline">intervals.icu</a>
                      </li>
                    </ol>
                  </div>
                  <div className="bg-muted rounded-md p-3 space-y-1">
                    <p className="font-medium text-foreground flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      {t("faq.intervalsApiImportant")}
                    </p>
                    <p>{t("faq.intervalsApiImportantDesc")}</p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="intervals-athlete-id">
              <AccordionTrigger data-testid="faq-intervals-athlete-id">
                {t("faq.intervalsAthleteTitle")}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>{t("faq.intervalsAthleteDesc")}</p>
                  <p>{t("faq.intervalsAthleteNote")}</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="intervals-zwift">
              <AccordionTrigger data-testid="faq-intervals-zwift">
                {t("faq.intervalsZwiftTitle")}
              </AccordionTrigger>
              <AccordionContent>
                <div className="text-sm text-muted-foreground">
                  <p>{t("faq.intervalsZwiftDesc")}</p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">{t("faq.securitySection")}</h2>
          </div>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            <AccordionItem value="security-garmin">
              <AccordionTrigger data-testid="faq-security-garmin">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>{t("faq.securityGarminTitle")}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>{t("faq.securityGarminDesc1")}</p>
                  <p>{t("faq.securityGarminDesc2")}</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="security-intervals">
              <AccordionTrigger data-testid="faq-security-intervals">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>{t("faq.securityIntervalsTitle")}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>{t("faq.securityIntervalsDesc1")}</p>
                  <p>{t("faq.securityIntervalsDesc2")}</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="data-storage">
              <AccordionTrigger data-testid="faq-data-storage">
                {t("faq.dataStorageTitle")}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>{t("faq.dataStorageDesc1")}</p>
                  <p>{t("faq.dataStorageDesc2")}</p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
