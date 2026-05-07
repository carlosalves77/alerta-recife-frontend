<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const scrolled = ref(false)
const menuOpen = ref(false)

function handleScroll() {
  scrolled.value = window.scrollY > 20
}

function toggleMenu() {
  menuOpen.value = !menuOpen.value
}

function closeMenu() {
  menuOpen.value = false
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll)
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<template>
  <nav class="navbar" :class="{ scrolled }">
    <div class="navbar-inner">
      <a href="#" class="navbar-brand" @click.prevent>
        <div class="brand-icon">🌊</div>
        <span>Alerta <span class="brand-accent">Recife</span></span>
      </a>

      <ul class="navbar-links" :class="{ open: menuOpen }">
        <li><a href="#mapa" @click="closeMenu">Mapa</a></li>
        <li><a href="#sobre" @click="closeMenu">Sobre</a></li>
        <li><a href="#contato" @click="closeMenu">Contato</a></li>
      </ul>

      <button class="navbar-mobile-toggle" @click="toggleMenu" aria-label="Menu">
        <span></span>
        <span></span>
        <span></span>
      </button>
    </div>
  </nav>
</template>
