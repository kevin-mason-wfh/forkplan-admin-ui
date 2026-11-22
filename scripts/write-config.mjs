// Writes dist/config.json from environment variables (set per GitHub environment).
// Required: API_BASE_URL, COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID. Optional: AWS_REGION (default eu-west-2).
import { writeFileSync } from 'node:fs';

const need = (k) => {
  const v = process.env[k]?.trim();
  if (!v) { console.error(`Missing required env var ${k}`); process.exit(1); }
  return v;
};

const config = {
  apiBaseUrl: need('API_BASE_URL'),
  region: process.env.AWS_REGION || 'eu-west-2',
  userPoolId: need('COGNITO_USER_POOL_ID'),
  clientId: need('COGNITO_CLIENT_ID'),
  adminGroups: ['admin', 'catalog-admin', 'support-admin'],
  tokenType: 'access',
  openapiUrl: '',
};
writeFileSync('dist/config.json', JSON.stringify(config, null, 2) + '\n');
console.log('Wrote dist/config.json for', config.apiBaseUrl);
