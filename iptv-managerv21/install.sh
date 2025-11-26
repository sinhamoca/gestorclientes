#!/bin/bash
# ========================================
# INSTALAÇÃO RÁPIDA - IPTV MANAGER
# ========================================

echo "🚀 IPTV Manager - Instalação Rápida"
echo "========================================"
echo ""

# 1. Verificar se está na pasta correta
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Erro: Execute este script na pasta iptv-manager/"
    exit 1
fi

# 2. Verificar se .env está configurado
if [ ! -f ".env" ]; then
    echo "❌ Erro: Arquivo .env não encontrado!"
    echo "   Copie o .env.example e configure suas credenciais"
    exit 1
fi

# Verificar se API key está configurada
if grep -q "SUA_CHAVE_2CAPTCHA_AQUI" .env; then
    echo "⚠️  ATENÇÃO: Configure a API KEY do 2Captcha no arquivo .env"
    echo ""
    echo "1. Abra o arquivo .env"
    echo "2. Substitua 'SUA_CHAVE_2CAPTCHA_AQUI' pela sua chave"
    echo "3. Execute este script novamente"
    echo ""
    exit 1
fi

# 3. Limpar containers antigos
echo "🧹 Limpando containers antigos..."
docker-compose down 2>/dev/null || true
docker stop iptv_manager_backend iptv_manager_frontend iptv_renewal_frontend 2>/dev/null || true
docker rm -f iptv_manager_backend iptv_manager_frontend iptv_renewal_frontend 2>/dev/null || true

echo ""

# 4. Criar rede compartilhada (se não existir)
echo "📡 Verificando rede compartilhada..."
if ! docker network inspect shared_network >/dev/null 2>&1; then
    echo "   Criando rede shared_network..."
    docker network create shared_network
    echo "   ✅ Rede criada!"
else
    echo "   ✅ Rede já existe!"
fi

echo ""

# 5. Subir os containers
echo "🐳 Construindo e iniciando containers..."
docker-compose up -d --build --force-recreate

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Erro ao iniciar containers!"
    echo ""
    echo "Tentando diagnóstico..."
    echo ""
    docker-compose ps
    echo ""
    echo "Ver logs:"
    echo "docker-compose logs"
    exit 1
fi

echo ""

# 6. Aguardar containers iniciar
echo "⏳ Aguardando serviços iniciar..."
sleep 8

# 7. Verificar status
echo ""
echo "📊 Status dos serviços:"
docker ps | grep -E "iptv_manager|CONTAINER"

echo ""

# 8. Testar endpoints
echo "🔍 Testando conectividade..."
echo ""

# Teste backend
if curl -s http://localhost:5001/health > /dev/null 2>&1; then
    echo "✅ Backend: http://localhost:5001 - OK"
else
    echo "⚠️  Backend: http://localhost:5001 - Não responde"
fi

# Teste frontend
if curl -s http://localhost:5000 > /dev/null 2>&1; then
    echo "✅ Frontend: http://localhost:5000 - OK"
else
    echo "⚠️  Frontend: http://localhost:5000 - Não responde"
fi

echo ""
echo "=========================================="
echo "✅ INSTALAÇÃO CONCLUÍDA!"
echo "=========================================="
echo ""
echo "📍 Frontend: http://localhost:5000"
echo "📍 Backend:  http://localhost:5001/health"
echo ""
echo "⚠️  PRÓXIMOS PASSOS:"
echo ""
echo "1. Faça login no sistema principal:"
echo "   https://comprarecarga.shop"
echo ""
echo "2. Depois acesse o IPTV Manager:"
echo "   https://iptv.comprarecarga.shop"
echo ""
echo "3. Clique em 'Credenciais Live21' e cadastre"
echo "   suas credenciais do CloudNation"
echo ""
echo "4. Clique em 'Carregar Clientes Live21' para"
echo "   importar os clientes automaticamente"
echo ""
echo "📚 Para mais informações, veja o README.md"
echo ""

# 9. Perguntar se quer ver logs
read -p "📋 Deseja ver os logs do backend? [s/N]: " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
    echo ""
    echo "Pressione Ctrl+C para sair dos logs"
    echo ""
    sleep 2
    docker logs -f iptv_manager_backend
fi

