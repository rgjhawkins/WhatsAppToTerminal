const { spawn } = require('child_process');
const config = require('./config');

function callClaude(message, sessionId, isResume) {
  return new Promise((resolve, reject) => {
    const mediaDir = require('path').join(config.claudeWorkingDir, '.wa-media-out');
    const systemPrompt = [
      'You are controlling a macOS computer via WhatsApp messages.',
      'You have full shell access via Bash. Use macOS commands freely.',
      'Always execute commands — never say you cannot.',
      `IMPORTANT: When asked to take screenshots, create files, or generate any media,`,
      `save them to: ${mediaDir}/`,
      `Create that directory first with mkdir -p if needed.`,
      `Example: screencapture ${mediaDir}/screenshot.png`,
      `Any files you save there will be automatically sent back to the user via WhatsApp.`,
    ].join(' ');

    const args = [
      '-p', message,
      '--output-format', 'json',
      '--dangerously-skip-permissions',
      '--system-prompt', systemPrompt,
    ];

    if (config.claudeMaxBudgetUsd > 0) {
      args.push('--max-budget-usd', String(config.claudeMaxBudgetUsd));
    }

    if (isResume) {
      args.push('--resume', sessionId);
    } else {
      args.push('--session-id', sessionId);
    }

    const env = { ...process.env, FORCE_COLOR: '0' };
    env.PATH = `/Users/roberthawkins/.local/bin:${env.PATH || ''}`;

    const options = {
      cwd: config.claudeWorkingDir,
      env,
    };

    console.log(`[claude] Spawning: claude ${args.join(' ')}`);

    const child = spawn('claude', args, options);
    child.stdin.end(); // Close stdin so claude doesn't wait for input
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      console.log(`[claude] stdout chunk (${chunk.length} bytes)`);
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      console.error(`[claude] stderr: ${chunk.toString().trim()}`);
    });

    const timer = setTimeout(() => {
      console.error(`[claude] Timeout after ${config.claudeTimeoutMs}ms, killing process`);
      child.kill('SIGTERM');
      reject(new Error(`Claude timed out after ${config.claudeTimeoutMs}ms`));
    }, config.claudeTimeoutMs);

    child.on('close', (code) => {
      clearTimeout(timer);
      console.log(`[claude] Process exited with code ${code}, stdout=${stdout.length} bytes`);

      if (stdout) {
        try {
          const result = JSON.parse(stdout);
          return resolve(result);
        } catch (e) {
          console.error(`[claude] Failed to parse JSON: ${e.message}`);
          return resolve({ result: stdout.trim(), session_id: sessionId });
        }
      }

      if (code !== 0) {
        return reject(new Error(`Claude exited with code ${code}: ${stderr}`));
      }

      resolve({ result: '', session_id: sessionId });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to start claude: ${err.message}`));
    });
  });
}

module.exports = { callClaude };
