const { createClient } = require('./whatsapp-client');
const { createHandler } = require('./message-handler');

const client = createClient();
const handleMessage = createHandler();

// message_create fires for ALL messages (sent + received)
// message only fires for incoming — misses "message yourself" testing
client.on('message_create', (msg) => {
  console.log(`[debug] message_create from=${msg.from} fromMe=${msg.fromMe} body=${msg.body.slice(0, 50)}`);
  // Skip messages we sent (unless it's a self-chat)
  if (msg.fromMe && msg.to !== msg.from) return;
  handleMessage(msg);
});

console.log('Starting WhatsApp-to-Claude bridge...');
client.initialize();

// Graceful shutdown
function shutdown(signal) {
  console.log(`\nReceived ${signal}, shutting down...`);
  client.destroy().then(() => {
    console.log('WhatsApp client destroyed.');
    process.exit(0);
  }).catch(() => {
    process.exit(1);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
