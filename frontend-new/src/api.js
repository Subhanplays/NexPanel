const API_BASE = '/api/v1';

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('vps_token');
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('vps_token', token);
    } else {
      localStorage.removeItem('vps_token');
    }
  }

  async request(method, endpoint, body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${API_BASE}${endpoint}`, opts);

    if (res.status === 401) {
      this.setToken(null);
      window.location.hash = '';
      window.location.reload();
      throw new Error('Session expired');
    }

    const data = await res.json();
    if (!res.ok) {
      let msg = 'Request failed';
      if (typeof data.detail === 'string') msg = data.detail;
      else if (Array.isArray(data.detail)) msg = data.detail.map(e => e.msg || e.loc?.join(' ') || 'Error').join(', ');
      else if (typeof data.detail === 'object' && data.detail) msg = JSON.stringify(data.detail);
      throw new Error(msg);
    }
    return data;
  }

  get(ep) { return this.request('GET', ep); }
  post(ep, body) { return this.request('POST', ep, body); }
  put(ep, body) { return this.request('PUT', ep, body); }
  del(ep) { return this.request('DELETE', ep); }
}

export const api = new ApiClient();
