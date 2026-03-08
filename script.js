/**
 * JOURNOTE — script.js
 * Extracted & enhanced from journote-v4_2.html
 *
 * localStorage Features:
 *  - PAGES data (all daily/weekly/monthly canvas notes) → key: 'journote_pages'
 *  - NB_DATA (notebook hierarchy with sub-notebooks and pages) → key: 'journote_notebooks'
 *  - Theme preference → key: 'journote_theme'
 *  - Lifespan setting → key: 'journote_lifespan'
 *
 * CRUD: Create (mkWin), Read (loadCanvas / loadHierarchyCanvas), Delete (rmWin)
 */

'use strict';

// ═══════════ CONFIG ═══════════
const BIRTH = new Date(1996,3,12); // Apr 12 1996
const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const ICONS = {text:'✏',voice:'🎙',image:'🖼',video:'🎬',sheet:'📊',mind:'🧠'};
const msDay = 86400000;

// ── Load persisted settings ──
let lifespan = parseInt(localStorage.getItem('journote_lifespan')) || 100;
let isDark = localStorage.getItem('journote_theme') !== 'light';

// Apply theme immediately on load
document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
const tkEl = document.querySelector('.tk');
if (tkEl) tkEl.textContent = isDark ? '🌙' : '☀️';

// ═══════════ HELPERS ═══════════
function now() { return new Date(); }
function getEndDate() { return new Date(BIRTH.getFullYear()+lifespan, BIRTH.getMonth(), BIRTH.getDate()); }
function dim(y,m) { return new Date(y,m,0).getDate(); }
function wom(y,m,d) { return Math.ceil((d+new Date(y,m-1,1).getDay())/7); }
function woy(y,m,d) { const s=new Date(y,0,1),dt=new Date(y,m-1,d); return Math.ceil(((dt-s)/msDay+s.getDay()+1)/7); }
function dk(y,m,d) { return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
function yk(y) { return `year-${y}`; }
function mk(y,m) { return `month-${y}-${m}`; }
function wk2(y,m,w) { return `week-${y}-${m}-${w}`; }
function isAfterBirth(y,m,d) { return new Date(y,m-1,d)>=BIRTH; }
function isBeforeEnd(y,m,d) { return new Date(y,m-1,d)<=getEndDate(); }
let nT;
function showNotif(msg) {
  const n=document.getElementById('notif'); n.textContent=msg; n.classList.add('on');
  clearTimeout(nT); nT=setTimeout(()=>n.classList.remove('on'),1800);
}

// ═══════════ LOCALSTORAGE PERSISTENCE ═══════════

/**
 * Save the full PAGES object to localStorage.
 * Keys are date strings like "2026-03-06" or "year-2026", etc.
 * We serialise only title, type, x, y, w, content — no DOM refs.
 */
function persistPages() {
  try {
    // Sanitise: remove circular refs / DOM elements
    const serialisable = {};
    for (const [k, v] of Object.entries(PAGES)) {
      serialisable[k] = {
        wins: (v.wins || []).map(w => ({
          id: w.id,
          type: w.type,
          title: w.title || '',
          ts: w.ts || '',
          content: w.content || '',
          x: w.x || 0,
          y: w.y || 0,
          w: w.w || 260
        }))
      };
    }
    localStorage.setItem('journote_pages', JSON.stringify(serialisable));
  } catch(e) {
    console.warn('Journote: could not save pages to localStorage', e);
  }
}

/**
 * Load PAGES from localStorage and merge into the in-memory PAGES object.
 * Seed data is preserved for any keys that don't exist in storage.
 */
function loadPersistedPages() {
  try {
    const raw = localStorage.getItem('journote_pages');
    if (!raw) return;
    const stored = JSON.parse(raw);
    for (const [k, v] of Object.entries(stored)) {
      PAGES[k] = v;
    }
  } catch(e) {
    console.warn('Journote: could not load pages from localStorage', e);
  }
}

/**
 * Save NB_DATA (notebook hierarchy) to localStorage.
 */
function persistNotebooks() {
  try {
    localStorage.setItem('journote_notebooks', JSON.stringify(NB_DATA));
  } catch(e) {
    console.warn('Journote: could not save notebooks to localStorage', e);
  }
}

/**
 * Load NB_DATA from localStorage — replaces the default sample data.
 */
function loadPersistedNotebooks() {
  try {
    const raw = localStorage.getItem('journote_notebooks');
    if (!raw) return;
    const stored = JSON.parse(raw);
    NB_DATA.length = 0;
    stored.forEach(nb => NB_DATA.push(nb));
  } catch(e) {
    console.warn('Journote: could not load notebooks from localStorage', e);
  }
}

// ═══════════ PAGE DATA ═══════════
const PAGES = {};
function getPage(k) { if(!PAGES[k]) PAGES[k]={wins:[]}; return PAGES[k]; }
function pNotes(k) { return PAGES[k]?.wins||[]; }
function yNotes(y) {
  const r=[];
  for(let m=1;m<=12;m++) for(let d=1;d<=dim(y,m);d++) { const k=dk(y,m,d); if(PAGES[k]) r.push(...PAGES[k].wins); }
  return r;
}
function mNotes(y,m) {
  const r=[];
  for(let d=1;d<=dim(y,m);d++) { const k=dk(y,m,d); if(PAGES[k]) r.push(...PAGES[k].wins); }
  return r;
}
function wNotes(y,m,w) {
  const r=[];
  for(let d=1;d<=dim(y,m);d++) if(wom(y,m,d)===w) { const k=dk(y,m,d); if(PAGES[k]) r.push(...PAGES[k].wins); }
  return r;
}

// Seed data (used only when no localStorage data exists)
(()=>{
  const S = {
    '1996-04-12':[{type:'text',title:'Birthday 🎂'}],
    '2016-06-01':[{type:'text',title:'Graduation'},{type:'image',title:'Grad photo'}],
    '2020-01-01':[{type:'text',title:'New decade goals'},{type:'sheet',title:'2020 plan'}],
    '2023-04-12':[{type:'text',title:'27th birthday'},{type:'voice',title:'Thoughts'}],
    '2025-04-12':[{type:'text',title:'29th birthday'},{type:'mind',title:'Life plan'}],
  };
  for(const[k,ns] of Object.entries(S))
    PAGES[k]={wins:ns.map((n,i)=>({id:'s'+i,...n,x:60+i*220,y:55+i*25,w:210,content:''}))};
})();

// Load persisted pages AFTER seed (will override seed for existing keys)
loadPersistedPages();

// ═══════════ CURRENT PAGE STATE ═══════════
let curKey = null, curY=0, curM=0, curD=0;
let autoSaveTimer = null;

function updatePageContextBar(label, level) {
  const bar=document.getElementById('page-context-bar');
  if(!bar) return;
  bar.innerHTML=`<span class="pcb-level pcb-${level}">${level}</span><span class="pcb-sep">·</span><span>${label}</span>`;
  bar.classList.add('vis');
}

function openPage(y,m,d) {
  if(curKey) savePage(true);
  curY=y; curM=m; curD=d; curKey=dk(y,m,d);
  const dt = new Date(y,m-1,d);
  const lbl = dt.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
  document.getElementById('canvas-hint').style.display='none';
  updatePageContextBar(lbl, 'day');
  loadCanvas();
}

function openYearPage(y) {
  if(curKey) savePage(true);
  curKey=yk(y); curY=y; curM=0; curD=0;
  document.getElementById('canvas-hint').style.display='none';
  updatePageContextBar(`${y} — Year Overview`, 'year');
  loadHierarchyCanvas('year', y, 0, 0);
}

function openMonthPage(y,m) {
  if(curKey) savePage(true);
  curKey=mk(y,m); curY=y; curM=m; curD=0;
  document.getElementById('canvas-hint').style.display='none';
  updatePageContextBar(`${MO[m-1]} ${y} — Month Overview`, 'month');
  loadHierarchyCanvas('month', y, m, 0);
}

function openWeekPage(y,m,w) {
  if(curKey) savePage(true);
  curKey=wk2(y,m,w); curY=y; curM=m; curD=w;
  let woyN=0;const total=dim(y,m);
  for(let dd=1;dd<=total;dd++){if(wom(y,m,dd)===w){woyN=woy(y,m,dd);break;}}
  document.getElementById('canvas-hint').style.display='none';
  updatePageContextBar(`W${woyN} · ${MO[m-1]} ${y} — Week Overview`, 'week');
  loadHierarchyCanvas('week', y, m, w);
}

function loadHierarchyCanvas(level, y, m, w) {
  const cv=document.getElementById('canvas');
  cv.innerHTML='';
  winSc=1; winPX=60; winPY=60; winSelWin=null; winCount=0;
  const page=getPage(curKey);

  if(page.wins.length===0) {
    if(level==='year') {
      const titleWin=mkWin('text',60,60,false);
      titleWin.style.width='320px';
      const titleEl=titleWin.querySelector('.nw-title');
      if(titleEl) titleEl.value=`${y} — Year Overview`;
      const txt=titleWin.querySelector('.nwtxt');
      if(txt) txt.textContent=`Annual Goals & Intentions for ${y}`;
      MO.forEach((mo,idx)=>{
        const col=idx%3,row=Math.floor(idx/3);
        const wx=60+col*280, wy=180+row*160;
        const mWin=mkWin('text',wx,wy,false);
        mWin.style.width='260px';
        const mTitle=mWin.querySelector('.nw-title');
        if(mTitle) mTitle.value=mo;
        const mTxt=mWin.querySelector('.nwtxt');
        const mns=mNotes(y,idx+1);
        if(mTxt) mTxt.textContent=mns.length?`${mns.length} note${mns.length!==1?'s':''} this month.`:'No notes yet.';
      });
    } else if(level==='month') {
      const titleWin=mkWin('text',60,60,false);
      titleWin.style.width='320px';
      const titleEl=titleWin.querySelector('.nw-title');
      if(titleEl) titleEl.value=`${MO[m-1]} ${y} — Month Overview`;
      const txt=titleWin.querySelector('.nwtxt');
      if(txt) txt.textContent=`Monthly Goals & Reflection for ${MO[m-1]} ${y}`;
      const total=dim(y,m);
      const nwks=Math.ceil((new Date(y,m-1,1).getDay()+total)/7);
      for(let wn=1;wn<=nwks;wn++){
        let woyN=0;for(let dd=1;dd<=total;dd++){if(wom(y,m,dd)===wn){woyN=woy(y,m,dd);break;}}
        const wns=wNotes(y,m,wn);
        const wWin=mkWin('text',60+(wn-1)*280,200,false);
        wWin.style.width='260px';
        const wTitle=wWin.querySelector('.nw-title');
        if(wTitle) wTitle.value=`W${woyN} Summary`;
        const wTxt=wWin.querySelector('.nwtxt');
        if(wTxt) wTxt.textContent=wns.length?`${wns.length} note${wns.length!==1?'s':''} this week.`:'No notes yet.';
      }
    } else if(level==='week') {
      let woyN=0;const total=dim(y,m);
      for(let dd=1;dd<=total;dd++){if(wom(y,m,dd)===w){woyN=woy(y,m,dd);break;}}
      const goalsWin=mkWin('text',60,60,false);
      goalsWin.style.width='300px';
      const gTitle=goalsWin.querySelector('.nw-title');
      if(gTitle) gTitle.value=`W${woyN} — Weekly Goals`;
      const gTxt=goalsWin.querySelector('.nwtxt');
      if(gTxt) gTxt.textContent='Weekly Goals:\n\nTo-do List:\n\nIntentions:';
      const summaryWin=mkWin('text',400,60,false);
      summaryWin.style.width='300px';
      const sTitle=summaryWin.querySelector('.nw-title');
      if(sTitle) sTitle.value=`W${woyN} — Weekly Summary`;
      const sTxt=summaryWin.querySelector('.nwtxt');
      let daySummary='Daily Notes:\n\n';
      for(let d2=1;d2<=total;d2++){
        if(wom(y,m,d2)!==w) continue;
        const dKey=dk(y,m,d2);
        const dns=pNotes(dKey);
        const dow=new Date(y,m-1,d2).getDay();
        daySummary+=`${DOW[dow]} ${MO[m-1]} ${d2}: ${dns.length?dns.map(n=>n.title).join(', '):'No notes'}\n`;
      }
      daySummary+='\nReflection:';
      if(sTxt) sTxt.textContent=daySummary;
    }
    schedAutoSave();
  } else {
    page.wins.forEach((b,i)=>{
      const w2=mkWin(b.type,b.x||60+i*220,b.y||55,false);
      if(b.w) w2.style.width=b.w+'px';
      const titleEl=w2.querySelector('.nw-title');
      if(titleEl&&b.title) titleEl.value=b.title;
      const ts=w2.querySelector('.nw-ts');
      if(ts&&b.ts) ts.textContent=b.ts;
      const txt=w2.querySelector('.nwtxt');
      if(txt&&b.content) txt.textContent=b.content;
    });
  }
  applyT(); upMM();
}

// ── READ: Load a day canvas ──
function loadCanvas() {
  const cv=document.getElementById('canvas');
  cv.innerHTML='';
  winSc=1; winPX=60; winPY=60; winSelWin=null; winCount=0;
  const page=getPage(curKey);
  if(page.wins.length===0) {
    const w=mkWin('text',60,60,false);
    w.querySelector('.nwtxt').textContent='';
    setTimeout(()=>w.querySelector('.nwtxt').focus(),80);
  } else {
    page.wins.forEach((b,i)=>{
      const w=mkWin(b.type,b.x||60+i*220,b.y||55,false);
      if(b.w) w.style.width=b.w+'px';
      const titleEl=w.querySelector('.nw-title');
      if(titleEl&&b.title) titleEl.value=b.title;
      const ts=w.querySelector('.nw-ts');
      if(ts&&b.ts) ts.textContent=b.ts;
      const txt=w.querySelector('.nwtxt');
      if(txt&&b.content) txt.textContent=b.content;
    });
  }
  applyT(); upMM();
}

// ── WRITE + PERSIST: Save current canvas to PAGES & localStorage ──
function savePage(quiet) {
  if(!curKey) return;
  const page=getPage(curKey);
  const wins=document.getElementById('canvas').querySelectorAll('.nw');
  page.wins=Array.from(wins).map(w=>({
    id:w.dataset.id, type:w.dataset.type,
    title:w.querySelector('.nw-title')?.value||'',
    ts:w.querySelector('.nw-ts')?.textContent||'',
    content:w.querySelector('.nwtxt')?.textContent||'',
    x:parseFloat(w.style.left)||0, y:parseFloat(w.style.top)||0, w:w.offsetWidth,
  }));
  persistPages(); // ← Write to localStorage
  if(!quiet) showNotif('✓ Saved');
}

function schedAutoSave() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer=setTimeout(()=>savePage(true),1200);
}

