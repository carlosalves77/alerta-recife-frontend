<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, nextTick, watch } from 'vue'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { riskColors, riskLabels, intensityToRisk, riskToIntensity, type FloodPoint } from '../data/floodData'
import axios from 'axios'
import api from '../services/api'
import authService from '../services/authService'
import { useRouter } from 'vue-router'

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
const floodRouter = useRouter()

// Auth check for creating flood points
function handleReportClick() {
  if (!authService.isAuthenticated()) {
    displayToast('🔒 Você precisa estar logado para reportar um alagamento.', 'error', 4000)
    setTimeout(() => {
      floodRouter.push({ path: '/login', query: { mode: 'login' } })
    }, 1500)
    return
  }
  activateDraggableMode()
}

// Recife center for proximity bias
const RECIFE_LNG = -34.8770
const RECIFE_LAT = -8.0476



// Draggable marker state
const isDraggableMode = ref(false)
const showConfirmLocation = ref(false)
const dragAddress = ref('')
const dragCoords = ref<{ lat: number; lng: number } | null>(null)
const isResolvingAddress = ref(false)
const dragLocationValid = ref(false)
let draggableMarker: mapboxgl.Marker | null = null

// New point form state
const showNewPointForm = ref(false)
const selectedLocation = ref<{ name: string; lat: number; lng: number; full_address: string } | null>(null)
const newPointRisk = ref<FloodPoint['riskLevel']>('medio')
const newPointDescription = ref('')
const newPointLogger = computed(() => {
  return authService.getCachedProfile()?.username || 'Anônimo'
})

const newPointReferencePoint = ref('')

// Photo upload state
const selectedPhotos = ref<File[]>([])
const photoPreviewUrls = ref<string[]>([])
const fileInputRef = ref<HTMLInputElement | null>(null)
const MAX_PHOTOS = 6

function triggerFileInput() {
  fileInputRef.value?.click()
}

function onPhotoSelected(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files) return

  const newFiles = Array.from(input.files)
  const remaining = MAX_PHOTOS - selectedPhotos.value.length

  if (remaining <= 0) {
    displayToast(`Limite de ${MAX_PHOTOS} fotos atingido.`, 'error')
    input.value = ''
    return
  }

  const filesToAdd = newFiles.slice(0, remaining)
  if (newFiles.length > remaining) {
    displayToast(`Apenas ${remaining} foto(s) adicionada(s). Limite: ${MAX_PHOTOS}.`, 'info')
  }

  // Validate file types
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  const validFiles = filesToAdd.filter(f => {
    if (!validTypes.includes(f.type)) {
      displayToast(`Arquivo "${f.name}" não é uma imagem válida.`, 'error')
      return false
    }
    if (f.size > 10 * 1024 * 1024) {
      displayToast(`Arquivo "${f.name}" excede 10MB.`, 'error')
      return false
    }
    return true
  })

  validFiles.forEach(file => {
    selectedPhotos.value.push(file)
    photoPreviewUrls.value.push(URL.createObjectURL(file))
  })

  input.value = ''
}

function removePhoto(index: number) {
  URL.revokeObjectURL(photoPreviewUrls.value[index])
  selectedPhotos.value.splice(index, 1)
  photoPreviewUrls.value.splice(index, 1)
}

function clearPhotos() {
  photoPreviewUrls.value.forEach(url => URL.revokeObjectURL(url))
  selectedPhotos.value = []
  photoPreviewUrls.value = []
}
const isSubmitting = ref(false)

// Dynamic points (added by user)
const dynamicPoints = ref<FloodPoint[]>([])
const dynamicMarkers: mapboxgl.Marker[] = []
let nextId = 100

