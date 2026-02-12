const { v4: uuidv4 } = require('uuid');

const sessions = new Map();

function getSession(chatId) {
  return sessions.get(chatId) || null;
}

function createSession(chatId) {
  const sessionId = uuidv4();
  sessions.set(chatId, sessionId);
  return sessionId;
}

function resetSession(chatId) {
  sessions.delete(chatId);
}

function hasSession(chatId) {
  return sessions.has(chatId);
}

module.exports = { getSession, createSession, resetSession, hasSession };
