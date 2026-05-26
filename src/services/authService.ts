import api from './api'

const TOKEN_KEY = 'alerta_recife_token'
const PROFILE_KEY = 'alerta_recife_profile'

export interface UserProfile {
  email: string
  username: string
  profilePicture: string
  role: string
  createdAt: string
}

export interface JwtPayload {
  sub?: string
  name?: string
  email?: string
  picture?: string
  exp?: number
  iat?: number
  [key: string]: unknown
}

function parseJwt(token: string): JwtPayload | null {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch {
    return null
  }
}

function saveToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(PROFILE_KEY)
}

function isAuthenticated(): boolean {
  const token = getToken()
  if (!token) return false

  const payload = parseJwt(token)
  if (!payload || !payload.exp) return false

  // Check if token is expired
  const now = Math.floor(Date.now() / 1000)
  return payload.exp > now
}

function getUserInfo(): JwtPayload | null {
  const token = getToken()
  if (!token) return null
  return parseJwt(token)
}

/** Fetch user profile from /api/v1/auth/me and cache it in localStorage */
async function fetchUserProfile(): Promise<UserProfile | null> {
  if (!isAuthenticated()) return null

  try {
    const { data } = await api.get<UserProfile>('/auth/me')
    localStorage.setItem(PROFILE_KEY, JSON.stringify(data))
    return data
  } catch {
    return null
  }
}

/** Get cached profile from localStorage (synchronous) */
function getCachedProfile(): UserProfile | null {
  const raw = localStorage.getItem(PROFILE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export default {
  saveToken,
  getToken,
  removeToken,
  isAuthenticated,
  getUserInfo,
  parseJwt,
  fetchUserProfile,
  getCachedProfile
}
