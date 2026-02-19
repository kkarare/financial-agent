FROM node:20-slim

# Puppeteer 의존성 (공모주 크롤링에 필요할 수 있음)
RUN apt-get update && apt-get install -y \
    chromium \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# 의존성 먼저 설치 (캐시 활용)
COPY package*.json ./
RUN npm ci --only=production

# 소스코드 복사
COPY src/ ./src/

# 한국 시간대 설정
ENV TZ=Asia/Seoul

CMD ["node", "src/index.js"]

