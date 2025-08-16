# Use Node, then install ffmpeg via apt
FROM node:18-bullseye-slim

# Install ffmpeg
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first (better caching)
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Copy app
COPY . .

# Create folders used at runtime
RUN mkdir -p uploads public

ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
