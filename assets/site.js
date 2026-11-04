// STYL.AI shared behaviours: menu state, toast, saved list (browser localStorage), link copy.
(function () {
  'use strict';

  var page = document.body.getAttribute('data-page') || '';
  var navKey = { home: 'home', lookbook: 'lookbook', guide: 'guide', recommend: 'recommend' }[page];
  if (navKey) {
    var cur = document.querySelector('[data-nav="' + navKey + '"]');
    if (cur) cur.setAttribute('aria-current', 'page');
  }

  var toastTimer = null;
  function toast(msg) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('opacity-0', '-translate-y-2');
    el.classList.add('opacity-100', 'translate-y-0');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('opacity-100', 'translate-y-0');
      el.classList.add('opacity-0', '-translate-y-2');
    }, 2600);
  }

  /* ---------- saved list ----------
     Stored only in this browser (localStorage key below). Nothing is sent to a server. */
  var KEY = 'stylai.saved.v1';
  var storageOk = true;
  function readSaved() {
    try {
      var raw = localStorage.getItem(KEY);
      var list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) return [];
      // LOOK 01 moved from lookbook.html (now the look list) to look-01.html in R3
      list.forEach(function (x) { if (x && x.id === 'look-01' && x.url === 'lookbook.html') x.url = 'look-01.html'; });
      return list;
    } catch (e) { storageOk = false; return []; }
  }
  function writeSaved(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); return true; }
    catch (e) { storageOk = false; return false; }
  }
  function isSaved(id) { return readSaved().some(function (x) { return x.id === id; }); }
  function addSaved(item) {
    var list = readSaved().filter(function (x) { return x.id !== item.id; });
    list.unshift({ id: item.id, title: item.title, url: item.url, note: item.note || '', savedAt: new Date().toISOString() });
    return writeSaved(list);
  }
  function removeSaved(id) {
    return writeSaved(readSaved().filter(function (x) { return x.id !== id; }));
  }
  function updateCount() {
    var n = readSaved().length;
    document.querySelectorAll('.saved-count').forEach(function (el) { el.textContent = n ? String(n) : ''; });
  }

  function paintSaveBtn(btn) {
    var on = isSaved(btn.getAttribute('data-save-id'));
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    var label = btn.querySelector('[data-save-label]');
    var icon = btn.querySelector('.material-symbols-outlined');
    if (label) label.textContent = on ? '저장됨' : '저장';
    if (icon) icon.textContent = on ? 'bookmark' : 'bookmark_border';
  }
  function bindSaveButtons(root) {
    (root || document).querySelectorAll('[data-save-id]').forEach(function (btn) {
      if (btn.dataset.bound) { paintSaveBtn(btn); return; }
      btn.dataset.bound = '1';
      paintSaveBtn(btn);
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-save-id');
        var ok;
        if (isSaved(id)) {
          ok = removeSaved(id);
          toast(ok ? '저장 목록에서 뺐습니다.' : '이 브라우저에서는 저장 기능을 쓸 수 없습니다.');
        } else {
          ok = addSaved({ id: id, title: btn.getAttribute('data-save-title'), url: btn.getAttribute('data-save-url') || location.pathname, note: btn.getAttribute('data-save-note') });
          toast(ok ? '저장 목록에 담았습니다. 상단 ‘저장 목록’에서 다시 볼 수 있어요.' : '이 브라우저에서는 저장 기능을 쓸 수 없습니다. (사생활 보호 모드 등)');
        }
        paintSaveBtn(btn); updateCount(); renderSavedList();
      });
    });
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function safeUrl(u) { u = String(u || ''); return /^(https?:|\/|\.\/|[a-z0-9-]+\.html)/i.test(u) && !/^javascript:/i.test(u) ? u : './'; }

  function renderSavedList() {
    var box = document.getElementById('savedList');
    if (!box) return;
    var list = readSaved();
    if (!storageOk) {
      box.innerHTML = '<div class="note-box">이 브라우저에서는 저장소를 쓸 수 없어 저장 목록을 보여 드릴 수 없습니다. 사생활 보호(시크릿) 모드나 사이트 데이터 차단 설정을 확인해 주세요.</div>';
      return;
    }
    if (!list.length) {
      box.innerHTML = '<div class="note-box">아직 저장한 항목이 없습니다. <a class="underline" href="lookbook.html">코디 룩북</a>이나 <a class="underline" href="recommend.html">조건별 추천</a> 결과에서 ‘저장’을 누르면 여기에 모입니다.</div>';
      return;
    }
    box.innerHTML = list.map(function (x) {
      var d = (x.savedAt || '').slice(0, 10);
      return '<div class="card p-3 flex items-start justify-between gap-3">' +
        '<div class="min-w-0"><a class="font-bold text-primary underline-offset-2 hover:underline" href="' + esc(safeUrl(x.url)) + '">' + esc(x.title) + '</a>' +
        (x.note ? '<p class="text-[12px] text-on-surface-variant mt-0.5">' + esc(x.note) + '</p>' : '') +
        '<p class="text-[11px] text-warm-taupe mt-1">저장일 ' + esc(d) + '</p></div>' +
        '<button type="button" class="btn shrink-0" data-remove="' + esc(x.id) + '" aria-label="' + esc(x.title) + ' 삭제"><span class="material-symbols-outlined text-[18px]">delete</span>삭제</button></div>';
    }).join('');
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-remove]');
    if (!b) return;
    var ok = removeSaved(b.getAttribute('data-remove'));
    toast(ok ? '삭제했습니다.' : '삭제하지 못했습니다.');
    updateCount(); renderSavedList(); bindSaveButtons();
  });
  var clearBtn = document.getElementById('clearSaved');
  if (clearBtn) clearBtn.addEventListener('click', function () {
    if (!readSaved().length) { toast('지울 항목이 없습니다.'); return; }
    if (!confirm('저장 목록을 모두 지울까요?')) return;
    toast(writeSaved([]) ? '저장 목록을 비웠습니다.' : '지우지 못했습니다.');
    updateCount(); renderSavedList(); bindSaveButtons();
  });

  /* ---------- link copy ---------- */
  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }
  function copyLink(url) {
    var done = function (ok) {
      toast(ok ? '링크를 복사했습니다. 붙여넣기로 공유해 보세요.' : '링크를 복사하지 못했습니다. 주소창의 주소를 직접 복사해 주세요.');
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(function () { done(true); }, function () { done(fallbackCopy(url)); });
    } else {
      done(fallbackCopy(url));
    }
  }
  document.querySelectorAll('[data-copy-link]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var u = btn.getAttribute('data-copy-link');
      copyLink(u ? new URL(u, location.href).href : location.href.split('#')[0]);
    });
  });

  window.STYL = { toast: toast, bindSaveButtons: bindSaveButtons, copyLink: copyLink, esc: esc };
  bindSaveButtons(); updateCount(); renderSavedList();
})();
