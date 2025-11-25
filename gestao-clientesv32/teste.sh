# Script para fazer 7 tentativas de login
echo "🧪 Testando rate limiting em login..."
echo "Limite: 5 tentativas a cada 15 minutos"
echo ""

for i in {1..7}; do
  echo "════════════════════════════════════"
  echo "Tentativa $i de 7"
  echo "════════════════════════════════════"
  
  RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" \
    -X POST https://api.comprarecarga.shop/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"teste@teste.com","password":"senha-errada-propositalmente"}')
  
  HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
  BODY=$(echo "$RESPONSE" | grep -v "HTTP_CODE:")
  
  echo "Status: $HTTP_CODE"
  echo "Resposta: $BODY" | jq 2>/dev/null || echo "$BODY"
  
  if [ "$i" -le 5 ]; then
    echo "✅ Tentativa $i: Processada (dentro do limite)"
  else
    if [ "$HTTP_CODE" = "429" ]; then
      echo "🛡️  Tentativa $i: BLOQUEADA! Rate limit funcionando!"
    else
      echo "❌ Tentativa $i: FALHA! Deveria ter sido bloqueada!"
    fi
  fi
  
  echo ""
  sleep 1
done

echo "════════════════════════════════════"
echo "Resultado Final:"
echo "════════════════════════════════════"
echo "Se as tentativas 6 e 7 foram BLOQUEADAS (429):"
echo "✅ RATE LIMITING ESTÁ FUNCIONANDO PERFEITAMENTE!"
echo ""
echo "Se as tentativas 6 e 7 NÃO foram bloqueadas:"
echo "❌ Rate limiting NÃO está ativo"
