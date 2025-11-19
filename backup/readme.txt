# 📦 Sistema de Backup Automático PostgreSQL

Backup e restauração automática do banco de dados com PM2.

---

## 🚀 Instalação

```bash
# 1. Extrair arquivos
tar -xzf backup-system-v2.tar.gz

# 2. Executar instalador
chmod +x install.sh
./install.sh

# 3. Iniciar sistema
cd /root/backup-system
npm run pm2:start
```

---

## 📋 Uso Diário

### **Ver status do backup**
```bash
pm2 list
```

### **Ver logs em tempo real**
```bash
cd /root/backup-system
npm run pm2:logs
```

### **Restaurar um backup**
```bash
cd /root/backup-system
./restore.sh
```
- Escolha o backup desejado
- Digite **SIM** para confirmar
- Pronto! Dados restaurados

---

## ⚙️ Configurações

Edite `/root/backup-system/.env` para ajustar:

```bash
POSTGRES_CONTAINER=gestao_db          # Nome do container
DB_USER=gestao_user                   # Usuário do banco
DB_NAME=gestao_clientes               # Nome do banco
BACKUP_MAX_DAYS=7                     # Manter backups por 7 dias
BACKUP_INTERVAL_HOURS=12              # Backup a cada 12 horas
```

---

## 🎯 Comandos Úteis

```bash
# Iniciar backups
npm run pm2:start

# Parar backups
npm run pm2:stop

# Reiniciar
npm run pm2:restart

# Ver logs
npm run pm2:logs

# Listar backups criados
ls -lht backups/

# Testar sistema
./test-backup.sh
```

---

## 📂 Onde ficam os backups?

```
/root/backup-system/backups/
```

---

## 🔄 O que o sistema faz automaticamente?

✅ Backup a cada 12 horas  
✅ Remove backups com mais de 7 dias  
✅ Roda em background (PM2)  
✅ Reinicia automaticamente se cair  

---

## 🛡️ Restauração Segura

Ao restaurar, o sistema:

1. Cria backup de segurança do estado atual
2. Desconecta usuários do banco
3. Limpa o banco de dados
4. Restaura o backup selecionado
5. Mostra quantos registros foram restaurados

---

## 📊 O que está no backup?

**TUDO do banco `gestao_clientes`:**

✅ Usuários (todos)  
✅ Clientes (de todos os usuários)  
✅ Planos  
✅ Servidores  
✅ Configurações de pagamento  
✅ Templates de mensagem  
✅ Histórico de transações  
✅ Lembretes  
✅ Códigos UniTV  
✅ Logs de auditoria  

---

## ⚠️ Importante

- Backups são comprimidos (.gz) para economizar espaço
- Sistema cria backup de segurança antes de restaurar
- Confirmação obrigatória para restauração (digite SIM)

---

## 🔍 Solução de Problemas

**Container não encontrado:**
```bash
docker ps  # Ver nome correto
nano .env  # Atualizar POSTGRES_CONTAINER
```

**Backups não sendo criados:**
```bash
pm2 logs backup-postgres  # Ver erros
./test-backup.sh          # Testar manualmente
```

---

## 📞 Suporte

Ver logs: `pm2 logs backup-postgres`  
Testar: `./test-backup.sh`  
Verificar: `docker ps | grep gestao_db`

---

**Pronto!** Sistema configurado e rodando. Backups automáticos a cada 12 horas. 🎉
