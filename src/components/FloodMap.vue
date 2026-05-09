<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { riskColors, riskLabels, intensityToRisk, riskToIntensity, type FloodPoint } from '../data/floodData'
import axios from 'axios'
import api from '../services/api'

// Toast notification state
const toastMessage = ref('')
const toastType = ref<'error' | 'success' | 'info'>('info')
const showToast = ref(false)
let toastTimer: ReturnType<typeof setTimeout> | null = null

function displayToast(message: string, type: 'error' | 'success' | 'info' = 'info', duration = 5000) {
  toastMessage.value = message
  toastType.value = type
  showToast.value = true
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    showToast.value = false
  }, duration)
}

function dismissToast() {
  showToast.value = false
  if (toastTimer) clearTimeout(toastTimer)
}

const mapContainerRef = ref<HTMLElement | null>(null)
const mapToken = import.meta.env.VITE_MAPBOX_TOKEN as string
const hasToken = ref(!!mapToken)
let map: mapboxgl.Map | null = null

// Recife center for proximity bias
const RECIFE_LNG = -34.8770
const RECIFE_LAT = -8.0476

// Search state
const searchQuery = ref('')
const suggestions = ref<Array<{
  id: string
  name: string
  full_address: string
  lat: number
  lng: number
}>>([])
const isSearching = ref(false)
const showSuggestions = ref(false)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

// Draggable marker state
const isDraggableMode = ref(false)
const showConfirmLocation = ref(false)
const dragAddress = ref('')
const dragCoords = ref<{ lat: number; lng: number } | null>(null)
const isResolvingAddress = ref(false)
let draggableMarker: mapboxgl.Marker | null = null

// New point form state
const showNewPointForm = ref(false)
const selectedLocation = ref<{ name: string; lat: number; lng: number; full_address: string } | null>(null)
const newPointRisk = ref<FloodPoint['riskLevel']>('medio')
const newPointDescription = ref('')
const newPointLogger = ref('Anônimo')

const newPointReferencePoint = ref('')
const isSubmitting = ref(false)

// Dynamic points (added by user)
const dynamicPoints = ref<FloodPoint[]>([])
const dynamicMarkers: mapboxgl.Marker[] = []
let nextId = 100

// Backend flood points
const backendPoints = ref<FloodPoint[]>([])

async function searchGeocode(query: string) {
  if (!query || query.length < 3 || !mapToken) return

  isSearching.value = true
  try {
    const { data } = await axios.get('https://api.mapbox.com/search/geocode/v6/forward', {
      params: {
        q: query,
        access_token: mapToken,
        autocomplete: true,
        country: 'br',
        proximity: `${RECIFE_LNG},${RECIFE_LAT}`,
        language: 'pt',
        limit: 5,
        types: 'address,street,place,neighborhood,locality'
      }
    })

    suggestions.value = (data.features || []).map((f: any) => ({
      id: f.id,
      name: f.properties?.name || f.properties?.full_address || '',
      full_address: f.properties?.full_address || '',
      lng: f.geometry?.coordinates?.[0] ?? 0,
      lat: f.geometry?.coordinates?.[1] ?? 0
    }))

    showSuggestions.value = suggestions.value.length > 0
  } catch (e) {
    console.error('Geocoding error:', e)
    suggestions.value = []
  } finally {
    isSearching.value = false
  }
}

function onSearchInput() {
  if (debounceTimer) clearTimeout(debounceTimer)
  if (searchQuery.value.length < 3) {
    suggestions.value = []
    showSuggestions.value = false
    return
  }
  debounceTimer = setTimeout(() => {
    searchGeocode(searchQuery.value)
  }, 400)
}

function selectSuggestion(suggestion: typeof suggestions.value[0]) {
  showSuggestions.value = false

  // Activate draggable mode and move marker to the suggestion
  if (map) {
    activateDraggableMode()
    if (draggableMarker) {
      draggableMarker.setLngLat([suggestion.lng, suggestion.lat])
    }
    map.flyTo({ center: [suggestion.lng, suggestion.lat], zoom: 15, duration: 1500 })

    // Pre-fill the address from the suggestion
    dragAddress.value = suggestion.full_address || suggestion.name
    dragCoords.value = { lat: suggestion.lat, lng: suggestion.lng }
    showConfirmLocation.value = true
    searchQuery.value = suggestion.full_address || suggestion.name
  }
}

// ─── Draggable Marker ──────────────────────────────────────────

