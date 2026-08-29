import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';

export function useEvents(filters = {}, refreshInterval = null) {
  const [events, setEvents] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState(null);

  const fetchEvents = useCallback(async () => {
    try {
      setError(null);
      const res = await api.getEvents(filters);
      setEvents(res.data || []);
      setTotal(res.pagination?.total || 0);
      setPagination(res.pagination || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetchEvents();

    if (refreshInterval) {
      const interval = setInterval(fetchEvents, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchEvents, refreshInterval]);

  return { events, total, loading, error, pagination, refresh: fetchEvents };
}

export function useEvent(id) {
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;

    api.getEvent(id)
      .then((res) => setEvent(res.data.event))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  return { event, loading, error };
}
