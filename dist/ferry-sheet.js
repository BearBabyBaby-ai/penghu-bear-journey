// 交通船資訊：即時讀取熊熊綜合系統試算表「交通船資訊」工作表（公開 CSV，不需 API 金鑰）。
// 讀不到時（離線、Google 暫時錯誤）回傳 null，由遊戲改用內建航線檔。
export const FERRY_SHEET={id:'1LOr4_3ugTHvTIi4UIfgVz2atVFh2K32zh7YKrrHxTwk',gid:777010,name:'交通船資訊'};

export function parseCSV(text){
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++}else quoted=false}else cell+=c;continue}
    if(c==='"')quoted=true;else if(c===','){row.push(cell);cell=''}else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell=''}else cell+=c;
  }
  if(cell!==''||row.length){row.push(cell);rows.push(row)}
  return rows.filter(r=>r.some(v=>v.trim()!==''));
}

// 以標題列對應欄位；必要欄位缺少時視為格式不符
export function ferryRowsFromCSV(text){
  const [head,...body]=parseCSV(text);if(!head)return null;
  const h=head.map(s=>s.trim()),need=['航線','營運單位','出發港','抵達港'];if(need.some(k=>!h.includes(k)))return null;
  const col=k=>h.indexOf(k),get=(r,k)=>col(k)<0?'':String(r[col(k)]??'').trim();
  return body.map(r=>({route:get(r,'航線'),operator:get(r,'營運單位'),vessel:get(r,'船名'),from:get(r,'出發港'),to:get(r,'抵達港'),source:get(r,'官方時刻表／航線資料'),note:get(r,'遊戲說明'),date:get(r,'整理日期').replace(/^'/,'')})).filter(r=>r.from&&r.to);
}

export async function loadFerrySheet(fetcher=globalThis.fetch){
  const base=`https://docs.google.com/spreadsheets/d/${FERRY_SHEET.id}`;
  const urls=[`${base}/export?format=csv&gid=${FERRY_SHEET.gid}&_=${Date.now()}`,`${base}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(FERRY_SHEET.name)}&_=${Date.now()}`];
  for(const url of urls){try{const res=await fetcher(url,{cache:'no-store'});if(!res.ok)continue;const rows=ferryRowsFromCSV(await res.text());if(rows?.length)return rows}catch{}}
  return null;
}
