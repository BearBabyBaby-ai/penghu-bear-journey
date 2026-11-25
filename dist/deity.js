// 主祀判斷（與熊熊綜合系統、熊寶系統等共用同一套規則）
/* ===== 主祀判斷（各系統共用）=====
   一間廟有多位主祀時拆開，每一位依資料歸回同一位神明（例：協天大帝(關聖帝君)→關聖帝君、銅陵媽祖→天上聖母、虎將軍→虎爺）；
   畫面一律顯示主祀原文。資料出現新寫法時再補進這張表。 */
export const DEITY_ALIASES = [
  ["關聖帝君", ["關聖帝君","文衡聖帝","文衡關聖帝君","協天大帝","五天聖帝","關公","關帝","恩主公"]],
  ["天上聖母", ["天上聖母","媽祖","銅陵媽祖","天后","天妃","媽祖娘娘"]],
  ["虎爺", ["虎爺","虎將軍"]],
  ["玄天上帝", ["玄天上帝","真武大帝","上帝公","北極大帝","玄天大帝"]],
  ["觀世音菩薩", ["觀世音菩薩","觀音佛祖","觀音菩薩","南海觀世音菩薩","觀音","觀音大士","觀世音","二觀音菩薩"]],
  ["福德正神", ["福德正神","土地公","伯公"]],
  ["中壇元帥", ["中壇元帥","哪吒三太子","哪吒太子","三太子","中壇元帥三太子","太子爺"]],
  ["玉皇大帝", ["玉皇大帝","玉皇大天尊","天公"]],
  ["城隍", ["城隍","城隍尊神","城隍爺"]],
  ["釋迦牟尼佛", ["釋迦牟尼佛","釋迦佛"]],
  ["神農大帝", ["神農大帝","開天仙帝","神農氏"]],
  ["五府千歲", ["五府千歲","五府王爺"]]
];
/* 單一位神明 → 歸回的神明名稱（括號裡的名字也算；同姓的王爺、府王爺、千歲是同一位） */
export function deityName(raw) {
  const s = String(raw || "").replace(/\s/g, "");
  if (!s) return "";
  const inParen = (s.match(/[（(]([^）)]+)[）)]/) || [])[1] || "";
  const bare = s.replace(/[（(].*$/, "");
  for (const [main, names] of DEITY_ALIASES) {
    if (names.includes(s) || names.includes(bare) || (inParen && names.includes(inParen))) return main;
  }
  const wang = s.match(/^([^府王千五諸])府?(王爺|千歲)$/) || s.match(/^([^府王千五諸])王$/);
  if (wang) return wang[1] + "府王爺";
  return s;
}
/* 主祀欄拆成每一位神明（括號裡的頓號不拆） */
export function deitySplit(raw) {
  const out = []; let cur = "", depth = 0;
  for (const ch of String(raw || "")) {
    if (ch === "(" || ch === "（") depth++;
    if (ch === ")" || ch === "）") depth = Math.max(0, depth - 1);
    if (!depth && /[、／/,，;；]/.test(ch)) { if (cur.trim()) out.push(cur.trim()); cur = ""; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
export function deityGroups(raw) { return [...new Set(deitySplit(raw).map(deityName).filter(Boolean))]; }
/* 查詢的字詞是不是這間廟的主祀（別名都算；王爺、千歲找所有王爺；其他照原文包含） */
export function deityHit(raw, query) {
  const q = String(query || "").replace(/\s/g, "");
  if (!q) return false;
  const groups = deityGroups(raw);
  if (groups.includes(deityName(q))) return true;
  if (/^(王爺|千歲)$/.test(q) && groups.some(g => /(王爺|千歲)$/.test(g))) return true;
  return String(raw || "").replace(/\s/g, "").includes(q);
}
/* 這個字詞是不是神明名稱（別名表裡的名字、王爺／千歲） */
export function isDeityWord(query) {
  const q = String(query || "").replace(/\s/g, "");
  if (!q) return false;
  if (/^(王爺|千歲)$/.test(q) || deityName(q) !== q || DEITY_ALIASES.some(([m]) => m === q)) return true;
  return q.length >= 2 && DEITY_ALIASES.some(([, names]) => names.some(n => n.includes(q)));
}
