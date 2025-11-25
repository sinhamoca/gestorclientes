# 📺 IPTV Playlist Manager

Sistema web para gerenciamento de playlists em players IPTV (IBOPlayer, IBOPro e VUPlayer).

## 🎯 Funcionalidades

- ✅ Autenticação integrada com gestao-clientes (JWT)
- ✅ Listagem de clientes do usuário logado
- ✅ Login automático nos players usando credenciais salvas
- ✅ Gerenciamento completo de playlists:
  - Adicionar playlist
  - Editar playlist
  - Deletar playlist
  - Listar playlists
- ✅ Suporte a 3 players:
  - **IBOPlayer** (com captcha automático)
  - **IBOPro** (com autenticação SHA3-512)
  - **VUPlayer**
- ✅ Interface minimalista e responsiva
- ✅ Sessões no navegador (SessionStorage)
- ✅ Segurança: Helmet, CORS, Rate Limiting

## 📋 Pré-requisitos

- Docker e Docker Compose
- Nginx
- Acesso ao banco PostgreSQL do gestao-clientes
- API Key do 2Captcha (para IBOPlayer)
- Cloudflare configurado

## 🚀 Instalação

### 1. Clone/Copie o projeto

```bash
cd /root
git clone <seu-repo> iptv-playlist-manager
# ou copie os arquivos manualmente
cd iptv-playlist-manager
```

### 2. Configure as variáveis de ambiente

Edite o arquivo `.env`:

```bash
nano .env
```

Principais variáveis:
- `CAPTCHA_API_KEY`: Sua chave da 2Captcha
- `JWT_SECRET`: Mesma secret do gestao-clientes
- `DB_PASSWORD`: Senha do PostgreSQL

### 3. Build e Start com Docker

```bash
# Certifique-se de estar na rede gestao-network
docker network ls | grep gestao-network

# Se não existir, crie:
docker network create gestao-network

# Build da imagem
docker-compose build

# Iniciar serviço
docker-compose up -d

# Ver logs
docker-compose logs -f
```

### 4. Configure o Nginx

```bash
# Copiar configuração
sudo cp nginx-config.txt /etc/nginx/sites-available/playlists.comprarecarga.shop

# Criar link simbólico
sudo ln -s /etc/nginx/sites-available/playlists.comprarecarga.shop /etc/nginx/sites-enabled/

# Testar configuração
sudo nginx -t

# Recarregar Nginx
sudo systemctl reload nginx
```

### 5. Configure o Cloudflare

No painel do Cloudflare, adicione um registro DNS:

- **Tipo**: A
- **Nome**: playlists
- **Conteúdo**: 37.60.235.47
- **Proxy**: ☁️ Ativado (laranja)
- **TTL**: Auto

Aguarde a propagação DNS (alguns minutos).

## 🔧 Comandos Úteis

```bash
# Ver logs
docker-compose logs -f iptv-playlist-manager

# Restart do serviço
docker-compose restart iptv-playlist-manager

# Stop
docker-compose down

# Rebuild (após mudanças)
docker-compose build --no-cache
docker-compose up -d

# Entrar no container
docker exec -it iptv-playlist-manager sh

# Ver status
docker-compose ps
```

## 📡 Endpoints da API

### Autenticação
Todas as rotas requerem header:
```
Authorization: Bearer <JWT_TOKEN>
```

### Clientes
```
GET /api/clients - Lista clientes do usuário
GET /api/clients/:id - Busca cliente específico
```

### IBOPlayer
```
POST /api/players/iboplayer/login
POST /api/players/iboplayer/playlists/list
POST /api/players/iboplayer/playlists
PUT /api/players/iboplayer/playlists/:id
DELETE /api/players/iboplayer/playlists/:id
```

### IBOPro
```
POST /api/players/ibopro/login
POST /api/players/ibopro/playlists/list
POST /api/players/ibopro/playlists
PUT /api/players/ibopro/playlists/:id
DELETE /api/players/ibopro/playlists/:id
```

