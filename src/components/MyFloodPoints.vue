<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import api from '../services/api'
import { intensityToRisk, riskLabels, riskColors, type FloodPoint } from '../data/floodData'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'deleted'): void
}>()

interface UserFloodPoint {
  id: number
  street: string
  logger: string
  referencePoint: string | null
  neighborhood: string
  description: string
  latitude: number
  longitude: number
  intensity: string
  confirmationVotes: number
  images: string[]
  user: {
    username: string
    profilePicture: string
  }
}

const points = ref<UserFloodPoint[]>([])
const isLoading = ref(false)
const loadError = ref('')

// Delete state
const deleteTargetId = ref<number | null>(null)
const showDeleteConfirm = ref(false)
const isDeleting = ref(false)

// Scroll shadow state
const scrollListRef = ref<HTMLElement | null>(null)
const showTopShadow = ref(false)
const showBottomShadow = ref(false)

function handleListScroll() {
  const el = scrollListRef.value
  if (!el) return
  showTopShadow.value = el.scrollTop > 8
  showBottomShadow.value = el.scrollTop < el.scrollHeight - el.clientHeight - 8
}

function updateScrollShadows() {
  nextTick(() => {
    handleListScroll()
  })
}

async function fetchMyPoints() {
  isLoading.value = true
  loadError.value = ''
  try {
    const { data } = await api.get<UserFloodPoint[]>('/flooding/user')
    points.value = data
    updateScrollShadows()
  } catch (e: any) {
    console.error('Erro ao carregar seus pontos:', e)
    loadError.value = 'Não foi possível carregar seus pontos de alagamento.'
  } finally {
    isLoading.value = false
  }
}

function requestDelete(id: number) {
  deleteTargetId.value = id
  showDeleteConfirm.value = true
}

function cancelDelete() {
  deleteTargetId.value = null
  showDeleteConfirm.value = false
}

async function confirmDelete() {
  if (deleteTargetId.value === null) return
  isDeleting.value = true
  try {
    await api.delete(`/flooding/${deleteTargetId.value}`)
    // Remove from local list
    points.value = points.value.filter(p => p.id !== deleteTargetId.value)
    showDeleteConfirm.value = false
    deleteTargetId.value = null
    updateScrollShadows()
    // Emit event so parent can refresh the map
    emit('deleted')
  } catch (e: any) {
    console.error('Erro ao deletar ponto:', e)
    loadError.value = 'Erro ao deletar o ponto. Tente novamente.'
  } finally {
    isDeleting.value = false
  }
}

function getRiskLevel(intensity: string): FloodPoint['riskLevel'] {
  return intensityToRisk[intensity] || 'medio'
}

function getRiskColor(intensity: string): string {
  return riskColors[getRiskLevel(intensity)]
}

// Fetch points when panel becomes visible
watch(() => props.visible, (val) => {
  if (val) {
    fetchMyPoints()
  } else {
    // Reset state on close
    showDeleteConfirm.value = false
    deleteTargetId.value = null
    loadError.value = ''
    showTopShadow.value = false
    showBottomShadow.value = false
  }
})
</script>