// ═══════════ CANVAS TRANSFORM ═══════════
let winSc=1, winPX=60, winPY=60, winPanning=false;
let winPS={x:0,y:0}, winPO={x:0,y:0}, winCount=0, winSelWin=null;
let winSpDown=false, winTool='select';

function applyT() {
  document.getElementById('canvas').style.transform=`translate(${winPX}px,${winPY}px) scale(${winSc})`;
  document.getElementById('zoomval').textContent=Math.round(winSc*100)+'%';
  upMM();
}
function cvsZoom(d, cx, cy) {
  const r=document.getElementById('main').getBoundingClientRect();
  cx=cx??r.width/2; cy=cy??r.height/2;
  const o=winSc; winSc=Math.max(.1,Math.min(4,winSc+d));
  const rat=winSc/o; winPX=cx-rat*(cx-winPX); winPY=cy-rat*(cy-winPY);
  applyT();
}
function fitView() {
  const bs=document.getElementById('canvas').querySelectorAll('.nw');
  if(!bs.length) return;
  let x1=Infinity,y1=Infinity,x2=-Infinity,y2=-Infinity;
  bs.forEach(b=>{const x=parseFloat(b.style.left),y=parseFloat(b.style.top),w=b.offsetWidth,h=b.offsetHeight;x1=Math.min(x1,x);y1=Math.min(y1,y);x2=Math.max(x2,x+w);y2=Math.max(y2,y+h);});
  const r=document.getElementById('main').getBoundingClientRect();
  const pw=x2-x1+100, ph=y2-y1+100;
  winSc=Math.min(r.width/pw,r.height/ph,1.5);
  winPX=r.width/2-winSc*(x1+pw/2-50); winPY=r.height/2-winSc*(y1+ph/2-50);
  applyT();
}

document.addEventListener('keydown',e=>{if(e.code==='Space'&&!e.target.closest('[contenteditable]')&&!e.target.closest('td')&&!e.target.closest('input'))winSpDown=true;});
document.addEventListener('keyup',e=>{if(e.code==='Space')winSpDown=false;});

const mainEl=document.getElementById('main');
mainEl.addEventListener('wheel',e=>{e.preventDefault();const r=mainEl.getBoundingClientRect();cvsZoom(e.deltaY<0?.08:-.08,e.clientX-r.left,e.clientY-r.top);},{passive:false});
mainEl.addEventListener('mousedown',e=>{
  if(e.button===1||winSpDown||winTool==='pan'){winPanning=true;winPS={x:e.clientX,y:e.clientY};winPO={x:winPX,y:winPY};mainEl.style.cursor='grabbing';e.preventDefault();}
  if(e.target===document.getElementById('canvas')||e.target===mainEl){winDesel();hideCtx();}
  closeAllPanels();
});
document.addEventListener('mousemove',e=>{if(!winPanning)return;winPX=winPO.x+(e.clientX-winPS.x);winPY=winPO.y+(e.clientY-winPS.y);applyT();});
document.addEventListener('mouseup',()=>{winPanning=false;mainEl.style.cursor='';});

// Double-click = CREATE new note window
mainEl.addEventListener('dblclick',e=>{
  if(e.target!==document.getElementById('canvas')&&e.target!==mainEl) return;
  const r=mainEl.getBoundingClientRect();
  const x=(e.clientX-r.left-winPX)/winSc;
  const y=(e.clientY-r.top-winPY)/winSc;
  if(!curKey) {
    const t=now(); curY=t.getFullYear();curM=t.getMonth()+1;curD=t.getDate();curKey=dk(curY,curM,curD);
    document.getElementById('canvas-hint').style.display='none';
  }
  const w=mkWin('text',x-110,y-40,true);
  setTimeout(()=>w.querySelector('.nwtxt').focus(),40);
});
mainEl.addEventListener('contextmenu',e=>{
  e.preventDefault();
  ctxCvX=(e.clientX-mainEl.getBoundingClientRect().left-winPX)/winSc;
  ctxCvY=(e.clientY-mainEl.getBoundingClientRect().top-winPY)/winSc;
  showCtx(e.clientX,e.clientY);
});

// ═══════════ NOTE WINDOW FACTORY (CREATE) ═══════════
function fmtTS(d) {
  return d.toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',hour12:true});
}

/**
 * mkWin — CREATE a new note window on the canvas.
 * @param {string} type  - 'text'|'image'|'voice'|'video'|'sheet'|'mind'
 * @param {number} x     - left position on canvas
 * @param {number} y     - top position on canvas
 * @param {boolean} sel  - whether to select the new window
 * @returns {HTMLElement}
 */
function mkWin(type,x,y,sel) {
  const cv=document.getElementById('canvas');
  const w=document.createElement('div');
  w.className='nw'; w.dataset.type=type; w.dataset.id='w'+(++winCount);
  w.style.left=x+'px'; w.style.top=y+'px'; w.style.width='260px';

  const hd=document.createElement('div'); hd.className='nwhd';
  const dots=document.createElement('div'); dots.className='nw-drag-dots';
  dots.innerHTML='<span><i></i><i></i><i></i></span><span><i></i><i></i><i></i></span>';
  const title=document.createElement('input'); title.className='nw-title';
  title.placeholder='Untitled'; title.type='text';
  title.addEventListener('mousedown',e=>e.stopPropagation());
  title.addEventListener('input',schedAutoSave);
  const ts=document.createElement('div'); ts.className='nw-ts'; ts.textContent=fmtTS(now());
  const xbtn=document.createElement('button'); xbtn.className='nwx'; xbtn.textContent='✕';
  xbtn.onclick=()=>rmWin(w); // DELETE trigger
  hd.appendChild(dots); hd.appendChild(title); hd.appendChild(ts); hd.appendChild(xbtn);
  w.appendChild(hd);

  const body=document.createElement('div'); body.className='nwbody';
  buildContent(body,type,w);
  w.appendChild(body);

  const rz=document.createElement('div'); rz.className='rz';
  w.appendChild(rz);
  cv.appendChild(w);
  makeDrag(w,hd); makeResize(w,rz);
  w.addEventListener('mousedown',e=>{if(e.target!==rz&&!e.target.closest('.nwx'))winSel_(w);});
  w.addEventListener('input',schedAutoSave);
  if(sel) winSel_(w);
  upMM(); schedAutoSave();
  return w;
}

function buildContent(body,type,win) {
  if(type==='text') {
    const t=document.createElement('div'); t.className='nwtxt';
    t.contentEditable='true'; t.setAttribute('data-ph','Start typing…');
    body.appendChild(t);
  } else if(type==='image') {
    buildImageBlock(body,win);
  } else if(type==='voice') {
    buildVoiceBlock(body,win);
  } else if(type==='video') {
    buildVideoBlock(body,win);
  } else if(type==='sheet') {
    buildSheet(body,4,5,win);
  } else if(type==='mind') {
    buildMindMap(body,win);
  }
}

