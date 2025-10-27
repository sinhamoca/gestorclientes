#!/bin/bash
# ========================================
# LIMPEZA E REINSTALAÇÃO - IPTV MANAGER
# ========================================

echo "🧹 Limpando containers antigos..."
echo "========================================"
echo ""

# 1. Parar todos os containers relacionados
echo "⏹️  Parando containers..."
docker-compose down 2>/dev/null || true
docker stop iptv_manager_backend 2>/dev/null || true
docker stop iptv_manager_frontend 2>/dev/null || true
docker stop iptv_renewal_frontend 2>/dev/null || true

echo ""

# 2. Remover containers
echo "🗑️  Removendo containers..."
docker rm -f iptv_manager_backend 2>/dev/null || true
docker rm -f iptv_manager_frontend 2>/dev/null || true
docker rm -f iptv_renewal_frontend 2>/dev/null || true

echo ""

# 3. Remover imagens antigas
echo "🗑️  Removendo imagens antigas..."
docker rmi -f iptv-manager_iptv-manager-backend 2>/dev/null || true
docker rmi -f iptv-manager-iptv-manager-backend 2>/dev/null || true

echo ""

# 4. Limpar volumes órfãos (opcional - cuidado, apaga dados!)
read -p "⚠️  Deseja limpar volumes de dados? (isso apagará o banco SQLite) [s/N]: " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
    echo "🗑️  Removendo volumes..."
    docker volume rm iptv-manager_iptv_data 2>/dev/null || true
    docker volume rm iptv_data 2>/dev/null || true
fi

echo ""
echo "✅ Limpeza concluída!"
echo ""
echo "🚀 Agora execute o install.sh novamente:"
echo "   ./install.sh"
echo ""
