#!/bin/bash

# ========================================
# INSTALADOR DO SISTEMA DE BACKUP
# Instalação automática e configuração
# ========================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  📦 INSTALADOR - Sistema de Backup PostgreSQL${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then 
   echo -e "${YELLOW}⚠️  Recomendado executar como root${NC}"
   echo ""
fi

# Definir diretório de instalação
INSTALL_DIR="/root/backup-system"

echo -e "${GREEN}📁 Diretório de instalação: ${INSTALL_DIR}${NC}"
echo ""

# Criar diretório
echo -e "${BLUE}1️⃣  Criando diretórios...${NC}"
mkdir -p "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR/backups"
mkdir -p "$INSTALL_DIR/logs"
echo -e "${GREEN}   ✅ Diretórios criados${NC}"
echo ""

# Copiar arquivos
echo -e "${BLUE}2️⃣  Copiando arquivos...${NC}"
cp backup-manager.js "$INSTALL_DIR/"
cp restore.sh "$INSTALL_DIR/"
cp package.json "$INSTALL_DIR/"
cp .env "$INSTALL_DIR/"
cp README.md "$INSTALL_DIR/"
echo -e "${GREEN}   ✅ Arquivos copiados${NC}"
echo ""

# Permissões
echo -e "${BLUE}3️⃣  Configurando permissões...${NC}"
chmod +x "$INSTALL_DIR/backup-manager.js"
chmod +x "$INSTALL_DIR/restore.sh"
echo -e "${GREEN}   ✅ Permissões configuradas${NC}"
echo ""

# Instalar dependências
echo -e "${BLUE}4️⃣  Instalando dependências npm...${NC}"
cd "$INSTALL_DIR"
npm install
echo -e "${GREEN}   ✅ Dependências instaladas${NC}"
echo ""

# Verificar PM2
echo -e "${BLUE}5️⃣  Verificando PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}   ⚠️  PM2 não encontrado. Instalando...${NC}"
    npm install -g pm2
    echo -e "${GREEN}   ✅ PM2 instalado${NC}"
else
    echo -e "${GREEN}   ✅ PM2 já está instalado${NC}"
fi
echo ""

# Configurar variáveis
echo -e "${BLUE}6️⃣  Configurando variáveis de ambiente...${NC}"
echo -e "${YELLOW}   Ajuste o arquivo .env se necessário:${NC}"
echo -e "${YELLOW}   nano $INSTALL_DIR/.env${NC}"
echo ""

# Testar backup
echo -e "${BLUE}7️⃣  Deseja executar um teste de backup agora? [s/N]${NC}"
read -p "   " test_backup

if [[ $test_backup =~ ^[Ss]$ ]]; then
    echo ""
    echo -e "${BLUE}   Executando teste...${NC}"
    node "$INSTALL_DIR/backup-manager.js" &
    BACKUP_PID=$!
    
    echo -e "${YELLOW}   Aguardando 5 segundos...${NC}"
    sleep 5
    
    kill $BACKUP_PID 2>/dev/null || true
    
    if [ -n "$(ls -A $INSTALL_DIR/backups)" ]; then
        echo -e "${GREEN}   ✅ Teste bem-sucedido! Backup criado.${NC}"
    else
        echo -e "${YELLOW}   ⚠️  Nenhum backup criado ainda. Verifique as configurações.${NC}"
    fi
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ INSTALAÇÃO CONCLUÍDA!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}📋 Próximos passos:${NC}"
echo ""
echo -e "  ${YELLOW}1)${NC} Ajustar configurações (se necessário):"
echo -e "     ${BLUE}nano $INSTALL_DIR/.env${NC}"
echo ""
echo -e "  ${YELLOW}2)${NC} Iniciar sistema de backup:"
echo -e "     ${BLUE}cd $INSTALL_DIR${NC}"
echo -e "     ${BLUE}npm run pm2:start${NC}"
echo ""
echo -e "  ${YELLOW}3)${NC} Ver logs em tempo real:"
echo -e "     ${BLUE}npm run pm2:logs${NC}"
echo ""
echo -e "  ${YELLOW}4)${NC} Restaurar um backup:"
echo -e "     ${BLUE}./restore.sh${NC}"
echo ""
echo -e "${GREEN}🎉 Sistema pronto para uso!${NC}"
echo ""
