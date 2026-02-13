import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { FlaskConical, Send, Watch, Activity, CheckCircle, XCircle, Loader2 } from "lucide-react";
import type { Workout, WorkoutStep } from "@shared/schema";

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const TOMORROW = tomorrow.toISOString().split("T")[0];

const TEST_WORKOUTS: Omit<Workout, "id" | "userId" | "createdAt" | "sentToGarmin" | "sentToIntervals">[] = [
  {
    name: "Test 1: Easy run — HR targets all steps",
    description: "HR targets on warmup, interval, recovery, cooldown",
    sportType: "running",
    scheduledDate: TOMORROW,
    steps: [
      { stepId: 1, stepOrder: 1, stepType: "warmup", durationType: "time", durationValue: 600, targetType: "heart.rate.zone", targetValueLow: 100, targetValueHigh: 125, intensity: "active" },
      { stepId: 2, stepOrder: 2, stepType: "repeat", durationType: "time", durationValue: null, targetType: "no.target", targetValueLow: null, targetValueHigh: null, intensity: "active", repeatCount: 4, childSteps: [
        { stepId: 3, stepOrder: 1, stepType: "interval", durationType: "time", durationValue: 120, targetType: "heart.rate.zone", targetValueLow: 130, targetValueHigh: 140, intensity: "active" },
        { stepId: 4, stepOrder: 2, stepType: "recovery", durationType: "time", durationValue: 180, targetType: "heart.rate.zone", targetValueLow: 110, targetValueHigh: 125, intensity: "resting" },
      ]},
      { stepId: 5, stepOrder: 3, stepType: "cooldown", durationType: "time", durationValue: 600, targetType: "heart.rate.zone", targetValueLow: 90, targetValueHigh: 110, intensity: "active" },
    ],
  },
  {
    name: "Test 2: Pace-based intervals",
    description: "Pace targets on intervals, HR on warmup/cooldown",
    sportType: "running",
    scheduledDate: TOMORROW,
    steps: [
      { stepId: 1, stepOrder: 1, stepType: "warmup", durationType: "time", durationValue: 900, targetType: "heart.rate.zone", targetValueLow: 100, targetValueHigh: 120, intensity: "active" },
      { stepId: 2, stepOrder: 2, stepType: "repeat", durationType: "time", durationValue: null, targetType: "no.target", targetValueLow: null, targetValueHigh: null, intensity: "active", repeatCount: 5, childSteps: [
        { stepId: 3, stepOrder: 1, stepType: "interval", durationType: "distance", durationValue: 1000, targetType: "pace.zone", targetValueLow: 270, targetValueHigh: 300, intensity: "active" },
        { stepId: 4, stepOrder: 2, stepType: "recovery", durationType: "time", durationValue: 120, targetType: "heart.rate.zone", targetValueLow: 100, targetValueHigh: 120, intensity: "resting" },
      ]},
      { stepId: 5, stepOrder: 3, stepType: "cooldown", durationType: "time", durationValue: 600, targetType: "heart.rate.zone", targetValueLow: 90, targetValueHigh: 110, intensity: "active" },
    ],
  },
  {
    name: "Test 3: Short distance intervals (meters)",
    description: "Sub-1km distances (200m, 400m) to test mtr format",
    sportType: "running",
    scheduledDate: TOMORROW,
    steps: [
      { stepId: 1, stepOrder: 1, stepType: "warmup", durationType: "time", durationValue: 600, targetType: "heart.rate.zone", targetValueLow: 100, targetValueHigh: 120, intensity: "active" },
      { stepId: 2, stepOrder: 2, stepType: "repeat", durationType: "time", durationValue: null, targetType: "no.target", targetValueLow: null, targetValueHigh: null, intensity: "active", repeatCount: 8, childSteps: [
        { stepId: 3, stepOrder: 1, stepType: "interval", durationType: "distance", durationValue: 200, targetType: "pace.zone", targetValueLow: 210, targetValueHigh: 240, intensity: "active" },
        { stepId: 4, stepOrder: 2, stepType: "recovery", durationType: "distance", durationValue: 200, targetType: "heart.rate.zone", targetValueLow: 100, targetValueHigh: 120, intensity: "resting" },
      ]},
      { stepId: 5, stepOrder: 3, stepType: "repeat", durationType: "time", durationValue: null, targetType: "no.target", targetValueLow: null, targetValueHigh: null, intensity: "active", repeatCount: 4, childSteps: [
        { stepId: 6, stepOrder: 1, stepType: "interval", durationType: "distance", durationValue: 400, targetType: "pace.zone", targetValueLow: 240, targetValueHigh: 270, intensity: "active" },
        { stepId: 7, stepOrder: 2, stepType: "recovery", durationType: "time", durationValue: 90, targetType: "heart.rate.zone", targetValueLow: 100, targetValueHigh: 120, intensity: "resting" },
      ]},
      { stepId: 8, stepOrder: 3, stepType: "cooldown", durationType: "time", durationValue: 600, targetType: "heart.rate.zone", targetValueLow: 90, targetValueHigh: 110, intensity: "active" },
    ],
  },
  {
    name: "Test 4: Long distance (km)",
    description: "Distances >= 1km to test km format",
    sportType: "running",
    scheduledDate: TOMORROW,
    steps: [
      { stepId: 1, stepOrder: 1, stepType: "warmup", durationType: "distance", durationValue: 2000, targetType: "heart.rate.zone", targetValueLow: 100, targetValueHigh: 120, intensity: "active" },
      { stepId: 2, stepOrder: 2, stepType: "repeat", durationType: "time", durationValue: null, targetType: "no.target", targetValueLow: null, targetValueHigh: null, intensity: "active", repeatCount: 3, childSteps: [
        { stepId: 3, stepOrder: 1, stepType: "interval", durationType: "distance", durationValue: 2000, targetType: "pace.zone", targetValueLow: 270, targetValueHigh: 300, intensity: "active" },
        { stepId: 4, stepOrder: 2, stepType: "recovery", durationType: "distance", durationValue: 1000, targetType: "heart.rate.zone", targetValueLow: 100, targetValueHigh: 120, intensity: "resting" },
      ]},
      { stepId: 5, stepOrder: 3, stepType: "cooldown", durationType: "distance", durationValue: 2000, targetType: "heart.rate.zone", targetValueLow: 90, targetValueHigh: 110, intensity: "active" },
    ],
  },
  {
    name: "Test 5: Mixed time formats",
    description: "Various time durations: 30s, 45s, 90s, 5m, 15m",
    sportType: "running",
    scheduledDate: TOMORROW,
    steps: [
      { stepId: 1, stepOrder: 1, stepType: "warmup", durationType: "time", durationValue: 900, targetType: "heart.rate.zone", targetValueLow: 100, targetValueHigh: 120, intensity: "active" },
      { stepId: 2, stepOrder: 2, stepType: "repeat", durationType: "time", durationValue: null, targetType: "no.target", targetValueLow: null, targetValueHigh: null, intensity: "active", repeatCount: 6, childSteps: [
        { stepId: 3, stepOrder: 1, stepType: "interval", durationType: "time", durationValue: 30, targetType: "heart.rate.zone", targetValueLow: 150, targetValueHigh: 160, intensity: "active" },
        { stepId: 4, stepOrder: 2, stepType: "recovery", durationType: "time", durationValue: 45, targetType: "heart.rate.zone", targetValueLow: 100, targetValueHigh: 120, intensity: "resting" },
      ]},
      { stepId: 5, stepOrder: 3, stepType: "repeat", durationType: "time", durationValue: null, targetType: "no.target", targetValueLow: null, targetValueHigh: null, intensity: "active", repeatCount: 3, childSteps: [
        { stepId: 6, stepOrder: 1, stepType: "interval", durationType: "time", durationValue: 300, targetType: "heart.rate.zone", targetValueLow: 140, targetValueHigh: 150, intensity: "active" },
        { stepId: 7, stepOrder: 2, stepType: "recovery", durationType: "time", durationValue: 90, targetType: "heart.rate.zone", targetValueLow: 100, targetValueHigh: 120, intensity: "resting" },
      ]},
      { stepId: 8, stepOrder: 3, stepType: "cooldown", durationType: "time", durationValue: 600, targetType: "heart.rate.zone", targetValueLow: 90, targetValueHigh: 110, intensity: "active" },
    ],
  },
  {
    name: "Test 6: Power-based cycling",
    description: "Cycling with power targets (watts)",
    sportType: "cycling",
    scheduledDate: TOMORROW,
    steps: [
      { stepId: 1, stepOrder: 1, stepType: "warmup", durationType: "time", durationValue: 600, targetType: "heart.rate.zone", targetValueLow: 100, targetValueHigh: 120, intensity: "active" },
      { stepId: 2, stepOrder: 2, stepType: "repeat", durationType: "time", durationValue: null, targetType: "no.target", targetValueLow: null, targetValueHigh: null, intensity: "active", repeatCount: 4, childSteps: [
        { stepId: 3, stepOrder: 1, stepType: "interval", durationType: "time", durationValue: 240, targetType: "power.zone", targetValueLow: 200, targetValueHigh: 250, intensity: "active" },
        { stepId: 4, stepOrder: 2, stepType: "recovery", durationType: "time", durationValue: 120, targetType: "heart.rate.zone", targetValueLow: 100, targetValueHigh: 120, intensity: "resting" },
      ]},
      { stepId: 5, stepOrder: 3, stepType: "cooldown", durationType: "time", durationValue: 600, targetType: "heart.rate.zone", targetValueLow: 90, targetValueHigh: 110, intensity: "active" },
    ],
  },
  {
    name: "Test 7: Cadence targets",
    description: "Running with cadence targets (spm)",
    sportType: "running",
    scheduledDate: TOMORROW,
    steps: [
      { stepId: 1, stepOrder: 1, stepType: "warmup", durationType: "time", durationValue: 600, targetType: "heart.rate.zone", targetValueLow: 100, targetValueHigh: 120, intensity: "active" },
      { stepId: 2, stepOrder: 2, stepType: "repeat", durationType: "time", durationValue: null, targetType: "no.target", targetValueLow: null, targetValueHigh: null, intensity: "active", repeatCount: 4, childSteps: [
        { stepId: 3, stepOrder: 1, stepType: "interval", durationType: "time", durationValue: 180, targetType: "cadence", targetValueLow: 170, targetValueHigh: 180, intensity: "active" },
        { stepId: 4, stepOrder: 2, stepType: "recovery", durationType: "time", durationValue: 60, targetType: "no.target", targetValueLow: null, targetValueHigh: null, intensity: "resting" },
      ]},
      { stepId: 5, stepOrder: 3, stepType: "cooldown", durationType: "time", durationValue: 300, targetType: "heart.rate.zone", targetValueLow: 90, targetValueHigh: 110, intensity: "active" },
    ],
  },
  {
    name: "Test 8: No target (free run)",
    description: "Warmup/cooldown with HR, main set without targets",
    sportType: "running",
    scheduledDate: TOMORROW,
    steps: [
      { stepId: 1, stepOrder: 1, stepType: "warmup", durationType: "time", durationValue: 600, targetType: "heart.rate.zone", targetValueLow: 100, targetValueHigh: 120, intensity: "active" },
      { stepId: 2, stepOrder: 2, stepType: "interval", durationType: "time", durationValue: 1800, targetType: "no.target", targetValueLow: null, targetValueHigh: null, intensity: "active" },
      { stepId: 3, stepOrder: 3, stepType: "cooldown", durationType: "time", durationValue: 600, targetType: "heart.rate.zone", targetValueLow: 90, targetValueHigh: 110, intensity: "active" },
    ],
  },
  {
    name: "Test 9: Lap button (open end)",
    description: "Intervals with lap button end condition",
    sportType: "running",
    scheduledDate: TOMORROW,
    steps: [
      { stepId: 1, stepOrder: 1, stepType: "warmup", durationType: "time", durationValue: 600, targetType: "heart.rate.zone", targetValueLow: 100, targetValueHigh: 120, intensity: "active" },
      { stepId: 2, stepOrder: 2, stepType: "repeat", durationType: "time", durationValue: null, targetType: "no.target", targetValueLow: null, targetValueHigh: null, intensity: "active", repeatCount: 5, childSteps: [
        { stepId: 3, stepOrder: 1, stepType: "interval", durationType: "lap.button", durationValue: null, targetType: "pace.zone", targetValueLow: 270, targetValueHigh: 300, intensity: "active" },
        { stepId: 4, stepOrder: 2, stepType: "recovery", durationType: "lap.button", durationValue: null, targetType: "heart.rate.zone", targetValueLow: 100, targetValueHigh: 120, intensity: "resting" },
      ]},
      { stepId: 5, stepOrder: 3, stepType: "cooldown", durationType: "time", durationValue: 600, targetType: "heart.rate.zone", targetValueLow: 90, targetValueHigh: 110, intensity: "active" },
    ],
  },
  {
    name: "Test 10: Swimming workout",
    description: "Pool swimming with distance intervals",
    sportType: "swimming",
    scheduledDate: TOMORROW,
    steps: [
      { stepId: 1, stepOrder: 1, stepType: "warmup", durationType: "distance", durationValue: 200, targetType: "no.target", targetValueLow: null, targetValueHigh: null, intensity: "active" },
      { stepId: 2, stepOrder: 2, stepType: "repeat", durationType: "time", durationValue: null, targetType: "no.target", targetValueLow: null, targetValueHigh: null, intensity: "active", repeatCount: 6, childSteps: [
        { stepId: 3, stepOrder: 1, stepType: "interval", durationType: "distance", durationValue: 100, targetType: "no.target", targetValueLow: null, targetValueHigh: null, intensity: "active" },
        { stepId: 4, stepOrder: 2, stepType: "rest", durationType: "time", durationValue: 30, targetType: "no.target", targetValueLow: null, targetValueHigh: null, intensity: "resting" },
      ]},
      { stepId: 5, stepOrder: 3, stepType: "repeat", durationType: "time", durationValue: null, targetType: "no.target", targetValueLow: null, targetValueHigh: null, intensity: "active", repeatCount: 4, childSteps: [
        { stepId: 6, stepOrder: 1, stepType: "interval", durationType: "distance", durationValue: 50, targetType: "no.target", targetValueLow: null, targetValueHigh: null, intensity: "active" },
        { stepId: 7, stepOrder: 2, stepType: "rest", durationType: "time", durationValue: 20, targetType: "no.target", targetValueLow: null, targetValueHigh: null, intensity: "resting" },
      ]},
      { stepId: 8, stepOrder: 3, stepType: "cooldown", durationType: "distance", durationValue: 200, targetType: "no.target", targetValueLow: null, targetValueHigh: null, intensity: "active" },
    ],
  },
];

