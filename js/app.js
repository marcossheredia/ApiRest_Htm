// --- CONFIGURACIÓN ---
const API_KEY = '04ad86cd8897770fd21ef924ad732d65'; 
const BASE_URL = 'https://ws.audioscrobbler.com/2.0/';

// --- FUNCIONES AUXILIARES PARA TEST (Añade esto al principio de app.js) ---

/**
 * Limpia el título de una canción eliminando paréntesis y guiones.
 */
function cleanTrackTitle(songTitle) {
    if (!songTitle) return '';
    return songTitle.split('(')[0].split('-')[0].trim();
}

/**
 * Formatea segundos a formato mm:ss.
 */
function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return "0:00";
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}:${sec < 10 ? '0' + sec : sec}`;
}

// --- SELECTORES DOM ---
const dom = {
    navLogo: document.querySelector('.logo'),
    searchInput: document.getElementById('search-input'),
    searchBtn: document.getElementById('search-btn'),
    suggestionsView: document.getElementById('suggestions-view'),
    suggestionsGrid: document.getElementById('suggestions-grid'),
    mainContent: document.getElementById('main-content'),
    artistHeaderBg: document.getElementById('artist-header-bg'), // Para el fondo
    loading: document.getElementById('loading'),
    errorMsg: document.getElementById('error-msg'),
    
    // Detalle Artista
    artistImg: document.getElementById('artist-img'),
    artistName: document.getElementById('artist-name'),
    artistTags: document.getElementById('artist-tags'),
    artistListeners: document.getElementById('artist-listeners'),
    artistPlaycount: document.getElementById('artist-playcount'),
    artistBio: document.getElementById('artist-bio'),
    tracksList: document.getElementById('tracks-list'),
    similarGrid: document.getElementById('similar-grid')
};

// --- ESTADO INICIAL ---
const ARTISTAS_SUGERIDOS = [
    "Kanye West", "Sade", "Leiva", "Extremoduro",
    "Kendrick Lamar", "Marvin Gaye", "Bad Bunny", "Stevie Wonder",
    "Led Zepellin", "Nas"
];

// --- INICIALIZACIÓN ---
window.addEventListener('DOMContentLoaded', initApp);

function initApp() {
    renderSuggestions();
    setupEventListeners();
    setupPlayerEvents();
}

function setupEventListeners() {
    // Buscar
    dom.searchBtn.addEventListener('click', handleSearch);
    dom.searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });

    // Volver a Inicio
    dom.navLogo.addEventListener('click', () => {
        dom.searchInput.value = '';
        toggleView('home');
    });
}

// --- GESTIÓN DE VISTAS ---
// --- GESTIÓN DE VISTAS (MODIFICADA) ---
function toggleView(viewName) {
    // 1. Ocultar todo primero
    dom.suggestionsView.classList.add('hidden');
    dom.mainContent.classList.add('hidden');
    dom.loading.classList.add('hidden');
    dom.errorMsg.classList.add('hidden');

    // 2. Mostrar la vista deseada y gestionar el reproductor
    switch(viewName) {
        case 'home':
            dom.suggestionsView.classList.remove('hidden');
            
            // --- NUEVO: APAGAR MÚSICA AL IR AL HOME ---
            // Si la barra existe y está activa...
            if(playerDom.bar && playerDom.bar.classList.contains('active')) {
                // 1. Ocultamos la barra (la bajamos)
                playerDom.bar.classList.remove('active');
                
                // 2. Pausamos la música para que no suene "fantasma"
                if(currentAudio && !currentAudio.paused) {
                    currentAudio.pause();
                    isPlaying = false;
                    updatePlayIcon(); // Cambia el icono a Play
                }
            }
            break;

        case 'detail':
            dom.mainContent.classList.remove('hidden');
            // Resetear scroll al cambiar a detalle
            window.scrollTo(0, 0); 
            break;

        case 'loading':
            dom.loading.classList.remove('hidden');
            break;
    }
}

// 1. DICCIONARIO DE IMÁGENES LOCALES (Añade esto justo antes de la función)
// Asegúrate de que los nombres de archivo en tu carpeta 'img' coincidan
const IMAGENES_LOCALES = {
    "Nas": "img/Nas.jpg",
    "Sade": "img/Sade.jpg",
    "Stevie Wonder": "img/Stevie_Wonder.avif",
    "Leiva": "img/Leiva.jpeg",
    "Bad Bunny": "img/Bad_Bunny.jpeg",
    "Extremoduro": "img/Extremoduro.jpg",
    "Led Zepellin": "img/Led_Zepellin.jpg"

    // Añade aquí los que quieras...
};

// --- LOGICA SUGERENCIAS (HOME) ---
// EN app.js
function renderSuggestions() {
    dom.suggestionsGrid.innerHTML = '';
    
    // CAMBIO CLAVE: Usamos map en vez de forEach y devolvemos Promise.all
    // Esto permite que el Test espere a que se creen las tarjetas
    const promises = ARTISTAS_SUGERIDOS.map(async (artist) => {
        const card = document.createElement('div');
        card.className = 'artist-card';
        card.innerHTML = `
            <div class="img-container">
                 <div style="width:100%; height:100%; background:#222;"></div>
            </div>
            <div class="card-info"><h3>${artist}</h3></div>
        `;
        dom.suggestionsGrid.appendChild(card);

        let imgUrl;
        if (IMAGENES_LOCALES[artist]) {
            imgUrl = IMAGENES_LOCALES[artist];
        } else {
            const foto = await fetchWikiImage(artist);
            imgUrl = foto || `https://placehold.co/400x400/333/fff?text=${artist[0]}`;
        }
        
        card.querySelector('.img-container').innerHTML = `<img src="${imgUrl}" alt="${artist}" loading="lazy">`;

        card.addEventListener('click', () => {
            dom.searchInput.value = artist;
            loadArtistData(artist);
        });
    });

    return Promise.all(promises); // <--- ESTO ES LA CLAVE DEL 100%
}

