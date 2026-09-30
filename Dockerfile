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

# 2. Upgrade pip and install yt-dlp
RUN pip3 install --no-cache-dir --break-system-packages -U yt-dlp

# 3. Create non-root user required by Hugging Face Spaces (UID 1000)
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

WORKDIR $HOME/app

# 4. Copy all project files with correct ownership
COPY --chown=user:user . $HOME/app

# 5. Create storage directories with write permissions
RUN mkdir -p $HOME/app/downloads/yt_cache

# 6. Hugging Face Spaces listens on port 7860 by default
ENV PORT=7860
ENV HOST=0.0.0.0
EXPOSE 7860

# 7. Start application server
CMD ["node", "server.js"]
