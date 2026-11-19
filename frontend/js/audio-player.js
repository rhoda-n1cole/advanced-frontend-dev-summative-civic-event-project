/**
 * audio-player.js – accessible audio player built on HTML5 <audio>.
 * Big play/pause button, seek slider, current time / duration, volume,
 * playback speed, keyboard shortcuts, and fallback text + download link.
 *
 * Usage: AudioPlayer.mount('#player', { src, title })
 */
const AudioPlayer = {
  mount(container, { src, title }) {
    const uid = 'ap' + Math.random().toString(36).slice(2, 8);
    const $c = $(container).html(`
      <div class="rounded-2xl bg-gradient-to-br from-blue-700 to-indigo-800 p-5 text-white shadow-lg sm:p-6" role="group" aria-label="Audio player: ${UI.esc(title)}">
        <audio id="${uid}" preload="metadata">
          <source src="${UI.esc(src)}">
          Your browser can't play this audio format.
          <a href="${UI.esc(src)}" download>Download the audio file</a> instead.
        </audio>
        <div class="flex items-center gap-4">
          <button type="button" class="ap-play flex h-14 w-14 flex-none items-center justify-center rounded-full bg-white text-blue-800 shadow hover:scale-105 transition focus:outline-none focus:ring-4 focus:ring-white/60" aria-label="Play">
            <svg class="ap-icon-play h-7 w-7 translate-x-0.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
            <svg class="ap-icon-pause hidden h-7 w-7" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>
          </button>
          <div class="min-w-0 flex-1">
            <label for="${uid}-seek" class="sr-only">Seek</label>
            <input id="${uid}-seek" type="range" min="0" max="100" step="0.1" value="0" class="ap-seek w-full cursor-pointer accent-white" aria-valuetext="0:00 of 0:00">
            <div class="mt-1 flex justify-between text-sm tabular-nums text-blue-100" aria-hidden="true">
              <span class="ap-current">0:00</span><span class="ap-duration">0:00</span>
            </div>
          </div>
        </div>
        <div class="mt-4 flex flex-wrap items-center gap-4 text-sm">
          <button type="button" class="ap-back rounded-lg bg-white/15 px-3 py-1.5 font-medium hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white" aria-label="Back 10 seconds">⟲ 10s</button>
          <button type="button" class="ap-fwd rounded-lg bg-white/15 px-3 py-1.5 font-medium hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white" aria-label="Forward 10 seconds">10s ⟳</button>
          <label class="flex items-center gap-2">
            <span aria-hidden="true">🔊</span><span class="sr-only">Volume</span>
            <input type="range" min="0" max="1" step="0.05" value="1" class="ap-vol w-24 cursor-pointer accent-white">
          </label>
          <label class="flex items-center gap-2">
            <span>Speed</span>
            <select class="ap-rate rounded-md bg-white/15 px-2 py-1 text-white focus:outline-none focus:ring-2 focus:ring-white">
              <option class="text-slate-900" value="0.75">0.75×</option>
              <option class="text-slate-900" value="1" selected>1×</option>
              <option class="text-slate-900" value="1.25">1.25×</option>
              <option class="text-slate-900" value="1.5">1.5×</option>
            </select>
          </label>
          <a href="${UI.esc(src)}" download class="ml-auto rounded font-medium text-blue-100 underline hover:text-white focus:outline-none focus:ring-2 focus:ring-white">Download</a>
        </div>
        <p class="ap-status sr-only" aria-live="polite"></p>
        <p class="ap-error mt-3 hidden rounded-lg bg-red-600/90 px-3 py-2 text-sm" role="alert">This audio couldn't be played in your browser. Try the download link.</p>
      </div>`);

    const audio = $c.find('audio')[0];
    const $play = $c.find('.ap-play');
    const $seek = $c.find('.ap-seek');
    const fmt = UI.formatDuration;

    const sync = () => {
      const d = audio.duration || 0;
      $c.find('.ap-current').text(fmt(audio.currentTime));
      $c.find('.ap-duration').text(fmt(d));
      if (d) $seek.val((audio.currentTime / d) * 100);
      $seek.attr('aria-valuetext', `${fmt(audio.currentTime)} of ${fmt(d)}`);
    };
    const setPlaying = playing => {
      $play.attr('aria-label', playing ? 'Pause' : 'Play');
      $c.find('.ap-icon-play').toggleClass('hidden', playing);
      $c.find('.ap-icon-pause').toggleClass('hidden', !playing);
      $c.find('.ap-status').text(playing ? 'Playing' : 'Paused');
    };

    $(audio).on('loadedmetadata timeupdate', sync)
      .on('play', () => setPlaying(true))
      .on('pause ended', () => setPlaying(false))
      .on('error', () => $c.find('.ap-error').removeClass('hidden'));
    $c.find('source').on('error', () => $c.find('.ap-error').removeClass('hidden'));

    $play.on('click', () => (audio.paused ? audio.play().catch(() => $c.find('.ap-error').removeClass('hidden')) : audio.pause()));
    $seek.on('input', function () { if (audio.duration) audio.currentTime = (this.value / 100) * audio.duration; });
    $c.find('.ap-back').on('click', () => { audio.currentTime = Math.max(0, audio.currentTime - 10); });
    $c.find('.ap-fwd').on('click', () => { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10); });
    $c.find('.ap-vol').on('input', function () { audio.volume = this.value; });
    $c.find('.ap-rate').on('change', function () { audio.playbackRate = Number(this.value); });

    // Keyboard: space/k = play-pause, ←/→ = 5s, when focus is inside the player
    $c.on('keydown', e => {
      if ($(e.target).is('input[type=range], select')) return;
      if (e.key === ' ' || e.key === 'k') { e.preventDefault(); $play.trigger('click'); }
      if (e.key === 'ArrowLeft') audio.currentTime = Math.max(0, audio.currentTime - 5);
      if (e.key === 'ArrowRight') audio.currentTime += 5;
    });
    return audio;
  },

  /** Read an audio file's length (used on list cards, since the API has no duration field) */
  duration(src) {
    const d = $.Deferred();
    const a = new Audio();
    a.preload = 'metadata';
    a.onloadedmetadata = () => d.resolve(a.duration);
    a.onerror = () => d.reject();
    a.src = src;
    return d.promise();
  },
};
