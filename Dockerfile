# ---- Stage 1: Build ----
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build arg for env variables needed at build time
ARG VITE_MAPBOX_TOKEN
ENV VITE_MAPBOX_TOKEN=${VITE_MAPBOX_TOKEN}

ARG VITE_BACKEND_API
ENV VITE_BACKEND_API=${VITE_BACKEND_API}

RUN npm run build

# ---- Stage 2: Serve ----
FROM nginx:1.27-alpine AS production

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config as template (uses ${BACKEND_URL})
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# nginx docker image auto-processes /etc/nginx/templates/*.template with envsubst
# and outputs to /etc/nginx/conf.d/ — BACKEND_URL will be substituted automatically
CMD ["nginx", "-g", "daemon off;"]

