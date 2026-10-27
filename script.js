// =====================================================
//  WaveTune - simple music player
// =====================================================

// ---------- 1. DATA ----------
const songs = [
  { title: "Neon Skyline",    artist: "Jrma",       genre: "Pop",          c1: 190, c2: 310, bpm: 118 },
  { title: "Bionic Gearbox",  artist: "Kael Voss",  genre: "Electronic",   c1: 280, c2: 200, bpm: 128 },
  { title: "Rock Rate",       artist: "Dax Monroe", genre: "Rock",         c1: 350, c2: 20,  bpm: 140 },
  { title: "Beach Playlist",  artist: "Luna Reyes", genre: "Chill",        c1: 200, c2: 150, bpm: 84  },
  { title: "Fasting Blush",   artist: "Amir Nasir", genre: "Pop",          c1: 30,  c2: 330, bpm: 108 },
  { title: "Midnight Echo",   artist: "Jrma",       genre: "Hip Hop",      c1: 260, c2: 320, bpm: 92  },
  { title: "Teal Hush",       artist: "Corin Bay",  genre: "Chill",        c1: 180, c2: 230, bpm: 76  },
  { title: "Man Wheel",       artist: "Zed Hart",   genre: "Rock",         c1: 270, c2: 340, bpm: 150 },
  { title: "Glass Rain",      artist: "Noor Ali",   genre: "Instrumental", c1: 210, c2: 260, bpm: 70  },
  { title: "Pulse Drive",     artist: "Kael Voss",  genre: "Electronic",   c1: 300, c2: 190, bpm: 132 },
  { title: "Concrete Dreams", artist: "Dax Monroe", genre: "Hip Hop",      c1: 20,  c2: 280, bpm: 88  },
  { title: "Paper Moon",      artist: "Luna Reyes", genre: "Instrumental", c1: 240, c2: 170, bpm: 66  }
];

const genres = ["All Music", "Pop", "Rock", "Hip Hop", "Electronic", "Chill", "Instrumental"];

// each playlist is just a list of song numbers
const playlists = [
  { name: "Neon Nights",      ids: [0, 1, 9, 5] },
  { name: "Chill Vibes",      ids: [3, 6, 8, 11] },
  { name: "Rock & Roll Fuel", ids: [2, 7, 10, 4] }
];

// ---------- 2. STATE (things that change) ----------
let current = 0;                 // song now loaded
let queue = songs.map((s, i) => i);   // order of songs to play
let view = "home";               // home / discover / playlists / favorites / recent
let genre = "All Music";
let searchText = "";
let shuffle = false;
let repeat = 0;                  // 0 = off, 1 = repeat all, 2 = repeat one
let favorites = JSON.parse(localStorage.getItem("wtFav") || "[]");
let recent = JSON.parse(localStorage.getItem("wtRecent") || "[]");

const audio = new Audio();
audio.volume = 0.7;

// ---------- 3. SHORTCUTS ----------
const $ = id => document.getElementById(id);

function formatTime(sec) {
  if (!sec) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ":" + (s < 10 ? "0" : "") + s;
}

function showMessage(text) {
  $("message").textContent = text;
  $("message").classList.add("show");
  setTimeout(() => $("message").classList.remove("show"), 1800);
}

// cover = colorful gradient + person emoji
function coverStyle(i) {
  const s = songs[i];
  return `linear-gradient(160deg, hsl(${s.c1},90%,55%), hsl(${s.c2},85%,60%))`;
}
function setCover(el, i) {
  el.style.backgroundImage = coverStyle(i);
  el.textContent = "🎧";
}

// fill the blue part of a slider
function fillSlider(slider) {
  const p = slider.value / slider.max * 100;
  slider.style.background = `linear-gradient(90deg, #12d8fa ${p}%, #2a3956 ${p}%)`;
}

// ---------- 4. MAKE SOUND (no mp3 files needed) ----------
// builds a small 30 second tune for each song and returns a playable url
const sounds = {};

