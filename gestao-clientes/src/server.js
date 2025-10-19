import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase } from './config/database.js';
import { verifyToken, requireAdmin } from './middlewares/auth.js';
import * as authController from './controllers/authController.js';
import * as usersController from './controllers/usersController.js';
import * as plansController from './controllers/plansController.js';
import * as serversController from './controllers/serversController.js';
import * as clientsController from './controllers/clientsController.js';


dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// Rotas públicas
app.post('/api/auth/login', authController.login);

// Rotas protegidas
app.get('/api/auth/me', verifyToken, authController.me);

// Rotas de Planos (protegidas - só usuário)
app.get('/api/plans', verifyToken, plansController.listPlans);
app.post('/api/plans', verifyToken, plansController.createPlan);
app.put('/api/plans/:id', verifyToken, plansController.updatePlan);
app.delete('/api/plans/:id', verifyToken, plansController.deletePlan);

// Rotas de Servidores
app.get('/api/servers', verifyToken, serversController.listServers);
app.post('/api/servers', verifyToken, serversController.createServer);
app.put('/api/servers/:id', verifyToken, serversController.updateServer);
app.delete('/api/servers/:id', verifyToken, serversController.deleteServer);

// Rotas de Clientes
app.get('/api/clients', verifyToken, clientsController.listClients);
app.get('/api/clients/stats', verifyToken, clientsController.getClientStats);
app.get('/api/clients/:id', verifyToken, clientsController.getClient);
app.post('/api/clients', verifyToken, clientsController.createClient);
app.put('/api/clients/:id', verifyToken, clientsController.updateClient);
app.delete('/api/clients/:id', verifyToken, clientsController.deleteClient);


// Rotas admin
app.get('/api/admin/users', verifyToken, requireAdmin, usersController.listUsers);
app.get('/api/admin/users/:id', verifyToken, requireAdmin, usersController.getUser);
app.post('/api/admin/users', verifyToken, requireAdmin, usersController.createUser);
app.put('/api/admin/users/:id', verifyToken, requireAdmin, usersController.updateUser);
app.delete('/api/admin/users/:id', verifyToken, requireAdmin, usersController.deleteUser);
app.get('/api/admin/stats', verifyToken, requireAdmin, usersController.getDashboardStats);
app.get('/api/admin/users-with-clients', verifyToken, requireAdmin, usersController.getUsersWithClientCount);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Inicialização
async function start() {
  try {
    await initDatabase();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📊 Admin: admin@sistema.com / admin123`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