// ─── IMAGE BLOCK ───
function buildImageBlock(body,win) {
  const wrap=document.createElement('div'); wrap.className='nw-img-block';
  const img=document.createElement('img'); img.style.display='none';
  img.style.cssText='max-width:100%;border-radius:6px;display:none;transition:filter .3s;';
  img._brightness=100; img._contrast=100; img._sat=100; img._blur=0;
  img._flipH=false; img._flipV=false; img._rounded=false;
  function applyImgFilter() {
    img.style.filter=`brightness(${img._brightness}%) contrast(${img._contrast}%) saturate(${img._sat}%) blur(${img._blur}px)`;
    img.style.transform=`scaleX(${img._flipH?-1:1}) scaleY(${img._flipV?-1:1})`;
    if(img._rounded) img.style.borderRadius='50%'; else img.style.borderRadius='6px';
  }
  img.applyFilter=applyImgFilter;
  img.addEventListener('click',()=>{selImg(img,win);});
  const placeholder=document.createElement('div'); placeholder.className='nw-img-placeholder';
  placeholder.innerHTML='🖼 Click to upload image';
  placeholder.onclick=()=>{
    document.getElementById('img-input').click();
    document.getElementById('img-input').onchange=e=>{
      const f=e.target.files[0]; if(!f) return;
      const url=URL.createObjectURL(f);
      img.src=url; img.style.display='block'; placeholder.style.display='none';
      e.target.value=''; schedAutoSave(); upMM();
    };
  };
  wrap.appendChild(placeholder); wrap.appendChild(img);
  body.appendChild(wrap);
}
let selImgEl=null;
function selImg(img,win) { selImgEl=img; winSel_(win); }
function applyImgOp(op) {
  if(!selImgEl) return;
  if(op==='flip-h'){selImgEl._flipH=!selImgEl._flipH;}
  else if(op==='flip-v'){selImgEl._flipV=!selImgEl._flipV;}
  else if(op==='round'){selImgEl._rounded=!selImgEl._rounded;}
  else if(op==='fit'){selImgEl.style.maxWidth='100%';selImgEl.style.maxHeight='none';}
  selImgEl.applyFilter();
}
document.getElementById('img-flip-h').onclick=()=>applyImgOp('flip-h');
document.getElementById('img-flip-v').onclick=()=>applyImgOp('flip-v');
document.getElementById('img-round').onclick=()=>applyImgOp('round');
document.getElementById('img-fit').onclick=()=>applyImgOp('fit');
['bright','contrast','sat','blur'].forEach(k=>{
  const el=document.getElementById(`img-${k}`);
  const vEl=document.getElementById(`img-${k}-v`);
  el.addEventListener('input',()=>{
    const v=+el.value;
    if(!selImgEl) return;
    if(k==='bright'){selImgEl._brightness=v;vEl.textContent=v+'%';}
    else if(k==='contrast'){selImgEl._contrast=v;vEl.textContent=v+'%';}
    else if(k==='sat'){selImgEl._sat=v;vEl.textContent=v+'%';}
    else if(k==='blur'){selImgEl._blur=v;vEl.textContent=v+'px';}
    selImgEl.applyFilter();
  });
});
document.getElementById('ins-img-btn').onclick=()=>{closeAllPanels();if(!curKey){const t=now();curY=t.getFullYear();curM=t.getMonth()+1;curD=t.getDate();curKey=dk(curY,curM,curD);document.getElementById('canvas-hint').style.display='none';}const c=cvsCtr();mkWin('image',c.x-130,c.y-80,true);};
document.getElementById('ins-img-url').onclick=()=>{const url=prompt('Image URL:');if(!url)return;if(!curKey){const t=now();curY=t.getFullYear();curM=t.getMonth()+1;curD=t.getDate();curKey=dk(curY,curM,curD);document.getElementById('canvas-hint').style.display='none';}const c=cvsCtr();const w=mkWin('image',c.x-130,c.y-80,true);const img=w.querySelector('img');const ph=w.querySelector('.nw-img-placeholder');if(img&&ph){img.src=url;img.style.display='block';ph.style.display='none';}};

// ─── VOICE BLOCK ───
function buildVoiceBlock(body,win) {
  const wrap=document.createElement('div'); wrap.className='nw-voice';
  const row=document.createElement('div'); row.className='voice-row';
  const btn=document.createElement('button'); btn.className='vplay'; btn.textContent='🎙';
  btn.title='Click to record / stop';
  const wave=document.createElement('div'); wave.className='vwave';
  for(let i=0;i<14;i++){const b=document.createElement('div');b.className='vbar';b.style.cssText=`height:${5+Math.random()*13}px;animation-delay:${i*.07}s;animation-play-state:paused;`;wave.appendChild(b);}
  const dur=document.createElement('span'); dur.className='vdur'; dur.textContent='0:00';
  const status=document.createElement('div');
  status.style.cssText='font-family:"DM Mono",monospace;font-size:8px;color:var(--tx4);padding:2px 0;';
  status.textContent='Click 🎙 to start recording';
  let recState=false, mr=null, chunks=[], startMs=0, ticker=null, stream=null;

  function stopWaveAnim(){ wave.querySelectorAll('.vbar').forEach(b=>b.style.animationPlayState='paused'); }
  function startWaveAnim(){ wave.querySelectorAll('.vbar').forEach(b=>b.style.animationPlayState='running'); }

  function onRecordingDone(blob) {
    const url=URL.createObjectURL(blob);
    const player=document.createElement('audio');
    player.controls=true; player.preload='auto';
    player.src=url;
    player.style.cssText='width:100%;margin-top:6px;border-radius:6px;';
    wrap.insertBefore(player,acts);
    status.textContent='Recording saved · '+dur.textContent;
    btn.textContent='🎙'; btn.title='Record again';
    schedAutoSave();
  }

  btn.onclick=async()=>{
    if(!recState){
      try{
        stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
        chunks=[];
        const mimes=['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/mp4',''];
        let mimeType=mimes.find(m=>m===''||MediaRecorder.isTypeSupported(m))||'';
        mr=new MediaRecorder(stream, mimeType?{mimeType}:{});
        mr.ondataavailable=e2=>{if(e2.data&&e2.data.size>0)chunks.push(e2.data);};
        mr.onstop=()=>{
          const blob=new Blob(chunks,{type:mr.mimeType||'audio/webm'});
          onRecordingDone(blob);
          stream.getTracks().forEach(t=>t.stop());stream=null;
        };
        mr.start(100);
        recState=true; startMs=Date.now();
        btn.textContent='⏹'; btn.classList.add('rec');
        startWaveAnim();
        status.textContent='● Recording…';
        ticker=setInterval(()=>{
          const s=Math.floor((Date.now()-startMs)/1000);
          dur.textContent=fmtDur(s);
        },500);
        showNotif('🔴 Recording started');
      }catch(err){
        showNotif('Mic: '+(err.message||'not available'));
        status.textContent='Mic error: '+err.message;
      }
    } else {
      recState=false;
      clearInterval(ticker);
      btn.classList.remove('rec');
      stopWaveAnim();
      status.textContent='Processing…';
      if(mr&&mr.state!=='inactive') mr.stop();
    }
  };

  const acts=document.createElement('div'); acts.className='voice-actions';
  const sttBtn=document.createElement('button'); sttBtn.className='voice-act'; sttBtn.textContent='🤖 Transcribe';
  sttBtn.onclick=()=>{
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){showNotif('Speech recognition not available in this browser');return;}
    const r2=new SR();r2.lang='en-US';r2.continuous=false;r2.interimResults=false;
    status.textContent='🎤 Listening…';
    r2.onresult=ev=>{
      const txt=Array.from(ev.results).map(r3=>r3[0].transcript).join(' ');
      insertTranscript(txt, body, acts);
      status.textContent='Transcribed ✓';
    };
    r2.onerror=e2=>{status.textContent='STT error: '+e2.error;};
    r2.onend=()=>{ if(status.textContent==='🎤 Listening…') status.textContent='No speech detected'; };
    r2.start();
    showNotif('Listening… speak now');
  };
  acts.appendChild(sttBtn);

  row.appendChild(btn); row.appendChild(wave); row.appendChild(dur);
  wrap.appendChild(row); wrap.appendChild(status); wrap.appendChild(acts);
  body.appendChild(wrap);
}

function insertTranscript(txt, body, acts) {
  const txtBlk=document.createElement('div');
  txtBlk.className='nwtxt'; txtBlk.contentEditable='true';
  txtBlk.setAttribute('data-ph','Transcription…');
  txtBlk.style.cssText='border-left:2px solid var(--acc2);padding-left:6px;margin-top:4px;';
  txtBlk.textContent=txt;
  body.insertBefore(txtBlk, acts);
  schedAutoSave();
}

