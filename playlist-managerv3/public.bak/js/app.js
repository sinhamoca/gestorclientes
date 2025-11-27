// ========== CONFIGURAÇÃO ==========
const API_BASE = window.location.origin;
let currentPlayer = null;
let currentClient = null;
let currentSession = null;

// ========== INICIALIZAÇÃO ==========
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
});

// ========== AUTENTICAÇÃO ==========
// ========== AUTENTICAÇÃO (Modelo IPTV-Manager) ==========

async function checkAuth() {
    // 1. Verificar se tem token na URL (vindo do gestao-clientes)
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    
    if (tokenFromUrl) {
        console.log('✅ Token recebido da URL');
        // Salvar no localStorage
        localStorage.setItem('token', tokenFromUrl);
        // Limpar URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // 2. Tentar pegar token do localStorage
    const token = localStorage.getItem('user_token') || localStorage.getItem('token');
    
    if (!token) {
        console.log('❌ Token não encontrado');
        showMessage('Você precisa fazer login no sistema principal primeiro', 'error');
        setTimeout(() => {
            // Redirecionar para a página de login do gestao-clientes
            window.location.href = 'https://comprarecarga.shop';
        }, 2000);
        return;
    }
    
    console.log('✅ Token encontrado no localStorage');
    
    // 3. Validar token com o backend
    try {
        const response = await fetch(`${API_BASE}/api/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const userData = await response.json();
            console.log('✅ Token válido, usuário:', userData);
            // Salvar dados do usuário
            localStorage.setItem('user', JSON.stringify(userData));
            // Mostrar info do usuário
            document.getElementById('user-info').textContent = `Olá, ${userData.name || userData.email}`;
            // Carregar clientes
            loadClients();
        } else {
            console.log('❌ Token inválido');
            // Token inválido, limpar e redirecionar
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            showMessage('Sessão expirada. Faça login novamente.', 'error');
            setTimeout(() => {
                window.location.href = 'https://comprarecarga.shop';
            }, 2000);
        }
    } catch (error) {
        console.error('❌ Erro ao validar token:', error);
        showMessage('Erro ao validar autenticação', 'error');
    }
}

function getAuthToken() {
    return localStorage.getItem('token');
}

// ========== UTILITÁRIOS ==========
function showMessage(text, type = 'info') {
    const container = document.getElementById('message-container');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.innerHTML = `
        <span>${text}</span>
        <button onclick="this.parentElement.remove()">×</button>
    `;
    container.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 5000);
}

function showLoading(show = true) {
    const loading = document.getElementById('loading');
    if (show) {
        loading.classList.remove('hidden');
    } else {
        loading.classList.add('hidden');
    }
}

function showPlaylistLoading(show = true, text = 'Carregando...') {
    const loading = document.getElementById('playlist-loading');
    const loadingText = document.getElementById('playlist-loading-text');
    loadingText.textContent = text;
    
    if (show) {
        loading.classList.remove('hidden');
    } else {
        loading.classList.add('hidden');
    }
}

async function apiRequest(endpoint, options = {}) {
    const token = getAuthToken();
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };
    
    const finalOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers
        }
    };
    
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, finalOptions);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || data.message || 'Erro na requisição');
        }
        
        return data;
    } catch (error) {
        console.error('Erro na requisição:', error);
        throw error;
    }
}

// ========== CLIENTES ==========
async function loadClients() {
    showLoading(true);
    
    try {
        const data = await apiRequest('/api/clients');
        displayClients(data.clients);
    } catch (error) {
        showMessage('Erro ao carregar clientes: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function displayClients(clients) {
    const tbody = document.getElementById('clients-tbody');
    
    if (!clients || clients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">Nenhum cliente encontrado</td></tr>';
        return;
    }
    
    tbody.innerHTML = clients.map(client => `
        <tr>
            <td>${client.name}</td>
            <td>${client.mac_address || '-'}</td>
            <td>${client.device_key || '-'}</td>
            <td>
                <button class="btn btn-primary btn-small" onclick="connectPlayer('iboplayer', ${client.id}, '${client.name}', '${client.mac_address}', '${client.device_key}')">
                    IBOPlayer
                </button>
                <button class="btn btn-primary btn-small" onclick="connectPlayer('ibopro', ${client.id}, '${client.name}', '${client.mac_address}', '${client.device_key}')">
                    IBOPro
                </button>
                <button class="btn btn-primary btn-small" onclick="connectPlayer('vuplayer', ${client.id}, '${client.name}', '${client.mac_address}', '${client.device_key}')">
                    VU Player
                </button>
            </td>
        </tr>
    `).join('');
}

// ========== MODAL DE DOMÍNIO ==========
function connectPlayer(player, clientId, clientName, macAddress, deviceKey) {
    currentPlayer = player;
    currentClient = {
        id: clientId,
        name: clientName,
        mac_address: macAddress,
        device_key: deviceKey
    };
    
    if (player === 'iboplayer') {
        // Mostrar modal para selecionar domínio
        document.getElementById('domain-modal').classList.remove('hidden');
    } else {
        // Login direto para IBOPro e VUPlayer
        doLogin(player, macAddress, deviceKey);
    }
}

function selectDomain(domain) {
    closeDomainModal();
    doLogin('iboplayer', currentClient.mac_address, currentClient.device_key, domain);
}

function closeDomainModal() {
    document.getElementById('domain-modal').classList.add('hidden');
}

// ========== LOGIN NOS PLAYERS ==========
async function doLogin(player, macAddress, deviceKey, domain = null) {
    openPlaylistModal(player);
    showPlaylistLoading(true, 'Fazendo login... Isso pode levar até 60 segundos.');
    
    try {
        let endpoint = '';
        let body = {};
        
        if (player === 'iboplayer') {
            endpoint = '/api/players/iboplayer/login';
            body = {
                mac_address: macAddress,
                device_key: deviceKey,
                domain: domain
            };
        } else if (player === 'ibopro') {
            endpoint = '/api/players/ibopro/login';
            body = {
                mac_address: macAddress,
                password: deviceKey // device_key é usado como password
            };
        } else if (player === 'vuplayer') {
            endpoint = '/api/players/vuplayer/login';
            body = {
                mac_address: macAddress,
                device_key: deviceKey
            };
        }
        
        const response = await apiRequest(endpoint, {
            method: 'POST',
            body: JSON.stringify(body)
        });
        
        if (response.success) {
            currentSession = response.session;
            sessionStorage.setItem(`${player}_session`, JSON.stringify(response.session));
            showMessage('Login realizado com sucesso!', 'success');
            showPlaylistLoading(true, 'Carregando playlists...');
            await loadPlaylists();
        } else {
            throw new Error(response.error || 'Erro no login');
        }
    } catch (error) {
        showMessage('Erro no login: ' + error.message, 'error');
        closePlaylistModal();
    } finally {
        showPlaylistLoading(false);
    }
}

// ========== MODAL DE PLAYLISTS ==========
function openPlaylistModal(player) {
    const modal = document.getElementById('playlist-modal');
    const title = document.getElementById('playlist-modal-title');
    const content = document.getElementById('playlist-content');
    
    const playerNames = {
        'iboplayer': 'IBOPlayer',
        'ibopro': 'IBOPro',
        'vuplayer': 'VU Player'
    };
    
    title.textContent = `${playerNames[player]} - ${currentClient.name}`;
    content.classList.add('hidden');
    modal.classList.remove('hidden');
}

function closePlaylistModal() {
    document.getElementById('playlist-modal').classList.add('hidden');
    currentPlayer = null;
    currentSession = null;
    resetForm();
}

// ========== PLAYLISTS ==========
async function loadPlaylists() {
    try {
        let endpoint = '';
        
        if (currentPlayer === 'iboplayer') {
            endpoint = '/api/players/iboplayer/playlists/list';
        } else if (currentPlayer === 'ibopro') {
            endpoint = '/api/players/ibopro/playlists/list';
        } else if (currentPlayer === 'vuplayer') {
            endpoint = '/api/players/vuplayer/playlists/list';
        }
        
        const response = await apiRequest(endpoint, {
            method: 'POST',
            body: JSON.stringify({ session: currentSession })
        });
        
        if (response.success) {
            displayPlaylists(response.playlists);
            document.getElementById('playlist-content').classList.remove('hidden');
        } else {
            throw new Error(response.error || 'Erro ao listar playlists');
        }
    } catch (error) {
        showMessage('Erro ao carregar playlists: ' + error.message, 'error');
    }
}

function displayPlaylists(playlists) {
    const tbody = document.getElementById('playlists-tbody');
    
    if (!playlists || playlists.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">Nenhuma playlist cadastrada</td></tr>';
        return;
    }
    
    // Adaptar estrutura de dados dos diferentes players
    tbody.innerHTML = playlists.map(playlist => {
        const id = playlist._id || playlist.id || playlist.playlist_id;
        const name = playlist.playlist_name || playlist.name;
        const url = playlist.playlist_url || playlist.url;
        const type = playlist.playlist_type || playlist.type || 'general';
        
        return `
            <tr>
                <td>${name}</td>
                <td><small>${url.substring(0, 50)}...</small></td>
                <td>${type}</td>
                <td>
                    <button class="btn btn-success btn-small" onclick='editPlaylistBtn(${JSON.stringify({id, name, url, type})})'>
                        Editar
                    </button>
                    <button class="btn btn-danger btn-small" onclick="deletePlaylist('${id}')">
                        Deletar
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// ========== FORMULÁRIO DE PLAYLIST ==========
function setupEventListeners() {
    // Checkbox de proteção
    document.getElementById('playlist-protect').addEventListener('change', function() {
        const pinGroup = document.getElementById('pin-group');
        if (this.checked) {
            pinGroup.classList.remove('hidden');
        } else {
            pinGroup.classList.add('hidden');
            document.getElementById('playlist-pin').value = '';
        }
    });
    
    // Submit do formulário
    document.getElementById('playlist-form').addEventListener('submit', handleFormSubmit);
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    const playlistId = document.getElementById('playlist-id').value;
    const name = document.getElementById('playlist-name').value;
    const url = document.getElementById('playlist-url').value;
    const type = document.getElementById('playlist-type').value;
    const protect = document.getElementById('playlist-protect').checked;
    const pin = document.getElementById('playlist-pin').value;
    
    const data = {
        name,
        url,
        type,
        protect,
        pin: protect ? pin : '',
        session: currentSession
    };
    
    showPlaylistLoading(true, playlistId ? 'Editando playlist...' : 'Adicionando playlist...');
    
    try {
        let endpoint = '';
        let method = 'POST';
        
        if (playlistId) {
            // Editar
            if (currentPlayer === 'iboplayer') {
                endpoint = `/api/players/iboplayer/playlists/${playlistId}`;
                method = 'PUT';
            } else if (currentPlayer === 'ibopro') {
                endpoint = `/api/players/ibopro/playlists/${playlistId}`;
                method = 'PUT';
            } else if (currentPlayer === 'vuplayer') {
                endpoint = `/api/players/vuplayer/playlists/${playlistId}`;
                method = 'PUT';
            }
        } else {
            // Adicionar
            if (currentPlayer === 'iboplayer') {
                endpoint = '/api/players/iboplayer/playlists';
            } else if (currentPlayer === 'ibopro') {
                endpoint = '/api/players/ibopro/playlists';
            } else if (currentPlayer === 'vuplayer') {
                endpoint = '/api/players/vuplayer/playlists';
            }
        }
        
        const response = await apiRequest(endpoint, {
            method: method,
            body: JSON.stringify(data)
        });
        
        if (response.success) {
            showMessage(playlistId ? 'Playlist editada com sucesso!' : 'Playlist adicionada com sucesso!', 'success');
            resetForm();
            await loadPlaylists();
        } else {
            throw new Error(response.error || 'Erro na operação');
        }
    } catch (error) {
        showMessage('Erro: ' + error.message, 'error');
    } finally {
        showPlaylistLoading(false);
    }
}

function editPlaylistBtn(playlist) {
    document.getElementById('form-title').textContent = 'Editar Playlist';
    document.getElementById('form-submit-btn').textContent = 'Salvar';
    document.getElementById('playlist-id').value = playlist.id;
    document.getElementById('playlist-name').value = playlist.name;
    document.getElementById('playlist-url').value = playlist.url;
    document.getElementById('playlist-type').value = playlist.type || 'general';
    
    // Scroll para o formulário
    document.querySelector('.playlist-form').scrollIntoView({ behavior: 'smooth' });
}

function resetForm() {
    document.getElementById('form-title').textContent = 'Adicionar Nova Playlist';
    document.getElementById('form-submit-btn').textContent = 'Adicionar';
    document.getElementById('playlist-form').reset();
    document.getElementById('playlist-id').value = '';
    document.getElementById('pin-group').classList.add('hidden');
}

async function deletePlaylist(playlistId) {
    if (!confirm('Tem certeza que deseja deletar esta playlist?')) {
        return;
    }
    
    showPlaylistLoading(true, 'Deletando playlist...');
    
    try {
        let endpoint = '';
        
        if (currentPlayer === 'iboplayer') {
            endpoint = `/api/players/iboplayer/playlists/${playlistId}`;
        } else if (currentPlayer === 'ibopro') {
            endpoint = `/api/players/ibopro/playlists/${playlistId}`;
        } else if (currentPlayer === 'vuplayer') {
            endpoint = `/api/players/vuplayer/playlists/${playlistId}`;
        }
        
        const response = await apiRequest(endpoint, {
            method: 'DELETE',
            body: JSON.stringify({ session: currentSession })
        });
        
        if (response.success) {
            showMessage('Playlist deletada com sucesso!', 'success');
            await loadPlaylists();
        } else {
            throw new Error(response.error || 'Erro ao deletar');
        }
    } catch (error) {
        showMessage('Erro ao deletar: ' + error.message, 'error');
    } finally {
        showPlaylistLoading(false);
    }
}
