# WhatsApp-Web.js Service

Sistema completo de automação WhatsApp usando **whatsapp-web.js** com interface administrativa web.

## 🚀 Funcionalidades

- ✅ **Multi-sessão**: Gerencie múltiplas instâncias do WhatsApp
- ✅ **Interface Web**: Dashboard administrativo simples e intuitivo
- ✅ **API REST**: Endpoints completos para integração
- ✅ **QR Code**: Geração automática para autenticação
- ✅ **Persistência**: Sessões salvas entre reinicializações
- ✅ **Docker**: Containerizado e pronto para produção
- ✅ **Autenticação**: API Key para segurança

## 📋 Pré-requisitos

- Docker e Docker Compose instalados
- Porta 9100 (API) e 9101 (Dashboard) livres
- Rede Docker `shared_network` (criada automaticamente)

## 🔧 Instalação Rápida

```bash
# 1. Clone ou copie o projeto
cd wweb-service/

# 2. Execute o instalador
chmod +x install.sh
./install.sh

# 3. Acesse o Dashboard
# http://localhost:9101
```

A instalação irá:
- ✅ Gerar uma API Key automaticamente
- ✅ Criar os containers Docker
- ✅ Configurar a rede compartilhada
- ✅ Iniciar os serviços

## 🔐 API Key

A API Key é gerada automaticamente e salva em `.env`:

```bash
# Ver a API Key gerada
cat .env | grep API_KEY
```

**IMPORTANTE**: Salve esta chave! Você precisará dela para:
- Login no Dashboard
- Integração com outros sistemas (gestao-clientes, etc)

## 📡 Endpoints da API

### Health Check (Público)
```bash
GET /health
```

### Criar Sessão
```bash
POST /api/session/create
Headers: X-API-Key: sua-api-key
Body: {
  "sessionId": "client123"
}

Resposta:
{
  "success": true,
  "needsQR": true,
  "qr": "data:image/png;base64,...",
  "message": "QR Code gerado com sucesso"
}
```

### Status da Sessão
```bash
GET /api/session/status/:sessionId
Headers: X-API-Key: sua-api-key

Resposta:
{
  "success": true,
  "sessionId": "client123",
  "status": "connected",
  "connected": true
}
```

### Obter QR Code
```bash
GET /api/session/qr/:sessionId
Headers: X-API-Key: sua-api-key

Resposta:
{
  "success": true,
  "sessionId": "client123",
  "qr": "data:image/png;base64,..."
}
```

### Desconectar Sessão
```bash
DELETE /api/session/disconnect/:sessionId
Headers: X-API-Key: sua-api-key

Resposta:
{
  "success": true,
  "message": "Sessão desconectada"
}
```

### Listar Sessões
```bash
GET /api/session/list
Headers: X-API-Key: sua-api-key

Resposta:
{
  "success": true,
  "sessions": [
    {
      "sessionId": "client123",
      "hasQR": false,
      "created": true
    }
  ]
}
```

### Enviar Mensagem
```bash
POST /api/message/send
Headers: X-API-Key: sua-api-key
Body: {
  "sessionId": "client123",
  "to": "5511999999999",
  "message": "Olá! Esta é uma mensagem de teste."
}

Resposta:
{
  "success": true,
  "message": "Mensagem enviada"
}
```

## 🖥️ Dashboard Admin

Acesse: **http://localhost:9101**

Funcionalidades:
- 📊 Dashboard com estatísticas
- 📱 Gerenciar sessões WhatsApp
- ➕ Criar novas instâncias
- 🔄 Ver QR Codes
- 📤 Enviar mensagens de teste
- 🗑️ Desconectar sessões

## 🧪 Testes

```bash
# Testar a API
npm run test

# Ver logs do container
docker logs -f wweb_service

# Ver logs do dashboard
docker logs -f wweb_dashboard
```

## 🔄 Comandos Úteis

```bash
# Iniciar serviços
docker-compose up -d

# Parar serviços
docker-compose down

# Reiniciar serviços
docker-compose restart

# Ver logs em tempo real
docker-compose logs -f

# Ver status dos containers
docker-compose ps

# Rebuild completo
docker-compose up -d --build --force-recreate
```

## 📂 Estrutura do Projeto

```
wweb-service/
├── src/                          # Backend (Node.js)
│   ├── server.js                 # Servidor Express
│   ├── wwebService.js            # Gerenciador whatsapp-web.js
│   ├── authMiddleware.js         # Autenticação
│   └── logger.js                 # Sistema de logs
├── wweb-dashboard/               # Frontend (React)
│   ├── index.html
│   └── js/
│       ├── config.js             # Configurações
│       ├── api.js                # API Helper
│       ├── app.js                # App Principal
│       └── components/           # Componentes React
├── sessions/                     # Sessões WhatsApp (Docker volume)
├── logs/                         # Logs do sistema
├── docker-compose.yml
├── Dockerfile
├── package.json
└── install.sh                    # Instalador automático
```

## 🔧 Configuração Avançada

### Alterar Portas

Edite `.env`:
```env
PORT=9100  # Porta da API
```

Edite `docker-compose.yml`:
```yaml
ports:
  - "9101:80"  # Porta do Dashboard
```

### Ajustar Recursos

Edite `docker-compose.yml`:
```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 2G
```

### Logs

Os logs são salvos em:
- `logs/combined.log` - Todos os logs
- `logs/error.log` - Apenas erros

## 🐛 Troubleshooting

### API não responde
```bash
# Ver logs
docker logs wweb_service

# Verificar se está rodando
docker ps | grep wweb_service

# Reiniciar
docker-compose restart wweb-service
```

### Dashboard não carrega
```bash
# Ver logs do Nginx
docker logs wweb_dashboard

# Verificar porta
curl http://localhost:9101
```

### Sessões não persistem
```bash
# Verificar volume
docker volume ls | grep wweb

# Verificar mapeamento
docker inspect wweb_service | grep -A 5 Mounts
```

### QR Code não aparece
- Verifique se a sessão foi criada corretamente
- Aguarde alguns segundos (pode demorar até 45s)
- Veja os logs: `docker logs -f wweb_service`

## 🔗 Integração com gestao-clientes

Para integrar com seu sistema existente:

1. **Configure a API Key** no gestao-clientes:
```javascript
WWEB_API_URL=http://37.60.235.47:9100
WWEB_API_KEY=sua-api-key-gerada
```

2. **Criar sessão para cada usuário**:
```javascript
const sessionId = `user_${userId}`;
await createSession(sessionId);
```

3. **Enviar mensagens**:
```javascript
await sendMessage(sessionId, phoneNumber, message);
```

## 📈 Performance

- **Limite recomendado**: 10-15 sessões simultâneas por VPS
- **Memória por sessão**: ~150-200MB
- **CPU**: Baixo uso após conectar

## 🔒 Segurança

- ✅ API Key obrigatória
- ✅ Validação de entrada
- ✅ Container não-root
- ✅ Rede isolada

## 📝 Diferenças do wpp-connect

| Recurso | wpp-connect | wweb-service |
|---------|-------------|--------------|
| Biblioteca | @wppconnect | whatsapp-web.js |
| Porta API | 9000 | 9100 |
| Porta Dashboard | 9001 | 9101 |
| Volume | whatsapp_sessions | wweb_sessions |
| Container API | whatsapp_service | wweb_service |
| Container Dashboard | wpp_dashboard | wweb_dashboard |

## 🆘 Suporte

- Documentação whatsapp-web.js: https://wwebjs.dev/
- Issues do projeto: https://github.com/pedroslopez/whatsapp-web.js

## 📄 Licença

MIT
