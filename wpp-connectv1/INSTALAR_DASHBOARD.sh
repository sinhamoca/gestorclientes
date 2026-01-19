#!/bin/bash
echo "📱 INSTALANDO WPPCONNECT DASHBOARD"
echo "===================================="
echo ""

# 1. Criar estrutura
echo "1️⃣ Criando estrutura de pastas..."
cd ~
mkdir -p wpp-dashboard/js/components

# 2. Copiar arquivos (você precisa ter os arquivos em /tmp/wpp-dashboard)
echo "2️⃣ Copiando arquivos..."
cp -r /tmp/wpp-dashboard/* ~/wpp-dashboard/

# 3. Pegar API Key do .env
API_KEY=$(grep API_KEY ~/wpp-connect/.env | cut -d= -f2)
echo ""
echo "🔐 API Key encontrada: ${API_KEY:0:20}..."

# 4. Configurar nginx
echo ""
echo "3️⃣ Configurando Nginx..."

cat > /etc/nginx/sites-available/wpp-dashboard << NGINX_END
server {
    listen 9001;
    server_name _;
    
    root /root/wpp-dashboard;
    index index.html;
    
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    
    # CORS para API
    location /api {
        if (\$request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '*';
            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, DELETE';
            add_header 'Access-Control-Allow-Headers' 'Content-Type, x-api-key';
            return 204;
        }
    }
}
NGINX_END

# Ativar site
ln -sf /etc/nginx/sites-available/wpp-dashboard /etc/nginx/sites-enabled/

# Testar e reload nginx
nginx -t && systemctl reload nginx

echo ""
echo "=========================================="
echo "✅ DASHBOARD INSTALADO COM SUCESSO!"
echo "=========================================="
echo ""
echo "📍 Acesse: http://$(curl -s ifconfig.me):9001"
echo ""
echo "🔐 Login:"
echo "   API Key: $API_KEY"
echo ""
echo "💡 Cole a API Key na tela de login!"
echo ""
