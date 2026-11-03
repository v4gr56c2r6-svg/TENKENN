/* TENKEN PRO - compatible report form fix (v3) */
const STORAGE_KEY = 'tenken-pro-v1';
const DB_NAME = 'tenken-pro-db';
const DB_VERSION = 1;
const PHOTO_STORE = 'reportPhotos';

const DEFAULT_ITEMS = [
  {id:'c1',category:'清掃',name:'床・通路に汚れや障害物がない'},
  {id:'c2',category:'清掃',name:'作業台・カウンターを清潔にした'},
  {id:'c3',category:'清掃',name:'ゴミ箱の状態を確認した'},
  {id:'c4',category:'清掃',name:'手洗い場・シンクを清掃した'},
  {id:'c5',category:'清掃',name:'客席・店舗入口を清掃した'},
  {id:'e1',category:'設備',name:'冷蔵庫・冷凍庫が正常に動作している'},
  {id:'e2',category:'設備',name:'照明・電源に異常がない'},
  {id:'e3',category:'設備',name:'給排水・蛇口に異常がない'},
  {id:'e4',category:'設備',name:'換気設備が正常に動作している'},
  {id:'e5',category:'設備',name:'消火器・避難経路の前に障害物がない'}
];
const $ = id => document.getElementById(id);
const today = () => new Date().toLocaleDateString('sv-SE');
const now = () => new Date().toISOString();
let data = loadData();
let selectedPhotoBlob = null;
let selectedPhotoURL = '';
let dbPromise = null;

