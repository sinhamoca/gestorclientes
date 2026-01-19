#!/bin/bash
echo "🔧 CORRIGINDO DASHBOARD - Permissões"
echo "====================================="
echo ""

# 1. Mover para /var/www (acessível pelo Nginx)
echo "1️⃣ Movendo dashboard para /var/www..."
mkdir -p /var/www/wpp-dashboard
cp -r ~/wpp-dashboard/* /var/www/wpp-dashboard/

# 2. Ajustar permissões
echo "2️⃣ Ajustando permissões..."
chown -R www-data:www-data /var/www/wpp-dashboard
chmod -R 755 /var/www/wpp-dashboard

# 3. Atualizar configuração do Nginx
echo "3️⃣ Atualizando configuração do Nginx..."
cat > /etc/nginx/sites-available/wpp-dashboard << 'NGINX_END'
server {
    listen 9001;
    server_name _;
    
    root /var/www/wpp-dashboard;
    index index.html;
    
    # Logs
    access_log /var/log/nginx/wpp-dashboard-access.log;
    error_log /var/log/nginx/wpp-dashboard-error.log;
    
    # Servir arquivos estáticos
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Cache para assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1d;
        add_header Cache-Control "public, immutable";
    }
}
NGINX_END

# 4. Reativar site
echo "4️⃣ Reativando site..."
ln -sf /etc/nginx/sites-available/wpp-dashboard /etc/nginx/sites-enabled/

# 5. Testar e reload
echo "5️⃣ Testando configuração..."
nginx -t

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Sintaxe OK! Recarregando Nginx..."
    systemctl reload nginx
    
    echo ""
    echo "=========================================="
    echo "✅ DASHBOARD CORRIGIDO!"
    echo "=========================================="
    echo ""
    echo "📍 Acesse: http://$(curl -s ifconfig.me):9001"
    echo ""
    
    # Mostrar API Key
    API_KEY=$(grep API_KEY ~/wpp-connect/.env 2>/dev/null | cut -d= -f2)
    if [ ! -z "$API_KEY" ]; then
        echo "🔐 API Key: $API_KEY"
        echo ""
    fi
    
    echo "💡 Se ainda der erro, execute:"
    echo "   tail -f /var/log/nginx/wpp-dashboard-error.log"
else
    echo ""
    echo "❌ Erro na configuração do Nginx!"
    echo "Verifique os erros acima"
fi