function activateDraggableMode() {
  if (!map) return

  // Already active? just show it
  if (draggableMarker) {
    isDraggableMode.value = true
    return
  }

  isDraggableMode.value = true
  showConfirmLocation.value = false
  dragAddress.value = ''
  dragCoords.value = null

  const center = map.getCenter()

  // Create the custom draggable pin element
  const el = document.createElement('div')
  el.className = 'draggable-pin'
  el.innerHTML = `
    <div class="pin-head">
      <div class="pin-icon">📍</div>
    </div>
    <div class="pin-spike"></div>
    <div class="pin-shadow"></div>
  `

  draggableMarker = new mapboxgl.Marker({
    element: el,
    draggable: true,
    anchor: 'bottom'
  })
    .setLngLat([center.lng, center.lat])
    .addTo(map)

  // Drag events
  draggableMarker.on('dragstart', () => {
    el.classList.add('dragging')
    showConfirmLocation.value = false
  })

  draggableMarker.on('dragend', () => {
    el.classList.remove('dragging')
    const lngLat = draggableMarker!.getLngLat()
    dragCoords.value = { lat: parseFloat(lngLat.lat.toFixed(6)), lng: parseFloat(lngLat.lng.toFixed(6)) }
    reverseGeocode(lngLat.lng, lngLat.lat)
  })

  // Initial drop animation
  el.classList.add('pin-drop')
  setTimeout(() => el.classList.remove('pin-drop'), 600)
}

