/* ========================================
   KOFFICE SESSION KEEPER - INDEX
   
   Exporta todos os módulos do sistema
   
   LOCALIZAÇÃO: backend/src/services/koffice/index.js
   ======================================== */

import KofficeSession from './KofficeSession.js';
import sessionManager, { KofficeSessionManager } from './KofficeSessionManager.js';
import kofficeFactory, { KofficeRenewalFactory } from './KofficeRenewalFactory.js';

export {
  KofficeSession,
  KofficeSessionManager,
  sessionManager,
  KofficeRenewalFactory,
  kofficeFactory
};

export default kofficeFactory;
