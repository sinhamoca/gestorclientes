#!/bin/bash

# ========================================
# TESTE DE BACKUP - DEBUG
# Testar comando de backup manualmente
# ========================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  🔍 TESTE DE BACKUP - DEBUG${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Configurações
CONTAINER_NAME="gestao_db"
DB_USER="gestao_user"
DB_NAME="gestao_clientes"
TEST_DIR="/tmp/backup-test"
TIMESTAMP=$(date '+%Y-%m-%d_%H-%M-%S')
BACKUP_FILE="${TEST_DIR}/test_backup_${TIMESTAMP}.sql.gz"

# Criar diretório de teste
mkdir -p "$TEST_DIR"

echo -e "${YELLOW}📋 Configurações:${NC}"
echo "   Container: $CONTAINER_NAME"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo "   Arquivo: $BACKUP_FILE"
echo ""

# 1. Verificar se container existe
echo -e "${BLUE}1️⃣  Verificando container...${NC}"
if docker ps --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
    echo -e "${GREEN}   ✅ Container está rodando${NC}"
else
    echo -e "${RED}   ❌ Container NÃO está rodando!${NC}"
    echo ""
    echo -e "${YELLOW}   Containers disponíveis:${NC}"
    docker ps --format "   - {{.Names}}"
    exit 1
fi

echo ""

# 2. Testar pg_dump dentro do container
echo -e "${BLUE}2️⃣  Testando pg_dump dentro do container...${NC}"
if docker exec "$CONTAINER_NAME" pg_dump --version > /dev/null 2>&1; then
    VERSION=$(docker exec "$CONTAINER_NAME" pg_dump --version)
    echo -e "${GREEN}   ✅ pg_dump disponível: $VERSION${NC}"
else
    echo -e "${RED}   ❌ pg_dump não encontrado no container!${NC}"
    exit 1
fi

echo ""

# 3. Testar acesso ao banco
echo -e "${BLUE}3️⃣  Testando acesso ao banco de dados...${NC}"
if docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}   ✅ Conexão com banco OK${NC}"
    
    # Contar registros em algumas tabelas
    echo ""
    echo -e "${YELLOW}   📊 Estatísticas do banco:${NC}"
    
    USERS=$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | tr -d ' ')
    echo "      Users: ${USERS:-0}"
    
    CLIENTS=$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM clients;" 2>/dev/null | tr -d ' ')
    echo "      Clients: ${CLIENTS:-0}"
    
    PLANS=$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM plans;" 2>/dev/null | tr -d ' ')
    echo "      Plans: ${PLANS:-0}"
else
    echo -e "${RED}   ❌ Erro ao conectar no banco!${NC}"
    exit 1
fi

echo ""

# 4. Criar backup
echo -e "${BLUE}4️⃣  Criando backup...${NC}"
if docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"; then
    SIZE=$(stat -c%s "$BACKUP_FILE" 2>/dev/null || stat -f%z "$BACKUP_FILE" 2>/dev/null)
    SIZE_KB=$(echo "scale=2; $SIZE / 1024" | bc)
    SIZE_MB=$(echo "scale=2; $SIZE / 1048576" | bc)
    
    echo -e "${GREEN}   ✅ Backup criado com sucesso!${NC}"
    echo "      Tamanho: $SIZE bytes (${SIZE_KB} KB / ${SIZE_MB} MB)"
    
    if [ $SIZE -lt 1024 ]; then
        echo -e "${RED}   ⚠️  ATENÇÃO: Backup muito pequeno! Pode estar vazio.${NC}"
    fi
else
    echo -e "${RED}   ❌ Erro ao criar backup!${NC}"
    exit 1
fi

echo ""

# 5. Verificar conteúdo do backup
echo -e "${BLUE}5️⃣  Verificando conteúdo do backup...${NC}"
LINES=$(zcat "$BACKUP_FILE" | wc -l)
echo "      Linhas no backup: $LINES"

if [ $LINES -lt 10 ]; then
    echo -e "${RED}   ⚠️  Backup parece vazio! Mostrando conteúdo:${NC}"
    echo ""
    zcat "$BACKUP_FILE" | head -20
else
    echo -e "${GREEN}   ✅ Backup contém dados${NC}"
    echo ""
    echo -e "${YELLOW}   📝 Primeiras linhas do backup:${NC}"
    zcat "$BACKUP_FILE" | head -10
fi

echo ""

# 6. Resumo
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ TESTE CONCLUÍDO${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}📁 Backup de teste criado em:${NC}"
echo "   $BACKUP_FILE"
echo ""
echo -e "${YELLOW}🧪 Para testar restauração:${NC}"
echo "   zcat $BACKUP_FILE | docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME"
echo ""
