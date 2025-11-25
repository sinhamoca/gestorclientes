// ========== CONFIGURAÇÃO ==========
const API_BASE = window.location.origin;
let currentPlayer = null;
let currentClient = null;
let currentSession = null;

// ========== ESTADO DE SELEÇÃO ==========
let allClients = [];
let filteredClients = [];
let selectedClients = new Set();
let servers = [];

// ========== ESTADO PARA MUDAR DNS ==========
let dnsChangeMode = null; // 'all', 'first', 'detect'
let dnsPlaylists = [];    // Playlists carregadas para mudança de DNS

// ========== INICIALIZAÇÃO ==========
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
    setupSelectionListeners();
});

// ========== AUTENTICAÇÃO ==========
async function checkAuth() {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    
    if (tokenFromUrl) {
        console.log('✅ Token recebido da URL');
        localStorage.setItem('token', tokenFromUrl);
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    const token = localStorage.getItem('user_token') || localStorage.getItem('token');
    
    if (!token) {
        console.log('❌ Token não encontrado');
        showMessage('Você precisa fazer login no sistema principal primeiro', 'error');
        setTimeout(() => {
            window.location.href = 'https://comprarecarga.shop';
        }, 2000);
        return;
    }
    
    console.log('✅ Token encontrado no localStorage');
    
    try {
        const response = await fetch(`${API_BASE}/api/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const userData = await response.json();
            console.log('✅ Token válido, usuário:', userData);
            localStorage.setItem('user', JSON.stringify(userData));
            document.getElementById('user-info').textContent = `Olá, ${userData.name || userData.email}`;
            
            await loadServers();
            await loadClients();
        } else {
            console.log('❌ Token inválido');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            showMessage('Sessão expirada. Faça login novamente.', 'error');
            setTimeout(() => {
                window.location.href = 'https://comprarecarga.shop';
            }, 2000);
        }
    } catch (error) {
        console.error('Erro ao validar token:', error);
        showMessage('Erro de conexão. Tente novamente.', 'error');
    }
}

// ========== HELPERS ==========
function showLoading(show) {
    document.getElementById('loading').classList.toggle('hidden', !show);
}

function showMessage(text, type = 'success') {
    const container = document.getElementById('message-container');
    const id = Date.now();
    
    container.innerHTML = `
        <div class="message ${type}" id="msg-${id}">
            <span>${text}</span>
            <button onclick="this.parentElement.remove()">&times;</button>
        </div>
    `;
    
    setTimeout(() => {
        const msg = document.getElementById(`msg-${id}`);
        if (msg) msg.remove();
    }, 5000);
}

async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('user_token') || localStorage.getItem('token');
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };
    
    const finalOptions = {
        ...defaultOptions,
        ...options,
        headers: { ...defaultOptions.headers, ...options.headers }
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

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
}

// ========== SERVIDORES ==========
async function loadServers() {
    try {
        const data = await apiRequest('/api/clients/servers');
        servers = data.servers || [];
        populateServerFilter();
    } catch (error) {
        console.error('Erro ao carregar servidores:', error);
    }
}

function populateServerFilter() {
    const select = document.getElementById('server-filter');
    select.innerHTML = '<option value="">Todos os servidores</option>';
    
    servers.forEach(server => {
        const option = document.createElement('option');
        option.value = server.id;
        option.textContent = server.name;
        select.appendChild(option);
    });
}

// ========== CLIENTES ==========
async function loadClients() {
    showLoading(true);
    
    try {
        const data = await apiRequest('/api/clients');
        allClients = data.clients || [];
        filteredClients = [...allClients];
        displayClients(filteredClients);
    } catch (error) {
        showMessage('Erro ao carregar clientes: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function displayClients(clients) {
    const tbody = document.getElementById('clients-tbody');
    
    if (!clients || clients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhum cliente encontrado</td></tr>';
        updateSelectionCount();
        return;
    }
    
    tbody.innerHTML = clients.map(client => {
        const isSelected = selectedClients.has(client.id);
        const serverName = client.server_name || 'Sem servidor';
        const macAddress = client.mac_address || '';
        const deviceKey = client.device_key || '';
        const playerType = client.player_type || '';
        const playerDomain = client.player_domain || '';
        
        const actionButtons = generateActionButtons(client, macAddress, deviceKey, playerType, playerDomain);
        
        return `
            <tr class="${isSelected ? 'selected' : ''}" data-client-id="${client.id}" data-server-id="${client.server_id || ''}">
                <td class="checkbox-col">
                    <input type="checkbox" 
                           class="client-checkbox" 
                           data-client-id="${client.id}"
                           ${isSelected ? 'checked' : ''}
                           onchange="toggleClientSelection(${client.id})">
                </td>
                <td>${escapeHtml(client.name)}</td>
                <td><span class="server-badge">${escapeHtml(serverName)}</span></td>
                <td>${macAddress || '-'}</td>
                <td>${deviceKey || '-'}</td>
                <td>${actionButtons}</td>
            </tr>
        `;
    }).join('');
    
    updateSelectionCount();
}

// Gera os botões de ação baseado no player_type configurado
function generateActionButtons(client, macAddress, deviceKey, playerType, playerDomain) {
    const escapedName = escapeHtml(client.name);
    const escapedMac = escapeHtml(macAddress);
    const escapedKey = escapeHtml(deviceKey);
    
    // PRIMEIRO: Verificar se tem credenciais (MAC ou Device Key)
    // Sem credenciais, não tem como fazer login em nenhum player
    if (!macAddress && !deviceKey) {
        return `<span class="config-warning" title="Preencha MAC Address ou Device Key no cadastro do cliente">⚠️ Sem credenciais</span>`;
    }
    
    // SEGUNDO: Verificar se tem player_type configurado
    if (!playerType) {
        return `<span class="config-warning" title="Configure o tipo de aplicativo (IBOPlayer, IBOPro ou VUPlayer) no cadastro do cliente">⚠️ Configurar App</span>`;
    }
    
    // TERCEIRO: Verificações específicas por player
    if (playerType === 'iboplayer') {
        if (!playerDomain) {
            return `<span class="config-warning" title="Configure o domínio do IBOPlayer no cadastro">⚠️ Sem domínio</span>`;
        }
        return `
            <button class="btn btn-primary btn-small" onclick="connectPlayerDirect('iboplayer', ${client.id}, '${escapedName}', '${escapedMac}', '${escapedKey}', '${escapeHtml(playerDomain)}')">
                🔵 Playlists
            </button>
            <button class="btn btn-warning btn-small" onclick="openDnsModal('iboplayer', ${client.id}, '${escapedName}', '${escapedMac}', '${escapedKey}', '${escapeHtml(playerDomain)}')">
                🔄 DNS
            </button>
        `;
    } else if (playerType === 'ibopro') {
        return `
            <button class="btn btn-secondary btn-small" onclick="connectPlayer('ibopro', ${client.id}, '${escapedName}', '${escapedMac}', '${escapedKey}')">
                🟣 Playlists
            </button>
            <button class="btn btn-warning btn-small" onclick="openDnsModalDirect('ibopro', ${client.id}, '${escapedName}', '${escapedMac}', '${escapedKey}')">
                🔄 DNS
            </button>
        `;
    } else if (playerType === 'vuplayer') {
        return `
            <button class="btn btn-success btn-small" onclick="connectPlayer('vuplayer', ${client.id}, '${escapedName}', '${escapedMac}', '${escapedKey}')">
                🟢 Playlists
            </button>
            <button class="btn btn-warning btn-small" onclick="openDnsModalDirect('vuplayer', ${client.id}, '${escapedName}', '${escapedMac}', '${escapedKey}')">
                🔄 DNS
            </button>
        `;
    }
    
    // Fallback (não deveria chegar aqui, mas por segurança)
    return `<span class="config-warning">⚠️ Configurar</span>`;
}

// ========== SELEÇÃO DE CLIENTES ==========
function setupSelectionListeners() {
    document.getElementById('select-all').addEventListener('change', function() {
        toggleSelectAll(this.checked);
    });
    
    document.getElementById('server-filter').addEventListener('change', function() {
        filterByServer(this.value);
    });
}

function toggleClientSelection(clientId) {
    if (selectedClients.has(clientId)) {
        selectedClients.delete(clientId);
    } else {
        selectedClients.add(clientId);
    }
    
    const row = document.querySelector(`tr[data-client-id="${clientId}"]`);
    if (row) {
        row.classList.toggle('selected', selectedClients.has(clientId));
    }
    
    updateSelectionCount();
    updateSelectAllCheckbox();
}

function toggleSelectAll(checked) {
    filteredClients.forEach(client => {
        if (checked) {
            selectedClients.add(client.id);
        } else {
            selectedClients.delete(client.id);
        }
    });
    
    document.querySelectorAll('.client-checkbox').forEach(checkbox => {
        checkbox.checked = checked;
    });
    
    document.querySelectorAll('#clients-tbody tr[data-client-id]').forEach(row => {
        row.classList.toggle('selected', checked);
    });
    
    updateSelectionCount();
}

function updateSelectAllCheckbox() {
    const selectAll = document.getElementById('select-all');
    const visibleCheckboxes = document.querySelectorAll('.client-checkbox');
    const checkedCount = document.querySelectorAll('.client-checkbox:checked').length;
    
    if (visibleCheckboxes.length === 0) {
        selectAll.checked = false;
        selectAll.indeterminate = false;
    } else if (checkedCount === 0) {
        selectAll.checked = false;
        selectAll.indeterminate = false;
    } else if (checkedCount === visibleCheckboxes.length) {
        selectAll.checked = true;
        selectAll.indeterminate = false;
    } else {
        selectAll.checked = false;
        selectAll.indeterminate = true;
    }
}

function updateSelectionCount() {
    const count = selectedClients.size;
    document.getElementById('selection-count').textContent = 
        `${count} selecionado${count !== 1 ? 's' : ''}`;
    
    // Mostrar/esconder botão de DNS em massa
    const bulkDnsBtn = document.getElementById('bulk-dns-btn');
    if (count > 0) {
        bulkDnsBtn.classList.remove('hidden');
    } else {
        bulkDnsBtn.classList.add('hidden');
    }
}

function filterByServer(serverId) {
    if (!serverId) {
        filteredClients = [...allClients];
    } else {
        filteredClients = allClients.filter(client => 
            String(client.server_id) === String(serverId)
        );
    }
    
    displayClients(filteredClients);
    updateSelectAllCheckbox();
}

function getSelectedClients() {
    return allClients.filter(client => selectedClients.has(client.id));
}

// ========== CONEXÃO COM PLAYERS ==========
function connectPlayer(player, clientId, clientName, macAddress, deviceKey) {
    currentClient = { 
        id: clientId, 
        name: clientName, 
        mac_address: macAddress,
        device_key: deviceKey
    };
    currentPlayer = player;
    
    if (player === 'iboplayer') {
        document.getElementById('domain-client-name').textContent = clientName;
        document.getElementById('domain-modal').classList.remove('hidden');
    } else {
        doLogin(player, macAddress, deviceKey);
    }
}

function connectPlayerDirect(player, clientId, clientName, macAddress, deviceKey, domain) {
    currentClient = { 
        id: clientId, 
        name: clientName, 
        mac_address: macAddress,
        device_key: deviceKey
    };
    currentPlayer = player;
    
    doLogin(player, macAddress, deviceKey, domain);
}

function closeDomainModal() {
    document.getElementById('domain-modal').classList.add('hidden');
}

function selectDomain(domain) {
    closeDomainModal();
    doLogin('iboplayer', currentClient.mac_address, currentClient.device_key, domain);
}

// ========== LOGIN NOS PLAYERS ==========
async function doLogin(player, macAddress, deviceKey, domain = null) {
    document.getElementById('playlist-modal').classList.remove('hidden');
    document.getElementById('playlist-modal-title').textContent = 
        `${currentClient.name} - ${player.toUpperCase()}`;
    
    document.getElementById('player-loading').classList.remove('hidden');
    document.getElementById('playlist-content').classList.add('hidden');
    
    const loadingText = document.getElementById('player-loading-text');
    loadingText.textContent = 'Fazendo login... Isso pode levar até 60 segundos.';
    
    try {
        let endpoint = '';
        let body = {};
        
        if (player === 'iboplayer') {
            endpoint = '/api/players/iboplayer/login';
            body = { mac_address: macAddress, device_key: deviceKey, domain: domain };
        } else if (player === 'ibopro') {
            endpoint = '/api/players/ibopro/login';
            body = { mac_address: macAddress, password: deviceKey };
        } else if (player === 'vuplayer') {
            endpoint = '/api/players/vuplayer/login';
            body = { mac_address: macAddress, device_key: deviceKey };
        }
        
        const response = await apiRequest(endpoint, {
            method: 'POST',
            body: JSON.stringify(body)
        });
        
        if (response.success) {
            currentSession = response.session;
            sessionStorage.setItem(`${player}_session`, JSON.stringify(response.session));
            showMessage('Login realizado com sucesso!', 'success');
            loadPlaylists();
        } else {
            throw new Error(response.error || 'Erro ao conectar');
        }
    } catch (error) {
        showMessage('Erro ao conectar: ' + error.message, 'error');
        closePlaylistModal();
    }
}

function closePlaylistModal() {
    document.getElementById('playlist-modal').classList.add('hidden');
    document.getElementById('player-loading').classList.add('hidden');
    document.getElementById('playlist-content').classList.add('hidden');
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
            document.getElementById('player-loading').classList.add('hidden');
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
    document.getElementById('playlist-protect').addEventListener('change', function() {
        const pinGroup = document.getElementById('pin-group');
        if (this.checked) {
            pinGroup.classList.remove('hidden');
        } else {
            pinGroup.classList.add('hidden');
            document.getElementById('playlist-pin').value = '';
        }
    });
    
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
        name, url, type, protect,
        pin: protect ? pin : '',
        session: currentSession
    };
    
    showPlaylistLoading(true, playlistId ? 'Editando playlist...' : 'Adicionando playlist...');
    
    try {
        let endpoint = '';
        let method = 'POST';
        
        if (playlistId) {
            if (currentPlayer === 'iboplayer') {
                endpoint = `/api/players/iboplayer/playlists/${playlistId}`;
            } else if (currentPlayer === 'ibopro') {
                endpoint = `/api/players/ibopro/playlists/${playlistId}`;
            } else if (currentPlayer === 'vuplayer') {
                endpoint = `/api/players/vuplayer/playlists/${playlistId}`;
            }
            method = 'PUT';
        } else {
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
            loadPlaylists();
        } else {
            throw new Error(response.error || 'Erro ao salvar playlist');
        }
    } catch (error) {
        showMessage('Erro: ' + error.message, 'error');
    } finally {
        showPlaylistLoading(false);
    }
}

function editPlaylistBtn(playlist) {
    document.getElementById('playlist-id').value = playlist.id;
    document.getElementById('playlist-name').value = playlist.name;
    document.getElementById('playlist-url').value = playlist.url;
    document.getElementById('playlist-type').value = playlist.type || 'm3u';
    document.getElementById('form-title').textContent = 'Editar Playlist';
}

async function deletePlaylist(playlistId) {
    if (!confirm('Tem certeza que deseja excluir esta playlist?')) return;
    
    showPlaylistLoading(true, 'Excluindo playlist...');
    
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
            showMessage('Playlist excluída com sucesso!', 'success');
            loadPlaylists();
        } else {
            throw new Error(response.error || 'Erro ao excluir playlist');
        }
    } catch (error) {
        showMessage('Erro: ' + error.message, 'error');
    } finally {
        showPlaylistLoading(false);
    }
}

function resetForm() {
    document.getElementById('playlist-id').value = '';
    document.getElementById('playlist-name').value = '';
    document.getElementById('playlist-url').value = '';
    document.getElementById('playlist-type').value = 'm3u';
    document.getElementById('playlist-protect').checked = false;
    document.getElementById('pin-group').classList.add('hidden');
    document.getElementById('playlist-pin').value = '';
    document.getElementById('form-title').textContent = 'Adicionar Nova Playlist';
}

function showPlaylistLoading(show, text = 'Processando...') {
    const loading = document.getElementById('player-loading');
    const content = document.getElementById('playlist-content');
    const loadingText = document.getElementById('player-loading-text');
    
    if (show) {
        loadingText.textContent = text;
        loading.classList.remove('hidden');
        content.classList.add('hidden');
    } else {
        loading.classList.add('hidden');
        content.classList.remove('hidden');
    }
}

// ========================================
// ========== MUDAR DNS - NOVO! ==========
// ========================================

// Abre o modal de DNS para IBOPlayer (com domínio configurado)
function openDnsModal(player, clientId, clientName, macAddress, deviceKey, domain) {
    currentClient = { 
        id: clientId, 
        name: clientName, 
        mac_address: macAddress,
        device_key: deviceKey,
        player_domain: domain
    };
    currentPlayer = player;
    
    document.getElementById('dns-client-name').textContent = clientName;
    document.getElementById('dns-modal').classList.remove('hidden');
    
    // Limpar campos
    document.getElementById('dns-new').value = '';
    document.getElementById('dns-old').value = '';
    document.getElementById('dns-old-group').classList.add('hidden');
    
    // Reset radio buttons
    document.querySelectorAll('input[name="dns-mode"]').forEach(r => r.checked = false);
    document.getElementById('dns-mode-all').checked = true;
    dnsChangeMode = 'all';
}

// Abre o modal de DNS para IBOPro/VUPlayer (sem domínio)
function openDnsModalDirect(player, clientId, clientName, macAddress, deviceKey) {
    currentClient = { 
        id: clientId, 
        name: clientName, 
        mac_address: macAddress,
        device_key: deviceKey
    };
    currentPlayer = player;
    
    document.getElementById('dns-client-name').textContent = clientName;
    document.getElementById('dns-modal').classList.remove('hidden');
    
    // Limpar campos
    document.getElementById('dns-new').value = '';
    document.getElementById('dns-old').value = '';
    document.getElementById('dns-old-group').classList.add('hidden');
    
    // Reset radio buttons
    document.querySelectorAll('input[name="dns-mode"]').forEach(r => r.checked = false);
    document.getElementById('dns-mode-all').checked = true;
    dnsChangeMode = 'all';
}

function closeDnsModal() {
    document.getElementById('dns-modal').classList.add('hidden');
    dnsChangeMode = null;
    dnsPlaylists = [];
}

// Quando o usuário seleciona o modo de mudança
function selectDnsMode(mode) {
    dnsChangeMode = mode;
    
    const oldGroup = document.getElementById('dns-old-group');
    if (mode === 'detect') {
        oldGroup.classList.remove('hidden');
    } else {
        oldGroup.classList.add('hidden');
        document.getElementById('dns-old').value = '';
    }
}

// Executa a mudança de DNS
async function executeDnsChange() {
    const newDns = document.getElementById('dns-new').value.trim();
    const oldDns = document.getElementById('dns-old').value.trim();
    
    // Validações
    if (!newDns) {
        showMessage('Informe o novo DNS/URL', 'error');
        return;
    }
    
    if (!newDns.startsWith('http://') && !newDns.startsWith('https://')) {
        showMessage('O DNS deve começar com http:// ou https://', 'error');
        return;
    }
    
    if (dnsChangeMode === 'detect' && !oldDns) {
        showMessage('Informe o DNS antigo para detecção', 'error');
        return;
    }
    
    // Mostrar loading no modal de DNS
    document.getElementById('dns-modal').classList.add('hidden');
    document.getElementById('dns-loading-modal').classList.remove('hidden');
    document.getElementById('dns-loading-text').textContent = 'Fazendo login no player...';
    
    try {
        // 1. Fazer login
        await dnsDoLogin();
        
        // 2. Listar playlists
        document.getElementById('dns-loading-text').textContent = 'Carregando playlists...';
        const playlists = await dnsLoadPlaylists();
        
        if (!playlists || playlists.length === 0) {
            throw new Error('Nenhuma playlist encontrada');
        }
        
        dnsPlaylists = playlists;
        
        // 3. Processar de acordo com o modo
        let playlistsToChange = [];
        
        if (dnsChangeMode === 'all') {
            playlistsToChange = playlists;
            document.getElementById('dns-loading-text').textContent = `Alterando ${playlists.length} playlist(s)...`;
        } else if (dnsChangeMode === 'first') {
            playlistsToChange = [playlists[0]];
            document.getElementById('dns-loading-text').textContent = 'Alterando primeira playlist...';
        } else if (dnsChangeMode === 'detect') {
            // Filtrar playlists que contêm o DNS antigo
            playlistsToChange = playlists.filter(p => {
                const url = p.playlist_url || p.url;
                return url && extractDnsFromUrl(url).includes(oldDns.replace(/^https?:\/\//, ''));
            });
            
            if (playlistsToChange.length === 0) {
                throw new Error(`Nenhuma playlist encontrada com o DNS: ${oldDns}`);
            }
            
            document.getElementById('dns-loading-text').textContent = `Encontrada(s) ${playlistsToChange.length} playlist(s) com DNS antigo...`;
        }
        
        // 4. Alterar cada playlist
        let successCount = 0;
        let errorCount = 0;
        
        for (const playlist of playlistsToChange) {
            try {
                const id = playlist._id || playlist.id || playlist.playlist_id;
                const name = playlist.playlist_name || playlist.name;
                const oldUrl = playlist.playlist_url || playlist.url;
                const type = playlist.playlist_type || playlist.type || 'general';
                
                // Substituir DNS na URL
                const newUrl = changeDnsInUrl(oldUrl, newDns);
                
                document.getElementById('dns-loading-text').textContent = `Alterando: ${name}...`;
                
                // Chamar API para editar playlist
                await dnsEditPlaylist(id, name, newUrl, type);
                successCount++;
                
            } catch (err) {
                console.error('Erro ao alterar playlist:', err);
                errorCount++;
            }
        }
        
        // 5. Mostrar resultado
        document.getElementById('dns-loading-modal').classList.add('hidden');
        
        if (errorCount === 0) {
            showMessage(`✅ DNS alterado com sucesso em ${successCount} playlist(s)!`, 'success');
        } else {
            showMessage(`⚠️ ${successCount} alterada(s), ${errorCount} erro(s)`, 'warning');
        }
        
    } catch (error) {
        document.getElementById('dns-loading-modal').classList.add('hidden');
        showMessage('Erro: ' + error.message, 'error');
    }
    
    // Limpar sessão
    currentSession = null;
}

// Login para operação de DNS
async function dnsDoLogin() {
    let endpoint = '';
    let body = {};
    
    if (currentPlayer === 'iboplayer') {
        endpoint = '/api/players/iboplayer/login';
        body = { 
            mac_address: currentClient.mac_address, 
            device_key: currentClient.device_key, 
            domain: currentClient.player_domain 
        };
    } else if (currentPlayer === 'ibopro') {
        endpoint = '/api/players/ibopro/login';
        body = { 
            mac_address: currentClient.mac_address, 
            password: currentClient.device_key 
        };
    } else if (currentPlayer === 'vuplayer') {
        endpoint = '/api/players/vuplayer/login';
        body = { 
            mac_address: currentClient.mac_address, 
            device_key: currentClient.device_key 
        };
    }
    
    const response = await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(body)
    });
    
    if (response.success) {
        currentSession = response.session;
    } else {
        throw new Error(response.error || 'Erro no login');
    }
}

// Carregar playlists para operação de DNS
async function dnsLoadPlaylists() {
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
        return response.playlists;
    } else {
        throw new Error(response.error || 'Erro ao listar playlists');
    }
}

// Editar playlist para operação de DNS
async function dnsEditPlaylist(playlistId, name, newUrl, type) {
    let endpoint = '';
    
    if (currentPlayer === 'iboplayer') {
        endpoint = `/api/players/iboplayer/playlists/${playlistId}`;
    } else if (currentPlayer === 'ibopro') {
        endpoint = `/api/players/ibopro/playlists/${playlistId}`;
    } else if (currentPlayer === 'vuplayer') {
        endpoint = `/api/players/vuplayer/playlists/${playlistId}`;
    }
    
    const response = await apiRequest(endpoint, {
        method: 'PUT',
        body: JSON.stringify({
            name: name,
            url: newUrl,
            type: type,
            protect: false,
            pin: '',
            session: currentSession
        })
    });
    
    if (!response.success) {
        throw new Error(response.error || 'Erro ao editar playlist');
    }
    
    return response;
}

// Extrai apenas o DNS/domínio de uma URL
function extractDnsFromUrl(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.origin; // Retorna: https://popo65.live
    } catch (e) {
        // Se não for URL válida, tentar extrair manualmente
        const match = url.match(/^(https?:\/\/[^\/]+)/);
        return match ? match[1] : '';
    }
}

// Substitui o DNS de uma URL mantendo o path
function changeDnsInUrl(originalUrl, newDns) {
    // Remove trailing slash do novo DNS
    newDns = newDns.replace(/\/$/, '');
    
    try {
        const urlObj = new URL(originalUrl);
        const pathAndQuery = urlObj.pathname + urlObj.search;
        return newDns + pathAndQuery;
    } catch (e) {
        // Fallback: extrair path manualmente
        const match = originalUrl.match(/^https?:\/\/[^\/]+(\/.*)?$/);
        const path = match && match[1] ? match[1] : '';
        return newDns + path;
    }
}

function closeDnsLoadingModal() {
    document.getElementById('dns-loading-modal').classList.add('hidden');
}

// ================================================
// ========== DNS EM MASSA - NOVO! ==========
// ================================================

let bulkDnsMode = 'all';

// Abre o modal de DNS em massa
function openBulkDnsModal() {
    const selectedClientsList = getSelectedClients();
    
    // Filtrar apenas clientes que podem ser processados
    const validClients = selectedClientsList.filter(client => {
        const hasCredentials = client.mac_address || client.device_key;
        const hasPlayerType = client.player_type;
        const hasValidConfig = hasCredentials && hasPlayerType;
        
        // Para IBOPlayer, precisa ter domínio também
        if (client.player_type === 'iboplayer' && !client.player_domain) {
            return false;
        }
        
        return hasValidConfig;
    });
    
    document.getElementById('bulk-dns-count').textContent = `${validClients.length} de ${selectedClientsList.length}`;
    document.getElementById('bulk-dns-modal').classList.remove('hidden');
    
    // Limpar campos
    document.getElementById('bulk-dns-new').value = '';
    document.getElementById('bulk-dns-old').value = '';
    document.getElementById('bulk-dns-old-group').classList.add('hidden');
    
    // Reset radio buttons
    document.querySelectorAll('input[name="bulk-dns-mode"]').forEach(r => r.checked = false);
    document.getElementById('bulk-dns-mode-all').checked = true;
    bulkDnsMode = 'all';
}

function closeBulkDnsModal() {
    document.getElementById('bulk-dns-modal').classList.add('hidden');
}

function selectBulkDnsMode(mode) {
    bulkDnsMode = mode;
    
    const oldGroup = document.getElementById('bulk-dns-old-group');
    if (mode === 'detect') {
        oldGroup.classList.remove('hidden');
    } else {
        oldGroup.classList.add('hidden');
        document.getElementById('bulk-dns-old').value = '';
    }
}

// Executa a mudança de DNS em massa
async function executeBulkDnsChange() {
    const newDns = document.getElementById('bulk-dns-new').value.trim();
    const oldDns = document.getElementById('bulk-dns-old').value.trim();
    
    // Validações
    if (!newDns) {
        showMessage('Informe o novo DNS/URL', 'error');
        return;
    }
    
    if (!newDns.startsWith('http://') && !newDns.startsWith('https://')) {
        showMessage('O DNS deve começar com http:// ou https://', 'error');
        return;
    }
    
    if (bulkDnsMode === 'detect' && !oldDns) {
        showMessage('Informe o DNS antigo para detecção', 'error');
        return;
    }
    
    // Obter clientes válidos
    const selectedClientsList = getSelectedClients();
    const validClients = selectedClientsList.filter(client => {
        const hasCredentials = client.mac_address || client.device_key;
        const hasPlayerType = client.player_type;
        
        if (!hasCredentials || !hasPlayerType) return false;
        if (client.player_type === 'iboplayer' && !client.player_domain) return false;
        
        return true;
    });
    
    if (validClients.length === 0) {
        showMessage('Nenhum cliente válido para processar', 'error');
        return;
    }
    
    // Fechar modal e abrir progresso
    closeBulkDnsModal();
    document.getElementById('bulk-dns-progress-modal').classList.remove('hidden');
    document.getElementById('bulk-progress-actions').classList.add('hidden');
    
    // Limpar log
    document.getElementById('bulk-progress-log').innerHTML = '';
    
    // Processar cada cliente
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    for (let i = 0; i < validClients.length; i++) {
        const client = validClients[i];
        const progress = Math.round(((i + 1) / validClients.length) * 100);
        
        // Atualizar barra de progresso
        document.getElementById('bulk-progress-fill').style.width = `${progress}%`;
        document.getElementById('bulk-progress-text').textContent = `Processando ${i + 1} de ${validClients.length}`;
        document.getElementById('bulk-progress-detail').textContent = client.name;
        
        try {
            const result = await processSingleClientDns(client, newDns, oldDns, bulkDnsMode);
            
            if (result.success) {
                successCount += result.changed;
                addProgressLog(`✅ ${client.name}: ${result.changed} playlist(s) alterada(s)`, 'success');
            } else if (result.skipped) {
                skippedCount++;
                addProgressLog(`⏭️ ${client.name}: ${result.message}`, 'warning');
            } else {
                errorCount++;
                addProgressLog(`❌ ${client.name}: ${result.message}`, 'error');
            }
        } catch (error) {
            errorCount++;
            addProgressLog(`❌ ${client.name}: ${error.message}`, 'error');
        }
        
        // Pequeno delay entre clientes para não sobrecarregar
        await sleep(500);
    }
    
    // Finalizar
    document.getElementById('bulk-progress-fill').style.width = '100%';
    document.getElementById('bulk-progress-text').textContent = 'Concluído!';
    document.getElementById('bulk-progress-detail').textContent = 
        `${successCount} alteração(ões) | ${errorCount} erro(s) | ${skippedCount} ignorado(s)`;
    document.getElementById('bulk-progress-actions').classList.remove('hidden');
    
    // Limpar seleção
    selectedClients.clear();
    displayClients(filteredClients);
}

// Processa um único cliente para mudança de DNS
async function processSingleClientDns(client, newDns, oldDns, mode) {
    const playerType = client.player_type;
    
    // 1. Fazer login
    let session = null;
    try {
        session = await bulkDoLogin(client);
    } catch (error) {
        return { success: false, message: 'Erro no login: ' + error.message };
    }
    
    // 2. Listar playlists
    let playlists = [];
    try {
        playlists = await bulkLoadPlaylists(playerType, session);
    } catch (error) {
        return { success: false, message: 'Erro ao listar playlists: ' + error.message };
    }
    
    if (!playlists || playlists.length === 0) {
        return { skipped: true, message: 'Nenhuma playlist encontrada' };
    }
    
    // 3. Selecionar playlists para alterar
    let playlistsToChange = [];
    
    if (mode === 'all') {
        playlistsToChange = playlists;
    } else if (mode === 'first') {
        playlistsToChange = [playlists[0]];
    } else if (mode === 'detect') {
        playlistsToChange = playlists.filter(p => {
            const url = p.playlist_url || p.url;
            if (!url) return false;
            const dns = extractDnsFromUrl(url);
            return dns.includes(oldDns.replace(/^https?:\/\//, ''));
        });
        
        if (playlistsToChange.length === 0) {
            return { skipped: true, message: 'DNS antigo não encontrado' };
        }
    }
    
    // 4. Alterar cada playlist
    let changedCount = 0;
    
    for (const playlist of playlistsToChange) {
        try {
            const id = playlist._id || playlist.id || playlist.playlist_id;
            const name = playlist.playlist_name || playlist.name;
            const oldUrl = playlist.playlist_url || playlist.url;
            const type = playlist.playlist_type || playlist.type || 'general';
            
            const newUrl = changeDnsInUrl(oldUrl, newDns);
            
            await bulkEditPlaylist(playerType, session, id, name, newUrl, type);
            changedCount++;
        } catch (err) {
            console.error('Erro ao alterar playlist:', err);
        }
    }
    
    return { success: true, changed: changedCount };
}

// Login para operação em massa
async function bulkDoLogin(client) {
    let endpoint = '';
    let body = {};
    
    if (client.player_type === 'iboplayer') {
        endpoint = '/api/players/iboplayer/login';
        body = { 
            mac_address: client.mac_address, 
            device_key: client.device_key, 
            domain: client.player_domain 
        };
    } else if (client.player_type === 'ibopro') {
        endpoint = '/api/players/ibopro/login';
        body = { 
            mac_address: client.mac_address, 
            password: client.device_key 
        };
    } else if (client.player_type === 'vuplayer') {
        endpoint = '/api/players/vuplayer/login';
        body = { 
            mac_address: client.mac_address, 
            device_key: client.device_key 
        };
    }
    
    const response = await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(body)
    });
    
    if (response.success) {
        return response.session;
    } else {
        throw new Error(response.error || 'Erro no login');
    }
}

// Listar playlists para operação em massa
async function bulkLoadPlaylists(playerType, session) {
    let endpoint = '';
    
    if (playerType === 'iboplayer') {
        endpoint = '/api/players/iboplayer/playlists/list';
    } else if (playerType === 'ibopro') {
        endpoint = '/api/players/ibopro/playlists/list';
    } else if (playerType === 'vuplayer') {
        endpoint = '/api/players/vuplayer/playlists/list';
    }
    
    const response = await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify({ session: session })
    });
    
    if (response.success) {
        return response.playlists;
    } else {
        throw new Error(response.error || 'Erro ao listar playlists');
    }
}

// Editar playlist para operação em massa
async function bulkEditPlaylist(playerType, session, playlistId, name, newUrl, type) {
    let endpoint = '';
    
    if (playerType === 'iboplayer') {
        endpoint = `/api/players/iboplayer/playlists/${playlistId}`;
    } else if (playerType === 'ibopro') {
        endpoint = `/api/players/ibopro/playlists/${playlistId}`;
    } else if (playerType === 'vuplayer') {
        endpoint = `/api/players/vuplayer/playlists/${playlistId}`;
    }
    
    const response = await apiRequest(endpoint, {
        method: 'PUT',
        body: JSON.stringify({
            name: name,
            url: newUrl,
            type: type,
            protect: false,
            pin: '',
            session: session
        })
    });
    
    if (!response.success) {
        throw new Error(response.error || 'Erro ao editar playlist');
    }
    
    return response;
}

// Adiciona item ao log de progresso
function addProgressLog(message, type = 'info') {
    const log = document.getElementById('bulk-progress-log');
    const item = document.createElement('div');
    item.className = `progress-log-item ${type}`;
    item.textContent = message;
    log.appendChild(item);
    log.scrollTop = log.scrollHeight;
}

// Função auxiliar para delay
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function closeBulkProgressModal() {
    document.getElementById('bulk-dns-progress-modal').classList.add('hidden');
}
