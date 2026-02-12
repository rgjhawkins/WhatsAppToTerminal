const config = require('./config');
const sessionStore = require('./session-store');
const messageQueue = require('./message-queue');
const { callClaude } = require('./claude-bridge');
const { chunkMessage, extractResponseText, formatCostInfo } = require('./utils');
const { transcribeAudio } = require('./transcribe');
const { saveImage, cleanupImage } = require('./image-handler');
const { sendMediaFiles } = require('./media-sender');
const fs = require('fs');
const path = require('path');

// Chats where the bot is currently busy (processing or just replied)
const busyChats = new Set();

function isAuthorized(msg) {
  const contact = msg.from;
  const phone = contact.replace('@c.us', '');
  return config.allowedPhoneNumbers.includes(phone);
}

function isGroupOrBroadcast(msg) {
  return msg.from.endsWith('@g.us') || msg.from === 'status@broadcast';
}

async function sendChunked(chat, text) {
  const chunks = chunkMessage(text);
  for (const chunk of chunks) {
    await chat.sendMessage(chunk);
  }
}

async function handleCommand(msg, chat) {
  const body = msg.body.trim().toLowerCase();

  if (body === '/reset') {
    sessionStore.resetSession(msg.from);
    busyChats.add(msg.from);
    await chat.sendMessage('Session reset. Next message starts a fresh conversation.');
    setTimeout(() => busyChats.delete(msg.from), 2000);
    return true;
  }

  if (body === '/status') {
    const hasSession = sessionStore.hasSession(msg.from);
    const sessionId = sessionStore.getSession(msg.from);
    const lines = [
      `*Status*`,
      `Session active: ${hasSession ? 'yes' : 'no'}`,
      hasSession ? `Session ID: ${sessionId}` : '',
      `Working dir: ${config.claudeWorkingDir}`,
      `Budget: $${config.claudeMaxBudgetUsd}/call`,
      `Timeout: ${config.claudeTimeoutMs / 1000}s`,
    ].filter(Boolean);
    busyChats.add(msg.from);
    await chat.sendMessage(lines.join('\n'));
    setTimeout(() => busyChats.delete(msg.from), 2000);
    return true;
  }

  if (body === '/reload') {
    busyChats.add(msg.from);
    await chat.sendMessage('Reloading... back in a few seconds.');
    // Touch a src file to trigger --watch-path restart
    const touchFile = path.resolve(__dirname, 'index.js');
    const now = new Date();
    fs.utimesSync(touchFile, now, now);
    return true;
  }

  if (body === '/help') {
    busyChats.add(msg.from);
    await chat.sendMessage(
      `*Commands*\n` +
      `/reset — Start a fresh Claude conversation\n` +
      `/status — Show current session info\n` +
      `/reload — Restart the bridge (after code changes)\n` +
      `/help — Show this message\n\n` +
      `Any other message is sent to Claude Code.`
    );
    setTimeout(() => busyChats.delete(msg.from), 2000);
    return true;
  }

  return false;
}

async function processMessage(msg) {
  const chatId = msg.from;
  busyChats.add(chatId);
  try {
    const chat = await msg.getChat();
    const isResume = sessionStore.hasSession(chatId);
    const sessionId = isResume
      ? sessionStore.getSession(chatId)
      : sessionStore.createSession(chatId);

    await chat.sendStateTyping();

    // Handle different media types
    let messageText = msg.body || '';
    let imagePath = null;

    if (msg.hasMedia && (msg.type === 'audio' || msg.type === 'ptt')) {
      console.log(`[audio] Downloading and transcribing voice message...`);
      const media = await msg.downloadMedia();
      messageText = await transcribeAudio(media);
      console.log(`[audio] Transcription: ${messageText.slice(0, 80)}`);
    } else if (msg.hasMedia && (msg.type === 'image' || msg.type === 'sticker')) {
      console.log(`[image] Downloading image...`);
      const media = await msg.downloadMedia();
      imagePath = saveImage(media);
      const caption = messageText || 'Describe this image';
      messageText = `Read the image at ${imagePath} and then: ${caption}`;
      console.log(`[image] Saved to ${imagePath}, caption: ${caption.slice(0, 60)}`);
    }

    const result = await callClaude(messageText, sessionId, isResume);

    // Clean up temp image after Claude is done
    if (imagePath) cleanupImage(imagePath);
    const responseText = extractResponseText(result);
    const costInfo = formatCostInfo(result);
    const fullResponse = responseText + costInfo;

    await chat.clearState();
    await sendChunked(chat, fullResponse);

    // Send any media files Claude created
    await sendMediaFiles(chat);

    // Stay busy for 2s after sending to ignore the echo
    setTimeout(() => busyChats.delete(chatId), 2000);
  } catch (error) {
    console.error('[handler] Error processing message:', error);
    try {
      const chat = await msg.getChat();
      await chat.clearState();

      if (error.message && error.message.includes('session')) {
        sessionStore.resetSession(chatId);
        await chat.sendMessage(`Error (session reset): ${error.message}`);
      } else {
        await chat.sendMessage(`Error: ${error.message}`);
      }
    } catch (sendErr) {
      console.error('[handler] Failed to send error message:', sendErr);
    }
    setTimeout(() => busyChats.delete(chatId), 2000);
  }
}

function createHandler() {
  return async function onMessage(msg) {
    // Skip if bot is busy with this chat (prevents echo loop)
    if (busyChats.has(msg.from)) {
      console.log(`[skip] Ignoring message from ${msg.from} (bot is busy)`);
      return;
    }

    // Filter out groups, broadcasts
    if (isGroupOrBroadcast(msg)) return;

    // Allow audio/voice and image messages through even without body text
    const isAudio = msg.hasMedia && (msg.type === 'audio' || msg.type === 'ptt');
    const isImage = msg.hasMedia && (msg.type === 'image' || msg.type === 'sticker');
    if (!isAudio && !isImage && (!msg.body || msg.body.trim() === '')) return;

    // Auth check
    if (!isAuthorized(msg)) {
      console.log(`[auth] Rejected message from ${msg.from}`);
      return;
    }

    if (isAudio) {
      console.log(`[msg] From ${msg.from}: [voice message]`);
    } else if (isImage) {
      console.log(`[msg] From ${msg.from}: [image] ${msg.body || '(no caption)'}`);
    } else {
      console.log(`[msg] From ${msg.from}: ${msg.body.slice(0, 80)}${msg.body.length > 80 ? '...' : ''}`);
    }

    // Handle commands locally
    const chat = await msg.getChat();
    if (await handleCommand(msg, chat)) return;

    // Queue the Claude call for this chat
    messageQueue.enqueue(msg.from, () => processMessage(msg));
  };
}

module.exports = { createHandler };
