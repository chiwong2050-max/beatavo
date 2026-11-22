/**
 * Beatavo — Dance challenge.
 * Plays 5 random videos back to back with a 3-2-1 countdown between songs,
 * then shows a finish screen. No accounts: the only stored value is a local
 * streak counter in localStorage.
 */
import { loadVideos } from './data.js';
import { initI18n, t } from './i18n.js';
import './theme.js';
import './install-prompt.js';

const CHALLENGE_SIZE = 5;
const STREAK_KEY = 'beatavo:challenge-streak';

const introView = document.getElementById('introView');
const playView = document.getElementById('playView');
const finishView = document.getElementById('finishView');
const introStreak = document.getElementById('introStreak');
const finishStreak = document.getElementById('finishStreak');
const startBtn = document.getElementById('startBtn');
const againBtn = document.getElementById('againBtn');
const stage = document.getElementById('stage');
const countdown = document.getElementById('countdown');
const countdownNum = document.getElementById('countdownNum');
const progressText = document.getElementById('progressText');
const nowPlaying = document.getElementById('nowPlaying');
const finishTitle = document.getElementById('finishTitle');

let videos = [];
let picks = [];
let index = 0;
let player = null;
let apiPromise = null;
let errorStreak = 0;
let running = false;
let countdownTimer = null;

/* ------------------------------------------------------------------ streak */
function dayKey(offsetDays = 0) {
  return new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);
}

function readStreak() {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    const data = raw ? JSON.parse(raw) : null;
    if (data && typeof data.count === 'number' && typeof data.date === 'string') return data;
  } catch {
    /* private mode */
  }
  return { count: 0, date: '' };
}

function streakLabel() {
  const { count } = readStreak();
  return count > 0 ? t('challenge_streak', { n: count }) : t('challenge_streak_none');
}

/** Count a completed challenge once per day; consecutive days build the streak. */
function bumpStreak() {
  const today = dayKey(0);
  const streak = readStreak();
  if (streak.date === today) return streak;
  const count = streak.date === dayKey(-1) ? streak.count + 1 : 1;
  const next = { count, date: today };
  try {
    localStorage.setItem(STREAK_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

/* ------------------------------------------------------------------- views */
function showView(name) {
  introView.hidden = name !== 'intro';
  playView.hidden = name !== 'play';
  finishView.hidden = name !== 'finish';
}

/* ---------------------------------------------------------------- YT setup */
function ensureApi() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previous === 'function') previous();
      resolve();
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    document.head.appendChild(s);
  });
  return apiPromise;
}

/* --------------------------------------------------------- challenge logic */
function pickRandom(list, n) {
  const copy = list.slice();
  const out = [];
  while (out.length < n && copy.length) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
}

function updateNowPlaying() {
  const video = picks[index];
  if (!video) return;
  progressText.textContent = t('challenge_song_of', { n: index + 1, total: picks.length });
  nowPlaying.textContent = video.title;
}

function advance() {
  index += 1;
  const video = picks[index];
  if (!video) {
    finish();
    return;
  }
  updateNowPlaying();
  if (player && typeof player.loadVideoById === 'function') {
    player.loadVideoById(video.id);
  } else {
    startChallenge();
  }
}

/** Show "Get ready" then 3-2-1, then play the next song. */
function runCountdown() {
  countdown.hidden = false;
  let n = 3;
  countdownNum.textContent = String(n);
  const tick = () => {
    n -= 1;
    if (n > 0) {
      countdownNum.textContent = String(n);
      countdownTimer = setTimeout(tick, 1000);
    } else {
      countdown.hidden = true;
      countdownTimer = null;
      advance();
    }
  };
  countdownTimer = setTimeout(tick, 1000);
}

function onSongEnded() {
  if (!running) return;
  if (index >= picks.length - 1) {
    finish();
    return;
  }
  runCountdown();
}

function finish() {
  running = false;
  if (countdownTimer) {
    clearTimeout(countdownTimer);
    countdownTimer = null;
  }
  countdown.hidden = true;
  if (player && typeof player.stopVideo === 'function') {
    try {
      player.stopVideo();
    } catch {
      /* ignore */
    }
  }
  const streak = bumpStreak();
  introStreak.textContent = t('challenge_streak', { n: streak.count });
  finishStreak.textContent = t('challenge_streak', { n: streak.count });
  showView('finish');
  finishTitle.focus();
}

function setupPlayer(videoId) {
  player = new window.YT.Player('ytPlayer', {
    videoId,
    host: 'https://www.youtube-nocookie.com',
    playerVars: {
      autoplay: 1,
      rel: 0,
      modestbranding: 1,
      playsinline: 1,
      origin: location.origin,
    },
    events: {
      onReady: (e) => e.target.playVideo(),
      onStateChange: (e) => {
        if (e.data === window.YT.PlayerState.ENDED) onSongEnded();
      },
      onError: () => {
        // Skip unplayable videos, but never spin forever.
        errorStreak += 1;
        if (errorStreak > picks.length) finish();
        else advance();
      },
    },
  });
}

async function startChallenge() {
  if (videos.length === 0) return;
  picks = pickRandom(videos, CHALLENGE_SIZE);
  index = 0;
  errorStreak = 0;
  running = true;
  updateNowPlaying();
  showView('play');
  stage.innerHTML = '<div id="ytPlayer"></div>';
  await ensureApi();
  setupPlayer(picks[0].id);
}

/* ------------------------------------------------------------------- init */
async function init() {
  await initI18n();
  introStreak.textContent = streakLabel();

  try {
    videos = await loadVideos('../data/videos.json');
  } catch {
    videos = [];
  }
  startBtn.disabled = videos.length === 0;
}

startBtn.addEventListener('click', startChallenge);
againBtn.addEventListener('click', startChallenge);

/* ---- Service worker ---- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('../sw.js').catch(() => {
      /* offline support is a progressive enhancement */
    });
  });
}

init();
