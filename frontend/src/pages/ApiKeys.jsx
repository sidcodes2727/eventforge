import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Key, Plus, Copy, Trash2, Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';

export default function ApiKeys() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyRateLimit, setNewKeyRateLimit] = useState(100);
  const [newKeyExpiry, setNewKeyExpiry] = useState(90);
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState(null);
  const [copied, setCopied] = useState(false);

  const fetchKeys = async () => {
    try {
      const res = await api.getApiKeys();
      setKeys(res.data.keys || []);
    } catch (err) {
      console.error('Failed to fetch API keys:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchKeys(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await api.createApiKey({
        name: newKeyName,
        rateLimit: newKeyRateLimit,
        expiresInDays: newKeyExpiry,
      });
      setCreatedKey(res.data.key);
      setShowCreate(false);
      setNewKeyName('');
      await fetchKeys();
    } catch (err) {
      console.error('Failed to create API key:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id) => {
    if (!confirm('Revoke this API key? This action cannot be undone.')) return;
    try {
      await api.revokeApiKey(id);
      await fetchKeys();
    } catch (err) {
      console.error('Failed to revoke API key:', err);
    }
  };

  const copyKey = (key) => {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">API Keys</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your API keys for programmatic access</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Key
        </button>
      </div>

      {/* Created key banner */}
      {createdKey && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-5 border-green-500/20 bg-green-500/5"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">API Key Created — Copy it Now!</p>
              <p className="text-xs text-muted-foreground mt-1">This key will not be shown again.</p>
              <div className="flex items-center gap-2 mt-3">
                <code className="flex-1 p-2 bg-muted/50 rounded-lg text-xs font-mono text-green-300 break-all">
                  {createdKey}
                </code>
                <button
                  onClick={() => copyKey(createdKey)}
                  className="p-2 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 transition-colors"
                >
                  {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button onClick={() => setCreatedKey(null)} className="text-muted-foreground hover:text-foreground">×</button>
          </div>
        </motion.div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Create New API Key</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Name</label>
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g., Production Backend"
                required
                className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Rate Limit (req/min)</label>
                <input
                  type="number"
                  value={newKeyRateLimit}
                  onChange={(e) => setNewKeyRateLimit(parseInt(e.target.value))}
                  min={1}
                  max={10000}
                  className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Expires In (days)</label>
                <input
                  type="number"
                  value={newKeyExpiry}
                  onChange={(e) => setNewKeyExpiry(parseInt(e.target.value))}
                  min={1}
                  max={365}
                  className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={creating || !newKeyName}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-600 transition-colors disabled:opacity-50"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 rounded-lg bg-muted text-muted-foreground text-sm hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Keys List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card p-5">
              <div className="skeleton h-4 w-48 mb-2 rounded" />
              <div className="skeleton h-3 w-32 rounded" />
            </div>
          ))}
        </div>
      ) : keys.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Key className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground">No API Keys</h2>
          <p className="text-muted-foreground mt-1">Create your first API key to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map((key, index) => (
            <motion.div
              key={key.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="glass-card p-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${key.isActive ? 'bg-primary/10' : 'bg-muted'}`}>
                    <Key className={`w-4 h-4 ${key.isActive ? 'text-primary-400' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{key.name}</p>
                      {!key.isActive && (
                        <span className="badge bg-red-500/10 text-red-400 border border-red-500/20">Revoked</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <code className="text-xs font-mono text-muted-foreground">{key.keyPrefix}••••••••</code>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">{key.rateLimit} req/min</span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">Created {formatDate(key.createdAt)}</span>
                    </div>
                  </div>
                </div>
                {key.isActive && (
                  <button
                    onClick={() => handleRevoke(key.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-medium transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Revoke
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
