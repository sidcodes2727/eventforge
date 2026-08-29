import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Play, Trash2, RefreshCw, CheckSquare, Square, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { getStatusColor, formatDate, truncate } from '@/lib/utils';

export default function DeadLetterQueue() {
  const [events, setEvents] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [replayingId, setReplayingId] = useState(null);
  const [bulkReplaying, setBulkReplaying] = useState(false);

  const fetchDeadEvents = async () => {
    try {
      const res = await api.getDeadEvents({ limit: 50 });
      setEvents(res.data || []);
      setTotal(res.pagination?.total || 0);
    } catch (err) {
      console.error('Failed to fetch DLQ:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDeadEvents(); }, []);

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === events.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(events.map((e) => e.id)));
    }
  };

  const handleReplay = async (id) => {
    setReplayingId(id);
    try {
      await api.replayDeadEvent(id);
      await fetchDeadEvents();
      selected.delete(id);
      setSelected(new Set(selected));
    } catch (err) {
      console.error('Replay failed:', err);
    } finally {
      setReplayingId(null);
    }
  };

  const handleBulkReplay = async () => {
    if (selected.size === 0) return;
    setBulkReplaying(true);
    try {
      await api.bulkReplayDeadEvents([...selected]);
      setSelected(new Set());
      await fetchDeadEvents();
    } catch (err) {
      console.error('Bulk replay failed:', err);
    } finally {
      setBulkReplaying(false);
    }
  };

  const handleDiscard = async (id) => {
    if (!confirm('Permanently discard this dead event?')) return;
    try {
      await api.discardDeadEvent(id);
      await fetchDeadEvents();
    } catch (err) {
      console.error('Discard failed:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-red-500/10">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Dead Letter Queue</h1>
            <p className="text-sm text-red-400/80 mt-0.5">{total} events require attention</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchDeadEvents} className="p-2 rounded-lg bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          {selected.size > 0 && (
            <button
              onClick={handleBulkReplay}
              disabled={bulkReplaying}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm hover:bg-primary-600 transition-colors disabled:opacity-50"
            >
              {bulkReplaying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Replay {selected.size} Selected
            </button>
          )}
        </div>
      </div>

      {/* Events Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card p-5">
              <div className="skeleton h-4 w-48 mb-3 rounded" />
              <div className="skeleton h-3 w-full mb-2 rounded" />
              <div className="skeleton h-3 w-2/3 rounded" />
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-12 text-center">
          <AlertTriangle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground">No Dead Events</h2>
          <p className="text-muted-foreground mt-1">All events are being processed successfully!</p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {/* Select all */}
          <div className="flex items-center gap-2 px-2">
            <button onClick={toggleAll} className="text-muted-foreground hover:text-foreground transition-colors">
              {selected.size === events.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            </button>
            <span className="text-xs text-muted-foreground">
              {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
            </span>
          </div>

          {events.map((event, index) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="glass-card p-5 border-red-500/10 hover:border-red-500/20 transition-colors"
            >
              <div className="flex items-start gap-4">
                <button onClick={() => toggleSelect(event.id)} className="mt-1 text-muted-foreground hover:text-foreground transition-colors">
                  {selected.has(event.id) ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-semibold text-foreground">{event.type}</span>
                    <span className="badge badge-dead">dead</span>
                    <span className="text-xs text-muted-foreground font-mono">{truncate(event.id, 16)}</span>
                  </div>

                  {/* Error message */}
                  <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10 mb-3">
                    <p className="text-sm text-red-300">{event.errorMessage || 'Unknown error'}</p>
                  </div>

                  {/* Retry history */}
                  {event.retryLogs && event.retryLogs.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">Retry History ({event.retryLogs.length} attempts)</p>
                      <div className="space-y-1">
                        {event.retryLogs.map((log, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-mono">[#{log.attemptNumber}]</span>
                            <span>{formatDate(log.attemptedAt)}</span>
                            <span className="text-red-400 truncate">{log.error}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">Created: {formatDate(event.createdAt)}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleReplay(event.id)}
                    disabled={replayingId === event.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary-400 hover:bg-primary/20 text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    {replayingId === event.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                    Replay
                  </button>
                  <button
                    onClick={() => handleDiscard(event.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-medium transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Discard
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
