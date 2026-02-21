import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import {
  FlaskConical,
  Play,
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  Zap,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

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

interface AllTestResults {
  suites: TestSuiteResult[];
  totalPassed: number;
  totalFailed: number;
  totalDuration: number;
}

export default function AutoTestsPage() {
  const { user } = useAuth();
  const [results, setResults] = useState<AllTestResults | null>(null);
  const [running, setRunning] = useState(false);
  const [includeLive, setIncludeLive] = useState(false);
  const [expandedSuites, setExpandedSuites] = useState<Set<string>>(new Set());

  const toggleSuite = (suite: string) => {
    setExpandedSuites((prev) => {
      const next = new Set(prev);
      if (next.has(suite)) next.delete(suite);
      else next.add(suite);
      return next;
    });
  };

  const runTests = async () => {
    setRunning(true);
    setResults(null);
    try {
      const res = await apiRequest("POST", "/api/admin/run-tests", { includeLive });
      const data: AllTestResults = await res.json();
      setResults(data);
      const allSuites = new Set(data.suites.map((s) => s.suite));
      setExpandedSuites(allSuites);
    } catch (err: any) {
      setResults({
        suites: [],
        totalPassed: 0,
        totalFailed: 1,
        totalDuration: 0,
      });
    } finally {
      setRunning(false);
    }
  };

  if (!user || user.username !== "Andrey") {
    return (
      <div className="p-4 text-center text-muted-foreground">Доступ запрещён</div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-2">
        <FlaskConical className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold" data-testid="text-autotests-title">
          Автотесты
        </h1>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              onClick={runTests}
              disabled={running}
              data-testid="button-run-tests"
            >
              {running ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              {running ? "Выполняются..." : "Запустить тесты"}
            </Button>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={includeLive}
                onChange={(e) => setIncludeLive(e.target.checked)}
                className="rounded"
                data-testid="checkbox-include-live"
              />
              <Zap className="w-3.5 h-3.5 text-yellow-500" />
              DeepSeek тесты (live API)
            </label>
          </div>

          <p className="text-xs text-muted-foreground">
            Быстрые тесты: парсинг AI, вычисление дат, шифрование, контекст календаря.
            {includeLive && " + Live запросы к DeepSeek API для проверки понимания дат."}
          </p>
        </CardContent>
      </Card>

      {results && (
        <>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-lg font-bold text-green-600 dark:text-green-400" data-testid="text-total-passed">
                    {results.totalPassed}
                  </span>
                  <span className="text-sm text-muted-foreground">пройдено</span>
                </div>
                {results.totalFailed > 0 && (
                  <div className="flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-red-500" />
                    <span className="text-lg font-bold text-red-600 dark:text-red-400" data-testid="text-total-failed">
                      {results.totalFailed}
                    </span>
                    <span className="text-sm text-muted-foreground">провалено</span>
                  </div>
                )}
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  {results.totalDuration}ms
                </div>
                <Badge
                  variant={results.totalFailed === 0 ? "secondary" : "destructive"}
                  className="ml-auto"
                  data-testid="badge-overall-status"
                >
                  {results.totalFailed === 0 ? "ALL PASS" : `${results.totalFailed} FAIL`}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {results.suites.map((suite) => (
            <Card key={suite.suite} data-testid={`card-suite-${suite.suite}`}>
              <CardHeader
                className="pb-2 cursor-pointer"
                onClick={() => toggleSuite(suite.suite)}
              >
                <div className="flex items-center gap-2">
                  {expandedSuites.has(suite.suite) ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className="font-semibold text-sm">{suite.suite}</span>
                  <Badge
                    variant={suite.failed === 0 ? "secondary" : "destructive"}
                    className="text-xs ml-auto"
                  >
                    {suite.passed}/{suite.passed + suite.failed}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {suite.duration}ms
                  </span>
                </div>
              </CardHeader>
              {expandedSuites.has(suite.suite) && (
                <CardContent className="pt-0">
                  <div className="space-y-1.5">
                    {suite.results.map((test, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-2 text-sm p-2 rounded ${
                          test.passed
                            ? "bg-green-50 dark:bg-green-950/20"
                            : "bg-red-50 dark:bg-red-950/20"
                        }`}
                        data-testid={`test-result-${suite.suite}-${i}`}
                      >
                        {test.passed ? (
                          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">{test.name}</div>
                          <div
                            className={`text-xs mt-0.5 break-words ${
                              test.passed
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {test.message}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {test.duration}ms
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
