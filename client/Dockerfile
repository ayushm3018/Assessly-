# --- Stage 1: build the React app ---
FROM node:20-slim AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Vite inlines env vars at BUILD time, so they must be passed as build args
# (not runtime env). VITE_SERVER_URL is empty in prod → API calls go same-origin
# (relative "/api/...") and nginx proxies them to the backend container.
ARG VITE_SERVER_URL=""
ARG VITE_RAZORPAY_KEY_ID=""
ARG VITE_FIREBASE_APIKEY=""
ENV VITE_SERVER_URL=$VITE_SERVER_URL \
    VITE_RAZORPAY_KEY_ID=$VITE_RAZORPAY_KEY_ID \
    VITE_FIREBASE_APIKEY=$VITE_FIREBASE_APIKEY
RUN npm run build

# --- Stage 2: serve static files + reverse-proxy /api ---
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
EXPOSE 443
CMD ["nginx", "-g", "daemon off;"]
