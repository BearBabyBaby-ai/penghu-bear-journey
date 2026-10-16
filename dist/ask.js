// 問熊寶：本機文字查詢（不連任何 AI／API）。
// 從一句話找出「地區、類別、附近、關鍵字」，只在 data.json 的原表資料裡找，不產生不存在的地點。
import {AREAS,KINDS} from './model.js?v=20261015-travel8';

const AREA_WORDS=AREAS.map(area=>({area,words:[area,area.replace(/[市鄉]$/,'')]}));
const KIND_WORDS={
  food:['美食','好吃','吃的','吃什麼','餐廳','小吃','早餐','午餐','晚餐','宵夜','下午茶','咖啡','冰品','甜點','海鮮','伴手禮','餐'],
  temple:['廟宇','寺廟','宮廟','廟','拜拜','參拜'],
  sight:['景點','好玩','玩','拍照','打卡','風景','觀光']
};
// 常見神明與景物的別名：查詢字詞 → 會一起比對的寫法
const SYNONYMS=[
  ['玄天上帝','北極','真武','上帝'],['媽祖','天后','天上聖母'],['觀音','觀世音','觀音亭'],['王爺','千歲'],
  ['土地公','福德'],['關公','關帝','關聖帝君','武聖'],['保生大帝','大道公'],['沙灘','海灘'],['跨海大橋','大橋']
];
const FILLER=/我想要|我想去|我想|想要|想去|想看|帶我去|帶我|請問|請|幫我|找一下|找|前往|去|到|看看|有什麼|有哪些|有沒有|推薦|哪裡|哪邊|在哪|附近的|附近|最近的|最近|一下|一些|的|嗎|呢|吧|啊|呀|好了|，|。|？|！|\?|!|,|\.|\s+/g;
const NEAR=/附近|最近|周邊|周圍|旁邊/;

const fieldsOf=r=>[['name',r.name,12],['special',r.special,6],['category',r.category,4],['village',r.village,4],['description',r.description,2],['legend',r.legend,1],['festival',typeof r.festival==='string'?r.festival:'',1]];
const bigrams=s=>{const out=[];for(let i=0;i<s.length-1;i++)out.push(s.slice(i,i+2));return out};

export function parseAsk(text){
  const raw=String(text||'').trim();let rest=raw;
  let area='';for(const {area:a,words} of AREA_WORDS){const w=words.find(word=>rest.includes(word));if(w){area=a;rest=rest.replace(w,' ');break}}
  let kind='';for(const [k,words] of Object.entries(KIND_WORDS)){const w=[...words].sort((a,b)=>b.length-a.length).find(word=>rest.includes(word));if(w){kind=k;rest=rest.replace(w,' ');break}}
  const near=NEAR.test(raw);
  const keyword=rest.replace(FILLER,' ').replace(/\s+/g,' ').trim().replace(/\s/g,'');
  // 「玄天上帝廟」去掉類別字後保留「玄天上帝」；類別字仍保留在 kind
  const terms=new Set(keyword?[keyword]:[]);
  for(const group of SYNONYMS)if(group.some(w=>keyword.includes(w)||raw.includes(w)))group.forEach(w=>terms.add(w));
  return {raw,area,kind,near,keyword,terms:[...terms]};
}

function snippet(text,term){const i=text.indexOf(term);if(i<0)return '';const a=Math.max(0,i-12),b=Math.min(text.length,i+term.length+18);return (a?'…':'')+text.slice(a,b)+(b<text.length?'…':'')}

// records：data.records；distanceOf(record)：與熊寶的直線距離（無座標回傳 Infinity）
export function askPlaces(text,records,{distanceOf=()=>Infinity,limit=12}={}){
  const q=parseAsk(text);
  if(!q.raw)return {...q,results:[],total:0};
  let pool=records.filter(r=>(!q.area||r.area===q.area)&&(!q.kind||r.kind===q.kind));
  const scored=[];
  for(const r of pool){
    let score=0,reason='';
    if(q.terms.length){
      for(const [field,value,weight] of fieldsOf(r)){
        const v=String(value||'');if(!v)continue;
        for(const term of q.terms){
          if(v.includes(term)){const s=weight*(term===q.keyword?3:2)*Math.min(term.length,6);if(s>score){score=s;reason=field==='name'?'':snippet(v,term)}}
        }
      }
      if(!score&&q.keyword.length>=2){
        const grams=bigrams(q.keyword);let best=0,why='';
        for(const [field,value,weight] of fieldsOf(r)){const v=String(value||'');const hit=grams.filter(g=>v.includes(g)).length;if(hit&&hit*weight>best){best=hit*weight;why=field==='name'?'':snippet(v,grams.find(g=>v.includes(g)))}}
        const need=Math.max(1,Math.ceil(grams.length*.6));let hits=0;
        for(const [,value] of fieldsOf(r)){const v=String(value||'');hits=Math.max(hits,grams.filter(g=>v.includes(g)).length)}
        if(hits>=need){score=best;reason=why}
      }
      if(!score)continue;
    }else{
      // 只有地區／類別／附近：景點優先、有照片優先
      score=(r.kind==='sight'?3:r.kind==='temple'?2:1)+((r.images||[]).length?1:0);
    }
    const d=distanceOf(r);
    scored.push({record:r,score,reason,distance:d});
  }
  scored.sort((a,b)=>q.near&&!q.keyword?(a.distance-b.distance):(b.score-a.score)||(Number.isFinite(a.distance)?0:1)-(Number.isFinite(b.distance)?0:1)||a.distance-b.distance);
  const summary=q.area&&!q.keyword?Object.fromEntries(Object.keys(KINDS).map(k=>[k,records.filter(r=>r.area===q.area&&r.kind===k).length])):null;
  return {...q,summary,total:scored.length,results:scored.slice(0,limit)};
}
