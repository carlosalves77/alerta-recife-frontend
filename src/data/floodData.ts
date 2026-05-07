export interface FloodPoint {
  id: number
  name: string
  lat: number
  lng: number
  riskLevel: 'alto' | 'medio' | 'baixo'
  description: string
  neighborhood: string
}

export const floodPoints: FloodPoint[] = [
  {
    id: 1,
    name: 'Av. Agamenon Magalhães (Derby)',
    lat: -8.0560,
    lng: -34.8950,
    riskLevel: 'alto',
    description: 'Alagamento frequente em dias de chuva forte. Via principal com acúmulo de água na pista.',
    neighborhood: 'Derby'
  },
  {
    id: 2,
    name: 'Av. Norte (Campo Grande)',
    lat: -8.0340,
    lng: -34.8870,
    riskLevel: 'alto',
    description: 'Região com histórico de alagamentos severos. Trânsito fica completamente parado.',
    neighborhood: 'Campo Grande'
  },
  {
    id: 3,
    name: 'Estrada de Belém',
    lat: -8.0220,
    lng: -34.8830,
    riskLevel: 'alto',
    description: 'Área baixa próxima ao Rio Capibaribe com inundações recorrentes.',
    neighborhood: 'Encruzilhada'
  },
  {
    id: 4,
    name: 'Dois Irmãos (Entrada do Parque)',
    lat: -8.0130,
    lng: -34.9450,
    riskLevel: 'medio',
    description: 'Acúmulo de água na via de acesso ao Parque de Dois Irmãos.',
    neighborhood: 'Dois Irmãos'
  },
  {
    id: 5,
    name: 'Av. Recife (Boa Viagem)',
    lat: -8.1190,
    lng: -34.9040,
    riskLevel: 'medio',
    description: 'Pontos de alagamento na via paralela à praia em chuvas moderadas.',
    neighborhood: 'Boa Viagem'
  },
  {
    id: 6,
    name: 'Av. Caxangá (Iputinga)',
    lat: -8.0310,
    lng: -34.9370,
    riskLevel: 'alto',
    description: 'Região baixa com alagamento crítico. Várias ruas do entorno ficam intransitáveis.',
    neighborhood: 'Iputinga'
  },
  {
    id: 7,
    name: 'Largo da Paz (Afogados)',
    lat: -8.0760,
    lng: -34.8970,
    riskLevel: 'medio',
    description: 'Alagamento moderado na região do Largo da Paz e ruas adjacentes.',
    neighborhood: 'Afogados'
  },
  {
    id: 8,
    name: 'Av. Abdias de Carvalho',
    lat: -8.0650,
    lng: -34.9190,
    riskLevel: 'medio',
    description: 'Pontos de acúmulo de água sob viadutos e trechos rebaixados.',
    neighborhood: 'Madalena'
  },
  {
    id: 9,
    name: 'BR-101 (Trecho Olinda)',
    lat: -7.9990,
    lng: -34.8620,
    riskLevel: 'alto',
    description: 'Trecho da BR-101 em Olinda com alagamentos que bloqueiam faixas.',
    neighborhood: 'Olinda'
  },
  {
    id: 10,
    name: 'Centro de Jaboatão',
    lat: -8.1130,
    lng: -35.0150,
    riskLevel: 'alto',
    description: 'Região central de Jaboatão dos Guararapes com inundações graves próximo ao rio.',
    neighborhood: 'Jaboatão dos Guararapes'
  },
  {
    id: 11,
    name: 'Av. Presidente Kennedy (Olinda)',
    lat: -8.0100,
    lng: -34.8560,
    riskLevel: 'medio',
    description: 'Via com pontos de alagamento recorrentes em Olinda.',
    neighborhood: 'Olinda'
  },
  {
    id: 12,
    name: 'Rua da Aurora',
    lat: -8.0580,
    lng: -34.8810,
    riskLevel: 'baixo',
    description: 'Alagamento leve próximo ao Rio Capibaribe quando o nível sobe.',
    neighborhood: 'Boa Vista'
  }
]

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