function makeSound(i) {
  if (sounds[i]) return sounds[i];

  const rate = 8000, seconds = 30;
  const total = rate * seconds;
  const notes = [220, 247, 262, 294, 330, 392, 440, 494];   // pitches (Hz)
  const noteLength = 60 / songs[i].bpm / 2;                  // seconds per note
  const samples = new Int16Array(total);

  for (let n = 0; n < total; n++) {
    const t = n / rate;
    const step = Math.floor(t / noteLength);
    const pitch = notes[(step * (i + 3) + (step >> 2)) % 8];
    const fade = Math.exp(-(t % noteLength) * 6);            // each note fades out
    samples[n] = Math.sin(2 * Math.PI * pitch * t) * fade * 9000;
  }

  // wrap samples in a WAV file header
  const buffer = new ArrayBuffer(44 + total * 2);
  const v = new DataView(buffer);
  const text = (pos, str) => { for (let k = 0; k < str.length; k++) v.setUint8(pos + k, str.charCodeAt(k)); };
  text(0, "RIFF");  v.setUint32(4, 36 + total * 2, true);
  text(8, "WAVEfmt "); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);  v.setUint16(34, 16, true);
  text(36, "data"); v.setUint32(40, total * 2, true);
  samples.forEach((x, k) => v.setInt16(44 + k * 2, x, true));

  sounds[i] = URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
  return sounds[i];
}

// ---------- 5. PLAYER FUNCTIONS ----------
function loadSong(i, autoPlay) {
  current = i;
  audio.src = makeSound(i);
  if (autoPlay) {
    audio.play();
    recent = [i, ...recent.filter(x => x !== i)].slice(0, 12);
    localStorage.setItem("wtRecent", JSON.stringify(recent));
  }
  updatePlayerInfo();
  showSongs();
}

function playList(ids, startId) {
  queue = ids.slice();
  loadSong(startId === undefined ? ids[0] : startId, true);
}

function playPause() {
  if (audio.paused) audio.play();
  else audio.pause();
}

function nextSong(direction) {
  const pos = queue.indexOf(current);
  let nextId;
  if (shuffle) {
    nextId = queue[Math.floor(Math.random() * queue.length)];
  } else {
    nextId = queue[(pos + direction + queue.length) % queue.length];
  }
  loadSong(nextId, true);
}

// when a song finishes
audio.onended = () => {
  if (repeat === 2) {                       // repeat one
    audio.currentTime = 0;
    audio.play();
  } else if (repeat === 0 && !shuffle && queue.indexOf(current) === queue.length - 1) {
    updatePlayButton();                      // end of list, just stop
  } else {
    nextSong(1);
  }
};

audio.onplay = audio.onpause = () => { updatePlayButton(); showSongs(); };

// runs many times per second while playing
audio.ontimeupdate = () => {
  const percent = audio.duration ? audio.currentTime / audio.duration : 0;
  $("seekBar").value = percent * 100;
  fillSlider($("seekBar"));
  $("timeNow").textContent = formatTime(audio.currentTime);
  $("timeLeft").textContent = "-" + formatTime(audio.duration - audio.currentTime);
  drawWave(percent);
};

// ---------- 6. BUTTONS ----------
$("playBtn").onclick = playPause;
$("panelCover").onclick = playPause;
$("nextBtn").onclick = () => nextSong(1);
$("prevBtn").onclick = () => {
  if (audio.currentTime > 3) audio.currentTime = 0;   // restart song
  else nextSong(-1);
};

$("shuffleBtn").onclick = () => {
  shuffle = !shuffle;
  $("shuffleBtn").classList.toggle("on", shuffle);
  showMessage("Shuffle " + (shuffle ? "on" : "off"));
};

$("repeatBtn").onclick = () => {
  repeat = (repeat + 1) % 3;
  $("repeatBtn").classList.toggle("on", repeat > 0);
  showMessage(["Repeat off", "Repeat all", "Repeat one"][repeat]);
};

// seek bar (drag to jump)
$("seekBar").oninput = () => {
  if (audio.duration) audio.currentTime = $("seekBar").value / 100 * audio.duration;
};

