#!/bin/bash
# ==========================================
# INSTALAÇÃO RÁPIDA - WhatsApp Service
# ==========================================

echo "🚀 WhatsApp Service - Instalação"
echo "========================================"
echo ""

# 1. Verificar se está na pasta correta
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Erro: Execute este script na pasta whatsapp-service/"
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
docker rm -f whatsapp_service 2>/dev/null || true

echo ""

# 5. Criar pasta de logs
mkdir -p logs
chmod 777 logs

# 6. Build e start
echo "🐳 Construindo e iniciando container..."
docker-compose up -d --build

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Erro ao iniciar container!"
    echo ""
    echo "Ver logs:"
    echo "docker-compose logs"
    exit 1
fi

echo ""

# 7. Aguardar container iniciar
echo "⏳ Aguardando serviço iniciar..."
sleep 5

# 8. Verificar status
echo ""
echo "📊 Status do serviço:"
docker ps | grep -E "whatsapp_service|CONTAINER"

echo ""

# 9. Testar endpoint
echo "🔍 Testando health check..."
if curl -s http://localhost:9000/health > /dev/null 2>&1; then
    echo "✅ Serviço: http://localhost:9000 - OK"
else
    echo "⚠️  Serviço: http://localhost:9000 - Não responde"
    echo ""
    echo "Ver logs:"
    echo "docker logs whatsapp_service"
fi

echo ""
echo "=========================================="
echo "✅ INSTALAÇÃO CONCLUÍDA!"
echo "=========================================="
echo ""
echo "📍 API: http://localhost:9000"
echo "📍 Health: http://localhost:9000/health"
echo ""
echo "🔐 API Key salva em .env"
echo ""
echo "⚠️  PRÓXIMOS PASSOS:"
echo ""
echo "1. Testar o serviço:"
echo "   npm run test"
echo ""
echo "2. Ver logs:"
echo "   docker logs -f whatsapp_service"
echo ""
echo "3. Documentação da API:"
echo "   POST /api/session/create"
echo "   GET  /api/session/status/:sessionId"
echo "   POST /api/message/send"
echo ""
