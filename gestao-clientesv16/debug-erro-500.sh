#!/bin/bash
# ========================================
# DEBUG - Erro 500 ao listar clientes
# ========================================

echo "🔍 DEBUG - Erro 500"
echo ""

echo "1️⃣ LOGS DO BACKEND (últimas 50 linhas):"
docker logs --tail 50 gestao_clientes_backend

echo ""
echo "2️⃣ VERIFICAR SE BACKEND ESTÁ RODANDO:"
docker ps | grep backend

echo ""
echo "3️⃣ TESTAR ENDPOINT MANUALMENTE:"
echo "Executando: curl http://localhost:3000/api/clients"
echo ""

# Pegar token do usuário (ajuste o user_id)
TOKEN=$(docker exec -it gestao_db psql -U gestao_user -d gestao_clientes -t -c "
SELECT token FROM users WHERE id = 2 LIMIT 1;
" | tr -d ' \n\r')

if [ ! -z "$TOKEN" ]; then
  echo "Token encontrado: ${TOKEN:0:20}..."
  curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/clients | jq '.' || echo "Erro na requisição!"
else
  echo "❌ Token não encontrado!"
fi

echo ""
echo "4️⃣ VERIFICAR ESTRUTURA DA TABELA:"
docker exec -it gestao_db psql -U gestao_user -d gestao_clientes -c "\d clients"

echo ""
echo "5️⃣ TESTAR QUERY MANUAL:"
docker exec -it gestao_db psql -U gestao_user -d gestao_clientes -c "
SELECT c.*, 
       p.name as plan_name, 
       p.duration_months,
       s.name as server_name,
       s.cost_per_screen
FROM clients c
LEFT JOIN plans p ON c.plan_id = p.id
LEFT JOIN servers s ON c.server_id = s.id
WHERE c.user_id = 2
LIMIT 3;
"
