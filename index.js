
    function renderIcons() {
      if (window.lucide) window.lucide.createIcons();
    }

    renderIcons();

    async function authFetch(url, options = {}) {
      const response = await fetch(url, { ...options, credentials: 'same-origin' });

      if (response.status === 401) {
        window.location.assign('/login.html');
        throw new Error('Sessão expirada.');
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
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const currentTimeEl = document.getElementById('current-time');
    const totalDurationEl = document.getElementById('total-duration');
    const volumeContainer = document.getElementById('volume-container');
    const volumeBar = document.getElementById('volume-bar');
    const muteBtn = document.getElementById('mute-btn');
    const libraryList = document.getElementById('library-list');
    const refreshLibraryBtn = document.getElementById('refresh-library');
    const logoutButton = document.getElementById('logout-btn');
    const profileName = document.getElementById('profile-name');
    const navItems = document.querySelectorAll('.nav-item');
    const views = {
      upload: document.getElementById('view-upload'),
      library: document.getElementById('view-library')
    };

    const appState = {
      tracks: [],
      currentIndex: -1,
      currentUser: null
    };

    async function loadSession() {
      const response = await authFetch('/api/session');
      const session = await response.json();
      appState.currentUser = session.usuario;
      profileName.textContent = session.usuario;
    }

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
        cover_url: track.capa_url || track.cover_url || null,
        owner: track.usuario || track.owner || null
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
        progressBar.style.width = '0%';
        currentTimeEl.textContent = '0:00';
        totalDurationEl.textContent = '0:00';
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
      renderIcons();
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

        actions.append(playButton);
        if (track.owner === appState.currentUser) {
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
          actions.append(deleteButton);
        }
        item.append(number, cover, info, genreBadge, duration, actions);
        libraryList.appendChild(item);
      });

      renderIcons();
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
      showLibrarySkeleton();
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

    function showLibrarySkeleton() {
      libraryList.innerHTML = Array.from({ length: 5 }, () => `
        <div class="library-row skeleton-row" aria-hidden="true">
          <div class="skeleton-box" style="width: 24px; height: 16px;"></div>
          <div class="skeleton-box" style="width: 44px; height: 44px; border-radius: 6px;"></div>
          <div class="skeleton-copy">
            <div class="skeleton-box" style="width: 40%; height: 14px;"></div>
            <div class="skeleton-box" style="width: 25%; height: 10px;"></div>
          </div>
        </div>
      `).join('');
    }

    fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files).filter((file) => file.type === 'audio/mpeg' || file.name.toLowerCase().endsWith('.mp3'));
      if (files.length > 0) {
        fileNameDisplay.textContent = files.length === 1
          ? `Arquivo selecionado: ${files[0].name}`
          : `${files.length} músicas selecionadas`;
      } else {
        fileNameDisplay.textContent = 'Selecione uma pasta com suas músicas';
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const selectedFiles = Array.from(fileInput.files);
      if (!selectedFiles.length) return;
      submitBtn.disabled = true;
      submitBtn.textContent = selectedFiles.length > 1
        ? `Enviando ${selectedFiles.length} músicas...`
        : 'Enviando para o Supabase...';

      const formData = new FormData(form);

      try {
        const response = await authFetch('/upload', {
          method: 'POST',
          body: formData
        });

        const result = await response.json();

        if (response.ok) {
          const tracks = (result.musicas || [result.musica || result.song]).filter(Boolean).map(normalizeTrack);
          appState.tracks.unshift(...tracks);
          renderLibrary();
          updatePlayer(tracks[0]);
          form.reset();
          fileNameDisplay.textContent = 'Selecione uma pasta com suas músicas';
          alert(`🎵 ${tracks.length} música(s) enviada(s) e cadastrada(s) com sucesso!`);
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

    function setProgressFromPointer(clientX) {
      const rect = progressContainer.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      if (Number.isFinite(audioElement.duration)) {
        audioElement.currentTime = ratio * audioElement.duration;
      }
    }

    function setVolumeFromPointer(clientX) {
      const rect = volumeContainer.getBoundingClientRect();
      const volume = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      audioElement.volume = volume;
      audioElement.muted = volume === 0;
      volumeBar.style.width = `${volume * 100}%`;
      volumeContainer.setAttribute('aria-valuenow', String(Math.round(volume * 100)));
      updateMuteIcon();
    }

    function updateMuteIcon() {
      muteBtn.querySelector('i').setAttribute('data-lucide', audioElement.muted || audioElement.volume === 0 ? 'volume-x' : 'volume-2');
      muteBtn.setAttribute('aria-label', audioElement.muted || audioElement.volume === 0 ? 'Ativar som' : 'Silenciar');
      renderIcons();
    }

    progressContainer.addEventListener('click', (event) => setProgressFromPointer(event.clientX));
    progressContainer.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      if (!Number.isFinite(audioElement.duration)) return;
      if (event.key === 'Home') audioElement.currentTime = 0;
      else if (event.key === 'End') audioElement.currentTime = audioElement.duration;
      else audioElement.currentTime = Math.max(0, Math.min(audioElement.duration, audioElement.currentTime + (event.key === 'ArrowRight' ? 5 : -5)));
    });

    volumeContainer.addEventListener('click', (event) => setVolumeFromPointer(event.clientX));

    let lastVolume = 0.8;
    muteBtn.addEventListener('click', () => {
      if (audioElement.muted || audioElement.volume === 0) {
        audioElement.muted = false;
        audioElement.volume = lastVolume || 0.8;
      } else {
        lastVolume = audioElement.volume;
        audioElement.muted = true;
      }
      volumeBar.style.width = `${audioElement.muted ? 0 : audioElement.volume * 100}%`;
      volumeContainer.setAttribute('aria-valuenow', String(Math.round(audioElement.muted ? 0 : audioElement.volume * 100)));
      updateMuteIcon();
    });

    logoutButton.addEventListener('click', async () => {
      await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
      window.location.assign('/login.html');
    });

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

    audioElement.addEventListener('loadedmetadata', () => {
      totalDurationEl.textContent = formatDuration(audioElement.duration);
    });
    audioElement.addEventListener('timeupdate', () => {
      if (!Number.isFinite(audioElement.duration)) return;
      const percent = (audioElement.currentTime / audioElement.duration) * 100;
      progressBar.style.width = `${percent}%`;
      currentTimeEl.textContent = formatDuration(audioElement.currentTime);
      totalDurationEl.textContent = formatDuration(audioElement.duration);
      progressContainer.setAttribute('aria-valuenow', String(Math.round(percent)));
    });
    audioElement.addEventListener('play', () => updatePlayButton(true));
    audioElement.addEventListener('pause', () => updatePlayButton(false));
    audioElement.addEventListener('ended', () => {
      if (appState.tracks.length) {
        playSelectedTrack(appState.currentIndex + 1);
      }
    });

    setView('upload');
    loadSession().then(loadLibrary).catch(() => {});
    audioElement.volume = 0.8;
    volumeBar.style.width = '80%';
    updateMuteIcon();
    updatePlayButton(false);