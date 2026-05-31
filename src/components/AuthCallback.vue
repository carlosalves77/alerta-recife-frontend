<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import authService from '../services/authService'

const router = useRouter()
const status = ref<'loading' | 'error'>('loading')
const errorMsg = ref('')

onMounted(async () => {
  try {
    // O cookie auth_token já foi setado pelo Spring no redirect
    // Só busca o perfil do usuário (cookie vai automaticamente)
    const profile = await authService.fetchUserProfile()
    if (profile) {
      router.replace({ name: 'home', query: { authSuccess: '1' } })
    } else {
      throw new Error('Perfil não encontrado')
    }
  } catch (error) {
    status.value = 'error'
    errorMsg.value = 'Erro na autenticação. Tente novamente.'
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
