#!/bin/bash
# ========================================
# LIMPEZA DE LOGS - GESTÃO DE CLIENTES
# Script interativo para gerenciar logs
# ========================================

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Configurações do banco
DB_CONTAINER="gestao_db"
DB_USER="gestao_user"
DB_NAME="gestao_clientes"

# Função para executar query no PostgreSQL
run_query() {
    docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -t -c "$1" 2>/dev/null | tr -d ' \n'
}

# Função para executar query com resultado formatado
run_query_formatted() {
    docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c "$1" 2>/dev/null
}

# Verificar se o container está rodando
check_container() {
    if ! docker ps | grep -q $DB_CONTAINER; then
        echo -e "${RED}❌ Erro: Container $DB_CONTAINER não está rodando!${NC}"
        exit 1
    fi
}

# Cabeçalho
show_header() {
    clear
    echo -e "${PURPLE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                                                              ║"
    echo "║         📋 GERENCIADOR DE LOGS - GESTÃO DE CLIENTES         ║"
    echo "║                                                              ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Mostrar estatísticas atuais
show_stats() {
    echo -e "${CYAN}📊 ESTATÍSTICAS ATUAIS${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    # Total de logs
    TOTAL=$(run_query "SELECT COUNT(*) FROM activity_logs;")
    echo -e "   📋 Total de logs: ${BOLD}${GREEN}$TOTAL${NC}"
    
    # Logs por tipo
    WHATSAPP=$(run_query "SELECT COUNT(*) FROM activity_logs WHERE type = 'whatsapp';")
    PAYMENT=$(run_query "SELECT COUNT(*) FROM activity_logs WHERE type = 'payment';")
    RENEWAL=$(run_query "SELECT COUNT(*) FROM activity_logs WHERE type = 'renewal';")
    
    echo -e "   📱 WhatsApp: ${YELLOW}$WHATSAPP${NC}"
    echo -e "   💰 Pagamentos: ${YELLOW}$PAYMENT${NC}"
    echo -e "   🔄 Renovações: ${YELLOW}$RENEWAL${NC}"
    
    # Logs por período
    echo ""
    echo -e "${CYAN}📅 LOGS POR PERÍODO${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    LAST_24H=$(run_query "SELECT COUNT(*) FROM activity_logs WHERE created_at >= NOW() - INTERVAL '1 day';")
    LAST_7D=$(run_query "SELECT COUNT(*) FROM activity_logs WHERE created_at >= NOW() - INTERVAL '7 days';")
    LAST_30D=$(run_query "SELECT COUNT(*) FROM activity_logs WHERE created_at >= NOW() - INTERVAL '30 days';")
    OLDER_30D=$(run_query "SELECT COUNT(*) FROM activity_logs WHERE created_at < NOW() - INTERVAL '30 days';")
    OLDER_60D=$(run_query "SELECT COUNT(*) FROM activity_logs WHERE created_at < NOW() - INTERVAL '60 days';")
    OLDER_90D=$(run_query "SELECT COUNT(*) FROM activity_logs WHERE created_at < NOW() - INTERVAL '90 days';")
    
    echo -e "   🕐 Últimas 24h: ${GREEN}$LAST_24H${NC}"
    echo -e "   📆 Últimos 7 dias: ${GREEN}$LAST_7D${NC}"
    echo -e "   📆 Últimos 30 dias: ${GREEN}$LAST_30D${NC}"
    echo -e "   ⏰ Mais antigos que 30 dias: ${YELLOW}$OLDER_30D${NC}"
    echo -e "   ⏰ Mais antigos que 60 dias: ${YELLOW}$OLDER_60D${NC}"
    echo -e "   ⏰ Mais antigos que 90 dias: ${RED}$OLDER_90D${NC}"
    
    # Tamanho estimado
    SIZE=$(run_query "SELECT pg_size_pretty(pg_total_relation_size('activity_logs'));")
    echo ""
    echo -e "   💾 Tamanho da tabela: ${BOLD}$SIZE${NC}"
    
    # Log mais antigo e mais recente
    OLDEST=$(run_query "SELECT TO_CHAR(MIN(created_at), 'DD/MM/YYYY HH24:MI') FROM activity_logs;")
    NEWEST=$(run_query "SELECT TO_CHAR(MAX(created_at), 'DD/MM/YYYY HH24:MI') FROM activity_logs;")
    
    echo ""
    echo -e "   📌 Log mais antigo: ${CYAN}$OLDEST${NC}"
    echo -e "   📌 Log mais recente: ${CYAN}$NEWEST${NC}"
    echo ""
}

# Menu principal
show_menu() {
    echo -e "${BLUE}🗑️  OPÇÕES DE LIMPEZA${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "   ${BOLD}1)${NC} Limpar logs mais antigos que ${YELLOW}90 dias${NC}"
    echo -e "   ${BOLD}2)${NC} Limpar logs mais antigos que ${YELLOW}60 dias${NC}"
    echo -e "   ${BOLD}3)${NC} Limpar logs mais antigos que ${YELLOW}30 dias${NC}"
    echo -e "   ${BOLD}4)${NC} Limpar logs mais antigos que ${YELLOW}15 dias${NC}"
    echo -e "   ${BOLD}5)${NC} Limpar logs mais antigos que ${YELLOW}7 dias${NC}"
    echo ""
    echo -e "   ${BOLD}6)${NC} Limpar apenas logs de ${PURPLE}WhatsApp${NC}"
    echo -e "   ${BOLD}7)${NC} Limpar apenas logs de ${PURPLE}Pagamentos${NC}"
    echo -e "   ${BOLD}8)${NC} Limpar apenas logs de ${PURPLE}Renovações${NC}"
    echo ""
    echo -e "   ${BOLD}9)${NC} Limpar logs de ${RED}ERRO${NC} (manter apenas sucessos)"
    echo -e "   ${BOLD}10)${NC} ${RED}⚠️  LIMPAR TODOS OS LOGS${NC}"
    echo ""
    echo -e "   ${BOLD}11)${NC} Configurar limpeza ${GREEN}AUTOMÁTICA${NC}"
    echo -e "   ${BOLD}12)${NC} Ver logs detalhados"
    echo ""
    echo -e "   ${BOLD}0)${NC} Sair"
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Função para confirmar e executar limpeza
confirm_and_delete() {
    local QUERY="$1"
    local DESCRIPTION="$2"
    
    # Contar quantos serão afetados
    COUNT_QUERY=$(echo "$QUERY" | sed 's/DELETE FROM/SELECT COUNT(*) FROM/')
    AFFECTED=$(run_query "$COUNT_QUERY")
    
    if [ "$AFFECTED" == "0" ] || [ -z "$AFFECTED" ]; then
        echo ""
        echo -e "${YELLOW}ℹ️  Nenhum log encontrado para esta condição.${NC}"
        read -p "Pressione ENTER para continuar..."
        return
    fi
    
    echo ""
    echo -e "${YELLOW}⚠️  ATENÇÃO!${NC}"
    echo -e "   Descrição: ${CYAN}$DESCRIPTION${NC}"
    echo -e "   Logs afetados: ${RED}$AFFECTED${NC}"
    echo ""
    read -p "Tem certeza que deseja continuar? (s/N): " CONFIRM
    
    if [[ "$CONFIRM" =~ ^[Ss]$ ]]; then
        echo ""
        echo -e "${YELLOW}🗑️  Executando limpeza...${NC}"
        
        # Executar delete
        RESULT=$(docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c "$QUERY" 2>&1)
        
        if echo "$RESULT" | grep -q "DELETE"; then
            DELETED=$(echo "$RESULT" | grep -oP 'DELETE \K[0-9]+')
            echo -e "${GREEN}✅ Sucesso! $DELETED logs removidos.${NC}"
            
            # Vacuum para liberar espaço
            echo -e "${YELLOW}🧹 Otimizando tabela (VACUUM)...${NC}"
            docker exec -i $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c "VACUUM ANALYZE activity_logs;" > /dev/null 2>&1
            echo -e "${GREEN}✅ Tabela otimizada!${NC}"
        else
            echo -e "${RED}❌ Erro ao executar limpeza:${NC}"
            echo "$RESULT"
        fi
    else
        echo -e "${YELLOW}❌ Operação cancelada.${NC}"
    fi
    
    echo ""
    read -p "Pressione ENTER para continuar..."
}

# Configurar limpeza automática
setup_auto_cleanup() {
    echo ""
    echo -e "${GREEN}🤖 CONFIGURAR LIMPEZA AUTOMÁTICA${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Isso criará um cron job que executa diariamente às 3:00 AM"
    echo "e remove automaticamente logs mais antigos que 30 dias."
    echo ""
    
    # Verificar se já existe
    if crontab -l 2>/dev/null | grep -q "cleanup_activity_logs"; then
        echo -e "${YELLOW}⚠️  Já existe uma limpeza automática configurada:${NC}"
        crontab -l | grep "cleanup_activity_logs"
        echo ""
        read -p "Deseja remover a configuração existente? (s/N): " REMOVE
        
        if [[ "$REMOVE" =~ ^[Ss]$ ]]; then
            crontab -l | grep -v "cleanup_activity_logs" | crontab -
            echo -e "${GREEN}✅ Configuração removida!${NC}"
        fi
    else
        echo "Escolha o período de retenção:"
        echo "  1) Manter últimos 15 dias"
        echo "  2) Manter últimos 30 dias (recomendado)"
        echo "  3) Manter últimos 60 dias"
        echo "  4) Manter últimos 90 dias"
        echo "  0) Cancelar"
        echo ""
        read -p "Opção: " RETENTION
        
        case $RETENTION in
            1) DAYS=15 ;;
            2) DAYS=30 ;;
            3) DAYS=60 ;;
            4) DAYS=90 ;;
            0) return ;;
            *) echo -e "${RED}Opção inválida!${NC}"; return ;;
        esac
        
        # Criar script de limpeza
        CLEANUP_SCRIPT="/root/cleanup_activity_logs.sh"
        
        cat > $CLEANUP_SCRIPT << EOF
