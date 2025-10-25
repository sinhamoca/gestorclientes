#!/bin/bash
# ========================================
# INSTALAÇÃO NGINX - iptv.comprarecarga.shop
# ========================================

echo "🚀 Configurando iptv.comprarecarga.shop no Nginx..."
echo ""

# Verifica se está rodando como root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Este script precisa ser executado como root (use sudo)"
    exit 1
fi

# 1. Copiar arquivo de configuração
echo "📝 Criando arquivo de configuração..."
cat > /etc/nginx/sites-available/iptv.comprarecarga.shop << 'EOF'
# ========================================
# SUBDOMÍNIO: iptv.comprarecarga.shop
# Sistema de Renovação IPTV - Porta 5000
# ========================================

server {
    listen 80;
    listen [::]:80;
    server_name iptv.comprarecarga.shop;

    # Logs
    access_log /var/log/nginx/iptv_comprarecarga_access.log;
    error_log /var/log/nginx/iptv_comprarecarga_error.log;

    # Tamanho máximo de upload
    client_max_body_size 10M;

    # Proxy para IPTV Renewal Service (porta 5000)
    location / {
        proxy_pass http://localhost:5000;
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
        proxy_pass http://localhost:5000/health;
        access_log off;
    }
}
EOF

echo "✅ Arquivo criado: /etc/nginx/sites-available/iptv.comprarecarga.shop"
echo ""

# 2. Criar link simbólico
echo "🔗 Ativando site..."
ln -sf /etc/nginx/sites-available/iptv.comprarecarga.shop /etc/nginx/sites-enabled/
echo "✅ Link simbólico criado!"
echo ""

# 3. Testar configuração
echo "🧪 Testando configuração do Nginx..."
nginx -t

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Configuração válida!"
    echo ""
    
    # 4. Recarregar Nginx
    echo "🔄 Recarregando Nginx..."
    systemctl reload nginx
    
    if [ $? -eq 0 ]; then
        echo "✅ Nginx recarregado com sucesso!"
        echo ""
        echo "=========================================="
        echo "✅ INSTALAÇÃO CONCLUÍDA!"
        echo "=========================================="
        echo ""
        echo "📍 Domínio configurado: https://iptv.comprarecarga.shop"
        echo ""
        echo "⚠️  PRÓXIMOS PASSOS:"
        echo ""
        echo "1. Configure o DNS apontando para este servidor:"
        echo "   iptv.comprarecarga.shop → $IP_ADDRESS"
        echo ""
        echo "2. Instale o certificado SSL:"
        echo "   sudo certbot --nginx -d iptv.comprarecarga.shop"
        echo ""
        echo "3. Certifique-se que o Docker está rodando:"
        echo "   docker ps | grep iptv_renewal_frontend"
        echo ""
    else
        echo "❌ Erro ao recarregar Nginx"
        exit 1
    fi
else
    echo ""
    echo "❌ Erro na configuração do Nginx!"
    echo "Verifique os erros acima e corrija."
    exit 1
fi
