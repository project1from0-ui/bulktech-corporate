(() => {
  const t=(ja,en)=>window.BULKLanguage?.t(ja,en)||ja;
  const menu=document.querySelector('.menu');
  const nav=document.querySelector('#navigation');
  const header=document.querySelector('.site-header');
  const updateHeader=()=>header.classList.toggle('is-scrolled',window.scrollY>24);
  window.addEventListener('scroll',updateHeader,{passive:true});
  updateHeader();
  document.addEventListener('click',e=>{if(!header.contains(e.target))closeMenu();});
  matchMedia('(min-width:701px)').addEventListener('change',e=>{if(e.matches)closeMenu();});
  function closeMenu(){menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label',t('メニューを開く','Open menu'));nav.classList.remove('open');}
  menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?t('メニューを閉じる','Close menu'):t('メニューを開く','Open menu'));nav.classList.toggle('open',open);});
  nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{closeMenu();const target=document.querySelector(a.getAttribute('href'));if(target){target.setAttribute('tabindex','-1');target.focus({preventScroll:true});}}));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu.getAttribute('aria-expanded')==='true'){closeMenu();menu.focus();}});
  document.querySelector('.copy-email').addEventListener('click',async()=>{const status=document.querySelector('.copy-status');try{await navigator.clipboard.writeText('info@bulktech.co.jp');status.textContent=t('メールアドレスをコピーしました。','Email address copied.');}catch{status.textContent=t('コピーできませんでした。表示されたアドレスを選択してコピーしてください。','Unable to copy. Select and copy the displayed email address.');}});
  const story=document.querySelector('.experience');
  const stage=document.querySelector('.experience-stage');
  const opening=document.querySelector('.scene-opening');
  const capture=document.querySelector('.scene-capture');
  const composition=document.querySelector('.capture-composition');
  const photo=document.querySelector('.capture-photo');
  const data=document.querySelector('.capture-data');
  const movement=document.querySelector('.scene-movement');
  const arm=document.querySelector('.scene-arm');
  const future=document.querySelector('.chapter-future');
  const certaintyFocus=document.querySelector('.certainty-focus');
  const chapters=['opening','capture','analysis','vision'].map(name=>document.querySelector('.chapter-'+name));
  const frame=document.querySelector('.target-frame');
  const bones=[...document.querySelectorAll('.pose-lines path')];
  const joints=[...document.querySelectorAll('.pose-points>g')];
  const boneKeys=[['neck','shoulder','hip'],['shoulder','elbow','hand'],['hip','knee','ankle','toe'],['hip','backKnee','backAnkle','backToe']];
  const jointKeys=['neck','shoulder','elbow','hand','hip','knee','ankle','backKnee','backAnkle'];
  const reveals=[...document.querySelectorAll('[data-reveal]')];
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const clamp=x=>Math.min(1,Math.max(0,x));
  const ease=x=>{const t=clamp(x);return t*t*(3-2*t);};
  const between=(p,a,b,c,d)=>ease((p-a)/(b-a))*(1-ease((p-c)/(d-c)));
  let queued=false,current=null,last=0;
  function show(element,opacity,y=0){element.style.opacity=opacity.toFixed(4);element.style.transform=`translate3d(0,${y.toFixed(2)}px,0)`;}
  function render(now){
    queued=false;if(reduced.matches)return;
    const rect=story.getBoundingClientRect();
    const target=clamp(-rect.top/Math.max(1,story.offsetHeight-stage.offsetHeight));
    const dt=last?Math.min(50,now-last):16;last=now;
    if(current===null||Math.abs(current-target)>.45)current=target;
    current+=(target-current)*(1-Math.exp(-dt/75));
    if(Math.abs(target-current)<.0002)current=target;
    const t=current;
    stage.style.setProperty("--journey-progress",String(t));
    stage.dataset.chapter=String(t<.16?1:t<.4?2:t<.82?3:4);
    const p=.16+clamp((t-.36)/.44)*.54;
    const toCamera=ease((t-.36)/.10);
    const toLife=ease((t-.78)/.12);
    const toMission=ease((t-.10)/.12);
    opening.style.opacity=String(1-toMission);
    opening.querySelector('img').style.transform=`scale(${1.025+ease(t/.22)*.12})`;
    capture.style.opacity=String(toCamera*(1-toLife));
    const acquisition=ease((p-.38)/.18);
    photo.style.opacity=String(1-acquisition);
    data.style.opacity=String(acquisition);
    const shift=ease((p-.34)/.24);
    const mobile=innerWidth<=700;
    if(mobile){
      // Fit the source image and its SVG/canvas together below the actual copy.
      const copyBottom=chapters[1].offsetTop+chapters[1].offsetHeight;
      const start=Math.max(copyBottom+22,stage.offsetHeight*.42);
      const available=Math.max(140,stage.offsetHeight-start-34);
      const width=Math.min(innerWidth*2.2,available/.80*1672/941);
      const height=width*941/1672;
      composition.style.width=`${width}px`;
      composition.style.left=`${innerWidth*.5-width*.69}px`;
      composition.style.top=`${start+height*.38}px`;
      composition.style.transform='translate3d(0,-50%,0)';
    }else{
      ['width','left','top'].forEach(key=>composition.style.removeProperty(key));
      composition.style.transform=`translate3d(${shift*1.5}%, -50%, 0) scale(${1+shift*.04})`;
    }
    frame.style.opacity=String(between(p,.26,.31,.40,.48)*.6);
    frame.style.transform=`translate(${(1-ease((p-.26)/.12))*8}px,0)`;
    // 06's isolated-person deformation, mapped into 05's existing capture interval.
    const captureProgress=clamp((p-.22)/.48);
    const amount=(.5-.5*Math.cos(captureProgress*Math.PI*2))*ease(captureProgress/.20);
    const pose=toCamera*(1-toLife)>.001?window.BULKMotion?.render({amount,scan:acquisition,release:0}):null;
    if(pose){
      bones.forEach((el,i)=>el.setAttribute('d',boneKeys[i].map((key,j)=>`${j?'L':'M'} ${pose[key][0].toFixed(2)} ${pose[key][1].toFixed(2)}`).join(' ')));
      joints.forEach((el,i)=>el.setAttribute('transform',`translate(${pose[jointKeys[i]][0].toFixed(2)} ${pose[jointKeys[i]][1].toFixed(2)})`));
    }
    const focus=ease((t-.65)/.055)*(1-ease((t-.78)/.03));
    const focusPose=pose;
    if(focusPose)certaintyFocus.setAttribute('transform',`translate(${focusPose.knee[0]} ${focusPose.knee[1]})`);
    certaintyFocus.style.opacity=String(focusPose?focus:0);
    const solved=ease((p-.47)/.19);
    bones.forEach(el=>{const q=ease((solved-Number(el.dataset.phase)*.13)/.42);el.style.strokeDashoffset=String(1-q);el.style.opacity=String(ease(q/.15)*(.9-focus*.2));});
    joints.forEach(el=>{const q=ease((solved-Number(el.dataset.phase)*.13)/.35);el.style.opacity=String(q*(1-focus*.2));el.querySelector('.point-ring').setAttribute('r',String(12+(1-q)*12));});
    movement.style.opacity=String(toMission*(1-toCamera));
    arm.style.opacity=String(toLife);
    show(future,ease((t-.84)/.09),(1-ease((t-.84)/.09))*22);
    movement.querySelector('img').style.transform=`scale(${1.08-toMission*.06})`;
    const c0=1-ease((t-.09)/.065),c1=between(t,.44,.50,.74,.80),c2=0,c3=between(t,.17,.23,.30,.37);
    [c0,c1,c2,c3].forEach((opacity,i)=>show(chapters[i],opacity,(1-opacity)*(i===0?-26:22)));
    document.querySelector('.opening-link').tabIndex=c0<.08?-1:0;
    reveals.forEach(el=>{const previous=Number(el.dataset.y||0);const top=el.getBoundingClientRect().top-previous;const q=ease((innerHeight*.95-top)/(innerHeight*.26));const y=(1-q)*24;el.dataset.y=String(y);el.style.setProperty('--reveal-y',`${y}px`);el.style.setProperty('--reveal-opacity',String(.3+.7*q));});
    if(current!==target)request();
  }
  function request(){if(!queued){queued=true;requestAnimationFrame(render);}}
  function configure(){
    const technologyAnchor=document.querySelector('#technology'),visionAnchor=document.querySelector('#vision'),futureAnchor=document.querySelector('#product'),certaintyAnchor=document.querySelector('#experience-details');
    if(reduced.matches){chapters[1].prepend(technologyAnchor);chapters[3].prepend(visionAnchor);future.prepend(futureAnchor);chapters[1].prepend(certaintyAnchor);}else{story.insertBefore(technologyAnchor,stage);story.insertBefore(visionAnchor,stage);story.insertBefore(futureAnchor,stage);story.insertBefore(certaintyAnchor,stage);}
    document.querySelector('.opening-link').tabIndex=0;
    document.documentElement.classList.toggle('motion',!reduced.matches);current=null;last=0;if(reduced.matches){[opening,capture,composition,photo,data,movement,arm,future,certaintyFocus,frame,...chapters,...bones,...joints].forEach(el=>{el.removeAttribute('style');el.inert=false;});reveals.forEach(el=>{el.removeAttribute('style');el.dataset.y='0';});}else request();}
  window.addEventListener('bulk-motion-ready',request);
  window.addEventListener('bulk-motion-lost',request);
  window.addEventListener('scroll',request,{passive:true});window.addEventListener('resize',request,{passive:true});reduced.addEventListener('change',configure);
  document.querySelectorAll('.scene img').forEach(img=>img.addEventListener('load',request,{once:true}));
  configure();
  if(location.hash){
    history.scrollRestoration='manual';
    window.addEventListener('pageshow',()=>requestAnimationFrame(()=>{
      const anchor=document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if(anchor)anchor.scrollIntoView({behavior:'instant'});
    }),{once:true});
  }
})();
