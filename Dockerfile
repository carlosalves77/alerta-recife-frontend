# ---- Stage 1: Build ----
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build arg for env variables needed at build time
ARG VITE_MAPBOX_TOKEN
ENV VITE_MAPBOX_TOKEN=${VITE_MAPBOX_TOKEN}

RUN npm run build

# ---- Stage 2: Serve ----
FROM nginx:1.27-alpine AS production

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
