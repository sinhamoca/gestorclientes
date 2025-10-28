#!/bin/bash
# ========================================
# DIAGNÓSTICO COMPLETO DO ERRO 404
# ========================================

echo "🔍 DIAGNÓSTICO COMPLETO - Rota /api/clients/:id/invoices"
echo "========================================================"
echo ""

# 1. Verificar se o servidor Node está rodando
echo "1️⃣ Verificando se o servidor Node está rodando..."
pm2 list | grep gestao-api
if [ $? -eq 0 ]; then
  echo "   ✅ Servidor Node está rodando"
else
  echo "   ❌ Servidor Node NÃO está rodando!"
  echo "   Execute: pm2 start ecosystem.config.js"
  exit 1
fi
echo ""

# 2. Verificar logs do PM2
echo "2️⃣ Últimas 20 linhas dos logs do PM2:"
echo "-----------------------------------"
pm2 logs gestao-api --lines 20 --nostream
echo ""

# 3. Testar endpoint direto no Node (porta 3001)
echo "3️⃣ Testando endpoint DIRETO no Node.js (porta 3001)..."
echo "-----------------------------------"
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJhZG1pbkBzaXN0ZW1hLmNvbSIsImlzQWRtaW4iOnRydWUsImlhdCI6MTczMDAwMDAwMH0.test"

curl -s -X GET "http://localhost:3001/api/clients/1/invoices" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | head -c 200

echo ""
echo ""

# 4. Testar via Nginx (porta 80)
echo "4️⃣ Testando endpoint via NGINX (porta 443/https)..."
echo "-----------------------------------"
curl -s -X GET "https://api.comprarecarga.shop/api/clients/1/invoices" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | head -c 200

echo ""
echo ""

# 5. Verificar configuração do Nginx
echo "5️⃣ Verificando configuração do Nginx..."
echo "-----------------------------------"
cat /etc/nginx/sites-available/api.comprarecarga.shop | grep -A 10 "location /"
echo ""

# 6. Verificar se há erros no Nginx
echo "6️⃣ Últimas linhas dos logs de erro do Nginx:"
echo "-----------------------------------"
tail -n 10 /var/log/nginx/api_comprarecarga_error.log
echo ""

# 7. Testar conexão direta
echo "7️⃣ Testando conexão direta na porta 3001..."
nc -zv localhost 3001
echo ""

# 8. Verificar se a rota existe no código
echo "8️⃣ Verificando se a rota existe no server.js..."
grep -n "clients.*invoices" /root/gestao-clientesv8/src/server.js
echo ""

# 9. Verificar se o controller existe
echo "9️⃣ Verificando se getClientInvoices existe..."
grep -n "getClientInvoices" /root/gestao-clientesv8/src/controllers/clientsController.js | head -3
echo ""

echo "========================================================"
echo "✅ Diagnóstico concluído!"
echo ""
echo "📝 Próximos passos baseado nos resultados:"
echo "  • Se o teste 3 (Node direto) funcionar mas o 4 (Nginx) não:"
echo "    → Problema no Nginx, verificar configuração"
echo ""
echo "  • Se o teste 3 (Node direto) NÃO funcionar:"
echo "    → Problema no Node, reiniciar: pm2 restart gestao-api"
echo ""
echo "  • Se ambos não funcionarem:"
echo "    → Verificar se a função está exportada corretamente"
