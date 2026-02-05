/**
 * @jest-environment jsdom
 */

// ================= HTML MOCK =================
const INITIAL_HTML = `
<nav>
  <div class="logo">MUSIK.AI</div>
  <div class="search-container">
    <input type="text" id="search-input" />
    <button id="search-btn">🔍</button>
  </div>
</nav>

<div id="loading" class="hidden">Loading...</div>
<div id="error-msg" class="hidden">Error</div>

<div id="suggestions-view">
  <div id="suggestions-grid"></div>
</div>

<div id="main-content" class="hidden">
  <div id="artist-header-bg"></div>
  <img id="artist-img" />
  <h1 id="artist-name"></h1>
  <div id="artist-tags"></div>
  <span id="artist-listeners"></span>
  <span id="artist-playcount"></span>
  <div id="artist-bio"></div>
  <ul id="tracks-list"></ul>
  <div id="similar-grid"></div>
</div>

<div id="audio-player-bar" class="hidden">
  <img id="player-img" />
  <div id="player-title"></div>
  <div id="player-artist"></div>
  <button id="play-pause-btn">
    <span id="icon-play"></span>
    <span id="icon-pause" class="hidden"></span>
  </button>
  <input id="progress-bar" type="range" value="0" />
  <span id="current-time"></span>
  <input id="volume-slider" type="range" value="1" />
</div>
`;

window.scrollTo = jest.fn();

// ================= AUDIO MOCK =================
class AudioMock {
  constructor() {
    this.src = '';
    this.paused = true;
    this.currentTime = 0;
    this.duration = 200;
    this.volume = 1;
    this.listeners = {};
  }
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  addEventListener(evt, cb) {
    this.listeners[evt] = cb;
  }
  trigger(evt) {
    if (this.listeners[evt]) this.listeners[evt]();
  }
}
global.Audio = AudioMock;

const flushPromises = () => new Promise(r => setTimeout(r, 0));

