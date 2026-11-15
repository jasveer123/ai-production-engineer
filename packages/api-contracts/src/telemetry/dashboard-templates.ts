import type { CreateDashboardInput } from './metrics';

export interface DashboardTemplate {
  id: string;
  name: string;
  description: string;
  dashboard: CreateDashboardInput;
}

export const DASHBOARD_TEMPLATES: DashboardTemplate[] = [
  {
    id: 'http-service',
    name: 'HTTP service',
    description: 'Requests, 5xx responses and latency from OpenTelemetry http.server.duration.',
    dashboard: {
      name: 'HTTP service',
      variables: [
        { key: 'service', label: 'Service' },
        { key: 'http.route', label: 'Route' },
      ],
      widgets: [
        {
          id: 'req',
          title: 'Requests per second',
          metric: 'http.server.duration',
          agg: 'rate',
          chart: 'area',
        },
        {
          id: 'err',
          title: '5xx responses per second',
          metric: 'http.server.duration',
          agg: 'rate',
          filters: 'http.status_code=5*',
          chart: 'bar',
        },
        {
          id: 'status',
          title: 'Requests by status code',
          metric: 'http.server.duration',
          agg: 'rate',
          groupBy: 'http.status_code',
          chart: 'line',
        },
        {
          id: 'p95',
          title: 'Latency p95',
          metric: 'http.server.duration',
          agg: 'p95',
          chart: 'line',
        },
        {
          id: 'p50',
          title: 'Latency p50',
          metric: 'http.server.duration',
          agg: 'p50',
          chart: 'stat',
        },
      ],
    },
  },
  {
    id: 'host',
    name: 'Host metrics',
    description: 'CPU, memory, disk and network from the OpenTelemetry hostmetrics receiver.',
    dashboard: {
      name: 'Host metrics',
      variables: [{ key: 'host.name', label: 'Host' }],
      widgets: [
        {
          id: 'cpu',
          title: 'CPU utilization by state',
          metric: 'system.cpu.utilization',
          agg: 'avg',
          groupBy: 'state',
          chart: 'area',
        },
        {
          id: 'load',
          title: 'Load average (1m)',
          metric: 'system.cpu.load_average.1m',
          agg: 'avg',
          chart: 'stat',
        },
        {
          id: 'mem',
          title: 'Memory usage by state',
          metric: 'system.memory.usage',
          agg: 'avg',
          groupBy: 'state',
          chart: 'area',
        },
        {
          id: 'disk',
          title: 'Filesystem utilization',
          metric: 'system.filesystem.utilization',
          agg: 'max',
          groupBy: 'mountpoint',
          chart: 'table',
        },
        {
          id: 'net',
          title: 'Network bytes per second',
          metric: 'system.network.io',
          agg: 'rate',
          groupBy: 'direction',
          chart: 'line',
        },
      ],
    },
  },
];
