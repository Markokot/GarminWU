import { parseAiResponse, buildWeekCalendar } from "./ai";
import { buildCalendarContext } from "./routes";
import { encrypt, decrypt } from "./crypto";

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  message: string;
  duration: number;
}

interface TestSuiteResult {
  suite: string;
  results: TestResult[];
  passed: number;
  failed: number;
  duration: number;
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEqual(actual: any, expected: any, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: ожидалось "${expected}", получено "${actual}"`);
  }
}

function assertIncludes(str: string, substr: string, label: string): void {
  if (!str.includes(substr)) {
    throw new Error(`${label}: строка не содержит "${substr}"`);
  }
}

async function runTest(suite: string, name: string, fn: () => Promise<void> | void): Promise<TestResult> {
  const start = Date.now();
  try {
    await fn();
    return { suite, name, passed: true, message: "OK", duration: Date.now() - start };
  } catch (e: any) {
    return { suite, name, passed: false, message: e.message || String(e), duration: Date.now() - start };
  }
}

function testParseAiResponse(): Promise<TestResult[]> {
  const tests: Promise<TestResult>[] = [];

  tests.push(runTest("AI Парсинг", "Извлечение workout_json", () => {
    const text = `Вот тренировка:\n\`\`\`workout_json\n{"name":"Бег","sportType":"running","steps":[{"stepId":1,"stepOrder":1,"stepType":"warmup","durationType":"time","durationValue":600,"targetType":"heart.rate.zone","targetValueLow":100,"targetValueHigh":120,"intensity":"active"}]}\n\`\`\``;
    const result = parseAiResponse(text);
    assert(result.workout !== null, "workout должен быть не null");
    assertEqual(result.workout!.name, "Бег", "название тренировки");
    assertEqual(result.workout!.sportType, "running", "тип спорта");
    assert(result.workout!.steps.length === 1, "должен быть 1 шаг");
  }));

  tests.push(runTest("AI Парсинг", "Извлечение training_plan_json", () => {
    const text = `План:\n\`\`\`training_plan_json\n{"planTitle":"План 4 нед","planDescription":"Описание","workouts":[{"name":"Бег 1","sportType":"running","scheduledDate":"2026-02-25","steps":[{"stepId":1,"stepOrder":1,"stepType":"warmup","durationType":"time","durationValue":600,"targetType":"no.target","targetValueLow":null,"targetValueHigh":null,"intensity":"active"}]}]}\n\`\`\``;
    const result = parseAiResponse(text);
    assert(result.workouts !== null, "workouts должен быть не null");
    assert(result.workouts!.length === 1, "должна быть 1 тренировка");
    assertEqual(result.planTitle, "План 4 нед", "название плана");
  }));

  tests.push(runTest("AI Парсинг", "Извлечение reschedule_json", () => {
    const text = `Переношу:\n\`\`\`reschedule_json\n{"workoutId":"123456","currentDate":"2026-02-21","newDate":"2026-02-23","reason":"по просьбе"}\n\`\`\``;
    const result = parseAiResponse(text);
    assert(result.reschedule !== undefined, "reschedule должен быть");
    assertEqual(result.reschedule!.workoutId, "123456", "workoutId");
    assertEqual(result.reschedule!.currentDate, "2026-02-21", "currentDate");
    assertEqual(result.reschedule!.newDate, "2026-02-23", "newDate");
  }));

  tests.push(runTest("AI Парсинг", "Текст без JSON блоков", () => {
    const text = "Привет! Как дела? Давай потренируемся.";
    const result = parseAiResponse(text);
    assert(result.workout === null, "workout должен быть null");
    assert(result.workouts === null, "workouts должен быть null");
    assert(result.reschedule === undefined, "reschedule должен быть undefined");
    assert(result.text.length > 0, "текст должен быть непустым");
  }));

  tests.push(runTest("AI Парсинг", "Невалидный JSON в workout_json", () => {
    const text = `\`\`\`workout_json\n{invalid json}\n\`\`\``;
    const result = parseAiResponse(text);
    assert(result.workout === null, "workout должен быть null при невалидном JSON");
  }));

  tests.push(runTest("AI Парсинг", "scheduledDate в тренировке", () => {
    const text = `\`\`\`workout_json\n{"name":"Бег","sportType":"running","scheduledDate":"2026-03-01","steps":[{"stepId":1,"stepOrder":1,"stepType":"warmup","durationType":"time","durationValue":600,"targetType":"no.target","targetValueLow":null,"targetValueHigh":null,"intensity":"active"}]}\n\`\`\``;
    const result = parseAiResponse(text);
    assert(result.workout !== null, "workout должен быть не null");
    assertEqual(result.workout!.scheduledDate, "2026-03-01", "scheduledDate");
  }));

  return Promise.all(tests);
}

