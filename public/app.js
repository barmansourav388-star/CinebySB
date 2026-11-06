const $ = (s) => document.querySelector(s);
const state = { movies: [], token: localStorage.getItem('cinebySB_admin') || '' };
const esc = (value='') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shareUrl = id => `${location.origin}/watch/${encodeURIComponent(id)}`;
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)}
function openModal(id){$(id).hidden=false;document.body.style.overflow='hidden'}
function closeModals(){document.querySelectorAll('.modal-backdrop').forEach(x=>x.hidden=true);document.body.style.overflow=''}
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',closeModals));
document.querySelectorAll('.modal-backdrop').forEach(b=>b.addEventListener('click',e=>{if(e.target===b)closeModals()}));
$('#yearNow').textContent=new Date().getFullYear();

async function fetchMovies(){
  try{const r=await fetch('/api/movies');state.movies=await r.json();renderMovies();if(!$('#uploadModal').hidden)renderAdminList();}
  catch{ $('#movieGrid').innerHTML='<div class="empty-state"><h3>Could not load the library.</h3><p>Check your connection and refresh the page.</p></div>'; }
}
function renderMovies(filter=''){
  const filtered=state.movies.filter(m=>(m.title+' '+(m.genre||'')+' '+(m.year||'')).toLowerCase().includes(filter.toLowerCase()));
  $('#movieCount').textContent=`${filtered.length} TITLE${filtered.length===1?'':'S'}`;
  if(!filtered.length){$('#movieGrid').innerHTML=`<div class="empty-state"><div class="empty-icon">✳</div><h3>${filter?'No matches found.':'Your screen is ready.'}</h3><p>${filter?'Try another title or genre.':'Movies added by the admin will show up here.'}</p>${!filter?'<button class="secondary-btn" id="emptyUpload">＋ Add the first movie</button>':''}</div>`;$('#emptyUpload')?.addEventListener('click',()=>openAdmin());return;}
  $('#movieGrid').innerHTML=filtered.map(m=>`<article class="movie-card" data-watch="${esc(m.id)}"><div class="movie-poster">${m.posterUrl?`<img loading="lazy" src="${esc(m.posterUrl)}" alt="${esc(m.title)} poster">`:`<div class="poster-placeholder">${esc(m.title.slice(0,1).toUpperCase())}</div>`}<div class="movie-hover"><span>▶</span></div></div><div class="movie-info"><h3>${esc(m.title)}</h3><p>${[m.year,m.genre,m.duration].filter(Boolean).map(esc).join('  ·  ')||'MOVIE'}</p></div></article>`).join('');
  document.querySelectorAll('[data-watch]').forEach(card=>card.addEventListener('click',()=>location.href=`/watch/${encodeURIComponent(card.dataset.watch)}`));
}
function openAdmin(){if(state.token){openModal('#uploadModal');renderAdminList();}else openModal('#adminModal')}
$('#adminOpen').addEventListener('click',openAdmin);$('#heroAdmin').addEventListener('click',openAdmin);$('#emptyUpload')?.addEventListener('click',openAdmin);
$('#loginForm').addEventListener('submit',async e=>{e.preventDefault();$('#loginError').textContent='';try{const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:$('#adminPassword').value})});const data=await r.json();if(!r.ok)throw new Error(data.error);state.token=data.token;localStorage.setItem('cinebySB_admin',state.token);$('#adminPassword').value='';closeModals();openModal('#uploadModal');renderAdminList();}catch(err){$('#loginError').textContent=err.message;}});
$('#logoutBtn').addEventListener('click',()=>{state.token='';localStorage.removeItem('cinebySB_admin');closeModals();toast('Signed out.');});
$('#videoFileName').textContent='Choose movie file';
document.querySelector('input[name="video"]').addEventListener('change',e=>$('#videoFileName').textContent=e.target.files[0]?.name||'Choose movie file');
$('#uploadForm').addEventListener('submit',e=>{
  e.preventDefault();$('#uploadError').textContent='';$('#uploadSuccess').hidden=true;
  const form=e.currentTarget, data=new FormData(form), xhr=new XMLHttpRequest();
  $('#uploadProgress').hidden=false;$('#publishBtn').disabled=true;$('#publishBtn').textContent='Uploading...';
  xhr.open('POST','/api/movies');xhr.setRequestHeader('Authorization',`Bearer ${state.token}`);
  xhr.upload.onprogress=ev=>{if(ev.lengthComputable){const pct=Math.round(ev.loaded/ev.total*100);$('#progressPercent').textContent=pct+'%';$('#progressBar').style.width=pct+'%';$('#progressLabel').textContent='Uploading movie...';}};
  xhr.onload=async()=>{let result={};try{result=JSON.parse(xhr.responseText)}catch{};$('#publishBtn').disabled=false;$('#publishBtn').innerHTML='Publish movie <span>→</span>';$('#uploadProgress').hidden=true;
    if(xhr.status===401){state.token='';localStorage.removeItem('cinebySB_admin');closeModals();openModal('#adminModal');$('#loginError').textContent='Please sign in again.';return;}
    if(xhr.status<200||xhr.status>=300){$('#uploadError').textContent=result.error||'Upload failed.';return;}
    form.reset();$('#videoFileName').textContent='Choose movie file';$('#uploadSuccess').hidden=false;$('#uploadSuccess').innerHTML=`Published! Share this movie: <a href="${esc(result.shareUrl)}" target="_blank" rel="noopener">Open movie link ↗</a> <button type="button" id="copyNewLink" class="text-btn">Copy link</button>`;
    $('#copyNewLink').addEventListener('click',()=>copyText(result.shareUrl));await fetchMovies();renderAdminList();toast('Movie published to cinebySB.');
  };
  xhr.onerror=()=>{$('#publishBtn').disabled=false;$('#publishBtn').innerHTML='Publish movie <span>→</span>';$('#uploadProgress').hidden=true;$('#uploadError').textContent='Network error. Check your connection and try again.';};
  xhr.send(data);
});
function renderAdminList(){const el=$('#adminMovieList');if(!state.movies.length){el.innerHTML='<p class="section-sub">No published movies yet.</p>';return;}el.innerHTML=state.movies.map(m=>`<div class="admin-movie-row"><span>${esc(m.title)}</span><button data-copy="${esc(m.id)}">Copy link</button><button data-delete="${esc(m.id)}">Delete</button></div>`).join('');el.querySelectorAll('[data-copy]').forEach(b=>b.addEventListener('click',()=>copyText(shareUrl(b.dataset.copy))));el.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',()=>deleteMovie(b.dataset.delete)));}
async function deleteMovie(id){if(!confirm('Delete this movie and its uploaded files?'))return;const r=await fetch(`/api/movies/${encodeURIComponent(id)}`,{method:'DELETE',headers:{Authorization:`Bearer ${state.token}`}});const d=await r.json();if(!r.ok){toast(d.error||'Could not delete movie.');return;}await fetchMovies();renderAdminList();toast('Movie deleted.');}
async function copyText(value){try{await navigator.clipboard.writeText(value);toast('Movie link copied!');}catch{prompt('Copy this movie link:',value)}}
$('#searchToggle').addEventListener('click',()=>{const input=$('#searchInput');input.hidden=!input.hidden;if(!input.hidden)input.focus();else{input.value='';renderMovies()}});$('#searchInput').addEventListener('input',e=>renderMovies(e.target.value));

async function renderWatchPage(id){
  document.querySelector('main').innerHTML='<section class="watch-page"><a class="back-link" href="/">← Back to cinebySB</a><div class="not-found"><p>Loading your movie...</p></div></section>';
  try{const r=await fetch('/api/movies');const movies=await r.json();const m=movies.find(x=>x.id===id);if(!m)throw new Error('notfound');
    document.title=`${m.title} — cinebySB`;
    document.querySelector('main').innerHTML=`<section class="watch-page"><a class="back-link" href="/">← Back to cinebySB</a><div class="watch-player"><video controls playsinline preload="metadata" poster="${m.posterUrl?esc(m.posterUrl):''}"><source src="${esc(m.videoUrl)}"></video></div><div class="watch-details"><div><div class="eyebrow"><span class="eyebrow-line"></span> NOW PLAYING ON CINEBYSB</div><h1>${esc(m.title)}</h1><div class="section-sub">${[m.year,m.genre,m.duration].filter(Boolean).map(esc).join('  ·  ')}</div><p>${esc(m.description||'Enjoy the movie.')}</p></div><button class="share-btn" id="shareMovie">↗ Share movie</button></div></section>`;
    $('#shareMovie').addEventListener('click',()=>copyText(location.href));
  }catch{document.querySelector('main').innerHTML='<section class="watch-page"><a class="back-link" href="/">← Back to cinebySB</a><div class="not-found"><h1>Movie not found.</h1><p>This link may be incorrect or the movie may have been removed.</p></div></section>';}
}
const match=location.pathname.match(/^\/watch\/([^/]+)\/?$/);
if(match){renderWatchPage(decodeURIComponent(match[1]));}else{fetchMovies();}
