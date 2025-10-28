#!/bin/bash
# ========================================
# CONFIGURAÇÃO NGINX - COMPRARECARGA.SHOP
# Sistema de Gestão + Pagamentos
# ========================================

echo "🔧 Configurando Nginx para comprarecarga.shop"
echo ""

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ========== 1. INSTALAR NGINX ==========
echo "📦 Verificando Nginx..."
if ! command -v nginx &> /dev/null; then
    echo "   Instalando Nginx..."
    sudo apt update
    sudo apt install -y nginx
    echo -e "${GREEN}✅ Nginx instalado!${NC}"
else
    echo -e "${GREEN}✅ Nginx já instalado!${NC}"
fi

# ========== 2. REMOVER SITE PADRÃO ==========
echo ""
echo "🗑️  Removendo configuração padrão..."
sudo rm -f /etc/nginx/sites-enabled/default

# ========== 3. CRIAR CONFIGURAÇÃO PRINCIPAL ==========
echo ""
echo "📝 Criando configuração para comprarecarga.shop..."

sudo tee /etc/nginx/sites-available/comprarecarga.shop > /dev/null <<'EOF'
# ========================================
# DOMÍNIO PRINCIPAL: comprarecarga.shop
# Interface de Cliente - Porta 4000
# ========================================

server {
    listen 80;
    listen [::]:80;
    server_name comprarecarga.shop www.comprarecarga.shop;

    # Logs
    access_log /var/log/nginx/comprarecarga_access.log;
    error_log /var/log/nginx/comprarecarga_error.log;

    # Tamanho máximo de upload
    client_max_body_size 10M;

    # Proxy para interface cliente (porta 4000)
    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

echo -e "${GREEN}✅ Configuração principal criada!${NC}"

# ========== 4. CRIAR CONFIGURAÇÃO DA API ==========
echo ""
echo "📝 Criando configuração para api.comprarecarga.shop..."

sudo tee /etc/nginx/sites-available/api.comprarecarga.shop > /dev/null <<'EOF'
# ========================================
# SUBDOMÍNIO: api.comprarecarga.shop
# Backend API - Porta 3001
# ========================================

server {
    listen 80;
    listen [::]:80;
    server_name api.comprarecarga.shop;

    # Logs
    access_log /var/log/nginx/api_comprarecarga_access.log;
    error_log /var/log/nginx/api_comprarecarga_error.log;

    # Tamanho máximo de upload
    client_max_body_size 10M;

    # Proxy para backend API (porta 3001)
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        proxy_cache_bypass $http_upgrade;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3001/health;
        access_log off;
    }
}
EOF

echo -e "${GREEN}✅ Configuração da API criada!${NC}"

# ========== 5. CRIAR CONFIGURAÇÃO DE PAGAMENTOS ==========
echo ""
echo "📝 Criando configuração para pagamentos.comprarecarga.shop..."

sudo tee /etc/nginx/sites-available/pagamentos.comprarecarga.shop > /dev/null <<'EOF'
# ========================================
# SUBDOMÍNIO: pagamentos.comprarecarga.shop
# Sistema de Pagamentos - Porta 4000
# ========================================

server {
    listen 80;
    listen [::]:80;
    server_name pagamentos.comprarecarga.shop;

    # Logs
    access_log /var/log/nginx/pagamentos_comprarecarga_access.log;
    error_log /var/log/nginx/pagamentos_comprarecarga_error.log;

    # Tamanho máximo de upload
    client_max_body_size 10M;

    # Proxy para sistema de pagamentos (porta 4000)
    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        proxy_cache_bypass $http_upgrade;
    }

    # Rotas específicas de pagamento
    location ~ ^/pay/ {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Webhook do Mercado Pago
    location /api/webhooks/mercadopago {
        proxy_pass http://localhost:4000/api/webhooks/mercadopago;
        proxy_http_version 1.1;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

echo -e "${GREEN}✅ Configuração de pagamentos criada!${NC}"

# ========== 6. ATIVAR SITES ==========
echo ""
echo "🔗 Ativando sites..."
sudo ln -sf /etc/nginx/sites-available/comprarecarga.shop /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/api.comprarecarga.shop /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/pagamentos.comprarecarga.shop /etc/nginx/sites-enabled/

echo -e "${GREEN}✅ Sites ativados!${NC}"

# ========== 7. TESTAR CONFIGURAÇÃO ==========
echo ""
echo "🧪 Testando configuração..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Configuração válida!${NC}"
    
    # ========== 8. RECARREGAR NGINX ==========
    echo ""
    echo "🔄 Recarregando Nginx..."
    sudo systemctl reload nginx
    echo -e "${GREEN}✅ Nginx recarregado!${NC}"
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${GREEN}✅ NGINX CONFIGURADO COM SUCESSO!${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📝 PRÓXIMOS PASSOS:"
    echo ""
    echo "1. ✅ Nginx configurado"
    echo ""
    echo "2. 📋 Configurar DNS no Cloudflare:"
    echo "   • comprarecarga.shop → A → SEU_IP"
    echo "   • www.comprarecarga.shop → CNAME → comprarecarga.shop"
    echo "   • api.comprarecarga.shop → A → SEU_IP"
    echo "   • pagamentos.comprarecarga.shop → A → SEU_IP"
    echo ""
    echo "3. ⏳ Aguardar propagação DNS (2-5 minutos)"
    echo ""
    echo "4. 🔒 Configurar SSL no Cloudflare:"
    echo "   • SSL/TLS → Full"
    echo "   • Always Use HTTPS → ON"
    echo ""
    echo "5. ✅ Testar:"
    echo "   • http://comprarecarga.shop"
    echo "   • http://api.comprarecarga.shop/health"
    echo "   • http://pagamentos.comprarecarga.shop/health"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
else
    echo -e "${RED}❌ Erro na configuração!${NC}"
    echo "Verifique os erros acima"
    exit 1
fi
