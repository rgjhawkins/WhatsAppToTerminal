const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const config = {
  allowedPhoneNumbers: (process.env.ALLOWED_PHONE_NUMBERS || '')
    .split(',')
    .map(n => n.trim())
    .filter(Boolean),

  claudeWorkingDir: process.env.CLAUDE_WORKING_DIR || process.cwd(),
  claudeTimeoutMs: parseInt(process.env.CLAUDE_TIMEOUT_MS, 10) || 120_000,
  claudeMaxBudgetUsd: parseFloat(process.env.CLAUDE_MAX_BUDGET_USD) || 1.0,
  maxMessageChunkSize: parseInt(process.env.MAX_MESSAGE_CHUNK_SIZE, 10) || 4096,
};

if (config.allowedPhoneNumbers.length === 0) {
  console.error('ALLOWED_PHONE_NUMBERS is not set in .env — no messages will be processed.');
}

module.exports = config;
