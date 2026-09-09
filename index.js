
    lucide.createIcons();

    // --- Acesso simples por senha (o app é público, mas de uso restrito) ---
    function getStoredUser() {
      return localStorage.getItem('app_user') || 'usuario1';
    }

    function getStoredPassword() {
      return localStorage.getItem('app_password') || '';
    }

    async function authFetch(url, options = {}) {
      const headers = {
        ...(options.headers || {}),
        'x-app-user': getStoredUser(),
        'x-app-password': getStoredPassword()
      };
      const response = await fetch(url, { ...options, headers });

      if (response.status === 401) {
        const usuario = prompt('Usuário (usuario1 ou usuario2):', getStoredUser()) || getStoredUser();
        const senha = prompt(`Senha do usuário ${usuario}:`);
        if (usuario && senha) {
          localStorage.setItem('app_user', usuario);
          localStorage.setItem('app_password', senha);
          return authFetch(url, options);
        }
        throw new Error('Acesso não autorizado.');
      }

      return response;
    }

    const fileInput = document.getElementById('audio-file');
    const fileNameDisplay = document.getElementById('file-name-display');
    const form = document.getElementById('upload-form');
    const submitBtn = document.getElementById('submit-btn');
    const playerTitle = document.getElementById('player-title');
    const playerArtist = document.getElementById('player-artist');
    const playerCover = document.getElementById('player-cover');
    const audioElement = document.getElementById('audio-player');
    const playBtn = document.getElementById('play-btn');
    const nextBtn = document.getElementById('next-btn');
    const previousBtn = document.getElementById('previous-btn');
    const libraryList = document.getElementById('library-list');
    const refreshLibraryBtn = document.getElementById('refresh-library');
    const navItems = document.querySelectorAll('.nav-item');
    const views = {
      upload: document.getElementById('view-upload'),
      library: document.getElementById('view-library')
    };

    const appState = {
      tracks: [],
      currentIndex: -1
    };

    function setView(viewName) {
      Object.entries(views).forEach(([key, section]) => {
        section.classList.toggle('active', key === viewName);
      });

      navItems.forEach((item) => {
        item.classList.toggle('active', item.dataset.view === viewName);
      });
    }

    function normalizeTrack(track) {
      return {
        id: track.id,
        title: track.titulo || track.title || 'Sem título',
        artist: track.artista || track.artist || 'Artista desconhecido',
        genre: track.genero || track.genre || 'Gênero não informado',
        audio_url: track.url_audio || track.audio_url,
        duration: track.duracao_segundos ?? track.duration ?? null,
        cover_url: track.capa_url || track.cover_url || null
      };
    }

    function formatDuration(seconds) {
      if (!seconds && seconds !== 0) return '';
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${String(secs).padStart(2, '0')}`;
    }

    function updatePlayer(track) {
      if (!track) {
        playerTitle.textContent = 'Nenhuma música selecionada';
        playerArtist.textContent = 'Aguardando upload';
        playerCover.innerHTML = '';
        playerCover.style.background = '';
        audioElement.removeAttribute('src');
        return;
      }

      playerTitle.textContent = track.title;
      playerArtist.textContent = track.artist;

      if (track.cover_url) {
        playerCover.style.background = '';
        playerCover.innerHTML = `<img src="${track.cover_url}" alt="">`;
      } else {
        playerCover.innerHTML = '';
        playerCover.style.background = coverGradient(track.genre);
      }

      audioElement.src = track.audio_url;
      audioElement.play().catch(() => {});
      updatePlayButton(true);
    }

    function updatePlayButton(isPlaying) {
      const icon = playBtn.querySelector('i');
      icon.setAttribute('data-lucide', isPlaying ? 'pause' : 'play');
      lucide.createIcons();
      renderLibrary();
    }

    function playSelectedTrack(index) {
      if (!appState.tracks.length) return;

      const safeIndex = (index + appState.tracks.length) % appState.tracks.length;
      appState.currentIndex = safeIndex;
      const track = appState.tracks[safeIndex];
      updatePlayer(track);
      renderLibrary();
    }

    const GENRE_COLORS = {
      pop: ['#ff4d94', '#8a0f4f'],
      rock: ['#ff6b3d', '#7a1f0d'],
      hiphop: ['#a855f7', '#3b0764'],
      electronic: ['#22d3ee', '#0e5266'],
      indie: ['#f5d90a', '#7a6a00'],
      default: ['#1db954', '#0d4428']
    };

    function coverGradient(genre) {
      const key = (genre || '').toLowerCase().replace(/[^a-z]/g, '');
      const [c1, c2] = GENRE_COLORS[key] || GENRE_COLORS.default;
      return `linear-gradient(135deg, ${c1}, ${c2})`;
    }

    function renderLibrary() {
      libraryList.innerHTML = '';

      if (!appState.tracks.length) {
        libraryList.innerHTML = '<div class="empty-state">Nenhuma música salva ainda. Faça o upload da primeira faixa.</div>';
        return;
      }

      appState.tracks.forEach((track, index) => {
        const isActive = index === appState.currentIndex;

        const item = document.createElement('article');
        item.className = 'library-row' + (isActive ? ' active' : '');

        const number = document.createElement('span');
        number.className = 'row-number';
        number.textContent = isActive ? '' : String(index + 1).padStart(2, '0');
        if (isActive) {
          number.innerHTML = '<span class="eq-bars"><i></i><i></i><i></i></span>';
        }

        const cover = document.createElement('div');
        cover.className = 'row-cover';
        if (track.cover_url) {
          const img = document.createElement('img');
          img.src = track.cover_url;
          img.alt = '';
          cover.appendChild(img);
        } else {
          cover.style.background = coverGradient(track.genre);
          cover.innerHTML = '<i data-lucide="music"></i>';
        }

        const info = document.createElement('div');
        info.className = 'row-info';
        const h3 = document.createElement('h3');
        h3.textContent = track.title;
        const pArtist = document.createElement('p');
        pArtist.textContent = track.artist;
        info.append(h3, pArtist);

        const genreBadge = document.createElement('span');
        genreBadge.className = 'genre-badge';
        genreBadge.textContent = track.genre;

        const duration = document.createElement('span');
        duration.className = 'row-duration';
        duration.textContent = formatDuration(track.duration);

        const actions = document.createElement('div');
        actions.className = 'row-actions';

        const playButton = document.createElement('button');
        playButton.type = 'button';
        playButton.className = 'row-play-btn';
        playButton.setAttribute('aria-label', 'Reproduzir');
        playButton.innerHTML = `<i data-lucide="${isActive ? 'pause' : 'play'}"></i>`;
        playButton.addEventListener('click', () => {
          if (isActive) {
            playBtn.click();
          } else {
            playSelectedTrack(index);
          }
        });

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'delete-btn';
        deleteButton.setAttribute('aria-label', 'Excluir música');
        deleteButton.innerHTML = '<i data-lucide="trash-2"></i>';
        deleteButton.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!confirm(`Excluir "${track.title}"? Essa ação não pode ser desfeita.`)) return;
          await deleteTrack(track.id);
        });

        actions.append(playButton, deleteButton);
        item.append(number, cover, info, genreBadge, duration, actions);
        libraryList.appendChild(item);
      });

      lucide.createIcons();
    }

    async function deleteTrack(id) {
      try {
        const response = await authFetch(`/musicas/${id}`, { method: 'DELETE' });
        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          throw new Error(result.error || 'Falha ao excluir.');
        }

        const wasCurrent = appState.tracks[appState.currentIndex]?.id === id;
        appState.tracks = appState.tracks.filter((t) => t.id !== id);

        if (wasCurrent) {
          appState.currentIndex = -1;
          updatePlayer(null);
        }

        renderLibrary();
      } catch (error) {
        console.error('Erro ao excluir música:', error);
        alert(`Erro ao excluir: ${error.message}`);
      }
    }

    async function loadLibrary() {
      try {
        const response = await authFetch('/musicas');
        const data = await response.json();

        appState.tracks = (data.musicas || []).map(normalizeTrack);
        renderLibrary();
      } catch (error) {
        console.error('Erro ao carregar biblioteca:', error);
        libraryList.innerHTML = '<div class="empty-state">Não foi possível carregar a biblioteca no momento.</div>';
      }
    }

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        fileNameDisplay.textContent = `Arquivo selecionado: ${e.target.files[0].name}`;
      } else {
        fileNameDisplay.textContent = 'Arraste seu arquivo MP3 aqui';
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      submitBtn.disabled = true;
      submitBtn.textContent = 'Enviando para o Supabase...';

      const formData = new FormData(form);

      try {
        const response = await authFetch('/upload', {
          method: 'POST',
          body: formData
        });

        const result = await response.json();

        if (response.ok) {
          const musica = result.musica || result.song;
          const track = normalizeTrack(musica);

          appState.tracks.unshift(track);
          renderLibrary();
          updatePlayer(track);
          form.reset();
          fileNameDisplay.textContent = 'Arraste seu arquivo MP3 aqui';
          alert('🎵 Música enviada e cadastrada com sucesso!');
        } else {
          alert(`Erro: ${result.error || 'Não foi possível fazer o upload.'}`);
        }
      } catch (error) {
        console.error('Erro na requisição:', error);
        alert('Erro ao se conectar ao servidor local. Tente novamente!');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Salvar no Banco de Dados';
      }
    });

    navItems.forEach((item) => {
      item.addEventListener('click', () => {
        setView(item.dataset.view);
      });
    });

    refreshLibraryBtn.addEventListener('click', loadLibrary);

    playBtn.addEventListener('click', () => {
      if (!audioElement.src) {
        if (appState.tracks.length) {
          playSelectedTrack(0);
        }
        return;
      }

      if (audioElement.paused) {
        audioElement.play().catch(() => {});
        updatePlayButton(true);
      } else {
        audioElement.pause();
        updatePlayButton(false);
      }
    });

    nextBtn.addEventListener('click', () => {
      if (appState.tracks.length) {
        playSelectedTrack(appState.currentIndex + 1);
      }
    });

    previousBtn.addEventListener('click', () => {
      if (appState.tracks.length) {
        playSelectedTrack(appState.currentIndex - 1);
      }
    });

    audioElement.addEventListener('play', () => updatePlayButton(true));
    audioElement.addEventListener('pause', () => updatePlayButton(false));
    audioElement.addEventListener('ended', () => {
      if (appState.tracks.length) {
        playSelectedTrack(appState.currentIndex + 1);
      }
    });

    setView('upload');
    loadLibrary();
    updatePlayButton(false);