<template>
  <!-- Backdrop -->
  <Transition name="backdrop-fade">
    <div v-if="visible" class="my-points-backdrop" @click="emit('close')"></div>
  </Transition>

  <!-- Panel -->
  <Transition name="panel-slide">
    <div v-if="visible" class="my-points-panel">
      <div class="my-points-header">
        <div class="my-points-title">
          <span class="my-points-title-icon">📋</span>
          <h3>Meus Alertas</h3>
          <span v-if="!isLoading && points.length > 0" class="my-points-count">{{ points.length }}</span>
        </div>
        <button class="my-points-close" @click="emit('close')">✕</button>
      </div>

      <!-- Loading -->
      <div v-if="isLoading" class="my-points-loading">
        <span class="search-spinner" style="width:24px;height:24px;border-width:2px;"></span>
        <span>Carregando seus alertas...</span>
      </div>

      <!-- Error -->
      <div v-else-if="loadError" class="my-points-error">
        <span class="my-points-error-icon">⚠️</span>
        <span>{{ loadError }}</span>
        <button class="my-points-retry" @click="fetchMyPoints">Tentar novamente</button>
      </div>

      <!-- Empty State -->
      <div v-else-if="points.length === 0" class="my-points-empty">
        <span class="my-points-empty-icon">🌤️</span>
        <p>Você ainda não registrou nenhum ponto de alagamento.</p>
        <p class="my-points-empty-hint">Use o botão "Reportar Alagamento" no mapa para criar um.</p>
      </div>

      <!-- Scroll List -->
      <div v-else class="my-points-scroll-wrapper">
        <!-- Top scroll shadow -->
        <div class="scroll-shadow scroll-shadow-top" :class="{ visible: showTopShadow }"></div>

        <div
          ref="scrollListRef"
          class="my-points-scroll-list"
          @scroll="handleListScroll"
        >
          <div
            v-for="(point, index) in points"
            :key="point.id"
            class="my-point-item"
            :style="{ animationDelay: `${index * 60}ms` }"
          >
            <!-- Risk color accent bar -->
            <div class="my-point-item-accent" :style="{ background: getRiskColor(point.intensity) }"></div>

            <div class="my-point-item-body">
              <!-- Top row: street + risk badge -->
              <div class="my-point-item-top">
                <div class="my-point-item-info">
                  <div class="my-point-item-street">{{ point.street }}</div>
                  <div class="my-point-item-location">
                    <span>📍 {{ point.neighborhood }}</span>
                    <span v-if="point.referencePoint" class="my-point-item-ref">• 🏠 {{ point.referencePoint }}</span>
                  </div>
                </div>
                <span
                  class="my-point-item-badge"
                  :class="`risk-${getRiskLevel(point.intensity)}`"
                >
                  {{ riskLabels[getRiskLevel(point.intensity)] }}
                </span>
              </div>

              <!-- Image thumbnail + description row -->
              <div v-if="point.description || (point.images && point.images.length > 0)" class="my-point-item-middle">
                <div v-if="point.images && point.images.length > 0" class="my-point-item-thumb">
                  <img :src="point.images[0]" :alt="point.street" loading="lazy" />
                  <span v-if="point.images.length > 1" class="my-point-item-thumb-count">+{{ point.images.length - 1 }}</span>
                </div>
                <p v-if="point.description" class="my-point-item-desc">{{ point.description }}</p>
              </div>

              <!-- Bottom row: votes + delete -->
              <div class="my-point-item-bottom">
                <div class="my-point-item-votes">
                  <span class="my-point-item-votes-icon">👍</span>
                  <span class="my-point-item-votes-count">{{ point.confirmationVotes }}</span>
                  <span class="my-point-item-votes-label">confirmações</span>
                </div>
                <button
                  class="my-point-item-delete"
                  @click="requestDelete(point.id)"
                  title="Deletar ponto"
                >
                  🗑️ Deletar
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Bottom scroll shadow -->
        <div class="scroll-shadow scroll-shadow-bottom" :class="{ visible: showBottomShadow }"></div>
      </div>

      <!-- Delete Confirmation Modal -->
      <Transition name="modal-fade">
        <div v-if="showDeleteConfirm" class="delete-confirm-overlay" @click.self="cancelDelete">
          <div class="delete-confirm-modal">
            <div class="delete-confirm-icon">⚠️</div>
            <h4>Confirmar Exclusão</h4>
            <p>Tem certeza que deseja deletar este ponto de alagamento? Esta ação não pode ser desfeita.</p>
            <div class="delete-confirm-actions">
              <button class="btn btn-secondary btn-sm" @click="cancelDelete" :disabled="isDeleting">
                Cancelar
              </button>
              <button class="btn btn-danger btn-sm" @click="confirmDelete" :disabled="isDeleting">
                <span v-if="isDeleting" class="search-spinner" style="width:14px;height:14px;border-width:2px;"></span>
                {{ isDeleting ? 'Deletando...' : '🗑️ Deletar' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>
