#!/bin/bash
# ========================================
# DIAGNÓSTICO - IPTV SERVICE
# ========================================

echo "🔍 DIAGNÓSTICO DO SISTEMA IPTV"
echo "========================================"
echo ""

# 1. Verificar se Docker está rodando
echo "1️⃣ DOCKER STATUS:"
docker ps | grep iptv_renewal_frontend
if [ $? -eq 0 ]; then
    echo "✅ Container rodando!"
else
    echo "❌ Container NÃO está rodando!"
    echo "   Execute: cd iptv-renewal-service && docker-compose up -d"
fi
echo ""

# 2. Verificar se porta 5000 está respondendo
echo "2️⃣ TESTE PORTA 5000:"
curl -s http://localhost:5000 | head -n 5
if [ $? -eq 0 ]; then
    echo "✅ Porta 5000 respondendo!"
else
    echo "❌ Porta 5000 não responde!"
fi
echo ""

# 3. Verificar configuração Nginx
echo "3️⃣ NGINX CONFIG:"
if [ -f /etc/nginx/sites-enabled/iptv.comprarecarga.shop ]; then
    echo "✅ Site ativo no Nginx"
else
    echo "❌ Site NÃO está ativo!"
fi
echo ""

# 4. Verificar SSL
echo "4️⃣ CERTIFICADO SSL:"
if [ -f /etc/letsencrypt/live/iptv.comprarecarga.shop/fullchain.pem ]; then
    echo "✅ Certificado SSL instalado!"
else
    echo "❌ Certificado SSL NÃO instalado!"
    echo "   Execute: sudo certbot --nginx -d iptv.comprarecarga.shop"
fi
echo ""

# 5. Teste de DNS
echo "5️⃣ TESTE DNS:"
nslookup iptv.comprarecarga.shop | grep Address
echo ""

# 6. Teste do domínio
echo "6️⃣ TESTE DO DOMÍNIO:"
curl -I https://iptv.comprarecarga.shop 2>&1 | grep -E "HTTP|Location"
echo ""

echo "========================================"
echo "📊 LOGS RECENTES DO NGINX:"
echo "========================================"
tail -n 20 /var/log/nginx/iptv_comprarecarga_error.log 2>/dev/null || echo "Sem logs de erro ainda"
echo ""
