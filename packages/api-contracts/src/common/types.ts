export type Uuid = string;
export type IsoTimestamp = string;
export type Labels = Record<string, string>;
export type Attributes = Record<string, unknown>;

export type ValueOf<T extends readonly unknown[]> = T[number];

export type ConnectionStatus = 'pending' | 'connected' | 'error' | 'disconnected';
export type RepositorySelection = 'all' | 'selected';

export type WithSecret<T, K extends string, V = string> = T & Record<K, V>;

export interface SetupOutcome {
  done: string[];
  todo: string[];
}
