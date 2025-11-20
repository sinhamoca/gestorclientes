FROM node:20-alpine

WORKDIR /app

# Instalar dependências do sistema para better-sqlite3
RUN apk add --no-cache python3 make g++

# ============================================
# INSTALAR DEPENDÊNCIAS PARA CLOUDFLARE BYPASS
# ============================================

# Instalar curl, wget, ca-certificates e proxychains (ALPINE)
RUN apk add --no-cache \
    curl \
    wget \
    ca-certificates \
    proxychains-ng \
    bash \
    gcompat

# Corrigir proxychains (remover links circulares)
RUN echo "=== Procurando libproxychains ===" && \
    find /usr -name "*proxychains*.so*" && \
    rm -f /usr/bin/proxychains /usr/bin/proxychains4 && \
    echo '#!/bin/sh' > /usr/bin/proxychains4 && \
    echo 'export LD_PRELOAD=/usr/lib/libproxychains4.so' >> /usr/bin/proxychains4 && \
    echo '[ "$1" = "-q" ] && export PROXYCHAINS_QUIET_MODE=1 && shift' >> /usr/bin/proxychains4 && \
    echo 'export PROXYCHAINS_CONF_FILE=/etc/proxychains/proxychains.conf' >> /usr/bin/proxychains4 && \
    echo 'exec "$@"' >> /usr/bin/proxychains4 && \
    chmod +x /usr/bin/proxychains4 && \
    ln -sf /usr/bin/proxychains4 /usr/bin/proxychains && \
    echo "✅ Proxychains wrapper criado"

# Instalar curl-impersonate
# Usar fork lexiforest que tem suporte musl (Alpine)
RUN cd /tmp && \
    wget https://github.com/lexiforest/curl-impersonate/releases/download/v1.2.2/curl-impersonate-v1.2.2.x86_64-linux-musl.tar.gz && \
    tar -xzf curl-impersonate-v1.2.2.x86_64-linux-musl.tar.gz && \
    cp curl-impersonate /usr/local/bin/ && \
    cp curl_* /usr/local/bin/ && \
    chmod +x /usr/local/bin/curl* && \
    /usr/local/bin/curl-impersonate --version && \
    cd / && rm -rf /tmp/* && \
    echo "✅ curl-impersonate instalado"

# Criar wrapper que força uso do proxy via ALL_PROXY
RUN echo '#!/bin/sh' > /usr/local/bin/curl-with-proxy && \
    echo '# Wrapper que força uso do proxy SOCKS5' >> /usr/local/bin/curl-with-proxy && \
    echo 'PROXIES="socks5://r_28f81eb282-country-br-region-ceara-isp-vivo:0e79cc45d3@148.113.216.26:5000' >> /usr/local/bin/curl-with-proxy && \
    echo 'socks5://r_28f81eb282-country-br-region-ceara-isp-vivo:0e79cc45d3@15.235.35.31:5000' >> /usr/local/bin/curl-with-proxy && \
    echo 'socks5://r_28f81eb282-country-br-region-ceara-isp-vivo:0e79cc45d3@15.235.32.63:5000' >> /usr/local/bin/curl-with-proxy && \
    echo 'socks5://r_28f81eb282-country-br-region-ceara-isp-vivo:0e79cc45d3@148.113.216.37:5000"' >> /usr/local/bin/curl-with-proxy && \
    echo 'PROXY=$(echo "$PROXIES" | shuf -n 1)' >> /usr/local/bin/curl-with-proxy && \
    echo 'export ALL_PROXY="$PROXY"' >> /usr/local/bin/curl-with-proxy && \
    echo 'exec /usr/local/bin/curl_chrome120 "$@"' >> /usr/local/bin/curl-with-proxy && \
    chmod +x /usr/local/bin/curl-with-proxy && \
    echo "✅ Wrapper curl-with-proxy criado"

# Copiar configuração do proxychains
COPY proxychains.conf /etc/proxychains/proxychains.conf

# Verificar instalações (debug)
RUN echo "=== VERIFICANDO INSTALAÇÕES ===" && \
    which proxychains4 && echo "✅ proxychains4 encontrado" || echo "❌ proxychains4 não encontrado" && \
    which curl-impersonate-chrome && echo "✅ curl-impersonate-chrome encontrado" || echo "❌ curl-impersonate-chrome não encontrado" && \
    ls -la /etc/proxychains/proxychains.conf && echo "✅ proxychains.conf existe" || echo "❌ proxychains.conf não existe" && \
    proxychains4 echo "teste" && echo "✅ proxychains4 funcional" || echo "❌ proxychains4 não funcional"

# ============================================
# RESTO DO DOCKERFILE (sem mudanças)
# ============================================

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