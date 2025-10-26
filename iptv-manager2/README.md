# 📺 IPTV Manager - Sistema de Gerenciamento de Painéis IPTV

Sistema completo para gerenciar credenciais e importar clientes de painéis IPTV (CloudNation/Live21) integrado ao Sistema de Gestão de Clientes.

## 🏗️ Arquitetura

### Componentes:
- **Backend Node.js** (Porta 5001) - API REST com Express
- **Frontend React** (Porta 5000) - SPA com Tailwind CSS
- **SQLite Local** - Banco de dados isolado
- **Autenticação JWT** - Compartilhada com sistema principal

## ✨ Funcionalidades

### 1️⃣ Gerenciamento de Credenciais CloudNation
- Cadastrar usuário/senha do painel Live21 (CloudNation)
- Credenciais salvas de forma segura (base64)
- Cada usuário tem suas próprias credenciais

### 2️⃣ Importação Automática de Clientes
- Importa clientes válidos do CloudNation automaticamente
- Resolve CAPTCHA automaticamente (2Captcha)
- Filtra apenas clientes com vencimento >= hoje
- Salva: ID, Nome, Data Criação, Data Vencimento

### 3️⃣ Visualização de Dados
- Lista de clientes importados
- Estatísticas: Total, Ativos, Inativos
- Data da última importação

## 🚀 Instalação

### 1. Pré-requisitos
```bash
# Certifique-se que a rede compartilhada existe
docker network create shared_network

# Obtenha uma API Key do 2Captcha
# Visite: https://2captcha.com/
```

### 2. Configurar Variáveis de Ambiente
```bash
cd iptv-manager
nano .env
```

Edite o arquivo `.env`:
```env
# IMPORTANTE: Configure sua chave do 2Captcha
CAPTCHA_2CAPTCHA_API_KEY=SUA_CHAVE_AQUI

# JWT Secret (mesmo do sistema principal)
JWT_SECRET=seu_jwt_secret_do_sistema_principal

# Demais configurações (deixar como está)
BACKEND_PORT=5001
MAIN_API_URL=https://api.comprarecarga.shop/api
```

### 3. Subir os Containers
```bash
cd iptv-manager
docker-compose up -d --build
```

### 4. Verificar Status
```bash
# Ver logs do backend
docker logs -f iptv_manager_backend

# Ver logs do frontend
docker logs -f iptv_manager_frontend

# Verificar se estão rodando
docker ps | grep iptv_manager
```

## 📖 Como Usar

### 1️⃣ Fazer Login no Sistema Principal
Acesse o sistema principal e faça login:
```
https://comprarecarga.shop
```

### 2️⃣ Acessar o IPTV Manager
Depois de logado, acesse:
```
https://iptv.comprarecarga.shop
```

### 3️⃣ Cadastrar Credenciais do CloudNation
1. Clique no botão **"🔑 Credenciais Live21"** no topo
2. Digite seu usuário e senha do painel CloudNation
3. Clique em **"Salvar"**

### 4️⃣ Importar Clientes
1. Clique no botão **"📥 Carregar Clientes Live21"** no topo
2. Aguarde o processo (pode levar alguns minutos)
3. O sistema irá:
   - Resolver o CAPTCHA automaticamente
   - Fazer login no CloudNation
   - Buscar todos os clientes válidos
   - Salvar no banco de dados local

### 5️⃣ Visualizar Clientes
Após a importação, você verá:
- Total de clientes importados
- Lista completa com nome, data de vencimento, status
- Estatísticas de ativos/inativos

## 📁 Estrutura do Projeto

```
iptv-manager/
├── backend/                    # Backend Node.js
│   ├── src/
│   │   ├── server.js          # Servidor Express
│   │   ├── database.js        # SQLite setup
│   │   ├── controllers/
│   │   │   └── cloudnationController.js
│   │   ├── services/
│   │   │   └── cloudnation.js # Automação CloudNation
│   │   ├── routes/
│   │   │   └── cloudnation.js
│   │   └── middleware/
│   │       └── auth.js        # Validação JWT
│   ├── package.json
│   └── Dockerfile
├── frontend/                   # Frontend React
│   ├── index.html
│   ├── js/
│   │   ├── config.js          # Configurações
│   │   ├── auth.js            # Autenticação
│   │   ├── cloudnation.js     # API CloudNation
│   │   └── app.js             # App principal
│   └── css/
│       └── styles.css
├── docker-compose.yml
├── nginx.conf
├── .env
└── README.md
```

## 🔐 Segurança

- **Autenticação**: JWT compartilhado com sistema principal
- **Credenciais**: Salvas em base64 (encoding simples)
- **Isolamento**: Banco SQLite local, dados não vão para sistema principal
- **API Key**: 2Captcha configurada via ENV (global para todos)

## 🛠️ Endpoints da API

```
POST   /api/cloudnation/credentials      # Salvar credenciais
GET    /api/cloudnation/credentials      # Buscar credenciais
DELETE /api/cloudnation/credentials      # Deletar credenciais
POST   /api/cloudnation/import-clients   # Importar clientes
GET    /api/cloudnation/clients          # Listar clientes
```

## 📊 Banco de Dados (SQLite)

### Tabela: cloudnation_credentials
```sql
id, user_id, username, password, created_at, updated_at
```

### Tabela: cloudnation_clients
```sql
id, user_id, client_id, client_name, 
creation_date, expiration_date, expiration_timestamp,
is_active, imported_at
```

## 🔧 Troubleshooting

### Erro: "API Key do 2Captcha não configurada"
- Edite o arquivo `.env` e adicione sua chave do 2Captcha
- Reinicie o container: `docker-compose restart iptv-manager-backend`

### Erro: "Token inválido ou expirado"
- Faça logout e login novamente no sistema principal
- Limpe o cache do navegador

### Erro ao importar clientes
- Verifique os logs: `docker logs -f iptv_manager_backend`
- Confirme que as credenciais estão corretas
- Verifique se tem saldo no 2Captcha

### Container não inicia
```bash
# Ver logs de erro
docker logs iptv_manager_backend

# Reconstruir container
docker-compose down
docker-compose up -d --build
```

## 📝 Notas Importantes

1. **2Captcha**: É essencial ter uma API key válida e com saldo
2. **Credenciais**: Cada usuário precisa cadastrar suas próprias credenciais
3. **Importação**: Pode levar alguns minutos dependendo da quantidade de clientes
4. **Isolamento**: Os dados ficam no IPTV Manager, não vão para o gestor principal

## 🔄 Atualizar Sistema

```bash
cd iptv-manager
git pull  # se estiver em git
docker-compose down
docker-compose up -d --build
```

## 📞 Suporte

Em caso de problemas, verifique:
1. Logs do backend: `docker logs -f iptv_manager_backend`
2. Logs do frontend: `docker logs -f iptv_manager_frontend`
3. Status dos containers: `docker ps`

---

**Desenvolvido para integrar com o Sistema de Gestão de Clientes v9**
