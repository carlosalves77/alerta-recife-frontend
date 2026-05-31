<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'

const props = defineProps<{
  mode?: string
}>()

const route = useRoute()
const activeTab = ref<'login' | 'register'>('login')


const GOOGLE_AUTH_URL = `/oauth2/authorization/google`

onMounted(() => {
  const queryMode = route.query.mode as string || props.mode
  if (queryMode === 'register') {
    activeTab.value = 'register'
  }
})

function loginWithGoogle() {
  window.location.href = GOOGLE_AUTH_URL
}
</script>

<template>
  <div class="login-page">
    <!-- Background effects -->
    <div class="login-bg-effects">
      <div class="login-orb login-orb-1"></div>
      <div class="login-orb login-orb-2"></div>
      <div class="login-orb login-orb-3"></div>
      <div class="login-grid-overlay"></div>
    </div>

    <div class="login-container">
      <!-- Login Card -->
      <div class="login-card">
        <!-- Logo -->
        <div class="login-logo">
          <div class="login-logo-icon">🌊</div>
          <h2>Alerta <span class="login-logo-accent">Recife</span></h2>
        </div>

        <!-- Tabs -->
        <div class="login-tabs">
          <button
            class="login-tab"
            :class="{ active: activeTab === 'login' }"
            @click="activeTab = 'login'"
          >
            Entrar
          </button>
          <button
            class="login-tab"
            :class="{ active: activeTab === 'register' }"
            @click="activeTab = 'register'"
          >
            Registrar
          </button>
          <div class="login-tab-indicator" :class="{ right: activeTab === 'register' }"></div>
        </div>

        <!-- Content -->
        <div class="login-content">
          <p class="login-description" v-if="activeTab === 'login'">
            Acesse sua conta para reportar alagamentos e ajudar a comunidade do Recife.
          </p>
          <p class="login-description" v-else>
            Crie sua conta para contribuir com alertas de alagamento na Grande Recife.
          </p>

          <!-- Google Button -->
          <button class="login-google-btn" @click="loginWithGoogle">
            <svg class="login-google-icon" viewBox="0 0 24 24" width="20" height="20">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span v-if="activeTab === 'login'">Entrar com Google</span>
            <span v-else>Registrar com Google</span>
          </button>

          <div class="login-divider">
            <span>Autenticação segura via Google</span>
          </div>

          <!-- Features -->
          <div class="login-features">
            <div class="login-feature-item">
              <span class="login-feature-icon">🛡️</span>
              <span>Autenticação segura</span>
            </div>
            <div class="login-feature-item">
              <span class="login-feature-icon">📍</span>
              <span>Reporte alagamentos</span>
            </div>
            <div class="login-feature-item">
              <span class="login-feature-icon">🤝</span>
              <span>Ajude a comunidade</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Back link -->
      <router-link to="/" class="login-back-link">
        ← Voltar ao mapa
      </router-link>
    </div>
  </div>
</template>