function fmtDur(s){return`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;}
document.getElementById('ins-voice-btn').onclick=()=>{closeAllPanels();ensurePage();const c=cvsCtr();mkWin('voice',c.x-130,c.y-70,true);};

// Upload audio file
document.getElementById('upload-audio-btn')?.addEventListener('click',()=>{
  document.getElementById('audio-input').click();
  document.getElementById('audio-input').onchange=e=>{
    const f=e.target.files[0]; if(!f) return;
    ensurePage();
    const c=cvsCtr(); const w=mkWin('voice',c.x-130,c.y-70,true);
    const player=document.createElement('audio');
    player.controls=true; player.src=URL.createObjectURL(f);
    player.style.cssText='width:100%;margin-top:6px;border-radius:6px;';
    const body=w.querySelector('.nwbody');
    if(body) body.appendChild(player);
    e.target.value=''; schedAutoSave();
  };
});

document.getElementById('stt-btn').onclick=()=>{
  if(!('webkitSpeechRecognition'in window||'SpeechRecognition'in window)){showNotif('Not supported in this browser');return;}
  showNotif('Click mic button in voice block to start');
};

// ─── VIDEO BLOCK ───
function buildVideoBlock(body,win) {
  const wrap=document.createElement('div'); wrap.className='nw-video';
  const ph=document.createElement('div'); ph.className='nw-img-placeholder'; ph.innerHTML='🎬 Click to upload video';
  const v=document.createElement('video'); v.controls=true; v.style.cssText='display:none;max-width:100%;border-radius:6px;margin-top:2px;';
  ph.onclick=()=>{
    document.getElementById('vid-input').click();
    document.getElementById('vid-input').onchange=e=>{
      const f=e.target.files[0]; if(!f) return;
      v.src=URL.createObjectURL(f); v.style.display='block'; ph.style.display='none';
      e.target.value=''; schedAutoSave();
    };
  };
  wrap.appendChild(ph); wrap.appendChild(v); body.appendChild(wrap);
}
document.getElementById('ins-video-btn').onclick=()=>{closeAllPanels();ensurePage();const c=cvsCtr();mkWin('video',c.x-130,c.y-80,true);};
document.getElementById('vid-loop').onclick=()=>{const v=winSelWin?.querySelector('video');if(v)v.loop=!v.loop;};
document.getElementById('vid-mute').onclick=()=>{const v=winSelWin?.querySelector('video');if(v)v.muted=!v.muted;};
document.getElementById('vid-fullscreen').onclick=()=>{const v=winSelWin?.querySelector('video');if(v&&v.requestFullscreen)v.requestFullscreen();};
document.getElementById('ins-video-url')?.addEventListener('click',()=>{
  const url=prompt('Video URL (YouTube embed, mp4, etc.):');if(!url)return;
  ensurePage();const c=cvsCtr();
  const w=mkWin('video',c.x-130,c.y-80,true);
  const vEl=w.querySelector('video'); const ph=w.querySelector('.nw-img-placeholder');
  if(vEl&&ph){vEl.src=url;vEl.style.display='block';ph.style.display='none';}
});

// ─── SHEET (TABLE) ───
let focusTd=null;
document.addEventListener('focusin',e=>{if(e.target.tagName==='TD'||e.target.tagName==='TH')focusTd=e.target;});

function buildSheet(body,cols,rows,win) {
  const outer=document.createElement('div'); outer.className='sh-wrap';
  const tblWrap=document.createElement('div'); tblWrap.className='sh-tbl-wrap';
  const tbl=document.createElement('table'); tbl.className='shtbl';
  for(let r=0;r<rows;r++){
    const tr=tbl.insertRow();
    for(let c=0;c<cols;c++){
      const td=tr.insertCell();
      td.contentEditable='true';
      td.addEventListener('input',schedAutoSave);
      td.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();focusTd=td;showCtxTable(e.clientX,e.clientY);});
      td.addEventListener('focusin',()=>focusTd=td);
    }
  }
  tblWrap.appendChild(tbl);
  outer.appendChild(tblWrap);
  body.appendChild(outer);
  return outer;
}

function doSheetOp(op,color) {
  const allTbls=document.querySelectorAll('.shtbl');
  let tbl=null;
  if(focusTd) tbl=focusTd.closest('.shtbl');
  if(!tbl&&allTbls.length) tbl=allTbls[allTbls.length-1];
  if(!tbl) return;
  const rows=Array.from(tbl.rows);
  const cols=rows[0]?.cells.length||0;
  let ri=focusTd?Array.from(tbl.rows).findIndex(r=>r.contains(focusTd)):-1;
  let ci=focusTd?Array.from(focusTd.parentElement.cells).indexOf(focusTd):-1;

  function mkTd(){
    const td=document.createElement('td');td.contentEditable='true';
    td.addEventListener('input',schedAutoSave);
    td.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();focusTd=td;showCtxTable(e.clientX,e.clientY);});
    td.addEventListener('focusin',()=>focusTd=td);
    return td;
  }

  if(op==='insRowAbove'||op==='insRowBelow'){
    if(ri<0)ri=rows.length;
    const idx=op==='insRowAbove'?ri:ri+1;
    const nr=tbl.insertRow(Math.min(idx,tbl.rows.length));
    for(let c=0;c<cols;c++) nr.appendChild(mkTd());
  }else if(op==='insColLeft'||op==='insColRight'){
    if(ci<0)ci=0;const ins=op==='insColLeft'?ci:ci+1;
    rows.forEach(r=>{const td=mkTd();if(ins>=r.cells.length)r.appendChild(td);else r.insertBefore(td,r.cells[ins]);});
  }else if(op==='delRow'){if(ri>=0&&rows.length>1)tbl.deleteRow(ri);}
  else if(op==='delCol'){if(ci>=0&&cols>1)rows.forEach(r=>{if(r.cells[ci])r.deleteCell(ci);});}
  else if(op==='selRow'){clearSel(tbl);if(ri>=0)Array.from(rows[ri].cells).forEach(td=>td.classList.add('sel-r'));}
  else if(op==='selCol'){clearSel(tbl);if(ci>=0)rows.forEach(r=>{if(r.cells[ci])r.cells[ci].classList.add('sel-col');});}
  else if(op==='selAll'){clearSel(tbl);rows.forEach(r=>Array.from(r.cells).forEach(td=>td.classList.add('sel-c')));}
  else if(op==='hideBorders'){tbl.closest('.sh-wrap')?.classList.toggle('no-border');}
  else if(op==='shade'){const sel=tbl.querySelectorAll('.sel-c,.sel-r,.sel-col');if(sel.length)sel.forEach(td=>td.style.background=color);else if(focusTd)focusTd.style.background=color;}
  else if(op==='delTable'){tbl.closest('.sh-wrap')?.remove();}
  else if(op==='insNested'){if(focusTd&&focusTd.tagName==='TD'){const inner=document.createElement('div');buildSheet(inner,3,3,winSelWin);focusTd.appendChild(inner);}}
  schedAutoSave();
}
function clearSel(tbl){tbl.querySelectorAll('.sel-c,.sel-r,.sel-col').forEach(td=>td.classList.remove('sel-c','sel-r','sel-col'));}

// Grid picker
(()=>{
  const gp=document.getElementById('grid-picker');
  const gl=document.getElementById('grid-label');
  const MAX=8;
  for(let r=1;r<=MAX;r++){
    const row=document.createElement('div');row.style.display='flex';row.style.gap='2px';
    for(let c=1;c<=MAX;c++){
      const cell=document.createElement('div');
      cell.style.cssText='width:16px;height:16px;border-radius:2px;border:1px solid var(--brd);cursor:pointer;transition:background .1s,border-color .1s;';
      cell.dataset.r=r;cell.dataset.c=c;
      cell.addEventListener('mouseenter',()=>{
        gl.textContent=`${c} × ${r} table`;
        const cr=+cell.dataset.r,cc=+cell.dataset.c;
        gp.querySelectorAll('div>div').forEach(el=>{
          const er=+el.dataset.r,ec=+el.dataset.c;
          if(er<=cr&&ec<=cc){el.style.background='var(--acc)';el.style.borderColor='var(--acc)';}
          else{el.style.background='';el.style.borderColor='var(--brd)';}
        });
      });
      cell.addEventListener('click',()=>{
        const cr=+cell.dataset.r,cc=+cell.dataset.c;
        closeAllPanels();ensurePage();
        if(winSelWin){
          const body=winSelWin.querySelector('.nwbody');
          if(body){buildSheet(body,cc,cr,winSelWin);showNotif(`${cc}×${cr} table inserted`);schedAutoSave();return;}
        }
        const cv=cvsCtr();const w=mkWin('text',cv.x-130,cv.y-80,true);
        w.querySelector('.nwbody').innerHTML='';buildSheet(w.querySelector('.nwbody'),cc,cr,w);w.dataset.type='text';
        showNotif(`${cc}×${cr} table inserted`);
      });
      row.appendChild(cell);
    }
    gp.appendChild(row);
  }
  gp.addEventListener('mouseleave',()=>{
    gp.querySelectorAll('div>div').forEach(el=>{el.style.background='';el.style.borderColor='var(--brd)';});
    gl.textContent='Hover to select size';
  });
})();

document.querySelectorAll('[data-shop]').forEach(el=>{
  el.addEventListener('click',()=>{
    const op=el.dataset.shop;const color=el.dataset.color||document.getElementById('sh-custom-color').value;
    doSheetOp(op,color);
  });
});
document.getElementById('sh-custom-color').addEventListener('input',e=>{doSheetOp('shade',e.target.value);});
function showCtxTable(x,y){ showCtx(x,y); }

// ─── MIND MAP ───
let activeMindMap=null;
document.getElementById('ins-mind-btn').onclick=()=>{closeAllPanels();ensurePage();const c=cvsCtr();mkWin('mind',c.x-130,c.y-100,true);};

function buildMindMap(body,win) {
  const outer=document.createElement('div');
  const tb=document.createElement('div'); tb.className='mm-tb';
  const ops=[{l:'+ Child',op:'addChild'},{l:'+ Sibling',op:'addSib'},{l:'✕ Del',op:'del',d:true},{l:'✏ Rename',op:'rename'},{l:'⛶',op:'expand'},{l:'◯ Shape',op:'shapeToggle'}];
  ops.forEach(o=>{const b=document.createElement('button');b.className='mmtb'+(o.d?' danger':'');b.textContent=o.l;b.onclick=()=>doMM(wrap,o.op);tb.appendChild(b);});
  ['#c8f562','#9b8eff','#ff9f43','#ff6b6b','#22d3ee','#f43f5e'].forEach(c=>{const s=document.createElement('button');s.className='mmtb';s.style.cssText=`background:${c};color:#111;border-color:${c};width:18px;padding:0;`;s.onclick=()=>doMM(wrap,'colorNode',c);tb.appendChild(s);});
  outer.appendChild(tb);

  const wrap=document.createElement('div'); wrap.className='mm-wrap';
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.className='mm-svg';
  const nd=document.createElement('div'); nd.className='mm-nodes';
  wrap.appendChild(svg); wrap.appendChild(nd);

  wrap._data=[{id:1,label:'Topic',parent:null,x:50,y:50,color:null,shape:'pill'}];
  wrap._sel=wrap._data[0]; wrap._offX=0; wrap._offY=0;

  let mmPanning=false,mmPS={x:0,y:0};
  wrap.addEventListener('mousedown',e=>{
    if(e.target===wrap||e.target===nd||e.target===svg){mmPanning=true;mmPS={x:e.clientX-wrap._offX,y:e.clientY-wrap._offY};}
  });
  document.addEventListener('mousemove',e=>{if(!mmPanning)return;wrap._offX=e.clientX-mmPS.x;wrap._offY=e.clientY-mmPS.y;renderMM(wrap);});
  document.addEventListener('mouseup',()=>{mmPanning=false;});
  wrap.addEventListener('click',e=>{if(e.target===wrap){activeMindMap=wrap;}});

  outer.appendChild(wrap);
  body.appendChild(outer);
  renderMM(wrap);
  activeMindMap=wrap;
  return outer;
}

function doMM(wrap,op,arg) {
  const data=wrap._data; const sel=wrap._sel;
  if(op==='addChild'){
    const parent=sel||data[0];
    const ang=Math.random()*2*Math.PI;const d=110;
    const W=wrap.offsetWidth||280,H=wrap.offsetHeight||280;
    const n={id:Date.now(),label:'Child',parent:parent.id,x:parent.x+(Math.cos(ang)*d/W)*100,y:parent.y+(Math.sin(ang)*d/H)*100,color:null,shape:'pill'};
    data.push(n);wrap._sel=n;renderMM(wrap);schedAutoSave();
  }else if(op==='addSib'){
    const parent=sel?data.find(n=>n.id===sel.parent)||data[0]:data[0];
    const ang=Math.random()*2*Math.PI;const d=110;
    const W=wrap.offsetWidth||280,H=wrap.offsetHeight||280;
    const n={id:Date.now(),label:'Node',parent:parent.id,x:parent.x+(Math.cos(ang)*d/W)*100,y:parent.y+(Math.sin(ang)*d/H)*100,color:null,shape:'pill'};
    data.push(n);wrap._sel=n;renderMM(wrap);schedAutoSave();
  }else if(op==='del'){
    if(!sel||sel.id===data[0].id)return;
    const idx=data.findIndex(n=>n.id===sel.id);if(idx>=0){data.splice(idx,1);wrap._sel=null;renderMM(wrap);schedAutoSave();}
  }else if(op==='rename'){
    if(!sel)return;
    const el=wrap.querySelector(`[data-nid="${sel.id}"]`);
    if(el){const inp=document.createElement('input');inp.value=sel.label;inp.style.cssText='background:transparent;border:none;outline:none;font-family:"DM Mono",monospace;font-size:10px;color:inherit;width:90px;text-align:center;';el.innerHTML='';el.appendChild(inp);inp.focus();inp.select();inp.onblur=()=>{sel.label=inp.value||sel.label;renderMM(wrap);schedAutoSave();};}
  }else if(op==='expand'){
    wrap.classList.toggle('expanded');
  }else if(op==='shapeToggle'){
    if(!sel)return;const shapes=['pill','rect','circle','diamond'];const idx=shapes.indexOf(sel.shape||'pill');sel.shape=shapes[(idx+1)%shapes.length];renderMM(wrap);
  }else if(op==='colorNode'){
    if(!sel)return;sel.color=arg;renderMM(wrap);schedAutoSave();
  }
}

