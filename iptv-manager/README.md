# 📺 IPTV Renewal Service

Sistema de renovação automatizada de clientes IPTV integrado ao Sistema de Gestão de Clientes.

## 🏗️ Arquitetura

Este serviço funciona como um **módulo isolado** que:
- ✅ Compartilha autenticação JWT com o sistema principal
- ✅ Acessa o mesmo banco de dados PostgreSQL
- ✅ Comunica através da rede Docker `shared_network`
- ✅ Roda independentemente na porta **5000**

## 🚀 Como Usar

### 1. Certifique-se que a rede compartilhada existe

```bash
docker network create shared_network
```

### 2. Suba o serviço

```bash
cd iptv-renewal-service
docker-compose up -d
```

### 3. Acesse no navegador

```
http://localhost:5000
```

**IMPORTANTE:** Você deve estar logado no sistema principal primeiro!

1. Acesse `http://gestao.comprarecarga.shop` (ou localhost:4000)
2. Faça login normalmente
3. Depois acesse `http://localhost:5000`

O sistema vai validar seu token JWT automaticamente.

## 📁 Estrutura

```
iptv-renewal-service/
├── docker-compose.yml       # Configuração Docker
├── nginx.conf              # Configuração Nginx
├── .env                    # Variáveis de ambiente
└── frontend/               # Frontend estático
    ├── index.html
    ├── js/
    │   ├── config.js       # Configurações
    │   ├── auth.js         # Validação JWT
    │   └── app.js          # App React
    └── css/
        └── styles.css      # Estilos
```

## 🔐 Autenticação

O sistema valida o token JWT do sistema principal:
- Busca o token no `localStorage`
- Valida com a API principal: `GET /api/auth/me`
- Se inválido, redireciona para o login

## 🎯 Funcionalidades Atuais

- ✅ Validação de autenticação compartilhada
- ✅ Listagem de clientes do usuário logado
- ✅ Exibição de dados: nome, WhatsApp, usuário IPTV, plano, vencimento

## 🚧 Próximos Passos

- [ ] Adicionar funcionalidade de renovação manual
- [ ] Integrar com API do painel IPTV
- [ ] Sistema de logs de renovação
- [ ] Renovação automática via webhook

## 🔧 Configuração Futura

Para adicionar a integração com o painel IPTV, edite o `.env`:

```env
IPTV_PANEL_URL=https://seu-painel-iptv.com
IPTV_PANEL_ADMIN_USER=seu_usuario
IPTV_PANEL_ADMIN_PASS=sua_senha
```

## 📊 Logs

```bash
# Ver logs do container
docker logs -f iptv_renewal_frontend

# Entrar no container
docker exec -it iptv_renewal_frontend sh
```

## 🛑 Parar o serviço

```bash
docker-compose down
```

## 🔄 Atualizar

```bash
docker-compose down
docker-compose up -d --build
```

---

**Desenvolvido para integrar com o Sistema de Gestão de Clientes v8**
