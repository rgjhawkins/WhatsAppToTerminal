const config = require('./config');

function chunkMessage(text, maxLen) {
  maxLen = maxLen || config.maxMessageChunkSize;
  if (text.length <= maxLen) return [text];

  const chunks = [];
  let remaining = text;

  while (remaining.length > maxLen) {
    let breakAt = -1;

    // Try to break at a paragraph boundary (double newline)
    const paraIdx = remaining.lastIndexOf('\n\n', maxLen);
    if (paraIdx > maxLen * 0.3) {
      breakAt = paraIdx + 2;
    }

    // Fall back to single newline
    if (breakAt === -1) {
      const lineIdx = remaining.lastIndexOf('\n', maxLen);
      if (lineIdx > maxLen * 0.3) {
        breakAt = lineIdx + 1;
      }
    }

    // Fall back to space
    if (breakAt === -1) {
      const spaceIdx = remaining.lastIndexOf(' ', maxLen);
      if (spaceIdx > maxLen * 0.3) {
        breakAt = spaceIdx + 1;
      }
    }

    // Hard break as last resort
    if (breakAt === -1) {
      breakAt = maxLen;
    }

    chunks.push(remaining.slice(0, breakAt).trimEnd());
    remaining = remaining.slice(breakAt).trimStart();
  }

  if (remaining) {
    chunks.push(remaining);
  }

  return chunks;
}

function extractResponseText(claudeResult) {
  if (!claudeResult) return 'No response from Claude.';

  // JSON output format has a `result` field with the text
  if (typeof claudeResult.result === 'string') {
    return claudeResult.result;
  }

  // Fallback: stringify
  if (typeof claudeResult === 'string') {
    return claudeResult;
  }

  return JSON.stringify(claudeResult, null, 2);
}

function formatCostInfo(claudeResult) {
  const parts = [];
  if (claudeResult.total_cost_usd != null) {
    parts.push(`Cost: $${claudeResult.total_cost_usd.toFixed(4)}`);
  }
  if (claudeResult.duration_ms != null) {
    parts.push(`Time: ${(claudeResult.duration_ms / 1000).toFixed(1)}s`);
  }
  return parts.length > 0 ? `\n_${parts.join(' | ')}_` : '';
}

module.exports = { chunkMessage, extractResponseText, formatCostInfo };
