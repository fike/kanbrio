import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function globalSetup() {
  console.log('\n--- Resetting database for E2E tests ---');
  try {
    // Navigate to project root and run make setup
    const rootDir = path.resolve(__dirname, '../../');
    execSync('make setup', { cwd: rootDir, stdio: 'inherit' });
    console.log('--- Database reset complete ---\n');
  } catch (error) {
    console.error('Failed to reset database:', error);
    process.exit(1);
  }
}

export default globalSetup;
