#!/bin/bash

# ========================================
# RESTORE MANAGER - PostgreSQL
# Script interativo para restauração de backups
# Autor: Isaac
# ========================================

set -e

# Cores para o terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ========== CONFIGURAÇÕES ==========

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${SCRIPT_DIR}/backups"
LOG_FILE="${SCRIPT_DIR}/logs/restore.log"

# Carregar variáveis do .env se existir
if [ -f "${SCRIPT_DIR}/.env" ]; then
    source "${SCRIPT_DIR}/.env"
fi

CONTAINER_NAME="${POSTGRES_CONTAINER:-gestao_db}"
DB_USER="${DB_USER:-gestao_user}"
DB_NAME="${DB_NAME:-gestao_clientes}"

# ========== FUNÇÕES ==========

# Exibe mensagem colorida
print_color() {
    local color=$1
    shift
    echo -e "${color}$@${NC}"
}

# Escreve log
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $@" >> "$LOG_FILE"
}

# Exibe header
show_header() {
    clear
    print_color "$CYAN" "═══════════════════════════════════════════════════════════"
    print_color "$CYAN" "  📦 RESTORE MANAGER - PostgreSQL"
    print_color "$CYAN" "  Sistema de Restauração de Backups"
    print_color "$CYAN" "═══════════════════════════════════════════════════════════"
    echo ""
}

