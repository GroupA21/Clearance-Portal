const UNITS=[
 {k:"dept",n:"Department Clearance",d:"Cross-check of academic records, project status, and departmental student file."},
 {k:"faculty",n:"Faculty Clearance",d:"Faculty-level graduation requirements and outstanding faculty obligations."},
 {k:"library",n:"Main Library Clearance",d:"Returned books, library materials, and outstanding fines."},
 {k:"bursary",n:"Bursary / Financial Clearance",d:"School fees, graduation levy, alumni levy, and other payment evidence."},
 {k:"affairs",n:"Student Affairs Clearance",d:"Hostel obligations (if any) and disciplinary standing."},
 {k:"admission",n:"Admission Office Clearance",d:"Verification of admission records for certificate processing."},
 {k:"sports",n:"Sports Council Clearance",d:"Sports equipment and Sports Council related obligations."}
];
// Demo student records (prototype – password is the surname)
const STUDENTS={};
const SKEY="ugc_session";let S={token:null,role:null,id:null},memS=null;
try{S=JSON.parse(sessionStorage.getItem(SKEY))||S}catch{S=memS||S}
function saveSess(){memS=S;try{S.token?sessionStorage.setItem(SKEY,JSON.stringify(S)):sessionStorage.removeItem(SKEY)}catch{}}
let ME={student:null,app:null,id:null},ADM={students:{},apps:{},settings:{strict:false}},setup=null;
const getStudent=id=>ADM.students[id]||(ME.id===id?ME.student:null);
const load=()=>ADM.apps;
const settings=()=>ADM.settings||{};
const profiles=()=>ADM.students;
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function api(path,body){
  const o={method:body?"POST":"GET",headers:{}};
  if(S.token)o.headers.Authorization="Bearer "+S.token;
  if(body){o.headers["Content-Type"]="application/json";o.body=JSON.stringify(body)}
  let r;try{r=await fetch(path,o)}catch{throw new Error("Cannot reach the server. Check your internet connection.")}
  const j=await r.json().catch(()=>({}));
  if(r.status===401&&S.token&&!/login$/.test(path)){S={token:null,role:null,id:null};saveSess();loginError="Session expired. Please log in again.";render();throw new Error("Session expired.")}
  if(!r.ok)throw new Error(j.error||"Something went wrong.");
  return j;
}
function startSess(token,role,id){S={token,role,id};saveSess();adminLogin=false;setup=null;loginError="";render()}
let loginError="",formError="";

function overall(app){
  if(!app)return"none";
  const v=UNITS.map(u=>app.units[u.k].status);
  if(v.every(s=>s==="approved"))return"cleared";
  if(v.includes("rejected"))return"rejected";
  return"pending";
}
function toast(m){const t=document.createElement("div");t.className="toast";t.textContent=m;document.body.appendChild(t);setTimeout(()=>t.remove(),2200)}

function header(label){
  return `<div class="hdr"><div class="brand"><div class="logo"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5"/><path d="M22 9v6"/></svg></div><div><b>Automated Online Graduation Clearance</b><span>University of Ibadan</span></div></div>
  <div class="hr"><span class="pill">${label}</span><button class="btn" onclick="logout()">Logout</button></div></div>`;
}

async function render(){
  const app=$("#app");
  if(!S.token){app.innerHTML=adminLogin?adminLoginView():setup?setupView():loginView();return}
  try{
    if(S.role==="admin"){ADM=await api("/api/admin/data");app.innerHTML=adminView();return}
    const m=await api("/api/me");ME={student:m.student,app:m.app,id:S.id};
    const s=m.student,rec=m.app,id=S.id,st=overall(rec);
    const label=`${esc(s.name)} (${id})`;
    let body;
    if(st==="none")body=formView(id,s,null);
    else if(st==="rejected")body=formView(id,s,rec);
    else if(st==="pending")body=pendingView(rec);
    else body=clearedView(id,s,rec);
    app.innerHTML=header(label)+body;
    window.scrollTo(0,0);
  }catch(e){
    if(!S.token)return;
    app.innerHTML=header("")+`<div class="wrap"><div class="card"><div class="err">${esc(e.message)}</div><button class="btn" onclick="render()">Retry</button></div></div>`;
  }
}

