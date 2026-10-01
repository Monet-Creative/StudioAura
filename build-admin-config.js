// Gera admin-config.js a partir de variáveis de ambiente durante o build do Cloudflare Pages.
// Configure ADMIN_PASSWORD e ADMIN_ACTION_PASSWORD em Cloudflare Pages > Settings > Environment variables (tipo "Secret").
const fs = require('fs');

const password = process.env.ADMIN_PASSWORD;
const actionPassword = process.env.ADMIN_ACTION_PASSWORD;

if (!password || !actionPassword) {
  console.error('ADMIN_PASSWORD e/ou ADMIN_ACTION_PASSWORD não definidas no ambiente de build.');
  process.exit(1);
}

const content = `window.STUDIO_AURA_ADMIN = {
  password: ${JSON.stringify(password)},
  actionPassword: ${JSON.stringify(actionPassword)}
};
`;

fs.writeFileSync('admin-config.js', content);
console.log('admin-config.js gerado a partir de variáveis de ambiente.');
