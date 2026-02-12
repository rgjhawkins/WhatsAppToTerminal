const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const MODEL_PATH = path.resolve(__dirname, '..', 'models', 'ggml-base.bin');
const ENV = { ...process.env, PATH: `/opt/homebrew/bin:${process.env.PATH || ''}` };

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { env: ENV, timeout: 60000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(`${cmd} failed: ${err.message}\n${stderr}`));
      resolve(stdout);
    });
  });
}

async function transcribeAudio(media) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-audio-'));
  const inputPath = path.join(tmpDir, 'input.ogg');
  const wavPath = path.join(tmpDir, 'input.wav');

  try {
    // Write the base64-decoded audio to a file
    fs.writeFileSync(inputPath, Buffer.from(media.data, 'base64'));

    // Convert to 16kHz mono WAV (required by whisper)
    await run('ffmpeg', [
      '-i', inputPath,
      '-ar', '16000',
      '-ac', '1',
      '-f', 'wav',
      '-y',
      wavPath,
    ]);

    // Run whisper-cli, capture text from stdout
    const output = await run('whisper-cli', [
      '--model', MODEL_PATH,
      '--no-prints',
      '--no-timestamps',
      '--language', 'en',
      '-f', wavPath,
    ]);

    const text = output.trim();
    if (!text) throw new Error('Whisper returned empty transcription');
    return text;
  } finally {
    // Clean up temp files
    try { fs.unlinkSync(inputPath); } catch {}
    try { fs.unlinkSync(wavPath); } catch {}
    try { fs.rmdirSync(tmpDir); } catch {}
  }
}

module.exports = { transcribeAudio };
