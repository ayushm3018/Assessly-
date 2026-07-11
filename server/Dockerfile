# Backend (Express API).
# node:20-slim is Debian-based (glibc), so @napi-rs/canvas + pdfjs resolve the
# correct prebuilt native binary on Linux. Because the image is built ON the
# target machine (EC2), npm also picks the right CPU architecture automatically.
FROM node:20-slim

WORKDIR /app

# Install deps first so this layer is cached unless package files change.
# npm ci needs package-lock.json (committed to the repo).
COPY package*.json ./
RUN npm ci --omit=dev

# App source (secrets are NOT copied — see .dockerignore; they come in at runtime).
COPY . .

# multer writes uploaded resumes here; also backed by a named volume in compose.
RUN mkdir -p public

ENV NODE_ENV=production
EXPOSE 8000
CMD ["node", "index.js"]
