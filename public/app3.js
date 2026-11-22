/* ---------- Pending ---------- */
function pendingView(rec){
  const a=UNITS.filter(u=>rec.units[u.k].status==="approved").length;
  return `<div class="wrap"><div class="card"><div class="center"><div class="ico wait">⏳</div><h2>Clearance Processing</h2>
  <p class="lead" style="max-width:480px;margin:8px auto 0">Your clearance has been submitted and is <b>awaiting approval</b> from the relevant units. Please check back again later. The application form will not show again while this request is pending.</p></div>
  <div class="stats"><div class="stat"><b>${UNITS.length}</b><span>Total Units</span></div><div class="stat"><b>${a}</b><span>Approved</span></div><div class="stat"><b>${UNITS.length-a}</b><span>Pending</span></div></div><div class="bar"><i style="width:${Math.round(a/UNITS.length*100)}%"></i></div>
  <div class="sec"><h3 style="margin-top:0">Unit Approval Progress</h3><p class="lead" style="font-size:13px">These units match the sections on your clearance application form.</p>
  ${UNITS.map((u,i)=>{const s=rec.units[u.k].status;return `<div class="unit"><div><b>${i+1}. ${u.n}</b><p>${u.d}</p></div><span class="badge ${s==="approved"?"b-a":"b-p"}">${s==="approved"?"Approved":"Pending"}</span></div>`}).join("")}</div>
  <div class="info" style="margin-top:14px">If any unit rejects your request, you will be asked to update the required record or document and resubmit. Identity documents (passport photograph and school ID) were submitted with your application.</div>
  <button class="btn" onclick="render();toast('Status refreshed')">Refresh Status</button></div></div>`;
}

/* ---------- Cleared ---------- */
function clearedView(id,s,rec){
  const dt=new Date(rec.approvedAt||Date.now()).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});
  return `<div class="wrap"><div class="card"><div class="center"><div class="ico ok">✓</div><h2>Congratulations!</h2>
  <p class="lead" style="max-width:480px;margin:8px auto 0">Your clearance has been <b>approved</b>. You may print your clearance slip below.</p></div>
  <div class="slip"><div class="wm">PROTOTYPE<br>NOT OFFICIAL</div><h3>UNIVERSITY OF IBADAN</h3><div class="s">Automated Online Graduation Clearance Slip</div>
  <div class="g"><div><small>Full Name</small><b>${esc(s.name)}</b></div><div><small>Matric Number</small><b>${id}</b></div>
  <div><small>Faculty</small><b>${esc(s.faculty)}</b></div><div><small>Department</small><b>${esc(s.dept)}</b></div>
  <div><small>Level / Programme</small><b>${esc(s.level)}</b></div><div><small>Date Approved</small><b>${dt}</b></div></div>
  <div class="stat-ok">STATUS: CLEARED</div>
  <div class="note">Group A21 prototype demonstration – not an official University of Ibadan document.</div></div>
  <div class="row"><button class="btn green" onclick="window.print()">Print Clearance Document</button><button class="btn" onclick="logout()">Logout</button></div></div></div>`;
}