function testDateCalculations(): Promise<TestResult[]> {
  const getDayOfWeekForDate = (dateStr: string): string => {
    const days = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
    const d = new Date(dateStr + "T12:00:00Z");
    return days[d.getUTCDay()];
  };
  const tests: Promise<TestResult>[] = [];

  tests.push(runTest("Даты", "buildWeekCalendar содержит СЕГОДНЯ", () => {
    const cal = buildWeekCalendar("2026-02-21");
    assertIncludes(cal, "2026-02-21", "должна содержать сегодняшнюю дату");
    assertIncludes(cal, "СЕГОДНЯ", "должна содержать метку СЕГОДНЯ");
  }));

  tests.push(runTest("Даты", "buildWeekCalendar содержит завтра", () => {
    const cal = buildWeekCalendar("2026-02-21");
    assertIncludes(cal, "2026-02-22", "должна содержать завтрашнюю дату");
    assertIncludes(cal, "завтра", "должна содержать метку завтра");
  }));

  tests.push(runTest("Даты", "buildWeekCalendar 14 дней", () => {
    const cal = buildWeekCalendar("2026-02-21");
    assertIncludes(cal, "2026-03-06", "должна содержать дату через 13 дней");
  }));

  tests.push(runTest("Даты", "Дни недели правильные (21 фев 2026 = суббота)", () => {
    const cal = buildWeekCalendar("2026-02-21");
    assertIncludes(cal, "2026-02-21(сб", "21 фев должен быть сб");
    assertIncludes(cal, "2026-02-22(вс", "22 фев должен быть вс");
    assertIncludes(cal, "2026-02-23(пн", "23 фев должен быть пн");
  }));

  tests.push(runTest("Даты", "Переход через конец месяца", () => {
    const cal = buildWeekCalendar("2026-02-25");
    assertIncludes(cal, "2026-03-01", "должен перейти на март");
  }));

  tests.push(runTest("Даты", "Переход через конец года", () => {
    const cal = buildWeekCalendar("2026-12-28");
    assertIncludes(cal, "2027-01-01", "должен перейти на январь 2027");
  }));

  tests.push(runTest("Даты", "getDayOfWeekForDate суббота", () => {
    const dow = getDayOfWeekForDate("2026-02-21");
    assertEqual(dow, "суббота", "21 фев 2026");
  }));

  tests.push(runTest("Даты", "getDayOfWeekForDate воскресенье", () => {
    const dow = getDayOfWeekForDate("2026-02-22");
    assertEqual(dow, "воскресенье", "22 фев 2026");
  }));

  tests.push(runTest("Даты", "getDayOfWeekForDate понедельник", () => {
    const dow = getDayOfWeekForDate("2026-02-23");
    assertEqual(dow, "понедельник", "23 фев 2026");
  }));

  return Promise.all(tests);
}


