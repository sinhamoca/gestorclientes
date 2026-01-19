#!/bin/bash
echo "📱 ADICIONANDO DASHBOARD AO DOCKER"
echo "==================================="
echo ""

cd ~/wpp-connect

# 1. Copiar componentes faltantes
echo "1️⃣ Copiando componentes JavaScript..."
mkdir -p wpp-dashboard/js/components

cp /tmp/wpp-dashboard/js/components/Login.js wpp-dashboard/js/components/
cp /tmp/wpp-dashboard/js/components/Overview.js wpp-dashboard/js/components/
cp /tmp/wpp-dashboard/js/components/SessionsManager.js wpp-dashboard/js/components/
cp /tmp/wpp-dashboard/js/components/TestMessages.js wpp-dashboard/js/components/
cp /tmp/wpp-dashboard/js/components/Settings.js wpp-dashboard/js/components/
cp /tmp/wpp-dashboard/js/components/Logs.js wpp-dashboard/js/components/

echo "   ✅ Componentes copiados"

# 2. Criar nginx.conf para o dashboard
echo ""
echo "2️⃣ Criando nginx.conf..."
cat > wpp-dashboard-nginx.conf << 'NGINX_EOF'
server {
    listen 80;
    server_name _;
    
    root /usr/share/nginx/html;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1d;
        add_header Cache-Control "public, immutable";
    }
}
NGINX_EOF

echo "   ✅ nginx.conf criado"

# 3. Atualizar docker-compose.yml
echo ""
echo "3️⃣ Atualizando docker-compose.yml..."
cat > docker-compose.yml << 'COMPOSE_EOF'
version: '3.8'

services:
  # WhatsApp Service (API)
  whatsapp-service:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: whatsapp_service
    env_file:
      - .env
    environment:
      - NODE_ENV=production
      - TZ=America/Sao_Paulo
    ports:
      - "${PORT:-9000}:9000"
    volumes:
      - whatsapp_sessions:/app/sessions
      - ./logs:/app/logs
    restart: unless-stopped
    networks:
      - shared_network
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '1.0'
          memory: 512M
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:9000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Dashboard Admin (Frontend)
  wpp-dashboard:
    image: nginx:alpine
    container_name: wpp_dashboard
    volumes:
      - ./wpp-dashboard:/usr/share/nginx/html:ro
      - ./wpp-dashboard-nginx.conf:/etc/nginx/conf.d/default.conf:ro
    ports:
      - "9001:80"
    restart: unless-stopped
    networks:
      - shared_network
    environment:
      - TZ=America/Sao_Paulo
    depends_on:
      - whatsapp-service

volumes:
  whatsapp_sessions:
    driver: local

networks:
  shared_network:
    external: true
COMPOSE_EOF

echo "   ✅ docker-compose.yml atualizado"

# 4. Verificar estrutura
echo ""
echo "4️⃣ Verificando estrutura final..."
echo "-----------------------------------"
ls -lh wpp-dashboard/
echo ""
ls -lh wpp-dashboard/js/
echo ""
ls -lh wpp-dashboard/js/components/

echo ""
echo "5️⃣ Iniciando containers..."
docker-compose down
docker-compose up -d

echo ""
echo "6️⃣ Aguardando inicialização..."
sleep 10

echo ""
echo "7️⃣ Verificando containers..."
docker ps | grep -E "whatsapp_service|wpp_dashboard|CONTAINER"

echo ""
echo "=========================================="
echo "✅ DASHBOARD INTEGRADO COM SUCESSO!"
echo "=========================================="
echo ""
echo "📱 WhatsApp Service API:"
echo "   http://37.60.235.47:9000/health"
echo ""
echo "🎨 Dashboard Admin:"
echo "   http://37.60.235.47:9001"
echo ""

# Mostrar API Key
API_KEY=$(grep API_KEY .env 2>/dev/null | cut -d= -f2)
if [ ! -z "$API_KEY" ]; then
    echo "🔐 API Key para login no dashboard:"
    echo "   $API_KEY"
    echo ""
fi

echo "💡 Ver logs:"
echo "   docker logs -f wpp_dashboard"
echo "   docker logs -f whatsapp_service"
echo ""