#!/bin/bash
# Limpeza automática de logs - Gestão de Clientes
# Executa diariamente, mantém últimos $DAYS dias

docker exec -i gestao_db psql -U gestao_user -d gestao_clientes -c "
DELETE FROM activity_logs WHERE created_at < NOW() - INTERVAL '$DAYS days';
VACUUM ANALYZE activity_logs;
" >> /var/log/cleanup_activity_logs.log 2>&1

echo "\$(date '+%Y-%m-%d %H:%M:%S') - Limpeza executada (logs > $DAYS dias)" >> /var/log/cleanup_activity_logs.log
EOF
        
        chmod +x $CLEANUP_SCRIPT
        
        # Adicionar ao cron (3:00 AM todos os dias)
        (crontab -l 2>/dev/null; echo "0 3 * * * $CLEANUP_SCRIPT # cleanup_activity_logs") | crontab -
        
        echo ""
        echo -e "${GREEN}✅ Limpeza automática configurada!${NC}"
        echo -e "   📁 Script: ${CYAN}$CLEANUP_SCRIPT${NC}"
        echo -e "   ⏰ Execução: ${CYAN}Diariamente às 3:00 AM${NC}"
        echo -e "   📅 Retenção: ${CYAN}$DAYS dias${NC}"
        echo -e "   📋 Log: ${CYAN}/var/log/cleanup_activity_logs.log${NC}"
    fi
    
    echo ""
    read -p "Pressione ENTER para continuar..."
}