function getNodeStyle(node) {
  const shape=node.shape||'pill';
  if(shape==='rect')return'4px';
  if(shape==='pill')return'20px';
  if(shape==='circle')return'50%';
  if(shape==='diamond')return'0';
  return'7px';
}

function renderMM(wrap) {
  const data=wrap._data,nodesDiv=wrap.querySelector('.mm-nodes');
  const W=Math.max(wrap.offsetWidth||280,200);
  const H=Math.max(wrap.offsetHeight||280,200);
  const oX=wrap._offX,oY=wrap._offY;
  nodesDiv.innerHTML='';
  data.forEach(n=>{
    const el=document.createElement('div');el.className='mm-node'+(n.id===data[0].id?' root':'')+(wrap._sel?.id===n.id?' sel':'');
    el.dataset.nid=n.id;el.textContent=n.label;
    el.style.borderRadius=getNodeStyle(n);
    if(n.color&&n.id!==data[0].id){el.style.background=n.color;el.style.borderColor=n.color;el.style.color='#111';}
    el.style.left=(n.x/100*(W-60)+10)+'px';el.style.top=(n.y/100*(H-40)+10)+'px';
    el.addEventListener('click',e=>{e.stopPropagation();wrap._sel=n;activeMindMap=wrap;renderMM(wrap);});
    el.addEventListener('dblclick',e=>{e.stopPropagation();doMM(wrap,'rename');});
    el.draggable=true;
    el.addEventListener('dragstart',e=>e.dataTransfer.setData('nid',String(n.id)));
    nodesDiv.appendChild(el);
  });
  nodesDiv.addEventListener('dragover',e=>e.preventDefault());
  nodesDiv.addEventListener('drop',e=>{
    e.preventDefault();const nid=+e.dataTransfer.getData('nid');const node=data.find(n=>n.id===nid);if(!node)return;
    const r=nodesDiv.getBoundingClientRect();
    node.x=((e.clientX-r.left-oX)/W)*100;node.y=((e.clientY-r.top-oY)/H)*100;
    renderMM(wrap);schedAutoSave();
  });
  renderMMLines(wrap);
}

function renderMMLines(wrap) {
  const data=wrap._data,svg=wrap.querySelector('.mm-svg');svg.innerHTML='';
  const W=Math.max(wrap.offsetWidth||280,200);
  const H=Math.max(wrap.offsetHeight||280,200);
  const oX=wrap._offX,oY=wrap._offY;
  data.forEach(n=>{
    if(!n.parent)return;const p=data.find(pp=>pp.id===n.parent);if(!p)return;
    const x1=p.x/100*(W-60)+10+oX,y1=p.y/100*(H-40)+10+oY;
    const x2=n.x/100*(W-60)+10+oX,y2=n.y/100*(H-40)+10+oY;
    const mx=(x1+x2)/2;
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d',`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`);
    path.setAttribute('stroke',isDark?'#44445a':'#c0c0d4');path.setAttribute('stroke-width','1.5');path.setAttribute('fill','none');
    svg.appendChild(path);
  });
}

document.querySelectorAll('[data-mmop]').forEach(el=>{
  el.addEventListener('click',()=>{
    if(!activeMindMap){showNotif('Select or insert a mind map first');return;}
    doMM(activeMindMap,el.dataset.mmop);
  });
});
document.querySelectorAll('[data-mind-tmpl]').forEach(el=>{
  el.addEventListener('click',()=>{
    closeAllPanels();ensurePage();const c=cvsCtr();
    const w=mkWin('mind',c.x-130,c.y-100,true);
    const tmpl=el.dataset.mindTmpl;
    const mm=w.querySelector('.mm-wrap');
    if(!mm)return;
    if(tmpl==='tree'){mm._data=[{id:1,label:'Root',parent:null,x:50,y:10,shape:'pill'},{id:2,label:'Branch A',parent:1,x:20,y:40,shape:'pill'},{id:3,label:'Branch B',parent:1,x:50,y:40,shape:'pill'},{id:4,label:'Branch C',parent:1,x:80,y:40,shape:'pill'},{id:5,label:'Leaf 1',parent:2,x:10,y:70,shape:'pill'},{id:6,label:'Leaf 2',parent:3,x:50,y:70,shape:'pill'}];}
    else if(tmpl==='fishbone'){mm._data=[{id:1,label:'Effect',parent:null,x:80,y:50,shape:'rect'},{id:2,label:'Cause 1',parent:1,x:50,y:20,shape:'pill'},{id:3,label:'Cause 2',parent:1,x:50,y:80,shape:'pill'},{id:4,label:'Sub A',parent:2,x:25,y:10,shape:'pill'},{id:5,label:'Sub B',parent:3,x:25,y:90,shape:'pill'}];}
    renderMM(mm);activeMindMap=mm;
    showNotif(`${tmpl} template applied`);
  });
});

// ─── DRAG / RESIZE ───
function makeDrag(win,hd) {
  let drag=false,ox=0,oy=0;
  hd.addEventListener('mousedown',e=>{
    if(e.target.closest('.nw-title'))return;
    if(e.target.closest('.nwx'))return;
    drag=true;
    const r=document.getElementById('canvas').getBoundingClientRect();
    ox=(e.clientX-r.left)/winSc-parseFloat(win.style.left);
    oy=(e.clientY-r.top)/winSc-parseFloat(win.style.top);
    win.classList.add('dragging');winSel_(win);e.stopPropagation();
  });
  document.addEventListener('mousemove',e=>{if(!drag)return;const r=document.getElementById('canvas').getBoundingClientRect();win.style.left=((e.clientX-r.left)/winSc-ox)+'px';win.style.top=((e.clientY-r.top)/winSc-oy)+'px';upMM();});
  document.addEventListener('mouseup',()=>{if(drag){drag=false;win.classList.remove('dragging');schedAutoSave();}});
}
function makeResize(win,rz) {
  let res=false,sx=0,sy=0,sw=0,sh=0;
  rz.addEventListener('mousedown',e=>{res=true;sx=e.clientX;sy=e.clientY;sw=win.offsetWidth;sh=win.offsetHeight;e.stopPropagation();e.preventDefault();});
  document.addEventListener('mousemove',e=>{if(!res)return;win.style.width=Math.max(180,sw+(e.clientX-sx)/winSc)+'px';win.style.minHeight=Math.max(80,sh+(e.clientY-sy)/winSc)+'px';});
  document.addEventListener('mouseup',()=>{if(res){res=false;schedAutoSave();}});
}

function winSel_(w){winDesel();w.classList.add('sel');winSelWin=w;}
function winDesel(){document.getElementById('canvas').querySelectorAll('.sel').forEach(w=>w.classList.remove('sel'));winSelWin=null;}

/**
 * rmWin — DELETE a note window from canvas and trigger save.
 */
function rmWin(w){
  w.style.animation='nwin .14s reverse ease';
  setTimeout(()=>{w.remove();upMM();schedAutoSave();},140);
}

function cvsCtr(){const r=mainEl.getBoundingClientRect();return{x:(r.width/2-winPX)/winSc,y:(r.height/2-winPY)/winSc};}
function ensurePage(){if(!curKey){const t=now();curY=t.getFullYear();curM=t.getMonth()+1;curD=t.getDate();curKey=dk(curY,curM,curD);document.getElementById('canvas-hint').style.display='none';}}

// ═══════════ MINIMAP ═══════════
function upMM() {
  const mc=document.getElementById('mmcanvas');const ctx=mc.getContext('2d');
  ctx.clearRect(0,0,132,84);
  ctx.fillStyle=isDark?'#0a0a0d':'#f4f4f6';ctx.fillRect(0,0,132,84);
  const sx=132/8000,sy=84/8000;
  document.getElementById('canvas').querySelectorAll('.nw').forEach(w=>{
    const x=parseFloat(w.style.left)*sx,y=parseFloat(w.style.top)*sy,ww=w.offsetWidth*sx,h=w.offsetHeight*sy;
    ctx.fillStyle=w.classList.contains('sel')?'#c8f562':'#3a3a55';
    ctx.fillRect(x,y,Math.max(ww,2),Math.max(h,2));
  });
  const r=mainEl.getBoundingClientRect();
  const vx=(-winPX/winSc)*sx,vy=(-winPY/winSc)*sy,vw=(r.width/winSc)*sx,vh=(r.height/winSc)*sy;
  const vi=document.getElementById('mmvp');
  vi.style.left=Math.max(0,vx)+'px';vi.style.top=Math.max(0,vy)+'px';
  vi.style.width=Math.min(vw,132)+'px';vi.style.height=Math.min(vh,84)+'px';
}

// ═══════════ TEXT FORMATTING ═══════════
document.querySelectorAll('[data-cmd]').forEach(btn=>{
  btn.addEventListener('mousedown',e=>{e.preventDefault();document.execCommand(btn.dataset.cmd,false,null);btn.classList.toggle('active');});
});
document.getElementById('ff-sel').addEventListener('change',e=>{
  document.execCommand('fontName',false,e.target.value);
});
document.getElementById('fs-inp').addEventListener('change',e=>{
  document.execCommand('fontSize',false,'7');
  const sel=window.getSelection();if(sel.rangeCount){const span=document.createElement('span');span.style.fontSize=e.target.value+'px';try{sel.getRangeAt(0).surroundContents(span);}catch(err){}}
});
document.querySelectorAll('[data-color]').forEach(el=>{
  el.addEventListener('click',()=>{document.execCommand('foreColor',false,el.dataset.color);});
});
document.getElementById('fc-custom').addEventListener('input',e=>{
  document.execCommand('foreColor',false,e.target.value);
});
document.querySelectorAll('[data-hl]').forEach(el=>{
  el.addEventListener('click',()=>{document.execCommand('hiliteColor',false,el.dataset.hl);});
});