/* ---------- Admin (unit officer demo) ---------- */
function adminView(){
  const db=load(),ids=Object.keys(db);
  const rows=ids.map(id=>{
    const r=db[id],s=getStudent(id);
    return `<tr><td><b>${esc(s?.name||id)}</b><br>${id}<br><span class="badge ${overall(r)==="cleared"?"b-a":overall(r)==="rejected"?"b-r":"b-p"}">${overall(r).toUpperCase()}</span>
    <div style="margin-top:8px"><button class="btn sm green" onclick="setAll('${id}','approved')">Approve all</button> <button class="btn sm" onclick="viewDocs('${id}')">View documents</button></div></td>
    <td>${UNITS.map(u=>{const x=r.units[u.k];return `<div class="u-act"><span style="min-width:190px">${u.n}</span><span class="badge ${x.status==="approved"?"b-a":x.status==="rejected"?"b-r":"b-p"}">${x.status}</span>
      ${x.status!=="approved"?`<button class="btn sm green" onclick="setUnit('${id}','${u.k}','approved')">Approve</button>`:""}
      ${x.status!=="rejected"?`<button class="btn sm red" onclick="rejectUnit('${id}','${u.k}')">Reject</button>`:`<span class="reason">${esc(x.reason)}</span>`}</div>`}).join("")}</td></tr>`}).join("");
  return header("Unit Officer Panel")+`<div class="wrap"><div class="card" style="max-width:1000px"><h2>Clearance Requests</h2>
  <p class="lead">Approve or reject each unit. Students see the result when they log in.</p>
  ${ids.length?`<table><tr><th>Student</th><th>Units</th></tr>${rows}</table>`:`<div class="info">No clearance requests submitted yet. Log in as a student (e.g. E056116 / Olaniyan), submit the form, then return here.</div>`}
  <div class="row" style="margin-top:18px"><button class="btn" onclick="render()">Refresh</button><button class="btn red" onclick="resetAll()">Reset all data</button></div></div>
  <div class="card" style="max-width:1000px"><h2>Student Records</h2>
  <p class="lead">Load the list of graduating students. Format: <b>matric,name,faculty,department,level</b> (one student per line, level optional).</p>
  <div class="info">${Object.keys(ADM.students).length} student records loaded · Login mode: <b>${settings().strict?"Registered students only":"Open to any matric number"}</b></div>
  <textarea id="csv" rows="6" placeholder="matric,name,faculty,department,level&#10;E056116,OLANIYAN TAOFEEQ,Science,Computer Science,Final Year (400 Level)"></textarea>
  <div class="row" style="margin-top:12px"><input type="file" accept=".csv,.txt" onchange="loadCsv(this)">
  <button class="btn primary" onclick="importCsv()">Import records</button>
  <button class="btn" onclick="toggleStrict()">${settings().strict?"Switch to open access":"Allow registered students only"}</button>
  <button class="btn red" onclick="clearRecords()">Clear imported records</button></div></div></div>`;
}
async function getFile(id,k){
  try{const r=await fetch(`/api/admin/file?id=${encodeURIComponent(id)}&key=${k}`,{headers:{Authorization:"Bearer "+S.token}});return r.ok?await r.blob():null}catch{return null}
}
const DOCN={pass:"Passport photograph",id:"School ID card",fees:"Final year school fees receipt",levy:"Graduation levy receipt",alumni:"Alumni (UIAA) levy receipt",other:"Other payment receipt",dept:"Supervisor / project note",faculty:"Faculty document",adm:"Admission letter"};
async function viewDocs(id){
  const r=load()[id],files=r?.data?.files||{},st=getStudent(id),urls=[];let html="";
  for(const k of Object.keys(DOCN)){
    const name=files[k];if(!name)continue;
    const f=await getFile(id,k);
    if(!f){html+=`<div class="doc"><b>${DOCN[k]}</b><span>${esc(name)} – file missing on server</span></div>`;continue}
    const u=URL.createObjectURL(f);urls.push(u);const img=(f.type||"").startsWith("image/");
    html+=`<div class="doc"><b>${DOCN[k]}</b><span>${esc(name)}</span>${img?`<a href="${u}" target="_blank"><img src="${u}" alt=""></a>`:""}<a class="btn sm" href="${u}" target="_blank" rel="noopener">${img?"Open full size":"Open file"}</a></div>`;
  }
  const m=document.createElement("div");m.className="modal";
  m.innerHTML=`<div class="mbox"><div class="row" style="justify-content:space-between;align-items:center;margin-bottom:10px"><h2 style="margin:0;font-size:18px">Documents – ${esc(st?.name||id)}</h2><button class="btn sm" id="mx">Close</button></div>${html||'<div class="info">No documents uploaded.</div>'}</div>`;
  document.body.appendChild(m);
  const close=()=>{urls.forEach(u=>URL.revokeObjectURL(u));m.remove()};
  m.querySelector("#mx").onclick=close;m.onclick=e=>{if(e.target===m)close()};
}
async function toggleStrict(){try{await api("/api/admin/settings",{strict:!settings().strict});render()}catch(e){toast(e.message)}}
function loadCsv(inp){const f=inp.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{$("#csv").value=r.result};r.readAsText(f)}
async function importCsv(){
  try{const r=await api("/api/admin/students",{csv:$("#csv").value||""});await render();toast(`${r.added} imported, ${r.skipped} skipped`)}catch(e){toast(e.message)}
}
async function clearRecords(){if(confirm("Remove imported and self-registered students who have not applied?")){try{await api("/api/admin/clear-students",{});render()}catch(e){toast(e.message)}}}
async function setUnit(id,k,status,reason=""){try{await api("/api/admin/unit",{id,unit:k,status,reason});render()}catch(e){toast(e.message)}}
async function setAll(id,status){try{await api("/api/admin/approve-all",{id});render()}catch(e){toast(e.message)}}
function rejectUnit(id,k){
  const r=prompt("Reason for rejection (shown to the student):","Record incomplete – please update and resubmit.");
  if(r!==null)setUnit(id,k,"rejected",r.trim()||"Rejected – please update your record.");
}
async function resetAll(){if(confirm("Delete ALL clearance applications and uploaded files?")){try{await api("/api/admin/reset",{});render()}catch(e){toast(e.message)}}}

setInterval(()=>{if(S.token&&S.role==="student"&&document.querySelector(".bar"))render()},20000);
render();
