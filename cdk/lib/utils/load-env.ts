import * as fs from 'fs';
import * as path from 'path';

/// Parses a .env file and sets the environment variables accordingly.
function parseEnv(filePath: string): void {
  const envConfig = fs.readFileSync(filePath, 'utf-8').split('\n');

  envConfig.forEach((line) => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key.trim()] = value.trim();
    }
  });
}

/// Loads environment variables from .env file.
export function loadEnvFile(filePath?: string): void {
    filePath = filePath || '.env';
    parseEnv(path.resolve(process.cwd(), filePath));
}