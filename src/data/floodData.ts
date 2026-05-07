export const API_BASE = '/api/v1'

export interface FloodPoint {
  id: number
  name: string
  referencePoint?: string
  lat: number
  lng: number
  riskLevel: 'alto' | 'medio' | 'baixo'
  description: string
  neighborhood: string
  logger?: string
  confirmationVotes?: number
}

// Mapping between backend intensity values and frontend riskLevel
export const intensityToRisk: Record<string, FloodPoint['riskLevel']> = {
  ALTA: 'alto',
  MEDIA: 'medio',
  BAIXA: 'baixo'
}

export const riskToIntensity: Record<FloodPoint['riskLevel'], string> = {
  alto: 'ALTA',
  medio: 'MEDIA',
  baixo: 'BAIXA'
}

export const riskColors: Record<FloodPoint['riskLevel'], string> = {
  alto: '#ef4444',
  medio: '#f59e0b',
  baixo: '#06b6d4'
}

export const riskLabels: Record<FloodPoint['riskLevel'], string> = {
  alto: 'Alto',
  medio: 'Médio',
  baixo: 'Baixo'
}