type PushResult = {
  workoutIndex: number;
  target: "garmin" | "intervals";
  status: "pending" | "success" | "error";
  message?: string;
};

export default function TestWorkoutsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [results, setResults] = useState<PushResult[]>([]);
  const [pushing, setPushing] = useState<string | null>(null);

  const updateResult = (index: number, target: "garmin" | "intervals", status: "success" | "error", message?: string) => {
    setResults(prev => {
      const existing = prev.filter(r => !(r.workoutIndex === index && r.target === target));
      return [...existing, { workoutIndex: index, target, status, message }];
    });
  };

  const getResult = (index: number, target: "garmin" | "intervals") => {
    return results.find(r => r.workoutIndex === index && r.target === target);
  };

  const pushWorkout = async (index: number, target: "garmin" | "intervals") => {
    const workout = TEST_WORKOUTS[index];
    const key = `${target}-${index}`;
    setPushing(key);

    try {
      const endpoint = target === "garmin" ? "/api/garmin/push-workout" : "/api/intervals/push-workout";
      const res = await apiRequest("POST", endpoint, workout);
      const data = await res.json();
      updateResult(index, target, "success", JSON.stringify(data));
      toast({ title: `${workout.name}`, description: `Sent to ${target}` });
    } catch (err: any) {
      updateResult(index, target, "error", err.message);
      toast({ title: `Error: ${workout.name}`, description: err.message, variant: "destructive" });
    } finally {
      setPushing(null);
    }
  };

  const pushAllTo = async (target: "garmin" | "intervals") => {
    for (let i = 0; i < TEST_WORKOUTS.length; i++) {
      await pushWorkout(i, target);
    }
  };

  if (!user || user.username !== "Andrey") {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Доступ запрещён
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <FlaskConical className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-xl font-semibold" data-testid="text-test-title">Test Workouts ({TEST_WORKOUTS.length})</h1>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button
          data-testid="button-push-all-garmin"
          onClick={() => pushAllTo("garmin")}
          disabled={!!pushing || !user.garminConnected}
          variant="outline"
        >
          <Watch className="h-4 w-4 mr-1" /> Push all to Garmin
        </Button>
        <Button
          data-testid="button-push-all-intervals"
          onClick={() => pushAllTo("intervals")}
          disabled={!!pushing || !user.intervalsConnected}
          variant="outline"
        >
          <Activity className="h-4 w-4 mr-1" /> Push all to Intervals.icu
        </Button>
      </div>

      <div className="space-y-3">
        {TEST_WORKOUTS.map((workout, i) => {
          const garminResult = getResult(i, "garmin");
          const intervalsResult = getResult(i, "intervals");

          return (
            <Card key={i}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <div className="space-y-1 min-w-0">
                  <div className="font-medium text-sm" data-testid={`text-workout-name-${i}`}>{workout.name}</div>
                  <div className="text-xs text-muted-foreground">{workout.description}</div>
                  <div className="flex gap-1 flex-wrap">
                    <Badge variant="secondary" className="text-xs">{workout.sportType}</Badge>
                    {workout.steps.map((step, si) => {
                      if (step.stepType === "repeat") {
                        return <Badge key={si} variant="outline" className="text-xs">{step.repeatCount}x repeat</Badge>;
                      }
                      const dur = step.durationType === "time" && step.durationValue
                        ? `${Math.floor(step.durationValue / 60)}m${step.durationValue % 60 ? step.durationValue % 60 + "s" : ""}`
                        : step.durationType === "distance" && step.durationValue
                          ? step.durationValue >= 1000 ? `${step.durationValue / 1000}km` : `${step.durationValue}m`
                          : step.durationType === "lap.button" ? "lap" : "";
                      return <Badge key={si} variant="outline" className="text-xs">{step.stepType} {dur} {step.targetType !== "no.target" ? step.targetType.replace(".zone", "").replace(".", " ") : ""}</Badge>;
                    })}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex gap-2 flex-wrap items-center">
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid={`button-push-garmin-${i}`}
                    disabled={!!pushing || !user.garminConnected}
                    onClick={() => pushWorkout(i, "garmin")}
                  >
                    {pushing === `garmin-${i}` ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Watch className="h-3 w-3 mr-1" />}
                    Garmin
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid={`button-push-intervals-${i}`}
                    disabled={!!pushing || !user.intervalsConnected}
                    onClick={() => pushWorkout(i, "intervals")}
                  >
                    {pushing === `intervals-${i}` ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Activity className="h-3 w-3 mr-1" />}
                    Intervals
                  </Button>

                  {garminResult && (
                    <Badge variant={garminResult.status === "success" ? "secondary" : "destructive"} className="text-xs">
                      {garminResult.status === "success" ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                      Garmin {garminResult.status}
                    </Badge>
                  )}
                  {intervalsResult && (
                    <Badge variant={intervalsResult.status === "success" ? "secondary" : "destructive"} className="text-xs">
                      {intervalsResult.status === "success" ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                      Intervals {intervalsResult.status}
                    </Badge>
                  )}
                </div>
                {(garminResult?.message || intervalsResult?.message) && (
                  <div className="mt-2 text-xs text-muted-foreground font-mono whitespace-pre-wrap break-all">
                    {garminResult?.message && <div>Garmin: {garminResult.message}</div>}
                    {intervalsResult?.message && <div>Intervals: {intervalsResult.message}</div>}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
