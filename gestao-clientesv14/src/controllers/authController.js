import bcrypt from 'bcrypt';
import { query } from '../config/database.js';
import { generateToken } from '../middlewares/auth.js';

export async function login(req, res) {
  try {
    const { email, password } = req.body;

    // Busca usuário
    const result = await query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const user = result.rows[0];

    // Verifica senha
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Verifica se está ativo
    if (!user.is_active) {
      return res.status(403).json({ error: 'Usuário inativo' });
    }

    // Se for usuário comum, verifica vencimento
    if (user.role === 'user') {
      const today = new Date();
      const endDate = new Date(user.subscription_end);
      
      if (endDate < today) {
        return res.status(403).json({ 
          error: 'Assinatura vencida',
          expired: true,
          subscription_end: user.subscription_end
        });
      }
    }

    // Gera token
    const token = generateToken(user);

    // Remove senha do retorno
    delete user.password_hash;

    res.json({
      user,
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
}

export async function me(req, res) {
  try {
    const result = await query(
      'SELECT id, name, email, phone, role, subscription_start, subscription_end, is_active, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Me error:', error);
    res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
}
