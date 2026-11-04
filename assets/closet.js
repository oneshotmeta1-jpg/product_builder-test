// "My closet": photos and choices are kept in this browser's IndexedDB only. Nothing is uploaded.
// R7 flow: start guide (2 tops, 2 bottoms, 1 shoes) -> register with season -> today's situation -> 3 outfits -> pick one.
(function () {
  'use strict';
  var S = window.STYL, R = window.STYL_CLOSET, esc = S.esc;
  var $ = function (id) { return document.getElementById(id); };
  var form = $('closetForm');
  if (!form || !R) return;

  var MAX_ITEMS = 100, MAX_SIDE = 480, DB_VERSION = 2, ITEM_SCHEMA = 2;
  var GOAL = { top: 2, bottom: 2, shoes: 1 };              // the "first five photos"
  var db = null, items = [], urls = [], pending = null;    // pending: resized photo Blob waiting to be saved
  var situation = { formality: 'normal', weather: R.defaultWeather(), move: 'normal' };
  var chosen = null;                                        // the outfit picked for tomorrow
  var started = false;                                      // "추천 시작" pressed (or already used before)
  var shown = [];                                           // the 3 outfits on screen: {o, note}

  function status(msg) { $('formStatus').textContent = msg || ''; }
  // jump (no animation) right after a re-render: scrollIntoView forces layout, so the new position is exact,
  // and it does not depend on animation frames, which browsers pause for background tabs
  function goTo(el, block) {
    if (el) el.scrollIntoView({ block: block || 'start' });
  }

  /* ---------- form choices ---------- */
  function radio(name, value, label, extra) {
    return '<label class="choice relative text-center"><input type="radio" name="' + name + '" value="' + value + '">' +
      (extra || '') + '<b class="text-[13px]">' + esc(label) + '</b></label>';
  }
  $('catChoices').innerHTML = Object.keys(R.CATS).map(function (k) { return radio('cat', k, R.CATS[k]); }).join('');
  $('fitChoices').innerHTML = Object.keys(R.FITS).map(function (k) { return radio('fit', k, R.FITS[k]); }).join('');
  $('seasonChoices').innerHTML = Object.keys(R.SEASONS).map(function (k) { return radio('season', k, R.SEASONS[k]); }).join('');
  $('colorChoices').innerHTML = R.COLORS.map(function (c) {
    return radio('color', c.key, c.name, '<span class="block mx-auto mb-1 w-6 h-6 rounded-full border border-hairline-border" style="background:' + c.hex + '"></span>');
  }).join('');
  function val(name) { var el = form.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : ''; }
  function setVal(name, v) { var el = form.querySelector('input[name="' + name + '"][value="' + v + '"]'); if (el) el.checked = true; }
  setVal('season', 'all');

  /* ---------- IndexedDB (v2: items + meta) ---------- */
  function req(r) { return new Promise(function (ok, no) { r.onsuccess = function () { ok(r.result); }; r.onerror = function () { no(r.error); }; }); }
  function store(name, mode) { return db.transaction(name, mode).objectStore(name); }
  function openDB() {
    return new Promise(function (ok, no) {
      if (!window.indexedDB) { no(new Error('no indexedDB')); return; }
      var r;
      try { r = indexedDB.open('stylai-closet', DB_VERSION); } catch (e) { no(e); return; }
      r.onupgradeneeded = function () {
        var d = r.result;
        if (!d.objectStoreNames.contains('items')) d.createObjectStore('items', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'key' });
      };
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { no(r.error); };
      r.onblocked = function () { no(new Error('blocked')); };
    });
  }
  function getMeta(key) { return req(store('meta', 'readonly').get(key)).then(function (r) { return r ? r.value : null; }); }
  function setMeta(key, value) { return req(store('meta', 'readwrite').put({ key: key, value: value })); }

  // items saved by R6 (no schema) get the new fields; the photo and choices are kept as they were
  function migrate(list) {
    var old = list.filter(function (it) { return (it.schema || 1) < ITEM_SCHEMA; });
    if (!old.length) return Promise.resolve(list);
    var st = store('items', 'readwrite');
    old.forEach(function (it) {
      it.schema = ITEM_SCHEMA;
      if (!it.season) it.season = 'all';
      if (typeof it.laundry !== 'boolean') it.laundry = false;
      if (!Array.isArray(it.worn)) it.worn = [];
      st.put(it);
    });
    return new Promise(function (ok) { st.transaction.oncomplete = function () { ok(list); }; st.transaction.onerror = function () { ok(list); }; });
  }
  function loadAll() { return req(store('items', 'readonly').getAll()).then(migrate); }

  /* ---------- photo: resize + colour ---------- */
  function readImage(file) {
    return new Promise(function (ok, no) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () { ok({ img: img, url: url }); };
      img.onerror = function () { URL.revokeObjectURL(url); no(new Error('decode')); };
      img.src = url;
    });
  }
  function resize(img) {
    var k = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    var c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return new Promise(function (ok, no) { c.toBlob(function (b) { b ? ok(b) : no(new Error('encode')); }, 'image/jpeg', 0.82); });
  }
  // Garment colour: read the background from the photo's border, then take the most common colour
  // in the middle 60% after skipping pixels that look like that background. Mapped to the palette.
  function extractColor(img) {
    var N = 64, c = document.createElement('canvas'); c.width = N; c.height = N;
    var g = c.getContext('2d'); g.drawImage(img, 0, 0, N, N);
    var all = g.getImageData(0, 0, N, N).data;
    function px(x, y) { var i = (y * N + x) * 4; return [all[i], all[i + 1], all[i + 2]]; }
    var bg = [0, 0, 0], bn = 0, x, y;
    for (y = 0; y < N; y++) for (x = 0; x < N; x++) {
      if (x > 2 && x < N - 3 && y > 2 && y < N - 3) continue;
      var p = px(x, y); bg[0] += p[0]; bg[1] += p[1]; bg[2] += p[2]; bn++;
    }
    bg = bg.map(function (v) { return v / bn; });
    function common(skipBg) {
      var buckets = {}, n = 0;
      for (y = Math.round(N * 0.2); y < Math.round(N * 0.8); y++) for (x = Math.round(N * 0.2); x < Math.round(N * 0.8); x++) {
        var p = px(x, y);
        if (skipBg && R.deltaE(p, bg) < 12) continue;
        var key = (p[0] >> 5) + '-' + (p[1] >> 5) + '-' + (p[2] >> 5);
        var b = buckets[key] || (buckets[key] = { n: 0, r: 0, g: 0, b: 0 });
        b.n++; b.r += p[0]; b.g += p[1]; b.b += p[2]; n++;
      }
      var top = null;
      Object.keys(buckets).forEach(function (k) { if (!top || buckets[k].n > top.n) top = buckets[k]; });
      return { top: top, n: n };
    }
    var res = common(true);
    if (!res.top || res.n < 0.05 * (N * 0.6) * (N * 0.6)) res = common(false);
    var t = res.top;
    return R.nearestColor(t.r / t.n, t.g / t.n, t.b / t.n);
  }

  $('photoInput').addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    pending = null;
    if (!file) return;
    status('사진을 읽는 중입니다…');
    readImage(file).then(function (r) {
      var key;
      try { key = extractColor(r.img); } catch (err) { key = ''; }
      return resize(r.img).then(function (blob) {
        URL.revokeObjectURL(r.url);
        pending = blob;
        var prev = $('photoPreview');
        if (prev.dataset.url) URL.revokeObjectURL(prev.dataset.url);
        prev.dataset.url = URL.createObjectURL(blob);
        prev.src = prev.dataset.url;
        $('photoPreviewWrap').hidden = false;
        if (key) {
          setVal('color', key);
          $('colorHint').textContent = '사진에서 읽은 색: ' + R.colorOf(key).name + '. 맞지 않으면 아래에서 바꿔 주세요.';
        } else {
          $('colorHint').textContent = '색을 읽지 못했습니다. 아래에서 골라 주세요.';
        }
        status('종류·핏·계절을 확인한 뒤 ‘옷장에 추가’를 눌러 주세요.');
      });
    }).catch(function () {
      $('photoPreviewWrap').hidden = true;
      status('이 사진은 읽을 수 없습니다. JPG나 PNG 사진으로 다시 골라 주세요.');
    });
  });

  /* ---------- add / delete ---------- */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!db) { status('이 브라우저에서는 옷장을 저장할 수 없습니다.'); return; }
    var cat = val('cat'), color = val('color'), fit = val('fit'), season = val('season') || 'all';
    var missing = [!pending && '사진', !cat && '종류', !color && '색', !fit && '핏'].filter(Boolean);
    if (missing.length) { status(missing.join(', ') + '을(를) 골라 주세요.'); return; }
    if (items.length >= MAX_ITEMS) { status('옷장에는 ' + MAX_ITEMS + '벌까지 등록할 수 있습니다.'); return; }
    var item = { id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), schema: ITEM_SCHEMA,
      cat: cat, color: color, fit: fit, season: season, laundry: false, worn: [],
      memo: $('memoInput').value.trim().slice(0, 30), photo: pending, created: new Date().toISOString() };
    req(store('items', 'readwrite').add(item)).then(function () {
      pending = null; form.reset(); setVal('season', 'all'); $('photoInput').value = ''; $('photoPreviewWrap').hidden = true;
      status('옷장에 추가했습니다: ' + R.CATS[cat] + ' · ' + R.colorOf(color).name + ' · ' + R.SEASONS[season]);
      return refresh();
    }).catch(function (err) {
      var full = err && (err.name === 'QuotaExceededError' || /quota/i.test(err.message || ''));
      status(full ? '브라우저 저장 공간이 부족해 저장하지 못했습니다. 안 입는 옷을 지운 뒤 다시 시도해 주세요.' : '저장하지 못했습니다. 다시 시도해 주세요.');
    });
  });

  $('clearCloset').addEventListener('click', function () {
    if (!db) return;
    if (!items.length) { S.toast('지울 옷이 없습니다.'); return; }
    if (!confirm('옷장에 등록한 옷과 사진을 모두 지울까요? 내일 입을 코디 기록도 함께 지워집니다.')) return;
    Promise.all([req(store('items', 'readwrite').clear()), req(store('meta', 'readwrite').clear())])
      .then(function () { chosen = null; started = false; S.toast('옷장을 비웠습니다.'); return refresh(); })
      .catch(function () { S.toast('지우지 못했습니다.'); });
  });

  /* ---------- today's situation ---------- */
  function renderSituation() {
    var groups = [['formality', '격식'], ['weather', '날씨'], ['move', '이동']];
    $('situationChoices').innerHTML = groups.map(function (g) {
      var opts = R.SITUATION[g[0]];
      return '<div class="flex items-center gap-2 flex-wrap"><span class="w-10 text-[13px] font-bold text-primary shrink-0">' + g[1] + '</span>' +
        Object.keys(opts).map(function (k) {
          return '<button type="button" class="btn !h-9 !px-3" data-sit="' + g[0] + '" data-val="' + k + '" aria-pressed="' + (situation[g[0]] === k) + '">' + esc(opts[k]) + '</button>';
        }).join('') + '</div>';
    }).join('');
    $('situationSummary').textContent = '지금 조건: ' + R.SITUATION.formality[situation.formality] + ' · ' + R.SITUATION.weather[situation.weather] + ' · ' + R.SITUATION.move[situation.move];
  }

  /* ---------- render ---------- */
  function photoUrl(it) { var u = URL.createObjectURL(it.photo); urls.push(u); return u; }
  function thumb(it, cls) {
    var c = R.colorOf(it.color);
    return '<img src="' + photoUrl(it) + '" alt="' + esc(R.CATS[it.cat] + ' · ' + c.name + (it.memo ? ' · ' + it.memo : '')) + '" class="' + cls + ' object-cover bg-fresh-beige">';
  }
  function partsOf(o) { return [o.outer, o.top, o.bottom, o.shoes].filter(Boolean); }
  function photoGrid(o) {
    var ps = partsOf(o);
    return '<div class="grid grid-cols-2 gap-1">' + ps.map(function (it) {
      return '<figure class="m-0 relative">' + thumb(it, 'w-full aspect-square rounded-lg') +
        '<figcaption class="absolute left-1 bottom-1 text-[11px] font-semibold bg-white/90 rounded px-1.5">' + esc(R.CATS[it.cat]) + '</figcaption></figure>';
    }).join('') + '</div>';
  }
  function counts() {
    var c = { outer: 0, top: 0, bottom: 0, shoes: 0 };
    items.forEach(function (it) { if (c[it.cat] !== undefined) c[it.cat]++; });
    return c;
  }
  function goalMissing(c) {
    return Object.keys(GOAL).filter(function (k) { return c[k] < GOAL[k]; })
      .map(function (k) { return R.CATS[k] + ' ' + (GOAL[k] - c[k]) + '개'; });
  }

  function renderProgress() {
    var c = counts(), slots = [];
    Object.keys(GOAL).forEach(function (k) {
      for (var i = 0; i < GOAL[k]; i++) {
        var on = c[k] > i;
        slots.push('<span class="flex flex-col items-center gap-1"><span class="w-10 h-10 rounded-full border-2 flex items-center justify-center ' +
          (on ? 'bg-editorial-charcoal border-editorial-charcoal text-white' : 'border-dashed border-warm-taupe text-warm-taupe') + '">' +
          '<span class="material-symbols-outlined text-[20px]">' + (on ? 'check' : 'add') + '</span></span>' +
          '<span class="text-[11px] ' + (on ? 'text-primary font-semibold' : 'text-on-surface-variant') + '">' + esc(R.CATS[k]) + '</span></span>');
      }
    });
    $('progressSlots').innerHTML = slots.join('');
    var miss = goalMissing(c), btn = $('startBtn');
    btn.disabled = miss.length > 0;
    btn.classList.toggle('opacity-50', miss.length > 0);
    $('progressText').textContent = miss.length
      ? miss.join(', ') + '를 더 등록하면 추천을 시작할 수 있어요.'
      : '준비됐어요. 오늘 상황을 고르고 추천을 받아 보세요.';
  }

  function renderChosen() {
    var box = $('chosenBox');
    if (!chosen) { box.hidden = true; return; }
    var byId = {}; items.forEach(function (it) { byId[it.id] = it; });
    var o = { outer: byId[chosen.ids.outer], top: byId[chosen.ids.top], bottom: byId[chosen.ids.bottom], shoes: byId[chosen.ids.shoes] };
    if (!o.top || !o.bottom || !o.shoes) { box.hidden = true; return; }       // an item of it was deleted
    var d = new Date(chosen.at), when = (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
    $('chosenBody').innerHTML = photoGrid(o) +
      '<p class="mt-2 text-[14px] text-primary font-semibold">' + esc(chosen.reason) + '</p>' +
      '<p class="text-[12px] text-on-surface-variant mt-0.5">' + esc(when) + '에 고름 · ' + esc(chosen.situationText) + '</p>';
    box.hidden = false;
  }

  function outfitCard(entry, i) {
    var o = entry.o;
    return '<div class="card p-3" data-card="' + i + '">' +
      '<div class="flex items-center justify-between"><p class="kicker m-0">추천 ' + (i + 1) + '</p>' +
      (entry.note ? '<span class="text-[11px] font-semibold text-on-secondary-container bg-secondary-container px-2 rounded">' + esc(entry.note) + '</span>' : '') + '</div>' +
      '<div class="mt-2">' + photoGrid(o) + '</div>' +
      '<p class="mt-2 text-[14px] text-primary font-semibold leading-snug">' + esc(o.reason) + '</p>' +
      (o.noOuterHint ? '<p class="text-[12px] text-on-surface-variant mt-0.5">아우터를 등록하면 오늘 조건에 더 잘 맞는 조합을 만들 수 있어요.</p>' : '') +
      '<details class="mt-1 text-[12px] text-on-surface-variant"><summary class="cursor-pointer">이유 더 보기</summary><ul class="mt-1 space-y-0.5">' +
        o.why.map(function (w) { return '<li>' + (w.good ? '✔ ' : '△ ') + esc(w.text) + '</li>'; }).join('') + '</ul></details>' +
      '<div class="grid grid-cols-3 gap-1.5 mt-3">' +
        '<button type="button" class="btn btn-dark !h-11 !px-1 !text-[13px]" data-act="wear" data-i="' + i + '">이대로 입기</button>' +
        '<button type="button" class="btn !h-11 !px-1 !text-[13px]" data-act="comfy" data-i="' + i + '">더 편하게</button>' +
        '<button type="button" class="btn !h-11 !px-1 !text-[13px]" data-act="other" data-i="' + i + '">다른 조합</button>' +
      '</div></div>';
  }

  // how easy an outfit is to wear: looser bottom, no outer layer (unless the weather needs one), sneaker-like light shoes
  function comfort(o) {
    var c = { slim: 0, regular: 1, wide: 2 }[o.bottom.fit] || 0;
    if (!o.outer && situation.weather !== 'cold') c += 1;
    if (R.colorOf(o.shoes.color).tone === 3) c += 1;
    return c;
  }

  var ranked = { list: [], missing: [] };
  function recompute() {
    var rec = R.recommend(items, situation);
    ranked = rec;
    shown = rec.outfits.length ? R.pickThree(rec.outfits).map(function (o) { return { o: o, note: '' }; }) : [];
  }
  function renderOutfits() {
    var box = $('outfitList');
    if (!started) { $('recSection').hidden = true; return; }
    $('recSection').hidden = false;
    if (ranked.missing && ranked.missing.length) {
      box.innerHTML = '<div class="note-box">' + (ranked.missingBySituation
        ? '오늘 조건에 맞는 <b>' + esc(ranked.missing.join(', ')) + '</b>이(가) 없습니다. 날씨를 바꾸거나, 등록한 옷의 계절을 확인해 주세요.'
        : '조합을 만들려면 상의·하의·신발이 1벌 이상씩 필요합니다. 지금 없는 것: <b>' + esc(ranked.missing.join(', ')) + '</b>') + '</div>';
      return;
    }
    box.innerHTML = shown.map(outfitCard).join('');
  }

  function render() {
    urls.forEach(URL.revokeObjectURL); urls = [];
    $('itemCount').textContent = items.length ? items.length + '벌' : '';
    $('closetList').innerHTML = items.length ? items.map(function (it) {
      var c = R.colorOf(it.color);
      return '<div class="card overflow-hidden">' + thumb(it, 'w-full aspect-square') +
        '<div class="p-2 text-[12px]"><b class="text-primary">' + esc(R.CATS[it.cat]) + '</b> <span class="text-on-surface-variant">· ' + esc(R.SEASONS[it.season || 'all']) + '</span>' +
        '<span class="flex items-center gap-1 mt-0.5"><span class="inline-block w-3 h-3 rounded-full border border-hairline-border" style="background:' + c.hex + '"></span>' + esc(c.name) + ' · ' + esc(R.FITS[it.fit]) + '</span>' +
        (it.memo ? '<span class="block text-on-surface-variant truncate">' + esc(it.memo) + '</span>' : '') +
        '<button type="button" class="mt-1 text-[12px] underline text-on-secondary-container" data-del="' + esc(it.id) + '">삭제</button></div></div>';
    }).join('') : '<div class="note-box col-span-full">아직 등록한 옷이 없습니다. 위에서 사진을 골라 첫 옷을 등록해 보세요.</div>';
    renderProgress();
    renderChosen();
    renderSituation();
    renderOutfits();
    showUsage();
  }

  /* ---------- actions ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-del],[data-sit],[data-act]');
    if (!t || !db) return;
    if (t.hasAttribute('data-del')) {
      req(store('items', 'readwrite').delete(t.getAttribute('data-del'))).then(function () { S.toast('옷장에서 지웠습니다.'); return refresh(); })
        .catch(function () { S.toast('지우지 못했습니다.'); });
      return;
    }
    if (t.hasAttribute('data-sit')) {
      situation[t.getAttribute('data-sit')] = t.getAttribute('data-val');
      setMeta('situation', situation).catch(function () {});
      recompute(); renderSituation(); urls.forEach(URL.revokeObjectURL); urls = []; render();
      return;
    }
    var i = +t.getAttribute('data-i'), entry = shown[i];
    if (!entry) return;
    var onScreen = shown.map(function (s) { return s.o.key; });
    var act = t.getAttribute('data-act');
    if (act === 'wear') {
      var o = entry.o;
      chosen = { ids: { outer: o.outer && o.outer.id, top: o.top.id, bottom: o.bottom.id, shoes: o.shoes.id },
        reason: o.reason, at: new Date().toISOString(), situation: Object.assign({}, situation),
        situationText: $('situationSummary').textContent.replace('지금 조건: ', '') };
      setMeta('chosen', chosen).then(function () {
        render(); S.toast('내일 입을 코디로 정했어요.');
        goTo($('chosenBox'));
      }).catch(function () { S.toast('저장하지 못했습니다.'); });
      return;
    }
    var next = null, note = '';
    if (act === 'other') {
      next = ranked.outfits.filter(function (o) { return onScreen.indexOf(o.key) < 0; })[0];
      note = '다른 조합';
    } else if (act === 'comfy') {
      // must be genuinely easier to wear than this card: looser bottom, no outer unless it's cold, lighter shoes
      var cur = comfort(entry.o);
      var easy = R.recommend(items, R.comfier(situation));
      next = (easy.outfits || []).filter(function (o) { return onScreen.indexOf(o.key) < 0 && comfort(o) > cur; })[0];
      note = '더 편한 조합';
    }
    if (!next) { S.toast(act === 'comfy' ? '더 편한 다른 조합이 없습니다.' : '다른 조합이 없습니다.'); return; }
    shown[i] = { o: next, note: note };
    urls.forEach(URL.revokeObjectURL); urls = []; render();
    goTo(document.querySelector('[data-card="' + i + '"]'), 'nearest');
  });

  $('startBtn').addEventListener('click', function () {
    started = true; setMeta('started', true).catch(function () {});
    recompute(); render();
    goTo($('recSection'));
  });
  $('rechoose').addEventListener('click', function () {
    started = true; recompute(); render();
    goTo($('recSection'));
  });

  function showUsage() {
    var el = $('storageUsage');
    if (!el || !navigator.storage || !navigator.storage.estimate) return;
    navigator.storage.estimate().then(function (est) {
      if (!est || !est.usage) { el.textContent = ''; return; }
      el.textContent = '이 브라우저에 사용 중인 저장 공간: 약 ' + (est.usage / 1048576).toFixed(1) + 'MB' +
        (est.quota ? ' (사용 가능 약 ' + Math.round(est.quota / 1048576) + 'MB)' : '');
    }).catch(function () {});
  }

  function refresh() {
    return loadAll().then(function (list) {
      items = list.sort(function (a, b) { return a.created < b.created ? -1 : 1; });
      recompute(); render();
    });
  }

  openDB().then(function (d) {
    db = d;
    return Promise.all([getMeta('situation'), getMeta('chosen'), getMeta('started')]);
  }).then(function (m) {
    if (m[0]) situation = Object.assign(situation, m[0]);
    chosen = m[1] || null;
    started = !!m[2];
    return refresh();
  }).catch(function () {
    db = null;
    $('addBtn').disabled = true; $('addBtn').classList.add('opacity-50');
    status('이 브라우저에서는 옷장을 저장할 수 없습니다. 사생활 보호 모드나 사이트 데이터 차단 설정을 확인해 주세요.');
    render();
  });
})();
