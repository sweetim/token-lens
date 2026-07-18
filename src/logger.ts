type LogLevel = "info" | "warn" | "error";

type LogSink = (level: LogLevel, message: string, error?: unknown) => void;

let activeSink: LogSink = () => {};

function setLogSink(nextSink: LogSink): void {
  activeSink = nextSink;
}

function formatLogMessage(message: string, error?: unknown): string {
  if (error === undefined) {
    return message;
  }
  if (error instanceof Error) {
    return `${message}: ${error.stack ?? error.message}`;
  }
  return `${message}: ${String(error)}`;
}

const logger = {
  info(message: string): void {
    activeSink("info", message);
  },
  warn(message: string, error?: unknown): void {
    activeSink("warn", message, error);
  },
  error(message: string, error?: unknown): void {
    activeSink("error", message, error);
  },
};

export { logger, setLogSink, formatLogMessage };
