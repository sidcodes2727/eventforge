import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Filter, Download, RefreshCw, Copy, Play, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEvents } from '@/hooks/useEvents';
import { getStatusColor, getPriorityColor, formatDate, truncate } from '@/lib/utils';
import api from '@/lib/api';

const statuses = ['', 'pending', 'processing', 'processed', 'failed', 'dead'];
const types = ['', 'payment.success', 'payment.failed', 'order.placed', 'order.cancelled', 'user.signup', 'notification.send', 'webhook.received'];
const priorities = ['', 'low', 'medium', 'high', 'critical'];

export default function Events() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ page: 1, limit: 25, status: '', type: '', priority: '', search: '' });
  const { events, total, loading, pagination, refresh } = useEvents(filters, 5000);

  const handleFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleExport = async () => {
    try {
      const token = localStorage.getItem('ieps_token');
      const res = await fetch(`/api/v1/events/export?status=${filters.status}&type=${filters.type}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `events-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const handleReplay = async (eventId, e) => {
    e.stopPropagation();
    try {
      await api.replayEvent(eventId);
      refresh();
    } catch (err) {
      console.error('Replay failed:', err);
    }
  };

  const copyKey = (key, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(key);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Events</h1>
          <p className="text-sm text-muted-foreground mt-1">{total} total events</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} className="p-2 rounded-lg bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by idempotency key..."
              value={filters.search}
              onChange={(e) => handleFilter('search', e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-muted/50 border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <select value={filters.status} onChange={(e) => handleFilter('status', e.target.value)} className="px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
            <option value="">All Status</option>
            {statuses.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filters.type} onChange={(e) => handleFilter('type', e.target.value)} className="px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
            <option value="">All Types</option>
            {types.filter(Boolean).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filters.priority} onChange={(e) => handleFilter('priority', e.target.value)} className="px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
            <option value="">All Priority</option>
            {priorities.filter(Boolean).map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                {['Type', 'Status', 'Priority', 'Idempotency Key', 'Retry', 'Processing Time', 'Created', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="skeleton h-4 w-20 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">No events found</td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr
                    key={event.id}
                    onClick={() => navigate(`/events/${event.id}`)}
                    className="hover:bg-muted/20 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-foreground">{event.type}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${getStatusColor(event.status)}`}>{event.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${getPriorityColor(event.priority)}`}>{event.priority}</span>
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs font-mono text-muted-foreground">{truncate(event.idempotencyKey, 20)}</code>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-muted-foreground">{event.retryCount}/{event.maxRetries || 5}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-muted-foreground font-mono">{event.processingTimeMs ? `${event.processingTimeMs}ms` : '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-muted-foreground">{formatDate(event.createdAt)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={(e) => copyKey(event.idempotencyKey, e)} className="p-1.5 rounded-md hover:bg-muted transition-colors" title="Copy Key">
                          <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <button onClick={(e) => handleReplay(event.id, e)} className="p-1.5 rounded-md hover:bg-muted transition-colors" title="Replay">
                          <Play className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-border/50">
            <p className="text-xs text-muted-foreground">
              Showing {(filters.page - 1) * filters.limit + 1}–{Math.min(filters.page * filters.limit, total)} of {total}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setFilters((prev) => ({ ...prev, page: prev.page - 1 }))}
                disabled={!pagination.hasPrev}
                className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 text-xs text-muted-foreground">
                Page {filters.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
                disabled={!pagination.hasNext}
                className="p-1.5 rounded-md hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