function testEncryption(): Promise<TestResult[]> {
  const tests: Promise<TestResult>[] = [];

  tests.push(runTest("Шифрование", "encrypt/decrypt roundtrip", () => {
    const original = "MySecretPassword123!@#";
    const encrypted = encrypt(original);
    assert(encrypted !== original, "зашифрованное должно отличаться от оригинала");
    const decrypted = decrypt(encrypted);
    assertEqual(decrypted, original, "расшифрованное");
  }));

  tests.push(runTest("Шифрование", "Разные тексты дают разные шифры", () => {
    const enc1 = encrypt("password1");
    const enc2 = encrypt("password2");
    assert(enc1 !== enc2, "шифры должны различаться");
  }));

  tests.push(runTest("Шифрование", "Пустая строка", () => {
    const encrypted = encrypt("");
    const decrypted = decrypt(encrypted);
    assertEqual(decrypted, "", "пустая строка");
  }));

  tests.push(runTest("Шифрование", "Кириллица", () => {
    const original = "ПарольНаРусском123";
    const encrypted = encrypt(original);
    const decrypted = decrypt(encrypted);
    assertEqual(decrypted, original, "кириллица");
  }));

  tests.push(runTest("Шифрование", "Длинная строка (API ключ)", () => {
    const original = "sk-1234567890abcdefghijklmnopqrstuvwxyz-ABCDEFGHIJKLMNOPQRSTUVWXYZ-0123456789";
    const encrypted = encrypt(original);
    const decrypted = decrypt(encrypted);
    assertEqual(decrypted, original, "длинный ключ");
  }));

  return Promise.all(tests);
}

function testCalendarContext(): Promise<TestResult[]> {
  const tests: Promise<TestResult>[] = [];

  tests.push(runTest("Календарь", "buildCalendarContext с тренировками", () => {
    const calendar = {
      calendarItems: [
        { itemType: "workout", date: "2026-02-22", title: "Лёгкий бег", workoutId: 123 },
        { itemType: "workout", date: "2026-02-24", title: "Интервалы", workoutId: 456 },
        { itemType: "activity", date: "2026-02-20", title: "Активность" },
      ],
    };
    const now = new Date("2026-02-21T12:00:00Z");
    const ctx = buildCalendarContext(calendar, now);
    assertIncludes(ctx, "ЗАПЛАНИРОВАННЫЕ ТРЕНИРОВКИ", "заголовок");
    assertIncludes(ctx, "Лёгкий бег", "название тренировки 1");
    assertIncludes(ctx, "Интервалы", "название тренировки 2");
    assertIncludes(ctx, "ID:123", "workoutId 1");
    assertIncludes(ctx, "ID:456", "workoutId 2");
  }));

  tests.push(runTest("Календарь", "Пустой календарь", () => {
    const calendar = { calendarItems: [] };
    const ctx = buildCalendarContext(calendar, new Date());
    assertEqual(ctx, "", "пустой контекст");
  }));

  tests.push(runTest("Календарь", "Сортировка по дате", () => {
    const calendar = {
      calendarItems: [
        { itemType: "workout", date: "2026-02-25", title: "Позже", workoutId: 2 },
        { itemType: "workout", date: "2026-02-22", title: "Раньше", workoutId: 1 },
      ],
    };
    const ctx = buildCalendarContext(calendar, new Date("2026-02-21T12:00:00Z"));
    const idx1 = ctx.indexOf("Раньше");
    const idx2 = ctx.indexOf("Позже");
    assert(idx1 < idx2, "Раньше должно быть перед Позже");
  }));

  tests.push(runTest("Календарь", "Метка СЕГОДНЯ", () => {
    const calendar = {
      calendarItems: [
        { itemType: "workout", date: "2026-02-21", title: "Сегодняшняя", workoutId: 1 },
      ],
    };
    const ctx = buildCalendarContext(calendar, new Date("2026-02-21T12:00:00Z"));
    assertIncludes(ctx, "(СЕГОДНЯ)", "метка сегодня");
  }));

  tests.push(runTest("Календарь", "Фильтрация не-тренировок", () => {
    const calendar = {
      calendarItems: [
        { itemType: "activity", date: "2026-02-22", title: "Не тренировка" },
        { itemType: "workout", date: "2026-02-22", title: "Тренировка", workoutId: 1 },
      ],
    };
    const ctx = buildCalendarContext(calendar, new Date("2026-02-21T12:00:00Z"));
    assert(!ctx.includes("Не тренировка"), "активности не должны быть в контексте");
    assertIncludes(ctx, "Тренировка", "тренировка должна быть");
  }));

  return Promise.all(tests);
}


