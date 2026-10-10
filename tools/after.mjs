import { execSync } from 'child_process';
execSync('node tools/probe.mjs', { stdio: 'inherit', env: process.env });
execSync('node tools/sweep.mjs', { stdio: 'inherit', env: process.env });
