const express = require('express');
const router = express.Router();
const playersController = require('../controllers/players.controller');
const authMiddleware = require('../middleware/auth');

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// ========== IBOPlayer ==========
router.post('/iboplayer/login', playersController.iboPlayerLogin);
router.post('/iboplayer/playlists/list', playersController.iboPlayerListPlaylists);
router.post('/iboplayer/playlists', playersController.iboPlayerAddPlaylist);
router.put('/iboplayer/playlists/:playlistId', playersController.iboPlayerEditPlaylist);
router.delete('/iboplayer/playlists/:playlistId', playersController.iboPlayerDeletePlaylist);

// ========== IBOPro ==========
router.post('/ibopro/login', playersController.iboProLogin);
router.post('/ibopro/playlists/list', playersController.iboProListPlaylists);
router.post('/ibopro/playlists', playersController.iboProAddPlaylist);
router.put('/ibopro/playlists/:playlistId', playersController.iboProEditPlaylist);
router.delete('/ibopro/playlists/:playlistId', playersController.iboProDeletePlaylist);

// ========== VUPlayer ==========
router.post('/vuplayer/login', playersController.vuPlayerLogin);
router.post('/vuplayer/playlists/list', playersController.vuPlayerListPlaylists);
router.post('/vuplayer/playlists', playersController.vuPlayerAddPlaylist);
router.put('/vuplayer/playlists/:playlistId', playersController.vuPlayerEditPlaylist);
router.delete('/vuplayer/playlists/:playlistId', playersController.vuPlayerDeletePlaylist);

module.exports = router;
