"""Build the static pages: wraps each src/pages/<slug>.html body in src/layout.html.

Run from anywhere:  python tools/build_pages.py
Edit the files in src/, then rebuild. The generated *.html files at the repo root are what Cloudflare Pages serves.
"""
from pathlib import Path
import html

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"

# slug -> (output file, title, description, extra scripts)
PAGES = {
    "home": ("index.html", "STYL.AI - 직장인을 위한 실용 출근 코디 가이드",
             "출근 코디를 왜 그렇게 입는지, 어디에 맞는지, 예산과 체형에 따라 어떻게 바꾸는지 정리한 직장인 스타일 가이드.", []),
    "lookbook": ("lookbook.html", "LOOK 01 미니멀 테일러드 오피스코어 룩 - STYL.AI",
                 "블레이저·블라우스·와이드 슬랙스·로퍼 출근 코디의 조합 이유, 어울리는 상황, 피할 조합, 예산별 대안, 핏 확인법, 소재·관리법.", []),
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


def build():
    layout = (SRC / "layout.html").read_text(encoding="utf-8")
    for slug, (out, title, desc, scripts) in PAGES.items():
        body = (SRC / "pages" / f"{slug}.html").read_text(encoding="utf-8").rstrip()
        # Cloudflare Pages serves /guide for guide.html (and redirects the .html form), so canonicals drop .html
        path = "" if out == "index.html" else out[:-len(".html")]
        tags = "\n".join(f'  <script src="{s}"></script>' for s in scripts)
        page = (layout
                .replace("{{title}}", html.escape(title))
                .replace("{{description}}", html.escape(desc))
                .replace("{{path}}", path)
                .replace("{{slug}}", slug)
                .replace("{{scripts}}", tags)
                .replace("{{body}}", body))
        if out == "404.html":
            canon = f'<link rel="canonical" href="https://ai-stylelist.pages.dev/{path}">'
            assert canon in page
            # served at any depth (e.g. /a/b), so resolve assets and links from the site root
            page = page.replace(canon, '<meta name="robots" content="noindex">
  <base href="/">')
        assert "{{" not in page, f"unfilled placeholder in {out}"
        (ROOT / out).write_text(page, encoding="utf-8", newline="\n")
        print("built", out)


if __name__ == "__main__":
    build()
