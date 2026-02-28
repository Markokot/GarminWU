import type { GarminActivity } from "@shared/schema";
import type { GarminDailyStats } from "./garmin";

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
  dailyStats?: {
    stressLevel: number | null;
    bodyBattery: number | null;
    steps: number | null;
  };
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

export function calculateReadiness(activities: GarminActivity[], dailyStats?: GarminDailyStats | null): ReadinessResult {
  const now = new Date();
  const factors: ReadinessFactor[] = [];

  const hasStress = dailyStats?.stressLevel != null;
  const hasBodyBattery = dailyStats?.bodyBattery != null;
  const hasSteps = dailyStats?.steps != null;
  const healthFactorCount = (hasStress ? 1 : 0) + (hasBodyBattery ? 1 : 0) + (hasSteps ? 1 : 0);

  const baseWeight = 20;
  const healthWeight = 15;
  const totalHealthWeight = healthFactorCount * healthWeight;
  const totalBaseWeight = 4 * baseWeight;
  const totalMaxRaw = totalBaseWeight + totalHealthWeight;

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

  const load7d = last7d.reduce((sum, a) => sum + a.distance, 0) / 1000;
  const loadPrev7d = prev7d.reduce((sum, a) => sum + a.distance, 0) / 1000;

  let loadScore = baseWeight;
  let loadLabel = "Нормальная";
  let loadDesc = `${load7d.toFixed(1)} км за 7 дней`;

  if (loadPrev7d > 0) {
    const ratio = load7d / loadPrev7d;
    if (ratio > 1.3) {
      loadScore = Math.round(baseWeight * 0.4);
      loadLabel = "Резкий рост";
      loadDesc += ` (↑${Math.round((ratio - 1) * 100)}% vs прошлая неделя)`;
    } else if (ratio > 1.1) {
      loadScore = Math.round(baseWeight * 0.72);
      loadLabel = "Повышенная";
      loadDesc += ` (↑${Math.round((ratio - 1) * 100)}%)`;
    } else if (ratio < 0.5) {
      loadScore = Math.round(baseWeight * 0.8);
      loadLabel = "Сниженная";
      loadDesc += ` (↓${Math.round((1 - ratio) * 100)}%)`;
    }
  } else if (load7d > 0) {
    loadDesc += " (нет данных за прошлую неделю)";
  } else {
    loadScore = baseWeight;
    loadLabel = "Нет нагрузки";
    loadDesc = "Нет тренировок за 7 дней";
  }

  factors.push({
    name: "weeklyLoad",
    score: loadScore,
    maxScore: baseWeight,
    label: loadLabel,
    description: loadDesc,
  });

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

  let intenseScore = baseWeight;
  let intenseLabel = "Нет подряд";
  let intenseDesc = "Нет интенсивных тренировок подряд";

  if (consecutiveIntense >= 3) {
    intenseScore = Math.round(baseWeight * 0.2);
    intenseLabel = `${consecutiveIntense} подряд`;
    intenseDesc = `${consecutiveIntense} интенсивных тренировки подряд — высокий риск`;
  } else if (consecutiveIntense === 2) {
    intenseScore = Math.round(baseWeight * 0.48);
    intenseLabel = "2 подряд";
    intenseDesc = "2 интенсивных тренировки подряд";
  } else if (consecutiveIntense === 1) {
    intenseScore = Math.round(baseWeight * 0.8);
    intenseLabel = "1 тяжёлая";
    intenseDesc = "Последняя тренировка была интенсивной";
  }

  factors.push({
    name: "consecutiveIntense",
    score: intenseScore,
    maxScore: baseWeight,
    label: intenseLabel,
    description: intenseDesc,
  });

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

  let restScore = baseWeight;
  let restLabel = "Достаточно";
  let restDesc = "";

  if (consecutiveTrainingDays >= 6) {
    restScore = Math.round(baseWeight * 0.2);
    restLabel = `${consecutiveTrainingDays}д без отдыха`;
    restDesc = `${consecutiveTrainingDays} дней подряд с тренировками — нужен отдых`;
  } else if (consecutiveTrainingDays >= 4) {
    restScore = Math.round(baseWeight * 0.48);
    restLabel = `${consecutiveTrainingDays}д подряд`;
    restDesc = `${consecutiveTrainingDays} дня подряд с тренировками`;
  } else if (consecutiveTrainingDays >= 2) {
    restScore = Math.round(baseWeight * 0.8);
    restLabel = `${consecutiveTrainingDays}д подряд`;
    restDesc = `${consecutiveTrainingDays} дня подряд с тренировками`;
  } else if (consecutiveTrainingDays === 1) {
    restScore = Math.round(baseWeight * 0.92);
    restLabel = "Вчера отдых";
    restDesc = "Тренировка сегодня, вчера был отдых";
  } else {
    restDesc = "Есть дни отдыха";
  }

  factors.push({
    name: "restDays",
    score: restScore,
    maxScore: baseWeight,
    label: restLabel,
    description: restDesc,
  });

  const lastHard = sorted.find((a) => getActivityIntensity(a) === "high");
  let recoveryScore = baseWeight;
  let recoveryLabel = "Хорошее";
  let recoveryDesc = "";

  if (lastHard) {
    const daysSinceHard = daysBetween(now, new Date(lastHard.startTimeLocal));
    if (daysSinceHard === 0) {
      recoveryScore = Math.round(baseWeight * 0.4);
      recoveryLabel = "Тяжёлая сегодня";
      recoveryDesc = "Интенсивная тренировка сегодня";
    } else if (daysSinceHard === 1) {
      recoveryScore = Math.round(baseWeight * 0.6);
      recoveryLabel = "Тяжёлая вчера";
      recoveryDesc = "Интенсивная тренировка была вчера";
    } else if (daysSinceHard === 2) {
      recoveryScore = Math.round(baseWeight * 0.88);
      recoveryLabel = "2 дня назад";
      recoveryDesc = "Последняя интенсивная — 2 дня назад";
    } else {
      recoveryScore = baseWeight;
      recoveryLabel = `${daysSinceHard}д назад`;
      recoveryDesc = `Последняя интенсивная — ${daysSinceHard} дней назад`;
    }
  } else {
    recoveryDesc = "Нет интенсивных тренировок за неделю";
  }

  factors.push({
    name: "recovery",
    score: recoveryScore,
    maxScore: baseWeight,
    label: recoveryLabel,
    description: recoveryDesc,
  });

  if (hasStress) {
    const stress = dailyStats!.stressLevel!;
    let stressScore = healthWeight;
    let stressLabel = "Низкий";
    let stressDesc = `Средний стресс: ${stress}`;

    if (stress >= 75) {
      stressScore = Math.round(healthWeight * 0.15);
      stressLabel = "Очень высокий";
      stressDesc = `Стресс ${stress} — организм сильно напряжён`;
    } else if (stress >= 50) {
      stressScore = Math.round(healthWeight * 0.4);
      stressLabel = "Высокий";
      stressDesc = `Стресс ${stress} — повышенная нагрузка на организм`;
    } else if (stress >= 35) {
      stressScore = Math.round(healthWeight * 0.7);
      stressLabel = "Средний";
      stressDesc = `Стресс ${stress} — умеренный уровень`;
    } else {
      stressDesc = `Стресс ${stress} — хороший уровень`;
    }

    factors.push({
      name: "stress",
      score: stressScore,
      maxScore: healthWeight,
      label: stressLabel,
      description: stressDesc,
    });
  }

  if (hasBodyBattery) {
    const bb = dailyStats!.bodyBattery!;
    let bbScore = healthWeight;
    let bbLabel = "Полная";
    let bbDesc = `Body Battery: ${bb}/100`;

    if (bb <= 15) {
      bbScore = Math.round(healthWeight * 0.1);
      bbLabel = "Истощена";
      bbDesc = `Body Battery ${bb} — энергия на исходе`;
    } else if (bb <= 30) {
      bbScore = Math.round(healthWeight * 0.3);
      bbLabel = "Низкая";
      bbDesc = `Body Battery ${bb} — мало энергии`;
    } else if (bb <= 50) {
      bbScore = Math.round(healthWeight * 0.6);
      bbLabel = "Средняя";
      bbDesc = `Body Battery ${bb} — умеренный уровень`;
    } else if (bb <= 75) {
      bbScore = Math.round(healthWeight * 0.85);
      bbLabel = "Хорошая";
      bbDesc = `Body Battery ${bb} — хороший заряд`;
    } else {
      bbDesc = `Body Battery ${bb} — отличный уровень`;
    }

    factors.push({
      name: "bodyBattery",
      score: bbScore,
      maxScore: healthWeight,
      label: bbLabel,
      description: bbDesc,
    });
  }

  if (hasSteps) {
    const steps = dailyStats!.steps!;
    let stepsScore = healthWeight;
    let stepsLabel = "Нормально";
    let stepsDesc = `${steps.toLocaleString("ru-RU")} шагов`;

    if (steps >= 25000) {
      stepsScore = Math.round(healthWeight * 0.3);
      stepsLabel = "Очень много";
      stepsDesc = `${steps.toLocaleString("ru-RU")} шагов — ноги устали`;
    } else if (steps >= 18000) {
      stepsScore = Math.round(healthWeight * 0.55);
      stepsLabel = "Много";
      stepsDesc = `${steps.toLocaleString("ru-RU")} шагов — высокая бытовая нагрузка`;
    } else if (steps >= 12000) {
      stepsScore = Math.round(healthWeight * 0.8);
      stepsLabel = "Выше среднего";
      stepsDesc = `${steps.toLocaleString("ru-RU")} шагов`;
    } else if (steps < 2000) {
      stepsScore = healthWeight;
      stepsLabel = "Мало";
      stepsDesc = `${steps.toLocaleString("ru-RU")} шагов — низкая активность`;
    } else {
      stepsDesc = `${steps.toLocaleString("ru-RU")} шагов`;
    }

    factors.push({
      name: "steps",
      score: stepsScore,
      maxScore: healthWeight,
      label: stepsLabel,
      description: stepsDesc,
    });
  }

  const totalRawScore = factors.reduce((sum, f) => sum + f.score, 0);
  const clampedScore = Math.max(0, Math.min(100, Math.round((totalRawScore / totalMaxRaw) * 100)));

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

  return {
    score: clampedScore,
    level,
    label,
    factors,
    summary,
    dailyStats: dailyStats ? {
      stressLevel: dailyStats.stressLevel,
      bodyBattery: dailyStats.bodyBattery,
      steps: dailyStats.steps,
    } : undefined,
  };
}