// Backend flood points
const backendPoints = ref<FloodPoint[]>([])



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
  dragLocationValid.value = false

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

    if (!feature) {
      // No address found — only coordinates
      dragAddress.value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`
      dragLocationValid.value = false
      return
    }

    const placeName = feature.place_name || ''
    dragAddress.value = placeName

    // Validate: must be in Pernambuco
    const inPernambuco = placeName.toLowerCase().includes('pernambuco')
    // Validate: must have a real street name (not just coordinates)
    const hasStreet = !!(feature.text && feature.text.trim().length > 0)

    dragLocationValid.value = inPernambuco && hasStreet
  } catch (e) {
    console.error('Reverse geocoding error:', e)
    dragAddress.value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`
    dragLocationValid.value = false
  } finally {
    isResolvingAddress.value = false
  }
}

function confirmDragLocation() {
  if (!dragCoords.value) return

  // Block if location is outside Pernambuco or has no resolved street
  if (!dragLocationValid.value) {
    displayToast(
      '🚫 Localização não permitida. O ponto deve estar dentro de Pernambuco e possuir um endereço válido com nome de rua.',
      'error',
      6000
    )
    return
  }

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


  if (draggableMarker) {
    draggableMarker.remove()
    draggableMarker = null
  }

  // Also reset form
  selectedLocation.value = null
  newPointDescription.value = ''
  newPointRisk.value = 'medio'
  newPointReferencePoint.value = ''
  clearPhotos()
}

