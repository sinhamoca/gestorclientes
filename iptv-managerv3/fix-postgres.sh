#!/bin/bash
# ========================================
# CORRIGIR .ENV AUTOMATICAMENTE
# ========================================

echo "🔧 CORRIGINDO .ENV..."
echo "========================================"
echo ""

# Backup do .env atual
cp .env .env.backup
echo "✅ Backup criado: .env.backup"
echo ""

# Corrigir POSTGRES_HOST
sed -i 's/POSTGRES_HOST=postgres-gestao/POSTGRES_HOST=gestao_db/' .env

echo "✅ .env corrigido!"
echo ""
echo "Mudança aplicada:"
echo "  POSTGRES_HOST=postgres-gestao → POSTGRES_HOST=gestao_db"
echo ""

# Conectar gestao_db à rede (se não estiver)
echo "🔗 Conectando gestao_db à rede shared_network..."
docker network connect shared_network gestao_db 2>/dev/null && echo "✅ Conectado!" || echo "ℹ️  Já estava conectado"
echo ""

# Reiniciar backend
echo "🔄 Reiniciando backend..."
docker restart iptv_manager_backend
echo ""

echo "⏳ Aguardando backend iniciar..."
sleep 5
echo ""

# Testar conexão
echo "🧪 TESTANDO CONEXÃO..."
echo "-------------------"
docker exec iptv_manager_backend sh -c '
node -e "
const { Pool } = require(\"pg\");
const pool = new Pool({
  host: \"gestao_db\",
  port: 5432,
  database: \"gestao_clientes\",
  user: \"gestao_user\",
  password: process.env.POSTGRES_PASSWORD
});

pool.query(\"SELECT COUNT(*) as total FROM clients WHERE user_id = 2\")
  .then(result => {
    console.log(\"✅ CONEXÃO OK!\");
    console.log(\"📊 Clientes do user 2:\", result.rows[0].total);
  })
  .catch(err => {
    console.log(\"❌ Erro:\", err.message);
  })
  .finally(() => process.exit());
"
' 2>&1

echo ""
echo "========================================"
echo "✅ CORREÇÃO CONCLUÍDA!"
echo "========================================"
echo ""
echo "Agora acesse a interface:"
echo "  http://localhost:5000"
echo ""
echo "Ou em produção:"
echo "  https://iptv.comprarecarga.shop"
echo ""
echo "Os clientes do PostgreSQL devem aparecer agora!"
echo ""
echo "Para ver logs:"
echo "  docker logs -f iptv_manager_backend"
echo ""
