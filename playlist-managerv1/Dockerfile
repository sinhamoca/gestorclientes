FROM node:18-alpine

# Instalar dependências do sistema para Sharp e ProxyChains
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    vips-dev \
    proxychains-ng \
    curl

# Diretório de trabalho
WORKDIR /app

# Copiar package.json e instalar dependências
COPY package*.json ./
RUN npm install --production

# Copiar código fonte
COPY . .

# Copiar configuração do proxychains para o local correto
# Alpine usa /etc/proxychains/proxychains.conf
RUN mkdir -p /etc/proxychains && \
    cp proxychains4.conf /etc/proxychains/proxychains.conf && \
    cp proxychains4.conf /etc/proxychains4.conf

# Criar diretório para sessões temporárias
RUN mkdir -p /app/temp-sessions && chmod 777 /app/temp-sessions

# Expor porta
EXPOSE 3005

# Variável de ambiente
ENV NODE_ENV=production

# Comando de inicialização
CMD ["node", "src/server.js"]