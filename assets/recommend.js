// Rule-based outfit picker. Same three choices always give the same result; nothing leaves the browser.
(function () {
  'use strict';
  var esc = window.STYL.esc;

  var FORMALITY = {
    formal: {
      label: '격식 있는 자리',
      pieces: {
        slim: { outer: '네이비 또는 차콜 셋업 재킷 (허리가 살짝 들어간 싱글)', top: '흰 셔츠 또는 소매 있는 블라우스', bottom: '셋업 스트레이트 슬랙스', shoes: '블랙 펌프스(굽 3~5cm) 또는 더비 구두' },
        wide: { outer: '네이비 또는 차콜 셋업 재킷 (엉덩이를 덮는 기장)', top: '흰 셔츠 또는 소매 있는 블라우스 (넣어 입기)', bottom: '셋업 하이웨이스트 와이드 슬랙스', shoes: '블랙 레더 로퍼 또는 낮은 펌프스' }
      },
      why: '격식 있는 자리에서는 위아래 같은 원단의 셋업과 어두운 무광 색이 가장 안전합니다. 소매 있는 상의를 입으면 재킷을 벗어야 할 때도 단정합니다.',
      avoid: '민소매·니트 티셔츠, 광택이 강한 소재, 스니커즈는 피하세요.',
      look: { href: 'guide.html#dresscode', text: '복장 규정별 코디 바꾸기' }
    },
    biz: {
      label: '일반 출근',
      pieces: {
        slim: { outer: '오트밀·그레이 싱글 블레이저 (골반~엉덩이 중간 기장)', top: '아이보리 블라우스 또는 얇은 니트', bottom: '차콜 스트레이트 슬랙스', shoes: '블랙 레더 로퍼' },
        wide: { outer: '오트밀 싱글 블레이저 (엉덩이 중간 기장)', top: '아이보리 블라우스 (넣어 입기)', bottom: '차콜 하이웨이스트 원턱 와이드 슬랙스', shoes: '블랙 스퀘어 토 로퍼' }
      },
      why: '비즈니스 캐주얼은 블레이저 하나로 격식을 갖추고 나머지는 편한 기본 아이템으로 채우는 방식이 가장 활용도가 높습니다. 밝은 상의와 어두운 하의를 두면 시선이 위로 모입니다.',
      avoid: '블레이저와 애매하게 다른 베이지의 하의, 바닥에 끌리는 기장은 피하세요.',
      look: { href: 'lookbook.html', text: 'LOOK 01 미니멀 테일러드 오피스코어 룩' }
    },
    casual: {
      label: '캐주얼한 회사·외근',
      pieces: {
        slim: { outer: '네이비·그레이 니트 카디건 또는 셔츠 재킷', top: '두께감 있는 흰 티셔츠 또는 얇은 니트', bottom: '베이지 치노 또는 다크 인디고 스트레이트 데님', shoes: '흰색 가죽 스니커즈' },
        wide: { outer: '오버핏 니트 카디건 또는 셔츠 재킷', top: '짧은 기장의 니트 또는 티셔츠 (앞만 살짝 넣기)', bottom: '하이웨이스트 와이드 치노', shoes: '흰색 가죽 스니커즈 또는 쿠션 있는 로퍼' }
      },
      why: '캐주얼한 회사나 이동이 많은 날에는 구김에 강하고 움직이기 편한 소재가 우선입니다. 니트 카디건이나 셔츠 재킷은 블레이저보다 힘이 빠지면서도 정돈된 느낌을 줍니다.',
      avoid: '로고가 큰 티셔츠, 해진 데님, 운동용 러닝화는 업무 자리에서 가볍게 보일 수 있습니다.',
      look: { href: 'guide.html#dresscode', text: '복장 규정별 코디 바꾸기' }
    }
  };

  var BUDGET = {
    low: {
      label: '약 25만 원 이하',
      split: '아우터 7만~10만 · 상의 2만~4만 · 하의 3만~5만 · 신발 4만~6만 원 (예시)',
      why: '예산이 적을 때는 폴리 혼방처럼 관리가 쉬운 소재로 고르고, 남는 비용으로 바지 기장을 수선하세요. 핏이 맞으면 가격 차이가 덜 보입니다.',
      material: '폴리 혼방 · 무광 원단 위주'
    },
    mid: {
      label: '약 30만~50만 원',
      split: '아우터 15만~25만 · 상의 4만~7만 · 하의 6만~10만 · 신발 8만~12만 원 (예시)',
      why: '가장 크게 보이는 아우터(격식 있는 자리라면 셋업 재킷)에 예산의 절반 가까이를 쓰고 나머지는 기본형으로 맞추면 전체 인상이 가장 많이 좋아집니다.',
      material: '아우터는 울 혼방, 나머지는 기본 소재'
    },
    high: {
      label: '약 60만 원 이상',
      split: '아우터 30만 이상 · 상의 8만~15만 · 하의 12만~20만 · 신발 15만~25만 원 (예시)',
      why: '울 함량이 높은 아우터와 하의, 가죽 구두는 오래 형태를 유지합니다. 드라이클리닝 같은 관리 비용도 함께 생각하세요.',
      material: '울 함량 높은 원단 · 소가죽'
    }
  };

  var FIT = {
    slim: {
      label: '정돈된 슬림·스트레이트',
      why: '몸선이 정리되는 핏은 상체와 하체를 모두 깔끔하게 보여 줍니다. 바지는 신발 등에 살짝 닿거나 복숭아뼈가 보이는 기장이 좋습니다.',
      check: '재킷 단추를 잠갔을 때 X자 주름이 없는지, 앉았을 때 허벅지가 당기지 않는지 확인하세요.'
    },
    wide: {
      label: '여유 있는 와이드·릴랙스',
      why: '하의에 여유를 줄 때는 상의를 넣어 입어 허리선을 드러내야 몸이 한 덩어리로 보이지 않습니다. 바지는 신발 앞코를 반쯤 덮는 기장이 기준입니다.',
      check: '아우터가 엉덩이를 덮는지, 바지 밑단이 바닥에서 1~2cm 뜨는지 확인하세요.'
    }
  };

  var form = document.getElementById('recForm');
  var out = document.getElementById('recResult');
  var hint = document.getElementById('recHint');
  if (!form || !out) return;

  function val(name) { var el = form.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : ''; }

  function render(scroll) {
    var f = val('f'), b = val('b'), p = val('p');
    var missing = [!f && '격식', !b && '예산', !p && '핏'].filter(Boolean);
    if (missing.length) {
      hint.textContent = missing.join(', ') + '을(를) 고르면 결과가 나옵니다.';
      out.hidden = true; return;
    }
    hint.textContent = '결과가 아래에 나왔습니다. 조건을 바꾸면 바로 다시 계산됩니다.';
    var F = FORMALITY[f], B = BUDGET[b], P = FIT[p], pc = F.pieces[p];
    var qs = '?f=' + f + '&b=' + b + '&p=' + p;
    var title = F.label + ' · ' + B.label + ' · ' + P.label;
    try { history.replaceState(null, '', qs + '#recResult'); } catch (e) {}

    out.innerHTML =
      '<div class="card p-4">' +
        '<p class="kicker m-0">추천 결과</p>' +
        '<h2 class="font-headline-md text-[22px] text-primary mt-1 leading-snug">' + esc(title) + '</h2>' +
        '<ul class="mt-3 space-y-2 text-[14px]">' +
          '<li><b class="inline-block w-12 text-secondary">아우터</b>' + esc(pc.outer) + '</li>' +
          '<li><b class="inline-block w-12 text-secondary">상의</b>' + esc(pc.top) + '</li>' +
          '<li><b class="inline-block w-12 text-secondary">하의</b>' + esc(pc.bottom) + '</li>' +
          '<li><b class="inline-block w-12 text-secondary">신발</b>' + esc(pc.shoes) + '</li>' +
        '</ul>' +
        '<p class="text-[12px] text-on-surface-variant mt-3">소재: ' + esc(B.material) + '<br>예산 배분: ' + esc(B.split) + '</p>' +
        '<h3 class="text-[15px] font-bold text-primary mt-4">이렇게 추천한 이유</h3>' +
        '<ol class="list-decimal pl-5 mt-1 space-y-1.5 text-[13px]">' +
          '<li><b>격식 — ' + esc(F.label) + ':</b> ' + esc(F.why) + '</li>' +
          '<li><b>예산 — ' + esc(B.label) + ':</b> ' + esc(B.why) + '</li>' +
          '<li><b>핏 — ' + esc(P.label) + ':</b> ' + esc(P.why) + '</li>' +
        '</ol>' +
        '<div class="note-box mt-3"><b>입어 보고 확인:</b> ' + esc(P.check) + '<br><b>피할 것:</b> ' + esc(F.avoid) + '</div>' +
        '<p class="text-[13px] mt-3">참고: <a class="underline text-on-secondary-container" href="' + esc(F.look.href) + '">' + esc(F.look.text) + '</a></p>' +
        '<div class="flex gap-2 mt-3">' +
          '<button type="button" class="btn" data-save-id="rec-' + f + '-' + b + '-' + p + '" data-save-title="추천: ' + esc(title) + '" data-save-url="recommend.html' + qs + '" data-save-note="' + esc(pc.outer + ' · ' + pc.bottom) + '">' +
            '<span class="material-symbols-outlined text-[18px]">bookmark_border</span><span data-save-label>저장</span></button>' +
          '<button type="button" class="btn" id="copyRec"><span class="material-symbols-outlined text-[18px]">link</span>결과 링크 복사</button>' +
        '</div>' +
        '<p class="text-[11px] text-warm-taupe mt-2">규칙표 기반 추천입니다. 체형·회사 분위기에 따라 조정해 주세요.</p>' +
      '</div>';
    out.hidden = false;
    window.STYL.bindSaveButtons(out);
    document.getElementById('copyRec').addEventListener('click', function () {
      window.STYL.copyLink(location.href.split('#')[0]);
    });
    if (scroll) out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  form.addEventListener('change', function () { render(!!(val('f') && val('b') && val('p'))); });

  // restore a saved or shared result: recommend.html?f=biz&b=mid&p=wide
  var q = new URLSearchParams(location.search);
  [['f', FORMALITY], ['b', BUDGET], ['p', FIT]].forEach(function (pair) {
    var v = q.get(pair[0]);
    if (v && pair[1][v]) {
      var el = form.querySelector('input[name="' + pair[0] + '"][value="' + v + '"]');
      if (el) el.checked = true;
    }
  });
  if (val('f') || val('b') || val('p')) render(false);
})();
