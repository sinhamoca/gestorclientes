#!/bin/bash
# ========================================
# ENCONTRAR CONTAINER POSTGRESQL CORRETO
# ========================================

echo "🔍 PROCURANDO CONTAINER POSTGRESQL"
echo "========================================"
echo ""

echo "1️⃣ TODOS OS CONTAINERS RODANDO:"
echo "-----------------------------------"
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"
echo ""

echo "2️⃣ CONTAINERS COM 'POSTGRES' NO NOME:"
echo "-----------------------------------"
docker ps --format "{{.Names}}" | grep -i postgres || echo "Nenhum encontrado"
echo ""

echo "3️⃣ CONTAINERS COM 'DB' NO NOME:"
echo "-----------------------------------"
docker ps --format "{{.Names}}" | grep -i db || echo "Nenhum encontrado"
echo ""

echo "4️⃣ CONTAINERS COM 'GESTAO' NO NOME:"
echo "-----------------------------------"
docker ps --format "{{.Names}}" | grep -i gestao || echo "Nenhum encontrado"
echo ""

echo "5️⃣ CONTAINERS NA REDE shared_network:"
echo "-----------------------------------"
if docker network inspect shared_network >/dev/null 2>&1; then
    docker network inspect shared_network --format '{{range .Containers}}{{.Name}} ({{.IPv4Address}}){{"\n"}}{{end}}'
else
    echo "❌ Rede shared_network não existe!"
fi
echo ""

echo "6️⃣ TESTANDO CONTAINERS POSTGRESQL:"
echo "-----------------------------------"

# Testar cada container que pode ser PostgreSQL
for container in $(docker ps --format "{{.Names}}" | grep -iE "postgres|db|gestao"); do
    echo "Testando: $container"
    
    # Tentar verificar se tem PostgreSQL
    HAS_PG=$(docker exec $container which psql 2>/dev/null)
    
    if [ ! -z "$HAS_PG" ]; then
        echo "  ✅ Tem PostgreSQL!"
        
        # Tentar conectar no database gestao_clientes
        DB_TEST=$(docker exec $container psql -U gestao_user -d gestao_clientes -c "SELECT 1" 2>/dev/null)
        
        if [ ! -z "$DB_TEST" ]; then
            echo "  ✅ Database 'gestao_clientes' ENCONTRADO!"
            
            # Contar clientes
            CLIENT_COUNT=$(docker exec $container psql -U gestao_user -d gestao_clientes -t -c "SELECT COUNT(*) FROM clients WHERE user_id = 2;" 2>/dev/null | xargs)
            
            if [ ! -z "$CLIENT_COUNT" ]; then
                echo "  📊 Clientes do user 2: $CLIENT_COUNT"
            fi
            
            echo ""
            echo "  🎯 USE ESTE CONTAINER:"
            echo "  ====================="
            echo "  POSTGRES_HOST=$container"
            echo "  ====================="
            echo ""
        else
            echo "  ⚠️  Database 'gestao_clientes' não encontrado"
        fi
    else
        echo "  ℹ️  Não é container PostgreSQL"
    fi
    echo ""
done

echo "========================================"
echo "PRÓXIMOS PASSOS:"
echo "========================================"
echo ""
echo "1. Copie o nome do container correto acima"
echo ""
echo "2. Edite o .env:"
echo "   nano ~/iptv-manager/.env"
echo ""
echo "3. Altere para:"
echo "   POSTGRES_HOST=nome_correto"
echo ""
echo "4. Reinicie:"
echo "   docker-compose restart iptv_manager_backend"
echo ""
