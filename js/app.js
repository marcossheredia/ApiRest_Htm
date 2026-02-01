// --- CONFIGURACIÓN ---
const API_KEY = '04ad86cd8897770fd21ef924ad732d65'; 
const BASE_URL = 'https://ws.audioscrobbler.com/2.0/';

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
    "Dua Lipa", "The Weeknd", "Arctic Monkeys", "Rosalia",
    "Kendrick Lamar", "Tame Impala", "Bad Bunny", "Queen"
];

// --- INICIALIZACIÓN ---
window.addEventListener('DOMContentLoaded', initApp);

function initApp() {
    renderSuggestions();
    setupEventListeners();
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

// --- LOGICA SUGERENCIAS (HOME) ---
function renderSuggestions() {
    dom.suggestionsGrid.innerHTML = '';
    
    ARTISTAS_SUGERIDOS.forEach(async (artist) => {
        const card = document.createElement('div');
        card.className = 'artist-card';
        card.innerHTML = `
            <div class="img-container">
                <div style="width:100%; height:100%; background:#222;"></div>
            </div>
            <div class="card-info">
                <h3>${artist}</h3>
            </div>
        `;
        dom.suggestionsGrid.appendChild(card);

        // Fetch foto en segundo plano
        const foto = await fetchWikiImage(artist);
        const imgUrl = foto || `https://via.placeholder.com/400?text=${artist[0]}`;
        
        card.querySelector('.img-container').innerHTML = `<img src="${imgUrl}" alt="${artist}" loading="lazy">`;

        card.addEventListener('click', () => {
            dom.searchInput.value = artist;
            loadArtistData(artist);
        });
    });
}

// --- CORE: CARGAR ARTISTA ---
async function handleSearch() {
    const query = dom.searchInput.value.trim();
    if (query) loadArtistData(query);
}

async function loadArtistData(artistName) {
    toggleView('loading');

    try {
        // 1. Fetch Datos (Paralelo)
        const [infoRes, tracksRes, similarRes, photoUrl] = await Promise.all([
            fetchLastFm('artist.getinfo', { artist: artistName, lang: 'es' }),
            fetchLastFm('artist.gettoptracks', { artist: artistName, limit: 5 }),
            fetchLastFm('artist.getsimilar', { artist: artistName, limit: 6 }),
            fetchWikiImage(artistName)
        ]);

        if (infoRes.error) throw new Error(infoRes.message);

        // 2. Renderizar UI
        renderArtistHeader(infoRes.artist, photoUrl);
        renderTracks(tracksRes.toptracks.track);
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

async function fetchWikiImage(name) {
    try {
        const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`;
        const res = await fetch(url);
        if(!res.ok) return null;
        const data = await res.json();
        return data.thumbnail?.source || null;
    } catch { return null; }
}

// --- API WIKIPEDIA INTELIGENTE (Búsqueda + Foto) ---
async function fetchWikiImage(artistName) {
    try {
        // 1. DICCIONARIO MÍNIMO (Solo para casos imposibles)
        // Mantenemos solo los grupos que tienen nombres de cosas comunes
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
            // Usamos la API de búsqueda "OpenSearch" para encontrar el nombre exacto de la página
            // Esto corrige automáticamente "rosalia" -> "Rosalía", "nathy peluso" -> "Nathy Peluso", etc.
            const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(artistName)}&limit=1&namespace=0&format=json&origin=*`;
            
            const searchRes = await fetch(searchUrl);
            const searchData = await searchRes.json();
            
            // La respuesta tiene formato: [input, [NOMBRES], [descripciones], [urls]]
            // Si hay algún resultado, cogemos el primero (el más probable)
            if (searchData[1].length > 0) {
                searchName = searchData[1][0];
            } else {
                // Si Wikipedia no encuentra nada con ese nombre, nos rendimos
                return null;
            }
        }

        // 3. PEDIMOS LA FOTO USANDO EL NOMBRE OFICIAL ENCONTRADO
        const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(searchName)}`;
        const res = await fetch(summaryUrl);
        
        if (!res.ok) return null;
        
        const data = await res.json();
        
        // Devolvemos la foto si existe
        return data.thumbnail?.source || null;

    } catch (e) {
        console.warn("Error recuperando foto wiki:", e);
        return null;
    }
}

// --- RENDER UI ---
function renderArtistHeader(artist, photoUrl) {
    dom.artistName.textContent = artist.name;
    dom.artistListeners.textContent = parseInt(artist.stats.listeners).toLocaleString();
    dom.artistPlaycount.textContent = parseInt(artist.stats.playcount).toLocaleString();
    dom.artistBio.innerHTML = artist.bio.summary || "Sin información disponible.";
    
    // Imagen
    const finalPhoto = photoUrl || 'https://via.placeholder.com/500?text=No+Image';
    dom.artistImg.src = finalPhoto;
    
    // Efecto Background Inmersivo
    dom.artistHeaderBg.style.backgroundImage = `url('${finalPhoto}')`;

    // Tags
    dom.artistTags.innerHTML = '';
    const tags = Array.isArray(artist.tags.tag) ? artist.tags.tag : [artist.tags.tag];
    tags.slice(0, 4).forEach(tag => { // Solo mostramos los 4 primeros
        const span = document.createElement('span');
        span.textContent = tag.name;
        dom.artistTags.appendChild(span);
    });
}

function renderTracks(tracks) {
    dom.tracksList.innerHTML = '';
    const trackArray = Array.isArray(tracks) ? tracks : [tracks];

    trackArray.forEach((track, index) => {
        const li = document.createElement('li');
        li.className = 'track-item';
        li.innerHTML = `
            <span class="track-num">${index + 1}</span>
            <span class="track-name">${track.name}</span>
            <span class="track-plays">${parseInt(track.playcount).toLocaleString()}</span>
        `;
        dom.tracksList.appendChild(li);
    });
}

function renderSimilar(artists) {
    dom.similarGrid.innerHTML = '';
    const artistArray = Array.isArray(artists) ? artists : [artists];

    artistArray.forEach(artist => {
        const div = document.createElement('div');
        div.className = 'similar-card';
        div.innerHTML = `
            <img src="" alt="${artist.name}"> <p>${artist.name}</p>
        `;
        dom.similarGrid.appendChild(div);

        // Lazy load imagen similar
        fetchWikiImage(artist.name).then(img => {
            const src = img || 'https://via.placeholder.com/150?text=?';
            div.querySelector('img').src = src;
        });

        div.addEventListener('click', () => {
            dom.searchInput.value = artist.name;
            loadArtistData(artist.name);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
}

// --- GESTIÓN DE VISTAS ---
function toggleView(viewName) {
    // Ocultar todo primero
    dom.suggestionsView.classList.add('hidden');
    dom.mainContent.classList.add('hidden');
    dom.loading.classList.add('hidden');
    dom.errorMsg.classList.add('hidden');

    if (viewName === 'home') {
        dom.suggestionsView.classList.remove('hidden');
    } else if (viewName === 'detail') {
        dom.mainContent.classList.remove('hidden');
    } else if (viewName === 'loading') {
        dom.loading.classList.remove('hidden');
    }
}