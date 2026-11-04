"""Build the static pages.

Run from anywhere:  python tools/build_pages.py
Edit the files in src/, then rebuild. The generated *.html files at the repo root are what Cloudflare Pages serves.

- src/pages/<slug>.html   page bodies, wrapped in src/layout.html
- src/looks/look-NN.json  one file per lookbook look; each becomes look-NN.html (same detail template),
                          and all of them together become the lookbook.html card list.
                          Text values may contain inline HTML (<strong>, <a>); they are written as-is.
"""
from pathlib import Path
import html
import json

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
SITE = "https://ai-stylelist.pages.dev/"

# slug -> (output file, title, description, extra scripts)
PAGES = {
    "home": ("index.html", "STYL.AI - 직장인을 위한 실용 출근 코디 가이드",
             "출근 코디를 왜 그렇게 입는지, 어디에 맞는지, 예산과 체형에 따라 어떻게 바꾸는지 정리한 직장인 스타일 가이드.", []),
    "guide": ("guide.html", "출근 코디 스타일 가이드 - STYL.AI",
              "블레이저 핏 기준, 슬랙스 기장과 신발 조합, 복장 규정별 코디, 예산 절약법, 소재별 관리법.", []),
    "recommend": ("recommend.html", "조건별 코디 추천 - STYL.AI",
                  "격식, 예산, 선호 핏을 고르면 규칙표에 따라 출근 코디와 추천 이유를 보여 줍니다.", ["assets/recommend.js"]),
    "saved": ("saved.html", "저장 목록 - STYL.AI", "이 브라우저에 저장한 룩북과 추천 결과 목록.", []),
    "about": ("about.html", "사이트 소개 - STYL.AI", "STYL.AI의 운영 목적과 콘텐츠 작성·검토 방식.", []),
    "contact": ("contact.html", "문의 - STYL.AI", "STYL.AI에 오류 제보, 주제 제안, 제휴 문의를 보내는 방법.", []),
    "privacy": ("privacy.html", "개인정보처리방침 - STYL.AI", "STYL.AI의 광고·통계 쿠키와 브라우저 저장 기능의 정보 처리 방식.", []),
    "affiliate": ("affiliate.html", "광고·제휴 안내 - STYL.AI", "STYL.AI의 광고 게재와 제휴 링크 표기 기준.", []),
    # Cloudflare Pages returns this with status 404 for unknown paths (without it, every path serves index.html as 200)
    "notfound": ("404.html", "페이지를 찾을 수 없습니다 - STYL.AI", "요청한 페이지가 없습니다.", []),
}

a = lambda s: html.escape(str(s), quote=True)  # attribute / plain-text escape


def load_looks():
    looks = [json.loads(p.read_text(encoding="utf-8")) for p in sorted((SRC / "looks").glob("look-*.json"))]
    for lk in looks:
        assert len(lk["items"]) == 4, f"LOOK {lk['no']} needs 4 items"
        for it in lk["items"]:
            assert (ROOT / it["img"]).exists(), f"missing image {it['img']}"
    return looks


