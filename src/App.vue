<script setup lang="ts">
import NavBar from './components/NavBar.vue'
import HeroSection from './components/HeroSection.vue'
import FloodMap from './components/FloodMap.vue'
import AboutSection from './components/AboutSection.vue'
import FooterSection from './components/FooterSection.vue'
</script>

<template>
  <NavBar />
  <HeroSection />
  <hr class="section-divider" />
  <FloodMap />
  <hr class="section-divider" />
  <AboutSection />
  <FooterSection />
</template>
