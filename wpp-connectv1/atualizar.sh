#!/bin/bash
# ==========================================
# ATUALIZAÇÃO RÁPIDA - Corrigir Chrome
# ==========================================

echo "🔧 Atualizando WhatsApp Service (corrigindo Chrome)"
echo "=========================================="
echo ""

cd ~/wpp-connect || exit 1

echo "1️⃣ Parando container..."
docker-compose down

echo ""
echo "2️⃣ Backup do Dockerfile antigo..."
cp Dockerfile Dockerfile.backup

echo ""
echo "3️⃣ Atualizando Dockerfile..."
cat > Dockerfile << 'DOCKERFILE'
# ==========================================
# WHATSAPP SERVICE - Dockerfile
# ==========================================

FROM node:18-bullseye-slim

# Instalar dependências do sistema para Puppeteer/Chromium
RUN apt-get update && apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Criar diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar dependências Node
RUN npm install --production

# Instalar Chrome do Puppeteer (necessário para WPPConnect)
# Precisa rodar como root antes de criar o usuário
RUN npx puppeteer browsers install chrome

# Copiar código fonte
COPY src/ ./src/

# Criar diretórios necessários
RUN mkdir -p /app/sessions /app/logs

# Expor porta
EXPOSE 9000

# Timezone São Paulo
ENV TZ=America/Sao_Paulo

# Configurar cache do Puppeteer para pasta acessível
ENV PUPPETEER_CACHE_DIR=/app/.cache/puppeteer

# Criar usuário não-root e dar permissões
RUN useradd -m -u 1001 whatsapp && \
    mkdir -p /app/.cache/puppeteer && \
    chown -R whatsapp:whatsapp /app

USER whatsapp

# Comando de inicialização
CMD ["node", "src/server.js"]
DOCKERFILE

echo "   ✅ Dockerfile atualizado"

echo ""
echo "4️⃣ Rebuilding container..."
echo "   ⏱️  Isso vai demorar ~3-5 minutos (baixando Chrome ~150MB)"
echo ""

docker-compose up -d --build

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Erro no build!"
    echo ""
    echo "Restaurando Dockerfile antigo..."
    mv Dockerfile.backup Dockerfile
    exit 1
fi

echo ""
echo "5️⃣ Aguardando serviço iniciar..."
sleep 10

echo ""
echo "6️⃣ Testando health check..."
HEALTH=$(curl -s http://localhost:9000/health)

if echo "$HEALTH" | grep -q "healthy"; then
    echo "   ✅ Serviço rodando!"
else
    echo "   ⚠️  Serviço não responde, verificando logs..."
    docker logs --tail 20 whatsapp_service
fi

echo ""
echo "=========================================="
echo "✅ ATUALIZAÇÃO CONCLUÍDA!"
echo "=========================================="
echo ""
echo "📊 Status:"
docker ps | grep whatsapp_service

echo ""
echo "🧪 Teste agora:"
echo "curl -X POST \\"
echo "  -H \"x-api-key: \$(grep API_KEY ~/.env | cut -d= -f2)\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"sessionId\":\"test_isaac\"}' \\"
echo "  http://localhost:9000/api/session/create"
echo ""