def render_look(lk):
    no, file = lk["no"], f"look-{lk['no']}.html"
    out = []
    w = out.append
    w('      <article class="prose-s">')
    w('        <div class="px-4 pt-4 pb-3 border-b border-hairline-border">')
    w('          <div class="flex items-center gap-1.5 not-prose">')
    w(f'            <span class="px-2 py-0.5 rounded bg-editorial-charcoal text-white text-[11px] font-bold">LOOK {no}</span>')
    w(f'            <span class="px-2 py-0.5 rounded bg-fresh-beige text-on-secondary-container text-[11px] font-semibold border border-hairline-border">{lk["tag"]}</span>')
    w('          </div>')
    w(f'          <h1 class="font-headline-md text-[26px] leading-tight text-primary mt-2">{lk["title"]}</h1>')
    w(f'          <p class="text-[13px] text-on-surface-variant mt-1">{lk["intro"]}</p>')
    w(f'          <p class="text-[11px] text-warm-taupe mt-2">작성·검토 {lk["reviewed"]} · STYL.AI 편집</p>')
    w('          <div class="flex gap-2 mt-3">')
    w(f'            <button type="button" class="btn" data-save-id="look-{no}" data-save-title="LOOK {no} {a(lk["title"])}" data-save-url="{file}" data-save-note="{a(lk["save_note"])}">')
    w('              <span class="material-symbols-outlined text-[18px]">bookmark_border</span><span data-save-label>저장</span>')
    w('            </button>')
    w(f'            <button type="button" class="btn" data-copy-link="{file}"><span class="material-symbols-outlined text-[18px]">link</span>링크 복사</button>')
    w('          </div>')
    w('        </div>')
    # tiles
    w('        <div class="px-4 py-3">')
    w('          <figure class="card overflow-hidden m-0">')
    w('            <div class="grid grid-cols-2 gap-px bg-hairline-border">')
    for i, it in enumerate(lk["items"], 1):
        w(f'              <a href="#item-{i}" class="tile"><img alt="{a(it["alt"])}" loading="eager" onerror="this.style.visibility=\'hidden\'" src="{it["img"]}"><span><b>{i:02d}</b>{it["short"]}</span></a>')
    w('            </div>')
    w('            <figcaption class="p-3 text-[12px] text-on-surface-variant border-t border-hairline-border">사진을 누르면 아이템 설명으로 이동합니다. 아이템 사진은 AI 이미지 생성 도구로 만든 연출 이미지이며 특정 브랜드 상품이 아닙니다.</figcaption>')
    w('          </figure>')
    w('        </div>')
    w('        <div class="px-4">')
    w('          <div class="note-box">')
    w('            <p class="kicker m-0">한 줄 요약</p>')
    w(f'            <p class="m-0 mt-1">{lk["summary"]}</p>')
    w('          </div>')
    w('        </div>')
    # items
    w('        <section class="px-4" aria-labelledby="h-items">')
    w('          <h2 id="h-items">구성 아이템 4가지</h2>')
    w('          <p>특정 상품이 아니라 <strong>어떤 조건의 아이템을 고르면 되는지</strong>를 적었습니다. 가격은 국내 온라인 매장 기준의 대략적인 예시 범위이며 브랜드·시즌·할인에 따라 크게 달라집니다.</p>')
    w('          <div class="flex flex-col gap-3 not-prose">')
    for i, it in enumerate(lk["items"], 1):
        w(f'            <div class="card p-3" id="item-{i}">')
        w('              <div class="flex gap-3">')
        w(f'                <img alt="{a(it["thumb_alt"])}" class="w-20 h-24 rounded-lg object-cover bg-fresh-beige shrink-0" loading="lazy" onerror="this.style.visibility=\'hidden\'" src="{it["img"]}">')
        w('                <div class="min-w-0">')
        w(f'                  <span class="text-[10px] font-bold text-on-secondary-container bg-secondary-container px-1.5 rounded">{i:02d} {it["cat"]}</span>')
        w(f'                  <h3 class="text-[15px] font-bold text-primary mt-1">{it["name"]}</h3>')
        w(f'                  <p class="text-[12px] text-on-surface-variant">{it["meta"]}</p>')
        w(f'                  <p class="text-[12px] text-primary mt-1">예시 가격대 {it["price"]}</p>')
        w('                </div>')
        w('              </div>')
        w('              <details class="mt-2 text-[13px]">')
        w('                <summary class="cursor-pointer font-semibold text-on-secondary-container">고를 때 확인할 점</summary>')
        w('                <ul class="list-disc pl-5 mt-1 space-y-1">')
        for c in it["checks"]:
            w(f'                  <li>{c}</li>')
        w('                </ul>')
        if it.get("link"):
            w(f'                <a class="underline text-on-secondary-container" href="{a(it["link"]["href"])}">{it["link"]["text"]}</a>')
        w('              </details>')
        w('            </div>')
    w('          </div>')
    w('        </section>')
    # 1. why
    w('        <section class="px-4" aria-labelledby="h-why">')
    w(f'          <h2 id="h-why">1. {lk["why_title"]}</h2>')
    for blk in lk["why"]:
        w(f'          <h3>{blk["h"]}</h3>')
        w(f'          <p>{blk["p"]}</p>')
        if blk.get("palette"):
            w('          <div class="table-wrap not-prose">')
            w('            <div class="grid grid-cols-4 gap-2 my-2">')
            for hexv, name, item in lk["palette"]:
                w(f'              <div class="text-center text-[11px]"><div class="h-9 rounded-md border border-hairline-border" style="background:{a(hexv)}"></div><b class="block mt-1">{name}</b>{item}</div>')
            w('            </div>')
            w('          </div>')
    w('        </section>')
    # 2. when
    w('        <section class="px-4" aria-labelledby="h-when">')
    w('          <h2 id="h-when">2. 어울리는 상황</h2>')
    w('          <div class="table-wrap">')
    w('            <table>')
    w('              <thead><tr><th>상황</th><th>적합도</th><th>바꾸면 좋은 점</th></tr></thead>')
    w('              <tbody>')
    for s, fit, chg in lk["when"]:
        w(f'                <tr><td>{s}</td><td>{fit}</td><td>{chg}</td></tr>')
    w('              </tbody>')
    w('            </table>')
    w('          </div>')
    w('        </section>')
    # 3. avoid
    w('        <section class="px-4" aria-labelledby="h-avoid">')
    w('          <h2 id="h-avoid">3. 피하면 좋은 조합</h2>')
    w('          <ul>')
    for head, why in lk["avoid"]:
        w(f'            <li><strong>{head}</strong> — {why}</li>')
    w('          </ul>')
    w('        </section>')
    # 4. budget
    w('        <section class="px-4" aria-labelledby="h-budget">')
    w('          <h2 id="h-budget">4. 예산별 대안</h2>')
    w(f'          <p>{lk["budget_intro"]}</p>')
    w('          <div class="table-wrap">')
    w('            <table>')
    w('              <thead><tr><th>예산 (4종 합계 예시)</th><th>추천 구성</th><th>차이</th></tr></thead>')
    w('              <tbody>')
    for rng, comp, diff in lk["budget"]:
        w(f'                <tr><td>{rng}</td><td>{comp}</td><td>{diff}</td></tr>')
    w('              </tbody>')
    w('            </table>')
    w('          </div>')
    w('          <p class="text-[12px] text-on-surface-variant">가격은 이해를 돕기 위한 대략적인 범위이며, 특정 판매처의 가격을 확인한 것이 아닙니다.</p>')
    w('        </section>')
    # 5. fit
    w('        <section class="px-4" aria-labelledby="h-fit">')
    w('          <h2 id="h-fit">5. 입어 보고 확인할 핏 기준</h2>')
    w('          <ol>')
    for label, txt in lk["fit"]:
        w(f'            <li><strong>{label}</strong>: {txt}</li>')
    w('          </ol>')
    w(f'          <p>{lk["fit_note"]}</p>')
    w('        </section>')
    # 6. care
    w('        <section class="px-4" aria-labelledby="h-care">')
    w('          <h2 id="h-care">6. 소재와 관리 방법</h2>')
    w('          <p>관리는 항상 <strong>옷 안쪽 품질표시(케어 라벨)</strong>가 우선입니다. 아래는 라벨이 없거나 지워졌을 때 참고할 일반적인 방법입니다.</p>')
    w('          <div class="table-wrap">')
    w('            <table>')
    w('              <thead><tr><th>아이템·소재</th><th>착용감</th><th>관리</th></tr></thead>')
    w('              <tbody>')
    for item, feel, care in lk["care"]:
        w(f'                <tr><td>{item}</td><td>{feel}</td><td>{care}</td></tr>')
    w('              </tbody>')
    w('            </table>')
    w('          </div>')
    w('          <p class="text-[12px] text-on-surface-variant">세탁 기호는 국제 표준 ISO 3758을 바탕으로 한 표시가 널리 쓰입니다. 라벨의 기호를 우선 따르세요.</p>')
    w('        </section>')
    # next
    w('        <section class="px-4" aria-labelledby="h-next">')
    w('          <h2 id="h-next">다음으로 보기</h2>')
    w('          <div class="flex flex-col gap-2 not-prose">')
    for n in lk["next"]:
        w(f'            <a href="{a(n["href"])}" class="card p-3 flex items-center justify-between"><span><b class="text-primary">{n["title"]}</b><span class="block text-[12px] text-on-surface-variant">{n["desc"]}</span></span><span class="material-symbols-outlined">arrow_forward</span></a>')
    w('            <a href="lookbook.html" class="card p-3 flex items-center justify-between"><span><b class="text-primary">다른 룩북 보기</b><span class="block text-[12px] text-on-surface-variant">상황별 출근 코디 모음</span></span><span class="material-symbols-outlined">arrow_forward</span></a>')
    w('          </div>')
    w('        </section>')
    w('      </article>')
    return "\n".join(out)


