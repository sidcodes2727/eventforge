import { motion } from 'framer-motion';
import { Zap, ShieldCheck, CheckCircle2, Clock, ArrowUpRight, ArrowDownRight, Wifi, WifiOff } from 'lucide-react';
import { useMetrics } from '@/hooks/useMetrics';
import { useEvents } from '@/hooks/useEvents';
import { useSSE } from '@/hooks/useSSE';
import { getStatusColor, getPriorityColor, timeAgo, truncate, getEventTypeColor } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { useNavigate } from 'react-router-dom';

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

// ── Stat Card ──────────────────────────────────
function StatCard({ title, value, icon: Icon, subtitle, trend, trendUp, color = 'primary' }) {
  const colorClasses = {
    primary: 'from-primary-500/20 to-primary-600/5 border-primary/20',
    green: 'from-green-500/20 to-green-600/5 border-green-500/20',
    yellow: 'from-yellow-500/20 to-yellow-600/5 border-yellow-500/20',
    blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/20',
  };

  const iconColors = {
    primary: 'text-primary-400 bg-primary/10',
    green: 'text-green-400 bg-green-500/10',
    yellow: 'text-yellow-400 bg-yellow-500/10',
    blue: 'text-blue-400 bg-blue-500/10',
  };

  return (
    <motion.div variants={itemVariants} className={`glass-card p-5 bg-gradient-to-br ${colorClasses[color]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-3xl font-bold text-foreground mt-2 tracking-tight">
            {value?.toLocaleString() ?? '—'}
          </p>
          <div className="flex items-center gap-2 mt-2">
            {trend !== undefined && (
              <span className={`flex items-center text-xs font-medium ${trendUp ? 'text-green-400' : 'text-red-400'}`}>
                {trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {trend}
              </span>
            )}
            {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
          </div>
        </div>
        <div className={`p-2.5 rounded-xl ${iconColors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </motion.div>
  );
}

// ── Queue Depth ────────────────────────────────
function QueueDepthGauge({ queueDepth, systemHealth }) {
  const maxDepth = Math.max(queueDepth?.high || 0, queueDepth?.medium || 0, queueDepth?.low || 0, 1);
  const levels = [
    { label: 'HIGH', value: queueDepth?.high || 0, color: 'bg-orange-500' },
    { label: 'MED', value: queueDepth?.medium || 0, color: 'bg-blue-500' },
    { label: 'LOW', value: queueDepth?.low || 0, color: 'bg-gray-500' },
  ];

  const healthColors = {
    healthy: 'bg-green-500',
    degraded: 'bg-yellow-500',
    down: 'bg-red-500',
  };

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Queue Depth</h3>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${healthColors[systemHealth] || 'bg-gray-500'} animate-pulse-glow`} />
          <span className="text-xs text-muted-foreground capitalize">{systemHealth || 'unknown'}</span>
        </div>
      </div>
      <div className="space-y-3">
        {levels.map(({ label, value, color }) => (
          <div key={label}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground font-medium">{label}</span>
              <span className="text-foreground font-mono">{value}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: maxDepth > 0 ? `${(value / maxDepth) * 100}%` : '0%' }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className={`h-full ${color} rounded-full`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Event Feed Item ────────────────────────────
function EventFeedItem({ event, onClick }) {
  const typeColor = getEventTypeColor(event.type);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={() => onClick?.(event)}
      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/30 cursor-pointer transition-colors group"
    >
      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: typeColor }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{event.type}</span>
          <span className={`badge ${getStatusColor(event.status)}`}>{event.status}</span>
        </div>
        <p className="text-xs text-muted-foreground font-mono mt-0.5">
          {truncate(event.idempotencyKey, 24)}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <div className={`badge ${getPriorityColor(event.priority)}`}>{event.priority}</div>
        <p className="text-xs text-muted-foreground mt-1">{timeAgo(event.createdAt)}</p>
      </div>
    </motion.div>
  );
}

// ── Custom Tooltip ─────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-3 text-xs">
      <p className="text-muted-foreground mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }} className="font-medium">
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

// ── Charts ─────────────────────────────────────
const EVENT_TYPE_COLORS = ['#6366f1', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899'];

// ── Main Dashboard ─────────────────────────────
export default function Dashboard() {
  const { metrics, loading: metricsLoading } = useMetrics(3000);
  const { events, loading: eventsLoading } = useEvents({ limit: 15 }, 2000);
  const { events: sseEvents, connected } = useSSE('/api/v1/events/stream');
  const navigate = useNavigate();

  // Combine SSE events with polled events for the feed
  const feedEvents = sseEvents.length > 0
    ? [...sseEvents, ...events].slice(0, 20)
    : events;

  // Prepare chart data
  const eventsByTypeData = metrics?.eventsByType
    ? Object.entries(metrics.eventsByType).map(([name, value]) => ({ name, value }))
    : [];

  const statusData = metrics?.eventsByStatus
    ? Object.entries(metrics.eventsByStatus).map(([name, value]) => ({ name, value }))
    : [];

  const successRate = metrics
    ? ((metrics.totalProcessed / Math.max(metrics.totalEventsReceived - metrics.totalDuplicatesBlocked, 1)) * 100).toFixed(1)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Real-time overview of your event processing system</p>
        </div>
        <div className="flex items-center gap-2">
          {connected ? (
            <span className="flex items-center gap-1.5 text-xs text-green-400 bg-green-500/10 px-2.5 py-1.5 rounded-full border border-green-500/20">
              <Wifi className="w-3 h-3" />
              Live
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-2.5 py-1.5 rounded-full">
              <WifiOff className="w-3 h-3" />
              Polling
            </span>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-4 gap-4">
        <StatCard
          title="Total Events"
          value={metrics?.totalEventsReceived || 0}
          icon={Zap}
          subtitle="received"
          color="primary"
        />
        <StatCard
          title="Duplicates Blocked"
          value={metrics?.totalDuplicatesBlocked || 0}
          icon={ShieldCheck}
          subtitle={`${metrics?.duplicateRatePercent || 0}% rate`}
          color="yellow"
        />
        <StatCard
          title="Success Rate"
          value={`${successRate}%`}
          icon={CheckCircle2}
          subtitle={`${metrics?.totalProcessed || 0} processed`}
          color="green"
        />
        <StatCard
          title="Avg Processing"
          value={`${metrics?.avgProcessingTimeMs || 0}ms`}
          icon={Clock}
          subtitle={`${metrics?.throughputPerMinute || 0}/min`}
          color="blue"
        />
      </motion.div>

      {/* Main content grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Event Feed */}
        <motion.div
          variants={itemVariants}
          initial="hidden"
          animate="show"
          className="col-span-8"
        >
          <div className="glass-card">
            <div className="flex items-center justify-between p-5 border-b border-border/50">
              <h2 className="text-sm font-semibold text-foreground">Recent Events</h2>
              <button
                onClick={() => navigate('/events')}
                className="text-xs text-primary-400 hover:text-primary-300 font-medium transition-colors"
              >
                View All →
              </button>
            </div>
            <div className="divide-y divide-border/30 max-h-[480px] overflow-y-auto">
              {eventsLoading ? (
                <div className="p-8 text-center text-muted-foreground">
                  <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-2" />
                  Loading events...
                </div>
              ) : feedEvents.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Zap className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>No events yet. Use the Simulator to create some!</p>
                </div>
              ) : (
                feedEvents.map((event, i) => (
                  <EventFeedItem
                    key={event.id || i}
                    event={event}
                    onClick={(e) => navigate(`/events/${e.id}`)}
                  />
                ))
              )}
            </div>
          </div>
        </motion.div>

        {/* Right sidebar */}
        <div className="col-span-4 space-y-6">
          <motion.div variants={itemVariants} initial="hidden" animate="show">
            <QueueDepthGauge
              queueDepth={metrics?.queueDepth}
              systemHealth={metrics?.systemHealth}
            />
          </motion.div>

          {/* Events by Type donut */}
          <motion.div variants={itemVariants} initial="hidden" animate="show" className="glass-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Events by Type</h3>
            {eventsByTypeData.length > 0 ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={eventsByTypeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {eventsByTypeData.map((entry, i) => (
                        <Cell key={i} fill={EVENT_TYPE_COLORS[i % EVENT_TYPE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                No data yet
              </div>
            )}
            <div className="mt-3 space-y-1.5">
              {eventsByTypeData.slice(0, 5).map((item, i) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: EVENT_TYPE_COLORS[i % EVENT_TYPE_COLORS.length] }} />
                    <span className="text-muted-foreground">{item.name}</span>
                  </div>
                  <span className="font-mono text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Bottom charts */}
      <div className="grid grid-cols-2 gap-6">
        {/* Status breakdown */}
        <motion.div variants={itemVariants} initial="hidden" animate="show" className="glass-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Event Status Breakdown</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData}>
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#71717a', fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#71717a', fontSize: 11 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {statusData.map((entry) => {
                    const colors = {
                      pending: '#f59e0b',
                      processing: '#3b82f6',
                      processed: '#22c55e',
                      failed: '#ef4444',
                      dead: '#991b1b',
                    };
                    return <Cell key={entry.name} fill={colors[entry.name] || '#6366f1'} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Throughput */}
        <motion.div variants={itemVariants} initial="hidden" animate="show" className="glass-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">System Performance</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-muted/30 border border-border/30">
              <p className="text-xs text-muted-foreground">Throughput</p>
              <p className="text-2xl font-bold text-foreground mt-1">{metrics?.throughputPerMinute || 0}</p>
              <p className="text-xs text-muted-foreground">events/min</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/30 border border-border/30">
              <p className="text-xs text-muted-foreground">Duplicate Rate</p>
              <p className="text-2xl font-bold text-foreground mt-1">{metrics?.duplicateRatePercent || 0}%</p>
              <p className="text-xs text-muted-foreground">blocked</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/30 border border-border/30">
              <p className="text-xs text-muted-foreground">Failed Events</p>
              <p className="text-2xl font-bold text-red-400 mt-1">{metrics?.totalFailed || 0}</p>
              <p className="text-xs text-muted-foreground">in retry</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/30 border border-border/30">
              <p className="text-xs text-muted-foreground">Dead Events</p>
              <p className="text-2xl font-bold text-red-400 mt-1">{metrics?.totalDead || 0}</p>
              <p className="text-xs text-muted-foreground">in DLQ</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
