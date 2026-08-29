import { useState, useEffect, useCallback, useRef } from 'react';

export function useSSE(url, options = {}) {
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const eventSourceRef = useRef(null);
  const maxEvents = options.maxEvents || 50;

  const connect = useCallback(() => {
    const token = localStorage.getItem('ieps_token');
    if (!token) return;

    // EventSource doesn't support custom headers, so we'll use fetch-based SSE
    const abortController = new AbortController();

    fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'text/event-stream',
      },
      signal: abortController.signal,
    }).then(async (response) => {
      if (!response.ok) {
        setError('SSE connection failed');
        return;
      }

      setConnected(true);
      setError(null);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type !== 'heartbeat' && data.type !== 'connected') {
                setEvents((prev) => [data, ...prev].slice(0, maxEvents));
              }
            } catch {}
          }
        }
      }
    }).catch((err) => {
      if (err.name !== 'AbortError') {
        setError(err.message);
        setConnected(false);
      }
    });

    eventSourceRef.current = abortController;
  }, [url, maxEvents]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.abort();
      eventSourceRef.current = null;
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  return { events, connected, error, reconnect: connect };
}
