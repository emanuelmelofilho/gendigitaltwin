import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

/** Carrega um recurso da API e expõe recarga e erro. */
export function useResource(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const reload = useCallback(async () => {
    try {
      setData(await api(path));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [path]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, error, reload, setData };
}

/** Informações declaradas e validadas: valores únicos por chave e itens de lista. */
export function useDeclared() {
  const { data: infos, error, reload } = useResource('/informations?status=confirmada,corrigida');

  const single = useCallback(
    (category, key) => infos?.filter((i) => i.category === category && i.key === key)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0],
    [infos],
  );
  const items = useCallback((category) => infos?.filter((i) => i.category === category) ?? [], [infos]);

  const saveSingle = async (category, key, value) => {
    await api('/informations/declared', { method: 'PUT', body: { category, key, value } });
    await reload();
  };
  const addItem = async (category, key, value) => {
    await api('/informations', { method: 'POST', body: { category, key, value } });
    await reload();
  };
  const removeItem = async (id) => {
    await api(`/informations/${id}`, { method: 'DELETE' });
    await reload();
  };

  return { loaded: infos !== null, error, single, items, saveSingle, addItem, removeItem, reload };
}