# Ver logs detalhados
show_detailed_logs() {
    echo ""
    echo -e "${CYAN}📋 ÚLTIMOS 20 LOGS${NC}"
    echo ""
    
    run_query_formatted "
    SELECT 
        id,
        type,
        status,
        COALESCE(client_name, '-') as cliente,
        LEFT(title, 40) as titulo,
        TO_CHAR(created_at, 'DD/MM HH24:MI') as data
    FROM activity_logs
    ORDER BY created_at DESC
    LIMIT 20;
    "
    
    echo ""
    read -p "Pressione ENTER para continuar..."
}

# Main loop
main() {
    check_container
    
    while true; do
        show_header
        show_stats
        show_menu
        
        read -p "Escolha uma opção: " OPTION
        
        case $OPTION in
            1)
                confirm_and_delete \
                    "DELETE FROM activity_logs WHERE created_at < NOW() - INTERVAL '90 days';" \
                    "Remover logs mais antigos que 90 dias"
                ;;
            2)
                confirm_and_delete \
                    "DELETE FROM activity_logs WHERE created_at < NOW() - INTERVAL '60 days';" \
                    "Remover logs mais antigos que 60 dias"
                ;;
            3)
                confirm_and_delete \
                    "DELETE FROM activity_logs WHERE created_at < NOW() - INTERVAL '30 days';" \
                    "Remover logs mais antigos que 30 dias"
                ;;
            4)
                confirm_and_delete \
                    "DELETE FROM activity_logs WHERE created_at < NOW() - INTERVAL '15 days';" \
                    "Remover logs mais antigos que 15 dias"
                ;;
            5)
                confirm_and_delete \
                    "DELETE FROM activity_logs WHERE created_at < NOW() - INTERVAL '7 days';" \
                    "Remover logs mais antigos que 7 dias"
                ;;
            6)
                confirm_and_delete \
                    "DELETE FROM activity_logs WHERE type = 'whatsapp';" \
                    "Remover TODOS os logs de WhatsApp"
                ;;
            7)
                confirm_and_delete \
                    "DELETE FROM activity_logs WHERE type = 'payment';" \
                    "Remover TODOS os logs de Pagamentos"
                ;;
            8)
                confirm_and_delete \
                    "DELETE FROM activity_logs WHERE type = 'renewal';" \
                    "Remover TODOS os logs de Renovações"
                ;;
            9)
                confirm_and_delete \
                    "DELETE FROM activity_logs WHERE status = 'error';" \
                    "Remover apenas logs de ERRO"
                ;;
            10)
                echo ""
                echo -e "${RED}⚠️  ATENÇÃO: ISSO IRÁ REMOVER TODOS OS LOGS!${NC}"
                read -p "Digite 'CONFIRMAR' para prosseguir: " CONFIRM_ALL
                
                if [ "$CONFIRM_ALL" == "CONFIRMAR" ]; then
                    confirm_and_delete \
                        "DELETE FROM activity_logs;" \
                        "Remover TODOS os logs do sistema"
                else
                    echo -e "${YELLOW}❌ Operação cancelada.${NC}"
                    read -p "Pressione ENTER para continuar..."
                fi
                ;;
            11)
                setup_auto_cleanup
                ;;
            12)
                show_detailed_logs
                ;;
            0)
                echo ""
                echo -e "${GREEN}👋 Até mais!${NC}"
                echo ""
                exit 0
                ;;
            *)
                echo -e "${RED}Opção inválida!${NC}"
                sleep 1
                ;;
        esac
    done
}

# Executar
main
