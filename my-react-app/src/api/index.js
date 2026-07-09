// All backend endpoints in one place, grouped by route family.
// Components import from here rather than calling fetch directly.
import { request } from './client.js'

export const authApi = {
  register: (payload) => request('/api/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/api/auth/login', { method: 'POST', body: payload }),
  me: () => request('/api/auth/me', { auth: true }),
}

export const experimentsApi = {
  list: ({ subject, search } = {}) => {
    const params = new URLSearchParams()
    if (subject && subject !== 'All') params.set('subject', subject.toLowerCase())
    if (search) params.set('search', search)
    const qs = params.toString()
    return request(`/api/experiments${qs ? `?${qs}` : ''}`)
  },
  get: (id) => request(`/api/experiments/${id}`),
}

export const progressApi = {
  saveSession: (payload) => request('/api/progress/session', { method: 'POST', body: payload, auth: true }),
  me: () => request('/api/progress/me', { auth: true }),
  badges: () => request('/api/progress/badges/me', { auth: true }),
}