# Lista backups disponíveis
list_backups() {
    local backups=()
    
    if [ ! -d "$BACKUP_DIR" ]; then
        print_color "$RED" "❌ Diretório de backups não encontrado: $BACKUP_DIR"
        return 1
    fi
    
    # Buscar arquivos de backup
    while IFS= read -r file; do
        backups+=("$file")
    done < <(find "$BACKUP_DIR" -name "backup_*.sql.gz" -type f | sort -r)
    
    if [ ${#backups[@]} -eq 0 ]; then
        print_color "$YELLOW" "⚠️  Nenhum backup encontrado em $BACKUP_DIR"
        return 1
    fi
    
    echo "${backups[@]}"
}

# Formata data do arquivo
format_backup_date() {
    local filename="$1"
    local basename=$(basename "$filename" .sql.gz)
    
    # Extrair timestamp do nome (backup_2025-01-18T14-30-00.sql.gz)
    local timestamp=$(echo "$basename" | sed 's/backup_//')
    
    # Converter para formato legível
    local date_part=$(echo "$timestamp" | cut -d'T' -f1)
    local time_part=$(echo "$timestamp" | cut -d'T' -f2 | tr '-' ':')
    
    echo "${date_part} às ${time_part}"
}

# Obtém tamanho do arquivo formatado
format_size() {
    local bytes=$1
    
    if [ $bytes -lt 1024 ]; then
        echo "${bytes} B"
    elif [ $bytes -lt 1048576 ]; then
        echo "$(awk "BEGIN {printf \"%.2f\", $bytes/1024}") KB"
    else
        echo "$(awk "BEGIN {printf \"%.2f\", $bytes/1048576}") MB"
    fi
}

# Exibe menu de backups
show_backup_menu() {
    local backups=($@)
    local count=1
    
    print_color "$GREEN" "📋 Backups Disponíveis:"
    echo ""
    
    for backup in "${backups[@]}"; do
        local filename=$(basename "$backup")
        local date=$(format_backup_date "$filename")
        local size=$(stat -f%z "$backup" 2>/dev/null || stat -c%s "$backup" 2>/dev/null)
        local size_formatted=$(format_size $size)
        
        printf "  ${BLUE}%2d)${NC} %s\n" $count "$filename"
        printf "      📅 Criado em: ${CYAN}%s${NC}\n" "$date"
        printf "      💾 Tamanho: ${YELLOW}%s${NC}\n" "$size_formatted"
        echo ""
        
        ((count++))
    done
    
    print_color "$RED" "  0) ❌ Cancelar"
    echo ""
}

# Verifica se container está rodando
check_container() {
    if ! docker ps --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
        print_color "$RED" "❌ Container '${CONTAINER_NAME}' não está rodando!"
        return 1
    fi
    return 0
}

# Confirma ação com usuário
confirm_action() {
    local message="$1"
    
    print_color "$YELLOW" "⚠️  $message"
    read -p "   Digite 'SIM' para confirmar: " confirmation
    
    if [ "$confirmation" != "SIM" ]; then
        print_color "$RED" "❌ Operação cancelada"
        return 1
    fi
    
    return 0
}

# Cria backup de segurança antes de restaurar
create_safety_backup() {
    local timestamp=$(date '+%Y-%m-%d_%H-%M-%S')
    local safety_backup="${BACKUP_DIR}/safety_backup_${timestamp}.sql.gz"
    
    print_color "$YELLOW" "📦 Criando backup de segurança antes da restauração..."
    
    if docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$safety_backup"; then
        local size=$(stat -f%z "$safety_backup" 2>/dev/null || stat -c%s "$safety_backup" 2>/dev/null)
        local size_formatted=$(format_size $size)
        
        print_color "$GREEN" "✅ Backup de segurança criado: $(basename $safety_backup) ($size_formatted)"
        log_message "Backup de segurança criado: $safety_backup"
        return 0
    else
        print_color "$RED" "❌ Erro ao criar backup de segurança!"
        return 1
    fi
}

# Restaura backup
restore_backup() {
    local backup_file="$1"
    
    print_color "$BLUE" "🔄 Iniciando restauração..."
    log_message "Iniciando restauração de: $backup_file"
    
    # Criar backup de segurança
    if ! create_safety_backup; then
        return 1
    fi
    
    echo ""
    print_color "$YELLOW" "⚙️  Preparando banco de dados para restauração..."
    echo ""
    
    # Passo 1: Desconectar usuários ativos
    print_color "$YELLOW" "   1/3 Desconectando usuários ativos..."
    docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" > /dev/null 2>&1 || true
    
    # Passo 2: Limpar schema (CRÍTICO para evitar conflitos)
    print_color "$YELLOW" "   2/3 Limpando banco de dados atual..."
    if ! docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" > /dev/null 2>&1; then
        echo ""
        print_color "$RED" "❌ Erro ao limpar banco de dados!"
        log_message "ERRO ao limpar schema: $backup_file"
        return 1
    fi
    
    # Passo 3: Restaurar dados do backup
    print_color "$YELLOW" "   3/3 Restaurando dados do backup..."
    if gunzip -c "$backup_file" | docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; then
        echo ""
        print_color "$GREEN" "═══════════════════════════════════════════════════════════"
        print_color "$GREEN" "  ✅ RESTAURAÇÃO CONCLUÍDA COM SUCESSO!"
        print_color "$GREEN" "═══════════════════════════════════════════════════════════"
        
        # Verificar dados restaurados
        local clients_count=$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM clients;" 2>/dev/null | tr -d ' ')
        local users_count=$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | tr -d ' ')
        
        echo ""
        print_color "$CYAN" "📊 Dados restaurados:"
        print_color "$CYAN" "   Usuários: ${users_count:-0}"
        print_color "$CYAN" "   Clientes: ${clients_count:-0}"
        
        log_message "Restauração concluída com sucesso: $backup_file (Users: $users_count, Clients: $clients_count)"
        return 0
    else
        echo ""
        print_color "$RED" "═══════════════════════════════════════════════════════════"
        print_color "$RED" "  ❌ ERRO AO RESTAURAR BACKUP!"
        print_color "$RED" "═══════════════════════════════════════════════════════════"
        print_color "$YELLOW" "  O backup de segurança foi mantido e pode ser usado para recuperação."
        log_message "ERRO ao restaurar dados: $backup_file"
        return 1
    fi
}

# Menu principal
main_menu() {
    show_header
    
    # Verificar container
    if ! check_container; then
        echo ""
        read -p "Pressione ENTER para sair..."
        exit 1
    fi
    
    # Listar backups
    local backups=($(list_backups))
    
    if [ $? -ne 0 ] || [ ${#backups[@]} -eq 0 ]; then
        echo ""
        read -p "Pressione ENTER para sair..."
        exit 1
    fi
    
    # Exibir menu
    show_backup_menu "${backups[@]}"
    
    # Solicitar escolha
    read -p "Escolha um backup para restaurar (0-${#backups[@]}): " choice
    
    # Validar escolha
    if [ "$choice" = "0" ]; then
        print_color "$YELLOW" "Operação cancelada pelo usuário."
        exit 0
    fi
    
    if ! [[ "$choice" =~ ^[0-9]+$ ]] || [ "$choice" -lt 1 ] || [ "$choice" -gt ${#backups[@]} ]; then
        print_color "$RED" "❌ Escolha inválida!"
        sleep 2
        main_menu
        return
    fi
    
    # Obter arquivo selecionado
    local selected_backup="${backups[$((choice-1))]}"
    local filename=$(basename "$selected_backup")
    
    echo ""
    print_color "$CYAN" "═══════════════════════════════════════════════════════════"
    print_color "$CYAN" "  Backup Selecionado:"
    print_color "$CYAN" "  📁 $filename"
    print_color "$CYAN" "═══════════════════════════════════════════════════════════"
    echo ""
    
    # Confirmar restauração
    if ! confirm_action "ATENÇÃO: Esta operação irá SUBSTITUIR o banco de dados atual!"; then
        sleep 2
        main_menu
        return
    fi
    
    echo ""
    
    # Executar restauração
    if restore_backup "$selected_backup"; then
        echo ""
        read -p "Pressione ENTER para sair..."
        exit 0
    else
        echo ""
        read -p "Pressione ENTER para voltar ao menu..."
        main_menu
    fi
}

# ========== INICIALIZAÇÃO ==========

# Criar diretório de logs se não existir
mkdir -p "$(dirname "$LOG_FILE")"

# Iniciar menu
main_menu
