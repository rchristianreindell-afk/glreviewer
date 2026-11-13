(() => {
  'use strict';
  const QUESTIONS = window.QUESTION_DATA || [];
  const SECTIONS = [
    {id:'verbal', name:'Verbal Reasoning', part:'Part I · Logical Reasoning', count:10, icon:'⇄'},
    {id:'nonverbal', name:'Non-Verbal Reasoning', part:'Part I · Logical Reasoning', count:20, icon:'◇'},
    {id:'english', name:'English', part:'Part II · Power Test', count:43, icon:'Aa'},
    {id:'science', name:'Science', part:'Part II · Power Test', count:60, icon:'⚗'},
    {id:'mathematics', name:'Mathematics', part:'Part II · Power Test', count:40, icon:'∑'},
    {id:'mechanical', name:'Mechanical-Technical', part:'Part II · Power Test', count:30, icon:'⚙'}
  ];
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const byId = id => QUESTIONS.find(q => q.id === id);
  const sectionOf = id => SECTIONS.find(s => s.id === id);
  const qsFor = id => QUESTIONS.filter(q => q.sectionId === id);
  const stored = (() => { try { return JSON.parse(localStorage.getItem('siyensya2_state') || '{}'); } catch { return {}; } })();
  let progress = stored.progress || {};
  let bookmarks = new Set(stored.bookmarks || []);
  let notebookIds = new Set(stored.notebookIds || []);
  let exams = stored.exams || [];
  let visualCancel = null;
  let labCancels = [];
  let state = {
    view:'dashboard', sectionId:'verbal', questionId:'verbal-01', selected:null, submitted:false,
    reviewSet:null, reviewIndex:0, examIds:[], examIndex:0, examStarted:false,
    examEnd:0, examDuration:120, examSection:'all', examAnswers:{}, examFlagged:[], examTimer:null,
    sourceRotate:0, sourceZoom:100
  };
  const root = $('#viewRoot');

  function save(){
    try { localStorage.setItem('siyensya2_state', JSON.stringify({progress,bookmarks:[...bookmarks],notebookIds:[...notebookIds],exams})); } catch { /* App still works for this session if browser storage is unavailable. */ }
    $('#mistakeCount').textContent = notebookIds.size;
  }
  function toast(msg){
    const old=$('.toast'); if(old) old.remove();
    const el=document.createElement('div'); el.className='toast'; el.textContent=msg; document.body.appendChild(el);
    setTimeout(()=>el.remove(),2300);
  }
  function setCrumb(text){ $('#crumb').innerHTML = `${esc(text)} <span>/</span> ${state.view==='question'?'Practice':esc(state.view[0].toUpperCase()+state.view.slice(1))}`; }
  function qAttempt(id){ return progress[id] || {attempts:0,correct:0,lastAnswer:null,lastCorrect:null}; }
  function recordAttempt(q, answer){
    const old=qAttempt(q.id), correct=answer===q.answer;
    progress[q.id]={attempts:old.attempts+1,correct:old.correct+(correct?1:0),lastAnswer:answer,lastCorrect:correct,lastAt:Date.now()};
    if(correct) notebookIds.delete(q.id); else notebookIds.add(q.id);
    save(); return correct;
  }
  function totalAttempts(){return Object.values(progress).reduce((a,p)=>a+(p.attempts||0),0)}
  function correctAttempts(){return Object.values(progress).reduce((a,p)=>a+(p.correct||0),0)}
  function completion(){return QUESTIONS.filter(q=>qAttempt(q.id).attempts>0).length}
  function accuracy(){let n=totalAttempts();return n?Math.round(correctAttempts()/n*100):0}
  function goView(view){
    if(state.examStarted && view!=='exam'){toast('Finish the active exam before leaving examination mode.');return;}
    state.view=view; state.submitted=false; state.selected=null;
    $$('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
    $$('[data-section]').forEach(b=>b.classList.toggle('active',view==='question' && b.dataset.section===state.sectionId));
    if(view==='dashboard') renderDashboard();
    else if(view==='question') renderQuestion();
    else if(view==='notebook') renderNotebook();
    else if(view==='analytics') renderAnalytics();
    else if(view==='laboratory') renderLaboratory();
    else if(view==='exam') renderExam();
    setCrumb(sectionOf(state.sectionId)?.name || 'Overview');
    $('#sidebar').classList.remove('open');
  }
  function selectSection(id){
    state.sectionId=id; state.questionId=`${id}-01`; state.selected=null; state.submitted=false;
    state.reviewSet=null; goView('question');
  }
  function navHTML(){
    const target=$('#sectionNav');
    target.innerHTML=SECTIONS.map(s=>`<button class="nav-item" data-section="${s.id}"><span>${s.icon}</span>${esc(s.name)}<b class="nav-count">${s.count}</b></button>`).join('');
    $$('[data-section]',target).forEach(b=>b.addEventListener('click',()=>selectSection(b.dataset.section)));
  }
  function pageHead(kicker,title,desc,actions=''){
    return `<div class="page-head"><div><div class="eyebrow">${esc(kicker)}</div><h1>${title}</h1><p>${desc}</p></div><div class="head-actions">${actions}</div></div>`;
  }
  function renderDashboard(){
    const attempted=completion(), done=totalAttempts(), acc=accuracy();
    const sectionCards=SECTIONS.map(s=>{
      const arr=qsFor(s.id), seen=arr.filter(q=>qAttempt(q.id).attempts>0).length;
      const pct=Math.round(seen/s.count*100);
      return `<div class="section-row" data-open-section="${s.id}"><div class="section-dot">${s.icon}</div><div style="min-width:0;flex:1"><strong>${esc(s.name)}</strong><small>${s.count} source questions · ${seen} practiced</small><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div></div><div class="row-end">${pct}%<small style="display:block;font-weight:500">coverage</small></div></div>`;
    }).join('');
    const recent=QUESTIONS.filter(q=>qAttempt(q.id).attempts).sort((a,b)=>(qAttempt(b.id).lastAt||0)-(qAttempt(a.id).lastAt||0)).slice(0,5);
    root.innerHTML=`${pageHead('DOST-SEI SCHOLARSHIP PREPARATION','Understand more than the answer.','Practice the original questions, inspect source-page diagrams, and explore interactive visual aids. Your progress is saved locally in this browser.',`<button class="btn primary" id="startPractice">Continue practice&nbsp; →</button><button class="btn" data-view-jump="exam">Start exam</button>`)}
      <div class="grid stats-grid">
        <div class="stat-card"><div class="stat-icon">▦</div><div class="stat-label">Questions in source</div><div class="stat-value">203</div><div class="stat-foot">Across all 6 sections</div></div>
        <div class="stat-card"><div class="stat-icon">✓</div><div class="stat-label">Questions practiced</div><div class="stat-value">${attempted}</div><div class="stat-foot">${done} total attempts recorded</div></div>
        <div class="stat-card"><div class="stat-icon">◎</div><div class="stat-label">Attempt accuracy</div><div class="stat-value">${acc}%</div><div class="stat-foot">Correct attempts ÷ all attempts</div></div>
        <div class="stat-card"><div class="stat-icon">▤</div><div class="stat-label">Mistake notebook</div><div class="stat-value">${notebookIds.size}</div><div class="stat-foot">Questions last answered incorrectly</div></div>
      </div>
      <div class="grid two-col"><div class="panel"><div class="panel-head"><div><h2>Question library</h2><p>Choose a section to open its original questions.</p></div><span class="subject-badge">203 ITEMS</span></div><div class="section-list">${sectionCards}</div></div>
      <div class="right-stack"><div class="panel"><div class="panel-head"><div><h2>Learning activity</h2><p>Most recent practice activity</p></div></div>${recent.length?recent.map(q=>`<div class="section-row" data-open-q="${q.id}"><div class="section-dot">${qAttempt(q.id).lastCorrect?'✓':'↻'}</div><div style="flex:1;min-width:0"><strong>${esc(q.section)} · Question ${q.number}</strong><small>${qAttempt(q.id).lastCorrect?'Last attempt correct':'Needs another review'}</small></div><span class="muted">→</span></div>`).join(''):`<div class="empty-state"><strong>No practice recorded yet</strong>Choose a section and answer a few questions to start your progress history.</div>`}</div>
      <div class="tip-box"><strong>Source integrity note</strong><br>The answer key contains 203 entries. Written rationalizations are present for 124 items; 79 answer entries do not include a written rationale in the source. Missing explanations are labeled instead of invented.</div>
      <div class="panel"><div class="panel-head"><div><h2>Quick tools</h2><p>Jump straight into a focused activity.</p></div></div><div class="grid" style="grid-template-columns:1fr 1fr;gap:8px"><button class="btn" data-view-jump="laboratory">⚙ Simulations</button><button class="btn" data-view-jump="notebook">▤ Mistake notebook</button><button class="btn" data-view-jump="analytics">◔ Analytics</button><button class="btn" data-view-jump="exam">◷ Exam mode</button></div></div></div></div>
      <div class="footer-note">Progress data stays in this browser using local storage. It is not synced to an account or uploaded to a server.</div>`;
    $$('[data-open-section]').forEach(el=>el.addEventListener('click',()=>selectSection(el.dataset.openSection)));
    $$('[data-open-q]').forEach(el=>el.addEventListener('click',()=>openQuestion(el.dataset.openQ)));
    $('#startPractice').onclick=()=>openQuestion(recent[0]?.id || 'verbal-01');
    $$('[data-view-jump]').forEach(el=>el.addEventListener('click',()=>goView(el.dataset.viewJump)));
  }
  function openQuestion(id){const q=byId(id);if(!q)return;state.sectionId=q.sectionId;state.questionId=id;state.selected=null;state.submitted=false;state.reviewSet=null;goView('question');}
  function getStem(q){
    const lines=(q.text||'').split('\n');
    const cut=lines.findIndex(l=>/^\s*A\.\s*$/.test(l)||/^\s*A\.\s+\S/.test(l));
    let stem=(cut>=0?lines.slice(0,cut):lines).join('\n').trim();
    // Remove an orphaned heading label when the question content begins with an instruction.
    return stem || (q.text||'Question figure / choices are shown in the preserved source page.');
  }
  function displayChoices(q){
    const keys=['A','B','C','D'];
    return keys.map(k=>({key:k,text:q.choices?.[k]||''}));
  }
  function questionArray(){return state.reviewSet || qsFor(state.sectionId);}
  function currentQuestion(){
    if(state.reviewSet) return state.reviewSet[state.reviewIndex];
    return byId(state.questionId);
  }
  function questionPosition(q){return questionArray().findIndex(x=>x.id===q.id);}
  function renderQuestion(){
    const q=currentQuestion(); if(!q){goView('dashboard');return;}
    const list=questionArray(); const pos=questionPosition(q); const exam=false;
    const att=qAttempt(q.id), answer=q.answer;
    const sourceImage=`assets/pages/page-${String(q.pagePdf).padStart(2,'0')}.jpg`;
    let chosen=state.selected;
    if(state.submitted && state.selected===null) chosen=att.lastAnswer;
    const rationale=q.rationale?.trim();
    const choicesHTML=displayChoices(q).map(o=>{
      const selected=chosen===o.key;
      const correctReveal=state.submitted&&o.key===answer;
      const wrongReveal=state.submitted&&selected&&o.key!==answer;
      const optText=o.text?esc(o.text):'<span class="muted">See the original figure on the source page.</span>';
      return `<button class="choice ${selected?'selected':''} ${correctReveal?'correct':''} ${wrongReveal?'incorrect':''}" data-choice="${o.key}" ${state.submitted?'disabled':''}><span class="choice-letter">${o.key}</span><span class="choice-text">${optText}</span></button>`;
    }).join('');
    const feedbackHTML=state.submitted?`
      <div class="feedback ${chosen===answer?'good':'bad'}"><h3>${chosen===answer?'Correct — well done.':'Review this item and try it again.'}</h3><p><strong>Your answer:</strong> ${chosen||'No answer'} · <strong>Answer key:</strong> ${answer||'Not found'}</p>
      ${rationale?`<p><strong>Source rationalization:</strong><br>${esc(rationale).replace(/\n/g,'<br>')}</p>`:`<p><strong>Source limitation:</strong> The PDF lists the answer key but does not provide a written rationalization for this question. The reviewer does not invent one.</p>`}
      <div class="option-analysis"><strong style="font-size:11px">Choice-by-choice check</strong>${displayChoices(q).map(o=>`<div class="option-note"><b>${o.key}${o.key===answer?' · keyed answer':''}:</b> ${o.key===answer?'This is the answer marked correct in the source key.':`The source key does not mark this choice correct. ${rationale?'Use the source rationalization above to compare it with the keyed answer.':'The source does not give a separate explanation for this distractor.'}`}</div>`).join('')}</div>
      </div>`:'';
    const navNums=list.map((x,i)=>{
      const a=qAttempt(x.id), isActive=x.id===q.id;
      return `<button class="qnum ${isActive?'active':''} ${a.attempts?(a.lastCorrect?'done':'wrong'):''} ${bookmarks.has(x.id)?'bookmarked':''}" data-q-index="${i}" title="Question ${x.number}">${x.number}</button>`;
    }).join('');
    root.innerHTML=`${pageHead(q.part,esc(q.section),`Question ${q.number} of ${sectionOf(q.sectionId).count} · Source PDF page ${q.pagePdf} (printed page ${q.printedPage}).`, `<div class="mode-switch"><button class="active">Practice</button><button id="jumpExam">Exam mode</button></div>`)}
      <div class="practice-layout"><div class="panel question-list-panel"><div class="panel-head"><div><h2>Question navigator</h2><p>${q.section}</p></div><span class="subject-badge">${pos+1}/${list.length}</span></div><div class="q-number-grid">${navNums}</div><div class="divider"></div><div class="small-note"><span style="color:#17855f">●</span> Practiced correctly &nbsp; <span style="color:#c44e59">●</span> Last attempt incorrect<br>Blue dot: bookmarked</div><div class="divider"></div><button class="btn small" id="backToSections">← All sections</button></div>
      <div class="question-main"><div class="question-card fade-in"><div class="q-meta"><span class="q-index">QUESTION ${q.number.toString().padStart(2,'0')}</span><span class="subject-badge">${esc(q.section)}</span><span class="q-topic">${esc(q.topic||'General')}</span><span style="margin-left:auto;font-size:10px;color:#8995a8">${att.attempts} attempt${att.attempts===1?'':'s'}</span></div><p class="q-stem">${esc(getStem(q))}</p><div class="choice-list">${choicesHTML}</div><div class="q-actions"><div class="q-actions-left"><button class="btn small" id="bookmarkBtn">${bookmarks.has(q.id)?'★ Bookmarked':'☆ Bookmark'}</button><button class="btn small" id="hintBtn">⌁ Hint</button><button class="btn small" id="compareBtn">Compare options</button></div><div class="q-actions-right">${state.submitted?`<button class="btn" id="retryBtn">↻ Try again</button>`:`<button class="btn primary" id="submitBtn" ${chosen?'':'disabled'}>Submit answer</button>`}<button class="btn" id="prevBtn" ${pos<=0?'disabled':''}>← Previous</button><button class="btn primary" id="nextBtn" ${pos>=list.length-1?'disabled':''}>Next →</button></div></div>${feedbackHTML}<div id="hintPanel" class="tip-box hide" style="margin-top:13px"><strong>Progressive hint</strong><p style="margin:5px 0 0">Start by identifying exactly what the question asks. Then compare each option against the given information. The original figure, when present, is shown in the Source page panel.</p></div></div>
        <div class="right-stack"><div class="visual-card"><div class="visual-head"><div><h3>Interactive visual aid</h3><p>Supplementary model for exploring the underlying idea.</p></div><span class="subject-badge">LIVE</span></div><div class="visual-stage" id="visualStage">${visualHTML(q)}</div><div class="visual-controls" id="visualControls"></div><div class="small-note" style="margin-top:9px">This educational model supplements the question. It does not replace or alter the PDF's original figure, wording, or answer key.</div></div>
        <div class="source-card"><div class="visual-head"><div><h3>Original source page</h3><p>Preserved page image from your uploaded PDF.</p></div><span class="subject-badge">PDF p.${q.pagePdf}</span></div><div class="source-image-wrap"><img class="source-image" id="sourceImage" src="${sourceImage}" alt="Original PDF page ${q.pagePdf}" style="transform:rotate(${state.sourceRotate}deg) scale(${state.sourceZoom/100})" loading="lazy"></div><div class="source-foot"><span>Page ${q.pagePdf} · printed ${q.printedPage}</span><div class="mini-pills"><button class="mini-pill" id="rotatePage">Rotate ↻</button><button class="mini-pill" id="zoomPage">Zoom +</button><a class="mini-pill" href="SIYENSYA-bilidad-2-source.pdf#page=${q.pagePdf}" target="_blank" rel="noopener">Open PDF ↗</a></div></div></div>
        <div class="visual-card"><div class="visual-head"><div><h3>Study companion</h3><p>Source-grounded learning assistance.</p></div><span class="subject-badge">OFFLINE</span></div><div class="chat-box"><p id="tutorText">Choose a learning view. The source rationalization is shown after submission when it exists. This build does not connect to a generative AI service.</p><div class="chat-input-row"><input id="tutorQuestion" placeholder="Ask about this question…"><button class="btn small" id="tutorSend">Ask</button></div><div class="visual-controls"><button class="mini-pill" data-tutor="simple">Explain simply</button><button class="mini-pill" data-tutor="deep">Explain deeply</button><button class="mini-pill" data-tutor="example">Give an example</button></div></div></div></div></div></div>`;
    $$('[data-q-index]').forEach(b=>b.addEventListener('click',()=>navigateToIndex(Number(b.dataset.qIndex))));
    $$('[data-choice]').forEach(b=>b.addEventListener('click',()=>{state.selected=b.dataset.choice;renderQuestion();}));
    $('#submitBtn')?.addEventListener('click',()=>submitCurrent());
    $('#retryBtn')?.addEventListener('click',()=>{state.selected=null;state.submitted=false;renderQuestion();});
    $('#bookmarkBtn').onclick=()=>{bookmarks.has(q.id)?bookmarks.delete(q.id):bookmarks.add(q.id);save();renderQuestion();};
    $('#prevBtn').onclick=()=>navigateToIndex(pos-1); $('#nextBtn').onclick=()=>navigateToIndex(pos+1);
    $('#backToSections').onclick=()=>goView('dashboard');
    $('#jumpExam').onclick=()=>goView('exam');
    $('#hintBtn').onclick=()=>$('#hintPanel').classList.toggle('hide');
    $('#compareBtn').onclick=()=>{const el=$('.option-analysis'); if(el){el.scrollIntoView({behavior:'smooth',block:'center'});} else {toast('Submit an answer to reveal the source-key comparison.');}};
    $('#rotatePage').onclick=()=>{state.sourceRotate=(state.sourceRotate+90)%360;$('#sourceImage').style.transform=`rotate(${state.sourceRotate}deg) scale(${state.sourceZoom/100})`;};
    $('#zoomPage').onclick=()=>{state.sourceZoom=state.sourceZoom>=150?100:state.sourceZoom+25;$('#sourceImage').style.transform=`rotate(${state.sourceRotate}deg) scale(${state.sourceZoom/100})`;};
    $$('[data-tutor]').forEach(b=>b.addEventListener('click',()=>tutorReply(q,b.dataset.tutor)));
    $('#tutorSend').onclick=()=>tutorQuestion(q,$('#tutorQuestion').value);
    setupVisualizer(q);
    $('#mistakeCount').textContent=notebookIds.size;
  }
  function submitCurrent(){
    const q=currentQuestion(); if(!state.selected){toast('Choose an answer first.');return;}
    recordAttempt(q,state.selected); state.submitted=true; renderQuestion();
  }
  function navigateToIndex(i){
    const arr=questionArray(); if(i<0||i>=arr.length)return;
    const q=arr[i]; state.questionId=q.id; state.reviewIndex=i; state.selected=null;state.submitted=false;renderQuestion();
  }
  function tutorReply(q,mode){
    let text='';
    if(mode==='simple') text=q.rationale?`In simpler terms: ${q.rationale}`:`The PDF gives the correct letter (${q.answer}) but no written explanation. Look for the condition or relationship stated in the question, then test each answer choice against it.`;
    if(mode==='deep') text=q.rationale?`Source-based explanation for ${q.section}, item ${q.number}: ${q.rationale}`:`The source does not contain a rationalization for this item, so I will not invent a source explanation. Use the question text and original page image to identify the relevant rule, evidence, formula, or visual relationship.`;
    if(mode==='example') text=`A useful follow-up exercise is to cover the answer choices, solve the question in your own words, and then compare your reasoning with the keyed answer (${q.answer}). ${q.rationale?'The source rationalization can be used as a check.':'There is no written source rationale for this item.'}`;
    $('#tutorText').textContent=text;
  }
  function tutorQuestion(q,ask){
    if(!ask.trim()){toast('Type a question first.');return;}
    const text=q.rationale?`This offline reviewer can show the PDF's rationalization: ${q.rationale}`:`This reviewer has no AI connection and the PDF does not provide a written rationalization for this item. It can preserve the question and source page, but it cannot generate a verified explanation here.`;
    $('#tutorText').textContent=`Your question: “${ask.trim()}”\n\n${text}`; $('#tutorQuestion').value='';
  }
  function visualHTML(q){
    if(q.sectionId==='nonverbal') return `<div class="cube-wrap"><div class="cube" id="spatialCube"><div class="cube-face cube-front">FRONT</div><div class="cube-face cube-back">BACK</div><div class="cube-face cube-right">RIGHT</div><div class="cube-face cube-left">LEFT</div><div class="cube-face cube-top">TOP</div><div class="cube-face cube-bottom">BOTTOM</div></div></div>`;
    if(q.sectionId==='mechanical') return `<svg class="lab-svg" id="gearSvg" viewBox="0 0 430 190" role="img" aria-label="Interactive two-gear model"><defs><radialGradient id="gearFill"><stop offset="0" stop-color="#e7efff"/><stop offset="1" stop-color="#9ab8ed"/></radialGradient></defs><g id="gearA" transform="translate(130 92)"><path id="gearPathA" fill="url(#gearFill)" stroke="#3a62a4" stroke-width="2"/><circle r="10" fill="#fff" stroke="#315b9f" stroke-width="3"/></g><g id="gearB" transform="translate(251 92)"><path id="gearPathB" fill="#bce5de" stroke="#26897d" stroke-width="2"/><circle r="10" fill="#fff" stroke="#26897d" stroke-width="3"/></g><path d="M48 166H380" stroke="#d6deeb" stroke-width="2" stroke-dasharray="4 5"/><text x="130" y="174" fill="#526684" text-anchor="middle" font-size="10">Gear A</text><text x="251" y="174" fill="#526684" text-anchor="middle" font-size="10">Gear B</text></svg>`;
    if(q.sectionId==='mathematics') return `<svg class="lab-svg" id="mathGraph" viewBox="0 0 430 210" role="img" aria-label="Interactive function graph"><g id="gridLines" stroke="#dce4ef" stroke-width="1"></g><path d="M30 105H405 M215 12V195" stroke="#7388a7" stroke-width="1.5"/><path id="graphLine" d="M40 150L390 60" stroke="#3269d6" stroke-width="3" fill="none"/><circle id="graphPoint" cx="215" cy="105" r="5" fill="#0b8b83"/><text x="390" y="98" fill="#647792" font-size="10">x</text><text x="224" y="17" fill="#647792" font-size="10">y</text><text x="36" y="22" fill="#344b70" font-size="11" id="mathEquation">y = ax + b</text></svg>`;
    if(q.sectionId==='science'){
      const low=(q.text||'').toLowerCase();
      if(/wave|sound|light|displacement/.test(low)) return `<svg class="lab-svg" id="waveSvg" viewBox="0 0 430 190"><path d="M20 95H410" stroke="#9aa9bd" stroke-dasharray="4 4"/><path id="wavePath" d="" fill="none" stroke="#3269d6" stroke-width="4" stroke-linecap="round"/><text x="24" y="24" fill="#486182" font-size="11">Wave motion explorer</text><text x="24" y="174" fill="#71819a" font-size="10">Change amplitude and frequency below</text></svg>`;
      if(/atom|electron|element|molecule|chemical|bond|compound/.test(low)) return `<div class="molecule-stage"><div class="nucleus">+</div><div class="orbit orbit-one"><span class="electron"></span></div><div class="orbit orbit-two"><span class="electron"></span></div><div class="orbit orbit-three"><span class="electron"></span></div></div>`;
      if(/earth|typhoon|delta|planet|solar|ocean|eclipse|rock|volcano/.test(low)) return `<div class="earth-scene"><div class="earth-ball" id="earthBall"><span></span></div><div class="orbit-ring"></div><div class="earth-caption">EARTH SYSTEM MODEL</div></div>`;
      return `<div class="cell-scene"><div class="cell-body"><div class="cell-nucleus"></div><i class="org o1"></i><i class="org o2"></i><i class="org o3"></i><i class="org o4"></i></div><div class="cell-label">Interactive biology model</div></div>`;
    }
    if(q.sectionId==='english') return `<div class="english-scene"><div class="sentence-flow"><span class="word-chip c1">SUBJECT</span><span class="flow-arrow">→</span><span class="word-chip c2">VERB</span><span class="flow-arrow">→</span><span class="word-chip c3">OBJECT / IDEA</span></div><div class="english-example" id="englishExample">A clear sentence connects its parts.</div><div class="english-caption">Tap a part below to inspect its role.</div></div>`;
    return `<div class="analogy-scene"><div class="analogy-node"><b>A</b><small>first idea</small></div><div class="analogy-link"><span>relationship</span><i>→</i></div><div class="analogy-node"><b>B</b><small>paired idea</small></div><div class="analogy-sep">::</div><div class="analogy-node"><b>C</b><small>new idea</small></div><div class="analogy-link"><span>same rule</span><i>→</i></div><div class="analogy-node"><b>?</b><small>find match</small></div></div>`;
  }
  function setupVisualizer(q){
    if(visualCancel) { try{visualCancel()}catch{} visualCancel=null; }
    const controls=$('#visualControls');
    if(q.sectionId==='nonverbal'){
      controls.innerHTML=`<label>Rotate X <input id="rotX" type="range" min="-180" max="180" value="-22"></label><label>Rotate Y <input id="rotY" type="range" min="-180" max="180" value="35"></label><button class="mini-pill" id="turn90">Rotate 90°</button><button class="mini-pill" id="flipCube">Mirror view</button><button class="mini-pill" id="resetCube">Reset</button>`;
      let x=-22,y=35,z=0,mirror=1;const cube=$('#spatialCube');
      const draw=()=>cube.style.transform=`rotateX(${x}deg) rotateY(${y}deg) rotateZ(${z}deg) scaleX(${mirror})`;
      $('#rotX').oninput=e=>{x=+e.target.value;draw()};$('#rotY').oninput=e=>{y=+e.target.value;draw()};
      $('#turn90').onclick=()=>{y+=90;$('#rotY').value=((y+180)%360)-180;draw()};$('#flipCube').onclick=()=>{mirror*=-1;draw()};$('#resetCube').onclick=()=>{x=-22;y=35;z=0;mirror=1;$('#rotX').value=x;$('#rotY').value=y;draw()};
    }else if(q.sectionId==='mechanical'){
      controls.innerHTML=`<label>Gear A teeth <input id="teethA" type="range" min="8" max="28" value="16"></label><label>Gear B teeth <input id="teethB" type="range" min="8" max="32" value="24"></label><label>Speed <input id="gearSpeed" type="range" min="0" max="10" value="3"></label><button class="mini-pill" id="gearPlay">Pause</button><button class="mini-pill" id="gearReset">Reset</button><div class="gear-info" style="width:100%"><strong id="gearRatio">Ratio: 1.5 : 1</strong><span id="gearDirection">A clockwise · B counterclockwise</span></div>`;
      const a=$('#gearPathA'),b=$('#gearPathB'),ga=$('#gearA'),gb=$('#gearB');let ta=16,tb=24,angle=0,playing=true,last=0,raf;
      const gearPath=(n,r)=>{let pts=[],steps=n*4;for(let i=0;i<steps;i++){let ang=i*Math.PI*2/steps-Math.PI/2;let phase=i%4,rr=r*(phase===0||phase===3?1:0.82);pts.push([Math.cos(ang)*rr,Math.sin(ang)*rr]);}return 'M'+pts.map(p=>p.map(v=>v.toFixed(2)).join(' ')).join('L')+'Z';};
      function update(){a.setAttribute('d',gearPath(ta,Math.round(ta*2)));b.setAttribute('d',gearPath(tb,Math.round(tb*2)));let ra=ta*2,rb=tb*2;gb.setAttribute('transform',`translate(${130+ra+rb-2} 92) rotate(${-angle*ta/tb})`);ga.setAttribute('transform',`translate(130 92) rotate(${angle})`);$('#gearRatio').textContent=`Speed ratio B:A = ${ta/tb>1?(ta/tb).toFixed(2):(ta/tb).toFixed(2)} · Ideal gear ratio = ${tb}:${ta}`;$('#gearDirection').textContent=`A clockwise · B counterclockwise · B speed ${(ta/tb).toFixed(2)}× A`;}
      const tick=t=>{if(!playing){raf=requestAnimationFrame(tick);return;}if(last)angle+=(t-last)*.025*Number($('#gearSpeed').value);last=t;update();raf=requestAnimationFrame(tick)};
      $('#teethA').oninput=e=>{ta=+e.target.value;update()};$('#teethB').oninput=e=>{tb=+e.target.value;update()};$('#gearSpeed').oninput=()=>{};
      $('#gearPlay').onclick=()=>{playing=!playing;$('#gearPlay').textContent=playing?'Pause':'Play'};$('#gearReset').onclick=()=>{angle=0;last=0;update()};update();raf=requestAnimationFrame(tick);visualCancel=()=>cancelAnimationFrame(raf);
    }else if(q.sectionId==='mathematics'){
      const svg=$('#mathGraph');let a=1,b=0;
      for(let x=40;x<=390;x+=35){$('#gridLines').insertAdjacentHTML('beforeend',`<path d="M${x} 12V195"/>`)}for(let y=20;y<=190;y+=28){$('#gridLines').insertAdjacentHTML('beforeend',`<path d="M30 ${y}H405"/>`)}
      controls.innerHTML=`<label>Slope a <input id="slopeVal" type="range" min="-3" max="3" step="0.25" value="1"></label><label>Intercept b <input id="interceptVal" type="range" min="-5" max="5" step="0.5" value="0"></label><button class="mini-pill" id="graphReset">Reset graph</button>`;
      const draw=()=>{let pts=[];for(let i=0;i<=100;i++){let x=-5+i*.1,y=a*x+b;let px=215+x*35,py=105-y*16;pts.push(`${i?'L':'M'}${px.toFixed(1)} ${py.toFixed(1)}`)}$('#graphLine').setAttribute('d',pts.join(''));$('#graphPoint').setAttribute('cx',215);$('#graphPoint').setAttribute('cy',105-b*16);$('#mathEquation').textContent=`y = ${a.toFixed(2)}x ${b<0?'-':'+'} ${Math.abs(b).toFixed(2)}`;};
      $('#slopeVal').oninput=e=>{a=+e.target.value;draw()};$('#interceptVal').oninput=e=>{b=+e.target.value;draw()};$('#graphReset').onclick=()=>{a=1;b=0;$('#slopeVal').value=a;$('#interceptVal').value=b;draw()};draw();
    }else if(q.sectionId==='science'){
      const low=(q.text||'').toLowerCase();
      if(/wave|sound|light|displacement/.test(low)){
        controls.innerHTML=`<label>Amplitude <input id="waveAmp" type="range" min="10" max="65" value="32"></label><label>Frequency <input id="waveFreq" type="range" min="1" max="8" value="3"></label><button class="mini-pill" id="waveToggle">Pause</button>`;
        let time=0,playing=true;const draw=()=>{let amp=+$('#waveAmp').value,f=+$('#waveFreq').value;let p=[];for(let x=20;x<=410;x+=3)p.push(`${x===20?'M':'L'}${x} ${(95+Math.sin((x/390*f*2*Math.PI)+time)*amp).toFixed(1)}`);$('#wavePath').setAttribute('d',p.join(''));};let raf;const tick=()=>{if(playing)time+=.045;draw();raf=requestAnimationFrame(tick)};$('#waveToggle').onclick=()=>{playing=!playing;$('#waveToggle').textContent=playing?'Pause':'Play'};raf=requestAnimationFrame(tick);visualCancel=()=>cancelAnimationFrame(raf);
      }else if(/atom|electron|element|molecule|chemical|bond|compound/.test(low)){
        controls.innerHTML=`<label>Orbit speed <input id="orbitSpeed" type="range" min="1" max="10" value="4"></label><button class="mini-pill" id="orbitPause">Pause</button><span class="small-note">Simplified atomic-orbit illustration; not a scale model.</span>`;let paused=false;const el=$('.molecule-stage');let angle=0;let raf;const loop=()=>{if(!paused)angle+=(Number($('#orbitSpeed').value)||4)*.2;el.style.transform=`rotate(${angle*.12}deg)`;raf=requestAnimationFrame(loop)};$('#orbitPause').onclick=()=>{paused=!paused;$('#orbitPause').textContent=paused?'Play':'Pause'};loop();visualCancel=()=>cancelAnimationFrame(raf);
      }else if(/earth|typhoon|delta|planet|solar|ocean|eclipse|rock|volcano/.test(low)){
        controls.innerHTML=`<label>Rotation speed <input id="earthSpeed" type="range" min="0" max="8" value="3"></label><button class="mini-pill" id="earthPause">Pause</button><span class="small-note">Conceptual Earth-system visual.</span>`;let paused=false,deg=0;const ball=$('#earthBall');let raf;const loop=()=>{if(!paused)deg+=Number($('#earthSpeed').value)*.08;ball.style.transform=`rotateY(${deg}deg)`;raf=requestAnimationFrame(loop)};$('#earthPause').onclick=()=>{paused=!paused;$('#earthPause').textContent=paused?'Play':'Pause'};loop();visualCancel=()=>cancelAnimationFrame(raf);
      }else{
        controls.innerHTML=`<label>Magnification <input id="cellMag" type="range" min="1" max="5" value="2"></label><button class="mini-pill" id="cellFocus">Highlight nucleus</button>`;$('#cellMag').oninput=e=>{$('.cell-body').style.transform=`scale(${1+Number(e.target.value)*.06})`};$('#cellFocus').onclick=()=>{$('.cell-nucleus').classList.toggle('pulse')};
      }
    }else if(q.sectionId==='english'){
      const sample=q.text.slice(0,100).replace(/\n/g,' ').trim();$('#englishExample').textContent=sample.length>90?sample.slice(0,87)+'…':sample;
      controls.innerHTML=`<button class="mini-pill" data-part="SUBJECT">Subject</button><button class="mini-pill" data-part="VERB">Verb</button><button class="mini-pill" data-part="OBJECT / IDEA">Object / idea</button><button class="mini-pill" id="sentencePlay">Animate sequence</button>`;
      $$('[data-part]').forEach(b=>b.onclick=()=>{$$('.word-chip').forEach(c=>c.style.outline='none');const t=$$('.word-chip').find(c=>c.textContent===b.dataset.part);if(t)t.style.outline='3px solid #a2baf0';$('#englishExample').textContent=`${b.dataset.part}: identify its role in the sentence before choosing an answer.`});
      $('#sentencePlay').onclick=()=>{$$('.word-chip').forEach((c,i)=>{c.classList.remove('pulse');setTimeout(()=>c.classList.add('pulse'),i*300)});};
    }else{
      controls.innerHTML=`<button class="mini-pill" id="analogyReveal">Reveal relationship step</button><span class="small-note" id="analogyNote">Identify the relationship, then apply the same rule to the second pair.</span>`;
      $('#analogyReveal').onclick=()=>{$('#analogyNote').textContent='First describe how A relates to B in one short phrase. Then look for the answer that makes C relate to the missing term in the same way.'};
    }
  }
  function renderNotebook(){
    const wrong=QUESTIONS.filter(q=>notebookIds.has(q.id));const marked=QUESTIONS.filter(q=>bookmarks.has(q.id));
    root.innerHTML=`${pageHead('STUDY TOOLS','Mistake notebook','Review the questions you last answered incorrectly and the items you bookmarked.',`<button class="btn" id="clearMistakes">Clear mistake list</button>`)}<div class="review-filter"><button class="btn small primary" id="showWrong">Incorrect (${wrong.length})</button><button class="btn small" id="showMarked">Bookmarked (${marked.length})</button></div><div class="panel" id="notebookList">${notebookRows(wrong,'No incorrect questions recorded. Practice an item and submit a wrong answer to add it here.')}</div>`;
    $('#clearMistakes').onclick=()=>{if(confirm('Clear the current mistake list? This does not erase your attempt history.')){notebookIds.clear();save();renderNotebook()}};
    $('#showWrong').onclick=()=>{$('#showWrong').classList.add('primary');$('#showMarked').classList.remove('primary');$('#notebookList').innerHTML=notebookRows(QUESTIONS.filter(q=>notebookIds.has(q.id)),'No incorrect questions recorded.')};
    $('#showMarked').onclick=()=>{$('#showMarked').classList.add('primary');$('#showWrong').classList.remove('primary');$('#notebookList').innerHTML=notebookRows(QUESTIONS.filter(q=>bookmarks.has(q.id)),'No bookmarked questions yet.')};
    $$('[data-open-q]').forEach(el=>el.addEventListener('click',()=>openQuestion(el.dataset.openQ)));
  }
  function notebookRows(list,empty){return list.length?`<div class="section-list">${list.map(q=>`<div class="section-row" data-open-q="${q.id}"><div class="section-dot">${q.number}</div><div style="flex:1;min-width:0"><strong>${esc(q.section)} · Question ${q.number}</strong><small>${esc(getStem(q).slice(0,100))}${getStem(q).length>100?'…':''}</small></div><span class="muted">${qAttempt(q.id).lastCorrect?'✓':'↻'} →</span></div>`).join('')}</div>`:`<div class="empty-state"><strong>${empty}</strong>Your saved items will appear here.</div>`}
  function renderAnalytics(){
    const rows=SECTIONS.map(s=>{const arr=qsFor(s.id);let att=0,cor=0,seen=0;arr.forEach(q=>{let a=qAttempt(q.id);if(a.attempts){seen++;att+=a.attempts;cor+=a.correct}});return {s,seen,att,cor,pct:att?Math.round(cor/att*100):0,coverage:Math.round(seen/arr.length*100)}});
    const max=Math.max(1,...rows.map(x=>x.pct));
    root.innerHTML=`${pageHead('STUDY TOOLS','Progress analytics','Performance summaries calculated from your saved practice attempts. These are learning indicators, not official scholarship-exam predictions.')}<div class="grid stats-grid"><div class="stat-card"><div class="stat-label">Overall accuracy</div><div class="stat-value">${accuracy()}%</div><div class="stat-foot">Based on ${totalAttempts()} attempts</div></div><div class="stat-card"><div class="stat-label">Questions attempted</div><div class="stat-value">${completion()}</div><div class="stat-foot">Of 203 questions</div></div><div class="stat-card"><div class="stat-label">Correct attempts</div><div class="stat-value">${correctAttempts()}</div><div class="stat-foot">Across all practice attempts</div></div><div class="stat-card"><div class="stat-label">Questions to revisit</div><div class="stat-value">${notebookIds.size}</div><div class="stat-foot">Last answered incorrectly</div></div></div><div class="grid two-col"><div class="panel"><div class="panel-head"><div><h2>Accuracy by section</h2><p>Correct attempts divided by all attempts within each section.</p></div></div>${rows.map(x=>`<div class="bar-row"><label>${esc(x.s.name)}</label><div class="bar"><span style="width:${x.pct}%"></span></div><b>${x.att?x.pct+'%':'—'}</b></div>`).join('')}</div><div class="panel"><div class="panel-head"><div><h2>Topic coverage</h2><p>Share of each section attempted at least once.</p></div></div>${rows.map(x=>`<div class="bar-row"><label>${esc(x.s.name)}</label><div class="bar"><span style="width:${x.coverage}%;background:linear-gradient(90deg,#12a18b,#70c6b4)"></span></div><b>${x.coverage}%</b></div>`).join('')}<div class="divider"></div><div class="tip-box"><strong>Recommended next step</strong><br>${rows.some(x=>x.att)?`Revisit ${esc(rows.filter(x=>x.att).sort((a,b)=>a.pct-b.pct)[0].s.name)}, currently the lowest-accuracy section among those practiced.`:'Start with a short Verbal Reasoning set, then practice one section at a time.'}</div></div></div>`;
  }
  function renderLaboratory(){
    labCancels.forEach(fn=>{try{fn()}catch{}});labCancels=[];
    root.innerHTML=`${pageHead('INTERACTIVE LEARNING LAB','Simulation laboratory','Explore controllable visual models for spatial rotation, gear ratios, and mathematical functions. These are supplemental concept demonstrations, not source answer figures.')}<div class="lab-grid"><div class="panel lab-panel"><div class="panel-head"><div><h2>3D spatial rotation trainer</h2><p>Rotate the model around the X and Y axes.</p></div><span class="subject-badge">3D</span></div><div class="visual-stage"><div class="cube-wrap"><div class="cube" id="labCube"><div class="cube-face cube-front">FRONT</div><div class="cube-face cube-back">BACK</div><div class="cube-face cube-right">RIGHT</div><div class="cube-face cube-left">LEFT</div><div class="cube-face cube-top">TOP</div><div class="cube-face cube-bottom">BOTTOM</div></div></div></div><div class="visual-controls"><label>X <input id="labX" type="range" min="-180" max="180" value="-25"></label><label>Y <input id="labY" type="range" min="-180" max="180" value="35"></label><button class="mini-pill" id="labRotate">Rotate 90°</button><button class="mini-pill" id="labReset">Reset</button></div></div><div class="panel lab-panel"><div class="panel-head"><div><h2>Connected gear system</h2><p>Change tooth counts and observe opposite rotation.</p></div><span class="subject-badge">MECHANICAL</span></div><div class="visual-stage" id="labGearStage"><svg class="lab-svg" id="labGearSvg" viewBox="0 0 430 190"><g id="labGearA" transform="translate(130 92)"><path id="labGearPathA" fill="#dce8fb" stroke="#3a62a4" stroke-width="2"/><circle r="9" fill="white" stroke="#315b9f" stroke-width="3"/></g><g id="labGearB" transform="translate(250 92)"><path id="labGearPathB" fill="#c8e9e3" stroke="#26897d" stroke-width="2"/><circle r="9" fill="white" stroke="#26897d" stroke-width="3"/></g></svg></div><div class="visual-controls"><label>Gear A <input id="labTeethA" type="range" min="8" max="28" value="16"></label><label>Gear B <input id="labTeethB" type="range" min="8" max="32" value="24"></label><label>Speed <input id="labGearSpeed" type="range" min="0" max="10" value="3"></label><button class="mini-pill" id="labGearPause">Pause</button></div><div class="small-note" id="labGearText">A and B rotate in opposite directions. The smaller gear rotates faster.</div></div><div class="panel lab-panel"><div class="panel-head"><div><h2>Linear function explorer</h2><p>Adjust slope and intercept to update the graph.</p></div><span class="subject-badge">MATHEMATICS</span></div><div class="visual-stage"><svg class="lab-svg" id="labMathSvg" viewBox="0 0 430 210"><g id="labMathGrid" stroke="#dce4ef"></g><path d="M30 105H405 M215 12V195" stroke="#7388a7" stroke-width="1.5"/><path id="labMathLine" d="" stroke="#3269d6" stroke-width="3" fill="none"/><text x="36" y="22" fill="#344b70" font-size="11" id="labMathEquation">y = x</text></svg></div><div class="visual-controls"><label>Slope <input id="labSlope" type="range" min="-3" max="3" step=".25" value="1"></label><label>Intercept <input id="labIntercept" type="range" min="-5" max="5" step=".5" value="0"></label></div></div><div class="panel lab-panel"><div class="panel-head"><div><h2>Wave explorer</h2><p>See how amplitude and frequency change a wave.</p></div><span class="subject-badge">SCIENCE</span></div><div class="visual-stage"><svg class="lab-svg" id="labWaveSvg" viewBox="0 0 430 190"><path d="M20 95H410" stroke="#9aa9bd" stroke-dasharray="4 4"/><path id="labWavePath" d="" fill="none" stroke="#3269d6" stroke-width="4"/></svg></div><div class="visual-controls"><label>Amplitude <input id="labWaveAmp" type="range" min="10" max="65" value="32"></label><label>Frequency <input id="labWaveFreq" type="range" min="1" max="8" value="3"></label><button class="mini-pill" id="labWavePause">Pause</button></div></div></div><div class="footer-note">All simulations are simplified educational models. They are not intended to reproduce every condition of a physical system.</div>`;
    setupLabCube();setupLabGears();setupLabMath();setupLabWave();
  }
  function setupLabCube(){let x=-25,y=35;const cube=$('#labCube');const draw=()=>cube.style.transform=`rotateX(${x}deg) rotateY(${y}deg)`;$('#labX').oninput=e=>{x=+e.target.value;draw()};$('#labY').oninput=e=>{y=+e.target.value;draw()};$('#labRotate').onclick=()=>{y+=90;$('#labY').value=((y+180)%360)-180;draw()};$('#labReset').onclick=()=>{x=-25;y=35;$('#labX').value=x;$('#labY').value=y;draw()};}
  function setupLabGears(){const pathA=$('#labGearPathA'),pathB=$('#labGearPathB'),a=$('#labGearA'),b=$('#labGearB');let ta=16,tb=24,deg=0,playing=true,last=0;const gearPath=(n,r)=>{let pts=[],steps=n*4;for(let i=0;i<steps;i++){let ang=i*Math.PI*2/steps-Math.PI/2,phase=i%4,rr=r*(phase===0||phase===3?1:.82);pts.push([Math.cos(ang)*rr,Math.sin(ang)*rr])}return 'M'+pts.map(p=>p.map(v=>v.toFixed(1)).join(' ')).join('L')+'Z'};const update=()=>{pathA.setAttribute('d',gearPath(ta,ta*2));pathB.setAttribute('d',gearPath(tb,tb*2));a.setAttribute('transform',`translate(130 92) rotate(${deg})`);b.setAttribute('transform',`translate(${130+ta*2+tb*2-2} 92) rotate(${-deg*ta/tb})`);$('#labGearText').textContent=`Gear A: ${ta} teeth · Gear B: ${tb} teeth · B rotates ${(ta/tb).toFixed(2)} times for each A turn, in the opposite direction.`};let raf;const tick=t=>{if(playing&&last)deg+=(t-last)*.018*Number($('#labGearSpeed').value);last=t;update();raf=requestAnimationFrame(tick)};$('#labTeethA').oninput=e=>{ta=+e.target.value;update()};$('#labTeethB').oninput=e=>{tb=+e.target.value;update()};$('#labGearPause').onclick=()=>{playing=!playing;$('#labGearPause').textContent=playing?'Pause':'Play'};raf=requestAnimationFrame(tick);labCancels.push(()=>cancelAnimationFrame(raf))}
  function setupLabMath(){const g=$('#labMathGrid');for(let x=40;x<=390;x+=35)g.insertAdjacentHTML('beforeend',`<path d="M${x} 12V195"/>`);for(let y=20;y<=190;y+=28)g.insertAdjacentHTML('beforeend',`<path d="M30 ${y}H405"/>`);let a=1,b=0;const draw=()=>{let p=[];for(let i=0;i<=100;i++){let x=-5+i*.1,y=a*x+b;p.push(`${i?'L':'M'}${215+x*35} ${105-y*16}`)}$('#labMathLine').setAttribute('d',p.join(''));$('#labMathEquation').textContent=`y = ${a.toFixed(2)}x ${b<0?'-':'+'} ${Math.abs(b).toFixed(2)}`};$('#labSlope').oninput=e=>{a=+e.target.value;draw()};$('#labIntercept').oninput=e=>{b=+e.target.value;draw()};draw()}
  function setupLabWave(){let t=0,paused=false;const draw=()=>{let amp=+$('#labWaveAmp').value,f=+$('#labWaveFreq').value,p=[];for(let x=20;x<=410;x+=3)p.push(`${x===20?'M':'L'}${x} ${(95+Math.sin(x/390*f*2*Math.PI+t)*amp).toFixed(1)}`);$('#labWavePath').setAttribute('d',p.join(''))};let raf;const tick=()=>{if(!paused)t+=.04;draw();raf=requestAnimationFrame(tick)};$('#labWavePause').onclick=()=>{paused=!paused;$('#labWavePause').textContent=paused?'Play':'Pause'};raf=requestAnimationFrame(tick);labCancels.push(()=>cancelAnimationFrame(raf))}
  function renderExam(){
    if(state.examStarted){renderExamQuestion();return;}
    root.innerHTML=`${pageHead('EXAMINATION MODE','Timed examination simulator','Answer without immediate feedback. Your result and explanations are revealed only after you submit the examination.')}<div class="grid two-col"><div class="panel"><div class="panel-head"><div><h2>Configure your examination</h2><p>Choose the coverage and time limit.</p></div></div><label class="small-note" style="display:block;margin-bottom:7px">Question set</label><select id="examSectionSelect" style="width:100%;padding:11px;border:1px solid var(--line);border-radius:9px;margin-bottom:15px"><option value="all">All sections — 203 questions</option>${SECTIONS.map(s=>`<option value="${s.id}">${esc(s.name)} — ${s.count} questions</option>`).join('')}</select><label class="small-note" style="display:block;margin-bottom:7px">Time limit (minutes)</label><input id="examMinutes" type="number" min="5" max="240" value="120" style="width:100%;padding:11px;border:1px solid var(--line);border-radius:9px;margin-bottom:15px"><label style="display:flex;gap:8px;align-items:center;font-size:12px;margin:10px 0 18px"><input type="checkbox" id="examShuffle" checked> Randomize question order</label><button class="btn primary" id="beginExam">Start timed examination →</button><p class="footer-note">During the exam, answer keys and rationalizations are hidden. Time is measured while this browser tab is open.</p></div><div class="panel"><h2>Examination rules</h2><div class="section-list" style="margin-top:13px"><div class="section-row"><div class="section-dot">01</div><div><strong>No immediate answers</strong><small>Feedback stays hidden until submission.</small></div></div><div class="section-row"><div class="section-dot">02</div><div><strong>Question navigator</strong><small>Move between questions and flag items to revisit.</small></div></div><div class="section-row"><div class="section-dot">03</div><div><strong>Timed attempt</strong><small>The timer auto-submits when it reaches zero.</small></div></div><div class="section-row"><div class="section-dot">04</div><div><strong>Review after submission</strong><small>Inspect your score and source rationalizations.</small></div></div></div></div></div>${exams.length?`<div class="panel" style="margin-top:16px"><h2>Previous examinations</h2>${exams.slice(-5).reverse().map(e=>`<div class="section-row"><div class="section-dot">${e.score}%</div><div style="flex:1"><strong>${esc(e.scope)}</strong><small>${new Date(e.date).toLocaleString()} · ${e.correct}/${e.total} correct</small></div></div>`).join('')}</div>`:''}`;
    $('#beginExam').onclick=()=>startExam();
  }
  function startExam(){
    let scope=$('#examSectionSelect').value,mins=Math.max(5,Math.min(240,Number($('#examMinutes').value)||120));
    let pool=scope==='all'?[...QUESTIONS]:qsFor(scope).slice();if($('#examShuffle').checked)pool.sort(()=>Math.random()-.5);
    state.examIds=pool.map(q=>q.id);state.examIndex=0;state.examAnswers={};state.examFlagged=[];state.examStarted=true;state.examEnd=Date.now()+mins*60000;state.examDuration=mins;state.examSection=scope;state.questionId=state.examIds[0];state.selected=null;
    renderExam();state.examTimer=setInterval(updateExamTimer,1000);updateExamTimer();
  }
  function updateExamTimer(){const el=$('#examTimer');if(!el||!state.examStarted)return;let sec=Math.max(0,Math.ceil((state.examEnd-Date.now())/1000));el.textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;if(sec===0)finishExam(true)}
  function renderExamQuestion(){
    const q=byId(state.examIds[state.examIndex]);if(!q)return;state.questionId=q.id;
    const picked=state.examAnswers[q.id]||null;
    const choiceHTML=displayChoices(q).map(o=>`<button class="choice ${picked===o.key?'selected':''}" data-ex-choice="${o.key}"><span class="choice-letter">${o.key}</span><span class="choice-text">${o.text?esc(o.text):'See the original figure in the source PDF page.'}</span></button>`).join('');
    root.innerHTML=`<div class="exam-banner"><div><strong>EXAMINATION IN PROGRESS</strong><div class="hidden-answer">Answer keys and explanations are hidden until submission.</div></div><div><div class="small-note" style="color:#aab9d4">TIME REMAINING</div><div id="examTimer" class="timer">--:--</div></div></div><div class="practice-layout"><div class="panel question-list-panel"><div class="panel-head"><div><h2>Exam navigator</h2><p>${state.examIndex+1} of ${state.examIds.length}</p></div></div><div class="q-number-grid">${state.examIds.map((id,i)=>`<button class="qnum ${i===state.examIndex?'active':''} ${state.examAnswers[id]?'done':''} ${state.examFlagged.includes(id)?'bookmarked':''}" data-ex-index="${i}">${i+1}</button>`).join('')}</div><div class="divider"></div><div class="small-note">Green: answered · Blue dot: flagged for review</div><div class="divider"></div><button class="btn small" id="submitExamSide">Submit examination</button></div><div class="question-main"><div class="question-card"><div class="q-meta"><span class="q-index">EXAM ITEM ${state.examIndex+1}</span><span class="subject-badge">${esc(q.section)}</span><span class="q-topic">${esc(q.topic)}</span></div><p class="q-stem">${esc(getStem(q))}</p><details class="source-details"><summary>View original PDF page and figures · page ${q.pagePdf}</summary><div class="source-image-wrap" style="max-height:250px;margin-top:9px"><img class="source-image" src="assets/pages/page-${String(q.pagePdf).padStart(2,'0')}.jpg" alt="Source question page ${q.pagePdf}"></div></details><div class="choice-list">${choiceHTML}</div><div class="q-actions"><div class="q-actions-left"><button class="btn small" id="flagExam">${state.examFlagged.includes(q.id)?'★ Flagged':'☆ Flag for review'}</button><a class="btn small" href="SIYENSYA-bilidad-2-source.pdf#page=${q.pagePdf}" target="_blank" rel="noopener">Source page ↗</a></div><div class="q-actions-right"><button class="btn" id="exPrev" ${state.examIndex===0?'disabled':''}>← Previous</button><button class="btn primary" id="exNext" ${state.examIndex===state.examIds.length-1?'disabled':''}>Next →</button></div></div><div class="small-note" style="margin-top:15px">Selected answer: <strong>${picked||'Not answered'}</strong></div></div></div></div>`;
    $$('[data-ex-choice]').forEach(b=>b.onclick=()=>{state.examAnswers[q.id]=b.dataset.exChoice;renderExamQuestion()});
    $$('[data-ex-index]').forEach(b=>b.onclick=()=>{state.examIndex=+b.dataset.exIndex;renderExamQuestion()});
    $('#exPrev').onclick=()=>{state.examIndex--;renderExamQuestion()};$('#exNext').onclick=()=>{state.examIndex++;renderExamQuestion()};
    $('#flagExam').onclick=()=>{let i=state.examFlagged.indexOf(q.id);i>=0?state.examFlagged.splice(i,1):state.examFlagged.push(q.id);renderExamQuestion()};
    $('#submitExamSide').onclick=()=>finishExam(false);
  }
  function finishExam(timeout){
    if(!state.examStarted)return;clearInterval(state.examTimer);const pool=state.examIds.map(byId);let correct=0,answered=0;
    pool.forEach(q=>{const a=state.examAnswers[q.id];if(a)answered++;if(a===q.answer)correct++;if(a)recordAttempt(q,a)});
    const rec={date:Date.now(),scope:state.examSection==='all'?'All sections':sectionOf(state.examSection).name,total:pool.length,answered,correct,score:Math.round(correct/pool.length*100),timeout};exams.push(rec);save();state.examStarted=false;
    root.innerHTML=`${pageHead('EXAMINATION RESULT','Examination submitted',timeout?'The time limit was reached. Your responses have been scored.':'Your responses have been scored. You can now review every question and its source rationalization.') }<div class="grid stats-grid"><div class="stat-card"><div class="stat-label">Score</div><div class="stat-value">${rec.score}%</div><div class="stat-foot">${rec.correct} correct out of ${rec.total}</div></div><div class="stat-card"><div class="stat-label">Answered</div><div class="stat-value">${answered}</div><div class="stat-foot">${rec.total-answered} unanswered</div></div><div class="stat-card"><div class="stat-label">Incorrect / unanswered</div><div class="stat-value">${rec.total-correct}</div><div class="stat-foot">Items to review</div></div><div class="stat-card"><div class="stat-label">Flagged questions</div><div class="stat-value">${state.examFlagged.length}</div><div class="stat-foot">Marked for review</div></div></div><div class="panel"><div class="panel-head"><div><h2>Answer review</h2><p>Open any question for the full source-based rationale where available.</p></div><button class="btn" id="examDashboard">Back to overview</button></div><div class="section-list">${pool.map(q=>{const a=state.examAnswers[q.id],good=a===q.answer;return `<div class="section-row" data-result-q="${q.id}"><div class="section-dot" style="background:${good?'#e7f7ef':'#fff0f1'};color:${good?'#16845d':'#c24e59'}">${good?'✓':'×'}</div><div style="flex:1"><strong>${esc(q.section)} · Item ${q.number}</strong><small>Your answer: ${a||'—'} · Key: ${q.answer}</small></div><span class="muted">Review →</span></div>`}).join('')}</div></div>`;
    $('#examDashboard').onclick=()=>goView('dashboard');$$('[data-result-q]').forEach(b=>b.onclick=()=>openQuestion(b.dataset.resultQ));
  }
  // Search is global: search visible question wording, topic names and section names.
  $('#searchInput').addEventListener('keydown',e=>{
    if(e.key!=='Enter') return;
    const term=e.target.value.trim().toLowerCase();
    if(!term)return;
    const found=QUESTIONS.find(x=>`${x.section} ${x.topic} ${x.text}`.toLowerCase().includes(term));
    if(found){openQuestion(found.id);e.target.value='';}
    else toast('No matching question found.');
  });
  // Navigation and global controls.
  navHTML();
  $$('[data-view]').forEach(b=>b.addEventListener('click',()=>goView(b.dataset.view)));
  $('#mobileMenu').onclick=()=>$('#sidebar').classList.toggle('open');
  $('#focusBtn').onclick=()=>document.body.classList.toggle('focus-mode');
  renderDashboard();
  $('#mistakeCount').textContent=notebookIds.size;
})();