// ═══════════ CONTEXT MENU ═══════════
let ctxCvX=0,ctxCvY=0;
function showCtx(x,y){const m=document.getElementById('ctxmenu');m.style.display='block';m.style.left=x+'px';m.style.top=y+'px';setTimeout(()=>document.addEventListener('click',hideCtxOnce),10);}
function hideCtx(){document.getElementById('ctxmenu').style.display='none';}
function hideCtxOnce(){hideCtx();document.removeEventListener('click',hideCtxOnce);}
['text','image','voice','video','mind'].forEach(t=>{
  document.getElementById('cx-'+t)?.addEventListener('click',()=>{hideCtx();ensurePage();setTimeout(()=>mkWin(t,ctxCvX,ctxCvY,true),0);});
});
document.getElementById('cx-sheet')?.addEventListener('click',()=>{
  hideCtx();ensurePage();
  if(winSelWin){const body=winSelWin.querySelector('.nwbody');if(body){buildSheet(body,4,4,winSelWin);schedAutoSave();showNotif('Table embedded');return;}}
  const w=mkWin('text',ctxCvX,ctxCvY,true);buildSheet(w.querySelector('.nwbody'),4,4,w);schedAutoSave();
});
document.getElementById('cx-clear')?.addEventListener('click',()=>{
  hideCtx();
  if(confirm('Clear this canvas?')){
    document.getElementById('canvas').innerHTML='';
    if(curKey){ getPage(curKey).wins=[]; persistPages(); }
    upMM();
  }
});

// ═══════════ TOOLBAR DROPDOWNS ═══════════
document.querySelectorAll('.tg-btn').forEach(btn=>{
  btn.addEventListener('click',e=>{
    e.stopPropagation();
    const pid=btn.dataset.panel;const panel=document.getElementById(pid);
    const isOpen=panel.classList.contains('vis');
    closeAllPanels();
    if(!isOpen){
      panel.classList.add('vis');btn.classList.add('active');
      const r=btn.getBoundingClientRect();
      panel.style.left=r.left+'px';
    }
  });
});
function closeAllPanels(){
  document.querySelectorAll('.tg-panel').forEach(p=>p.classList.remove('vis'));
  document.querySelectorAll('.tg-btn').forEach(b=>b.classList.remove('active'));
}
document.addEventListener('click',()=>closeAllPanels());

// ═══════════ NAV SWITCHING ═══════════
document.getElementById('nav-tl').addEventListener('click',()=>{
  document.getElementById('nav-tl').classList.add('on');
  document.getElementById('nav-nb').classList.remove('on');
  document.getElementById('tl-view').classList.add('active');
  document.getElementById('nb-view').classList.remove('active');
});
document.getElementById('nav-nb').addEventListener('click',()=>{
  document.getElementById('nav-nb').classList.add('on');
  document.getElementById('nav-tl').classList.remove('on');
  document.getElementById('nb-view').classList.add('active');
  document.getElementById('tl-view').classList.remove('active');
  renderNBMaster();
});

// Sidebar toggle
let sbOpen=true;
document.getElementById('btn-sb-toggle').addEventListener('click',()=>{
  sbOpen=!sbOpen;
  document.getElementById('ctx-sidebar').classList.toggle('collapsed',!sbOpen);
});

// ═══════════ BATTERY + CLOCK ═══════════
function updateClock(){
  const n=now();
  const hh=String(n.getHours()).padStart(2,'0'),mm=String(n.getMinutes()).padStart(2,'0'),ss=String(n.getSeconds()).padStart(2,'0');
  document.getElementById('rtc-t').textContent=`${hh}:${mm}:${ss}`;
  document.getElementById('rtc-d').textContent=n.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
}
setInterval(updateClock,1000); updateClock();

function updateBattery(){
  const n=now();
  const endDate=getEndDate();
  const totalDays=Math.round((endDate-BIRTH)/msDay);
  const lived=Math.floor((n-BIRTH)/msDay);
  const pct=Math.min(100,(lived/totalDays)*100);
  const left=Math.max(0,totalDays-lived);
  let age=n.getFullYear()-BIRTH.getFullYear();
  if(n.getMonth()<BIRTH.getMonth()||(n.getMonth()===BIRTH.getMonth()&&n.getDate()<BIRTH.getDate()))age--;
  const col=pct>80?'#ef4444':pct>60?'#f97316':pct>40?'#facc15':'var(--acc)';
  document.getElementById('bat-pct').textContent=pct.toFixed(1)+'%';
  document.getElementById('bat-pct').style.color=col;
  setTimeout(()=>{document.getElementById('bat-fill').style.width=pct.toFixed(2)+'%';},80);
  document.getElementById('bat-born').textContent='Born: '+BIRTH.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  document.getElementById('bat-dliv').textContent=lived.toLocaleString()+' days';
  document.getElementById('st-age').textContent=age+'y';
  document.getElementById('st-lived').textContent=lived.toLocaleString();
  document.getElementById('st-left').textContent=left.toLocaleString();
  const tk=document.getElementById('bat-ticks');tk.innerHTML='';
  for(let i=0;i<Math.min(lifespan/10,20);i++){const t=document.createElement('div');t.className='bat-tick';tk.appendChild(t);}
}
updateBattery();setInterval(updateBattery,60000);
document.getElementById('ls-in').value=lifespan; // restore saved lifespan
document.getElementById('ls-in').addEventListener('change',e=>{
  const v=+e.target.value;
  if(v>=30&&v<=150){
    lifespan=v;
    localStorage.setItem('journote_lifespan', v); // ← persist lifespan
    updateBattery();renderTL();showNotif('Lifespan → '+v+'yr');
  }
});

// ═══════════ THEME ═══════════
document.getElementById('theme-btn').addEventListener('click',()=>{
  isDark=!isDark;
  document.documentElement.setAttribute('data-theme',isDark?'dark':'light');
  document.querySelector('.tk').textContent=isDark?'🌙':'☀️';
  localStorage.setItem('journote_theme', isDark ? 'dark' : 'light'); // ← persist theme
  upMM();
});

// ═══════════ TIMELINE ═══════════
const openYrs=new Set(),openMos=new Set();
const START_Y=BIRTH.getFullYear();
function getEndY(){return BIRTH.getFullYear()+lifespan;}
function toggleY(y){openYrs.has(y)?openYrs.delete(y):openYrs.add(y);renderTL();}
function toggleM(y,m){const k=`${y}-${m}`;openMos.has(k)?openMos.delete(k):openMos.add(k);renderTL();}

function renderTL(){
  const wrap=document.getElementById('tl-wrap');wrap.innerHTML='';
  const t=now(),END_Y=getEndY();
  function isFutD(y,m,d){return new Date(y,m-1,d)>t;}
  function isFutM(y,m){return y>t.getFullYear()||(y===t.getFullYear()&&m>t.getMonth()+1);}
  function isFutY(y){return y>t.getFullYear();}

  for(let y=START_Y;y<=END_Y;y++){
    const isCurY=y===t.getFullYear(),isFuY=isFutY(y),isOp=openYrs.has(y),ns=yNotes(y);
    const age=y-BIRTH.getFullYear();
    const yb=document.createElement('div');yb.className='yrb';yb.id='yr-'+y;

    const yr=document.createElement('div');yr.className='yrr'+(isCurY?' oc':'')+(isOp?' op':'')+(ns.length?' hn':'')+(isFuY?' fut':'');
    const yrLeft=document.createElement('div');yrLeft.className='yr-left';
    const yrlEl=document.createElement('div');yrlEl.className='yrl';yrlEl.textContent=y;
    const yrAgeEl=document.createElement('div');yrAgeEl.style.cssText='font-family:"DM Mono",monospace;font-size:6px;color:var(--tx4);';yrAgeEl.textContent='Age '+age;
    yrLeft.appendChild(yrlEl);yrLeft.appendChild(yrAgeEl);
    const yrTick=document.createElement('div');yrTick.className='yr-tick';
    const yrRight=document.createElement('div');yrRight.className='yr-right';
    const yc=document.createElement('div');yc.className='yr-chips';
    ns.slice(0,12).forEach(n=>{const c=document.createElement('div');c.style.cssText=`width:${10+Math.random()*26}px;height:4px;border-radius:2px;background:var(--surf4);opacity:.6;`;yc.appendChild(c);});
    const yrArr=document.createElement('span');yrArr.className='tl-arrow';yrArr.textContent=isOp?'▾':'▸';
    yrRight.appendChild(yc);yrRight.appendChild(yrArr);
    yr.appendChild(yrLeft);yr.appendChild(yrTick);yr.appendChild(yrRight);
    yrlEl.addEventListener('click',e=>{e.stopPropagation();openYearPage(y);});
    yr.addEventListener('click',e=>{e.stopPropagation();toggleY(y);const a=yr.querySelector('.tl-arrow');if(a)a.textContent=openYrs.has(y)?'▾':'▸';});
    yb.appendChild(yr);

    // Month expansion
    const mol=document.createElement('div');mol.className='mol-wrap'+(isOp?' op':'');yb.appendChild(mol);
    if(isOp){
      const sm=y===START_Y?BIRTH.getMonth()+1:1;
      const lastMo=y===END_Y?BIRTH.getMonth()+1:12;
      for(let m=sm;m<=lastMo;m++){
        const isCurM=y===t.getFullYear()&&m===t.getMonth()+1,isFuM=isFutM(y,m);
        const moKey=`${y}-${m}`,isMoOp=openMos.has(moKey),mns=mNotes(y,m);
        const mb=document.createElement('div');mb.className='mob';
        const mr=document.createElement('div');mr.className='mor'+(isCurM?' oc':'')+(isMoOp?' op':'')+(mns.length?' hn':'')+(isFuM?' fut':'');
        const moLeft=document.createElement('div');moLeft.className='mo-left';
        const molEl=document.createElement('div');molEl.className='mol';molEl.textContent=MO[m-1];
        moLeft.appendChild(molEl);
        const moTick=document.createElement('div');moTick.className='mo-tick';
        const moRight=document.createElement('div');moRight.className='mo-right';
        const mc=document.createElement('div');mc.className='mochips';
        mns.slice(0,16).forEach(n=>{const s=document.createElement('div');s.className='mosq t-'+n.type;mc.appendChild(s);});
        const moArr=document.createElement('span');moArr.className='tl-arrow';moArr.textContent=isMoOp?'▾':'▸';
        moRight.appendChild(mc);moRight.appendChild(moArr);
        mr.appendChild(moLeft);mr.appendChild(moTick);mr.appendChild(moRight);
        molEl.addEventListener('click',e=>{e.stopPropagation();openMonthPage(y,m);});
        mr.addEventListener('click',e=>{e.stopPropagation();toggleM(y,m);const a=mr.querySelector('.mo-right .tl-arrow');if(a)a.textContent=openMos.has(moKey)?'▾':'▸';});
        mb.appendChild(mr);

        // Week expansion
        const wl=document.createElement('div');wl.className='wkl-wrap'+(isMoOp?' op':'');mb.appendChild(wl);
        if(isMoOp){
          const total=dim(y,m),nwks=Math.ceil((new Date(y,m-1,1).getDay()+total)/7);
          for(let w=1;w<=nwks;w++){
            const wns=wNotes(y,m,w);
            let woyN=0;for(let dd=1;dd<=total;dd++){if(wom(y,m,dd)===w){woyN=woy(y,m,dd);break;}}
            let wFut=true;for(let dd=1;dd<=total;dd++){if(wom(y,m,dd)===w&&!isFutD(y,m,dd)){wFut=false;break;}}
            const wb=document.createElement('div');wb.className='wkb';
            const wr=document.createElement('div');wr.className='wkr'+(wns.length?' hn':'')+(wFut?' fut':'');
            const wkLeft=document.createElement('div');wkLeft.className='wk-left';
            const wklEl=document.createElement('div');wklEl.className='wkl';wklEl.textContent=`W${woyN}`;
            wkLeft.appendChild(wklEl);
            const wkTick=document.createElement('div');wkTick.className='wk-tick';
            const wkRight=document.createElement('div');wkRight.className='wk-right';
            const wgrid=document.createElement('div');wgrid.className='wk-day-grid';
            for(let d2=1;d2<=total;d2++){
              if(wom(y,m,d2)!==w) continue;
              if(!isAfterBirth(y,m,d2)) continue;
              if(!isBeforeEnd(y,m,d2)) continue;
              const dKey2=dk(y,m,d2);
              const hasN=!!PAGES[dKey2]?.wins?.length;
              const isT2=y===t.getFullYear()&&m===t.getMonth()+1&&d2===t.getDate();
              const isFuD2=isFutD(y,m,d2);
              const dow2=new Date(y,m-1,d2).getDay();
              const cell=document.createElement('div');
              cell.className='wkgd'+(hasN?' has-note':'')+(isT2?' today-d':'')+(isFuD2?' fut-d':'');
              const dowStr=['Su','Mo','Tu','We','Th','Fr','Sa'][dow2];
              cell.innerHTML=`<span class="wkgd-num">${d2}</span><span class="wkgd-day">${dowStr}</span><span class="wkgd-dot"></span>`;
              cell.title=`${MO[m-1]} ${d2}, ${y}`;
              cell.addEventListener('click',e2=>{e2.stopPropagation();openPage(y,m,d2);});
              wgrid.appendChild(cell);
            }
            wkRight.appendChild(wgrid);
            wr.appendChild(wkLeft);wr.appendChild(wkTick);wr.appendChild(wkRight);
            wklEl.addEventListener('click',e=>{e.stopPropagation();openWeekPage(y,m,w);});
            wr.addEventListener('click',e=>{e.stopPropagation();openWeekPage(y,m,w);});
            wb.appendChild(wr);

            // Day rows under week
            const dl=document.createElement('div');dl.className='dyl-wrap';wb.appendChild(dl);
            wl.appendChild(wb);
          }
        }
        mol.appendChild(mb);
      }
    }
    wrap.appendChild(yb);
  }
}

