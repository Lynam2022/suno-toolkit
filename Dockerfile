# Base image with Node.js 20 LTS on Debian Bookworm
FROM node:20-bookworm-slim

# 1. Install system dependencies: Python 3, pip, ffmpeg with all audio filters, and curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python-is-python3 \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 2. Upgrade pip and install yt-dlp with JS challenge solver plugin (yt-dlp-ejs)
RUN pip3 install --no-cache-dir --break-system-packages -U yt-dlp yt-dlp-ejs

# 3. Setup work directory
WORKDIR /app

# 4. Copy all project files
COPY . /app

# 5. Create storage directories with full write permissions
RUN mkdir -p /app/downloads/yt_cache && chmod -R 777 /app/downloads

# 6. Default environment variables (Render automatically overrides PORT)
ENV PORT=10000
ENV HOST=0.0.0.0
EXPOSE 10000

# 7. Start application server
CMD ["node", "server.js"]