function loadData(){
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved) return {items:DEFAULT_ITEMS,records:[],reports:[],staff:'',daily:{}};
    return {
      items:Array.isArray(saved.items) ? saved.items : DEFAULT_ITEMS,
      records:Array.isArray(saved.records) ? saved.records : [],
      reports:Array.isArray(saved.reports) ? saved.reports : [],
      staff:saved.staff || '', daily:saved.daily || {}
    };
  } catch (error) {
    console.error('TENKEN PRO data load error:', error);
    return {items:DEFAULT_ITEMS,records:[],reports:[],staff:'',daily:{}};
  }
}
function persist(){
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); return true; }
  catch (error) { console.error(error); toast('端末の保存容量が不足しています。バックアップを確認してください。'); return false; }
}
function save(){ if (persist()) render(); }
function todayRecord(){
  if (!data.daily[today()]) data.daily[today()] = {checks:{},startedAt:now(),updatedAt:now()};
  return data.daily[today()];
}
function toast(message){
  const el=$('toast'); if(!el){ alert(message); return; }
  el.textContent=message; el.classList.add('show');
  window.setTimeout(()=>el.classList.remove('show'),2600);
}
function openPhotoDB(){
  if (!('indexedDB' in window)) return Promise.reject(new Error('このブラウザでは写真保存機能を利用できません'));
  if (!dbPromise) dbPromise = new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,DB_VERSION);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains(PHOTO_STORE)) db.createObjectStore(PHOTO_STORE,{keyPath:'id'});
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error || new Error('写真データベースを開けません'));
  });
  return dbPromise;
}
async function putPhoto(id,blob){
  const db=await openPhotoDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(PHOTO_STORE,'readwrite');
    tx.objectStore(PHOTO_STORE).put({id,blob,updatedAt:now()});
    tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error || new Error('写真を保存できません'));
    tx.onabort=()=>reject(tx.error || new Error('写真保存が中断されました'));
  });
}
async function getPhoto(id){
  if(!id) return null;
  const db=await openPhotoDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(PHOTO_STORE,'readonly');
    const req=tx.objectStore(PHOTO_STORE).get(id);
    req.onsuccess=()=>resolve(req.result ? req.result.blob : null);
    req.onerror=()=>reject(req.error || new Error('写真を読み込めません'));
  });
}
async function deletePhoto(id){
  if(!id) return;
  try {
    const db=await openPhotoDB();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction(PHOTO_STORE,'readwrite'); tx.objectStore(PHOTO_STORE).delete(id);
      tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error);
    });
  } catch(error) { console.warn('photo delete failed',error); }
}
function resizeImage(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error('写真を読み込めませんでした'));
    reader.onload=()=>{
      const img=new Image();
      img.onerror=()=>reject(new Error('画像を開けませんでした'));
      img.onload=()=>{
        const max=1280, scale=Math.min(1,max/Math.max(img.width,img.height));
        const canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.round(img.width*scale));
        canvas.height=Math.max(1,Math.round(img.height*scale));
        const ctx=canvas.getContext('2d');
        if(!ctx) return reject(new Error('画像を処理できませんでした'));
        ctx.drawImage(img,0,0,canvas.width,canvas.height);
        canvas.toBlob(blob=>blob ? resolve(blob) : reject(new Error('写真の圧縮に失敗しました')),'image/jpeg',0.72);
      };
      img.src=reader.result;
    };
    reader.readAsDataURL(file);
  });
}
function formatDate(value){
  return new Date(value).toLocaleString('ja-JP',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
}
function render(){
  const dateLabel=$('todayLabel');
  if(dateLabel) dateLabel.textContent=new Date().toLocaleDateString('ja-JP',{month:'long',day:'numeric',weekday:'short'});
  if($('staffName')) $('staffName').value=data.staff;
  const rec=todayRecord(), checks=rec.checks || {};
  const total=data.items.length;
  const done=data.items.filter(item=>checks[item.id]?.status).length;
  const issues=data.items.filter(item=>checks[item.id]?.status==='NG').length;
  const pct=total?Math.round(done/total*100):0;
  if($('totalCount')) $('totalCount').textContent=total;
  if($('doneCount')) $('doneCount').textContent=done;
  if($('issueCount')) $('issueCount').textContent=issues;
  if($('progressPercent')) $('progressPercent').textContent=pct+'%';
  if($('progressRing')) $('progressRing').style.background=`conic-gradient(#79a9ff ${pct*3.6}deg,#46617d 0deg)`;
  renderChecklist(checks); renderHistory(); renderReports();
}
function renderChecklist(checks){
  const host=$('checklist'); if(!host)return; host.innerHTML='';
  ['清掃','設備'].forEach(category=>{
    const items=data.items.filter(item=>item.category===category); if(!items.length)return;
    const heading=document.createElement('div'); heading.className='category-title';
    const left=document.createElement('span'); left.textContent=(category==='清掃'?'🧹 ':'🔧 ')+category+'点検';
    const right=document.createElement('span'); right.textContent=items.filter(item=>checks[item.id]?.status).length+'/'+items.length;
    heading.append(left,right); host.appendChild(heading);
    items.forEach(item=>{
      const status=checks[item.id]?.status || '';
      const card=document.createElement('article'); card.className='check-card';
      const top=document.createElement('div'); top.className='check-top';
      const name=document.createElement('div'); name.className='item-name'; name.textContent=item.name;
      const badge=document.createElement('span'); badge.className='status '+(status==='OK'?'ok':status==='NG'?'ng':status==='対象外'?'na':''); badge.textContent=status||'未確認';
      top.append(name,badge); card.appendChild(top);
      const actions=document.createElement('div'); actions.className='actions';
      [['OK','active-ok'],['NG','active-ng'],['対象外','active-na']].forEach(([label,cls])=>{
        const button=document.createElement('button'); button.type='button'; button.textContent=label;
        if(status===label)button.classList.add(cls);
        button.addEventListener('click',()=>{
          const r=todayRecord(); r.checks[item.id]=r.checks[item.id]||{};
          r.checks[item.id].status=label; r.checks[item.id].checkedAt=now(); r.checks[item.id].staff=data.staff; r.updatedAt=now();
          save(); toast(label+'で記録しました');
        }); actions.appendChild(button);
      });
      card.appendChild(actions);
      const note=document.createElement('input'); note.className='item-note'; note.placeholder='備考（任意）'; note.value=checks[item.id]?.note||'';
      note.addEventListener('change',()=>{const r=todayRecord();r.checks[item.id]=r.checks[item.id]||{};r.checks[item.id].note=note.value;r.updatedAt=now();persist();});
      card.appendChild(note); host.appendChild(card);
    });
  });
}
function renderHistory(){
  const host=$('historyList'); if(!host)return; host.innerHTML='';
  const entries=Object.entries(data.daily).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,5);
  if(!entries.length){host.innerHTML='<p class="empty">まだ点検履歴はありません。</p>';return;}
  entries.forEach(([date,record])=>{
    const values=Object.values(record.checks||{}), count=values.filter(x=>x.status).length, ng=values.filter(x=>x.status==='NG').length;
    const row=document.createElement('div'); row.className='history-row';
    const left=document.createElement('div'),strong=document.createElement('strong'),sub=document.createElement('span');
    strong.textContent=date; sub.textContent=record.staff||'担当者未設定'; left.append(strong,sub);
    const right=document.createElement('div'); right.style.textAlign='right'; right.textContent=`${count}項目完了 / NG ${ng}件`;
    row.append(left,right); host.appendChild(row);
  });
}
async function renderReports(){
  const host=$('reportList'); if(!host)return; host.innerHTML='';
  const reports=[...data.reports].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,30);
  if(!reports.length){host.innerHTML='<p class="empty">まだ異常報告はありません。</p>';return;}
  for(const report of reports){
    const card=document.createElement('article'); card.className='report-card';
    const head=document.createElement('div'); head.className='report-card-head';
    const title=document.createElement('h4'); title.textContent=report.title;
    const severity=document.createElement('span'); severity.className='severity '+report.urgency; severity.textContent=report.urgency||'通常';
    head.append(title,severity); card.appendChild(head);
    const meta=document.createElement('p'); meta.className='report-meta'; meta.textContent=`${formatDate(report.createdAt)} ・ ${report.category} ・ ${report.staff||'担当者未設定'}`; card.appendChild(meta);
    if(report.description){const desc=document.createElement('p');desc.className='report-description';desc.textContent=report.description;card.appendChild(desc);}
    if(report.photoId){
      try{const blob=await getPhoto(report.photoId);if(blob){const img=document.createElement('img');img.className='report-photo';img.alt='異常箇所の記録写真';img.src=URL.createObjectURL(blob);card.appendChild(img);}}
      catch(error){console.error(error);const note=document.createElement('p');note.className='hint';note.textContent='写真を読み込めません。';card.appendChild(note);}
    }
    const actions=document.createElement('div');actions.className='report-actions';
    const state=document.createElement('span');state.className='report-state';state.textContent=report.resolved?'対応済み':'未対応';actions.appendChild(state);
    const toggle=document.createElement('button');toggle.type='button';toggle.className='resolve';toggle.textContent=report.resolved?'未対応に戻す':'対応済みにする';
    toggle.addEventListener('click',()=>{const found=data.reports.find(x=>x.id===report.id);if(found){found.resolved=!found.resolved;found.updatedAt=now();save();toast('対応状況を更新しました');}});
    const del=document.createElement('button');del.type='button';del.textContent='削除';
    del.addEventListener('click',async()=>{if(confirm('この異常報告を削除しますか？')){data.reports=data.reports.filter(x=>x.id!==report.id);await deletePhoto(report.photoId);save();toast('報告を削除しました');}});
    actions.append(toggle,del);card.appendChild(actions);host.appendChild(card);
  }
}
function clearPhotoSelection(){
  selectedPhotoBlob=null; selectedPhotoURL='';
  if($('reportPhoto')) $('reportPhoto').value='';
  const preview=$('photoPreview'); if(preview)preview.hidden=true;
  const image=$('photoPreviewImage'); if(image)image.removeAttribute('src');
}
function setupEvents(){
  $('staffName')?.addEventListener('change',e=>{data.staff=e.target.value.trim();todayRecord().staff=data.staff;save();toast('担当者を保存しました');});
  $('addForm')?.addEventListener('submit',e=>{e.preventDefault();const name=$('newItemName').value.trim();if(!name)return;data.items.push({id:'custom-'+Date.now(),category:$('newItemCategory').value,name});$('newItemName').value='';save();toast('点検項目を追加しました');});
  $('resetTodayBtn')?.addEventListener('click',()=>{if(!confirm('今日の点検結果をすべて削除します。よろしいですか？'))return;delete data.daily[today()];save();toast('今日の記録をリセットしました');});
  $('reportPhoto')?.addEventListener('change',async e=>{
    const file=e.target.files?.[0]; clearPhotoSelection();
    if(!file)return;
    if(!file.type.startsWith('image/')){alert('画像ファイルを選択してください');return;}
    try{
      const previewBlob=await resizeImage(file); selectedPhotoBlob=previewBlob; selectedPhotoURL=URL.createObjectURL(previewBlob);
      const img=$('photoPreviewImage'); if(img)img.src=selectedPhotoURL;
      const preview=$('photoPreview'); if(preview)preview.hidden=false;
      toast('写真を添付しました');
    }catch(error){console.error(error);alert(error.message||'写真を読み込めませんでした');clearPhotoSelection();}
  });
  $('removePhotoBtn')?.addEventListener('click',()=>{clearPhotoSelection();toast('写真を取り消しました');});
  $('reportForm')?.addEventListener('submit',async e=>{
    e.preventDefault();
    const submitButton=$('reportForm').querySelector('button[type="submit"]');
    const title=$('reportTitle')?.value.trim();
    if(!title){alert('異常のタイトルを入力してください');$('reportTitle')?.focus();return;}
    if(submitButton){submitButton.disabled=true;submitButton.textContent='保存中…';}
    let photoId='';
    try{
      if(selectedPhotoBlob){photoId='photo-'+Date.now();await putPhoto(photoId,selectedPhotoBlob);}
      const report={
        id:'report-'+Date.now(),title,
        category:$('reportCategory')?.value||'その他',
        urgency:$('reportUrgency')?.value||'通常',
        description:$('reportDescription')?.value.trim()||'',
        photoId,staff:data.staff||'',createdAt:now(),updatedAt:now(),resolved:false
      };
      data.reports.push(report);
      if(!persist()){
        data.reports=data.reports.filter(item=>item.id!==report.id);
        if(photoId)await deletePhoto(photoId);
        return;
      }
      $('reportForm').reset();clearPhotoSelection();
      await renderReports();toast('異常報告を保存しました');
    }catch(error){
      console.error('report save error:',error);
      if(photoId)await deletePhoto(photoId);
      alert('保存できませんでした。写真の保存領域またはブラウザ設定を確認してください。\n'+(error.message||''));
    }finally{
      if(submitButton){submitButton.disabled=false;submitButton.textContent='異常報告を保存';}
    }
  });
  $('exportBtn')?.addEventListener('click',()=>{
    const backup={...data};
    const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`tenken-pro-backup-${today()}.json`;a.click();URL.revokeObjectURL(url);toast('バックアップを書き出しました（写真本体は含みません）');
  });
  $('importFile')?.addEventListener('change',async e=>{
    const file=e.target.files?.[0];if(!file)return;
    try{
      const imported=JSON.parse(await file.text());
      if(!Array.isArray(imported.items)||!imported.daily)throw new Error('バックアップ形式が違います');
      if(!confirm('現在のデータをバックアップの内容で置き換えます。よろしいですか？'))return;
      data={items:imported.items,records:imported.records||[],reports:imported.reports||[],staff:imported.staff||'',daily:imported.daily};
      if(persist()){render();toast('バックアップを復元しました');}
    }catch(error){alert('復元できませんでした。正しいバックアップファイルを選択してください。');}
    e.target.value='';
  });
}

function init(){
  setupEvents(); todayRecord(); render();
  if('serviceWorker' in navigator && location.protocol.startsWith('http')){
    window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(error=>console.warn('Service Worker:',error)));
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