// --- CORE: CARGAR ARTISTA ---
async function handleSearch() {
    const query = dom.searchInput.value.trim();
    if (query) loadArtistData(query);
}

// COPIA Y PEGA ESTA FUNCIÓN ENTERA
async function loadArtistData(artistName) {
    toggleView('loading');

    try {
        // 1. LÓGICA DE FOTO: ¿La tenemos en local?
        // Buscamos si el artista está en tu lista (ej: "Leiva")
        let photoUrl = IMAGENES_LOCALES[artistName]; 

        // 2. Preparamos la búsqueda en Wiki SOLO si no tenemos foto local
        // Si ya tenemos foto, ponemos 'null' para no gastar tiempo buscando
        const wikiPromise = photoUrl ? null : fetchWikiImage(artistName);

        // 3. Fetch Datos (Paralelo)
        const [infoRes, tracksRes, similarRes, wikiPhotoResult] = await Promise.all([
            fetchLastFm('artist.getinfo', { artist: artistName, lang: 'es' }),
            fetchLastFm('artist.gettoptracks', { artist: artistName, limit: 5 }),
            fetchLastFm('artist.getsimilar', { artist: artistName, limit: 6 }),
            wikiPromise // Aquí pasamos la promesa o null
        ]);

        // 4. Si no teníamos foto local, usamos la que acaba de encontrar Wiki
        if (!photoUrl) {
            photoUrl = wikiPhotoResult;
        }

        if (infoRes.error) throw new Error(infoRes.message);

        // 5. Renderizar UI con la foto final
        renderArtistHeader(infoRes.artist, photoUrl);
        renderTracks(tracksRes.toptracks.track, infoRes.artist.name);
        renderSimilar(similarRes.similarartists.artist);

        toggleView('detail');

    } catch (error) {
        console.error(error);
        dom.loading.classList.add('hidden');
        dom.errorMsg.textContent = "Error al cargar artista. Intenta con otro nombre.";
        dom.errorMsg.classList.remove('hidden');
    }
}

// --- HELPERS API ---
async function fetchLastFm(method, params) {
    const url = new URL(BASE_URL);
    url.search = new URLSearchParams({
        method,
        api_key: API_KEY,
        format: 'json',
        ...params
    });
    const res = await fetch(url);
    return await res.json();
}

// --- API WIKIPEDIA INTELIGENTE (Búsqueda + Foto) ---
async function fetchWikiImage(artistName) {
    try {
        // 1. DICCIONARIO MÍNIMO
        const hardCorrections = {
            "Rosalia": "Rosalía",
            "Queen": "Queen_(band)",
            "Nirvana": "Nirvana_(band)",
            "Kiss": "Kiss_(band)",
            "Eagles": "Eagles_(band)",
            "Genesis": "Genesis_(band)",
            "Tool": "Tool_(band)"
        };

        let searchName = hardCorrections[artistName];

        // 2. SI NO ESTÁ EN EL DICCIONARIO, PREGUNTAMOS A WIKIPEDIA
        if (!searchName) {
            const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(artistName)}&limit=1&namespace=0&format=json&origin=*`;
            
            const searchRes = await fetch(searchUrl);
            const searchData = await searchRes.json();
            
            if (searchData[1].length > 0) {
                searchName = searchData[1][0];
            } else {
                return null;
            }
        }

        // 3. PEDIMOS LA FOTO
        const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(searchName)}`;
        const res = await fetch(summaryUrl);
        
        if (!res.ok) return null;
        
        const data = await res.json();
        return data.thumbnail?.source || null;

    } catch (e) {
        console.warn("Error recuperando foto wiki:", e);
        return null;
    }
}