describe('APP – Cobertura 100%', () => {
  let app;

  beforeEach(async () => {
    jest.resetModules();
    document.body.innerHTML = INITIAL_HTML;

    global.fetch = jest.fn((url) => {
      const u = url.toString();

      if (u.includes('artist.getinfo')) {
        return Promise.resolve({
          json: () => Promise.resolve({
            artist: {
              name: 'Queen',
              stats: { listeners: 100, playcount: 50 },
              bio: { summary: 'Bio' },
              tags: { tag: [{ name: 'Rock' }] }
            }
          })
        });
      }

      if (u.includes('artist.gettoptracks')) {
        return Promise.resolve({
          json: () => Promise.resolve({
            toptracks: { track: [{ name: 'Bohemian', playcount: 1000 }] }
          })
        });
      }

      if (u.includes('artist.getsimilar')) {
        return Promise.resolve({
          json: () => Promise.resolve({
            similarartists: { artist: [{ name: 'David Bowie' }] }
          })
        });
      }

      if (u.includes('opensearch')) {
        return Promise.resolve({ json: () => Promise.resolve(['', ['Queen']]) });
      }

      if (u.includes('summary')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ thumbnail: { source: 'img.jpg' } })
        });
      }

      return Promise.resolve({ json: () => Promise.resolve({}) });
    });

    app = require('../js/app.js');
    app.setAudioState(new AudioMock(), false);
    app.initApp();
    await flushPromises();
  });

  test('helpers: cleanTrackTitle & formatTime', () => {
    expect(app.cleanTrackTitle('Song (Live)')).toBe('Song');
    expect(app.formatTime(125)).toBe('2:05');
    expect(app.formatTime(-1)).toBe('0:00');
  });

  test('render suggestions + click invokes loadArtistData', () => {
    const grid = document.getElementById('suggestions-grid');
    expect(grid.children.length).toBeGreaterThan(0);

    const spy = jest.spyOn(app, 'loadArtistData').mockImplementation(() => {});
    grid.children[0].click();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  test('search flow renders artist, tracks and similars', async () => {
    document.getElementById('search-input').value = 'Queen';
    document.getElementById('search-btn').click();

    await flushPromises();

    expect(document.getElementById('artist-name').textContent).toBe('Queen');
    expect(document.querySelectorAll('.track-item').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.similar-card').length).toBeGreaterThan(0);
  });

  test('error fetch shows error message', async () => {
    global.fetch.mockImplementationOnce(() => Promise.reject('fail'));
    await app.loadArtistData('Fail');
    await flushPromises();
    expect(document.getElementById('error-msg').classList.contains('hidden')).toBe(false);
  });

  test('player controls: play/pause, volume, progress and ended', () => {
    app.setupPlayerEvents();
    const { currentAudio } = app.getAudioState();

    currentAudio.src = 'test.mp3';
    document.getElementById('play-pause-btn').click();
    expect(currentAudio.paused).toBe(false);

    // volume slider sets string value on audio in many implementations
    document.getElementById('volume-slider').value = 0.4;
    document.getElementById('volume-slider').dispatchEvent(new Event('input'));
    expect(String(currentAudio.volume)).toBe('0.4');

    document.getElementById('progress-bar').value = 50;
    document.getElementById('progress-bar').dispatchEvent(new Event('input'));
    expect(currentAudio.currentTime).toBe(100);

    currentAudio.trigger('ended');
    expect(app.getAudioState().isPlaying).toBe(false);
  });

  test('fetchWikiImage usa summary y devuelve thumbnail', async () => {
    const thumb = await app.fetchWikiImage('Queen');
    expect(thumb).toBe('img.jpg');
  });

  test('fetchDeezer JSONP resuelve correctamente y limpia callback', async () => {
    const originalAppend = document.body.appendChild;
    const appendSpy = jest.spyOn(document.body, 'appendChild').mockImplementation((script) => {
      const src = script.src || '';
      const match = src.match(/callback=([^&]+)/);
      if (match) {
        const cbName = decodeURIComponent(match[1]);
        if (window[cbName]) {
          // simular respuesta JSONP
          window[cbName]({ data: [{ preview: 'x.mp3', album: { cover_medium: 'c.jpg' } }] });
        }
      }
      return script;
    });

    const data = await app.fetchDeezer('https://api.deezer.com/search?q=test');
    expect(data).toBeDefined();
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data[0].preview).toBe('x.mp3');

    appendSpy.mockRestore();
    document.body.appendChild = originalAppend;
  });

  test('fetchDeezer rechaza cuando el script dispara onerror', async () => {
    const appendSpy = jest.spyOn(document.body, 'appendChild').mockImplementation((script) => {
      if (script.onerror) script.onerror(new Error('load error'));
      return script;
    });

    await expect(app.fetchDeezer('https://api.deezer.com/search?q=err')).rejects.toBeTruthy();
    appendSpy.mockRestore();
  });

  test('renderSimilar crea tarjetas y el click llama loadArtistData', async () => {
    const spy = jest.spyOn(app, 'loadArtistData').mockImplementation(() => {});
    // pasar array con objeto
    await app.renderSimilar([{ name: 'Leiva' }]);
    await flushPromises();

    const card = document.querySelector('.similar-card');
    expect(card).toBeDefined();
    const img = card.querySelector('img');
    expect(img).toBeDefined();
    // al menos tener un src (puede ser absoluta por jsdom) -> comprobar que no está vacío
    expect(img.src.length).toBeGreaterThan(0);

    card.click();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  test('setupPlayerEvents no lanza si faltan elementos (guard clause)', () => {
    const playBtn = document.getElementById('play-pause-btn');
    const prog = document.getElementById('progress-bar');

    const parentPlay = playBtn.parentNode;
    parentPlay.removeChild(playBtn);
    const parentProg = prog.parentNode;
    parentProg.removeChild(prog);

    expect(() => app.setupPlayerEvents()).not.toThrow();

    parentPlay.appendChild(playBtn);
    parentProg.appendChild(prog);
  });

  test('updatePlayIcon actualiza iconos según isPlaying', () => {
    app.setAudioState(new AudioMock(), true);
    app.updatePlayIcon();
    expect(document.getElementById('icon-play').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('icon-pause').classList.contains('hidden')).toBe(false);

    app.setAudioState(new AudioMock(), false);
    app.updatePlayIcon();
    expect(document.getElementById('icon-play').classList.contains('hidden')).toBe(false);
    expect(document.getElementById('icon-pause').classList.contains('hidden')).toBe(true);
  });
});
