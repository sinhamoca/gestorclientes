#!/bin/bash
# ==========================================
# INSTALAÇÃO RÁPIDA - WhatsApp-Web.js Service
# ==========================================

echo "🚀 WhatsApp-Web.js Service - Instalação"
echo "========================================"
echo ""

# 1. Verificar se está na pasta correta
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Erro: Execute este script na pasta wweb-service/"
    exit 1
fi

# 2. Verificar .env
if [ ! -f ".env" ]; then
    echo "📝 Criando arquivo .env..."
    cp .env.example .env
    
    # Gerar API Key aleatória
    API_KEY=$(openssl rand -base64 32 | tr -d '/+=' | cut -c1-40)
    sed -i "s/sua-chave-super-secreta-aqui/$API_KEY/" .env
    
    echo "✅ Arquivo .env criado com API Key gerada"
    echo ""
    echo "🔐 Sua API Key: $API_KEY"
    echo "   (Salve esta chave para usar no gestao-clientes!)"
    echo ""
fi

# 3. Criar rede compartilhada (se não existir)
echo "📡 Verificando rede compartilhada..."
if ! docker network inspect shared_network >/dev/null 2>&1; then
    echo "   Criando rede shared_network..."
    docker network create shared_network
    echo "   ✅ Rede criada!"
else
    echo "   ✅ Rede já existe!"
fi

echo ""

# 4. Limpar containers antigos
echo "🧹 Limpando containers antigos..."
docker-compose down 2>/dev/null || true
docker rm -f wweb_service wweb_dashboard 2>/dev/null || true

echo ""

# 5. Criar pasta de logs
mkdir -p logs
chmod 777 logs

# 6. Build e start
echo "🐳 Construindo e iniciando containers..."
docker-compose up -d --build

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Erro ao iniciar containers!"
    echo ""
    echo "Ver logs:"
    echo "docker-compose logs"
    exit 1
fi

echo ""

# 7. Aguardar containers iniciarem
echo "⏳ Aguardando serviços iniciarem..."
sleep 8

# 8. Verificar status
echo ""
echo "📊 Status dos serviços:"
docker ps | grep -E "wweb_service|wweb_dashboard|CONTAINER"

echo ""

# 9. Testar endpoints
echo "🔍 Testando serviços..."

# API
if curl -s http://localhost:9100/health > /dev/null 2>&1; then
    echo "✅ API: http://localhost:9100 - OK"
else
    echo "⚠️  API: http://localhost:9100 - Não responde"
    echo ""
    echo "Ver logs:"
    echo "docker logs wweb_service"
fi

# Dashboard
if curl -s http://localhost:9101 > /dev/null 2>&1; then
    echo "✅ Dashboard: http://localhost:9101 - OK"
else
    echo "⚠️  Dashboard: http://localhost:9101 - Não responde"
fi

echo ""
echo "=========================================="
echo "✅ INSTALAÇÃO CONCLUÍDA!"
echo "=========================================="
echo ""
echo "📍 API: http://localhost:9100"
echo "📍 Dashboard: http://localhost:9101"
echo "📍 Health: http://localhost:9100/health"
echo ""
echo "🔐 API Key salva em .env"
echo ""
echo "⚠️  PRÓXIMOS PASSOS:"
echo ""
echo "1. Acesse o Dashboard:"
echo "   http://localhost:9101"
echo ""
echo "2. Faça login com a API Key gerada acima"
echo ""
echo "3. Crie sua primeira sessão e escaneie o QR Code"
echo ""
echo "4. Ver logs:"
echo "   docker logs -f wweb_service"
echo ""
echo "5. Parar serviços:"
echo "   docker-compose down"
echo ""
