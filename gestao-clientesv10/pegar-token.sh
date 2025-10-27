#!/bin/bash
# ========================================
# PEGAR TOKEN DE PAGAMENTO DE CLIENTES
# ========================================

echo "🔍 Buscando tokens de pagamento dos clientes..."
echo ""

# Opção 1: Listar TODOS os clientes com seus tokens
echo "📋 TODOS OS CLIENTES E TOKENS:"
echo "========================================"
docker exec -it gestao_db psql -U gestao_user -d gestao_clientes -c "
SELECT 
  c.id,
  c.name as cliente,
  c.whatsapp_number,
  u.name as empresa,
  c.payment_token,
  CONCAT('https://pagamentos.comprarecarga.shop/pay/', c.payment_token) as link_completo
FROM clients c
LEFT JOIN users u ON c.user_id = u.id
ORDER BY c.id DESC
LIMIT 10;
"

echo ""
echo "========================================"
echo ""

# Opção 2: Buscar token de um cliente específico por NOME
echo "🔎 Para buscar um cliente ESPECÍFICO por nome:"
echo "docker exec -it gestao_db psql -U gestao_user -d gestao_clientes -c \"SELECT id, name, payment_token, CONCAT('https://pagamentos.comprarecarga.shop/pay/', payment_token) as link FROM clients WHERE name ILIKE '%NOME_DO_CLIENTE%';\""
echo ""

# Opção 3: Buscar por ID
echo "🔎 Para buscar por ID:"
echo "docker exec -it gestao_db psql -U gestao_user -d gestao_clientes -c \"SELECT id, name, payment_token, CONCAT('https://pagamentos.comprarecarga.shop/pay/', payment_token) as link FROM clients WHERE id = 1;\""
echo ""

# Opção 4: Pegar o primeiro cliente cadastrado
echo "📌 PRIMEIRO CLIENTE CADASTRADO:"
echo "========================================"
docker exec -it gestao_db psql -U gestao_user -d gestao_clientes -c "
SELECT 
  c.id,
  c.name as cliente,
  c.whatsapp_number,
  c.price_value as valor,
  c.due_date as vencimento,
  c.payment_token as token,
  CONCAT('https://pagamentos.comprarecarga.shop/pay/', c.payment_token) as link_pagamento
FROM clients c
ORDER BY c.id ASC
LIMIT 1;
"

echo ""
echo "✅ Copie o 'link_pagamento' e cole no navegador para testar!"
