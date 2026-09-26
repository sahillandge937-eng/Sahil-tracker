// js/api.js
// Thin fetch wrapper around every PULSE backend endpoint.

const Api = (() => {
  function showError(msg) {
    const el = document.getElementById('errorBanner');
    if (!el) return;
    if (!msg) { el.hidden = true; el.textContent = ''; return; }
    el.hidden = false;
    el.textContent = msg;
  }

  async function request(url, options) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      showError(null);
      if (res.status === 204) return null;
      return await res.json();
    } catch (e) {
      console.error('API error:', url, e);
      showError(e.message === 'Failed to fetch'
        ? 'Could not reach the PULSE server. Make sure "npm start" is running.'
        : e.message);
      throw e;
    }
  }

  const jsonPost = (url, body) => request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const jsonPut = (url, body) => request(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const del = (url) => request(url, { method: 'DELETE' });

  return {
    showError,

    dashboard: () => request('/api/dashboard'),
    analytics: (range) => request(`/api/analytics?range=${range}`),
    coach: () => request('/api/coach'),
    activity: (limit) => request(`/api/activity?limit=${limit || 30}`),

    workouts: {
      list: (params = {}) => request('/api/workouts?' + new URLSearchParams(params).toString()),
      get: (id) => request(`/api/workouts/${id}`),
      create: (data) => jsonPost('/api/workouts', data),
      update: (id, data) => jsonPut(`/api/workouts/${id}`, data),
      remove: (id) => del(`/api/workouts/${id}`)
    },

    exercises: {
      list: (params = {}) => request('/api/exercises?' + new URLSearchParams(params).toString()),
      create: (data) => jsonPost('/api/exercises', data)
    },

    goals: {
      list: () => request('/api/goals'),
      create: (data) => jsonPost('/api/goals', data),
      update: (id, data) => jsonPut(`/api/goals/${id}`, data),
      remove: (id) => del(`/api/goals/${id}`)
    },

    nutrition: {
      today: (date) => request(`/api/nutrition${date ? `?date=${date}` : ''}`),
      week: () => request('/api/nutrition?range=week'),
      create: (data) => jsonPost('/api/nutrition', data),
      remove: (id) => del(`/api/nutrition/${id}`)
    },

    progress: {
      get: () => request('/api/progress'),
      logWeight: (data) => jsonPost('/api/progress/weight', data)
    },

    profile: {
      get: () => request('/api/profile'),
      update: (data) => jsonPut('/api/profile', data)
    },

    settings: {
      get: () => request('/api/settings'),
      update: (data) => jsonPut('/api/settings', data),
      reset: () => jsonPost('/api/settings/reset', {})
    }
  };
})();
