import axios from 'axios'
import { API_BASE } from '../data/floodData'

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Interceptor: attach Bearer token to every request if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('alerta_recife_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default api