async function reverseGeocode(lng: number, lat: number) {
  isResolvingAddress.value = true
  showConfirmLocation.value = true

  try {
    const { data } = await axios.get(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json`, {
      params: {
        access_token: mapToken,
        types: 'address',
        language: 'pt',
        limit: 1
      }
    })

    const feature = data.features?.[0]
    dragAddress.value = feature?.place_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`
  } catch (e) {
    console.error('Reverse geocoding error:', e)
    dragAddress.value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`
  } finally {
    isResolvingAddress.value = false
  }
}

function confirmDragLocation() {
  if (!dragCoords.value) return

  selectedLocation.value = {
    name: dragAddress.value,
    lat: dragCoords.value.lat,
    lng: dragCoords.value.lng,
    full_address: dragAddress.value
  }

  showConfirmLocation.value = false
  showNewPointForm.value = true

  // Scroll form into view
  setTimeout(() => {
    document.querySelector('.new-point-form')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, 400)
}

function cancelDraggableMode() {
  isDraggableMode.value = false
  showConfirmLocation.value = false
  showNewPointForm.value = false
  dragAddress.value = ''
  dragCoords.value = null
  searchQuery.value = ''

  if (draggableMarker) {
    draggableMarker.remove()
    draggableMarker = null
  }

  // Also reset form
  selectedLocation.value = null
  newPointDescription.value = ''
  newPointRisk.value = 'medio'
  newPointReferencePoint.value = ''
}

function cancelNewPoint() {
  showNewPointForm.value = false
  selectedLocation.value = null
  newPointDescription.value = ''
  newPointRisk.value = 'medio'
  newPointReferencePoint.value = ''
  searchQuery.value = ''

  // Go back to confirm location mode if marker is still there
  if (draggableMarker && dragCoords.value) {
    showConfirmLocation.value = true
  } else {
    cancelDraggableMode()
  }
}

async function confirmNewPoint() {
  if (!selectedLocation.value || !map) return

  isSubmitting.value = true

  // Auto-extract street and neighborhood from address
  // e.g. "Rua José Leonel Lopes 163, Cajueiro Seco, Recife" → street: "José Leonel Lopes 163", neighborhood: "Cajueiro Seco"
  const addressParts = selectedLocation.value.full_address.split(',')
  const street = addressParts[0]?.trim() || ''
  const neighborhood = addressParts[1]?.trim() || ''
  const description = newPointDescription.value || 'Ponto de alagamento reportado por usuário.'
  const logger = newPointLogger.value.trim() || 'Anônimo'
  const referencePoint = newPointReferencePoint.value.trim() || null

  // POST to backend
  try {
    const body: Record<string, unknown> = {
      intensity: riskToIntensity[newPointRisk.value],
      street,
      logger,
      description,
      latitude: selectedLocation.value.lat,
      neighborhood,
      longitude: selectedLocation.value.lng
    }

    if (referencePoint) {
      body.referencePoint = referencePoint
    }

    const { data } = await api.post('/flooding', body)

    const point: FloodPoint = {
      id: data.id ?? nextId++,
      name: selectedLocation.value.name,
      street,
      referencePoint: referencePoint ?? undefined,
      lat: selectedLocation.value.lat,
      lng: selectedLocation.value.lng,
      riskLevel: newPointRisk.value,
      description,
      neighborhood,
      logger,
      confirmationVotes: 0
    }

    dynamicPoints.value.push(point)
    addMarkerToMap(point)
    displayToast('Ponto de alagamento registrado com sucesso!', 'success')
  } catch (e: any) {
    console.error('Erro ao salvar ponto de alagamento:', e)

    // Handle 409 Conflict — nearby active point
    if (e?.response?.status === 409) {
      const msg = e.response.data?.message || 'Já existe um alerta ativo muito próximo a este local.'
      displayToast(`⚠️ ${msg}`, 'error', 6000)
    } else {
      displayToast('Erro ao registrar ponto. Tente novamente.', 'error')
    }
  } finally {
    isSubmitting.value = false
  }

  // Clean up draggable mode completely
  cancelDraggableMode()
}

function clearAllMarkers() {
  dynamicMarkers.forEach((m) => m.remove())
  dynamicMarkers.length = 0
}

async function fetchFloodPoints() {
  try {
    const { data } = await api.get<Array<{
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
    }>>('/flooding')

    backendPoints.value = data.map((item) => ({
      id: item.id,
      name: item.street || item.neighborhood,
      street: item.street,
      referencePoint: item.referencePoint ?? undefined,
      lat: item.latitude,
      lng: item.longitude,
      riskLevel: intensityToRisk[item.intensity] || 'medio',
      description: item.description || '',
      neighborhood: item.neighborhood,
      logger: item.logger,
      confirmationVotes: item.confirmationVotes
    }))

    // Add backend points to map
    backendPoints.value.forEach((point) => {
      addMarkerToMap(point)
    })
  } catch (e) {
    console.error('Erro ao carregar pontos do backend:', e)
  }
}

async function refreshFloodPoints() {
  clearAllMarkers()
  dynamicPoints.value = []
  backendPoints.value = []
  await fetchFloodPoints()
}

async function voteForPoint(pointId: number) {
  try {
    await api.patch(`/flooding/${pointId}/votes`)
    displayToast('Voto registrado com sucesso! 👍', 'success')
    // Refresh all markers to show updated vote count
    await refreshFloodPoints()
  } catch (e: any) {
    console.error('Erro ao votar:', e)
    displayToast('Erro ao registrar voto. Tente novamente.', 'error')
  }
}

function addMarkerToMap(point: FloodPoint) {
  if (!map) return

  const el = document.createElement('div')
  el.className = `flood-marker risk-${point.riskLevel}`

  const votes = point.confirmationVotes ?? 0
  const loggerName = point.logger || 'Anônimo'

  const popup = new mapboxgl.Popup({ offset: 15, maxWidth: '300px' })
    .setHTML(`
      <div class="popup-content">
        <div class="popup-name">${point.street || point.name}</div>
        <div class="popup-neighborhood">📍 ${point.neighborhood}</div>
        ${point.referencePoint ? `<div class="popup-reference">🏠 ${point.referencePoint}</div>` : ''}
        <div class="popup-risk risk-${point.riskLevel}">
          ⚠️ Risco ${riskLabels[point.riskLevel]}
        </div>
        ${point.description ? `<div class="popup-description">${point.description}</div>` : ''}
        <div class="popup-logger">👤 ${loggerName}</div>
        <div class="popup-votes">
          <button class="popup-vote-btn" data-point-id="${point.id}" title="Confirmar alagamento">
            👍
          </button>
          <span class="popup-vote-count">${votes}</span>
          <span class="popup-vote-label">confirmações</span>
        </div>
      </div>
    `)

  const marker = new mapboxgl.Marker({ element: el })
    .setLngLat([point.lng, point.lat])
    .setPopup(popup)
    .addTo(map)

  dynamicMarkers.push(marker)
}

function closeSuggestionsOnClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.search-autocomplete')) {
    showSuggestions.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', closeSuggestionsOnClickOutside)

  // Event delegation for vote buttons inside map popups
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement
    const voteBtn = target.closest('.popup-vote-btn') as HTMLElement | null
    if (voteBtn) {
      const pointId = voteBtn.getAttribute('data-point-id')
      if (pointId) {
        voteForPoint(Number(pointId))
      }
    }
  })

  if (!mapToken || !mapContainerRef.value) return

  map = new mapboxgl.Map({
    container: mapContainerRef.value,
    style: 'mapbox://styles/mapbox/dark-v11',
    center: [RECIFE_LNG, RECIFE_LAT],
    zoom: 11.5,
    accessToken: mapToken,
    maxBounds: [
      [-41.35, -9.48], // Sudoeste de Pernambuco
      [-34.79, -7.38]  // Nordeste de Pernambuco
    ]
  })

  map.addControl(new mapboxgl.NavigationControl(), 'top-right')

  map.on('load', () => {
    // Fetch flood points from backend API
    fetchFloodPoints()
  })
})

onUnmounted(() => {
  document.removeEventListener('click', closeSuggestionsOnClickOutside)
  if (debounceTimer) clearTimeout(debounceTimer)
  if (toastTimer) clearTimeout(toastTimer)
  if (draggableMarker) draggableMarker.remove()
  map?.remove()
})
</script>

<template>
  <section class="map-section" id="mapa">
    <div class="map-section-header">
      <div class="section-tag">📍 Mapa Interativo</div>
      <h2>Pontos de Alagamento</h2>
      <p>Explore os locais com maior incidência de alagamentos na Grande Recife.</p>
    </div>

    <!-- Search Bar -->
    <div v-if="hasToken" class="search-bar-wrapper">
      <div class="search-autocomplete">
        <div class="search-input-container">
          <span class="search-icon">🔍</span>
          <input
            id="geocode-search"
            v-model="searchQuery"
            type="text"
            placeholder="Buscar rua, avenida ou local..."
            autocomplete="off"
            @input="onSearchInput"
            @focus="showSuggestions = suggestions.length > 0"
          />
          <span v-if="isSearching" class="search-spinner"></span>
          <button v-if="searchQuery" class="search-clear" @click="searchQuery = ''; suggestions = []; showSuggestions = false">✕</button>
        </div>

        <!-- Suggestions dropdown -->
        <ul v-if="showSuggestions" class="search-suggestions">
          <li
            v-for="s in suggestions"
            :key="s.id"
            class="search-suggestion-item"
            @click="selectSuggestion(s)"
          >
            <span class="suggestion-icon">📍</span>
            <div class="suggestion-text">
              <div class="suggestion-name">{{ s.name }}</div>
              <div class="suggestion-address">{{ s.full_address }}</div>
            </div>
            <div class="suggestion-coords">
              {{ s.lat.toFixed(4) }}, {{ s.lng.toFixed(4) }}
            </div>
          </li>
        </ul>
      </div>

      <!-- New Point Form (appears after confirming dragged location) -->
      <Transition name="slide-form">
        <div v-if="showNewPointForm && selectedLocation" class="new-point-form">
          <div class="form-header">
            <h3>📌 Criar Ponto de Alagamento</h3>
            <button class="form-close" @click="cancelNewPoint">✕</button>
          </div>

          <div class="form-location-info">
            <div class="form-location-name">{{ selectedLocation.name }}</div>
            <div class="form-location-coords">
              Lat: <strong>{{ selectedLocation.lat.toFixed(6) }}</strong> &nbsp;|&nbsp;
              Lng: <strong>{{ selectedLocation.lng.toFixed(6) }}</strong>
            </div>
          </div>



          <div class="form-field">
            <label for="point-reference">Ponto de Referência (opcional)</label>
            <input
              id="point-reference"
              v-model="newPointReferencePoint"
              type="text"
              class="form-input"
              placeholder="Ex: Próximo ao Mercado São José"
            />
          </div>

          <div class="form-field">
            <label>Nível de Risco</label>
            <div class="risk-selector">
              <button
                class="risk-option"
                :class="{ active: newPointRisk === 'baixo', 'risk-baixo': true }"
                @click="newPointRisk = 'baixo'"
              >
                <span class="risk-dot" :style="{ background: riskColors.baixo }"></span>
                Baixo
              </button>
              <button
                class="risk-option"
                :class="{ active: newPointRisk === 'medio', 'risk-medio': true }"
                @click="newPointRisk = 'medio'"
              >
                <span class="risk-dot" :style="{ background: riskColors.medio }"></span>
                Médio
              </button>
              <button
                class="risk-option"
                :class="{ active: newPointRisk === 'alto', 'risk-alto': true }"
                @click="newPointRisk = 'alto'"
              >
                <span class="risk-dot" :style="{ background: riskColors.alto }"></span>
                Alto
              </button>
            </div>
          </div>

          <div class="form-field">
            <label for="point-logger">Seu Nome</label>
            <input
              id="point-logger"
              v-model="newPointLogger"
              type="text"
              class="form-input"
              placeholder="Seu nome (ex: Carlos Alves)"
            />
          </div>

          <div class="form-field">
            <label for="point-description">Descrição (opcional)</label>
            <textarea
              id="point-description"
              v-model="newPointDescription"
              placeholder="Descreva a situação do alagamento neste local..."
              rows="3"
            ></textarea>
          </div>

          <div class="form-actions">
            <button class="btn btn-secondary btn-sm" @click="cancelNewPoint" :disabled="isSubmitting">Cancelar</button>
            <button class="btn btn-primary btn-sm" @click="confirmNewPoint" :disabled="isSubmitting">
              <span v-if="isSubmitting" class="search-spinner" style="width:14px;height:14px;border-width:2px;"></span>
              {{ isSubmitting ? 'Enviando...' : '✓ Adicionar Ponto' }}
            </button>
          </div>
        </div>
      </Transition>
    </div>

    <div class="map-wrapper">
      <!-- Map renders here -->
      <div v-if="hasToken" ref="mapContainerRef" class="map-container"></div>

      <!-- No token fallback -->
      <div v-else class="map-no-token">
        <div class="icon">🗺️</div>
        <p>Token do Mapbox não configurado</p>
        <p>Adicione seu token no arquivo:</p>
        <code>VITE_MAPBOX_TOKEN=seu_token</code>
      </div>

      <!-- Floating action button to activate draggable mode -->
      <Transition name="fab-fade">
        <button
          v-if="hasToken && !isDraggableMode"
          class="fab-report"
          @click="activateDraggableMode"
          title="Reportar alagamento"
        >
          <span class="fab-icon">🚨</span>
          <span class="fab-label">Reportar Alagamento</span>
        </button>
      </Transition>

      <!-- Draggable mode banner -->
      <Transition name="banner-slide">
        <div v-if="isDraggableMode && !showConfirmLocation && !showNewPointForm" class="drag-banner">
          <div class="drag-banner-icon">✋</div>
          <div class="drag-banner-text">
            <strong>Arraste o marcador</strong> para o local do alagamento
          </div>
          <button class="drag-banner-cancel" @click="cancelDraggableMode">Cancelar</button>
        </div>
      </Transition>

      <!-- Confirm location floating card -->
      <Transition name="confirm-slide">
        <div v-if="showConfirmLocation && !showNewPointForm" class="confirm-location-card">
          <div class="confirm-location-header">
            <span class="confirm-location-icon">📍</span>
            <div class="confirm-location-info">
              <div v-if="isResolvingAddress" class="confirm-address-loading">
                <span class="search-spinner" style="width:14px;height:14px;border-width:2px;"></span>
                Buscando endereço...
              </div>
              <div v-else class="confirm-address">{{ dragAddress }}</div>
              <div v-if="dragCoords" class="confirm-coords">
                {{ dragCoords.lat.toFixed(6) }}, {{ dragCoords.lng.toFixed(6) }}
              </div>
            </div>
          </div>
          <div class="confirm-location-actions">
            <button class="btn btn-secondary btn-sm" @click="cancelDraggableMode">Cancelar</button>
            <button class="btn btn-primary btn-sm" @click="confirmDragLocation" :disabled="isResolvingAddress">
              ✓ Confirmar Local
            </button>
          </div>
        </div>
      </Transition>

      <!-- Legend overlay -->
      <div v-if="hasToken" class="map-legend">
        <h4>Nível de Risco</h4>
        <div class="map-legend-items">
          <div class="map-legend-item">
            <div class="map-legend-dot" :style="{ background: riskColors.alto }"></div>
            <span>Alto</span>
          </div>
          <div class="map-legend-item">
            <div class="map-legend-dot" :style="{ background: riskColors.medio }"></div>
            <span>Médio</span>
          </div>
          <div class="map-legend-item">
            <div class="map-legend-dot" :style="{ background: riskColors.baixo }"></div>
            <span>Baixo</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Toast Notification -->
    <Transition name="toast-slide">
      <div
        v-if="showToast"
        class="toast-notification"
        :class="`toast-${toastType}`"
        @click="dismissToast"
      >
        <span class="toast-icon">
          {{ toastType === 'error' ? '🚫' : toastType === 'success' ? '✅' : 'ℹ️' }}
        </span>
        <span class="toast-text">{{ toastMessage }}</span>
        <button class="toast-close" @click.stop="dismissToast">✕</button>
      </div>
    </Transition>
  </section>
</template>
