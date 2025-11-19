# 📦 Sistema de Backup Automático PostgreSQL

Sistema completo de backup e restauração para PostgreSQL com PM2.

---

## 📋 Características

✅ **Backup Automático:**
- Executa a cada 12 horas (configurável)
- Mantém apenas backups dos últimos 7 dias
- Roda em background via PM2
- Logs detalhados de todas as operações

✅ **Restauração Interativa:**
- Menu colorido e intuitivo
- Lista todos os backups disponíveis com data/hora
- Backup de segurança antes de restaurar
- Confirmação obrigatória antes de sobrescrever dados

---

## 🚀 Instalação

### 1. Criar diretório do sistema

```bash
mkdir -p /root/backup-system
cd /root/backup-system
```

### 2. Copiar os arquivos

Copie todos os arquivos criados para `/root/backup-system/`:

- `backup-manager.js`
- `restore.sh`
- `package.json`
- `.env`

### 3. Instalar dependências

```bash
npm install
```

### 4. Dar permissão de execução

```bash
chmod +x backup-manager.js
chmod +x restore.sh
```

### 5. Configurar variáveis (se necessário)

Edite o arquivo `.env` para ajustar as configurações:

```bash
nano .env
```

---

## 🎯 Uso

### **Backup Automático (PM2)**

#### Iniciar sistema de backup:
```bash
npm run pm2:start
```

#### Ver logs em tempo real:
```bash
npm run pm2:logs
```

#### Parar backups:
```bash
npm run pm2:stop
```

#### Reiniciar sistema:
```bash
npm run pm2:restart
```

#### Remover do PM2:
```bash
npm run pm2:delete
```

---

### **Restauração Manual**

Para restaurar um backup:

```bash
./restore.sh
```

O script irá:

1. ✅ Verificar se o container PostgreSQL está rodando
2. 📋 Listar todos os backups disponíveis (do mais recente ao mais antigo)
3. 🔍 Mostrar data, hora e tamanho de cada backup
4. ⚠️  Solicitar confirmação (digite **SIM**)
5. 📦 Criar backup de segurança do estado atual
6. 🔄 Restaurar o backup selecionado

---

## 📂 Estrutura de Diretórios

```
/root/backup-system/
├── backup-manager.js        # Script de backup automático
├── restore.sh               # Script de restauração
├── package.json             # Configuração npm
├── .env                     # Variáveis de ambiente
├── backups/                 # Backups criados
│   ├── backup_2025-01-18T14-30-00.sql.gz
│   ├── backup_2025-01-18T02-30-00.sql.gz
│   └── safety_backup_2025-01-18_15-00-00.sql.gz
└── logs/
    ├── backup.log          # Logs do sistema automático
    └── restore.log         # Logs das restaurações
```

---

## ⚙️ Configurações Disponíveis

Edite `.env` para customizar:

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `POSTGRES_CONTAINER` | `gestao_db` | Nome do container PostgreSQL |
| `DB_USER` | `gestao_user` | Usuário do banco |
| `DB_NAME` | `gestao_clientes` | Nome do banco |
| `BACKUP_MAX_DAYS` | `7` | Dias de retenção dos backups |
| `BACKUP_INTERVAL_HOURS` | `12` | Horas entre cada backup |

---

## 📊 Exemplos de Uso

### Ver status do sistema de backup:
```bash
pm2 list
```

Saída:
```
┌─────┬────────────────────┬─────────┬─────────┬──────────┐
│ id  │ name               │ status  │ restart │ uptime   │
├─────┼────────────────────┼─────────┼─────────┼──────────┤
│ 0   │ backup-postgres    │ online  │ 0       │ 2h       │
└─────┴────────────────────┴─────────┴─────────┴──────────┘
```

### Ver últimos logs:
```bash
pm2 logs backup-postgres --lines 50
```

### Monitorar em tempo real:
```bash
pm2 monit
```

---

## 🔍 Troubleshooting

### Container não encontrado:
```bash
# Verificar nome correto do container
docker ps

# Atualizar .env com o nome correto
nano .env
```

### Permissões negadas:
```bash
# Dar permissões corretas
chmod +x backup-manager.js restore.sh
```

### Backups não estão sendo criados:
```bash
# Verificar logs
pm2 logs backup-postgres

# Verificar se o container está acessível
docker exec gestao_db pg_dump --version
```

---

## 🛡️ Segurança

- ✅ Backups são comprimidos com gzip (economia de espaço)
- ✅ Backup de segurança automático antes de restaurar
- ✅ Confirmação obrigatória para restauração
- ✅ Logs detalhados de todas as operações
- ✅ Limpeza automática de backups antigos

---

## 📝 Logs

### Backup automático:
```bash
tail -f /root/backup-system/logs/backup.log
```

### Restaurações:
```bash
tail -f /root/backup-system/logs/restore.log
```

---

## 🔄 Automatizar no boot do sistema

Para garantir que o sistema de backup inicie automaticamente:

```bash
# Salvar lista do PM2
pm2 save

# Configurar startup
pm2 startup

# Execute o comando que o PM2 retornar
```

---

## 📞 Suporte

Em caso de problemas:

1. Verifique os logs: `pm2 logs backup-postgres`
2. Verifique o container: `docker ps | grep gestao_db`
3. Teste manualmente: `./restore.sh`

---

## 🎉 Pronto!

Seu sistema de backup está configurado e pronto para uso!

- **Backups automáticos a cada 12 horas**
- **Retenção de 7 dias**
- **Restauração fácil e segura**
