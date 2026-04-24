'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useSfx } from './SfxProvider';

interface Messages {
  loading?: string;
  success?: string | ((result: unknown) => string);
  error?:   string | ((err: Error)    => string);
  loadingDescription?: string;
}

interface Options {
  silent?: boolean;
  dismissOnSuccess?: boolean;
}

export function useFeedbackAction<TArgs extends unknown[], TResult>(
  messages: Messages,
  fn: (...args: TArgs) => Promise<TResult>,
  options: Options = {},
) {
  const { play } = useSfx();
  const [loading, setLoading] = useState(false);

  const run = useCallback(
    async (...args: TArgs): Promise<TResult | null> => {
      setLoading(true);
      const id = messages.loading
        ? toast.loading(messages.loading, { description: messages.loadingDescription })
        : undefined;
      try {
        const result = await fn(...args);
        const msg = typeof messages.success === 'function' ? messages.success(result) : messages.success;
        if (!options.silent) {
          if (id !== undefined) {
            if (msg) toast.success(msg, { id });
            else toast.dismiss(id);
          } else if (msg) {
            toast.success(msg);
          }
        }
        play('success');
        return result;
      } catch (e) {
        const err = e as Error;
        const msg = typeof messages.error === 'function' ? messages.error(err) : (messages.error ?? err.message);
        if (!options.silent) {
          if (id !== undefined) toast.error(msg, { id, description: err.message });
          else toast.error(msg, { description: err.message });
        }
        play('error');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [fn, messages, play, options.silent],
  );

  return { run, loading };
}