### VUPlayer
```
POST /api/players/vuplayer/login
POST /api/players/vuplayer/playlists/list
POST /api/players/vuplayer/playlists
PUT /api/players/vuplayer/playlists/:id
DELETE /api/players/vuplayer/playlists/:id
```

## 🔐 Segurança

O projeto implementa:

- **Helmet**: Proteção de headers HTTP
- **CORS**: Apenas origins permitidas
- **Rate Limiting**: 
  - 100 req/15min (geral)
  - 10 req/1hora (login - por causa do captcha)
- **JWT**: Validação de token em todas as rotas protegidas
- **Input Validation**: Validação de dados de entrada

## 📊 Estrutura do Projeto

```
iptv-playlist-manager/
├── src/
│   ├── config/
│   │   └── database.js          # Conexão PostgreSQL
│   ├── controllers/
│   │   ├── clients.controller.js # Controller de clientes
│   │   └── players.controller.js # Controller de players
│   ├── services/
│   │   └── players.service.js    # Lógica de negócio
│   ├── libs/
│   │   ├── iboplayer-cli.js      # CLI adaptado IBOPlayer
│   │   ├── ibopro-cli.js         # CLI adaptado IBOPro
│   │   └── vuplayer-cli.js       # CLI adaptado VUPlayer
│   ├── middleware/
│   │   └── auth.js               # Middleware JWT
│   ├── routes/
│   │   ├── clients.routes.js     # Rotas de clientes
│   │   └── players.routes.js     # Rotas de players
│   └── server.js                 # Servidor Express
├── public/
│   ├── index.html               # Frontend
│   ├── css/
│   │   └── style.css            # Estilos
│   └── js/
│       └── app.js               # JavaScript frontend
├── docker-compose.yml
├── Dockerfile
├── package.json
├── .env
└── README.md
```

## ⚙️ Fluxo de Uso

1. Usuário faz login no gestao-clientes (obtém JWT)
2. Acessa https://playlists.comprarecarga.shop
3. Sistema valida JWT e lista seus clientes
4. Usuário clica em botão do player desejado
5. Para IBOPlayer: Seleciona domínio (iboiptv.com ou bobplayer.com)
6. Sistema faz login automaticamente (pode levar até 60s no IBOPlayer)
7. Lista playlists atuais
8. Usuário pode adicionar, editar ou deletar playlists
9. Sessão permanece ativa enquanto a aba estiver aberta

## 🐛 Troubleshooting

### Erro de conexão com banco
```bash
# Verificar se gestao_db está rodando
docker ps | grep gestao_db

# Testar conexão manualmente
docker exec -it gestao_db psql -U gestao_user -d gestao_clientes
```

### Erro "Token não fornecido"
- Certifique-se de estar logado no gestao-clientes
- Verifique se o JWT_SECRET é o mesmo nos dois projetos

### Timeout no IBOPlayer
- O captcha pode levar até 60 segundos
- Verifique se a CAPTCHA_API_KEY está correta
- Verifique saldo na conta da 2Captcha

### Erro de CORS
- Verifique a variável CORS_ORIGINS no .env
- Certifique-se de que o domínio está correto

## 📝 Notas Importantes

- **Custo do Captcha**: Cada login no IBOPlayer consome ~$0.003 USD
- **Rate Limiting**: Login limitado a 10 por hora para evitar gastos excessivos
- **Sessões**: São armazenadas no sessionStorage do navegador, não persistem ao fechar
- **Segurança**: Token JWT validado em todas as requisições
- **Performance**: IBOPlayer é mais lento devido ao captcha (~10-60s)

## 🔄 Atualizações Futuras

- [ ] Cache de sessões no servidor (Redis)
- [ ] Logs de auditoria
- [ ] Backup automático de playlists
- [ ] Suporte a mais players
- [ ] Dashboard com estatísticas

## 📞 Suporte

Em caso de problemas:
1. Verifique os logs: `docker-compose logs -f`
2. Teste o health check: `curl http://localhost:3005/health`
3. Verifique conectividade com DB

## 📄 Licença

Propriedade privada - Todos os direitos reservados.

---

**Desenvolvido para gestão de playlists IPTV** 📺
