function showStudent(){adminLogin=false;loginError="";try{history.replaceState(null,"",location.pathname+location.search)}catch{}render()}
async function doAdminLogin(e){
  e.preventDefault();
  try{
    const r=await api("/api/admin/login",{id:$("#am").value.trim(),password:$("#ap").value});
    startSess(r.token,"admin","ADMIN");
  }catch(err){loginError=err.message;render()}
}
function logout(){adminLogin=false;setup=null;S={token:null,role:null,id:null};saveSess();loginError="";render()}

/* ---------- Form ---------- */
function fileField(name,label,req,old){
  return `<div><span class="fl">${label}${req?' <span class="req">*</span>':""}</span><div class="file"><input type="file" name="${name}" ${req&&!old?"required":""}>${old?`<div class="cur">Previously uploaded: ${esc(old)}</div>`:""}</div></div>`;
}
function formView(id,s,rec){
  const d=rec?.data||{},f=d.files||{};
  const rejected=rec?UNITS.filter(u=>rec.units[u.k].status==="rejected"):[];
  const chk=(n,t,on=true)=>`<label class="ck"><input type="checkbox" name="${n}" ${on?"checked":""} required> <span>${t}</span></label>`;
  return `<div class="wrap"><form class="card" onsubmit="submitForm(event,'${id}')">
  <h2>Clearance Application Form</h2>
  <p class="lead">Complete all sections below. Each unit will review the information and documents you provide. Incomplete or outdated records may be rejected for correction.</p>
  ${rejected.length?`<div class="warn"><b>Action required – resubmit your application.</b><br>${rejected.map(u=>`• ${u.n}: ${esc(rec.units[u.k].reason||"Rejected – please update your record.")}`).join("<br>")}<br><span style="font-size:12px">Units already approved stay approved.</span></div>`:""}
  ${formError?`<div class="err">${esc(formError)}</div>`:""}
  <div class="info">Based on University of Ibadan certificate clearance practice: Department, Faculty, Main Library, Student Affairs, Admission Office, and payment evidence (Bursary).</div>

  <div class="sec"><h3>1. Personal Information</h3><div class="grid">
   <div class="fld"><label class="l">Full Name *</label><input type="text" value="${esc(s.name)}" readonly></div>
   <div class="fld"><label class="l">Matriculation Number *</label><input type="text" value="${id}" readonly></div>
   <div class="fld"><label class="l">Faculty *</label><input type="text" value="${esc(s.faculty)}" readonly></div>
   <div class="fld"><label class="l">Department *</label><input type="text" value="${esc(s.dept)}" readonly></div>
   <div class="fld"><label class="l">Level / Programme *</label><input type="text" value="${esc(s.level)}" readonly></div>
   <div class="fld"><label class="l">Phone Number *</label><input type="tel" name="phone" value="${esc(d.phone||"")}" placeholder="08031234567" pattern="[0-9+ ]{10,15}" required></div>
  </div><div class="fld"><label class="l">Email Address *</label><input type="email" name="email" value="${esc(d.email||"")}" placeholder="name@example.com" required></div></div>

  <div class="sec"><h3>2. Department Clearance</h3><div class="box"><h4>Department of ${esc(s.dept)}</h4>
   <p class="d">Department cross-checks that your academic records, project, and student file are complete and up to date. If anything is missing, the request can be rejected for update.</p>
   <div class="grid"><div class="fld"><label class="fl">Project / Thesis Title <span class="req">*</span></label><input type="text" name="project" value="${esc(d.project||"")}" required></div>
   <div class="fld"><label class="fl">Project Supervisor <span class="req">*</span></label><input type="text" name="supervisor" value="${esc(d.supervisor||"")}" required></div></div>
   ${chk("c1","I confirm my departmental student file is updated (results, project status, personal data).")}
   ${chk("c2","I have no outstanding departmental obligation (lab, equipment, or forms).")}
   ${fileField("f_dept","Upload: Project clearance / Supervisor note (optional)",false,f.dept)}</div></div>

  <div class="sec"><h3>3. Faculty Clearance</h3><div class="box"><h4>Faculty Office</h4><p class="d">Faculty verifies faculty-level requirements and that departmental clearance can proceed.</p>
   ${chk("c3","I confirm I have met all faculty graduation requirements.")}
   ${chk("c4","I have no outstanding faculty dues or forms.")}
   ${fileField("f_faculty","Upload: Faculty-related document (optional)",false,f.faculty)}</div></div>

  <div class="sec"><h3>4. Main Library Clearance</h3><div class="box"><h4>Kenneth Dike Library / Main Library</h4><p class="d">Library checks for overdue books, unpaid fines, or unreturned materials.</p>
   <div class="fld"><label class="fl">Library Card / Registration Number (if any)</label><input type="text" name="libcard" value="${esc(d.libcard||"")}"></div>
   ${chk("c5","I have returned all borrowed library books and materials.")}
   ${chk("c6","I have no outstanding library fines.")}</div></div>

  <div class="sec"><h3>5. Bursary / Financial Clearance</h3><div class="box"><h4>Bursary</h4><p class="d">Proof of payment of required fees (school fees, graduation levy, alumni levy, etc.).</p>
   <div class="grid">${fileField("f_fees","Final year school fees receipt",true,f.fees)}${fileField("f_levy","Graduation levy receipt",true,f.levy)}
   ${fileField("f_alumni","Alumni (UIAA) levy receipt",true,f.alumni)}${fileField("f_other","Other payment receipt (optional)",false,f.other)}</div>
   ${chk("c7","I confirm all required fees have been paid and receipts are attached.")}</div></div>

  <div class="sec"><h3>6. Student Affairs Clearance</h3><div class="box"><h4>Student Affairs Division</h4><p class="d">Student Affairs checks hostel, disciplinary, and student welfare related obligations.</p>
   <div class="fld"><label class="fl">Hostel / Hall of Residence (if applicable)</label><input type="text" name="hostel" value="${esc(d.hostel||"")}"></div>
   ${chk("c8","I have no outstanding hostel dues or keys (if applicable).")}
   ${chk("c9","I have no pending disciplinary case with Student Affairs.")}</div></div>

  <div class="sec"><h3>7. Admission Office Clearance</h3><div class="box"><h4>Admission Office (Undergraduate)</h4><p class="d">Admission Office verifies admission records for certificate processing.</p>
   ${chk("c10","My admission records with the University are correct and complete.")}
   ${fileField("f_adm","Upload: Admission clearance / letter (if required)",false,f.adm)}</div></div>

  <div class="sec"><h3>8. Sports Council Clearance</h3><div class="box"><h4>Sports Council</h4><p class="d">Confirms no outstanding sports equipment or related obligations.</p>
   ${chk("c11","I have no outstanding sports equipment or Sports Council obligation.")}</div></div>

  <div class="sec"><h3>9. Identity &amp; Supporting Documents</h3><div class="grid">
   ${fileField("f_pass","Passport Photograph",true,f.pass)}${fileField("f_id","School ID Card",true,f.id)}</div></div>

  <div class="sec"><h3>10. Student Declaration</h3>
   ${chk("c12","I declare that the information and documents provided are true and complete. I understand that any unit may reject this request if records are incomplete or not updated.")}</div>
  <button class="btn primary" style="margin-top:14px;padding:12px 20px">${rec?"Resubmit Clearance Request":"Submit Clearance Request"}</button>
  </form></div>`;
}
async function shrink(f){
  if(!(f.type||"").startsWith("image/")||f.size<=900*1024)return f;
  try{
    const img=await createImageBitmap(f),sc=Math.min(1,1600/Math.max(img.width,img.height));
    const c=document.createElement("canvas");c.width=Math.round(img.width*sc);c.height=Math.round(img.height*sc);
    c.getContext("2d").drawImage(img,0,0,c.width,c.height);
    const b=await new Promise(r=>c.toBlob(r,"image/jpeg",.82));
    return b&&b.size<f.size?new File([b],f.name.replace(/\.\w+$/,"")+".jpg",{type:"image/jpeg"}):f;
  }catch{return f}
}
async function submitForm(e,id){
  e.preventDefault();
  const fm=e.target,g=n=>fm.elements[n],btn=fm.querySelector("button:not([type=button]):last-of-type");
  const showErr=m=>{let x=fm.querySelector(".err");if(!x){x=document.createElement("div");x.className="err";fm.insertBefore(x,fm.querySelector(".info"))}x.textContent=m;x.scrollIntoView({behavior:"smooth",block:"center"});btn.disabled=false;btn.textContent=btn.dataset.t};
  btn.dataset.t=btn.textContent;btn.disabled=true;btn.textContent="Uploading…";
  const keys=["dept","faculty","fees","levy","alumni","other","adm","pass","id"],todo=[];
  for(const k of keys){
    const el=g("f_"+k),f0=el&&el.files[0];
    if(f0){
      const f=await shrink(f0);
      if(f.size>3*1024*1024)return showErr(`"${f0.name}" is larger than 3 MB. Please choose a smaller file.`);
      todo.push([k,f]);
    }
  }
  const data={phone:g("phone").value.trim(),email:g("email").value.trim(),project:g("project").value.trim(),
    supervisor:g("supervisor").value.trim(),libcard:g("libcard").value.trim(),hostel:g("hostel").value.trim()};
  try{
    let i=0;
    for(const [k,f] of todo){
      btn.textContent=`Uploading ${++i} of ${todo.length}…`;
      const b64=await new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(String(r.result).split(",")[1]);r.onerror=no;r.readAsDataURL(f)});
      await api("/api/upload",{key:k,name:f.name,type:f.type,b64});
    }
    btn.textContent="Submitting…";
    await api("/api/apply",{data});toast("Clearance request submitted");render();
  }catch(err){showErr(err.message)}
}
