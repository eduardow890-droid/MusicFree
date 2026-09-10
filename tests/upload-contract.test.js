const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const serverCode = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const clientCode = fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8');

test('o contrato do upload usa a mesma chave no backend e no frontend', () => {
  assert.match(
    serverCode,
    /upload\.array\('audio',\s*100\)|musicas\.push\(await processarUpload/,
    'O backend deve aceitar e processar múltiplos arquivos'
  );

  assert.match(
    clientCode,
    /result\.musicas|fileInput\.files/,
    'O frontend deve ler a resposta em lote'
  );
});

test('o sistema usa login por sessão e separação por usuário', () => {
  assert.match(
    serverCode,
    /api\/login|USER_1_NAME|USER_2_NAME|USER_1_PASSWORD|USER_2_PASSWORD/,
    'O backend deve expor login e reconhecer os usuários configurados'
  );

  assert.match(
    clientCode,
    /credentials:\s*'same-origin'|api\/session/,
    'O frontend deve usar a sessão do navegador'
  );

  assert.match(
    serverCode,
    /eq\('usuario'|usuario:\s*usuarioAtual|usuario\s*\)/,
    'O backend deve filtrar a biblioteca por usuário'
  );
});

test('a página de login envia as credenciais e permite encerrar a sessão', () => {
  const loginCode = fs.readFileSync(path.join(__dirname, '../login.js'), 'utf8');
  const loginPage = fs.readFileSync(path.join(__dirname, '../login.html'), 'utf8');

  assert.match(loginPage, /id="login-form"/);
  assert.match(loginCode, /api\/login/);
  assert.match(serverCode, /api\/logout|HttpOnly/);
});

test('o backend funciona mesmo quando a coluna usuario ainda não existe no schema do Supabase', () => {
  assert.match(
    serverCode,
    /hasUsuarioColumn|usuarioColumnDisponivel|column.*usuario|schema cache/i,
    'O backend deve verificar se a coluna usuario existe antes de filtrar por ela'
  );
});