async function testDeepSeekDates(): Promise<TestResult[]> {
  const OpenAI = (await import("openai")).default;
  const tests: TestResult[] = [];

  if (!process.env.DEEPSEEK_API_KEY) {
    tests.push({
      suite: "DeepSeek даты",
      name: "API ключ не настроен",
      passed: false,
      message: "DEEPSEEK_API_KEY не установлен — тесты AI пропущены",
      duration: 0,
    });
    return tests;
  }

  const client = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com",
  });

  const dateTests = [
    {
      name: "Завтра от конкретной даты",
      today: "2026-02-21",
      dow: "суббота",
      userMessage: "Создай тренировку на завтра",
      expectedDate: "2026-02-22",
      checkFn: (text: string) => text.includes("2026-02-22") || text.includes("22 февраля") || text.includes("22.02"),
    },
    {
      name: "Следующий понедельник",
      today: "2026-02-21",
      dow: "суббота",
      userMessage: "Создай тренировку на понедельник",
      expectedDate: "2026-02-23",
      checkFn: (text: string) => text.includes("2026-02-23") || text.includes("23 февраля") || text.includes("23.02"),
    },
    {
      name: "Следующая суббота (не сегодня)",
      today: "2026-02-21",
      dow: "суббота",
      userMessage: "Создай тренировку на следующую субботу",
      expectedDate: "2026-02-28",
      checkFn: (text: string) => text.includes("2026-02-28") || text.includes("28 февраля") || text.includes("28.02"),
    },
  ];

  for (const dt of dateTests) {
    const weekCal = buildWeekCalendar(dt.today);

    const start = Date.now();
    try {
      const resp = await client.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: `Ты помощник. Текущая дата: ${dt.today} (${dt.dow}). Когда пользователь упоминает дату — вычисляй от ${dt.today}. Сверяйся с мини-календарём. Ответь КОРОТКО: укажи вычисленную дату в формате YYYY-MM-DD и день недели.`,
          },
          {
            role: "user",
            content: `[Сегодня: ${dt.today}, ${dt.dow}. ${weekCal}]\n${dt.userMessage}`,
          },
        ],
        temperature: 0,
        max_tokens: 200,
      });

      const answer = resp.choices[0]?.message?.content || "";
      const passed = dt.checkFn(answer);
      tests.push({
        suite: "DeepSeek даты",
        name: dt.name,
        passed,
        message: passed
          ? `OK: ожидалось ${dt.expectedDate}, ответ: "${answer.substring(0, 100)}"`
          : `FAIL: ожидалось ${dt.expectedDate}, ответ: "${answer.substring(0, 150)}"`,
        duration: Date.now() - start,
      });
    } catch (e: any) {
      tests.push({
        suite: "DeepSeek даты",
        name: dt.name,
        passed: false,
        message: `API ошибка: ${e.message}`,
        duration: Date.now() - start,
      });
    }
  }

  return tests;
}

export async function runAllTests(includeLive: boolean = false): Promise<{ suites: TestSuiteResult[]; totalPassed: number; totalFailed: number; totalDuration: number }> {
  const allResults: TestResult[] = [];

  const [parsing, dates, encryption, calendar] = await Promise.all([
    testParseAiResponse(),
    testDateCalculations(),
    testEncryption(),
    testCalendarContext(),
  ]);

  allResults.push(...parsing, ...dates, ...encryption, ...calendar);

  if (includeLive) {
    const deepseek = await testDeepSeekDates();
    allResults.push(...deepseek);
  }

  const suiteMap: Record<string, TestResult[]> = {};
  for (const r of allResults) {
    if (!suiteMap[r.suite]) suiteMap[r.suite] = [];
    suiteMap[r.suite].push(r);
  }

  const suites: TestSuiteResult[] = [];
  for (const suite of Object.keys(suiteMap)) {
    const results = suiteMap[suite];
    suites.push({
      suite,
      results,
      passed: results.filter((r: TestResult) => r.passed).length,
      failed: results.filter((r: TestResult) => !r.passed).length,
      duration: results.reduce((s: number, r: TestResult) => s + r.duration, 0),
    });
  }

  return {
    suites,
    totalPassed: allResults.filter((r) => r.passed).length,
    totalFailed: allResults.filter((r) => !r.passed).length,
    totalDuration: allResults.reduce((s, r) => s + r.duration, 0),
  };
}
