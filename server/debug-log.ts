export interface DebugLogEntry {
  id: number;
  timestamp: string;
  category: string;
  message: string;
  data?: any;
}

let logs: DebugLogEntry[] = [];
let nextId = 1;
const MAX_LOGS = 500;

export function debugLog(category: string, message: string, data?: any): void {
  const entry: DebugLogEntry = {
    id: nextId++,
    timestamp: new Date().toISOString(),
    category,
    message,
    data,
  };
  logs.push(entry);
  if (logs.length > MAX_LOGS) {
    logs = logs.slice(-MAX_LOGS);
  }
  console.log(`[${category}] ${message}`, data ? JSON.stringify(data) : "");
}

export function getDebugLogs(): DebugLogEntry[] {
  return [...logs].reverse();
}

export function clearDebugLogs(): void {
  logs = [];
  nextId = 1;
}