def render_list(looks):
    out = []
    w = out.append
    w('      <div class="px-4 pt-4">')
    w('        <p class="kicker m-0">Lookbook</p>')
    w('        <h1 class="font-headline-md text-[26px] leading-tight text-primary mt-1">코디 룩북</h1>')
    w(f'        <p class="text-[13px] text-on-surface-variant mt-1">상황별 출근 코디 {len(looks)}가지입니다. 룩마다 조합 이유, 어울리는 상황, 피할 조합, 예산별 대안, 핏 확인법, 관리법을 함께 정리했습니다.</p>')
    w('      </div>')
    w('      <div class="px-4 mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">')
    for lk in looks:
        no = lk["no"]
        w(f'        <a href="look-{no}.html" class="card overflow-hidden block">')
        w('          <div class="grid grid-cols-2 gap-px bg-hairline-border" aria-hidden="true">')
        for it in lk["items"]:
            w(f'            <img alt="" class="w-full aspect-square object-cover bg-fresh-beige" loading="lazy" onerror="this.style.visibility=\'hidden\'" src="{it["img"]}">')
        w('          </div>')
        w('          <div class="p-3">')
        w('            <div class="flex flex-wrap items-center gap-1.5">')
        w(f'              <span class="px-2 py-0.5 rounded bg-editorial-charcoal text-white text-[11px] font-bold">LOOK {no}</span>')
        for t in lk["card_tags"]:
            w(f'              <span class="px-2 py-0.5 rounded bg-fresh-beige text-on-secondary-container text-[11px] font-semibold border border-hairline-border">{t}</span>')
        w('            </div>')
        w(f'            <h2 class="font-headline-md text-[19px] text-primary mt-1.5 leading-snug">{lk["title"]}</h2>')
        w(f'            <p class="text-[13px] text-on-surface-variant mt-0.5">{lk["card_text"]}</p>')
        w('            <span class="text-[13px] font-semibold text-on-secondary-container mt-2 inline-flex items-center gap-1">룩북 읽기 <span class="material-symbols-outlined text-[18px]">arrow_forward</span></span>')
        w('          </div>')
        w('        </a>')
    w('      </div>')
    return "\n".join(out)


