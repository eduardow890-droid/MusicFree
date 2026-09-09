const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const serverCode = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const clientCode = fs.readFileSync(path.join(__dirname, '../index.js'), 'utf8');

test('o contrato do upload usa a mesma chave no backend e no frontend', () => {
  assert.match(
    serverCode,
    /musica:\s*musicaRetornada|mensagem:\s*'Música cadastrada com sucesso!'/,
    'O backend deve devolver o payload da música em uma chave consistente'
  );

  assert.match(
    clientCode,
    /const\s+musica\s*=\s*result\.musica\s*\|\|\s*result\.song|result\.musica/,
    'O frontend deve ler a resposta usando result.musica'
  );
});

test('o sistema aceita dois usuários com autenticação simples e separação por usuário', () => {
  assert.match(
    serverCode,
    /USER_1_NAME|USER_2_NAME|USER_1_PASSWORD|USER_2_PASSWORD|x-app-user/,
    'O backend deve reconhecer dois usuários e ler o header x-app-user'
  );

  assert.match(
    clientCode,
    /x-app-user|getStoredUser\(|localStorage\.getItem\('app_user'\)|localStorage\.setItem\('app_user'/,
    'O frontend deve armazenar e enviar o usuário atual'
  );

  assert.match(
    serverCode,
    /eq\('usuario'|usuario:\s*usuarioAtual|usuario\s*\)/,
    'O backend deve filtrar a biblioteca por usuário'
  );
});