// volume
$("volumeBar").oninput = () => {
  audio.volume = $("volumeBar").value / 100;
  audio.muted = false;
  fillSlider($("volumeBar"));
  updateVolumeIcon();
};
$("muteBtn").onclick = () => {
  audio.muted = !audio.muted;
  updateVolumeIcon();
};
function updateVolumeIcon() {
  $("muteBtn").textContent = (audio.muted || audio.volume === 0) ? "🔇" : "🔊";
}

// favorite
$("favBtn").onclick = () => {
  if (favorites.includes(current)) {
    favorites = favorites.filter(x => x !== current);
    showMessage("Removed from Favorites");
  } else {
    favorites.push(current);
    showMessage("Added to Favorites");
  }
  localStorage.setItem("wtFav", JSON.stringify(favorites));
  updateFavButton();
  if (view === "favorites") showSongs();
};

// queue popup
$("queueBtn").onclick = (e) => {
  e.stopPropagation();
  $("queueBox").classList.toggle("show");
};
document.onclick = (e) => {
  if (!$("queueBox").contains(e.target)) $("queueBox").classList.remove("show");
};
function showQueue() {
  $("queueBox").innerHTML = "<b>Up next</b>" + queue.map(id =>
    `<div class="${id === current ? "current" : ""}" data-id="${id}">${songs[id].title}</div>`
  ).join("");
  $("queueBox").querySelectorAll("div").forEach(el => {
    el.onclick = () => loadSong(Number(el.dataset.id), true);
  });
}

// keyboard: space = play/pause, arrows = skip 5 seconds
document.onkeydown = (e) => {
  if (e.target.tagName === "INPUT" && e.target.type === "text") return;
  if (e.code === "Space") { e.preventDefault(); playPause(); }
  if (e.code === "ArrowRight") audio.currentTime += 5;
  if (e.code === "ArrowLeft") audio.currentTime -= 5;
};

$("settingsBtn").onclick = () => showMessage("Space = play/pause, ← → = seek 5s");

// ---------- 7. WAVEFORM ----------
function makeWave() {
  let html = "";
  for (let k = 0; k < 60; k++) {
    const h = 15 + Math.abs(Math.sin(k / 4 + current)) * 85;   // height in %
    html += `<div style="height:${h}%"></div>`;
  }
  $("wave").innerHTML = html;
}
function drawWave(percent) {
  const bars = $("wave").children;
  for (let k = 0; k < bars.length; k++) {
    bars[k].classList.toggle("done", k / bars.length < percent);
  }
}
$("wave").onclick = (e) => {
  if (!audio.duration) return;
  const box = $("wave").getBoundingClientRect();
  audio.currentTime = (e.clientX - box.left) / box.width * audio.duration;
};

// ---------- 8. UPDATE THE SCREEN ----------
function updatePlayButton() {
  const icon = audio.paused ? "▶" : "⏸";
  $("playBtn").textContent = icon;
}

function updateFavButton() {
  const isFav = favorites.includes(current);
  $("favBtn").classList.toggle("on", isFav);
  $("favBtn").textContent = (isFav ? "♥" : "♡") + " Favorite";
}

function updatePlayerInfo() {
  const s = songs[current];
  $("panelTitle").textContent = s.title;
  $("barTitle").textContent = s.title;
  $("panelArtist").textContent = "Artist " + s.artist;
  $("barArtist").textContent = "Artist " + s.artist;
  setCover($("panelCover"), current);
  setCover($("barCover"), current);
  $("timeNow").textContent = "0:00";
  $("timeLeft").textContent = "-0:30";
  makeWave();
  updateFavButton();
  updatePlayButton();
  showQueue();
}

// the list of songs depends on menu, genre and search
function getVisibleSongs() {
  let ids = songs.map((s, i) => i);

  if (view === "home")      ids = ids.slice(0, 8);
  if (view === "favorites") ids = favorites.slice();
  if (view === "recent")    ids = recent.slice();
  if (view === "discover")  ids = ids.slice().reverse();

  // when searching or filtering on Home, look at all songs
  if (view === "home" && (searchText || genre !== "All Music")) ids = songs.map((s, i) => i);

  if (genre !== "All Music") ids = ids.filter(i => songs[i].genre === genre);

  if (searchText) {
    const q = searchText.toLowerCase();
    ids = ids.filter(i => (songs[i].title + songs[i].artist + songs[i].genre).toLowerCase().includes(q));
  }
  return ids;
}

