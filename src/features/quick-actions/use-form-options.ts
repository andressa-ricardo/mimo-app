import { useCallback, useEffect, useState } from 'react';

import {
  createCategory,
  createPaymentMethod,
  listCategories,
  listPaymentMethods,
} from '@/database/repositories/categories-repository';
import type { Category, CategoryScope, PaymentMethod, PaymentMethodDetails } from '@/types/categories';

export type QuickSheetProps = {
  onClose: () => void;
  onSaved: (message: string) => void;
  visible: boolean;
};

export function useCategories(scope: CategoryScope) {
  const [loaded, setLoaded] = useState<{ scope: CategoryScope; items: Category[] } | null>(null);

  useEffect(() => {
    let active = true;
    listCategories(scope)
      .then((items) => {
        if (active) setLoaded({ scope, items });
      })
      .catch((error: unknown) => console.warn('Falha ao carregar categorias.', error));
    return () => {
      active = false;
    };
  }, [scope]);

  const addCategory = useCallback(
    async (name: string) => {
      const category = await createCategory(scope, name);
      setLoaded((current) => {
        const items = current?.scope === scope ? current.items : [];
        return {
          scope,
          items: items.some((item) => item.id === category.id) ? items : [...items, category],
        };
      });
      return category;
    },
    [scope],
  );

  return { categories: loaded?.scope === scope ? loaded.items : [], addCategory };
}

export function usePaymentMethods() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);

  useEffect(() => {
    let active = true;
    listPaymentMethods()
      .then((items) => {
        if (active) setMethods(items);
      })
      .catch((error: unknown) => console.warn('Falha ao carregar formas de pagamento.', error));
    return () => {
      active = false;
    };
  }, []);

  const addMethod = useCallback(async (name: string, details?: Partial<PaymentMethodDetails>) => {
    const method = await createPaymentMethod(name, details);
    setMethods((current) => (current.some((item) => item.id === method.id) ? current : [...current, method]));
    return method;
  }, []);

  return { methods, addMethod };
}

/** Ticking clock for validations that depend on "now" without impure renders. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export const priorityOptions = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
] as const;

export function describeError(error: unknown, fallback: string): string {
  console.error(fallback, error);
  return fallback;
}
