import api from './api'

const PROFILE_KEY = 'alerta_recife_profile'

export interface UserProfile {
  email: string
  username: string
  profilePicture: string
  role: string
  createdAt: string
}

/** Fetch user profile from /api/v1/auth/me and cache it in localStorage */
async function fetchUserProfile(): Promise<UserProfile | null> {
  try {
    const { data } = await api.get<UserProfile>('/auth/me')
    localStorage.setItem(PROFILE_KEY, JSON.stringify(data))
    return data
  } catch {
    // If fetching fails, clear cached profile (session expired / not logged in)
    localStorage.removeItem(PROFILE_KEY)
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

/** Check if user is authenticated by looking at cached profile */
function isAuthenticated(): boolean {
  return getCachedProfile() !== null
}

/** Clear cached profile on logout */
function removeToken(): void {
  localStorage.removeItem(PROFILE_KEY)
}

export default {
  removeToken,
  isAuthenticated,
  fetchUserProfile,
  getCachedProfile
}
