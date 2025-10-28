#!/bin/bash
# ========================================
# LIMPAR LOGS DE MENSAGENS PARA TESTES
# ========================================

echo "🧹 Script de Limpeza - Sistema de Lembretes"
echo "=========================================="
echo ""

# Função para mostrar menu
show_menu() {
  echo "Escolha uma opção:"
  echo ""
  echo "1) Limpar TODOS os logs de mensagens (permite reenvio)"
  echo "2) Limpar logs de um cliente específico (por ID)"
  echo "3) Limpar logs de um cliente específico (por WhatsApp)"
  echo "4) Limpar logs de HOJE (permite reenvio hoje)"
  echo "5) Ver últimos 10 logs"
  echo "6) Ver estatísticas de logs"
  echo "0) Sair"
  echo ""
  echo -n "Digite a opção: "
}

# Loop do menu
while true; do
  show_menu
  read opcao
  
  case $opcao in
    1)
      echo ""
      echo "⚠️  ATENÇÃO: Isso vai limpar TODOS os logs de mensagens!"
      echo -n "Tem certeza? (s/N): "
      read confirmacao
      if [ "$confirmacao" = "s" ] || [ "$confirmacao" = "S" ]; then
        docker exec -it gestao_db psql -U gestao_user -d gestao_clientes -c "
          DELETE FROM message_logs;
        "
        echo "✅ Todos os logs foram removidos!"
      else
        echo "❌ Operação cancelada"
      fi
      echo ""
      ;;
      
    2)
      echo ""
      echo -n "Digite o ID do cliente: "
      read client_id
      docker exec -it gestao_db psql -U gestao_user -d gestao_clientes -c "
        DELETE FROM message_logs WHERE client_id = $client_id;
      "
      echo "✅ Logs do cliente ID $client_id removidos!"
      echo ""
      ;;
      
    3)
      echo ""
      echo -n "Digite o WhatsApp do cliente (ex: 5585999999999): "
      read whatsapp
      docker exec -it gestao_db psql -U gestao_user -d gestao_clientes -c "
        DELETE FROM message_logs WHERE whatsapp_number = '$whatsapp';
      "
      echo "✅ Logs do WhatsApp $whatsapp removidos!"
      echo ""
      ;;
      
    4)
      echo ""
      echo "🗑️  Removendo logs de hoje..."
      docker exec -it gestao_db psql -U gestao_user -d gestao_clientes -c "
        DELETE FROM message_logs WHERE DATE(sent_at) = CURRENT_DATE;
      "
      echo "✅ Logs de hoje removidos!"
      echo ""
      ;;
      
    5)
      echo ""
      echo "📋 Últimos 10 logs de mensagens:"
      echo "=========================================="
      docker exec -it gestao_db psql -U gestao_user -d gestao_clientes -c "
        SELECT 
          id,
          client_id,
          whatsapp_number,
          LEFT(message_sent, 50) as mensagem,
          sent_at,
          status
        FROM message_logs
        ORDER BY sent_at DESC
        LIMIT 10;
      "
      echo ""
      ;;
      
    6)
      echo ""
      echo "📊 Estatísticas de Logs:"
      echo "=========================================="
      docker exec -it gestao_db psql -U gestao_user -d gestao_clientes -c "
        SELECT 
          COUNT(*) as total_logs,
          COUNT(DISTINCT client_id) as clientes_diferentes,
          COUNT(CASE WHEN DATE(sent_at) = CURRENT_DATE THEN 1 END) as logs_hoje,
          COUNT(CASE WHEN status = 'sent' THEN 1 END) as enviados,
          COUNT(CASE WHEN status = 'error' THEN 1 END) as erros
        FROM message_logs;
      "
      echo ""
      ;;
      
    0)
      echo ""
      echo "👋 Saindo..."
      exit 0
      ;;
      
    *)
      echo ""
      echo "❌ Opção inválida!"
      echo ""
      ;;
  esac
done
