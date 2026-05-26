<script setup lang="ts">
import { ref, watch } from 'vue'
import api from '../services/api'
import { intensityToRisk, riskLabels, type FloodPoint } from '../data/floodData'

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

async function fetchMyPoints() {
  isLoading.value = true
  loadError.value = ''
  try {
    const { data } = await api.get<UserFloodPoint[]>('/flooding/user')
    points.value = data
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

// Fetch points when panel becomes visible
watch(() => props.visible, (val) => {
  if (val) {
    fetchMyPoints()
  } else {
    // Reset state on close
    showDeleteConfirm.value = false
    deleteTargetId.value = null
    loadError.value = ''
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

      <!-- Points List -->
      <div v-else class="my-points-list">
        <div
          v-for="point in points"
          :key="point.id"
          class="my-point-card"
        >
          <!-- Card Image -->
          <div v-if="point.images && point.images.length > 0" class="my-point-image">
            <img :src="point.images[0]" :alt="point.street" loading="lazy" />
            <div v-if="point.images.length > 1" class="my-point-image-count">
              📷 {{ point.images.length }}
            </div>
          </div>

          <!-- Card Content -->
          <div class="my-point-content">
            <div class="my-point-street">{{ point.street }}</div>
            <div class="my-point-neighborhood">📍 {{ point.neighborhood }}</div>
            <div
              v-if="point.referencePoint"
              class="my-point-reference"
            >🏠 {{ point.referencePoint }}</div>

            <div class="my-point-meta">
              <span
                class="my-point-risk"
                :class="`risk-${getRiskLevel(point.intensity)}`"
              >
                ⚠️ {{ riskLabels[getRiskLevel(point.intensity)] }}
              </span>
              <span class="my-point-votes">
                👍 {{ point.confirmationVotes }}
              </span>
            </div>

            <p v-if="point.description" class="my-point-description">{{ point.description }}</p>
          </div>

          <!-- Card Actions -->
          <div class="my-point-actions">
            <button
              class="my-point-delete-btn"
              @click="requestDelete(point.id)"
              title="Deletar ponto"
            >
              🗑️ Deletar
            </button>
          </div>
        </div>
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
