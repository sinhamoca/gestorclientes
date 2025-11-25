# 🚀 Guia de Deploy - IPTV Playlist Manager

## Passo a Passo Completo

### 1️⃣ Preparação no Servidor

```bash
# Conectar no servidor
ssh root@37.60.235.47

# Navegar para diretório raiz
cd /root

# Verificar se gestao-clientes está rodando
docker ps | grep gestao

# Verificar rede Docker
docker network ls | grep gestao-network
```

### 2️⃣ Upload do Projeto

Você tem 2 opções:

**Opção A - Via Git:**
```bash
cd /root
git clone <seu-repositorio> iptv-playlist-manager
cd iptv-playlist-manager
```

**Opção B - Via SCP (do seu computador local):**
```bash
# No seu computador local:
scp -r iptv-playlist-manager root@37.60.235.47:/root/
```

**Opção C - Criar manualmente:**
```bash
cd /root
mkdir iptv-playlist-manager
cd iptv-playlist-manager

# Depois copie todos os arquivos um por um
# ou use o método que preferir
```

### 3️⃣ Configurar Variáveis de Ambiente

```bash
cd /root/iptv-playlist-manager

# Editar .env
nano .env
```

Verifique especialmente:
```env
CAPTCHA_API_KEY=87fd25839e716a8ad24b3cbb81067b75
JWT_SECRET=1a1f97befa0f17b739ababa75b51a0f3c00b09996520bd5f8c6fc43087dddebb
DB_PASSWORD=Gestao_DB_Pass_2025!
```

**IMPORTANTE**: Confirme que o JWT_SECRET é exatamente o mesmo do gestao-clientes!

### 4️⃣ Testar Conexão com Banco

Antes de fazer o build, teste se consegue conectar no banco:

```bash
# Testar conexão
docker exec -it gestao_db psql -U gestao_user -d gestao_clientes -c "SELECT COUNT(*) FROM users;"

# Deve retornar algo como:
#  count 
# -------
#      4
# (1 row)
```

Se der erro, verifique:
- Container `gestao_db` está rodando?
- Credenciais estão corretas no .env?

### 5️⃣ Build e Start do Container

```bash
cd /root/iptv-playlist-manager

# Build da imagem
docker-compose build

# Verificar se a imagem foi criada
docker images | grep iptv-playlist

# Iniciar container
docker-compose up -d

# Aguardar alguns segundos e verificar logs
docker-compose logs -f iptv-playlist-manager
```

**Logs esperados:**
```
✅ Conexão com PostgreSQL estabelecida
╔══════════════════════════════════════════════════╗
║     IPTV Playlist Manager - Servidor Ativo      ║
╠══════════════════════════════════════════════════╣
║  Porta:        3005                              ║
║  Ambiente:     production                        ║
║  URL:          http://localhost:3005             ║
╚══════════════════════════════════════════════════╝
```

Se aparecer erro, verifique os logs completos.

### 6️⃣ Testar Localmente

```bash
# Health check
curl http://localhost:3005/health

# Deve retornar:
# {"status":"ok","timestamp":"2024-...","service":"IPTV Playlist Manager"}

# Testar listagem de clientes (precisa de token)
# Pegar um token JWT do gestao-clientes primeiro
```

### 7️⃣ Configurar Nginx

```bash
# Copiar configuração
sudo cp /root/iptv-playlist-manager/nginx-config.txt /etc/nginx/sites-available/playlists.comprarecarga.shop

# Criar link simbólico
sudo ln -s /etc/nginx/sites-available/playlists.comprarecarga.shop /etc/nginx/sites-enabled/

# Verificar configuração
sudo nginx -t

# Deve retornar:
# nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration file /etc/nginx/nginx.conf test is successful

# Recarregar Nginx
sudo systemctl reload nginx

# Verificar status
sudo systemctl status nginx
```

### 8️⃣ Configurar DNS no Cloudflare

1. Acesse o painel do Cloudflare
2. Selecione o domínio `comprarecarga.shop`
3. Vá em **DNS** > **Records**
4. Clique em **Add record**
5. Preencha:
   - **Type**: A
   - **Name**: playlists
   - **IPv4 address**: 37.60.235.47
   - **Proxy status**: ☁️ Proxied (laranja - ATIVADO)
   - **TTL**: Auto
