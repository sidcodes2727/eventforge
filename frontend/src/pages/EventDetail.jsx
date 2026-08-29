import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Copy, Play, Clock, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { useEvent } from '@/hooks/useEvents';
import { getStatusColor, getPriorityColor, formatDate } from '@/lib/utils';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import api from '@/lib/api';

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { event, loading, error } = useEvent(id);

  const handleReplay = async () => {
    try {
      await api.replayEvent(id);
      navigate('/events');
    } catch (err) {
      console.error('Replay failed:', err);
    }
  };

  const copyCurl = () => {
    if (!event) return;
    const curl = `curl -X POST http://localhost:3000/api/v1/events \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '${JSON.stringify({ type: event.type, payload: event.payload, priority: event.priority })}'`;
    navigator.clipboard.writeText(curl);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="text-center py-12">
        <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-foreground">Event not found</h2>
        <p className="text-muted-foreground mt-1">{error || 'The event does not exist.'}</p>
        <button onClick={() => navigate('/events')} className="mt-4 px-4 py-2 bg-primary text-white rounded-lg text-sm">
          Back to Events
        </button>
      </div>
    );
  }

  const statusIcons = {
    pending: Clock,
    processing: Clock,
    processed: CheckCircle2,
    failed: AlertCircle,
    dead: XCircle,
  };
  const StatusIcon = statusIcons[event.status] || Clock;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/events')} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-foreground">{event.type}</h1>
              <span className={`badge ${getStatusColor(event.status)}`}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {event.status}
              </span>
              <span className={`badge ${getPriorityColor(event.priority)}`}>{event.priority}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1 font-mono">{event.id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={copyCurl} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Copy className="w-4 h-4" />
            Copy cURL
          </button>
          <button onClick={handleReplay} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-white text-sm hover:bg-primary-600 transition-colors">
            <Play className="w-4 h-4" />
            Replay
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="col-span-2 space-y-6">
          {/* Event Details */}
          <div className="glass-card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Event Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Idempotency Key" value={event.idempotencyKey} mono />
              <InfoRow label="Type" value={event.type} />
              <InfoRow label="Status" value={event.status} />
              <InfoRow label="Priority" value={event.priority} />
              <InfoRow label="Retry Count" value={`${event.retryCount} / ${event.maxRetries}`} />
              <InfoRow label="Processing Time" value={event.processingTimeMs ? `${event.processingTimeMs}ms` : 'N/A'} />
              <InfoRow label="Created At" value={formatDate(event.createdAt)} />
              <InfoRow label="Processed At" value={event.processedAt ? formatDate(event.processedAt) : 'N/A'} />
            </div>
          </div>

          {/* Payload */}
          <div className="glass-card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Payload</h2>
            <div className="rounded-lg overflow-hidden">
              <SyntaxHighlighter language="json" style={oneDark} customStyle={{ margin: 0, borderRadius: '0.5rem', fontSize: '13px', background: '#141414' }}>
                {JSON.stringify(event.payload, null, 2)}
              </SyntaxHighlighter>
            </div>
          </div>

          {/* Metadata */}
          <div className="glass-card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Metadata</h2>
            <div className="rounded-lg overflow-hidden">
              <SyntaxHighlighter language="json" style={oneDark} customStyle={{ margin: 0, borderRadius: '0.5rem', fontSize: '13px', background: '#141414' }}>
                {JSON.stringify(event.metadata, null, 2)}
              </SyntaxHighlighter>
            </div>
          </div>

          {/* Error */}
          {event.errorMessage && (
            <div className="glass-card p-5 border-red-500/20">
              <h2 className="text-sm font-semibold text-red-400 mb-4">Error</h2>
              <p className="text-sm text-red-300 mb-3">{event.errorMessage}</p>
              {event.errorStack && (
                <pre className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg overflow-auto max-h-40 font-mono">
                  {event.errorStack}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Sidebar - Timeline */}
        <div className="space-y-6">
          <div className="glass-card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Retry Timeline</h2>
            {event.retryLogs && event.retryLogs.length > 0 ? (
              <div className="space-y-4">
                {event.retryLogs.map((log, i) => (
                  <div key={log.id || i} className="relative pl-6">
                    <div className="absolute left-0 top-1 w-3 h-3 rounded-full bg-red-500/20 border-2 border-red-500" />
                    {i < event.retryLogs.length - 1 && (
                      <div className="absolute left-[5px] top-4 w-0.5 h-full bg-border" />
                    )}
                    <div>
                      <p className="text-xs font-medium text-foreground">Attempt #{log.attemptNumber}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatDate(log.attemptedAt)}</p>
                      <p className="text-xs text-red-400 mt-1">{log.error}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No retry attempts</p>
            )}
          </div>

          {/* Status History */}
          <div className="glass-card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Status History</h2>
            <div className="space-y-3">
              <StatusTimelineItem status="Created" time={event.createdAt} active />
              {event.processingStartedAt && (
                <StatusTimelineItem status="Processing" time={event.processingStartedAt} active />
              )}
              {event.processedAt && (
                <StatusTimelineItem status="Processed" time={event.processedAt} active success />
              )}
              {event.status === 'failed' && (
                <StatusTimelineItem status="Failed" time={event.updatedAt} active error />
              )}
              {event.status === 'dead' && (
                <StatusTimelineItem status="Dead Letter" time={event.updatedAt} active error />
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function InfoRow({ label, value, mono }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm text-foreground mt-0.5 ${mono ? 'font-mono text-xs' : ''}`}>{value}</p>
    </div>
  );
}

function StatusTimelineItem({ status, time, success, error }) {
  const dotColor = success ? 'bg-green-500' : error ? 'bg-red-500' : 'bg-primary';
  return (
    <div className="flex items-start gap-3">
      <div className={`w-2 h-2 rounded-full ${dotColor} mt-1.5 flex-shrink-0`} />
      <div>
        <p className="text-xs font-medium text-foreground">{status}</p>
        <p className="text-xs text-muted-foreground">{formatDate(time)}</p>
      </div>
    </div>
  );
}
