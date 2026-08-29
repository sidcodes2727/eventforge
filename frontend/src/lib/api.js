const API_BASE = '/api/v1';

class ApiClient {
  constructor() {
    this.baseUrl = API_BASE;
  }

  getToken() {
    return localStorage.getItem('ieps_token');
  }

  async request(endpoint, options = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    // Handle 401 — redirect to login
    if (response.status === 401) {
      localStorage.removeItem('ieps_token');
      localStorage.removeItem('ieps_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      throw new Error('Authentication required');
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `Request failed with status ${response.status}`);
    }

    return data;
  }

  get(endpoint, params = {}) {
    const query = new URLSearchParams(params).toString();
    const url = query ? `${endpoint}?${query}` : endpoint;
    return this.request(url);
  }

  post(endpoint, body) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  // ── Auth ─────────────────────────
  login(email, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  register(email, password, name) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  }

  getProfile() {
    return this.get('/auth/profile');
  }

  // ── Events ───────────────────────
  getEvents(params) {
    return this.get('/events', params);
  }

  getEvent(id) {
    return this.get(`/events/${id}`);
  }

  createEvent(data, idempotencyKey) {
    return this.request('/events', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(data),
    });
  }

  replayEvent(id) {
    return this.post(`/events/${id}/replay`);
  }

  getEventTypes() {
    return this.get('/events/types');
  }

  // ── DLQ ──────────────────────────
  getDeadEvents(params) {
    return this.get('/dlq', params);
  }

  replayDeadEvent(id) {
    return this.post(`/dlq/${id}/replay`);
  }

  bulkReplayDeadEvents(ids) {
    return this.post('/dlq/bulk-replay', { ids });
  }

  discardDeadEvent(id) {
    return this.delete(`/dlq/${id}`);
  }

  // ── Metrics ──────────────────────
  getMetrics() {
    return this.get('/metrics');
  }

  getTimeline(hours = 24) {
    return this.get('/metrics/timeline', { hours });
  }

  getHistogram() {
    return this.get('/metrics/histogram');
  }

  // ── Simulator ────────────────────
  simulateWebhook(data) {
    return this.post('/simulate/webhook', data);
  }

  // ── API Keys ─────────────────────
  getApiKeys() {
    return this.get('/api-keys');
  }

  createApiKey(data) {
    return this.post('/api-keys', data);
  }

  revokeApiKey(id) {
    return this.post(`/api-keys/${id}/revoke`);
  }
}

export const api = new ApiClient();
export default api;