// Today button
document.getElementById('btn-today').addEventListener('click',()=>{
  const t=now(),y=t.getFullYear(),m=t.getMonth()+1;
  openYrs.add(y);openMos.add(`${y}-${m}`);
  renderTL();
  setTimeout(()=>{document.getElementById('yr-'+y)?.scrollIntoView({behavior:'smooth',block:'start'});},120);
  openPage(y,m,t.getDate());
  showNotif('Today opened');
});

// Expand sidebar
let sbExpanded=false;
document.getElementById('btn-expand').addEventListener('click',()=>{
  sbExpanded=!sbExpanded;
  const sb=document.getElementById('ctx-sidebar');
  if(sbExpanded){sb.style.width='100vw';sb.style.zIndex='900';document.getElementById('btn-expand').classList.add('on');document.getElementById('btn-expand').textContent='⛶ Restore';}
  else{sb.style.width='';sb.style.zIndex='';document.getElementById('btn-expand').classList.remove('on');document.getElementById('btn-expand').textContent='⛶ Expand';}
});

// ═══════════ NOTEBOOK HIERARCHY ═══════════
// Structure: Master → Sub-Notebook → Page → Canvas
const NB_DATA = [
  { id:'j', name:'Journal', color:'#c8f562', icon:'📔', subs:[
    { id:'j-26', name:'2026 Journal', icon:'📅', pages:[
      {id:'j-26-1',title:'Morning Reflection',date:'2026-01-15',startDate:'2026-01-01',endDate:'2026-12-31',countdown:false},
      {id:'j-26-2',title:'Weekly Review',date:'2026-01-22',startDate:'2026-01-22',endDate:'2026-03-22',countdown:false},
      {id:'j-26-3',title:'Goals This Month',date:'2026-02-01',startDate:'2026-02-01',endDate:'2026-02-28',countdown:true}
    ]},
    { id:'j-tr', name:'Travel Journal', icon:'✈️', pages:[
      {id:'j-tr-1',title:'Tokyo Trip',date:'2025-11-10',startDate:'2025-11-10',endDate:'2025-11-24',countdown:false},
      {id:'j-tr-2',title:'Bali Planning',date:'2026-03-01',startDate:'2026-03-01',endDate:'2026-06-01',countdown:true}
    ]},
    { id:'j-rf', name:'Reflections', icon:'💭', pages:[
      {id:'j-rf-1',title:'Year in Review',date:'2025-12-31',startDate:'2025-12-01',endDate:'2025-12-31',countdown:false}
    ]},
  ]},
  { id:'w', name:'Work', color:'#9b8eff', icon:'💼', subs:[
    { id:'w-pr', name:'Projects', icon:'🗂', pages:[
      {id:'w-pr-1',title:'Journote Roadmap',date:'2026-02-10',startDate:'2026-01-01',endDate:'2026-06-30',countdown:true},
      {id:'w-pr-2',title:'Q1 OKRs',date:'2026-01-05',startDate:'2026-01-01',endDate:'2026-03-31',countdown:true}
    ]},
    { id:'w-mt', name:'Meetings', icon:'📝', pages:[
      {id:'w-mt-1',title:'Team Sync',date:'2026-02-15',startDate:'2026-02-15',endDate:'2026-02-15',countdown:false}
    ]},
    { id:'w-id', name:'Ideas', icon:'💡', pages:[
      {id:'w-id-1',title:'Product Ideas',date:'2026-02-20',startDate:'2026-02-20',endDate:'2026-04-20',countdown:false}
    ]},
  ]},
  { id:'fi', name:'Finance', color:'#22d3ee', icon:'💰', subs:[
    { id:'fi-bg', name:'Budget', icon:'📊', pages:[
      {id:'fi-bg-1',title:'Monthly Budget',date:'2026-02-01',startDate:'2026-02-01',endDate:'2026-02-28',countdown:true},
      {id:'fi-bg-2',title:'Annual Plan',date:'2026-01-01',startDate:'2026-01-01',endDate:'2026-12-31',countdown:true}
    ]},
  ]},
  { id:'h', name:'Health', color:'#4ade80', icon:'💚', subs:[
    { id:'h-wr', name:'Workouts', icon:'🏋️', pages:[
      {id:'h-wr-1',title:'Weekly Workout Log',date:'2026-02-21',startDate:'2026-02-01',endDate:'2026-04-30',countdown:true}
    ]},
  ]},
  { id:'c', name:'Contacts', color:'#f43f5e', icon:'👥', subs:[
    { id:'c-fr', name:'Friends', icon:'🤝', pages:[
      {id:'c-fr-1',title:'People I admire',date:'2025-12-01',startDate:'2025-12-01',endDate:'2026-12-01',countdown:false}
    ]},
  ]},
];

let nbSelMaster=null, nbSelSub=null, nbMode='sub';
let curNBPage=null;

// Load persisted notebooks (override default data)
loadPersistedNotebooks();

function calcCd(pg) {
  if(!pg.startDate||!pg.endDate) return null;
  const start=new Date(pg.startDate),end=new Date(pg.endDate),today=now();
  const total=Math.max(1,Math.round((end-start)/(864e5)));
  const elapsed=Math.round((today-start)/(864e5));
  const remaining=Math.round((end-today)/(864e5));
  const pct=Math.min(100,Math.max(0,Math.round(elapsed/total*100)));
  const overdue=today>end;
  return {total,elapsed,remaining,pct,overdue};
}

function renderNBMaster(){
  const col=document.getElementById('nb-master-col');col.innerHTML='';
  NB_DATA.forEach(nb=>{
    const item=document.createElement('div');item.className='nbm-item'+(nbSelMaster?.id===nb.id?' on':'');
    item.innerHTML=`<span class="nbm-dot" style="background:${nb.color}"></span><span style="font-size:11px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${nb.name}</span>`;
    item.addEventListener('click',()=>{nbSelMaster=nb;nbSelSub=null;nbMode='sub';renderNBMaster();renderNBRight();});
    col.appendChild(item);
  });
  const add=document.createElement('div');add.className='nbm-item';add.style.color='var(--tx4)';add.style.fontSize='11px';
  add.innerHTML='<span style="font-size:14px;line-height:1">+</span><span>New</span>';
  add.onclick=()=>{
    const name=prompt('Notebook name:');if(!name)return;
    NB_DATA.push({id:'nb-'+Date.now(),name,color:'#c8f562',icon:'📓',subs:[]});
    persistNotebooks(); // ← persist new notebook
    renderNBMaster();showNotif('Created: '+name);
  };
  col.appendChild(add);
}

function renderNBRight(){
  const label=document.getElementById('nbs-label');
  const list=document.getElementById('nb-sub-list');
  list.innerHTML='';
  if(!nbSelMaster){label.textContent='Select a notebook';return;}
  if(nbMode==='sub'){
    label.textContent=nbSelMaster.name;
    nbSelMaster.subs.forEach(sub=>{
      const item=document.createElement('div');item.className='nbs-item'+(nbSelSub?.id===sub.id?' on':'');
      item.innerHTML=`<span class="nbs-icon">${sub.icon}</span><span class="nbs-name">${sub.name}</span><span class="nbs-cnt">${sub.pages.length}</span>`;
      item.addEventListener('click',()=>{nbSelSub=sub;nbMode='pages';renderNBRight();});
      list.appendChild(item);
    });
    const addSub=document.createElement('div');addSub.className='nbs-item';addSub.style.color='var(--tx4)';
    addSub.innerHTML='<span class="nbs-icon">+</span><span class="nbs-name">New Sub-Notebook</span>';
    addSub.onclick=()=>{
      const name=prompt('Sub-notebook name:');if(!name)return;
      nbSelMaster.subs.push({id:'s-'+Date.now(),name,icon:'📁',pages:[]});
      persistNotebooks();
      renderNBRight();
    };
    list.appendChild(addSub);
  } else if(nbMode==='pages'&&nbSelSub){
    // Back button
    const back=document.createElement('div');back.className='nbs-item';back.style.color='var(--tx4)';
    back.innerHTML='<span class="nbs-icon">←</span><span class="nbs-name">Back</span>';
    back.onclick=()=>{nbMode='sub';nbSelSub=null;renderNBRight();};
    list.appendChild(back);
    label.textContent=nbSelSub.name;
    // Render pages
    const pgList=document.createElement('div');pgList.className='pg-list';
    nbSelSub.pages.forEach(pg=>{
      const item=document.createElement('div');item.className='pg-item'+(curNBPage?.id===pg.id?' on':'');
      const cd=pg.countdown?calcCd(pg):null;
      let cdHtml='';
      if(cd){
        const fill=cd.overdue?`<div class="pg-cd-bar-fill overdue" style="width:100%"></div>`:`<div class="pg-cd-bar-fill" style="width:${cd.pct}%"></div>`;
        cdHtml=`<div class="pg-cd"><div class="pg-cd-bar-track">${fill}</div><div class="pg-cd-label${cd.overdue?' overdue':''}"><span>${cd.overdue?'Overdue':'In progress'}</span><span>${cd.pct}%</span></div></div>`;
      }
      item.innerHTML=`<div class="pg-title">${pg.title}</div><div class="pg-meta">${pg.date}</div>${cdHtml}`;
      item.addEventListener('click',()=>openNBPage(pg,nbSelMaster,nbSelSub));
      list.appendChild(item);
    });
    list.appendChild(pgList);
  }
}

