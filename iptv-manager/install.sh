#!/bin/bash
# ========================================
# INSTALAÇÃO RÁPIDA - IPTV RENEWAL SERVICE
# ========================================

echo "🚀 Instalando IPTV Renewal Service..."
echo ""

# 1. Verificar se está na pasta correta
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Erro: Execute este script na pasta iptv-renewal-service/"
    exit 1
fi

# 2. Criar rede compartilhada (se não existir)
echo "📡 Verificando rede compartilhada..."
if ! docker network inspect shared_network >/dev/null 2>&1; then
    echo "   Criando rede shared_network..."
    docker network create shared_network
    echo "   ✅ Rede criada!"
else
    echo "   ✅ Rede já existe!"
fi

echo ""

# 3. Subir o serviço
echo "🐳 Iniciando container Docker..."
docker-compose up -d

echo ""

# 4. Aguardar container iniciar
echo "⏳ Aguardando serviço iniciar..."
sleep 3

# 5. Verificar status
echo ""
echo "📊 Status do serviço:"
docker ps | grep iptv_renewal_frontend

echo ""
echo "=========================================="
echo "✅ INSTALAÇÃO CONCLUÍDA!"
echo "=========================================="
echo ""
echo "📍 Acesse: http://localhost:5000"
echo ""
echo "⚠️  IMPORTANTE:"
echo "   1. Primeiro faça login no sistema principal"
echo "   2. Depois acesse http://localhost:5000"
echo ""
echo "📚 Para mais informações, veja o README.md"
echo ""
