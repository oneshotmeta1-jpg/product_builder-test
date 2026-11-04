// Tailwind CDN theme shared by every page (Radiant Atelier, see DESIGN.md)
tailwind.config = {
  theme: {
    extend: {
      colors: {
        "primary": "#1f1d1b",
        "secondary": "#8c6b4d",
        "secondary-container": "#faeae0",
        "on-secondary-container": "#69492a",
        "surface": "#faf9f6",
        "on-surface": "#1a1c1a",
        "on-surface-variant": "#4c4640",
        "fresh-beige": "#F4F1EA",
        "hairline-border": "#E8E3DA",
        "editorial-charcoal": "#24211E",
        "warm-taupe": "#8C827A"
      },
      fontFamily: {
        "headline-md": ["Bodoni Moda", "serif"],
        "body": ["Manrope", "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", "sans-serif"]
      }
    }
  }
};
