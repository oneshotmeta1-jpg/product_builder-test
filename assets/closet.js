// "My closet": photos and choices are kept in this browser's IndexedDB only. Nothing is uploaded.
(function () {
  'use strict';
  var S = window.STYL, R = window.STYL_CLOSET, esc = S.esc;
  var $ = function (id) { return document.getElementById(id); };
  var form = $('closetForm');
  if (!form || !R) return;

  var MAX_ITEMS = 100, MAX_SIDE = 480;
  var db = null, items = [], urls = [], pending = null; // pending: resized photo Blob waiting to be saved

  function status(msg) { $('formStatus').textContent = msg || ''; }

  /* ---------- choices ---------- */
  function radio(name, value, label, extra) {
    return '<label class="choice relative text-center"><input type="radio" name="' + name + '" value="' + value + '">' +
      (extra || '') + '<b class="text-[13px]">' + esc(label) + '</b></label>';
  }
  $('catChoices').innerHTML = Object.keys(R.CATS).map(function (k) { return radio('cat', k, R.CATS[k]); }).join('');
  $('fitChoices').innerHTML = Object.keys(R.FITS).map(function (k) { return radio('fit', k, R.FITS[k]); }).join('');
  $('colorChoices').innerHTML = R.COLORS.map(function (c) {
    return radio('color', c.key, c.name, '<span class="block mx-auto mb-1 w-6 h-6 rounded-full border border-hairline-border" style="background:' + c.hex + '"></span>');
  }).join('');
  function val(name) { var el = form.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : ''; }
  function setVal(name, v) { var el = form.querySelector('input[name="' + name + '"][value="' + v + '"]'); if (el) el.checked = true; }

  /* ---------- IndexedDB ---------- */
  function req(r) { return new Promise(function (ok, no) { r.onsuccess = function () { ok(r.result); }; r.onerror = function () { no(r.error); }; }); }
  function store(mode) { return db.transaction('items', mode).objectStore('items'); }
  function openDB() {
    return new Promise(function (ok, no) {
      if (!window.indexedDB) { no(new Error('no indexedDB')); return; }
      var r;
      try { r = indexedDB.open('stylai-closet', 1); } catch (e) { no(e); return; }
      r.onupgradeneeded = function () { r.result.createObjectStore('items', { keyPath: 'id' }); };
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { no(r.error); };
      r.onblocked = function () { no(new Error('blocked')); };
    });
  }
  function loadAll() { return req(store('readonly').getAll()); }

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
    // background = average of the outer 3-pixel frame
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
    // almost everything matched the background (garment same colour as floor): fall back to the plain middle
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
        status('종류와 핏을 고른 뒤 ‘옷장에 추가’를 눌러 주세요.');
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
    var cat = val('cat'), color = val('color'), fit = val('fit');
    var missing = [!pending && '사진', !cat && '종류', !color && '색', !fit && '핏'].filter(Boolean);
    if (missing.length) { status(missing.join(', ') + '을(를) 골라 주세요.'); return; }
    if (items.length >= MAX_ITEMS) { status('옷장에는 ' + MAX_ITEMS + '벌까지 등록할 수 있습니다.'); return; }
    var item = { id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), cat: cat, color: color, fit: fit,
      memo: $('memoInput').value.trim().slice(0, 30), photo: pending, created: new Date().toISOString() };
    req(store('readwrite').add(item)).then(function () {
      pending = null; form.reset(); $('photoInput').value = ''; $('photoPreviewWrap').hidden = true;
      status('옷장에 추가했습니다: ' + R.CATS[cat] + ' · ' + R.colorOf(color).name);
      return refresh();
    }).catch(function (err) {
      var full = err && (err.name === 'QuotaExceededError' || /quota/i.test(err.message || ''));
      status(full ? '브라우저 저장 공간이 부족해 저장하지 못했습니다. 안 입는 옷을 지운 뒤 다시 시도해 주세요.' : '저장하지 못했습니다. 다시 시도해 주세요.');
    });
  });

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-del]');
    if (!b || !db) return;
    req(store('readwrite').delete(b.getAttribute('data-del'))).then(function () { S.toast('옷장에서 지웠습니다.'); return refresh(); })
      .catch(function () { S.toast('지우지 못했습니다.'); });
  });
  $('clearCloset').addEventListener('click', function () {
    if (!db) return;
    if (!items.length) { S.toast('지울 옷이 없습니다.'); return; }
    if (!confirm('옷장에 등록한 옷과 사진을 모두 지울까요?')) return;
    req(store('readwrite').clear()).then(function () { S.toast('옷장을 비웠습니다.'); return refresh(); })
      .catch(function () { S.toast('지우지 못했습니다.'); });
  });

  /* ---------- render ---------- */
  function photoUrl(it) { var u = URL.createObjectURL(it.photo); urls.push(u); return u; }
  function thumb(it, cls) {
    var c = R.colorOf(it.color);
    return '<img src="' + photoUrl(it) + '" alt="' + esc(R.CATS[it.cat] + ' · ' + c.name + (it.memo ? ' · ' + it.memo : '')) + '" class="' + cls + ' object-cover bg-fresh-beige">';
  }
  function render() {
    urls.forEach(URL.revokeObjectURL); urls = [];
    $('itemCount').textContent = items.length ? items.length + '벌' : '';
    $('closetList').innerHTML = items.length ? items.map(function (it) {
      var c = R.colorOf(it.color);
      return '<div class="card overflow-hidden">' + thumb(it, 'w-full aspect-square') +
        '<div class="p-2 text-[12px]"><b class="text-primary">' + esc(R.CATS[it.cat]) + '</b>' +
        '<span class="flex items-center gap-1 mt-0.5"><span class="inline-block w-3 h-3 rounded-full border border-hairline-border" style="background:' + c.hex + '"></span>' + esc(c.name) + ' · ' + esc(R.FITS[it.fit]) + '</span>' +
        (it.memo ? '<span class="block text-on-surface-variant truncate">' + esc(it.memo) + '</span>' : '') +
        '<button type="button" class="mt-1 text-[12px] underline text-on-secondary-container" data-del="' + esc(it.id) + '">삭제</button></div></div>';
    }).join('') : '<div class="note-box col-span-full">아직 등록한 옷이 없습니다. 위에서 사진을 골라 첫 옷을 등록해 보세요.</div>';

    var rec = R.recommend(items, 5), box = $('outfitList');
    if (!items.length) { box.innerHTML = ''; return; }
    if (rec.missing.length) {
      box.innerHTML = '<div class="note-box">조합을 만들려면 상의·하의·신발이 1벌 이상씩 필요합니다. 지금 없는 것: <b>' + esc(rec.missing.join(', ')) + '</b></div>';
      return;
    }
    box.innerHTML = rec.outfits.map(function (o, i) {
      var parts = [o.outer, o.top, o.bottom, o.shoes].filter(Boolean);
      return '<div class="card p-3">' +
        '<p class="kicker m-0">코디 ' + (i + 1) + '</p>' +
        '<div class="grid gap-1.5 mt-2" style="grid-template-columns:repeat(' + parts.length + ',minmax(0,1fr))">' +
          parts.map(function (it) { return '<figure class="m-0">' + thumb(it, 'w-full aspect-square rounded-lg') + '<figcaption class="text-[11px] text-center text-on-surface-variant mt-0.5">' + esc(R.CATS[it.cat]) + '</figcaption></figure>'; }).join('') +
        '</div>' +
        '<ul class="mt-2 space-y-1 text-[13px]">' + o.why.map(function (w) {
          return '<li class="flex gap-1.5"><span class="' + (w.good ? 'text-secondary' : 'text-on-surface-variant') + '">' + (w.good ? '✔' : '△') + '</span><span>' + esc(w.text) + '</span></li>';
        }).join('') + '</ul></div>';
    }).join('') + (rec.total > rec.outfits.length ? '<p class="text-[12px] text-on-surface-variant">전체 ' + rec.total + '가지 조합 중 점수가 높은 ' + rec.outfits.length + '가지입니다.</p>' : '');
  }
  function refresh() { return loadAll().then(function (list) { items = list.sort(function (a, b) { return a.created < b.created ? -1 : 1; }); render(); }); }

  openDB().then(function (d) { db = d; return refresh(); }).catch(function () {
    db = null;
    $('addBtn').disabled = true; $('addBtn').classList.add('opacity-50');
    status('이 브라우저에서는 옷장을 저장할 수 없습니다. 사생활 보호 모드나 사이트 데이터 차단 설정을 확인해 주세요.');
    render();
  });
})();
