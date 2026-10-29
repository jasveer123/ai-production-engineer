export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogLine = {
  id: string;
  at: string;
  level: LogLevel;
  service: string;
  message: string;
  traceId?: string;
  incidentId?: string;

  evidence?: boolean;
  source: 'OpenTelemetry' | 'Our package' | 'Server agent' | 'Grafana Loki';
};

export type LogQuery = {
  levels: LogLevel[];
  services: string[];
  traceIds: string[];
  text: string[];
};
