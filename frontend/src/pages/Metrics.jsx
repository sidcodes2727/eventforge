import { motion } from 'framer-motion';
import { BarChart3, Activity, Clock, ShieldCheck, TrendingUp, AlertTriangle } from 'lucide-react';
import { useMetrics } from '@/hooks/useMetrics';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

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

function MetricCard({ title, value, subtitle, icon: Icon, color = 'primary' }) {
  const iconColors = {
    primary: 'text-primary-400 bg-primary/10',
    green: 'text-green-400 bg-green-500/10',
    yellow: 'text-yellow-400 bg-yellow-500/10',
    red: 'text-red-400 bg-red-500/10',
    blue: 'text-blue-400 bg-blue-500/10',
  };

  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-3xl font-bold text-foreground mt-2 tracking-tight">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div className={`p-2.5 rounded-xl ${iconColors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

export default function Metrics() {
  const { metrics, loading } = useMetrics(3000);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const statusData = metrics?.eventsByStatus
    ? Object.entries(metrics.eventsByStatus).map(([name, value]) => ({ name, value }))
    : [];

  const typeData = metrics?.eventsByType
    ? Object.entries(metrics.eventsByType).map(([name, value]) => ({ name: name.split('.')[1] || name, value }))
    : [];

  const healthColor = {
    healthy: 'text-green-400 bg-green-500/10 border-green-500/20',
    degraded: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    down: 'text-red-400 bg-red-500/10 border-red-500/20',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Metrics</h1>
          <p className="text-sm text-muted-foreground mt-1">Real-time system metrics — auto-refreshing every 3 seconds</p>
        </div>
        <div className={`px-3 py-1.5 rounded-full text-xs font-medium border ${healthColor[metrics?.systemHealth] || 'text-muted-foreground'}`}>
          ● {metrics?.systemHealth || 'unknown'}
        </div>
      </div>

      {/* Top metrics */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-3 gap-4">
        <MetricCard title="Throughput" value={`${metrics?.throughputPerMinute || 0}/min`} subtitle="events per minute" icon={TrendingUp} color="blue" />
        <MetricCard title="Avg Processing" value={`${metrics?.avgProcessingTimeMs || 0}ms`} subtitle="average time" icon={Clock} color="primary" />
        <MetricCard title="Duplicate Rate" value={`${metrics?.duplicateRatePercent || 0}%`} subtitle={`${metrics?.totalDuplicatesBlocked || 0} blocked`} icon={ShieldCheck} color="yellow" />
      </motion.div>

      <div className="grid grid-cols-2 gap-4">
        <MetricCard title="Total Received" value={(metrics?.totalEventsReceived || 0).toLocaleString()} icon={Activity} color="primary" />
        <MetricCard title="Total Processed" value={(metrics?.totalProcessed || 0).toLocaleString()} icon={BarChart3} color="green" />
        <MetricCard title="Total Failed" value={(metrics?.totalFailed || 0).toLocaleString()} icon={AlertTriangle} color="red" />
        <MetricCard title="Total Dead" value={(metrics?.totalDead || 0).toLocaleString()} icon={AlertTriangle} color="red" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Events by Status</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {statusData.map((entry) => {
                    const colors = { pending: '#f59e0b', processing: '#3b82f6', processed: '#22c55e', failed: '#ef4444', dead: '#991b1b' };
                    return <Cell key={entry.name} fill={colors[entry.name] || '#6366f1'} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Events by Type</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeData} layout="vertical">
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 11 }} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 11 }} width={80} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" fill="#6366f1" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Queue Depth */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Queue Depth</h3>
        <div className="grid grid-cols-4 gap-4">
          {['high', 'medium', 'low', 'deadLetter'].map((key) => (
            <div key={key} className="p-4 rounded-lg bg-muted/30 border border-border/30 text-center">
              <p className="text-xs text-muted-foreground uppercase font-medium">{key === 'deadLetter' ? 'Dead Letter' : key}</p>
              <p className="text-2xl font-bold text-foreground mt-2">{metrics?.queueDepth?.[key] || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">messages</p>
            </div>
          ))}
        </div>
      </div>

      {/* System Info */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">System Information</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex justify-between py-2 border-b border-border/30">
            <span className="text-muted-foreground">Uptime</span>
            <span className="text-foreground font-mono">{formatUptime(metrics?.uptime || 0)}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border/30">
            <span className="text-muted-foreground">System Health</span>
            <span className="text-foreground capitalize">{metrics?.systemHealth || 'unknown'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}
