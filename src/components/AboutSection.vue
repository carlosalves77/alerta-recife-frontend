<script setup lang="ts">
import { ref, onMounted } from 'vue'
import axios from 'axios'

const floodingPointsCount = ref(0)
const neighborhoodsCount = ref(0)

onMounted(async () => {
  try {
    const response = await axios.get('https://recifeapi.carldev.online/api/v1/flooding')
    const data = response.data

    floodingPointsCount.value = data.length

    const uniqueNeighborhoods = new Set(data.map((point: any) => point.neighborhood))
    neighborhoodsCount.value = uniqueNeighborhoods.size
  } catch (error) {
    console.error('Erro ao buscar dados de alagamento:', error)
  }
})
</script>

<template>
  <section class="about-section" id="sobre">
    <div class="about-section-header">
      <div class="section-tag">💡 Sobre o Projeto</div>
      <h2>Conheça o Alerta Recife</h2>
      <p>
        Uma iniciativa para mapear e informar sobre áreas de risco de alagamento
        na Região Metropolitana do Recife.
      </p>
    </div>

    <div class="about-cards">
      <div class="about-card">
        <div class="about-card-icon">🌧️</div>
        <h3>O que é</h3>
        <p>
          O Alerta Recife é um mapa interativo que identifica os pontos críticos
          de alagamento na Grande Recife, ajudando moradores e motoristas
          a evitar áreas perigosas durante chuvas intensas.
        </p>
      </div>

      <div class="about-card">
        <div class="about-card-icon">📡</div>
        <h3>Como funciona</h3>
        <p>
          Utilizamos dados georreferenciados e relatos de moradores para mapear
          os locais com maior incidência de alagamentos. As informações são
          atualizadas continuamente para refletir a situação real.
        </p>
      </div>

      <div class="about-card">
        <div class="about-card-icon">🤝</div>
        <h3>Como contribuir</h3>
        <p>
          Você pode reportar novos pontos de alagamento, confirmar ocorrências
          existentes e compartilhar o mapa com sua comunidade. Juntos, podemos
          salvar vidas e reduzir prejuízos.
        </p>
      </div>
    </div>

    <div class="stats-bar">
      <div class="stat-item">
        <div class="stat-number">{{ floodingPointsCount }}</div>
        <div class="stat-label">Pontos mapeados</div>
      </div>
      <div class="stat-item">
        <div class="stat-number">{{ neighborhoodsCount }}</div>
        <div class="stat-label">Bairros cobertos</div>
      </div>
      <div class="stat-item">
        <div class="stat-number">24/7</div>
        <div class="stat-label">Monitoramento</div>
      </div>
    </div>
  </section>
</template>
