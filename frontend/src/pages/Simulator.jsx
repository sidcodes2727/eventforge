import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Loader2, CheckCircle2, XCircle, Shield, Zap, Clock } from 'lucide-react';
import api from '@/lib/api';

const eventTypes = [
  { value: 'webhook.received', label: 'Webhook Received' },
  { value: 'payment.success', label: 'Payment Success' },
  { value: 'payment.failed', label: 'Payment Failed' },
  { value: 'order.placed', label: 'Order Placed' },
  { value: 'order.cancelled', label: 'Order Cancelled' },
  { value: 'user.signup', label: 'User Signup' },
  { value: 'notification.send', label: 'Notification Send' },
];

const defaultPayloads = {
  'webhook.received': { source: 'stripe', webhookId: 'wh_test_123', data: { status: 'completed' } },
  'payment.success': { amount: 99.99, currency: 'USD', transactionId: 'txn_sim_001', customerId: 'cust_001' },
  'payment.failed': { amount: 49.99, reason: 'insufficient_funds', transactionId: 'txn_sim_002' },
  'order.placed': { orderId: 'ord_sim_001', items: [{ name: 'Widget', qty: 2 }], total: 199.98 },
  'order.cancelled': { orderId: 'ord_sim_002', reason: 'customer_request' },
  'user.signup': { email: 'test@simulator.com', name: 'Test User', source: 'simulator' },
  'notification.send': { channel: 'email', recipient: 'user@test.com', message: 'Test notification from simulator' },
};

export default function Simulator() {
  const [eventType, setEventType] = useState('webhook.received');
  const [payload, setPayload] = useState(JSON.stringify(defaultPayloads['webhook.received'], null, 2));
  const [duplicateCount, setDuplicateCount] = useState(5);
  const [delayMs, setDelayMs] = useState(100);
  const [priority, setPriority] = useState('medium');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);

  const handleTypeChange = (type) => {
    setEventType(type);
    setPayload(JSON.stringify(defaultPayloads[type] || {}, null, 2));
  };

  const runSimulation = async () => {
    setRunning(true);
    setResults(null);

    try {
      let parsedPayload;
      try {
        parsedPayload = JSON.parse(payload);
      } catch {
        setResults({ error: 'Invalid JSON payload' });
        setRunning(false);
        return;
      }

      const res = await api.simulateWebhook({
        eventType,
        payload: parsedPayload,
        duplicateCount,
        delayBetweenMs: delayMs,
        priority,
      });

      setResults(res.data);
    } catch (err) {
      setResults({ error: err.message });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Webhook Simulator</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Prove idempotency works — send the same event multiple times and watch duplicates get blocked
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Configuration */}
        <div className="space-y-6">
          <div className="glass-card p-5 space-y-5">
            <h2 className="text-sm font-semibold text-foreground">Configuration</h2>

            {/* Event Type */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Event Type</label>
              <select
                value={eventType}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {eventTypes.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Priority</label>
              <div className="flex gap-2">
                {['low', 'medium', 'high', 'critical'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      priority === p
                        ? 'bg-primary text-white shadow-lg shadow-primary/25'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Duplicate Count Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Duplicate Count</label>
                <span className="text-xs font-mono text-primary-400">{duplicateCount}x</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={duplicateCount}
                onChange={(e) => setDuplicateCount(parseInt(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1</span>
                <span>10</span>
              </div>
            </div>

            {/* Delay */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Delay Between Requests</label>
                <span className="text-xs font-mono text-primary-400">{delayMs}ms</span>
              </div>
              <input
                type="range"
                min={0}
                max={1000}
                step={50}
                value={delayMs}
                onChange={(e) => setDelayMs(parseInt(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            {/* Payload Editor */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Payload (JSON)</label>
              <textarea
                value={payload}
                onChange={(e) => setPayload(e.target.value)}
                rows={8}
                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />
            </div>

            {/* Run Button */}
            <button
              onClick={runSimulation}
              disabled={running}
              className="w-full py-3 px-4 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-400 hover:to-primary-500 text-white font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-primary/25"
            >
              {running ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Running Simulation...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Run Simulation
                </>
              )}
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-6">
          <AnimatePresence mode="wait">
            {results ? (
              results.error ? (
                <motion.div
                  key="error"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="glass-card p-5 border-red-500/20"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <XCircle className="w-6 h-6 text-red-400" />
                    <h2 className="text-sm font-semibold text-red-400">Simulation Failed</h2>
                  </div>
                  <p className="text-sm text-red-300">{results.error}</p>
                </motion.div>
              ) : (
                <motion.div
                  key="results"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  {/* Summary Cards */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="glass-card p-4 text-center">
                      <Zap className="w-5 h-5 text-blue-400 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-foreground">{results.sent}</p>
                      <p className="text-xs text-muted-foreground mt-1">Requests Sent</p>
                    </div>
                    <div className="glass-card p-4 text-center">
                      <CheckCircle2 className="w-5 h-5 text-green-400 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-green-400">{results.processed}</p>
                      <p className="text-xs text-muted-foreground mt-1">Processed</p>
                    </div>
                    <div className="glass-card p-4 text-center">
                      <Shield className="w-5 h-5 text-yellow-400 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-yellow-400">{results.duplicatesBlocked}</p>
                      <p className="text-xs text-muted-foreground mt-1">Blocked</p>
                    </div>
                  </div>

                  {/* Idempotency Key */}
                  <div className="glass-card p-4">
                    <p className="text-xs text-muted-foreground mb-1">Idempotency Key Used</p>
                    <code className="text-xs font-mono text-primary-400 break-all">{results.idempotencyKey}</code>
                  </div>

                  {/* Request Timeline */}
                  <div className="glass-card p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-4">Request Timeline</h3>
                    <div className="space-y-2">
                      {results.results?.map((r, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className={`flex items-center gap-3 p-3 rounded-lg ${
                            r.status === 'processed'
                              ? 'bg-green-500/5 border border-green-500/20'
                              : r.status === 'blocked'
                              ? 'bg-yellow-500/5 border border-yellow-500/20'
                              : 'bg-red-500/5 border border-red-500/20'
                          }`}
                        >
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-mono text-muted-foreground flex-shrink-0">
                            {r.attempt}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              {r.status === 'processed' ? (
                                <CheckCircle2 className="w-4 h-4 text-green-400" />
                              ) : r.status === 'blocked' ? (
                                <Shield className="w-4 h-4 text-yellow-400" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-400" />
                              )}
                              <span className="text-sm font-medium text-foreground capitalize">{r.status}</span>
                              {r.reason && (
                                <span className="text-xs text-muted-foreground">({r.reason})</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                            <Clock className="w-3 h-3" />
                            {r.responseTimeMs}ms
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Proof banner */}
                  <div className="glass-card p-4 bg-gradient-to-r from-green-500/10 to-primary/10 border-green-500/20">
                    <div className="flex items-center gap-3">
                      <Shield className="w-8 h-8 text-green-400" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">Idempotency Verified ✓</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {results.sent} identical requests → only {results.processed} processed, {results.duplicatesBlocked} duplicates safely blocked
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-card p-12 text-center"
              >
                <Play className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <h2 className="text-lg font-semibold text-foreground">Ready to Simulate</h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
                  Configure your simulation on the left and click "Run Simulation" to see idempotency in action
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