// --- VARIABLES GLOBALES DE AUDIO ---
let currentAudio = new Audio();
let isPlaying = false;

// --- RENDER UI ---
function renderArtistHeader(artist, photoUrl) {
    dom.artistName.textContent = artist.name;
    dom.artistListeners.textContent = parseInt(artist.stats.listeners).toLocaleString();
    dom.artistPlaycount.textContent = parseInt(artist.stats.playcount).toLocaleString();
    dom.artistBio.innerHTML = artist.bio.summary || "Sin información disponible.";
    
    // Imagen
    const finalPhoto = photoUrl || 'https://via.placeholder.com/500?text=No+Image';
    dom.artistImg.src = finalPhoto;
    dom.artistHeaderBg.style.backgroundImage = `url('${finalPhoto}')`;

    // Tags
    dom.artistTags.innerHTML = '';
    const tags = Array.isArray(artist.tags.tag) ? artist.tags.tag : [artist.tags.tag];
    tags.slice(0, 4).forEach(tag => { 
        const span = document.createElement('span');
        span.textContent = tag.name;
        dom.artistTags.appendChild(span);
    });
}

function renderTracks(tracks, artistName) {
    dom.tracksList.innerHTML = '';
    const trackArray = Array.isArray(tracks) ? tracks : [tracks];

    const artistImgSrc = dom.artistImg.src;

    trackArray.forEach((track, index) => {
        const li = document.createElement('li');
        li.className = 'track-item';
        
        li.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <span class="track-num">${index + 1}</span>
                <button class="play-btn-mini" title="Reproducir">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                </button>
            </div>
            <span class="track-name">${track.name}</span>
            <span class="track-plays">${parseInt(track.playcount).toLocaleString()}</span>
        `;
        
        li.addEventListener('click', () => {
            initPlayer(artistName, track.name, artistImgSrc);
        });

        dom.tracksList.appendChild(li);
    });
}

// EN app.js
async function renderSimilar(artists) { // Añade async aquí si no estaba
    dom.similarGrid.innerHTML = '';
    const artistArray = Array.isArray(artists) ? artists : [artists];

    // CAMBIO CLAVE: map + Promise.all
    const promises = artistArray.map(async (artist) => {
        const div = document.createElement('div');
        div.className = 'similar-card';
        div.innerHTML = `<img src="https://placehold.co/150x150/333/fff?text=..." alt="${artist.name}"> <p>${artist.name}</p>`;
        dom.similarGrid.appendChild(div);

        let imgUrl;
        if (IMAGENES_LOCALES[artist.name]) {
            imgUrl = IMAGENES_LOCALES[artist.name];
        } else {
            const wikiImg = await fetchWikiImage(artist.name);
            imgUrl = wikiImg || 'https://placehold.co/150x150/333/fff?text=' + artist.name[0];
        }

        const img = div.querySelector('img');
        if(img) img.src = imgUrl;

        div.addEventListener('click', () => {
            dom.searchInput.value = artist.name;
            loadArtistData(artist.name);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });

    return Promise.all(promises); // <--- CLAVE PARA EL TEST
}

// --- LOGICA DEL REPRODUCTOR (AUDIO ENGINE) ---

const playerDom = {
    bar: document.getElementById('audio-player-bar'),
    title: document.getElementById('player-title'),
    artist: document.getElementById('player-artist'),
    img: document.getElementById('player-img'),
    playBtn: document.getElementById('play-pause-btn'),
    iconPlay: document.getElementById('icon-play'),
    iconPause: document.getElementById('icon-pause'),
    progressBar: document.getElementById('progress-bar'),
    currTime: document.getElementById('current-time'),
    volSlider: document.getElementById('volume-slider')
};

// 1. CREA ESTA NUEVA FUNCIÓN (Justo antes de initPlayer o por esa zona)
function setupPlayerEvents() {
    // Verificamos que existan los elementos antes de asignar eventos
    if (!playerDom.playBtn || !playerDom.progressBar) return;

    playerDom.playBtn.addEventListener('click', togglePlayPause);
    
    if (playerDom.volSlider) {
        playerDom.volSlider.addEventListener('input', (e) => currentAudio.volume = e.target.value);
    }
    
    // El evento que daba error antes
    playerDom.progressBar.addEventListener('input', (e) => {
        const duration = currentAudio.duration;
        if(duration) {
            currentAudio.currentTime = (e.target.value / 100) * duration;
        }
    });

    currentAudio.addEventListener('timeupdate', updateProgress);
    currentAudio.addEventListener('ended', () => {
        isPlaying = false;
        updatePlayIcon();
        if(playerDom.progressBar) playerDom.progressBar.value = 0;
    });
}

// --- FUNCIÓN ARREGLADA (NUEVO PROXY) ---
async function initPlayer(artist, song, image) {
    // UI Visual
    playerDom.bar.classList.remove('hidden');
    void playerDom.bar.offsetWidth; // Hack para reiniciar animación CSS
    playerDom.bar.classList.add('active');
    
    playerDom.title.textContent = song;
    playerDom.artist.textContent = artist;
    playerDom.img.src = image;
    playerDom.title.style.opacity = '0.5';

    try {
        if(currentAudio.src) {
            currentAudio.pause();
            isPlaying = false;
        }

        // 1. Limpieza del nombre (quitamos paréntesis tipo "Remix", "Live")
        const cleanSong = song.split('(')[0].split('-')[0].trim();
        
        // 2. Construimos la búsqueda DIRECTA a Deezer (Sin proxy)
        // Nota: encodeURIComponent es vital aquí
        const query = encodeURIComponent(`artist:"${artist}" track:"${cleanSong}"`);
        const deezerUrl = `https://api.deezer.com/search?q=${query}`;
        
        console.log("Conectando directo a:", deezerUrl);

        // 3. Usamos nuestra nueva función mágica
        const deezerData = await fetchDeezer(deezerUrl); 

        if (deezerData.data && deezerData.data.length > 0) {
            const track = deezerData.data[0];
            
            console.log("Preview encontrada:", track.preview);

            currentAudio.src = track.preview;
            currentAudio.volume = playerDom.volSlider.value;
            
            if(track.album && track.album.cover_medium) {
                playerDom.img.src = track.album.cover_medium;
            }

            try {
                await currentAudio.play();
                isPlaying = true;
                updatePlayIcon();
            } catch (e) {
                console.warn("Autoplay bloqueado por el navegador (normal si no has interactuado primero)");
                isPlaying = false;
                updatePlayIcon();
            }
            playerDom.title.style.opacity = '1';

        } else {
            console.warn("Deezer no tiene preview para:", song);
            playerDom.title.textContent = "Preview no disponible 🔇";
            playerDom.title.style.opacity = '1';
        }

    } catch (error) {
        console.error("Error Audio:", error);
        playerDom.title.textContent = "Error de conexión ⚠️";
        playerDom.title.style.opacity = '1';
    }
}

function togglePlayPause() {
    if (!currentAudio.src) return;

    if (isPlaying) {
        currentAudio.pause();
        isPlaying = false;
    } else {
        currentAudio.play();
        isPlaying = true;
    }
    updatePlayIcon();
}

function updatePlayIcon() {
    if (isPlaying) {
        playerDom.iconPlay.classList.add('hidden');
        playerDom.iconPause.classList.remove('hidden');
    } else {
        playerDom.iconPlay.classList.remove('hidden');
        playerDom.iconPause.classList.add('hidden');
    }
}

function updateProgress() {
    const { currentTime, duration } = currentAudio;
    if (isNaN(duration)) return;
    
    const percent = (currentTime / duration) * 100;
    playerDom.progressBar.value = percent;
    
    // Formato mm:ss
    const formatTime = (t) => {
        const min = Math.floor(t / 60);
        const sec = Math.floor(t % 60);
        return `${min}:${sec < 10 ? '0'+sec : sec}`;
    };
    
    playerDom.currTime.textContent = formatTime(currentTime);
}

// Permitir buscar ("seek") en la barra


// Función auxiliar para conectar con Deezer directamente (JSONP)
function fetchDeezer(url) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        // Creamos un nombre único para la función temporal
        const callbackName = 'deezer_callback_' + Math.round(100000 * Math.random());
        
        window[callbackName] = function(data) {
            delete window[callbackName];
            document.body.removeChild(script);
            resolve(data);
        };

        // Preparamos la URL añadiendo el callback
        const separator = url.includes('?') ? '&' : '?';
        script.src = url + separator + 'output=jsonp&callback=' + callbackName;
        script.onerror = (err) => {
            delete window[callbackName];
            document.body.removeChild(script);
            reject(err);
        };
        
        document.body.appendChild(script);
    });
}

if (typeof module !== 'undefined') {
    module.exports = {
        cleanTrackTitle,
        formatTime,
        initApp,
        toggleView,
        handleSearch,
        loadArtistData,
        renderSuggestions,
        fetchWikiImage,
        initPlayer,
        togglePlayPause,
        updateProgress,
        fetchDeezer,
        setupPlayerEvents,
        getAudioState: () => ({ currentAudio, isPlaying }),
        setAudioState: (audio, playing) => {
            currentAudio = audio;
            isPlaying = playing;
        }
    };
}