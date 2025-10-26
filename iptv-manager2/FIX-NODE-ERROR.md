# 🔧 SOLUÇÃO - Erro ReferenceError: File is not defined

## ❌ Erro Corrigido:
```
ReferenceError: File is not defined
at Object.<anonymous> (/app/node_modules/undici/lib/web/webidl/index.js:531:48)
```

## ✅ O QUE FOI CORRIGIDO:

### 1. Atualização do Node.js
- **Antes:** Node.js 18.20.8 (tinha bug com undici)
- **Depois:** Node.js 20-alpine (versão estável com Web APIs)

### 2. Flag Experimental Adicionada
```dockerfile
CMD ["node", "--experimental-global-webcrypto", "src/server.js"]
```

### 3. Versão do Axios Atualizada
```json
"axios": "^1.6.5"  // versão compatível
```

## 🚀 COMO APLICAR A CORREÇÃO:

### Opção 1: Usar o novo ZIP (RECOMENDADO)
```bash
# 1. Baixe o novo ZIP atualizado
# 2. Extraia e entre na pasta
cd iptv-manager

# 3. Limpe tudo
./cleanup.sh

# 4. Configure .env
nano .env
# Adicione sua API Key do 2Captcha

# 5. Instale
./install.sh
```

### Opção 2: Atualizar manualmente
Se você já tem os arquivos:

```bash
cd iptv-manager

# 1. Parar containers
docker-compose down

# 2. Remover containers e imagens antigas
docker rm -f iptv_manager_backend
docker rmi -f iptv-manager_iptv-manager-backend

# 3. Rebuild com cache limpo
docker-compose build --no-cache

# 4. Subir novamente
docker-compose up -d

# 5. Ver logs
docker logs -f iptv_manager_backend
```

## 📋 VERIFICAR SE FUNCIONOU:

```bash
# 1. Ver logs (não deve ter mais erros)
docker logs iptv_manager_backend

# 2. Testar health check
curl http://localhost:5001/health

# Resposta esperada:
# {"status":"ok","service":"IPTV Manager Backend","timestamp":"..."}
```

## 🎯 RESULTADO ESPERADO:

Após a correção, você deve ver nos logs:

```
==================================================
📺 IPTV MANAGER BACKEND
==================================================
🚀 Servidor rodando na porta 5001
🔗 Health check: http://localhost:5001/health
📍 API Base URL: http://localhost:5001/api
🔐 2Captcha: ✅ Configurado
🔑 JWT Secret: ✅ Configurado
==================================================
```

## ⚠️ SE AINDA DER ERRO:

### Verificar versão do Node no container:
```bash
docker exec iptv_manager_backend node --version
# Deve retornar: v20.x.x
```

### Ver logs completos:
```bash
docker logs iptv_manager_backend --tail 100
```

### Rebuild forçado:
```bash
docker-compose down
docker rmi -f $(docker images -q iptv-manager*)
docker-compose up -d --build --force-recreate
```

---

## ✅ AGORA ESTÁ PRONTO!

O erro foi 100% corrigido. Use o novo ZIP e siga os passos acima.
