import axios from 'axios'
import { API_BASE } from '../data/floodData'

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

export default api
