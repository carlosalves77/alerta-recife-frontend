<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import authService, { type UserProfile } from '../services/authService'
import MyFloodPoints from './MyFloodPoints.vue'

const router = useRouter()
const scrolled = ref(false)
const menuOpen = ref(false)
const dropdownOpen = ref(false)
const isLoggedIn = ref(authService.isAuthenticated())
const userProfile = ref<UserProfile | null>(authService.getCachedProfile())
const showMyPoints = ref(false)

const userInitial = computed(() => {
  if (userProfile.value?.username) return userProfile.value.username.charAt(0).toUpperCase()
  if (userProfile.value?.email) return userProfile.value.email.charAt(0).toUpperCase()
  return '?'
})

const displayName = computed(() => {
  return userProfile.value?.username || 'Usuário'
})

const displayEmail = computed(() => {
  return userProfile.value?.email || ''
})

const profilePicture = computed(() => {
  return userProfile.value?.profilePicture || null
})

function handleScroll() {
  scrolled.value = window.scrollY > 20
}

function toggleMenu() {
  menuOpen.value = !menuOpen.value
}

function closeMenu() {
  menuOpen.value = false
}

function toggleDropdown() {
  dropdownOpen.value = !dropdownOpen.value
}

function closeDropdown(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.user-menu')) {
    dropdownOpen.value = false
  }
}

function logout() {
  authService.removeToken()
  isLoggedIn.value = false
  userProfile.value = null
  dropdownOpen.value = false
  router.push({ name: 'home' })
}

function openMyPoints() {
  dropdownOpen.value = false
  showMyPoints.value = true
}

function onPointDeleted() {
  // Trigger map refresh by reloading the page
  window.location.reload()
}

async function checkAuth() {
  isLoggedIn.value = authService.isAuthenticated()
  if (isLoggedIn.value && !userProfile.value) {
    const profile = await authService.fetchUserProfile()
    if (profile) userProfile.value = profile
  }
}

onMounted(async () => {
  window.addEventListener('scroll', handleScroll)
  window.addEventListener('click', closeDropdown)

  // Fetch profile on mount if authenticated
  if (isLoggedIn.value) {
    const profile = await authService.fetchUserProfile()
    if (profile) userProfile.value = profile
  }

  // Re-check auth state on route changes
  router.afterEach(() => {
    checkAuth()
  })
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
  window.removeEventListener('click', closeDropdown)
})
</script>

<template>
  <nav class="navbar" :class="{ scrolled }">
    <div class="navbar-inner">
      <router-link to="/" class="navbar-brand">
        <div class="brand-icon">🌊</div>
        <span>Alerta <span class="brand-accent">Recife</span></span>
      </router-link>

      <ul class="navbar-links" :class="{ open: menuOpen }">
        <li><a href="/#mapa" @click="closeMenu">Mapa</a></li>
        <li><a href="/#sobre" @click="closeMenu">Sobre</a></li>
        <li><a href="/#contato" @click="closeMenu">Contato</a></li>

        <!-- Mobile auth buttons -->
        <li v-if="!isLoggedIn" class="navbar-auth-mobile">
          <router-link to="/login?mode=login" class="btn btn-auth-login" @click="closeMenu">Entrar</router-link>
          <router-link to="/login?mode=register" class="btn btn-auth-register" @click="closeMenu">Registrar</router-link>
        </li>
        <li v-if="isLoggedIn" class="navbar-auth-mobile">
          <button class="btn btn-auth-logout-mobile" @click="logout">Sair</button>
        </li>
      </ul>

      <div class="navbar-actions">
        <!-- Desktop auth buttons -->
        <template v-if="!isLoggedIn">
          <router-link to="/login?mode=login" class="btn btn-auth-login">Entrar</router-link>
          <router-link to="/login?mode=register" class="btn btn-auth-register">Registrar</router-link>
        </template>

        <!-- User avatar -->
        <template v-if="isLoggedIn">
          <div class="user-menu" @click.stop="toggleDropdown">
            <button class="user-avatar-btn">
              <div class="user-avatar">
                <img
                  v-if="profilePicture"
                  :src="profilePicture"
                  :alt="displayName"
                  class="user-avatar-img"
                  referrerpolicy="no-referrer"
                />
                <span v-else class="user-avatar-initial">{{ userInitial }}</span>
              </div>
            </button>

            <Transition name="dropdown-fade">
              <div v-if="dropdownOpen" class="user-dropdown">
                <div class="user-dropdown-header">
                  <div class="user-dropdown-avatar">
                    <img
                      v-if="profilePicture"
                      :src="profilePicture"
                      :alt="displayName"
                      class="user-dropdown-avatar-img"
                      referrerpolicy="no-referrer"
                    />
                    <span v-else>{{ userInitial }}</span>
                  </div>
                  <div class="user-dropdown-info">
                    <p class="user-dropdown-name">{{ displayName }}</p>
                    <p class="user-dropdown-email">{{ displayEmail }}</p>
                  </div>
                </div>
                <div class="user-dropdown-divider"></div>
                <button class="user-dropdown-item" @click="openMyPoints">
                  <span class="user-dropdown-item-icon">📋</span>
                  <span>Meus Alertas</span>
                </button>
                <div class="user-dropdown-divider"></div>
                <button class="user-dropdown-item user-dropdown-logout" @click="logout">
                  <span class="user-dropdown-item-icon">🚪</span>
                  <span>Sair da conta</span>
                </button>
              </div>
            </Transition>
          </div>
        </template>

        <button class="navbar-mobile-toggle" @click="toggleMenu" aria-label="Menu">
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </div>
  </nav>

  <!-- My Flood Points Panel -->
  <MyFloodPoints
    :visible="showMyPoints"
    @close="showMyPoints = false"
    @deleted="onPointDeleted"
  />
</template>

