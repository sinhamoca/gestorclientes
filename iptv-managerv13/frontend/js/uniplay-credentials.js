// Funções para gerenciar credenciais Uniplay
async function loadUniplayCredentials() {
  try {
    const response = await api.get('/api/uniplay/credentials');
    
    if (response.has_credentials) {
      document.getElementById('uniplayUsername').value = response.username;
      document.getElementById('saveUniplayBtn').textContent = 'Atualizar Credenciais';
    } else {
      document.getElementById('saveUniplayBtn').textContent = 'Salvar Credenciais';
    }
  } catch (error) {
    console.error('Erro ao carregar credenciais:', error);
  }
}

async function saveUniplayCredentials() {
  const username = document.getElementById('uniplayUsername').value;
  const password = document.getElementById('uniplayPassword').value;
  
  if (!username || !password) {
    alert('Preencha usuário e senha');
    return;
  }
  
  try {
    const hasCredentials = document.getElementById('saveUniplayBtn').textContent === 'Atualizar Credenciais';
    
    if (hasCredentials) {
      await api.put('/api/uniplay/credentials', { username, password });
    } else {
      await api.post('/api/uniplay/credentials', { username, password });
    }
    
    alert('Credenciais salvas com sucesso!');
    document.getElementById('uniplayPassword').value = '';
    loadUniplayCredentials();
  } catch (error) {
    alert('Erro ao salvar credenciais: ' + error.message);
  }
}

// Carregar ao iniciar
document.addEventListener('DOMContentLoaded', loadUniplayCredentials);
