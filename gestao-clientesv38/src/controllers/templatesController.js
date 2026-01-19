import { query } from '../config/database.js';

// Listar templates
export async function listTemplates(req, res) {
  try {
    const result = await query(
      'SELECT * FROM message_templates WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List templates error:', error);
    res.status(500).json({ error: 'Erro ao listar templates' });
  }
}

// Criar template
export async function createTemplate(req, res) {
  try {
    const { name, type, message } = req.body;

    // Verifica se já existe
    const existing = await query(
      'SELECT id FROM message_templates WHERE user_id = $1 AND name = $2',
      [req.user.id, name]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Template com este nome já existe' });
    }

    const result = await query(
      `INSERT INTO message_templates (user_id, name, type, message, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.id, name, type, message, true]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({ error: 'Erro ao criar template' });
  }
}

// Atualizar template
export async function updateTemplate(req, res) {
  try {
    const { id } = req.params;
    const { name, type, message } = req.body;
    const is_active = true;
    const result = await query(
      `UPDATE message_templates 
       SET name = $1, type = $2, message = $3, is_active = $4, updated_at = NOW()
       WHERE id = $5 AND user_id = $6
       RETURNING *`,
      [name, type, message, is_active, id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update template error:', error);
    res.status(500).json({ error: 'Erro ao atualizar template' });
  }
}

// Deletar template
export async function deleteTemplate(req, res) {
  try {
    const { id } = req.params;

    // Verifica se tem lembretes usando este template
    const remindersCheck = await query(
      'SELECT COUNT(*) FROM reminders WHERE template_id = $1',
      [id]
    );

    if (parseInt(remindersCheck.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: 'Não é possível excluir. Existem lembretes usando este template.' 
      });
    }

    const result = await query(
      'DELETE FROM message_templates WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template não encontrado' });
    }

    res.json({ message: 'Template excluído com sucesso' });
  } catch (error) {
    console.error('Delete template error:', error);
    res.status(500).json({ error: 'Erro ao excluir template' });
  }
}

// ========================================
// FUNÇÃO DE SAUDAÇÃO AUTOMÁTICA
// ========================================
function getSaudacao() {
  // Usa horário de Brasília (America/Sao_Paulo)
  const now = new Date();
  const brasiliaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const hora = brasiliaTime.getHours();
  
  if (hora >= 6 && hora < 12) {
    return 'Bom dia';
  } else if (hora >= 12 && hora < 18) {
    return 'Boa tarde';
  } else {
    return 'Boa noite';
  }
}

// Visualizar preview do template com variáveis substituídas
export async function previewTemplate(req, res) {
  try {
    const { id } = req.params;
    const { client_id } = req.query;

    // Busca template
    const templateResult = await query(
      'SELECT * FROM message_templates WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (templateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Template não encontrado' });
    }

    const template = templateResult.rows[0];
    let message = template.message;

    // Se forneceu client_id, substitui com dados reais
    if (client_id) {
      const clientResult = await query(
        `SELECT c.*, p.name as plan_name, s.name as server_name
         FROM clients c
         LEFT JOIN plans p ON c.plan_id = p.id
         LEFT JOIN servers s ON c.server_id = s.id
         WHERE c.id = $1 AND c.user_id = $2`,
        [client_id, req.user.id]
      );

      if (clientResult.rows.length > 0) {
        const client = clientResult.rows[0];
        message = replaceVariables(message, client);
      }
    } else {
      // Preview com dados de exemplo (chaves simples)
      const domain = process.env.PAYMENT_DOMAIN || 'https://pagamentos.seusite.com.br';
      message = message
        .replace(/\{saudacao\}/gi, getSaudacao())
        .replace(/\{nome\}/gi, 'João Silva')
        .replace(/\{vencimento\}/gi, '25/12/2024')
        .replace(/\{valor\}/gi, 'R$ 25,00')
        .replace(/\{servidor\}/gi, 'Netflix')
        .replace(/\{plano\}/gi, '1 mês 2 telas')
        .replace(/\{dias\}/gi, '3')
        .replace(/\{whatsapp\}/gi, '85999999999')
        .replace(/\{fatura\}/gi, `${domain}/pay/abc123xyz`)
        .replace(/\{link_pagamento\}/gi, `${domain}/pay/abc123xyz`);
    }

    res.json({
      template: template.message,
      preview: message
    });
  } catch (error) {
    console.error('Preview template error:', error);
    res.status(500).json({ error: 'Erro ao gerar preview' });
  }
}

// Função auxiliar para substituir variáveis
// USA CHAVES SIMPLES: {nome}, {dias}, {fatura}, {saudacao}, etc.
/**
 * Substitui variáveis no template de mensagem
 * @param {string} message - Mensagem com variáveis
 * @param {object} client - Dados do cliente
 * @param {string|null} paymentUrl - URL de pagamento (opcional)
 * @param {object|null} pixData - Dados do PIX Manual (opcional) { pix_key, pix_key_holder }
 */
export function replaceVariables(message, client, paymentUrl = null, pixData = null) {
  const today = new Date();
  const dueDate = new Date(client.due_date);
  const diffTime = dueDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  const dueDateFormatted = dueDate.toLocaleDateString('pt-BR');
  const valueFormatted = `R$ ${parseFloat(client.price_value).toFixed(2)}`;

  // 🆕 Gerar saudação baseada na hora atual (timezone Brasil)
  const nowBrasil = new Date(today.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const hora = nowBrasil.getHours();
  let saudacao;
  if (hora >= 5 && hora < 12) {
    saudacao = 'Bom dia';
  } else if (hora >= 12 && hora < 18) {
    saudacao = 'Boa tarde';
  } else {
    saudacao = 'Boa noite';
  }

  // Gera link de fatura se não foi fornecido e cliente tem payment_token
  // APENAS para clientes do tipo 'link' (não PIX manual)
  if (!paymentUrl && client.payment_token && client.payment_type !== 'pix') {
    const domain = process.env.PAYMENT_DOMAIN || process.env.FRONTEND_URL || '';
    paymentUrl = `${domain}/pay/${client.payment_token}`;
  }

  // Preparar dados do PIX
  const pixKey = pixData?.pix_key ? `PIX: ${pixData.pix_key}` : '';
  const pixHolder = pixData?.pix_key_holder ? `BENEFICIARIO: ${pixData.pix_key_holder.toUpperCase()}` : '';
  
  // Criar texto formatado para copiar PIX
  let pixCopiaECola = '';
  if (pixKey) {
    pixCopiaECola = pixHolder 
      ? `PIX: ${pixKey}\nTitular: ${pixHolder}`
      : `PIX: ${pixKey}`;
  }

  return message
    // 🆕 Saudação
    .replace(/\{saudacao\}/gi, saudacao)
    
    // Variáveis originais
    .replace(/\{nome\}/gi, client.name)
    .replace(/\{vencimento\}/gi, dueDateFormatted)
    .replace(/\{valor\}/gi, valueFormatted)
    .replace(/\{servidor\}/gi, client.server_name || 'N/A')
    .replace(/\{plano\}/gi, client.plan_name || 'N/A')
    .replace(/\{dias\}/gi, Math.abs(diffDays).toString())
    .replace(/\{whatsapp\}/gi, client.whatsapp_number || '')
    .replace(/\{fatura\}/gi, paymentUrl || '')
    .replace(/\{link_pagamento\}/gi, paymentUrl || '')
    
    // Variáveis PIX
    .replace(/\{pix\}/gi, pixKey)
    .replace(/\{pix_titular\}/gi, pixHolder)
    .replace(/\{pix_chave\}/gi, pixKey)  // alias
    .replace(/\{pix_copia_cola\}/gi, pixCopiaECola);
}