function openNBPage(pg, master, sub) {
  if(curKey) savePage(true);
  curNBPage=pg;
  const key='nb-'+pg.id;
  if(!PAGES[key])PAGES[key]={wins:[]};
  curKey=key; curY=parseInt(pg.date)||now().getFullYear(); curM=1; curD=1;
  document.getElementById('canvas-hint').style.display='none';
  loadCanvas();
  renderProjectBanner(pg, master);
  showNotif('📖 '+master.name+': '+pg.title);
}

function renderProjectBanner(pg, master) {
  const banner=document.getElementById('project-banner');
  if(!pg){banner.style.display='none';return;}
  banner.style.display='block';
  const cd=pg.countdown?calcCd(pg):null;
  const titleText=`${master.name}: ${pg.title}`;
  let cdHtml='';
  if(cd){
    const fillCls='pb-cd-fill'+(cd.overdue?' overdue':'');
    cdHtml=`<div class="pb-cd-wrap">
      <div class="pb-cd-track"><div class="${fillCls}" style="width:${cd.pct}%"></div></div>
      <div class="pb-cd-meta">
        ${cd.overdue?`<span class="overdue-label">⚠ Overdue by ${Math.abs(cd.remaining)} days</span>`:`<span>${cd.remaining} days remaining</span>`}
        <span class="pct">${cd.pct}%</span>
        <span>${pg.startDate} → ${pg.endDate}</span>
        <button class="pb-cd-edit" onclick="editProjectDates(curNBPage)">✏ Edit</button>
      </div>
    </div>`;
  } else {
    cdHtml=`<div class="pb-cd-meta" style="margin-top:2px">
      <button class="pb-cd-edit" onclick="enableProjectCountdown(curNBPage)">+ Add Countdown</button>
    </div>`;
  }
  banner.innerHTML=`<div class="pb-title">${titleText}</div>${cdHtml}`;
}

function editProjectDates(pg) {
  if(!pg) return;
  const s=prompt('Start date (YYYY-MM-DD):',pg.startDate||'');if(s===null)return;
  const e=prompt('End date (YYYY-MM-DD):',pg.endDate||'');if(e===null)return;
  pg.startDate=s; pg.endDate=e; pg.countdown=true;
  persistNotebooks();
  renderProjectBanner(pg, nbSelMaster);
  renderNBRight();
  showNotif('Countdown updated');
}

function enableProjectCountdown(pg) {
  if(!pg) return;
  editProjectDates(pg);
}

document.getElementById('nbs-add-btn').addEventListener('click',()=>{
  if(!nbSelMaster) return showNotif('Select a notebook first');
  if(nbMode==='sub'){
    const name=prompt('Sub-notebook name:');
    if(name){nbSelMaster.subs.push({id:'s-'+Date.now(),name,icon:'📁',pages:[]});persistNotebooks();renderNBRight();}
  } else if(nbMode==='pages'&&nbSelSub){
    const t=prompt('Page title:');
    if(t){
      nbSelSub.pages.push({id:'pg-'+Date.now(),title:t,date:now().toISOString().slice(0,10),startDate:now().toISOString().slice(0,10),endDate:'',countdown:false});
      persistNotebooks();
      renderNBRight();
    }
  }
});

// Override openPage to hide project banner
const _origOpenPage=openPage;
openPage=(y,m,d)=>{
  document.getElementById('project-banner').style.display='none';
  curNBPage=null;
  _origOpenPage(y,m,d);
};

renderNBMaster();renderNBRight();

// ═══════════ LONG-PRESS VOICE RECORDING ═══════════
let lpTimer=null, lpStartMs=0, lpActive=false, lpStream=null, lpMr=null, lpChunks=[];
let lpTicker=null;

const lpRing=document.getElementById('lp-ring');
const lpTimerEl=document.getElementById('lp-timer');
const recStatusEl=document.getElementById('rec-status');
const recStatusTxt=document.getElementById('rec-status-txt');

function stopGlobalRec(){
  if(lpMr&&lpMr.state!=='inactive') lpMr.stop();
  lpActive=false;clearInterval(lpTicker);
  recStatusEl.classList.remove('on');
  lpTimerEl.style.display='none';
  lpRing.classList.remove('active');
}

mainEl.addEventListener('mousedown',e=>{
  if(e.target!==document.getElementById('canvas')&&e.target!==mainEl) return;
  if(e.button!==0) return;
  if(winSpDown||winTool==='pan') return;
  const cx=e.clientX,cy=e.clientY;
  lpStartMs=Date.now();
  lpRing.style.left=cx+'px'; lpRing.style.top=cy+'px';
  lpTimer=setTimeout(async()=>{
    lpActive=true;
    lpRing.classList.add('active');
    lpTimerEl.style.left=(cx+14)+'px'; lpTimerEl.style.top=(cy-18)+'px';
    lpTimerEl.style.display='block'; lpTimerEl.textContent='⏺ 0.0s';
    recStatusEl.classList.add('on'); recStatusTxt.textContent='Recording… 0:00';
    try{
      lpStream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
      lpChunks=[];
      const mimes=['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus',''];
      const mimeType=mimes.find(m=>m===''||MediaRecorder.isTypeSupported(m))||'';
      lpMr=new MediaRecorder(lpStream, mimeType?{mimeType}:{});
      lpMr.ondataavailable=e2=>{if(e2.data&&e2.data.size>0)lpChunks.push(e2.data);};
      lpMr.onstop=()=>{
        const blob=new Blob(lpChunks,{type:lpMr.mimeType||'audio/webm'});
        lpStream.getTracks().forEach(t=>t.stop()); lpStream=null;
        ensurePage();
        const r=mainEl.getBoundingClientRect();
        const wx=(cx-r.left-winPX)/winSc-110;
        const wy=(cy-r.top-winPY)/winSc-50;
        const w=mkWin('voice',wx,wy,true);
        const player=document.createElement('audio');
        player.controls=true; player.src=URL.createObjectURL(blob);
        player.style.cssText='width:100%;margin-top:6px;border-radius:6px;';
        const body=w.querySelector('.nwbody');
        if(body) body.appendChild(player);
        clearInterval(lpTicker);
        recStatusEl.classList.remove('on');
        lpTimerEl.style.display='none';
        lpRing.classList.remove('active');
        schedAutoSave();
        showNotif('Voice note saved ✓');
      };
      lpMr.start(100);
      const recStart=Date.now();
      lpTicker=setInterval(()=>{
        const s=(Date.now()-recStart)/1000;
        lpTimerEl.textContent='⏺ '+s.toFixed(1)+'s';
        recStatusTxt.textContent='Recording… '+fmtDur(Math.floor(s));
      },100);
    }catch(err){
      lpActive=false;recStatusEl.classList.remove('on');lpTimerEl.style.display='none';
      showNotif('Mic: '+(err.message||'not available'));
    }
  },3000);
});

mainEl.addEventListener('mouseup',e=>{
  clearTimeout(lpTimer);lpTimer=null;
  if(!lpActive){lpRing.classList.remove('active');return;}
  stopGlobalRec();
});

mainEl.addEventListener('mouseleave',()=>{
  clearTimeout(lpTimer);lpTimer=null;
  if(lpActive) stopGlobalRec();
  lpRing.classList.remove('active');
  lpTimerEl.style.display='none';
});

// Touch long-press
mainEl.addEventListener('touchstart',e=>{
  if(e.target!==document.getElementById('canvas')&&e.target!==mainEl) return;
  const touch=e.touches[0];
  const cx=touch.clientX,cy=touch.clientY;
  lpRing.style.left=cx+'px'; lpRing.style.top=cy+'px';
  lpStartMs=Date.now();
  lpTimer=setTimeout(async()=>{
    lpActive=true;
    if(navigator.vibrate) navigator.vibrate([100,50,100]);
    lpRing.classList.add('active');
    lpTimerEl.style.left=(cx+14)+'px'; lpTimerEl.style.top=(cy-18)+'px';
    lpTimerEl.style.display='block';
    recStatusEl.classList.add('on');
    try{
      lpStream=await navigator.mediaDevices.getUserMedia({audio:true});
      lpChunks=[];
      const mimeType=MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':'';
      lpMr=new MediaRecorder(lpStream,mimeType?{mimeType}:{});
      lpMr.ondataavailable=e2=>{if(e2.data&&e2.data.size>0)lpChunks.push(e2.data);};
      lpMr.onstop=()=>{
        const blob=new Blob(lpChunks,{type:lpMr.mimeType||'audio/webm'});
        lpStream.getTracks().forEach(t=>t.stop());
        ensurePage();
        const r=mainEl.getBoundingClientRect();
        const wx=(cx-r.left-winPX)/winSc-110, wy=(cy-r.top-winPY)/winSc-50;
        const w=mkWin('voice',wx,wy,true);
        const player=document.createElement('audio');player.controls=true;player.src=URL.createObjectURL(blob);
        player.style.cssText='width:100%;margin-top:6px;border-radius:6px;';
        const body=w.querySelector('.nwbody');if(body)body.appendChild(player);
        recStatusEl.classList.remove('on');lpTimerEl.style.display='none';lpRing.classList.remove('active');
        schedAutoSave();showNotif('Voice note saved ✓');
      };
      lpMr.start(100);
      const recStart=Date.now();
      lpTicker=setInterval(()=>{const s=(Date.now()-recStart)/1000;lpTimerEl.textContent='⏺ '+s.toFixed(1)+'s';recStatusTxt.textContent='Recording… '+fmtDur(Math.floor(s));},100);
    }catch(err){lpActive=false;recStatusEl.classList.remove('on');showNotif('Mic not available');}
  },3000);
},{passive:true});

mainEl.addEventListener('touchend',()=>{
  clearTimeout(lpTimer);lpTimer=null;
  if(lpActive) stopGlobalRec();
  lpRing.classList.remove('active');lpTimerEl.style.display='none';
});

// ═══════════ KEYBOARD SHORTCUTS ═══════════
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){closeAllPanels();hideCtx();winDesel();}
  if((e.key==='Delete'||e.key==='Backspace')&&winSelWin&&!e.target.isContentEditable&&!e.target.closest('td')&&!e.target.closest('input')){
    rmWin(winSelWin);winSelWin=null;
  }
});

document.getElementById('btn-fit').addEventListener('click',fitView);
document.getElementById('btn-save').addEventListener('click',()=>savePage(false));

// ═══════════ INIT ═══════════
renderTL();
setTimeout(()=>{document.getElementById('yr-'+now().getFullYear())?.scrollIntoView({behavior:'smooth',block:'center'});},300);
setTimeout(()=>{const t=now();openPage(t.getFullYear(),t.getMonth()+1,t.getDate());},500);
