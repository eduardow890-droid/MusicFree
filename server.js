require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const mm = require('music-metadata');
const { createClient } = require('@supabase/supabase-js');

const app = express();

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

// Serve os arquivos da pasta atual (index.html, style.css, etc.)
app.use(express.static(__dirname));

// Conexão com o Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Configuração do Multer (grava na memória antes de enviar ao Supabase)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // Limite de 15MB
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
  usuario1: { name: process.env.USER_1_NAME || 'usuario1', password: process.env.USER_1_PASSWORD || 'usuario1' },
  usuario2: { name: process.env.USER_2_NAME || 'usuario2', password: process.env.USER_2_PASSWORD || 'usuario2' }
};

const APP_PASSWORD = process.env.APP_PASSWORD;

function getUsuarioAtual(req) {
  const usuario = req.get('x-app-user') || req.query.usuario || 'usuario1';
  return Object.prototype.hasOwnProperty.call(USER_CONFIG, usuario) ? usuario : 'usuario1';
}

function checkPassword(req, res, next) {
  const usuario = getUsuarioAtual(req);
  const provided = req.get('x-app-password') || req.query.senha || req.query.password;

  if (APP_PASSWORD && provided === APP_PASSWORD) return next();

  const usuarioValido = USER_CONFIG[usuario];
  if (usuarioValido && provided === usuarioValido.password) return next();

  return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
}

app.use(checkPassword);

app.get('/musicas', async (req, res) => {
  try {
    const usuario = getUsuarioAtual(req);
    const { data, error } = await supabase
      .from('musicas')
      .select('*')
      .eq('usuario', usuario)
      .order('id', { ascending: false });

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

    const { data: musica, error: fetchError } = await supabase
      .from('musicas')
      .select('url_audio, capa_url, usuario')
      .eq('id', id)
      .eq('usuario', usuario)
      .single();

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

// Rota de Upload
app.post('/upload', upload.single('audio'), async (req, res) => {
  try {
    const { title, artist, genre } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'Nenhum arquivo de áudio foi enviado.' });
    }

    const metadados = await lerMetadadosMp3(file);
    const tituloFinal = title || metadados.title;
    const artistaFinal = artist || metadados.artist;
    const generoFinal = genre || metadados.genre;

    // Nome único para o arquivo MP3
    const nomeArquivo = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;

    // 1. Envia o arquivo MP3 para o bucket 'musicas'
    const { error: storageError } = await supabase.storage
      .from('musicas')
      .upload(nomeArquivo, file.buffer, {
        contentType: file.mimetype
      });

    if (storageError) throw storageError;

    // 2. Pega a URL pública do arquivo MP3
    const { data: publicUrlData } = supabase.storage
      .from('musicas')
      .getPublicUrl(nomeArquivo);

    const urlAudio = publicUrlData.publicUrl;

    // 2.1 Se o MP3 tem capa embutida (ID3), envia ela também para o storage
    let urlCapa = null;
    if (metadados.picture) {
      const extensao = (metadados.picture.format || 'image/jpeg').split('/').pop();
      const nomeCapa = `capas/${Date.now()}-cover.${extensao}`;

      const { error: capaError } = await supabase.storage
        .from('musicas')
        .upload(nomeCapa, metadados.picture.data, {
          contentType: metadados.picture.format || 'image/jpeg'
        });

      if (!capaError) {
        const { data: capaUrlData } = supabase.storage.from('musicas').getPublicUrl(nomeCapa);
        urlCapa = capaUrlData.publicUrl;
      }
    }

    // 3. Salva os metadados na tabela 'musicas'
    const usuario = getUsuarioAtual(req);

    const { data: dbData, error: dbError } = await supabase
      .from('musicas')
      .insert([
        {
          titulo: tituloFinal,
          artista: artistaFinal,
          genero: generoFinal,
          url_audio: urlAudio,
          duracao_segundos: metadados.duration,
          capa_url: urlCapa,
          usuario
        }
      ])
      .select();

    if (dbError) {
      // Reverte o upload do storage para não deixar arquivo órfão
      await supabase.storage.from('musicas').remove([nomeArquivo]).catch(() => {});
      throw dbError;
    }

    const musicaRetornada = {
      id: dbData[0]?.id ?? null,
      title: dbData[0]?.titulo ?? tituloFinal,
      artist: dbData[0]?.artista ?? artistaFinal,
      genre: dbData[0]?.genero ?? generoFinal,
      audio_url: dbData[0]?.url_audio ?? urlAudio,
      duration: dbData[0]?.duracao_segundos ?? metadados.duration,
      cover_url: dbData[0]?.capa_url ?? urlCapa
    };

    return res.status(201).json({
      mensagem: 'Música cadastrada com sucesso!',
      musica: musicaRetornada
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