function showSongs() {
  const ids = getVisibleSongs();
  const titles = { home: "Trending Songs", discover: "Discover", favorites: "Favorites", recent: "Recently Played" };
  $("listTitle").textContent = titles[view] || "Songs";

  if (ids.length === 0) {
    $("songList").innerHTML = `<p class="empty">No songs here yet.</p>`;
    return;
  }

  $("songList").innerHTML = ids.map(i => {
    const s = songs[i];
    const isPlaying = (i === current && !audio.paused);
    return `
      <div class="song ${i === current ? "playing" : ""}" data-id="${i}">
        <div class="cover mini" style="background-image:${coverStyle(i)}">🎧</div>
        <div class="info"><b>${s.title}</b><small>${s.artist} · ${s.genre}</small></div>
        <div class="go">${isPlaying ? "⏸" : "▶"}</div>
      </div>`;
  }).join("");

  // click on a song
  $("songList").querySelectorAll(".song").forEach(el => {
    el.onclick = () => {
      const id = Number(el.dataset.id);
      if (id === current && audio.src) playPause();
      else playList(ids, id);
    };
  });
}

function showPlaylists() {
  $("playlistList").innerHTML = playlists.map((p, n) => `
    <div class="playlist" data-n="${n}">
      <div class="mosaic">
        ${p.ids.slice(0, 4).map(i => `<div class="cover" style="background-image:${coverStyle(i)}">🎧</div>`).join("")}
      </div>
      <div><b>${p.name}</b><small>${p.ids.length} songs</small></div>
    </div>`).join("");

  $("playlistList").querySelectorAll(".playlist").forEach(el => {
    el.onclick = () => {
      const p = playlists[Number(el.dataset.n)];
      playList(p.ids);
      showMessage("Playing " + p.name);
    };
  });
}

// ---------- 9. MENU, CHIPS, SEARCH, HERO ----------
$("menu").onclick = (e) => {
  const btn = e.target.closest("button[data-view]");
  if (!btn) return;

  document.querySelectorAll("#menu button").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  view = btn.dataset.view;

  // show / hide parts of the page
  const onlyPlaylists = (view === "playlists");
  $("hero").style.display        = (view === "home") ? "" : "none";
  $("playlistBox").style.display = (view === "home" || onlyPlaylists) ? "" : "none";
  $("chips").style.display       = onlyPlaylists ? "none" : "";
  $("listTitle").style.display   = onlyPlaylists ? "none" : "";
  $("songList").style.display    = onlyPlaylists ? "none" : "";

  showSongs();
};

// genre chips
$("chips").innerHTML = genres.map(g =>
  `<button class="chip ${g === "All Music" ? "active" : ""}">${g}</button>`).join("");

$("chips").onclick = (e) => {
  if (!e.target.classList.contains("chip")) return;
  genre = e.target.textContent;
  document.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
  e.target.classList.add("active");
  showSongs();
};

// search box
$("searchBox").oninput = () => {
  searchText = $("searchBox").value.trim();
  showSongs();
};

// hero banner (first song is the featured one)
$("heroTitle").textContent = songs[0].title;
$("heroArtist").textContent = "Artist " + songs[0].artist;
setCover($("heroCover"), 0);

$("heroPlay").onclick = $("heroCover").onclick = () => playList(songs.map((s, i) => i), 0);

$("heroAdd").onclick = () => {
  let mine = playlists.find(p => p.name === "My Playlist");
  if (!mine) {
    mine = { name: "My Playlist", ids: [] };
    playlists.push(mine);
  }
  if (mine.ids.includes(0)) { showMessage("Already in My Playlist"); return; }
  mine.ids.push(0);
  showPlaylists();
  showMessage("Added to My Playlist");
};

// ---------- 10. START ----------
fillSlider($("volumeBar"));
fillSlider($("seekBar"));
showPlaylists();
loadSong(0, false);     // load first song but don't play yet
showSongs();
