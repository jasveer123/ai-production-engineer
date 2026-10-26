/** One SSE `change` message: what changed, never the data itself. Clients re-read via the API. */
export interface LiveChange {
  table: string;
  incidentId: string | null;
}
