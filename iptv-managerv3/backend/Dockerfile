FROM node:20-alpine

WORKDIR /app

# Instalar dependências do sistema para better-sqlite3
RUN apk add --no-cache python3 make g++

# Copiar package files
COPY package*.json ./

# Instalar dependências
RUN npm install --omit=dev

# Copiar código fonte
COPY src/ ./src/

# Criar diretório de dados
RUN mkdir -p /app/data

# Expor porta
EXPOSE 5001

# Comando de inicialização com flag para Web APIs
CMD ["node", "--experimental-global-webcrypto", "src/server.js"]
