export type LogFn = (message: string, ...args: unknown[]) => void;

export function createScopedLogger(scope: string): LogFn {
  return (message: string, ...args: unknown[]) => {
    console.log(`[${scope}] ${message}`, ...args);
  };
}

