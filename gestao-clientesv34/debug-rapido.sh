#!/bin/bash
# ========================================
# COMANDOS RÁPIDOS DE DEBUG
# ========================================

echo "🔍 DEBUG - Lembretes não enviando"
echo ""

# 1. VERIFICAR LEMBRETES
echo "1️⃣ LEMBRETES ATIVOS:"
docker exec -it gestao_clientes_postgres psql -U gestao_user -d gestao_clientes -c "
SELECT 
  r.id,
  r.name,
  r.days_offset,
  r.send_time,
  r.is_active,
  r.send_once
FROM reminders r
WHERE r.user_id = 1;
" 2>/dev/null

echo ""
echo "2️⃣ CLIENTES QUE VENCEM HOJE:"
docker exec -it gestao_clientes_postgres psql -U gestao_user -d gestao_clientes -c "
SELECT 
  c.id,
  c.name,
  c.whatsapp_number,
  c.due_date,
  (c.due_date - CURRENT_DATE) as dias_restantes
FROM clients c
WHERE c.user_id = 1 
AND c.is_active = true
AND (c.due_date - CURRENT_DATE) = 0;
" 2>/dev/null

echo ""
echo "3️⃣ WHATSAPP STATUS:"
docker exec -it gestao_clientes_postgres psql -U gestao_user -d gestao_clientes -c "
SELECT instance_name, status FROM whatsapp_instances WHERE user_id = 1;
" 2>/dev/null

echo ""
echo "4️⃣ HORÁRIO ATUAL:"
docker exec -it gestao_clientes_postgres psql -U gestao_user -d gestao_clientes -c "
SELECT TO_CHAR(NOW(), 'HH24:MI') as hora_atual;
" 2>/dev/null

echo ""
echo "5️⃣ FILA PENDENTE:"
docker exec -it gestao_clientes_postgres psql -U gestao_user -d gestao_clientes -c "
SELECT COUNT(*) as total FROM message_queue WHERE user_id = 1 AND status = 'pending';
" 2>/dev/null

echo ""
echo "6️⃣ LOGS SEND_ONCE:"
docker exec -it gestao_clientes_postgres psql -U gestao_user -d gestao_clientes -c "
SELECT COUNT(*) as total_enviados FROM reminder_sent_log 
WHERE reminder_id IN (SELECT id FROM reminders WHERE user_id = 1);
" 2>/dev/null

echo ""
echo "✅ Análise completa!"
