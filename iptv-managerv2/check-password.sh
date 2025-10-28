#!/bin/bash
echo "🔍 VERIFICANDO SENHA SALVA NO BANCO"
echo "===================================="
echo ""

# Buscar credenciais
RESULT=$(docker exec iptv_manager_backend sqlite3 /app/data/iptv_manager.db \
  "SELECT username, password FROM cloudnation_credentials WHERE username='ISAAC568';" 2>/dev/null)

if [ -z "$RESULT" ]; then
    echo "❌ Credenciais não encontradas para ISAAC568"
    exit 1
fi

USERNAME=$(echo "$RESULT" | cut -d'|' -f1)
PASSWORD_B64=$(echo "$RESULT" | cut -d'|' -f2)

echo "Username: $USERNAME"
echo "Senha (base64): $PASSWORD_B64"
echo ""

# Decodificar
PASSWORD=$(echo "$PASSWORD_B64" | base64 -d 2>/dev/null)

echo "Senha (decodificada): $PASSWORD"
echo ""
echo "===================================="
echo ""
echo "⚠️  IMPORTANTE:"
echo ""
echo "1. Tente fazer login MANUAL no navegador:"
echo "   https://painel.cloudnation.top"
echo "   Usuário: $USERNAME"
echo "   Senha: $PASSWORD"
echo ""
echo "2. Se NÃO conseguir logar → Senha está ERRADA"
echo ""
echo "3. Se CONSEGUIR logar → O problema está no código"
echo "   (provavelmente CloudNation mudou algo no formulário)"
echo ""
