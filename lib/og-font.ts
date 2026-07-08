// 为 OG 图取 Noto Serif SC 的 TTF 子集（next/og 的 Satori 无系统字体，中文必须自带，且只吃 TTF/OTF）。
// 关键：用极旧 UA(Mozilla/4.0)，Google Fonts 才回 truetype 而非 woff2；只取本图用到的字（text= 子集），体积极小。
// 取不到时返回空数组，调用方回落到「无文字」卡片，保证构建不因网络而失败。
export async function loadSerifSubset(text: string): Promise<ArrayBuffer[]> {
  try {
    const api = `https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@700&text=${encodeURIComponent(
      text,
    )}`;
    const cssRes = await fetch(api, { headers: { 'User-Agent': 'Mozilla/4.0' } });
    if (!cssRes.ok) return [];
    const css = await cssRes.text();
    const urls = Array.from(
      css.matchAll(/url\((https:\/\/[^)]+?)\)\s*format\(['"]?truetype/g),
    ).map((m) => m[1]);
    if (urls.length === 0) return [];
    const buffers = await Promise.all(
      urls.map(async (u) => {
        const r = await fetch(u);
        return r.ok ? await r.arrayBuffer() : null;
      }),
    );
    return buffers.filter((b): b is ArrayBuffer => b !== null);
  } catch {
    return [];
  }
}