def write_page(layout, out, title, desc, nav_slug, scripts, body):
    # Cloudflare Pages serves /guide for guide.html (and redirects the .html form), so canonicals drop .html
    path = "" if out == "index.html" else out[:-len(".html")]
    tags = "\n".join(f'  <script src="{s}"></script>' for s in scripts)
    page = (layout
            .replace("{{title}}", a(title))
            .replace("{{description}}", a(desc))
            .replace("{{path}}", path)
            .replace("{{slug}}", nav_slug)
            .replace("{{scripts}}", tags)
            .replace("{{body}}", body))
    if out == "404.html":
        canon = f'<link rel="canonical" href="{SITE}{path}">'
        assert canon in page
        # served at any depth (e.g. /a/b), so resolve assets and links from the site root
        page = page.replace(canon, '<meta name="robots" content="noindex">\n  <base href="/">')
    assert "{{" not in page, f"unfilled placeholder in {out}"
    (ROOT / out).write_text(page, encoding="utf-8", newline="\n")
    print("built", out)


def build():
    layout = (SRC / "layout.html").read_text(encoding="utf-8")
    for slug, (out, title, desc, scripts) in PAGES.items():
        body = (SRC / "pages" / f"{slug}.html").read_text(encoding="utf-8").rstrip()
        write_page(layout, out, title, desc, slug, scripts, body)
    looks = load_looks()
    write_page(layout, "lookbook.html", "코디 룩북 - STYL.AI",
               "면접·평소 출근·금요일 캐주얼·겨울까지, 상황별 출근 코디를 조합 이유와 예산·핏·관리법까지 정리한 룩북 모음.",
               "lookbook", [], render_list(looks))
    for lk in looks:
        write_page(layout, f"look-{lk['no']}.html", f"LOOK {lk['no']} {lk['title']} - STYL.AI",
                   lk["meta_description"], "lookbook", [], render_look(lk))


if __name__ == "__main__":
    build()
