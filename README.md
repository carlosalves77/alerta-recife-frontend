<p align="center">
  <span style="font-size: 3rem">🌊</span>
</p>

<h1 align="center">Alerta Recife — Frontend</h1>

<p align="center">
  <strong>Mapeamento colaborativo de pontos de alagamento na Região Metropolitana do Recife.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Vue.js-3.5-4FC08D?style=flat-square&logo=vue.js&logoColor=white" alt="Vue 3" />
  <img src="https://img.shields.io/badge/TypeScript-6.0-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-8.0-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Mapbox_GL-3.23-000000?style=flat-square&logo=mapbox&logoColor=white" alt="Mapbox GL" />
  <img src="https://img.shields.io/badge/Docker-Multi--Stage-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/K3s-Deploy-FFC61C?style=flat-square&logo=kubernetes&logoColor=black" alt="K3s" />
</p>

---

## 📋 Sobre

O **Alerta Recife** é uma aplicação web de mapeamento colaborativo que permite aos cidadãos visualizar, reportar e confirmar pontos de alagamento na Grande Recife. A plataforma utiliza dados georreferenciados e relatos da comunidade para manter um mapa interativo atualizado em tempo real, ajudando moradores e motoristas a evitar áreas perigosas durante chuvas intensas.

### ✨ Funcionalidades

- 🗺️ **Mapa interativo** — Visualização de pontos de alagamento com Mapbox GL JS no estilo dark mode
- 📍 **Reporte de alagamentos** — Marcador arrastável com reverse geocoding e validação de endereço (restrito a Pernambuco)
- 📷 **Upload de fotos** — Até 6 imagens por reporte com preview em grid e lightbox para visualização
- 👍 **Confirmação de ocorrências** — Sistema de votos para validar alertas existentes
- 🔐 **Autenticação via Google OAuth 2.0** — Login seguro com perfil do Google
- 👤 **Meus Alertas** — Painel para gerenciar seus reportes (visualizar e excluir)
- 📊 **Estatísticas dinâmicas** — Contagem automática de pontos mapeados e bairros cobertos via API
- 📱 **Design responsivo** — Mapa expansível em tela cheia no mobile com overlay de toque
- ⚠️ **Níveis de risco** — Classificação visual por cores (Alto, Médio, Baixo)
- 🖼️ **Carrossel de imagens** — Navegação entre fotos nos popups dos marcadores

---

## 🏗️ Arquitetura

```
src/
├── components/
│   ├── NavBar.vue            # Barra de navegação com auth e menu mobile
│   ├── HeroSection.vue       # Seção hero com efeito de chuva animada
│   ├── FloodMap.vue          # Mapa interativo (Mapbox GL) + formulários
│   ├── AboutSection.vue      # Seção "Sobre" com estatísticas dinâmicas
│   ├── FooterSection.vue     # Rodapé com links
│   ├── HomePage.vue          # Composição da página principal
│   ├── LoginPage.vue         # Página de login/registro (Google OAuth)
│   ├── AuthCallback.vue      # Callback de autenticação OAuth
│   └── MyFloodPoints.vue     # Painel "Meus Alertas" (CRUD pessoal)
├── data/
│   └── floodData.ts          # Tipagem FloodPoint + mapeamento de risco/intensidade
├── services/
│   ├── api.ts                # Instância Axios configurada (/api/v1)
│   └── authService.ts        # Gerenciamento de perfil e sessão do usuário
├── router/
│   └── index.ts              # Vue Router com scroll suave por hash
├── style.css                 # Design system completo (dark mode, glassmorphism)
├── App.vue                   # Root component
└── main.ts                   # Ponto de entrada
```
---

## 🚀 Primeiros Passos

### Pré-requisitos