6. Clique em **Save**

**Aguarde 2-5 minutos** para propagação DNS.

### 9️⃣ Verificar Funcionamento

```bash
# Do servidor, testar o domínio
curl -I https://playlists.comprarecarga.shop/health

# Deve retornar HTTP 200
```

Do seu navegador, acesse:
```
https://playlists.comprarecarga.shop
```

Se aparecer erro de autenticação, é esperado! Você precisa fazer login no gestao-clientes primeiro.

### 🔟 Teste Completo

1. Acesse: https://api.comprarecarga.shop (ou onde está seu gestao-clientes)
2. Faça login com suas credenciais
3. Abra uma nova aba e acesse: https://playlists.comprarecarga.shop
4. Deve aparecer a lista de seus clientes
5. Clique em um dos botões (IBOPlayer, IBOPro ou VUPlayer)
6. Para IBOPlayer, selecione o domínio
7. Aguarde o login (pode levar até 60 segundos)
8. Deve aparecer a interface de gerenciamento de playlists

---

## ✅ Checklist de Verificação

- [ ] Container `iptv-playlist-manager` rodando
- [ ] Logs sem erros
- [ ] Health check respondendo (curl localhost:3005/health)
- [ ] Nginx configurado corretamente
- [ ] DNS configurado no Cloudflare
- [ ] Domínio acessível via HTTPS
- [ ] Autenticação funcionando
- [ ] Listagem de clientes OK
- [ ] Login em pelo menos 1 player OK
- [ ] Operações de playlist funcionando

---

## 🐛 Troubleshooting Comum

### Erro: "Cannot connect to database"
```bash
# Verificar se gestao_db está na mesma network
docker network inspect gestao-network

# Deve listar tanto gestao_db quanto iptv-playlist-manager
```

**Solução**: Adicionar manualmente à network:
```bash
docker network connect gestao-network iptv-playlist-manager
docker-compose restart
```

### Erro: "Token não fornecido"
- Faça login no gestao-clientes primeiro
- Verifique se JWT_SECRET é o mesmo nos 2 projetos
- Limpe cache do navegador

### Erro 502 Bad Gateway (Nginx)
```bash
# Verificar se container está rodando
docker ps | grep iptv-playlist

# Ver logs
docker-compose logs -f

# Restart do container
docker-compose restart
```

### Captcha não resolve (IBOPlayer)
- Verifique saldo na conta da 2Captcha
- Confirme que CAPTCHA_API_KEY está correta
- Teste a API key no site da 2Captcha

### Erro de CORS
Edite o .env e certifique-se que todos os domínios estão listados:
```env
CORS_ORIGINS=https://comprarecarga.shop,https://api.comprarecarga.shop,https://playlists.comprarecarga.shop
```

Depois restart:
```bash
docker-compose restart
```

---

## 📊 Monitoramento

```bash
# Ver logs em tempo real
docker-compose logs -f iptv-playlist-manager

# Ver uso de recursos
docker stats iptv-playlist-manager

# Ver processos internos
docker exec -it iptv-playlist-manager ps aux

# Health check periódico
watch -n 10 'curl -s http://localhost:3005/health | jq'
```

---

## 🔄 Manutenção

### Atualizar o código
```bash
cd /root/iptv-playlist-manager
git pull  # se usar git
docker-compose build --no-cache
docker-compose up -d
```

### Backup da configuração
```bash
cd /root
tar -czf iptv-playlist-manager-backup-$(date +%Y%m%d).tar.gz iptv-playlist-manager/
```

### Ver logs de erros
```bash
docker-compose logs --tail=100 iptv-playlist-manager | grep -i error
```

---

## 🎉 Sucesso!

Se chegou até aqui e tudo está funcionando, parabéns! 

O sistema está pronto para uso. Lembre-se:
- Login no IBOPlayer pode levar até 60 segundos
- Rate limit de 10 logins por hora no IBOPlayer
- Sessões são mantidas enquanto a aba do navegador estiver aberta

**Qualquer dúvida, consulte os logs:**
```bash
docker-compose logs -f iptv-playlist-manager
```
