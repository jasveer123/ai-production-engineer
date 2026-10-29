'use client';

import { useState } from 'react';
import { ApiError, errorMessage } from '@/lib/api';

export function useAuthAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setPending(true);
    setError(null);
    setFieldErrors({});
    try {
      return await fn();
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.code === 'validation_failed' &&
        Array.isArray(err.details)
      ) {
        const fields: Record<string, string> = {};
        for (const issue of err.details as { path?: (string | number)[]; message?: string }[]) {
          const key = String(issue.path?.[0] ?? '');
          if (key && !fields[key]) fields[key] = issue.message ?? 'Invalid value';
        }
        setFieldErrors(fields);
        if (Object.keys(fields).length === 0) setError(err.message);
      } else setError(errorMessage(err));
      return undefined;
    } finally {
      setPending(false);
    }
  }

  return { pending, error, fieldErrors, run, setError };
}
