/**
 * @jest-environment jsdom
 */

// --- 1. PREPARACIÓN DEL DOM (Simulamos el HTML necesario) ---
// Esto debe ir ANTES del require para que el JS encuentre los elementos
document.body.innerHTML = `
    <div class="logo"></div>
    <input id="search-input" />
    <button id="search-btn"></button>
    <div id="suggestions-view"></div>
    <div id="suggestions-grid"></div>
    <div id="main-content"></div>
    <div id="loading"></div>
    <div id="error-msg"></div>

    <div id="artist-header-bg"></div>
    <img id="artist-img" />
    <div id="artist-name"></div>
    <div id="artist-tags"></div>
    <div id="artist-listeners"></div>
    <div id="artist-playcount"></div>
    <div id="artist-bio"></div>
    <ul id="tracks-list"></ul>
    <div id="similar-grid"></div>

    <div id="audio-player-bar"></div>
    <div id="player-title"></div>
    <div id="player-artist"></div>
    <img id="player-img" />
    <button id="play-pause-btn"></button>
    <svg id="icon-play"></svg>
    <svg id="icon-pause"></svg>
    <input type="range" id="progress-bar" />
    <span id="current-time"></span>
    <input type="range" id="volume-slider" />
`;

// --- 2. IMPORTACIÓN DEL CÓDIGO (Ahora ya no fallará) ---
const { cleanTrackTitle, formatTime, BASE_URL } = require('../js/app.js');

// --- 3. LOS TESTS ---
describe('Pruebas de Lógica de Negocio (Unitarias)', () => {

    test('cleanTrackTitle debería limpiar paréntesis y guiones', () => {
        expect(cleanTrackTitle('Malamente (Cap.1: Augurio)')).toBe('Malamente');
        expect(cleanTrackTitle('Saoko - Radio Edit')).toBe('Saoko');
        expect(cleanTrackTitle('')).toBe('');
    });

    test('formatTime debería formatear segundos a mm:ss', () => {
        expect(formatTime(60)).toBe('1:00');
        expect(formatTime(65)).toBe('1:05');
        expect(formatTime(0)).toBe('0:00');
    });

    test('BASE_URL debe ser correcta para Last.fm', () => {
        expect(BASE_URL).toContain('ws.audioscrobbler.com');
    });
});

describe('Pruebas Asíncronas (Simuladas)', () => {
    test('Simulación de llamada a API debe resolver correctamente', async () => {
        const mockData = { artist: { name: 'Rosalia' } };
        
        // Mock global de fetch
        global.fetch = jest.fn(() =>
            Promise.resolve({
                json: () => Promise.resolve(mockData),
            })
        );

        // Hacemos una llamada fake para probar el mock
        const res = await fetch('https://fake-url.com');
        const data = await res.json();
        
        expect(data.artist.name).toBe('Rosalia');
        expect(fetch).toHaveBeenCalledTimes(1);
    });
});