function cancelNewPoint() {
  showNewPointForm.value = false
  selectedLocation.value = null
  newPointDescription.value = ''
  newPointRisk.value = 'medio'
  newPointReferencePoint.value = ''
  clearPhotos()

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

  // POST to backend as multipart/form-data
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

    const formData = new FormData()
    formData.append('data', new Blob([JSON.stringify(body)], { type: 'application/json' }))
    selectedPhotos.value.forEach(file => {
      formData.append('file', file)
    })

    const { data } = await api.post('/flooding', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })

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
      confirmationVotes: 0,
      images: data.images || []
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
    const { data } = await api.get('/flooding')

    // Defensive: handle non-array responses (e.g. paginated object or proxy misconfiguration)
    const items = Array.isArray(data) ? data : (Array.isArray(data?.content) ? data.content : null)
    if (!items) {
      console.error('Resposta inesperada do backend (não é um array):', typeof data, data)
      return
    }

    backendPoints.value = items.map((item: any) => ({
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
      confirmationVotes: item.confirmationVotes,
      images: item.images || [],
      user: item.user ?? undefined
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
  el.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" class="flood-icon-svg">
      <g fill="white">
        <path d="M 50 22 L 20 48 L 26 48 L 26 62 L 74 62 L 74 48 L 80 48 Z" />
        <rect x="62" y="24" width="8" height="16" />
      </g>
      <path d="M 20 70 Q 27.5 64 35 70 T 50 70 T 65 70 T 80 64" fill="none" stroke="white" stroke-width="5" stroke-linecap="round"/>
      <path d="M 20 82 Q 27.5 76 35 82 T 50 82 T 65 82 T 80 76" fill="none" stroke="white" stroke-width="5" stroke-linecap="round"/>
    </svg>
  `

  const votes = point.confirmationVotes ?? 0
  const images = point.images || []

  // Build user info HTML
  const userName = point.user?.username || point.logger || 'Anônimo'
  const userPicture = point.user?.profilePicture || ''
  let userHtml = ''
  if (userPicture) {
    userHtml = `
      <div class="popup-user">
        <img src="${userPicture}" alt="${userName}" class="popup-user-avatar" referrerpolicy="no-referrer" />
        <span class="popup-user-name">${userName}</span>
      </div>
    `
  } else {
    userHtml = `
      <div class="popup-user">
        <span class="popup-user-avatar-placeholder">👤</span>
        <span class="popup-user-name">${userName}</span>
      </div>
    `
  }

  // Build image carousel HTML
  let imagesHtml = ''
  if (images.length > 0) {
    const slides = images.map((url, i) => `
      <div class="popup-carousel-slide" data-gallery-src="${url}" data-gallery-index="${i}">
        <img src="${url}" alt="Foto ${i + 1}" loading="lazy" />
        <div class="popup-carousel-counter">${i + 1} / ${images.length}</div>
      </div>
    `).join('')
    imagesHtml = `
      <div class="popup-carousel">
        <div class="popup-carousel-track">${slides}</div>
        ${images.length > 1 ? `
          <button class="popup-carousel-btn prev" title="Anterior">❮</button>
          <button class="popup-carousel-btn next" title="Próxima">❯</button>
        ` : ''}
      </div>
    `
  }

  const popup = new mapboxgl.Popup({ offset: 15, maxWidth: '340px' })
    .setHTML(`
      <div class="popup-content">
        <div class="popup-name">${point.street || point.name}</div>
        <div class="popup-neighborhood">📍 ${point.neighborhood}</div>
        ${point.referencePoint ? `<div class="popup-reference">🏠 ${point.referencePoint}</div>` : ''}
        <div class="popup-risk risk-${point.riskLevel}">
          ⚠️ Risco ${riskLabels[point.riskLevel]}
        </div>
        ${point.description ? `<div class="popup-description">${point.description}</div>` : ''}
        ${imagesHtml}
        ${userHtml}
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

onMounted(() => {

  // Event delegation for vote buttons and gallery clicks inside map popups
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement

    // Vote button
    const voteBtn = target.closest('.popup-vote-btn') as HTMLElement | null
    if (voteBtn) {
      const pointId = voteBtn.getAttribute('data-point-id')
      if (pointId) {
        voteForPoint(Number(pointId))
      }
      return
    }

    // Carousel buttons
    const carouselBtn = target.closest('.popup-carousel-btn') as HTMLElement | null
    if (carouselBtn) {
      const carousel = carouselBtn.closest('.popup-carousel')
      const track = carousel?.querySelector('.popup-carousel-track')
      if (track) {
        const scrollAmount = track.clientWidth
        if (carouselBtn.classList.contains('next')) {
          track.scrollBy({ left: scrollAmount, behavior: 'smooth' })
        } else {
          track.scrollBy({ left: -scrollAmount, behavior: 'smooth' })
        }
      }
      return
    }

    // Gallery slide click — open lightbox
    const slide = target.closest('.popup-carousel-slide') as HTMLElement | null
    if (slide) {
      const popup = slide.closest('.popup-content')
      const allSlides = popup ? Array.from(popup.querySelectorAll('.popup-carousel-slide')) : []
      const slideImages = allSlides.map(s => s.getAttribute('data-gallery-src') || '')
      const index = Number(slide.getAttribute('data-gallery-index')) || 0
      openLightbox(slideImages.length ? slideImages : [slide.getAttribute('data-gallery-src') || ''], index)
      return
    }

    // Lightbox close
    if (target.closest('.lightbox-overlay') && !target.closest('.lightbox-image') && !target.closest('.lightbox-btn')) {
      closeLightbox()
    }
    if (target.closest('.lightbox-close')) {
      closeLightbox()
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

// Lightbox state
const lightboxImages = ref<string[]>([])
const lightboxIndex = ref(0)
const showLightbox = ref(false)

function openLightbox(images: string[], index: number) {
  lightboxImages.value = images
  lightboxIndex.value = index
  showLightbox.value = true
}

function closeLightbox() {
  showLightbox.value = false
}

function lightboxNext() {
  if (lightboxIndex.value < lightboxImages.value.length - 1) {
    lightboxIndex.value++
  } else {
    lightboxIndex.value = 0
  }
}

function lightboxPrev() {
  if (lightboxIndex.value > 0) {
    lightboxIndex.value--
  } else {
    lightboxIndex.value = lightboxImages.value.length - 1
  }
}

// Mobile fullscreen map state
const isMapExpanded = ref(false)

function expandMap() {
  isMapExpanded.value = true
  document.body.style.overflow = 'hidden'
  nextTick(() => {
    map?.resize()
    // Resize again after layout settles (CSS may not be fully applied on first nextTick)
    setTimeout(() => map?.resize(), 50)
    // Resize after the expand animation completes (350ms)
    setTimeout(() => map?.resize(), 400)
  })
}

function collapseMap() {
  isMapExpanded.value = false
  document.body.style.overflow = ''
  nextTick(() => {
    map?.resize()
  })
}

// Auto-expand map when entering draggable mode on mobile
watch(isDraggableMode, (val) => {
  if (val && window.innerWidth <= 768 && !isMapExpanded.value) {
    expandMap()
  }
})

onUnmounted(() => {
  if (toastTimer) clearTimeout(toastTimer)
  if (draggableMarker) draggableMarker.remove()
  clearPhotos()
  document.body.style.overflow = ''
  map?.remove()
})
</script>

<template>
  <section class="map-section" :class="{ 'map-expanded': isMapExpanded }" id="mapa">
    <div class="map-section-header">
      <div class="section-tag">📍 Mapa Interativo</div>
      <h2>Pontos de Alagamento</h2>
      <p>Explore os locais com maior incidência de alagamentos na Grande Recife.</p>
    </div>

    <div v-if="hasToken" class="search-bar-wrapper">

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
                <span class="risk-icon-wrapper" :style="{ background: riskColors.baixo }">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" class="flood-icon-svg">
                    <g fill="white">
                      <path d="M 50 22 L 20 48 L 26 48 L 26 62 L 74 62 L 74 48 L 80 48 Z" />
                      <rect x="62" y="24" width="8" height="16" />
                    </g>
                    <path d="M 20 70 Q 27.5 64 35 70 T 50 70 T 65 70 T 80 64" fill="none" stroke="white" stroke-width="5" stroke-linecap="round"/>
                    <path d="M 20 82 Q 27.5 76 35 82 T 50 82 T 65 82 T 80 76" fill="none" stroke="white" stroke-width="5" stroke-linecap="round"/>
                  </svg>
                </span>
                Baixo
              </button>
              <button
                class="risk-option"
                :class="{ active: newPointRisk === 'medio', 'risk-medio': true }"
                @click="newPointRisk = 'medio'"
              >
                <span class="risk-icon-wrapper" :style="{ background: riskColors.medio }">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" class="flood-icon-svg">
                    <g fill="white">
                      <path d="M 50 22 L 20 48 L 26 48 L 26 62 L 74 62 L 74 48 L 80 48 Z" />
                      <rect x="62" y="24" width="8" height="16" />
                    </g>
                    <path d="M 20 70 Q 27.5 64 35 70 T 50 70 T 65 70 T 80 64" fill="none" stroke="white" stroke-width="5" stroke-linecap="round"/>
                    <path d="M 20 82 Q 27.5 76 35 82 T 50 82 T 65 82 T 80 76" fill="none" stroke="white" stroke-width="5" stroke-linecap="round"/>
                  </svg>
                </span>
                Médio
              </button>
              <button
                class="risk-option"
                :class="{ active: newPointRisk === 'alto', 'risk-alto': true }"
                @click="newPointRisk = 'alto'"
              >
                <span class="risk-icon-wrapper" :style="{ background: riskColors.alto }">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" class="flood-icon-svg">
                    <g fill="white">
                      <path d="M 50 22 L 20 48 L 26 48 L 26 62 L 74 62 L 74 48 L 80 48 Z" />
                      <rect x="62" y="24" width="8" height="16" />
                    </g>
                    <path d="M 20 70 Q 27.5 64 35 70 T 50 70 T 65 70 T 80 64" fill="none" stroke="white" stroke-width="5" stroke-linecap="round"/>
                    <path d="M 20 82 Q 27.5 76 35 82 T 50 82 T 65 82 T 80 76" fill="none" stroke="white" stroke-width="5" stroke-linecap="round"/>
                  </svg>
                </span>
                Alto
              </button>
            </div>
          </div>

          <div class="form-field">
            <label for="point-logger">Reportado por</label>
            <div class="form-readonly-value" id="point-logger">👤 {{ newPointLogger }}</div>
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

          <!-- Photo Upload -->
          <div class="form-field">
            <label>Fotos (máximo {{ MAX_PHOTOS }})</label>
            <input
              ref="fileInputRef"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              style="display: none"
              @change="onPhotoSelected"
            />
            <div class="photo-upload-area">
              <!-- Photo Previews -->
              <div v-if="photoPreviewUrls.length > 0" class="photo-preview-grid">
                <div
                  v-for="(url, index) in photoPreviewUrls"
                  :key="index"
                  class="photo-preview-item"
                >
                  <img :src="url" :alt="`Foto ${index + 1}`" />
                  <button class="photo-remove-btn" @click="removePhoto(index)" title="Remover foto">✕</button>
                </div>
                <!-- Add more button (if under limit) -->
                <button
                  v-if="selectedPhotos.length < MAX_PHOTOS"
                  class="photo-add-more"
                  @click="triggerFileInput"
                  title="Adicionar mais fotos"
                >
                  <span class="photo-add-icon">+</span>
                  <span class="photo-add-text">Adicionar</span>
                </button>
              </div>
              <!-- Empty state -->
              <button
                v-else
                class="photo-upload-btn"
                @click="triggerFileInput"
                type="button"
              >
                <span class="photo-upload-icon">📷</span>
                <span class="photo-upload-label">Clique para adicionar fotos</span>
                <span class="photo-upload-hint">JPG, PNG, WebP • Máx. 10MB cada</span>
              </button>
            </div>
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
      <!-- Mobile tap-to-expand overlay -->
      <div
        v-if="hasToken && !isMapExpanded && !isDraggableMode"
        class="map-expand-overlay"
        @click="expandMap"
      >
        <div class="map-expand-hint">
          <span class="map-expand-icon">⤢</span>
          <span>Toque para expandir</span>
        </div>
      </div>

      <!-- Close fullscreen button -->
      <Transition name="fab-fade">
        <button
          v-if="isMapExpanded"
          class="map-collapse-btn"
          @click="collapseMap"
          title="Fechar mapa"
        >
          ✕
        </button>
      </Transition>

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
          @click="handleReportClick"
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
          <div v-if="!isResolvingAddress && !dragLocationValid" class="confirm-location-warning">
            <span class="warning-icon">🚫</span>
            <span>Região não permitida. O ponto deve estar em <strong>Pernambuco</strong> e possuir um endereço válido.</span>
          </div>
          <div class="confirm-location-actions">
            <button class="btn btn-secondary btn-sm" @click="cancelDraggableMode">Cancelar</button>
            <button class="btn btn-primary btn-sm" @click="confirmDragLocation" :disabled="isResolvingAddress || !dragLocationValid">
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

    <!-- Lightbox Modal -->
    <Transition name="lightbox-fade">
      <div v-if="showLightbox" class="lightbox-overlay" @click.self="closeLightbox">
        <button class="lightbox-close" @click="closeLightbox">✕</button>
        
        <button v-if="lightboxImages.length > 1" class="lightbox-btn prev" @click.stop="lightboxPrev">❮</button>
        
        <img :src="lightboxImages[lightboxIndex]" class="lightbox-image" alt="Foto do alagamento" />
        
        <button v-if="lightboxImages.length > 1" class="lightbox-btn next" @click.stop="lightboxNext">❯</button>
        
        <div v-if="lightboxImages.length > 1" class="lightbox-counter">
          {{ lightboxIndex + 1 }} / {{ lightboxImages.length }}
        </div>
      </div>
    </Transition>
  </section>
</template>
