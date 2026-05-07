<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { floodPoints, riskColors, riskLabels, type FloodPoint } from '../data/floodData'

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

// New point form state
const showNewPointForm = ref(false)
const selectedLocation = ref<{ name: string; lat: number; lng: number; full_address: string } | null>(null)
const newPointRisk = ref<FloodPoint['riskLevel']>('medio')
const newPointDescription = ref('')

// Dynamic points (added by user)
const dynamicPoints = ref<FloodPoint[]>([])
const dynamicMarkers: mapboxgl.Marker[] = []
let nextId = 100

// Preview marker for selected search result
let previewMarker: mapboxgl.Marker | null = null

async function searchGeocode(query: string) {
  if (!query || query.length < 3 || !mapToken) return

  isSearching.value = true
  try {
    const params = new URLSearchParams({
      q: query,
      access_token: mapToken,
      autocomplete: 'true',
      country: 'br',
      proximity: `${RECIFE_LNG},${RECIFE_LAT}`,
      language: 'pt',
      limit: '5',
      types: 'address,street,place,neighborhood,locality'
    })

    const res = await fetch(
      `https://api.mapbox.com/search/geocode/v6/forward?${params.toString()}`
    )

    if (!res.ok) throw new Error('Geocoding request failed')

    const data = await res.json()

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
  }, 350)
}

function selectSuggestion(suggestion: typeof suggestions.value[0]) {
  selectedLocation.value = {
    name: suggestion.name,
    lat: suggestion.lat,
    lng: suggestion.lng,
    full_address: suggestion.full_address
  }

  searchQuery.value = suggestion.full_address || suggestion.name
  showSuggestions.value = false
  showNewPointForm.value = true

  // Fly to selected location and show preview marker
  if (map) {
    map.flyTo({ center: [suggestion.lng, suggestion.lat], zoom: 15, duration: 1500 })

    // Remove old preview marker
    if (previewMarker) {
      previewMarker.remove()
      previewMarker = null
    }

    // Add preview marker (blue pulsing)
    const el = document.createElement('div')
    el.className = 'flood-marker flood-marker-preview'
    previewMarker = new mapboxgl.Marker({ element: el })
      .setLngLat([suggestion.lng, suggestion.lat])
      .addTo(map)
  }
}

function cancelNewPoint() {
  showNewPointForm.value = false
  selectedLocation.value = null
  searchQuery.value = ''
  newPointDescription.value = ''
  newPointRisk.value = 'medio'

  if (previewMarker) {
    previewMarker.remove()
    previewMarker = null
  }
}

function confirmNewPoint() {
  if (!selectedLocation.value || !map) return

  const point: FloodPoint = {
    id: nextId++,
    name: selectedLocation.value.name,
    lat: selectedLocation.value.lat,
    lng: selectedLocation.value.lng,
    riskLevel: newPointRisk.value,
    description: newPointDescription.value || 'Ponto de alagamento reportado por usuário.',
    neighborhood: selectedLocation.value.full_address.split(',')[1]?.trim() || ''
  }

  dynamicPoints.value.push(point)
  addMarkerToMap(point)

  // Remove preview marker
  if (previewMarker) {
    previewMarker.remove()
    previewMarker = null
  }

  // Reset form
  showNewPointForm.value = false
  selectedLocation.value = null
  searchQuery.value = ''
  newPointDescription.value = ''
  newPointRisk.value = 'medio'
}

function addMarkerToMap(point: FloodPoint) {
  if (!map) return

  const el = document.createElement('div')
  el.className = `flood-marker risk-${point.riskLevel}`

  const popup = new mapboxgl.Popup({ offset: 15, maxWidth: '280px' })
    .setHTML(`
      <div class="popup-content">
        <div class="popup-name">${point.name}</div>
        <div class="popup-neighborhood">📍 ${point.neighborhood}</div>
        <div class="popup-risk risk-${point.riskLevel}">
          ⚠️ Risco ${riskLabels[point.riskLevel]}
        </div>
        <div class="popup-description">${point.description}</div>
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

  if (!mapToken || !mapContainerRef.value) return

  map = new mapboxgl.Map({
    container: mapContainerRef.value,
    style: 'mapbox://styles/mapbox/dark-v11',
    center: [RECIFE_LNG, RECIFE_LAT],
    zoom: 11.5,
    accessToken: mapToken
  })

  map.addControl(new mapboxgl.NavigationControl(), 'top-right')

  map.on('load', () => {
    // Add static flood points
    floodPoints.forEach((point) => {
      addMarkerToMap(point)
    })
  })
})

onUnmounted(() => {
  document.removeEventListener('click', closeSuggestionsOnClickOutside)
  if (debounceTimer) clearTimeout(debounceTimer)
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
          <button v-if="searchQuery" class="search-clear" @click="cancelNewPoint">✕</button>
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

      <!-- New Point Form (appears after selecting a location) -->
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
            <label for="point-description">Descrição (opcional)</label>
            <textarea
              id="point-description"
              v-model="newPointDescription"
              placeholder="Descreva a situação do alagamento neste local..."
              rows="3"
            ></textarea>
          </div>

          <div class="form-actions">
            <button class="btn btn-secondary btn-sm" @click="cancelNewPoint">Cancelar</button>
            <button class="btn btn-primary btn-sm" @click="confirmNewPoint">
              ✓ Adicionar Ponto
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
  </section>
</template>
