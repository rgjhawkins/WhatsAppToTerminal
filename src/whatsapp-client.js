const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

function createClient() {
  const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  client.on('qr', (qr) => {
    console.log('Scan this QR code with WhatsApp on your phone:');
    qrcode.generate(qr, { small: true });
  });

  client.on('ready', () => {
    console.log('WhatsApp client is ready.');
  });

  client.on('authenticated', () => {
    console.log('WhatsApp authenticated.');
  });

  client.on('auth_failure', (msg) => {
    console.error('WhatsApp auth failure:', msg);
  });

  client.on('disconnected', (reason) => {
    console.warn('WhatsApp disconnected:', reason);
    console.log('Attempting to reconnect...');
    client.initialize();
  });

  return client;
}

module.exports = { createClient };
