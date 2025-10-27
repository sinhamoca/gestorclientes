#!/bin/bash
# ========================================
# DEBUG SCRIPT - IPTV MANAGER
# ========================================

echo "🔍 DIAGNÓSTICO COMPLETO - IPTV MANAGER"
echo "========================================"
echo ""

# 1. Verificar se containers estão rodando
echo "1️⃣  CONTAINERS:"
echo "-------------------"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "iptv_manager|postgres-gestao|NAMES"
echo ""

# 2. Verificar rede
echo "2️⃣  REDE DOCKER:"
echo "-------------------"
if docker network inspect shared_network >/dev/null 2>&1; then
    echo "✅ Rede shared_network existe"
    echo ""
    echo "Containers na rede:"
    docker network inspect shared_network --format '{{range .Containers}}{{.Name}}{{"\n"}}{{end}}'
else
    echo "❌ Rede shared_network NÃO existe!"
    echo ""
    echo "SOLUÇÃO:"
    echo "docker network create shared_network"
    echo "docker network connect shared_network iptv_manager_backend"
    echo "docker restart iptv_manager_backend"
fi
echo ""

# 3. Testar conexão PostgreSQL do backend
echo "3️⃣  CONEXÃO POSTGRESQL:"
echo "-------------------"
echo "Testando conexão do backend..."
docker exec iptv_manager_backend sh -c '
node -e "
const { Pool } = require(\"pg\");
const pool = new Pool({
  host: process.env.POSTGRES_HOST || \"postgres-gestao\",
  port: 5432,
  database: process.env.POSTGRES_DB || \"gestao_clientes\",
  user: process.env.POSTGRES_USER || \"gestao_user\",
  password: process.env.POSTGRES_PASSWORD
});

pool.query(\"SELECT current_database(), current_user, version()\")
  .then(result => {
    console.log(\"✅ Conexão OK!\");
    console.log(\"   Database:\", result.rows[0].current_database);
    console.log(\"   User:\", result.rows[0].current_user);
    console.log(\"\");
  })
  .catch(err => {
    console.log(\"❌ Erro na conexão:\", err.message);
    console.log(\"\");
    console.log(\"Variáveis de ambiente:\");
    console.log(\"   POSTGRES_HOST:\", process.env.POSTGRES_HOST);
    console.log(\"   POSTGRES_DB:\", process.env.POSTGRES_DB);
    console.log(\"   POSTGRES_USER:\", process.env.POSTGRES_USER);
    console.log(\"   POSTGRES_PASSWORD:\", process.env.POSTGRES_PASSWORD ? \"***SET***\" : \"***NOT SET***\");
  })
  .finally(() => process.exit());
"
' 2>&1
echo ""

# 4. Verificar se há clientes no banco
echo "4️⃣  CLIENTES NO BANCO:"
echo "-------------------"
docker exec postgres-gestao psql -U gestao_user -d gestao_clientes -c "
SELECT 
    u.id as user_id,
    u.email,
    COUNT(c.id) as total_clientes
FROM users u
LEFT JOIN clients c ON c.user_id = u.id
GROUP BY u.id, u.email
ORDER BY u.id;
" 2>&1
echo ""

# 5. Ver detalhes de clientes do user 2
echo "5️⃣  CLIENTES DO USER 2:"
echo "-------------------"
docker exec postgres-gestao psql -U gestao_user -d gestao_clientes -c "
SELECT 
    id,
    name,
    whatsapp_number,
    username,
    is_active,
    due_date
FROM clients
WHERE user_id = 2
LIMIT 10;
" 2>&1
echo ""

# 6. Testar endpoint da API
echo "6️⃣  TESTE API:"
echo "-------------------"
echo "Testando GET /api/clients..."
echo ""

# Pegar token do localStorage (simulado)
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwiZW1haWwiOiJ0ZXN0ZUB0ZXN0ZS5jb20iLCJpYXQiOjE3Mjk4OTcyMDd9.placeholder"

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer ${TOKEN}" \
  http://localhost:5001/api/clients 2>&1)

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_STATUS:")

echo "Status HTTP: ${HTTP_STATUS}"
echo ""
echo "Resposta:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

# 7. Ver logs do backend
echo "7️⃣  ÚLTIMOS LOGS DO BACKEND:"
echo "-------------------"
docker logs --tail 50 iptv_manager_backend 2>&1 | grep -E "(Erro|Error|❌|✅|Cliente|PG|PostgreSQL)"
echo ""

# 8. Resumo e sugestões
echo "========================================"
echo "📊 RESUMO:"
echo "========================================"
echo ""
echo "Se os clientes existem no banco mas não aparecem:"
echo ""
echo "1. Verificar se o backend conecta ao PostgreSQL (item 3)"
echo "2. Verificar se há clientes no banco (item 4 e 5)"
echo "3. Verificar resposta da API (item 6)"
echo "4. Ver logs de erro (item 7)"
echo ""
echo "SOLUÇÕES COMUNS:"
echo ""
echo "❌ Backend não conecta ao PostgreSQL:"
echo "   → docker network connect shared_network iptv_manager_backend"
echo "   → docker restart iptv_manager_backend"
echo ""
echo "❌ Clientes existem mas API retorna vazio:"
echo "   → Ver logs: docker logs -f iptv_manager_backend"
echo "   → Verificar query SQL no código"
echo ""
echo "❌ Erro de autenticação:"
echo "   → Verificar JWT_SECRET no .env"
echo "   → Deve ser IGUAL ao sistema principal"
echo ""
