/**
 * charts.js – lightweight, accessible charts with plain HTML/CSS (no chart library,
 * to stay within the HTML + Tailwind + jQuery stack). Every chart also renders a
 * screen-reader table with the same numbers.
 */
const Charts = {
  COLORS: ['#1d4ed8', '#7c3aed', '#0891b2', '#059669', '#d97706', '#db2777'],

  srTable(caption, rows) {
    return `<table class="sr-only"><caption>${UI.esc(caption)}</caption>
      <thead><tr><th scope="col">Item</th><th scope="col">Value</th></tr></thead>
      <tbody>${rows.map(r => `<tr><th scope="row">${UI.esc(r.label)}</th><td>${r.value}</td></tr>`).join('')}</tbody></table>`;
  },

  /** Horizontal bar chart: rows = [{ label, value }] */
  bars(container, rows, caption) {
    const max = Math.max(1, ...rows.map(r => r.value));
    $(container).html(`
      <div aria-hidden="true" class="space-y-3">
        ${rows.map((r, i) => `
          <div>
            <div class="flex justify-between text-sm"><span class="font-medium text-slate-700">${UI.esc(r.label)}</span><span class="font-semibold tabular-nums">${r.value}</span></div>
            <div class="mt-1 h-3 overflow-hidden rounded-full bg-slate-100">
              <div class="h-full rounded-full transition-all duration-700" style="width:0;background:${Charts.COLORS[i % Charts.COLORS.length]}" data-w="${(r.value / max) * 100}%"></div>
            </div>
          </div>`).join('')}
      </div>${Charts.srTable(caption, rows)}`);
    requestAnimationFrame(() => $(container).find('[data-w]').each(function () { this.style.width = this.dataset.w; }));
  },

  /** Vertical column chart for time series: rows = [{ label, value }] */
  columns(container, rows, caption) {
    if (!rows.length) { $(container).html('<p class="text-slate-600">No new users in this period.</p>'); return; }
    const max = Math.max(1, ...rows.map(r => r.value));
    $(container).html(`
      <div aria-hidden="true" class="flex h-48 items-end gap-3 border-b border-slate-200 pb-1">
        ${rows.map(r => `
          <div class="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span class="text-sm font-semibold tabular-nums">${r.value}</span>
            <div class="w-full max-w-[3rem] rounded-t-md bg-blue-700 transition-all duration-700" style="height:0" data-h="${Math.max(4, (r.value / max) * 85)}%"></div>
          </div>`).join('')}
      </div>
      <div aria-hidden="true" class="mt-2 flex gap-3">${rows.map(r => `<span class="flex-1 text-center text-xs text-slate-600">${UI.esc(r.label)}</span>`).join('')}</div>
      ${Charts.srTable(caption, rows)}`);
    requestAnimationFrame(() => $(container).find('[data-h]').each(function () { this.style.height = this.dataset.h; }));
  },

  /** Donut chart: rows = [{ label, value }] */
  donut(container, rows, caption) {
    const total = rows.reduce((s, r) => s + r.value, 0);
    let acc = 0;
    const stops = rows.map((r, i) => {
      const from = total ? (acc / total) * 100 : 0;
      acc += r.value;
      const to = total ? (acc / total) * 100 : 0;
      return `${Charts.COLORS[(i * 3) % Charts.COLORS.length]} ${from}% ${to}%`;
    }).join(', ');
    $(container).html(`
      <div aria-hidden="true" class="flex flex-wrap items-center gap-6">
        <div class="relative h-36 w-36 rounded-full" style="background:${total ? `conic-gradient(${stops})` : '#e2e8f0'}">
          <div class="absolute inset-5 flex flex-col items-center justify-center rounded-full bg-white">
            <span class="text-2xl font-bold">${total}</span><span class="text-xs text-slate-600">total</span>
          </div>
        </div>
        <ul class="space-y-2">${rows.map((r, i) => `
          <li class="flex items-center gap-2 text-sm"><span class="h-3 w-3 rounded-sm" style="background:${Charts.COLORS[(i * 3) % Charts.COLORS.length]}"></span>
            ${UI.esc(r.label)}: <strong>${r.value}</strong> ${total ? `(${Math.round((r.value / total) * 100)}%)` : ''}</li>`).join('')}
        </ul>
      </div>${Charts.srTable(caption, rows)}`);
  },
};
