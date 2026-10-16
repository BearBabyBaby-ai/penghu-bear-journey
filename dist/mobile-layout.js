// 手機版：量出下方卡片（目的地、地圖顯示、底部選單）實際佔用的高度，
// 寫入 CSS 變數 --ui-bottom，讓搖桿與 E 鍵永遠浮在卡片上方，不被遮住。
const root=document.documentElement;
const watched=()=>['#destination','#ask-results','#place-layers','#tide-bar','.dock'].map(s=>document.querySelector(s)).filter(Boolean);
let frame=0;
function update(){
  frame=0;let top=innerHeight;
  for(const el of watched()){if(el.hidden)continue;const r=el.getBoundingClientRect();if(r.height>0&&r.bottom>innerHeight*.5)top=Math.min(top,r.top)}
  root.style.setProperty('--ui-bottom',Math.max(0,Math.round(innerHeight-top))+'px');
}
const schedule=()=>{if(!frame)frame=requestAnimationFrame(update)};
const resize=new ResizeObserver(schedule);watched().forEach(el=>resize.observe(el));
const changes=new MutationObserver(schedule);
changes.observe(document.body,{attributes:true,attributeFilter:['class']});
watched().forEach(el=>changes.observe(el,{attributes:true,attributeFilter:['hidden'],childList:true,subtree:true}));
addEventListener('resize',schedule);addEventListener('orientationchange',schedule);schedule();
