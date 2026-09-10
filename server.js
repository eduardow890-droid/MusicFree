require('dotenv').config();
const crypto = require('node:crypto');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const mm = require('music-metadata');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const SESSION_COOKIE = 'music_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const sessions = new Map();

function lerCookie(req, nome) {
  const cookies = req.get('cookie') || '';
  const cookie = cookies.split(';').find((item) => item.trim().startsWith(`${nome}=`));
  return cookie ? decodeURIComponent(cookie.trim().slice(nome.length + 1)) : null;
}

function obterSessao(req) {
  const token = lerCookie(req, SESSION_COOKIE);
  const sessao = token ? sessions.get(token) : null;

  if (!sessao) return null;
  if (sessao.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }

  return { token, ...sessao };
}

function definirCookieSessao(res, token, maxAge = SESSION_TTL_MS) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.floor(maxAge / 1000)}`
  );
}

function normalizarValor(valor, fallback = '') {
  if (Array.isArray(valor)) {
    return valor[0] || fallback;
  }

  if (typeof valor === 'string') {
    const text = valor.trim();
    return text || fallback;
  }

  return fallback;
}

async function lerMetadadosMp3(file) {
  try {
    const metadata = await mm.parseBuffer(file.buffer, { mimeType: file.mimetype || 'audio/mpeg' });
    const common = metadata.common || {};
    const format = metadata.format || {};
    const picture = Array.isArray(common.picture) && common.picture.length > 0 ? common.picture[0] : null;

    return {
      title: normalizarValor(common.title, file.originalname.replace(/\.[^/.]+$/, '') || 'Música sem título'),
      artist: normalizarValor(common.artist, 'Artista desconhecido'),
      genre: normalizarValor(common.genre, 'Gênero não informado'),
      duration: typeof format.duration === 'number' ? Math.round(format.duration) : null,
      picture: picture ? { data: picture.data, format: picture.format } : null
    };
  } catch (error) {
    console.warn(`Não foi possível ler os metadados de ${file.originalname}: ${error.message}`);
    return {
      title: file.originalname.replace(/\.[^/.]+$/, '') || 'Música sem título',
      artist: 'Artista desconhecido',
      genre: 'Gênero não informado',
      duration: null,
      picture: null
    };
  }
}

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.redirect(obterSessao(req) ? '/index.html' : '/login.html');
});

app.get('/index.html', (req, res) => {
  if (!obterSessao(req)) return res.redirect('/login.html');
  return res.sendFile(`${__dirname}/index.html`);
});

// Serve os arquivos da pasta atual (index.html, style.css, etc.)
app.use(express.static(__dirname));

// Conexão com o Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Configuração do Multer (grava na memória antes de enviar ao Supabase)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 100 }, // Até 100 arquivos de 15MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'audio/mpeg' || file.mimetype === 'audio/mp3') {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos MP3 são permitidos!'));
    }
  }
});

// Suporte mínimo para 2 usuários com credenciais simples
const USER_CONFIG = {
  [process.env.USER_1_NAME || 'usuario1']: { password: process.env.USER_1_PASSWORD || 'usuario1' },
  [process.env.USER_2_NAME || 'usuario2']: { password: process.env.USER_2_PASSWORD || 'usuario2' }
};

const APP_PASSWORD = process.env.APP_PASSWORD;

function getUsuarioAtual(req) {
  return req.user;
}

function checkSession(req, res, next) {
  const sessao = obterSessao(req);
  if (!sessao) return res.status(401).json({ error: 'Sessão expirada ou usuário não autenticado.' });

  req.user = sessao.user;
  req.sessionToken = sessao.token;
  return next();
}

app.post('/api/login', (req, res) => {
  const usuario = typeof req.body.usuario === 'string' ? req.body.usuario.trim() : '';
  const senha = typeof req.body.senha === 'string' ? req.body.senha : '';
  const usuarioValido = USER_CONFIG[usuario];
  const senhaValida = usuarioValido && usuarioValido.password === senha;
  const senhaGlobalValida = APP_PASSWORD && APP_PASSWORD === senha;

  if (!usuarioValido || (!senhaValida && !senhaGlobalValida)) {
    return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { user: usuario, expiresAt: Date.now() + SESSION_TTL_MS });
  definirCookieSessao(res, token);

  return res.json({ usuario });
});

app.get('/api/session', checkSession, (req, res) => {
  return res.json({ autenticado: true, usuario: req.user });
});

app.post('/api/logout', (req, res) => {
  const token = lerCookie(req, SESSION_COOKIE);
  if (token) sessions.delete(token);
  definirCookieSessao(res, '', 0);
  return res.status(204).end();
});

async function usuarioColumnDisponivel() {
  if (globalThis.__musicasUsuarioColumnStatus !== undefined) {
    return globalThis.__musicasUsuarioColumnStatus;
  }

  try {
    const { error } = await supabase.from('musicas').select('usuario').limit(1);
    const ok = !(error && /Could not find the 'usuario' column|column .*usuario/i.test(error.message || String(error)));
    globalThis.__musicasUsuarioColumnStatus = ok;
    return ok;
  } catch (error) {
    const ok = !/Could not find the 'usuario' column|column .*usuario/i.test(String(error.message || error));
    globalThis.__musicasUsuarioColumnStatus = ok;
    return ok;
  }
}

app.use(checkSession);

app.get('/musicas', async (req, res) => {
  try {
    const query = supabase.from('musicas').select('*');

    const { data, error } = await query.order('id', { ascending: false });

    if (error) throw error;

    return res.json({ musicas: data || [] });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Rota de Exclusão
app.delete('/musicas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const usuario = getUsuarioAtual(req);
    const usaUsuario = await usuarioColumnDisponivel();

    let query = supabase
      .from('musicas')
      .select('url_audio, capa_url' + (usaUsuario ? ', usuario' : ''))
      .eq('id', id);

    if (usaUsuario) {
      query = query.eq('usuario', usuario);
    }

    const { data: musica, error: fetchError } = await query.single();

    if (fetchError) throw fetchError;
    if (!musica) return res.status(404).json({ error: 'Música não encontrada.' });

    // Remove o registro do banco
    const { error: deleteDbError } = await supabase
      .from('musicas')
      .delete()
      .eq('id', id);

    if (deleteDbError) throw deleteDbError;

    // Remove os arquivos do storage (best-effort; não falha a request se der erro aqui)
    const arquivosParaRemover = [];
    if (musica.url_audio) {
      const nomeArquivo = musica.url_audio.split('/musicas/').pop();
      if (nomeArquivo) arquivosParaRemover.push(nomeArquivo);
    }
    if (musica.capa_url) {
      const nomeCapa = musica.capa_url.split('/musicas/').pop();
      if (nomeCapa) arquivosParaRemover.push(nomeCapa);
    }
    if (arquivosParaRemover.length) {
      await supabase.storage.from('musicas').remove(arquivosParaRemover);
    }

    return res.json({ mensagem: 'Música excluída com sucesso!' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

async function processarUpload(file, req, overrides = {}) {
  const metadados = await lerMetadadosMp3(file);
  const nomeArquivo = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const arquivosEnviados = [nomeArquivo];

  const { error: storageError } = await supabase.storage
    .from('musicas')
    .upload(nomeArquivo, file.buffer, { contentType: file.mimetype });

  if (storageError) throw storageError;

  const { data: publicUrlData } = supabase.storage.from('musicas').getPublicUrl(nomeArquivo);
  const urlAudio = publicUrlData.publicUrl;
  let urlCapa = null;

  if (metadados.picture) {
    const extensao = (metadados.picture.format || 'image/jpeg').split('/').pop();
    const nomeCapa = `capas/${Date.now()}-${crypto.randomBytes(6).toString('hex')}-cover.${extensao}`;
    const { error: capaError } = await supabase.storage.from('musicas').upload(nomeCapa, metadados.picture.data, {
      contentType: metadados.picture.format || 'image/jpeg'
    });

    if (capaError) {
      throw new Error(`A capa de ${file.originalname} não pôde ser enviada: ${capaError.message}`);
    }

    arquivosEnviados.push(nomeCapa);
    urlCapa = supabase.storage.from('musicas').getPublicUrl(nomeCapa).data.publicUrl;
  }

  const usuario = getUsuarioAtual(req);
  const usaUsuario = await usuarioColumnDisponivel();
  const tituloFinal = overrides.title || metadados.title;
  const artistaFinal = overrides.artist || metadados.artist;
  const generoFinal = overrides.genre || metadados.genre;
  const payload = {
    titulo: tituloFinal,
    artista: artistaFinal,
    genero: generoFinal,
    url_audio: urlAudio,
    duracao_segundos: metadados.duration,
    capa_url: urlCapa
  };

  if (usaUsuario) payload.usuario = usuario;

  const { data: dbData, error: dbError } = await supabase.from('musicas').insert([payload]).select();
  if (dbError) {
    await supabase.storage.from('musicas').remove(arquivosEnviados).catch(() => {});
    throw dbError;
  }

  const registro = dbData[0] || {};
  return {
    id: registro.id ?? null,
    usuario: registro.usuario ?? usuario,
    title: registro.titulo ?? tituloFinal,
    artist: registro.artista ?? artistaFinal,
    genre: registro.genero ?? generoFinal,
    audio_url: registro.url_audio ?? urlAudio,
    duration: registro.duracao_segundos ?? metadados.duration,
    cover_url: registro.capa_url ?? urlCapa
  };
}

// Rota de Upload: aceita um arquivo ou uma pasta com até 100 MP3s.
app.post('/upload', upload.array('audio', 100), async (req, res) => {
  try {
    if (!req.files?.length) {
      return res.status(400).json({ error: 'Nenhum arquivo de áudio foi enviado.' });
    }

    const musicas = [];
    const overrides = req.files.length === 1
      ? { title: req.body.title, artist: req.body.artist, genre: req.body.genre }
      : {};
    for (const file of req.files) {
      musicas.push(await processarUpload(file, req, overrides));
    }

    return res.status(201).json({
      mensagem: `${musicas.length} música(s) cadastrada(s) com sucesso!`,
      musica: musicas[0],
      musicas
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Inicialização do Servidor (Render usa a variável PORT automática)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta http://localhost:${PORT}`);
});