# 🔑 CORRIGIR JWT_SECRET - Token Inválido 403

## ❌ PROBLEMA:
```
403 Forbidden - Token inválido ou expirado
```

Isso acontece porque o `JWT_SECRET` do IPTV Manager está diferente do sistema principal.

---

## ✅ SOLUÇÃO:

### 1️⃣ Pegar o JWT_SECRET do Sistema Principal

```bash
# Entre na pasta do gestor de clientes
cd ~/gestao-clientesv9

# Veja o JWT_SECRET
cat .env | grep JWT_SECRET

# Ou veja direto:
grep JWT_SECRET .env
```

**Copie o valor completo!**

---

### 2️⃣ Atualizar no IPTV Manager

```bash
# Entre na pasta do IPTV Manager
cd ~/iptv-manager

# Edite o .env
nano .env
```

**Cole o MESMO valor do JWT_SECRET:**

```env
# IMPORTANTE: Deve ser EXATAMENTE o mesmo do sistema principal!
JWT_SECRET=cole_aqui_o_valor_exato_do_sistema_principal

# Exemplo (NÃO use este, use o seu!):
JWT_SECRET=abc123xyz789seu-secret-real
```

Salve: `Ctrl+O` → `Enter` → `Ctrl+X`

---

### 3️⃣ Reiniciar o Backend

```bash
# Reiniciar apenas o backend
docker-compose restart iptv-manager-backend

# Ou para garantir:
docker-compose down
docker-compose up -d
```

---

### 4️⃣ Verificar se Funcionou

```bash
# Ver logs do backend
docker logs iptv_manager_backend

# Deve aparecer:
# 🔑 JWT Secret: ✅ Configurado
```

---

### 5️⃣ Testar no Navegador

1. Limpe o cache do navegador ou abra aba anônima
2. Faça login no sistema principal: `https://comprarecarga.shop`
3. Acesse: `https://iptv.comprarecarga.shop`
4. Tente salvar credenciais → **Deve funcionar!** ✅

---

## 🔍 VERIFICAÇÃO COMPLETA:

### Método 1: Via comando
```bash
# Sistema Principal
cd ~/gestao-clientesv9
echo "Sistema Principal:"
grep JWT_SECRET .env

# IPTV Manager
cd ~/iptv-manager
echo ""
echo "IPTV Manager:"
grep JWT_SECRET .env

# Os dois devem ser IDÊNTICOS!
```

### Método 2: Ver as variáveis nos containers
```bash
# Ver JWT_SECRET do sistema principal
docker exec gestao_admin_backend printenv JWT_SECRET

# Ver JWT_SECRET do IPTV Manager
docker exec iptv_manager_backend printenv JWT_SECRET

# Devem ser iguais!
```

---

## 🐛 SE AINDA DER ERRO:

### 1. Verificar se o token está chegando:
Abra DevTools (F12) → Console → Digite:
```javascript
console.log(localStorage.getItem('user_token'));
```

Se aparecer o token, está OK. Se não, faça login novamente.

### 2. Verificar logs do backend:
```bash
docker logs -f iptv_manager_backend
```

Procure por:
```
❌ [AUTH] Token inválido: ...
```

### 3. Token corrompido:
```javascript
// No Console do navegador (F12)
localStorage.removeItem('user_token');
localStorage.removeItem('user_data');
// Depois faça login novamente
```

---

## ✅ CHECKLIST:

- [ ] JWT_SECRET do sistema principal copiado
- [ ] JWT_SECRET colado no .env do IPTV Manager
- [ ] Backend do IPTV Manager reiniciado
- [ ] Logs mostram "JWT Secret: ✅ Configurado"
- [ ] Consegue salvar credenciais sem erro 403

---

## 📝 DICA:

Se você não sabe o JWT_SECRET ou perdeu, pode:

1. Gerar um novo:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

2. Colocar o MESMO nos dois .env:
   - `gestao-clientesv9/.env`
   - `iptv-manager/.env`

3. Reiniciar AMBOS os backends:
```bash
# Sistema principal
cd ~/gestao-clientesv9
docker-compose restart gestao-admin-backend

# IPTV Manager
cd ~/iptv-manager
docker-compose restart iptv-manager-backend
```

4. Fazer login novamente (token antigo ficará inválido)
