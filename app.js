import{initializeApp}from"https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import{getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut,createUserWithEmailAndPassword}from"https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import{getFirestore,doc,getDoc,setDoc,deleteDoc,collection,onSnapshot,serverTimestamp,writeBatch}from"https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
const cfg={apiKey:"AIzaSyC1KJrOHgppCy9QmTkSDcBNQVH63BMGD0U",authDomain:"tenken-pro.firebaseapp.com",projectId:"tenken-pro",storageBucket:"tenken-pro.firebasestorage.app",messagingSenderId:"790030695993",appId:"1:790030695993:web:c18f8bbba3a12541af97e8"},app=initializeApp(cfg),auth=getAuth(app),db=getFirestore(app),$=id=>document.getElementById(id),today=()=>new Date().toLocaleDateString("sv-SE"),now=()=>new Date().toISOString();
const staffApp=initializeApp(cfg,"staffAccountCreator"),staffAuth=getAuth(staffApp);
const defaults=[["c1","清掃","床・通路に汚れや障害物がない"],["c2","清掃","作業台・カウンターを清潔にした"],["c3","清掃","ゴミ箱の状態を確認した"],["c4","清掃","手洗い場・シンクを清掃した"],["c5","清掃","客席・店舗入口を清掃した"],["e1","設備","冷蔵庫・冷凍庫が正常に動作している"],["e2","設備","照明・電源に異常がない"],["e3","設備","給排水・蛇口に異常がない"],["e4","設備","換気設備が正常に動作している"],["e5","設備","消火器・避難経路の前に障害物がない"]].map(([id,category,name])=>({id,category,name}));
function staffIdToEmail(value){
 const id=String(value||"").trim().toLowerCase();
 if(!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(id)) throw new Error("スタッフIDは半角英数字・._-で3〜40文字にしてください");
 return id+"@tenken-pro.firebaseapp.com";
}
let user,profile,items=defaults,daily={},reports=[],unsubs=[];
const admin=()=>profile?.role==="admin"&&profile?.active===true,notify=t=>{$("toast").textContent=t;$("toast").classList.add("show");setTimeout(()=>$("toast").classList.remove("show"),2500)},day=()=>daily[today()]||(daily[today()]={checks:{},staff:profile.displayName||user.email,updatedAt:now()});
function render(){let r=day(),c=r.checks||{},done=items.filter(x=>c[x.id]?.status).length,ng=items.filter(x=>c[x.id]?.status==="NG").length;$("who").textContent=profile.displayName||user.email;$("adminPanel").hidden=!admin();$("staffAdminPanel").hidden=!admin();$("reset").hidden=!admin();$("total").textContent=items.length;$("done").textContent=done;$("ng").textContent=ng;$("percent").textContent=(items.length?Math.round(done/items.length*100):0)+"%";$("checklist").innerHTML="";for(let cat of["清掃","設備"]){let h=document.createElement("h4");h.textContent=cat+"点検";$("checklist").append(h);for(let x of items.filter(i=>i.category===cat)){let row=document.createElement("div");row.className="item";let label=document.createElement("b");label.textContent=x.name;row.append(label);for(let s of["OK","NG","対象外"]){let b=document.createElement("button");b.textContent=s;b.className=c[x.id]?.status===s?"selected":"";b.onclick=()=>saveCheck(x.id,s);row.append(b)}let n=document.createElement("input");n.placeholder="備考";n.value=c[x.id]?.note||"";n.onchange=()=>saveNote(x.id,n.value);row.append(n);$("checklist").append(row)}}$("history").innerHTML=Object.entries(daily).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,7).map(([d,r])=>`<p>${d} ・ ${r.staff||""} ・ ${Object.values(r.checks||{}).filter(x=>x.status).length}項目</p>`).join("")||"履歴はありません";$("reports").innerHTML="";for(let r of [...reports].sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""))){let el=document.createElement("article");el.className="report";let h=document.createElement("b");h.textContent=r.title;let p=document.createElement("p");p.textContent=`${r.createdAt||""} ・ ${r.category} ・ ${r.urgency} ・ ${r.staff}`;let d=document.createElement("p");d.textContent=r.description||"";let state=document.createElement("p");state.textContent=r.resolved?"対応済み":"未対応";let toggle=document.createElement("button");toggle.textContent=r.resolved?"未対応に戻す":"対応済みにする";toggle.onclick=()=>setDoc(doc(db,"reports",r.id),{resolved:!r.resolved,updatedBy:user.uid,updatedAt:serverTimestamp()},{merge:true});el.append(h,p,d,state,toggle);$("reports").append(el)}}
async function saveCheck(id,status){let r=day();r.checks[id]={...(r.checks[id]||{}),status,staff:profile.displayName||user.email,checkedAt:now()};r.staff=profile.displayName||user.email;r.updatedAt=now();await saveDay()}
async function saveNote(id,note){let r=day();r.checks[id]={...(r.checks[id]||{}),note};r.updatedAt=now();await saveDay()}
async function saveDay(){try{await setDoc(doc(db,"dailyChecks",today()),{date:today(),...day(),updatedBy:user.uid,updatedAt:serverTimestamp()},{merge:true});$("sync").textContent="クラウド同期済み"}catch(e){$("sync").textContent="保存エラー："+e.message;notify("保存できませんでした")}}
function renderStaff(list){
 const root=$("staffList"); if(!root)return; root.innerHTML="";
 list.sort((a,b)=>(a.staffId||"").localeCompare(b.staffId||""));
 for(const p of list){
  const row=document.createElement("div");row.className="staff-row";
  const info=document.createElement("div");
  const name=document.createElement("b");name.textContent=p.displayName||"名前未設定";
  const meta=document.createElement("small");meta.textContent=`${p.staffId||"ID未登録"} ・ ${p.role==="admin"?"管理者":"一般スタッフ"} ・ ${p.active?"有効":"無効"}`;
  info.append(name,document.createElement("br"),meta);
  const btn=document.createElement("button");btn.textContent=p.active?"利用停止":"利用再開";btn.disabled=p.uid===user.uid;
  btn.onclick=async()=>{if(!confirm(`${p.displayName||p.staffId} を${p.active?"利用停止":"利用再開"}しますか？`))return;try{await setDoc(doc(db,"users",p.uid),{active:!p.active,updatedBy:user.uid,updatedAt:serverTimestamp()},{merge:true});notify("スタッフ状態を更新しました")}catch(e){notify("更新失敗："+e.message)}};
  row.append(info,btn);root.append(row);
 }
 if(!list.length)root.textContent="スタッフはまだ登録されていません。";
}
function subscribe(){unsubs.forEach(f=>f());unsubs=[];if(admin())unsubs.push(onSnapshot(collection(db,"users"),s=>renderStaff(s.docs.map(d=>({uid:d.id,...d.data()}))),e=>{$("staffList").textContent="スタッフ一覧の読込に失敗しました："+e.message}));unsubs.push(onSnapshot(collection(db,"dailyChecks"),s=>{daily={};s.forEach(d=>daily[d.id]=d.data());render()},e=>{$("sync").textContent="点検データ読込エラー："+e.message}));unsubs.push(onSnapshot(collection(db,"reports"),s=>{reports=[];s.forEach(d=>reports.push({...d.data(),id:d.id}));render()},e=>notify("報告読込エラー："+e.message)));unsubs.push(onSnapshot(doc(db,"settings","checklist"),s=>{if(s.exists())items=s.data().items||defaults;else if(admin())setDoc(doc(db,"settings","checklist"),{items:defaults,updatedBy:user.uid});render()},e=>console.error(e)))}
onAuthStateChanged(auth,async u=>{unsubs.forEach(f=>f());unsubs=[];user=u;if(!u){$("loginScreen").hidden=false;$("app").hidden=true;return}try{let p=await getDoc(doc(db,"users",u.uid));if(!p.exists()||p.data().active!==true){await signOut(auth);$("loginError").textContent="利用権限がありません。管理者に確認してください。";return}profile=p.data();$("loginScreen").hidden=true;$("app").hidden=false;subscribe();render()}catch(e){await signOut(auth);$("loginError").textContent="ユーザー情報エラー："+e.message}});
$("loginForm").onsubmit=async e=>{e.preventDefault();$("loginError").textContent="";try{await signInWithEmailAndPassword(auth,staffIdToEmail($("staffId").value),$("password").value)}catch(err){$("loginError").textContent=err.message?.includes("スタッフID")?err.message:"ログインできません。スタッフIDとパスワードを確認してください。"}};
$("staffForm").onsubmit=async e=>{
 e.preventDefault();$("staffError").textContent="";
 if(!admin()){ $("staffError").textContent="管理者のみ操作できます"; return; }
 const staffId=$("newStaffId").value.trim().toLowerCase(),displayName=$("newStaffName").value.trim(),password=$("newStaffPassword").value,role=$("newStaffRole").value;
 try{
  const email=staffIdToEmail(staffId);
  const cred=await createUserWithEmailAndPassword(staffAuth,email,password);
  await setDoc(doc(db,"users",cred.user.uid),{staffId,displayName,role,active:true,createdBy:user.uid,updatedBy:user.uid,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
  await signOut(staffAuth);
  $("staffForm").reset();notify("スタッフを追加しました");
 }catch(err){
  try{if(staffAuth.currentUser)await signOut(staffAuth)}catch(_){}
  $("staffError").textContent=err.code==="auth/email-already-in-use"?"このスタッフIDは既に使用されています":err.code==="auth/weak-password"?"パスワードは6文字以上で設定してください":"追加できませんでした："+(err.message||"エラー");
 }
};
$("logout").onclick=()=>signOut(auth);
$("reset").onclick=async()=>{if(confirm("今日の点検結果を削除しますか？")){try{await deleteDoc(doc(db,"dailyChecks",today()));notify("今日の記録をリセットしました")}catch(e){notify("リセット失敗："+e.message)}}};
$("addForm").onsubmit=async e=>{e.preventDefault();if(!admin())return;try{items=[...items,{id:"custom-"+Date.now(),category:$("category").value,name:$("itemName").value.trim()}];await setDoc(doc(db,"settings","checklist"),{items,updatedBy:user.uid});$("itemName").value="";notify("点検項目を追加しました")}catch(e){notify("追加失敗："+e.message)}};
$("reportForm").onsubmit=async e=>{e.preventDefault();let b=e.submitter;b.disabled=true;try{let id="r-"+crypto.randomUUID();await setDoc(doc(db,"reports",id),{id,title:$("title").value.trim(),category:$("reportCategory").value,urgency:$("urgency").value,description:$("description").value.trim(),staff:profile.displayName||user.email,createdBy:user.uid,updatedBy:user.uid,createdAt:now(),updatedAt:serverTimestamp(),resolved:false});$("reportForm").reset();notify("異常報告を共有しました（写真は未対応）")}catch(err){notify("保存失敗："+err.message)}finally{b.disabled=false}};
$("export").onclick=()=>{let blob=new Blob([JSON.stringify({items,daily,reports},null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="tenken-pro-cloud-backup-"+today()+".json";a.click();URL.revokeObjectURL(a.href)};
$("import").onchange=async e=>{let f=e.target.files[0];if(!f)return;try{if(!admin())throw Error("管理者のみ実行できます");let old=JSON.parse(await f.text());if(!old.daily||!Array.isArray(old.items))throw Error("バックアップ形式が違います");if(!confirm("旧バックアップの点検履歴・異常報告（文章）・点検項目をクラウドに追加します。写真は移行しません。続けますか？"))return;let batch=writeBatch(db);for(let[d,r]of Object.entries(old.daily))batch.set(doc(db,"dailyChecks",d),{date:d,...r,updatedBy:user.uid,updatedAt:serverTimestamp()},{merge:true});for(let r of old.reports||[]){let{id,...rest}=r;batch.set(doc(db,"reports",id||"old-"+crypto.randomUUID()),{...rest,id:id||"old-"+crypto.randomUUID(),photoId:"",createdBy:user.uid,updatedBy:user.uid},{merge:true})}batch.set(doc(db,"settings","checklist"),{items:old.items,updatedBy:user.uid},{merge:true});await batch.commit();notify("旧データを移行しました")}catch(err){alert("移行失敗："+err.message)}finally{e.target.value=""}};

if("serviceWorker" in navigator && location.protocol.startsWith("http")){window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(console.warn));}
