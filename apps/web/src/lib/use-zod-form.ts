import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type UseFormProps } from 'react-hook-form';
import type { z } from 'zod';

export function useZodForm<S extends z.ZodTypeAny>(
  schema: S,
  options: Omit<UseFormProps<z.input<S>, unknown, z.output<S>>, 'resolver'> = {},
) {
  return useForm<z.input<S>, unknown, z.output<S>>({
    mode: 'onSubmit',
    ...options,
    resolver: zodResolver(schema),
  });
}
