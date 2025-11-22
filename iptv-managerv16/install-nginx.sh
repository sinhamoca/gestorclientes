#!/bin/bash
# ========================================
# INSTALAÇÃO NGINX - IPTV MANAGER
# ========================================

echo "🔧 Configurando Nginx para IPTV Manager"
echo "========================================"
echo ""

# Verificar se é root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Este script precisa ser executado como root (use sudo)"
    exit 1
fi

# Verificar se arquivo existe
if [ ! -f "nginx-production.conf" ]; then
    echo "❌ Arquivo nginx-production.conf não encontrado!"
    echo "   Execute este script na pasta iptv-manager/"
    exit 1
fi

# 1. Copiar configuração
echo "📝 Copiando configuração do Nginx..."
cp nginx-production.conf /etc/nginx/sites-available/iptv.comprarecarga.shop

if [ $? -eq 0 ]; then
    echo "   ✅ Arquivo copiado!"
else
    echo "   ❌ Erro ao copiar arquivo"
    exit 1
fi

echo ""

# 2. Criar link simbólico
echo "🔗 Ativando site..."
ln -sf /etc/nginx/sites-available/iptv.comprarecarga.shop /etc/nginx/sites-enabled/

if [ $? -eq 0 ]; then
    echo "   ✅ Site ativado!"
else
    echo "   ❌ Erro ao ativar site"
    exit 1
fi

echo ""

# 3. Testar configuração
echo "🧪 Testando configuração do Nginx..."
nginx -t

if [ $? -eq 0 ]; then
    echo ""
    echo "   ✅ Configuração válida!"
    echo ""
    
    # 4. Recarregar Nginx
    echo "🔄 Recarregando Nginx..."
    systemctl reload nginx
    
    if [ $? -eq 0 ]; then
        echo "   ✅ Nginx recarregado!"
        echo ""
        echo "=========================================="
        echo "✅ NGINX CONFIGURADO COM SUCESSO!"
        echo "=========================================="
        echo ""
        echo "📍 Agora o frontend acessa o backend através de:"
        echo "   https://iptv.comprarecarga.shop/api/"
        echo ""
        echo "🔐 PRÓXIMO PASSO: Instalar certificado SSL"
        echo ""
        echo "Execute:"
        echo "   sudo certbot --nginx -d iptv.comprarecarga.shop"
        echo ""
        echo "🧪 TESTAR:"
        echo "   curl https://iptv.comprarecarga.shop/health"
        echo ""
    else
        echo "   ❌ Erro ao recarregar Nginx"
        exit 1
    fi
else
    echo ""
    echo "   ❌ Configuração inválida!"
    echo "   Verifique os erros acima"
    exit 1
fi
