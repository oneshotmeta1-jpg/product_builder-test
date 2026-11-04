// "My closet" outfit rules. Plain rules, no AI: every combination is scored with the table below
// and the reasons are shown to the visitor. The same table is printed on closet.html.
(function () {
  'use strict';

  // tone: 3 light, 2 mid, 1 dark. accent: a "point" colour (not a neutral).
  var COLORS = [
    { key: 'white',    name: '화이트',        hex: '#f4f4f1', tone: 3, accent: false },
    { key: 'ivory',    name: '아이보리·크림', hex: '#efe6d2', tone: 3, accent: false },
    { key: 'beige',    name: '베이지',        hex: '#d6c19c', tone: 3, accent: false },
    { key: 'camel',    name: '카멜',          hex: '#b98b55', tone: 2, accent: false },
    { key: 'gray',     name: '그레이',        hex: '#9c9c9c', tone: 2, accent: false },
    { key: 'khaki',    name: '카키·올리브',   hex: '#7d7a55', tone: 2, accent: false },
    { key: 'denim',    name: '데님 블루',     hex: '#4a6a8f', tone: 2, accent: false },
    { key: 'charcoal', name: '차콜',          hex: '#45464a', tone: 1, accent: false },
    { key: 'navy',     name: '네이비',        hex: '#1f2a44', tone: 1, accent: false },
    { key: 'brown',    name: '브라운',        hex: '#6b4a32', tone: 1, accent: false },
    { key: 'black',    name: '블랙',          hex: '#1c1c1c', tone: 1, accent: false },
    { key: 'skyblue',  name: '하늘색',        hex: '#a9c4de', tone: 3, accent: true },
    { key: 'pink',     name: '핑크',          hex: '#e6b7c1', tone: 3, accent: true },
    { key: 'yellow',   name: '머스터드·옐로', hex: '#e3c25a', tone: 3, accent: true },
    { key: 'red',      name: '레드·버건디',   hex: '#9e2f35', tone: 1, accent: true },
    { key: 'green',    name: '그린',          hex: '#3f6b4b', tone: 1, accent: true }
  ];
  var CATS = { outer: '아우터', top: '상의', bottom: '하의', shoes: '신발' };
  var FITS = { slim: '슬림·정돈', regular: '레귤러', wide: '와이드·오버' };
  var WARM_LIGHT = { ivory: 1, beige: 1, camel: 1 }; // similar-but-different colours that look mismatched together

  var byKey = {};
  COLORS.forEach(function (c) { byKey[c.key] = c; });
  function col(item) { return byKey[item.color] || byKey.gray; }

  // ---- colour from a photo: nearest palette colour in CIE Lab ----
  function toLab(r, g, b) {
    function lin(v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
    var R = lin(r), G = lin(g), B = lin(b);
    var x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
    var y = (R * 0.2126 + G * 0.7152 + B * 0.0722);
    var z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
    function f(t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; }
    return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
  }
  var LABS = COLORS.map(function (c) {
    var h = c.hex.slice(1);
    return toLab(parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16));
  });
  function nearestColor(r, g, b) {
    var lab = toLab(r, g, b), best = 0, bestD = Infinity;
    LABS.forEach(function (l, i) {
      var d = Math.pow(lab[0] - l[0], 2) + Math.pow(lab[1] - l[1], 2) + Math.pow(lab[2] - l[2], 2);
      if (d < bestD) { bestD = d; best = i; }
    });
    return COLORS[best].key;
  }

  // ---- scoring ----
  function scoreBase(top, bottom, shoes) {
    var s = 0, why = [];
    function add(n, text) { s += n; why.push({ good: n > 0, text: text }); }
    var t = col(top), b = col(bottom), sh = col(shoes);

    if (t.tone > b.tone) add(3, '밝은 위·어두운 아래: 시선이 얼굴 쪽에 머물고 하체가 길어 보입니다.');
    else if (t.tone === b.tone) add(1, '위아래 명암이 비슷한 톤온톤이라 차분하고 정돈돼 보입니다.');
    else add(1, '어두운 위·밝은 아래는 안정감이 있습니다. 신발을 상의 색과 맞추면 더 정돈됩니다.');

    var accents = [t, b, sh].filter(function (c) { return c.accent; }).length;
    if (accents === 0) add(1, '뉴트럴 색만 써서 어떤 자리에도 무난합니다.');
    else if (accents === 1) add(2, '포인트 색이 하나라 시선이 한곳에 모입니다.');
    else add(-3, '포인트 색이 둘 이상이면 산만해 보일 수 있습니다.');

    if (WARM_LIGHT[t.key] && WARM_LIGHT[b.key] && t.key !== b.key) {
      add(-2, t.name + '와 ' + b.name + '처럼 비슷하지만 다른 색을 위아래로 입으면 짝이 안 맞아 보일 수 있습니다.');
    }

    var wides = (top.fit === 'wide' ? 1 : 0) + (bottom.fit === 'wide' ? 1 : 0);
    if (wides === 2) add(-2, '위아래 모두 넉넉하면 부해 보입니다. 하나는 정돈된 핏으로 바꿔 보세요.');
    else if (wides === 1) add(2, '한쪽만 여유 있게 입어 실루엣의 균형이 맞습니다.');
    else add(1, '위아래 모두 정돈된 핏이라 단정합니다.');

    if (sh.key === b.key || (sh.tone === 1 && b.tone === 1 && !sh.accent)) add(2, '하의와 신발을 같은 어두운 색으로 이어 다리가 길어 보입니다.');
    else if (sh.tone === 3 && t.tone === 3 && !sh.accent) add(1, '상의와 신발이 같은 밝은 색이라 코디가 하나로 묶입니다.');
    else if (sh.accent) add(-1, '신발 색이 튀면 시선이 발로 갑니다.');
    return { score: s, why: why, accents: accents };
  }

  function scoreOuter(outer, top, bottom, accents) {
    var s = 0, why = [];
    function add(n, text) { s += n; why.push({ good: n > 0, text: text }); }
    var o = col(outer), t = col(top), b = col(bottom);
    if (o.key === b.key) add(2, '아우터와 하의를 같은 색으로 맞춰 셋업처럼 보입니다.');
    if (o.tone !== t.tone) add(1, '아우터와 상의의 명암이 달라 겹쳐 입은 모양이 살아납니다.');
    if (outer.fit === 'wide' && bottom.fit === 'wide') add(-2, '아우터와 하의가 모두 넉넉하면 부해 보입니다.');
    if (o.accent && accents > 0) add(-2, '포인트 색이 겹쳐 산만해질 수 있습니다.');
    return { score: s, why: why };
  }

  // items: [{id, cat, color, fit, ...}] -> best outfits first
  function recommend(items, limit) {
    var by = { outer: [], top: [], bottom: [], shoes: [] };
    items.forEach(function (it) { if (by[it.cat]) by[it.cat].push(it); });
    var missing = ['top', 'bottom', 'shoes'].filter(function (k) { return !by[k].length; }).map(function (k) { return CATS[k]; });
    if (missing.length) return { missing: missing, outfits: [] };
    var outfits = [];
    by.top.forEach(function (t) {
      by.bottom.forEach(function (b) {
        by.shoes.forEach(function (sh) {
          var base = scoreBase(t, b, sh), best = null;
          by.outer.forEach(function (o) {
            var r = scoreOuter(o, t, b, base.accents);
            if (r.score > 0 && (!best || r.score > best.score)) best = { item: o, score: r.score, why: r.why };
          });
          outfits.push({
            top: t, bottom: b, shoes: sh, outer: best && best.item,
            score: base.score + (best ? best.score : 0),
            why: base.why.concat(best ? best.why : [])
          });
        });
      });
    });
    outfits.sort(function (x, y) { return y.score - x.score; });
    return { missing: [], outfits: outfits.slice(0, limit || 5), total: outfits.length };
  }

  function deltaE(a, b) {
    var x = toLab(a[0], a[1], a[2]), y = toLab(b[0], b[1], b[2]);
    return Math.sqrt(Math.pow(x[0] - y[0], 2) + Math.pow(x[1] - y[1], 2) + Math.pow(x[2] - y[2], 2));
  }

  window.STYL_CLOSET = { COLORS: COLORS, CATS: CATS, FITS: FITS, colorOf: function (key) { return byKey[key]; },
    nearestColor: nearestColor, deltaE: deltaE, recommend: recommend };
})();