- **Node.js** 22+
- **npm** 10+
- Token do **[Mapbox](https://account.mapbox.com/access-tokens/)**

### Instalação

```bash
# Clone o repositório
git clone https://github.com/carlosalves77/alerta-recife-frontend.git
cd alerta-recife-frontend

# Instale as dependências
npm install
```

### Configuração

Crie o arquivo `.env` na raiz do projeto:

```env
VITE_MAPBOX_TOKEN=seu_token_mapbox_aqui
VITE_BACKEND_API=http://localhost:4010
```

| Variável             | Descrição                                               |
| -------------------- | ------------------------------------------------------- |
| `VITE_MAPBOX_TOKEN`  | Token de acesso público do Mapbox GL JS                 |
| `VITE_BACKEND_API`   | URL base do backend (proxied via Vite em dev)           |

### Executando em Desenvolvimento

```bash
npm run dev
```

A aplicação estará disponível em `http://localhost:5173`.

O Vite automaticamente faz proxy das rotas `/api`, `/oauth2` e `/login` para o backend configurado.

### Build de Produção

```bash
npm run build
npm run preview   # Pré-visualização local do build
```

---

## 🐳 Docker

### Build e Execução Manual

```bash
docker build \
  --build-arg VITE_MAPBOX_TOKEN=seu_token \
  --build-arg VITE_BACKEND_API=API_BACKEND_URL \
  -t alerta-recife-frontend .

docker run -p 80:80 \
  -e BACKEND_URL=API_BACKEND_URL\
  alerta-recife-frontend
```

### Docker Compose

```bash
# Configure VITE_MAPBOX_TOKEN no .env
docker compose up -d
```

O container utiliza uma build multi-stage:
1. **Stage 1 (Node 22 Alpine)** — Build do app Vue com Vite + Terser
2. **Stage 2 (Nginx 1.27 Alpine)** — Serve os assets estáticos com reverse proxy dinâmico para o backend

O Nginx processa `nginx.conf` como template, substituindo `${BACKEND_URL}` automaticamente via `envsubst`.

---

## ⚙️ CI/CD

O projeto utiliza **GitHub Actions** com runner self-hosted para deploy automático:

```
Push na branch master
    → Build da imagem Docker com versão (Git SHA)
    → Push para Docker Hub
    → Deploy no cluster K3s via kubectl set image
    → Rollout automático com verificação de status
```

### Secrets Necessários (GitHub)

| Secret            | Descrição                    |
| ----------------- | ---------------------------- |
| `DOCKER_USERNAME` | Usuário do Docker Hub        |
| `DOCKER_PASSWORD` | Token/senha do Docker Hub    |
| `MAPBOX_TOKEN`    | Token do Mapbox para build   |
| `BACKEND_API`     | URL da API backend           |

---

## 🛠️ Stack Tecnológica

| Tecnologia          | Versão  | Uso                                        |
| ------------------- | ------- | ------------------------------------------ |
| **Vue.js 3**        | 3.5     | Framework reativo (Composition API + SFC)  |
| **TypeScript**      | 6.0     | Tipagem estática                           |
| **Vite**            | 8.0     | Build tool + dev server com HMR            |
| **Mapbox GL JS**    | 3.23    | Renderização de mapa interativo            |
| **Axios**           | 1.16    | Cliente HTTP para API REST                 |
| **Vue Router**      | 5.0     | Roteamento SPA com scroll behavior         |
| **Nginx**           | 1.27    | Servidor de produção + reverse proxy       |
| **Docker**          | —       | Containerização multi-stage                |
| **K3s (Kubernetes)**| —       | Orquestração em homelab                    |

---

## 📐 Design

- **Dark mode** com paleta baseada em tons de azul-escuro (`#0a0e1a`)
- **Glassmorphism** com `backdrop-filter` em cards e navbar
- **Tipografia** Inter (Google Fonts) — pesos 400, 500, 600 e 700
- **Animações** de chuva no hero, drop animation nos marcadores e micro-interações nos botões
- **Responsividade** completa com mapa fullscreen no mobile

---

## 📄 Licença

Este projeto é uma iniciativa comunitária para a segurança dos cidadãos de Recife.

Feito com 💙 para a comunidade Recifense.
