<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import authService from '../services/authService'

const router = useRouter()
const route = useRoute()
const status = ref<'loading' | 'error'>('loading')
const errorMsg = ref('')

onMounted(async () => {
  const token = route.query.token as string | undefined

  if (token) {
    authService.saveToken(token)
    // Fetch and cache user profile from /api/v1/auth/me before redirecting
    await authService.fetchUserProfile()
    router.replace({ name: 'home', query: { authSuccess: '1' } })
  } else {
    status.value = 'error'
    errorMsg.value = 'Token de autenticação não encontrado. Tente novamente.'
    setTimeout(() => {
      router.replace({ name: 'login' })
    }, 3000)
  }
})
</script>

<template>
  <div class="auth-callback-page">
    <div class="auth-callback-card">
      <template v-if="status === 'loading'">
        <div class="auth-callback-spinner"></div>
        <p class="auth-callback-text">Autenticando...</p>
      </template>
      <template v-else>
        <div class="auth-callback-icon-error">✕</div>
        <p class="auth-callback-text">{{ errorMsg }}</p>
        <p class="auth-callback-subtext">Redirecionando para login...</p>
      </template>
    </div>
  </div>
</template>
