#!/bin/bash
# ========================================
# ENCONTRAR CONTAINER POSTGRESQL
# ========================================

echo "🔍 PROCURANDO CONTAINER POSTGRESQL..."
echo "========================================"
echo ""

echo "1️⃣  Todos os containers rodando:"
echo "-------------------"
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Ports}}"
echo ""

echo "2️⃣  Containers PostgreSQL:"
echo "-------------------"
docker ps --filter "ancestor=postgres" --format "{{.Names}}" 2>/dev/null
docker ps | grep -i postgres | awk '{print $NF}'
echo ""

echo "3️⃣  Containers na rede shared_network:"
echo "-------------------"
docker network inspect shared_network --format '{{range .Containers}}{{.Name}} ({{.IPv4Address}}){{"\n"}}{{end}}' 2>/dev/null
echo ""

echo "4️⃣  SOLUÇÃO:"
echo "-------------------"
echo "Procure o nome do container PostgreSQL acima."
echo ""
echo "Depois, edite o arquivo .env e altere:"
echo ""
echo "De:"
echo "  POSTGRES_HOST=postgres-gestao"
echo ""
echo "Para:"
echo "  POSTGRES_HOST=nome_correto_do_container"
echo ""
echo "Exemplos comuns:"
echo "  - gestao_clientes_db"
echo "  - gestao-db"
echo "  - postgres"
echo "  - gestao_admin_backend (se PostgreSQL está dentro dele)"
echo ""

# Tentar encontrar automaticamente
echo "5️⃣  TENTANDO DETECTAR AUTOMATICAMENTE:"
echo "-------------------"

# Buscar por containers com PostgreSQL
PG_CONTAINERS=$(docker ps --format "{{.Names}}" | grep -iE "postgres|db|gestao.*db")

if [ -z "$PG_CONTAINERS" ]; then
    echo "❌ Nenhum container PostgreSQL encontrado diretamente"
    echo ""
    echo "O PostgreSQL pode estar rodando DENTRO de outro container."
    echo ""
    echo "Vamos testar containers na rede shared_network..."
    echo ""
    
    # Testar cada container na rede
    for container in gestao_admin_backend evolution_api; do
        if docker ps --format "{{.Names}}" | grep -q "^${container}$"; then
            echo "🔍 Testando ${container}..."
            
            # Testar se tem PostgreSQL
            HAS_PSQL=$(docker exec $container which psql 2>/dev/null)
            if [ ! -z "$HAS_PSQL" ]; then
                echo "   ✅ ${container} tem PostgreSQL!"
                
                # Testar conexão
                DB_EXISTS=$(docker exec $container psql -U gestao_user -d gestao_clientes -c "SELECT 1" 2>/dev/null)
                if [ ! -z "$DB_EXISTS" ]; then
                    echo "   ✅ Database 'gestao_clientes' existe em ${container}!"
                    echo ""
                    echo "   USE ESTE NO .env:"
                    echo "   POSTGRES_HOST=${container}"
                    echo ""
                fi
            fi
        fi
    done
else
    echo "✅ Containers PostgreSQL encontrados:"
    echo "$PG_CONTAINERS"
    echo ""
    
    # Testar cada um
    for container in $PG_CONTAINERS; do
        echo "🔍 Testando ${container}..."
        
        # Testar se database existe
        DB_EXISTS=$(docker exec $container psql -U gestao_user -d gestao_clientes -c "SELECT 1" 2>/dev/null)
        if [ ! -z "$DB_EXISTS" ]; then
            echo "   ✅ Database 'gestao_clientes' existe em ${container}!"
            echo ""
            echo "   USE ESTE NO .env:"
            echo "   POSTGRES_HOST=${container}"
            echo ""
            
            # Contar clientes
            CLIENT_COUNT=$(docker exec $container psql -U gestao_user -d gestao_clientes -t -c "SELECT COUNT(*) FROM clients WHERE user_id = 2;" 2>/dev/null | xargs)
            if [ ! -z "$CLIENT_COUNT" ]; then
                echo "   📊 Total de clientes do user 2: ${CLIENT_COUNT}"
            fi
            echo ""
        else
            echo "   ⚠️  Database não encontrada em ${container}"
        fi
    done
fi

echo ""
echo "========================================"
echo "PRÓXIMOS PASSOS:"
echo "========================================"
echo ""
echo "1. Copie o POSTGRES_HOST correto acima"
echo "2. Edite o .env:"
echo "   nano ~/iptv-manager/.env"
echo ""
echo "3. Reinicie o backend:"
echo "   docker restart iptv_manager_backend"
echo ""
echo "4. Teste novamente:"
echo "   docker logs -f iptv_manager_backend"
echo ""
