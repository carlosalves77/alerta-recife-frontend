<script setup lang="ts">
import { onMounted, ref } from 'vue'

const raindrops = ref<Array<{ id: number; left: string; height: string; duration: string; delay: string }>>([])

onMounted(() => {
  const drops: typeof raindrops.value = []
  for (let i = 0; i < 40; i++) {
    drops.push({
      id: i,
      left: Math.random() * 100 + '%',
      height: Math.random() * 30 + 15 + 'px',
      duration: Math.random() * 1.5 + 0.8 + 's',
      delay: Math.random() * 3 + 's'
    })
  }
  raindrops.value = drops
})
</script>

<template>
  <section class="hero-section" id="inicio">
    <!-- Background effects -->
    <div class="hero-bg-effects">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
      <div class="orb orb-3"></div>
    </div>

    <!-- Rain animation -->
    <div class="rain-container">
      <div
        v-for="drop in raindrops"
        :key="drop.id"
        class="raindrop"
        :style="{
          left: drop.left,
          height: drop.height,
          animationDuration: drop.duration,
          animationDelay: drop.delay
        }"
      ></div>
    </div>

    <!-- Content -->
    <div class="hero-content">
      <div class="hero-badge">
        <span class="pulse-dot"></span>
        Monitoramento em tempo real
      </div>

      <h1 class="hero-title">
        Saiba onde <span class="highlight">alaga</span><br />
        na Grande Recife
      </h1>

      <p class="hero-subtitle">
        Mapeamento colaborativo de pontos de alagamento para ajudar você a se locomover
        com segurança em dias de chuva intensa na Região Metropolitana do Recife.
      </p>

      <div class="hero-actions">
        <a href="#mapa" class="btn btn-primary">
          🗺️ Ver Mapa de Alagamentos
        </a>
        <a href="#sobre" class="btn btn-secondary">
          Saiba Mais
        </a>
      </div>
    </div>
  </section>
</template>
