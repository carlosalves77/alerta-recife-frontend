<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import HeroSection from './HeroSection.vue'
import FloodMap from './FloodMap.vue'
import AboutSection from './AboutSection.vue'
import FooterSection from './FooterSection.vue'

const route = useRoute()
const router = useRouter()

const showAuthToast = ref(false)

onMounted(() => {
  if (route.query.authSuccess === '1') {
    showAuthToast.value = true
    // Clean the URL
    router.replace({ name: 'home' })
    setTimeout(() => {
      showAuthToast.value = false
    }, 4000)
  }
})
</script>

<template>
  <Transition name="toast-slide">
    <div v-if="showAuthToast" class="toast-notification toast-success" @click="showAuthToast = false">
      <span class="toast-icon">✓</span>
      <span class="toast-text">Login efetuado com sucesso! Bem-vindo ao Alerta Recife.</span>
      <button class="toast-close" @click.stop="showAuthToast = false">✕</button>
    </div>
  </Transition>

  <HeroSection />
  <hr class="section-divider" />
  <FloodMap />
  <hr class="section-divider" />
  <AboutSection />
  <FooterSection />
</template>
