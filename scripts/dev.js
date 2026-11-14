const { spawn } = require('child_process');

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

console.log('\n🚀 Starting TenderProcure CRM (API on :5000 + Frontend on :3000)...\n');

const api = spawn(npmCmd, ['run', 'dev:api'], {
  stdio: 'inherit',
  shell: true,
});

const web = spawn(npmCmd, ['run', 'dev:web'], {
  stdio: 'inherit',
  shell: true,
});

let isShuttingDown = false;
function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('\n🛑 Stopping all services...');
  if (isWin) {
    if (api && api.pid) {
      try { spawn('taskkill', ['/pid', api.pid.toString(), '/f', '/t']); } catch {}
    }
    if (web && web.pid) {
      try { spawn('taskkill', ['/pid', web.pid.toString(), '/f', '/t']); } catch {}
    }
  } else {
    try { api.kill('SIGTERM'); } catch {}
    try { web.kill('SIGTERM'); } catch {}
  }
  setTimeout(() => process.exit(0), 500);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

api.on('close', (code) => {
  if (code && code !== 0 && !isShuttingDown) {
    console.error(`[API] Server stopped with exit code ${code}`);
  }
});

web.on('close', (code) => {
  if (code && code !== 0 && !isShuttingDown) {
    console.error(`[Web] Frontend stopped with exit code ${code}`);
  }
});

