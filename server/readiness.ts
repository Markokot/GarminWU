import type { GarminActivity } from "@shared/schema";

export interface ReadinessFactor {
  name: string;
  score: number;
  maxScore: number;
  label: string;
  description: string;
}

export interface ReadinessResult {
  score: number;
  level: "green" | "yellow" | "red";
  label: string;
  factors: ReadinessFactor[];
  summary: string;
}

function getActivityIntensity(activity: GarminActivity): "high" | "moderate" | "low" {
  if (activity.averageHR && activity.averageHR > 160) return "high";
  if (activity.averagePace && activity.averagePace < 330) return "high";
  if (activity.duration > 5400) return "high";
  if (activity.averageHR && activity.averageHR > 140) return "moderate";
  if (activity.duration > 3600) return "moderate";
  return "low";
}

function daysBetween(d1: Date, d2: Date): number {
  return Math.floor(Math.abs(d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
}

export function calculateReadiness(activities: GarminActivity[]): ReadinessResult {
  const now = new Date();
  const factors: ReadinessFactor[] = [];

  const validActivities = activities.filter((a) => a.startTimeLocal && a.distance >= 0 && a.duration >= 0);

  const last14d = validActivities.filter((a) => {
    const d = new Date(a.startTimeLocal);
    return !isNaN(d.getTime()) && daysBetween(now, d) <= 14;
  });
  const last7d = last14d.filter((a) => daysBetween(now, new Date(a.startTimeLocal)) <= 7);
  const prev7d = last14d.filter((a) => {
    const days = daysBetween(now, new Date(a.startTimeLocal));
    return days > 7 && days <= 14;
  });

  // Factor 1: Weekly load volume (distance) — compare to previous week
  const load7d = last7d.reduce((sum, a) => sum + a.distance, 0) / 1000;
  const loadPrev7d = prev7d.reduce((sum, a) => sum + a.distance, 0) / 1000;

  let loadScore = 25;
  let loadLabel = "Нормальная";
  let loadDesc = `${load7d.toFixed(1)} км за 7 дней`;

  if (loadPrev7d > 0) {
    const ratio = load7d / loadPrev7d;
    if (ratio > 1.3) {
      loadScore = 10;
      loadLabel = "Резкий рост";
      loadDesc += ` (↑${Math.round((ratio - 1) * 100)}% vs прошлая неделя)`;
    } else if (ratio > 1.1) {
      loadScore = 18;
      loadLabel = "Повышенная";
      loadDesc += ` (↑${Math.round((ratio - 1) * 100)}%)`;
    } else if (ratio < 0.5) {
      loadScore = 20;
      loadLabel = "Сниженная";
      loadDesc += ` (↓${Math.round((1 - ratio) * 100)}%)`;
    }
  } else if (load7d > 0) {
    loadDesc += " (нет данных за прошлую неделю)";
  } else {
    loadScore = 25;
    loadLabel = "Нет нагрузки";
    loadDesc = "Нет тренировок за 7 дней";
  }

  factors.push({
    name: "weeklyLoad",
    score: loadScore,
    maxScore: 25,
    label: loadLabel,
    description: loadDesc,
  });

  // Factor 2: Consecutive intense sessions
  const sorted = [...last7d].sort(
    (a, b) => new Date(b.startTimeLocal).getTime() - new Date(a.startTimeLocal).getTime()
  );

  let consecutiveIntense = 0;
  let prevDate: string | null = null;

  for (const a of sorted) {
    const intensity = getActivityIntensity(a);
    const dateStr = a.startTimeLocal.split("T")[0];

    if (intensity === "high") {
      if (!prevDate || daysBetween(new Date(dateStr), new Date(prevDate)) <= 1) {
        consecutiveIntense++;
        prevDate = dateStr;
      } else {
        break;
      }
    } else {
      if (prevDate && daysBetween(new Date(dateStr), new Date(prevDate)) <= 1) {
        break;
      }
    }
  }

  let intenseScore = 25;
  let intenseLabel = "Нет подряд";
  let intenseDesc = "Нет интенсивных тренировок подряд";

  if (consecutiveIntense >= 3) {
    intenseScore = 5;
    intenseLabel = `${consecutiveIntense} подряд`;
    intenseDesc = `${consecutiveIntense} интенсивных тренировки подряд — высокий риск`;
  } else if (consecutiveIntense === 2) {
    intenseScore = 12;
    intenseLabel = "2 подряд";
    intenseDesc = "2 интенсивных тренировки подряд";
  } else if (consecutiveIntense === 1) {
    intenseScore = 20;
    intenseLabel = "1 тяжёлая";
    intenseDesc = "Последняя тренировка была интенсивной";
  }

  factors.push({
    name: "consecutiveIntense",
    score: intenseScore,
    maxScore: 25,
    label: intenseLabel,
    description: intenseDesc,
  });

  // Factor 3: Days since last rest
  const activityDateSet = new Set(last14d.map((a) => a.startTimeLocal.split("T")[0]));
  const activityDates = Array.from(activityDateSet).sort().reverse();
  let consecutiveTrainingDays = 0;

  if (activityDates.length > 0) {
    const today = now.toISOString().split("T")[0];
    let checkDate = new Date(today);

    for (let i = 0; i < 14; i++) {
      const ds = checkDate.toISOString().split("T")[0];
      if (activityDates.includes(ds)) {
        consecutiveTrainingDays++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
  }

  let restScore = 25;
  let restLabel = "Достаточно";
  let restDesc = "";

  if (consecutiveTrainingDays >= 6) {
    restScore = 5;
    restLabel = `${consecutiveTrainingDays}д без отдыха`;
    restDesc = `${consecutiveTrainingDays} дней подряд с тренировками — нужен отдых`;
  } else if (consecutiveTrainingDays >= 4) {
    restScore = 12;
    restLabel = `${consecutiveTrainingDays}д подряд`;
    restDesc = `${consecutiveTrainingDays} дня подряд с тренировками`;
  } else if (consecutiveTrainingDays >= 2) {
    restScore = 20;
    restLabel = `${consecutiveTrainingDays}д подряд`;
    restDesc = `${consecutiveTrainingDays} дня подряд с тренировками`;
  } else if (consecutiveTrainingDays === 1) {
    restScore = 23;
    restLabel = "Вчера отдых";
    restDesc = "Тренировка сегодня, вчера был отдых";
  } else {
    restDesc = "Есть дни отдыха";
  }

  factors.push({
    name: "restDays",
    score: restScore,
    maxScore: 25,
    label: restLabel,
    description: restDesc,
  });

  // Factor 4: Recency of last hard workout
  const lastHard = sorted.find((a) => getActivityIntensity(a) === "high");
  let recoveryScore = 25;
  let recoveryLabel = "Хорошее";
  let recoveryDesc = "";

  if (lastHard) {
    const daysSinceHard = daysBetween(now, new Date(lastHard.startTimeLocal));
    if (daysSinceHard === 0) {
      recoveryScore = 10;
      recoveryLabel = "Тяжёлая сегодня";
      recoveryDesc = "Интенсивная тренировка сегодня";
    } else if (daysSinceHard === 1) {
      recoveryScore = 15;
      recoveryLabel = "Тяжёлая вчера";
      recoveryDesc = "Интенсивная тренировка была вчера";
    } else if (daysSinceHard === 2) {
      recoveryScore = 22;
      recoveryLabel = "2 дня назад";
      recoveryDesc = "Последняя интенсивная — 2 дня назад";
    } else {
      recoveryScore = 25;
      recoveryLabel = `${daysSinceHard}д назад`;
      recoveryDesc = `Последняя интенсивная — ${daysSinceHard} дней назад`;
    }
  } else {
    recoveryDesc = "Нет интенсивных тренировок за неделю";
  }

  factors.push({
    name: "recovery",
    score: recoveryScore,
    maxScore: 25,
    label: recoveryLabel,
    description: recoveryDesc,
  });

  const totalScore = factors.reduce((sum, f) => sum + f.score, 0);
  const clampedScore = Math.max(0, Math.min(100, totalScore));

  let level: "green" | "yellow" | "red";
  let label: string;
  let summary: string;

  if (clampedScore >= 70) {
    level = "green";
    label = "Готов к тренировке";
    summary = "Организм восстановлен, можно тренироваться с полной нагрузкой.";
  } else if (clampedScore >= 40) {
    level = "yellow";
    label = "Лёгкая нагрузка";
    summary = "Рекомендуется восстановительная или лёгкая тренировка.";
  } else {
    level = "red";
    label = "Нужен отдых";
    summary = "Высокая накопленная нагрузка. Рекомендуется день отдыха или очень лёгкая активность.";
  }

  return { score: clampedScore, level, label, factors, summary };
}
