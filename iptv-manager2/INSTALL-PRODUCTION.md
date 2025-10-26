# 🚀 GUIA DE INSTALAÇÃO EM PRODUÇÃO

## ❌ PROBLEMA: Failed to fetch

Você viu este erro porque o frontend está tentando acessar `localhost:5001` mas em produção precisa acessar através do Nginx.

## ✅ SOLUÇÃO COMPLETA:

### 📋 Pré-requisitos
- Docker e Docker Compose instalados
- Nginx instalado
- Certbot instalado (para SSL)
- DNS apontando para o servidor

---

## 🔧 PASSO A PASSO:

### 1️⃣ Instalar IPTV Manager (Docker)

```bash
cd iptv-manager

# Configurar .env
nano .env
# Adicione sua API Key do 2Captcha

# Instalar containers
./install.sh
```

Isso vai subir:
- Backend na porta 5001
- Frontend na porta 5000

---

### 2️⃣ Configurar Nginx (Proxy Reverso)

```bash
# Ainda na pasta iptv-manager/
sudo ./install-nginx.sh
```

Este script vai:
- ✅ Copiar configuração para `/etc/nginx/sites-available/`
- ✅ Ativar o site
- ✅ Testar configuração
- ✅ Recarregar Nginx

---

### 3️⃣ Instalar Certificado SSL

```bash
sudo certbot --nginx -d iptv.comprarecarga.shop
```

Siga as instruções do Certbot.

---

### 4️⃣ Testar

```bash
# Testar health check do backend
curl https://iptv.comprarecarga.shop/health

# Resposta esperada:
# {"status":"ok","service":"IPTV Manager Backend","timestamp":"..."}

# Testar frontend
curl https://iptv.comprarecarga.shop

# Deve retornar HTML
```

---

### 5️⃣ Recarregar Frontend

```bash
# Recarregar frontend para pegar novo config.js
docker-compose restart iptv-manager-frontend
```

---

## 📊 COMO FUNCIONA:

### Antes (❌ Não funcionava):
```
Browser → https://iptv.comprarecarga.shop
       → tenta acessar localhost:5001 ❌ (Connection Refused)
```

### Depois (✅ Funciona):
```
Browser → https://iptv.comprarecarga.shop
       → Nginx (porta 443)
       → / rota para Frontend (porta 5000)
       → /api/ rota para Backend (porta 5001) ✅
```

---

## 🔍 VERIFICAR SE ESTÁ FUNCIONANDO:

### 1. Backend respondendo:
```bash
curl https://iptv.comprarecarga.shop/health
```

### 2. API do CloudNation respondendo:
```bash
curl -H "Authorization: Bearer SEU_TOKEN" \
     https://iptv.comprarecarga.shop/api/cloudnation/credentials
```

### 3. Frontend carregando:
```bash
curl https://iptv.comprarecarga.shop | grep "IPTV Manager"
```

---

## 🐛 TROUBLESHOOTING:

### Erro: "Connection Refused"
```bash
# Verificar se backend está rodando
docker ps | grep iptv_manager_backend

# Ver logs
docker logs iptv_manager_backend

# Testar backend direto
curl http://localhost:5001/health
```

### Erro 502 Bad Gateway
```bash
# Ver logs do Nginx
sudo tail -f /var/log/nginx/iptv_manager_error.log

# Verificar se Nginx está rodando
sudo systemctl status nginx

# Reiniciar Nginx
sudo systemctl restart nginx
```

### Erro 404 em /api/
```bash
# Verificar configuração do Nginx
sudo nginx -t

# Ver arquivo de configuração
cat /etc/nginx/sites-enabled/iptv.comprarecarga.shop

# Deve ter: location /api/ { proxy_pass http://localhost:5001/api/; }
```

---

## 📝 RESUMO DOS ARQUIVOS:

```
iptv-manager/
├── docker-compose.yml          # Containers
├── .env                        # Configurações (API Key aqui!)
├── install.sh                  # Instalar Docker
├── install-nginx.sh            # Instalar Nginx
├── nginx-production.conf       # Configuração Nginx
└── frontend/js/config.js       # URLs da API (já corrigido)
```

---

## ✅ CHECKLIST FINAL:

- [ ] Docker containers rodando (porta 5000 e 5001)
- [ ] Nginx configurado e rodando
- [ ] SSL instalado (certbot)
- [ ] Backend acessível via `/api/`
- [ ] Frontend carrega sem erros no console
- [ ] Autenticação funciona
- [ ] Consegue salvar credenciais CloudNation

---

## 🎯 PRÓXIMOS PASSOS APÓS INSTALAÇÃO:

1. Acesse https://iptv.comprarecarga.shop
2. Clique em "🔑 Credenciais Live21"
3. Digite usuário/senha do CloudNation
4. Clique em "📥 Carregar Clientes Live21"
5. Aguarde importação (pode levar minutos)
6. Veja os clientes importados!

---

**Precisa de ajuda? Verifique os logs:**
```bash
# Backend
docker logs -f iptv_manager_backend

# Nginx
sudo tail -f /var/log/nginx/iptv_manager_error.log
```
