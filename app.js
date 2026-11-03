const STORAGE_KEY = "tenken-pro-v1";
const DEFAULT_ITEMS = [
  {id:"c1",category:"清掃",name:"床・通路に汚れや障害物がない"},
  {id:"c2",category:"清掃",name:"作業台・カウンターを清潔にした"},
  {id:"c3",category:"清掃",name:"ゴミ箱の状態を確認した"},
  {id:"c4",category:"清掃",name:"手洗い場・シンクを清掃した"},
  {id:"c5",category:"清掃",name:"客席・店舗入口を清掃した"},
  {id:"e1",category:"設備",name:"冷蔵庫・冷凍庫が正常に動作している"},
  {id:"e2",category:"設備",name:"照明・電源に異常がない"},
  {id:"e3",category:"設備",name:"給排水・蛇口に異常がない"},
  {id:"e4",category:"設備",name:"換気設備が正常に動作している"},
  {id:"e5",category:"設備",name:"消火器・避難経路の前に障害物がない"}
];
const $ = id => document.getElementById(id);
const today = () => new Date().toLocaleDateString("sv-SE");
const now = () => new Date().toISOString();
let data = loadData();
let selectedPhoto = "";

function loadData(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw)return {items:DEFAULT_ITEMS,records:[],reports:[],staff:"",daily:{}};
    const x=JSON.parse(raw);
    return {items:x.items||DEFAULT_ITEMS,records:x.records||[],reports:x.reports||[],staff:x.staff||"",daily:x.daily||{}};
  }catch(e){return {items:DEFAULT_ITEMS,records:[],reports:[],staff:"",daily:{}}}
}
function persistOnly(){
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data));return true}
  catch(e){toast("保存容量が不足しています。古い写真付き報告をバックアップ後に整理してください。");return false}
}
function save(){if(persistOnly())render()}
function todayRecord(){
  if(!data.daily[today()])data.daily[today()]={checks:{},startedAt:now(),updatedAt:now()};
  return data.daily[today()];
}
function toast(message){
  const el=$("toast");el.textContent=message;el.classList.add("show");
  setTimeout(()=>el.classList.remove("show"),2600);
}
function render(){
  $("todayLabel").textContent=new Date().toLocaleDateString("ja-JP",{month:"long",day:"numeric",weekday:"short"});
  $("staffName").value=data.staff;
  const rec=todayRecord(),checks=rec.checks;
  const total=data.items.length,done=data.items.filter(i=>checks[i.id]?.status).length;
  const issues=data.items.filter(i=>checks[i.id]?.status==="NG").length;
  const pct=total?Math.round(done/total*100):0;
  $("totalCount").textContent=total;$("doneCount").textContent=done;$("issueCount").textContent=issues;
  $("progressPercent").textContent=pct+"%";
  $("progressRing").style.background=`conic-gradient(#79a9ff ${pct*3.6}deg,#46617d 0deg)`;
  $("progressRing").style.border="5px solid #46617d";
  $("checklist").innerHTML="";
  ["清掃","設備"].forEach(category=>{
    const items=data.items.filter(i=>i.category===category);if(!items.length)return;
    const heading=document.createElement("div");heading.className="category-title";
    const label=document.createElement("span");label.textContent=(category==="清掃"?"🧹 ":"🔧 ")+category+"点検";
    const count=document.createElement("span");count.textContent=items.filter(i=>checks[i.id]?.status).length+"/"+items.length;
    heading.append(label,count);$("checklist").appendChild(heading);
    items.forEach(item=>{
      const status=checks[item.id]?.status||"";
      const card=document.createElement("article");card.className="check-card";
      const top=document.createElement("div");top.className="check-top";
      const name=document.createElement("div");name.className="item-name";name.textContent=item.name;
      const badge=document.createElement("span");badge.className="status "+(status==="OK"?"ok":status==="NG"?"ng":status==="対象外"?"na":"");badge.textContent=status||"未確認";
      top.append(name,badge);card.appendChild(top);
      const actions=document.createElement("div");actions.className="actions";
      [["OK","active-ok"],["NG","active-ng"],["対象外","active-na"]].forEach(([label,cls])=>{
        const b=document.createElement("button");b.type="button";b.textContent=label;
        if(status===label)b.classList.add(cls);
        b.addEventListener("click",()=>setStatus(item.id,label));actions.appendChild(b);
      });
      card.appendChild(actions);
      const note=document.createElement("input");note.className="item-note";note.placeholder="備考（任意）";note.value=checks[item.id]?.note||"";
      note.addEventListener("change",()=>{const r=todayRecord();r.checks[item.id]=r.checks[item.id]||{};r.checks[item.id].note=note.value;r.updatedAt=now();persistOnly()});
      card.appendChild(note);$("checklist").appendChild(card);
    });
  });
  renderHistory();renderReports();
}
function setStatus(id,status){
  const rec=todayRecord();rec.checks[id]=rec.checks[id]||{};
  rec.checks[id].status=status;rec.checks[id].checkedAt=now();rec.checks[id].staff=data.staff;rec.updatedAt=now();
  save();toast(status+"で記録しました");
}
function renderHistory(){
  const entries=Object.entries(data.daily).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,5);
  const host=$("historyList");host.innerHTML="";
  if(!entries.length){host.innerHTML='<p class="empty">まだ点検履歴はありません。</p>';return}
  entries.forEach(([date,record])=>{
    const values=Object.values(record.checks||{}),count=values.filter(x=>x.status).length,ng=values.filter(x=>x.status==="NG").length;
    const row=document.createElement("div");row.className="history-row";
    const left=document.createElement("div"),strong=document.createElement("strong"),sub=document.createElement("span");
    strong.textContent=date;sub.textContent=record.staff||"担当者未設定";left.append(strong,sub);
    const right=document.createElement("div");right.style.textAlign="right";right.textContent=`${count}項目完了 / NG ${ng}件`;
    row.append(left,right);host.appendChild(row);
  });
}
function renderReports(){
  const host=$("reportList");host.innerHTML="";
  const reports=[...data.reports].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,30);
  if(!reports.length){host.innerHTML='<p class="empty">異常報告はまだありません。</p>';return}
  reports.forEach(report=>{
    const card=document.createElement("article");card.className="report-card";
    const head=document.createElement("div");head.className="report-card-head";
    const title=document.createElement("h4");title.textContent=report.title;
    const severity=document.createElement("span");severity.className="severity "+report.severity;severity.textContent=report.severity;
    head.append(title,severity);card.appendChild(head);
    const meta=document.createElement("p");meta.className="report-meta";
    meta.textContent=`${formatDate(report.createdAt)} ・ ${report.category} ・ ${report.staff||"担当者未設定"}`;
    card.appendChild(meta);
    if(report.description){const desc=document.createElement("p");desc.className="report-description";desc.textContent=report.description;card.appendChild(desc)}
    if(report.photo){const img=document.createElement("img");img.className="report-photo";img.src=report.photo;img.alt="異常箇所の記録写真";card.appendChild(img)}
    const actions=document.createElement("div");actions.className="report-actions";
    const state=document.createElement("span");state.className="report-state";state.textContent=report.resolved?"対応済み":"未対応";actions.appendChild(state);
    const toggle=document.createElement("button");toggle.type="button";toggle.className="resolve";toggle.textContent=report.resolved?"未対応に戻す":"対応済みにする";
    toggle.addEventListener("click",()=>{const found=data.reports.find(x=>x.id===report.id);if(found){found.resolved=!found.resolved;found.updatedAt=now();save();toast("対応状況を更新しました")}});
    const del=document.createElement("button");del.type="button";del.textContent="削除";
    del.addEventListener("click",()=>{if(confirm("この異常報告を削除しますか？")){data.reports=data.reports.filter(x=>x.id!==report.id);save();toast("報告を削除しました")}});
    actions.append(toggle,del);card.appendChild(actions);host.appendChild(card);
  });
}
function formatDate(iso){return new Date(iso).toLocaleString("ja-JP",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})}
function resizeImage(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error("写真を読み込めませんでした"));
    reader.onload=()=>{
      const img=new Image();
      img.onerror=()=>reject(new Error("画像を開けませんでした"));
      img.onload=()=>{
        const max=1000,scale=Math.min(1,max/Math.max(img.width,img.height));
        const canvas=document.createElement("canvas");
        canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);
        const ctx=canvas.getContext("2d");ctx.drawImage(img,0,0,canvas.width,canvas.height);
        resolve(canvas.toDataURL("image/jpeg",0.68));
      };
      img.src=reader.result;
    };
    reader.readAsDataURL(file);
  });
}
$("staffName").addEventListener("change",e=>{data.staff=e.target.value.trim();todayRecord().staff=data.staff;save();toast("担当者を保存しました")});
$("addForm").addEventListener("submit",e=>{
  e.preventDefault();const name=$("newItemName").value.trim();if(!name)return;
  data.items.push({id:"custom-"+Date.now(),category:$("newItemCategory").value,name});
  $("newItemName").value="";save();toast("点検項目を追加しました");
});
$("resetTodayBtn").addEventListener("click",()=>{
  if(!confirm("今日の点検結果をすべて削除します。よろしいですか？"))return;
  delete data.daily[today()];save();toast("今日の記録をリセットしました");
});
$("reportPhoto").addEventListener("change",async e=>{
  const file=e.target.files[0];selectedPhoto="";
  $("photoPreview").classList.add("hidden");
  if(!file)return;
  if(!file.type.startsWith("image/")){alert("画像ファイルを選択してください");e.target.value="";return}
  try{selectedPhoto=await resizeImage(file);$("photoPreview").src=selectedPhoto;$("photoPreview").classList.remove("hidden")}
  catch(err){alert(err.message);e.target.value=""}
});
$("reportForm").addEventListener("submit",e=>{
  e.preventDefault();
  const title=$("reportTitle").value.trim();if(!title)return;
  const report={
    id:"report-"+Date.now(),title,category:$("reportCategory").value,
    severity:$("reportSeverity").value,description:$("reportDescription").value.trim(),
    photo:selectedPhoto,staff:data.staff,createdAt:now(),updatedAt:now(),resolved:false
  };
  data.reports.push(report);
  if(!persistOnly()){data.reports.pop();return}
  $("reportForm").reset();selectedPhoto="";$("photoPreview").src="";$("photoPreview").classList.add("hidden");
  renderReports();toast("異常報告を保存しました");
});
$("exportBtn").addEventListener("click",()=>{
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`tenken-pro-backup-${today()}.json`;a.click();URL.revokeObjectURL(url);toast("バックアップを書き出しました");
});
$("importFile").addEventListener("change",async e=>{
  const file=e.target.files[0];if(!file)return;
  try{
    const imported=JSON.parse(await file.text());
    if(!Array.isArray(imported.items)||!imported.daily||!Array.isArray(imported.records))throw new Error("形式が違います");
    if(!confirm("現在のデータをバックアップの内容で置き換えます。よろしいですか？"))return;
    data={items:imported.items,records:imported.records,reports:Array.isArray(imported.reports)?imported.reports:[],staff:imported.staff||"",daily:imported.daily};
    if(persistOnly()){render();toast("バックアップを復元しました")}
  }catch(err){alert("復元できませんでした。正しいバックアップファイルを選択してください。")}
  e.target.value="";
});
todayRecord();render();
if("serviceWorker" in navigator && location.protocol.startsWith("http")){
  window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(console.error));
}