/* ---------- Login ---------- */
function loginView(){
  return `<div class="login-wrap"><div class="hero"><div class="logo"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5"/><path d="M22 9v6"/></svg></div><div><h2>Graduation clearance,<br>all in one place.</h2><p>Submit once and track every unit's approval online – no more running from office to office.</p>
  <ul><li><i>1</i>Fill in one application form</li><li><i>2</i>Track 7 unit approvals live</li><li><i>3</i>Print your clearance slip</li></ul></div><small>Automated Online Clearance System</small></div><form class="login" onsubmit="doLogin(event)">
  <div class="logo">UI</div><h1>Graduation Clearance Portal</h1>
  <p class="sub">University of Ibadan · Automated Online Clearance System</p>
  ${loginError?`<div class="err">${esc(loginError)}</div>`:""}
  <div class="fld"><label class="l" for="m">Matriculation Number</label><input type="text" id="m" autocomplete="username" required></div>
  <div class="fld"><label class="l" for="p">Password</label><input type="password" id="p" autocomplete="current-password" required>
  <div class="hint">Use your <b>Surname</b> as your password.</div></div>
  <button class="btn primary" style="width:100%;padding:12px">Login</button>
  <div class="foot">For final-year / graduating students only</div></form></div>`;
}
function fill(a,b){$("#m").value=a;$("#p").value=b}
async function doLogin(e){
  e.preventDefault();
  const m=$("#m").value.trim().toUpperCase(),p=$("#p").value.trim().toLowerCase();
  try{
    const r=await api("/api/login",{matric:m,password:p});
    if(r.needsSetup){setup={m,p};loginError="";return render()}
    startSess(r.token,"student",m);
  }catch(err){loginError=err.message;render()}
}
function setupView(){
  return `<div class="login-wrap"><div class="hero"><div class="logo"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5"/><path d="M22 9v6"/></svg></div><div><h2>Graduation clearance,<br>all in one place.</h2><p>Submit once and track every unit's approval online – no more running from office to office.</p>
  <ul><li><i>1</i>Fill in one application form</li><li><i>2</i>Track 7 unit approvals live</li><li><i>3</i>Print your clearance slip</li></ul></div><small>Automated Online Clearance System</small></div><form class="login" onsubmit="doSetup(event)">
  <div class="logo">UI</div><h1>First-time Setup</h1>
  <p class="sub">Matric ${esc(setup.m)} – confirm your details to continue</p>
  ${loginError?`<div class="err">${esc(loginError)}</div>`:""}
  <div class="fld"><label class="l">Full Name (Surname first)</label><input type="text" id="sn" placeholder="OLANIYAN TAOFEEQ" required></div>
  <div class="fld"><label class="l">Faculty</label><input type="text" id="sf" placeholder="Science" required></div>
  <div class="fld"><label class="l">Department</label><input type="text" id="sd" placeholder="Computer Science" required></div>
  <div class="fld"><label class="l">Level / Programme</label><input type="text" id="sl" value="Final Year (400 Level)" required>
  <div class="hint">Your password was your surname – it must match the first name above.</div></div>
  <div class="row"><button class="btn primary" style="flex:1;padding:12px">Continue</button><button type="button" class="btn" onclick="setup=null;loginError='';render()">Back</button></div></form></div>`;
}
async function doSetup(e){
  e.preventDefault();
  const name=$("#sn").value.trim().replace(/\s+/g," ").toUpperCase();
  try{
    const r=await api("/api/setup",{matric:setup.m,password:setup.p,name,faculty:$("#sf").value.trim(),dept:$("#sd").value.trim(),level:$("#sl").value.trim()});
    startSess(r.token,"student",setup.m);
  }catch(err){loginError=err.message;render()}
}

let adminLogin=/admin/i.test(location.hash);
function adminLoginView(){
  return `<div class="login-wrap"><form class="login" onsubmit="doAdminLogin(event)" style="grid-column:1/-1">
  <div class="logo">UI</div><h1>Admin Login</h1>
  <p class="sub">Authorised unit officers only</p>
  ${loginError?`<div class="err">${esc(loginError)}</div>`:""}
  <div class="fld"><label class="l" for="am">Admin ID</label><input type="text" id="am" autocomplete="username" required></div>
  <div class="fld"><label class="l" for="ap">Password</label><input type="password" id="ap" autocomplete="current-password" required></div>
  <button class="btn primary" style="width:100%;padding:12px">Login</button>
  <div class="foot"><a href="#" style="color:var(--teal);font-weight:600" onclick="event.preventDefault();showStudent()">← Back to student login</a></div></form></div>`;
}
function showAdmin(){adminLogin=true;loginError="";render()}
