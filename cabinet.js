(() => {
  'use strict';
  const H=window.Hunter, $=id=>document.getElementById(id);
  const speciesById=Object.fromEntries(H.catalog.map(entry=>[entry.id,entry]));
  const cabinet=$('cabinet'), dialog=$('dialog'), reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const portraitPlay=matchMedia('(orientation:portrait) and (pointer:coarse) and (max-width:1024px)');
  const slotKey='alien-hunter.cabinet.v1', stakeOptions=[5,10,20];
  const art={
    prong:[68,201,234,176], moth:[1052,201,239,176], sprout:[312,386,240,175], ink:[68,568,234,176],
    grey:[1052,568,239,176], blue:[805,568,238,176], tape:[312,201,240,176], badge:[68,386,234,175],
    scanner:[559,386,241,175], agent:[805,201,238,176], green:[559,201,241,176],
    pink:[805,386,238,175], amber:[559,201,241,176], ufo:[1328,17,158,92]
  };
  const names={prong:'Prong',moth:'Moon moth',sprout:'Sprout',ink:'Inkling',grey:'Grey',blue:'Blue',
    tape:'Recorder',badge:'Badge',scanner:'Scanner',agent:'Retrieval agent',ufo:'UFO',green:'Cyclops jar',pink:'Coral eye jar',amber:'Amberling jar'};
  function skin(el,id) {
    const [x,y,w,h]=art[id];
    el.style.backgroundSize=(1672/w*100)+'% '+(941/h*100)+'%';
    el.style.backgroundPosition=(x/(1672-w)*100)+'% '+(y/(941-h)*100)+'%';
  }
  function read() {
    try {
      const s=JSON.parse(localStorage.getItem(slotKey));
      if(s?.version===1 && Number.isSafeInteger(s.balance) && s.balance>=0 && stakeOptions.includes(s.stake)
        && Array.isArray(s.captures) && s.captures.length===3 && Number.isInteger(s.remaining)) return {...H.newGame(),...s};
    } catch {}
    return H.newGame();
  }
  let state=read(), practice=null, busy=false, sound=true, storageOK=true;
  let batch=null;
  try {sound=localStorage.getItem('alien-hunter.sound')!=='off';} catch {}
  const audio=window.CabinetAudio;
  audio.setEnabled(sound);
  const current=()=>practice||state, format=n=>n.toLocaleString('en-GB');
  const wait=ms=>new Promise(done=>setTimeout(done,ms));
  const lock=job=>navigator.locks ? navigator.locks.request(slotKey,job) : Promise.resolve().then(job);
  function save() {
    try{localStorage.setItem(slotKey,JSON.stringify(state));}
    catch {storageOK=false;}
  }
  function reload(){if(storageOK) state=read();}
  const bytes=new Uint32Array(256);
  let head=bytes.length;
  function random(){
    if(head===bytes.length){crypto.getRandomValues(bytes);head=0;}
    return bytes[head++]/4294967296;
  }
  const columns=Array.from({length:5},()=>{
    const reel=document.createElement('div'); reel.className='reel';
    const strip=document.createElement('div'); strip.className='strip';
    reel.append(strip); $('reels').append(reel); return reel;
  });
  function tile(id,stake,doubled=false,specimen=id){
    const el=document.createElement('div'); el.className='symbol '+id; skin(el,id);
    const j=H.jars.indexOf(id);
    if(j>=0){
      el.classList.add('capsule');
      const glass=document.createElement('div');glass.className='glass';
      glass.append(creature(specimen));el.append(glass);
      if(speciesById[specimen].rank)el.classList.add('rare-capsule');
    }
    if(j>=0 || id==='ufo'){
      const tag=document.createElement('span'); tag.className='tag';
      tag.textContent=j<0?'UFO':String(H.values[j]*stake*(doubled?2:1));el.append(tag);
    }
    return el;
  }
  function creature(id){
    const sprite=document.createElement('div');
    sprite.className='creature species-'+id;
    if(speciesById[id].rank)return sprite;
    const lid=document.createElement('i');lid.className='eyelid';sprite.append(lid);
    if(id==='amber')sprite.append(lid.cloneNode());
    return sprite;
  }
  function scanSpecimen(id){
    $('scan-specimen').replaceChildren(creature(id));
  }
  function board(grid,s,doubled,winners=[],variants={}){
    grid.forEach((col,c)=>{
      const strip=columns[c].firstChild;
      strip.replaceChildren(...col.map((id,r)=>{
        const el=tile(id,s,doubled,variants[c*3+r]); if(winners.includes(c*3+r))el.classList.add('win');return el;
      }));
    });
    $('reels').setAttribute('aria-label',grid.map((col,i)=>'Reel '+(i+1)+': '+col.map((id,row)=>speciesById[variants[i*3+row]]?.name??names[id]).join(', ')).join('. '));
  }
  function log(message){$('log').textContent=message+(!storageOK?' · Session only':'');}
  function monitor(label,value,unit){$('read-label').textContent=label;$('read-value').textContent=value;$('read-unit').textContent=unit;}
  function radar(points){
    const rank=H.radarRank(points), here=H.radarRanks[rank], next=H.radarRanks[rank+1];
    $('radar-name').textContent=here.name+' radar';
    $('radar-points').textContent=next?points+'/'+next.contacts:points+' UFOs';
    const progress=next?(points-here.contacts)/(next.contacts-here.contacts):1;
    $('radar').style.setProperty('--progress',progress*100+'%');
  }
  function familyTrail(mask){
    const count=H.jars.filter((_,i)=>mask & (1<<i)).length;
    $('family-progress').textContent=count===3?'2× spins earned':count+'/3 · earn +2';
    $('specimen-lights').querySelectorAll('i').forEach((lamp,i)=>{
      lamp.classList.toggle('lit',Boolean(mask&(1<<i)));
      lamp.title=H.species[i]+(mask&(1<<i)?' · filed':' · wanted');
    });
  }
  function meters(){
    const s=current(),free=s.remaining>0,short=s.balance<s.stake,empty=s.balance<5;
    $('balance').textContent=format(s.balance);$('stake').textContent=s.stake;
    const label=practice && !free?'RETURN':!free && empty?'REFILL':'SPIN';
    $('spin').firstChild.textContent=label;
    $('spin').classList.toggle('labeled',label!=='SPIN');
    $('spin').ariaLabel=label==='RETURN'?'Return to patrol':label==='REFILL'?'Refill free tokens':free?'Play free spin':'Spin for '+s.stake+' tokens';
    const occupied=busy||!!batch;
    $('spin').disabled=occupied || (!free && short && !empty && !practice);
    $('up').disabled=occupied||free||!!practice||s.stake===20||s.balance<stakeOptions[stakeOptions.indexOf(s.stake)+1];
    $('down').disabled=occupied||free||!!practice||s.stake===5;
    $('manual').disabled=$('files').disabled=occupied;
    batchControl();
    $('mode').textContent=free?(practice?'Breach drill':'Containment breach'):'Field patrol';
    $('mission').textContent=free?'Free spins left  '+s.remaining+(s.enhanced && s.remaining<=2?' · 2×':''):'3 UFOs unlock free spins';
    cabinet.classList.toggle('bonus',free);
    const doubleBounty=free && s.enhanced && s.remaining<=2;
    cabinet.classList.toggle('double-bounty',doubleBounty);
    if(doubleBounty)$('mode').textContent='Double bounty';
    $('specimen-lights').hidden=!free;
    familyTrail(s.mask);
    $('case-count').textContent=H.catalog.filter(entry=>H.captured(s,entry)>0).length+'/'+H.catalog.length;
    radar(s.contacts);
    soundControl();
  }
  function soundControl(){
    $('sound').textContent='Sound '+(sound?'on':'off');$('sound').setAttribute('aria-pressed',String(sound));
  }
  function batchControl(){
    const s=current(),button=$('batch');
    button.disabled=batch?batch.stopped:busy||!!practice||s.remaining>0||s.balance<s.stake*3;
    button.textContent=batch?(batch.stopped?'Stopping…':'Stop · '+batch.turn+'/3'):'3 spins · '+s.stake*3;
    button.title=batch?'Finish this spin and end the patrol':'Play up to 3 spins at '+s.stake+' tokens each';
    button.setAttribute('aria-label',batch?'Stop three-spin patrol':button.title);
  }
  function stopBatch(){
    if(batch){batch.stopped=true;batchControl();}
  }
  async function runBatch(){
    if(portraitPlay.matches)return;
    audio.unlock();audio.play('switch');
    if(batch){stopBatch();return;}
    if(busy||practice||state.remaining||state.balance<state.stake*3)return;
    batch={stake:state.stake,turn:0,stopped:false};
    try{
      for(let turn=1;turn<=3;turn++){
        if(batch.stopped||document.hidden||portraitPlay.matches)break;
        batch.turn=turn;
        const r=await patrol(true);
        if(!r||r.triggered||r.rankUp||batch.stopped||turn===3)break;
        await wait(560);
      }
    }finally{batch=null;restore();}
  }
  function report(s){
    const r=s.last;
    if(!r){monitor(practice?'Training scanner':'Bounty scanner','READY',practice?'DRILL ACTIVE':'ON PATROL');log(practice?(s.tractorDrill?'Press Spin to run the Tractor Lock demonstration.':'Training wallet open. Eight practice spins.'):'Bureau online. Ready for patrol.');return;}
    if(r.finished){monitor('Mission total',format(s.featureTotal),'tokens');log('Breach contained. '+format(s.featureTotal)+' tokens. Debrief in the case file.');}
    else if(r.triggered){monitor('Breach detected','8','free spins');log('Three UFOs confirmed. Containment Breach awards eight free spins.');}
    else if(r.caseClosed){monitor('Case closed','+2','2× bounty spins');log('Three bounty families filed. Two double-bounty spins added to the end of the round.');}
    else if(r.payout){monitor(r.bounty?'Bounty collected':'Line award',format(r.payout),'tokens');log((r.bounty?'Captured '+format(r.bounty)+' in bounties. ':'')+(r.lineWins.length?'Line '+r.lineWins.map(i=>i+1).join(', ')+' paid '+format(r.payout-r.bounty)+'. ':'')+'Spin total '+format(r.payout)+' tokens.');}
    else{monitor(r.free?'Breach scan':'Patrol scan','CLEAR',r.free?'CONTINUE SCAN':'NO CONTACT');log(r.free?'No capture on this scan. '+s.remaining+' free spins left.':'Scan complete. No award.');}
    if(r.sightings && !r.triggered && !r.payout){
      monitor('UFO contact','+'+r.sightings,'radar points');log(r.sightings+' UFO '+(r.sightings===1?'contact':'contacts')+' logged. '+s.contacts+' total.');
    }
    if(r.rankUp)log(H.radarRanks[H.radarRank(s.contacts)].name+' radar unlocked. UFO odds improve from your next paid spin.');
    if(!s.remaining && !practice && s.balance<s.stake) log(s.balance<5?'Patrol wallet empty. Press REFILL for 1,240 free tokens.':'Lower the stake to continue patrol.');
  }
  function restore(){
    const s=current();
    const finalGrid=s.last?.tractor?.passes.at(-1)??s.last?.grid??H.initialGrid;
    const winners=s.last?.tractor?finalGrid.flat().flatMap((id,k)=>H.jars.includes(id)||id==='agent'?[k]:[]):s.last?.winners;
    board(finalGrid,s.last?.stake||s.stake,s.last?.enhanced,winners,s.last?.variants);
    resetScope();
    if(s.last?.sightings && !s.remaining){
      s.last.grid.forEach((col,c)=>{if(col.includes('ufo'))markEcho(c);});
    }
    if(s.last?.free && s.last.bounty){
      $('reels').querySelectorAll('.capsule').forEach(el=>el.classList.add('filed'));
      const last=finalGrid.flat().map((id,k)=>s.last.variants?.[k]??id).filter(id=>speciesById[id]).pop();
      if(last)scanSpecimen(last);
    }
    meters();report(s);
  }
  function playAnim(el,frames,opts){
    const anim=el.animate(frames,opts);
    return anim.finished.catch(()=>{});
  }
  function burst(x,y,count=24){
    if(reduced.matches)return;
    for(let i=0;i<count;i++){
      const p=document.createElement('i'),angle=Math.random()*Math.PI*2,d=18+Math.random()*100;
      p.className='spark';p.style.left=x+'px';p.style.top=y+'px';
      p.style.background=i%3?'#bef850':'#ffd16d';$('effects').append(p);
      playAnim(p,[{opacity:1},{opacity:0,transform:'translate('+Math.cos(angle)*d+'px,'+(Math.sin(angle)*d+20)+'px) scale(.35)'}],
        {duration:450+Math.random()*480,easing:'ease-out'}).then(()=>p.remove());
    }
  }
  function center(el){
    const rect=el.getBoundingClientRect(),base=cabinet.getBoundingClientRect();
    return [rect.left-base.left+rect.width/2,rect.top-base.top+rect.height/2];
  }
  function resetScope(){
    const scope=$('echo-scope');scope.hidden=true;
    for(const echo of scope.children)echo.classList.remove('tracked');
  }
  function markEcho(column){
    const scope=$('echo-scope');scope.hidden=false;
    scope.children[column/2].classList.add('tracked');
  }
  async function flyContact(source,column,number){
    const scope=$('echo-scope');scope.hidden=false;
    audio.play('ufo-land',number);
    source.classList.add('contact-land','contact-'+number);
    if(number===3)monitor('Third contact','LOCK','BREACH CONFIRMED');
    if(!reduced.matches){
      const [x,y]=center(source),[tx,ty]=center(scope.children[column/2]);
      const craft=saucer('ufo-flight level-'+number,x,y);
      if(number>1)burst(x,y,number===3?36:13);
      const dx=tx-x,dy=ty-y,lift=Math.min(85,cabinet.clientHeight*.1);
      const pose=(a,b,rotation,scale)=>'translate(-50%,-50%) translate('+a+'px,'+b+'px) rotate('+rotation+'deg) scale('+scale+')';
      await playAnim(craft,[{transform:pose(0,0,-12,.55),opacity:0},{transform:pose(dx*.07,dy*.07-lift*.5,-17,1.13),opacity:1,offset:.23},
        {transform:pose(dx*.63,dy*.63-lift,8,.86),offset:.63},{transform:pose(dx,dy,0,.14),opacity:.8}],
        {duration:500+number*140,easing:'ease-in-out'});
      craft.remove();
    }
    markEcho(column);audio.play('contact',number);
  }
  function saucer(className,x,y){
    const craft=document.createElement('div');craft.className='saucer '+className;
    craft.style.left=x+'px';craft.style.top=y+'px';
    craft.innerHTML='<i></i><b></b>';$('effects').append(craft);
    return craft;
  }
  async function transportPanel(ship,slot,replacement){
    const [x,y]=center(slot),face=slot.getBoundingClientRect();
    const hull=ship.getBoundingClientRect(),cab=cabinet.getBoundingClientRect();
    const emitter=hull.top-cab.top+hull.height*.82;
    const height=Math.max(1,y+face.height*.47-emitter);
    const column=document.createElement('div');
    column.className='transport-column';
    Object.assign(column.style,{left:(x-face.width*.49)+'px',top:emitter+'px',width:face.width*.98+'px',height:height+'px'});
    column.innerHTML='<i></i><b></b>';$('effects').append(column);
    audio.play('transport');
    try{
      await playAnim(column,[{clipPath:'inset(0 0 100% 0)'},{clipPath:'inset(0)'}],{duration:230,easing:'ease-in'});
      slot.classList.add('transport-target');
      replacement.classList.add('transport-cargo');
      Object.assign(replacement.style,{left:x-face.width/2+'px',top:y-face.height/2+'px',width:face.width+'px',height:face.height+'px'});
      $('effects').append(replacement);
      // Keep the old face on its reel throughout descent. The new face takes its place on contact.
      await playAnim(replacement,[
        {transform:'translateY('+(emitter-y)+'px) scale(.13,.06)',filter:'brightness(2) saturate(.2)',opacity:.45},
        {transform:'translateY('+((emitter-y)*.5)+'px) scale(.38,.28)',filter:'brightness(1.7)',opacity:.9,offset:.47},
        {transform:'translateY(0) scale(.94,.98)',filter:'brightness(1.3)',opacity:1,offset:.88},
        {transform:'none',filter:'none',opacity:1}
      ],{duration:690,easing:'ease-in-out'});
      replacement.classList.remove('transport-cargo');
      for(const prop of ['left','top','width','height'])replacement.style.removeProperty(prop);
      slot.replaceWith(replacement);burst(x,y,12);audio.play('filed');
      await playAnim(column,[{opacity:1},{opacity:0}],{duration:200});
    }finally{
      slot.classList.remove('transport-target');column.remove();
      if(replacement.parentNode===$('effects'))replacement.remove();
    }
  }
  async function showEncounter(r,stake){
    if(r.encounter.type==='flip'){await flipNeighbour(r,stake);return;}
    const rewrite=r.encounter.type==='rewrite';
    monitor('Incoming UFO',rewrite?'SHIFT':'DROP',rewrite?'SIGNAL REWRITE':'WING FORMATION');
    log(rewrite?'Signal rewrite. A visiting saucer is changing three symbols.':'Wing formation. A visiting saucer is deploying a UFO.');
    audio.play('scan');
    const ship=saucer('visitor',cabinet.clientWidth*.18,-cabinet.clientHeight*.12);
    try{
      await wait(reduced.matches?180:420);
      for(const {c,row} of r.encounter.changes){
        const slot=columns[c].firstChild.children[row],dest=center(slot);
        const x=dest[0],y=Math.max(ship.clientHeight*.53,dest[1]-slot.clientHeight*1.18);
        const replacement=tile(r.grid[c][row],stake);
        if(!reduced.matches){
          await playAnim(ship,[{left:ship.style.left,top:ship.style.top},{left:x+'px',top:y+'px'}],{duration:540,easing:'ease-in-out'});
          ship.style.left=x+'px';ship.style.top=y+'px';
          await transportPanel(ship,slot,replacement);
        }else{audio.play('transport');slot.replaceWith(replacement);}
      }
      if(!reduced.matches)await playAnim(ship,[{transform:'translate(-50%,-50%)'},{transform:'translate(180%,-190%) scale(.25)',opacity:0}],{duration:350});
    }finally{ship.remove();}
  }
  async function flipNeighbour(r,stake){
    const {source,changes:[{c,row}]}=r.encounter;
    const actor=columns[source].firstChild.children[row],old=columns[c].firstChild.children[row];
    const id=r.grid[c][row],face=tile(id,stake),direction=Math.sign(c-source);
    monitor('Mugshot switch','FLIP',names[id]);log(names[id]+' is turning over the neighbouring tile.');
    audio.play('creature',id==='sprout'?0:1);
    if(reduced.matches){old.replaceWith(face);audio.play('flip');return;}
    const [ax,ay]=center(actor),[bx,by]=center(old),width=old.clientWidth;
    const rootX=ax+direction*width*.09,rootY=ay+actor.clientHeight*.17;
    const length=Math.abs(bx-rootX)+width*.17;
    const arm=document.createElement('div');arm.className='reaching-arm '+id;
    arm.style.left=rootX+'px';arm.style.top=rootY+'px';arm.style.width=length+'px';
    $('effects').append(arm);
    const pose=(scale,angle)=>'translateY(-65%) scaleX('+direction*scale+') rotate('+angle+'deg)';
    try{
      arm.style.transform=pose(1,-5);
      playAnim(actor,[{transform:'none'},{transform:'translateX('+direction*5+'%) rotate('+direction*3+'deg)'},{transform:'none'}],{duration:1100});
      await playAnim(arm,[{transform:pose(.04,9),opacity:0},{transform:pose(.72,0),opacity:1,offset:.65},{transform:pose(1,-5)}],{duration:440,easing:'ease-out'});
      audio.play('flip');
      const origin=direction>0?'left center':'right center';
      old.style.transformOrigin=origin;
      await playAnim(old,[{transform:'perspective(480px) rotateY(0)'},{transform:'perspective(480px) rotateY('+direction*89+'deg)',filter:'brightness(.5)'}],{duration:230,easing:'ease-in'});
      old.replaceWith(face);face.style.transformOrigin=origin;
      await Promise.all([
        playAnim(face,[{transform:'perspective(480px) rotateY('+(-direction*89)+'deg)',filter:'brightness(.5)'},{transform:'perspective(480px) rotateY(0)',filter:'none'}],{duration:290,easing:'ease-out'}),
        playAnim(arm,[{transform:pose(1,-5)},{transform:pose(.85,4),offset:.32},{transform:pose(.04,10),opacity:0}],{duration:430,easing:'ease-in'})
      ]);
      burst(bx,by,8);
    }finally{arm.remove();}
  }
  async function changeScene(entering,detail){
    const hatch=$('hatch'), reveal=hatch.querySelector('.bay-reveal');
    const doors=Array.from(hatch.querySelectorAll('.shutter'));
    const slide=(closed,duration)=>Promise.all(doors.map((door,i)=>{
      const outside='translateY('+(i===0?'-102%':'102%')+')';
      const frames=[{transform:outside},{transform:'translateY(0)'}];
      return playAnim(door,closed?frames:frames.reverse(),{duration,easing:closed?'cubic-bezier(.45,.03,.8,1)':'cubic-bezier(.16,.88,.4,1)',fill:'both'});
    }));
    audio.play(entering?'lockdown':'all-clear');
    log(entering?'Containment breach. Sealing the quarantine bay.':'Lockdown lifted. Reopening the bay.');
    if(reduced.matches){cabinet.classList.toggle('bonus',entering);return;}
    $('hatch-status').textContent=entering?'Emergency protocol':'Recovery complete';
    $('hatch-title').textContent=entering?'Containment breach':'Lockdown lifted';
    $('hatch-detail').textContent=detail;
    hatch.hidden=false;reveal.style.visibility='hidden';
    try{
      await slide(true,420);audio.play('hatch');
      cabinet.classList.toggle('bonus',entering);reveal.style.visibility='visible';
      await wait(230);audio.play('release');
      await slide(false,520);await wait(760);
      await playAnim(hatch,[{opacity:1},{opacity:0}],{duration:450,easing:'ease-out'});
    } finally {
      hatch.hidden=true;
      for(const door of doors)door.getAnimations().forEach(anim=>anim.cancel());
    }
  }
  async function announce(kicker,title,sub){
    $('announce-kicker').textContent=kicker;$('announce-main').textContent=title;$('announce-sub').textContent=sub;
    if(reduced.matches)return;
    const [x,y]=center($('announcement'));burst(x,y,34);
    const portal=document.createElement('div');portal.className='portal';
    $('effects').append(portal);portal.style.left=x+'px';portal.style.top=y+'px';
    playAnim(portal,[{opacity:0,transform:'translate(-50%,-50%) scale(.08) rotate(-50deg)'},
      {opacity:.86,offset:.34},{opacity:0,transform:'translate(-50%,-50%) scale(1.5) rotate(170deg)'}],
      {duration:1370,easing:'ease-out'}).then(()=>portal.remove());
    await playAnim($('announcement'),[{opacity:0,transform:'scale(.91)'},{opacity:1,transform:'scale(1)',offset:.16},{opacity:1,offset:.80},{opacity:0,transform:'translateY(-8px)'}],{duration:1600,easing:'ease-out'});
  }
  // Each scan uses only faces already visible to the player at that reel stop.
  function reelScan(visible,r,stake){
    const count=visible.length;
    const cells=idMatches=>visible.flatMap((col,c)=>col.flatMap((id,row)=>idMatches(id)?[[c,row]]:[]));
    if(count===2){
      const symbol=visible[0][1];
      if(H.regular.includes(symbol) && visible[1][1]===symbol)
        return {kind:'pair',label:'Centre line',value:'2 / 3',mission:'Match on reel 3?',message:'Two '+names[symbol]+' symbols on the centre line. Watching the middle panel.',marks:[[0,1],[1,1]],row:1,wanted:symbol,hold:460};
    }
    const jars=cells(id=>H.jars.includes(id));
    if(count===3 && jars.length>=2){
      const tokens=jars.reduce((sum,[c,row])=>sum+H.values[H.jars.indexOf(visible[c][row])]*stake*(r.enhanced?2:1),0);
      return {kind:'dispatch',label:'Open bounty',value:format(tokens),mission:'Agent on reel 4?',message:format(tokens)+' tokens in sight. A retrieval agent on reel four collects them.',marks:jars,wanted:'agent',hold:720};
    }
    if(count!==4)return null;
    const ufos=cells(id=>id==='ufo');
    if(!r.free && ufos.length===2)
      return {kind:'contact',label:'UFO signal',value:'2 / 3',mission:'Third UFO on reel 5?',message:'Two UFO contacts. A third on reel five opens Containment Breach.',marks:ufos,wanted:'ufo',hold:1050};
    if(r.free && visible[3].includes('agent')){
      let mask=r.priorMask;
      for(const [c,row] of jars)mask|=1<<H.jars.indexOf(visible[c][row]);
      if([3,5,6].includes(mask)){
        const family=H.jars.findIndex((_,i)=>!(mask & (1<<i)));
        const missing=H.species[family];
        return {kind:'specimen',label:'Case families',value:'2 / 3',mission:'Find '+missing,message:'Agent in position. The '+missing+' family would complete the case.',marks:[...jars,...cells(id=>id==='agent')],wanted:H.jars[family],hold:1050};
      }
    }
    const line=H.lines.find(rows=>H.regular.includes(visible[0][rows[0]]) && visible.every((col,c)=>col[rows[c]]===visible[0][rows[0]]));
    if(line)return {kind:'line',label:'Line '+(H.lines.indexOf(line)+1),value:'4 / 5',mission:'Fifth match on reel 5?',message:'Four '+names[visible[0][line[0]]]+' symbols aligned. Tracking the fifth panel.',marks:visible.map((_,c)=>[c,line[c]]),row:line[4],wanted:visible[0][line[0]],hold:1050};
    return null;
  }
  function showReelScan(scan,target){
    cabinet.classList.add('tracking-mode');
    for(const [c,row] of scan.marks)columns[c].firstChild.children[row].classList.add('scan-source');
    const sight=document.createElement('div');
    sight.className='reel-sight';
    sight.setAttribute('aria-hidden','true');
    if(scan.row!==undefined){
      sight.style.top=(scan.row*100/3)+'%';
      sight.style.height='33.3333%';
    }
    target.append(sight);
    $('mission').textContent=scan.mission;
    monitor(scan.label,scan.value,'SCAN REEL '+(columns.indexOf(target)+1));
    log(scan.message);
    audio.play('reel-scan',scan.kind);
    return ()=>{
      sight.remove();
      for(const [c,row] of scan.marks)columns[c].firstChild.children[row].classList.remove('scan-source');
      cabinet.classList.remove('tracking-mode');
    };
  }
  async function confirmScan(reel,row,kind){
    const seal=document.createElement('div');
    seal.className='scan-lock';
    seal.setAttribute('aria-hidden','true');
    seal.style.top=(row*100/3)+'%';
    reel.append(seal);
    if(kind!=='contact')audio.play('lock-click');
    try{
      await playAnim(seal,[{opacity:.55,transform:'scale(1.14)'},{opacity:1,transform:'scale(.91)',offset:.48},{opacity:0,transform:'scale(.91)'}],{duration:340,easing:'ease-out'});
    }finally{seal.remove();}
  }
  async function spinReel(reel,final,stake,duration){
    const strip=reel.firstChild,quick=reduced.matches;
    const fillers=quick?0:Math.round(duration/112);
    const travel=(fillers+3)*100/3;
    const frames=[{opacity:.7},{opacity:1}];
    if(!quick){
      const passing=Array.from({length:fillers},()=>tile(H.regular[Math.floor(Math.random()*H.regular.length)],stake));
      // The old window is at the bottom. Travel downward until the new window reaches the glass.
      strip.prepend(...final,...passing);
      frames.splice(0,2,
        {transform:'translate3d(0,-'+travel+'%,0)',offset:0,easing:'cubic-bezier(.52,0,.82,.52)'},
        {transform:'translate3d(0,-'+(travel*.9)+'%,0)',offset:.18,easing:'linear'},
        {transform:'translate3d(0,-'+(travel*.15)+'%,0)',offset:.72,easing:'cubic-bezier(.15,.5,.32,1)'},
        {transform:'translate3d(0,1.9%,0)',offset:.94,easing:'ease-out'},
        {transform:'translate3d(0,0,0)',offset:1});
    }
    reel.classList.add('rolling');
    await playAnim(strip,frames,{duration:duration});
    strip.replaceChildren(...final);reel.classList.remove('rolling');
  }
  async function roll(r,s){
    const preview=r.grid.map(col=>col.slice());
    for(const change of r.encounter?.changes??[])preview[change.c][change.row]=change.before;
    const quick=reduced.matches;
    const scans=columns.map((_,c)=>!quick && c>=2 ? reelScan(preview.slice(0,c),r,s.stake) : null);
    let clearScan=null;
    const idleMission=$('mission').textContent;
    resetScope();
    let visibleContacts=s.contacts-r.sightings;
    let landed=0;
    async function registerContact(c){
      const number=++landed;
      await flyContact(columns[c].querySelector('.ufo'),c,number);
      radar(++visibleContacts);
      if(number===3){
        monitor('Three confirmed','3 / 3','LOCKDOWN AUTHORIZED');
        const scope=$('echo-scope');scope.classList.add('confirmed');
        try{
          if(!quick){
            burst(...center(scope),40);
            playAnim(cabinet,[{transform:'none'},{transform:'translateY(2px)',offset:.21},{transform:'translateY(-1px)',offset:.54},{transform:'none'}],{duration:310});
            await wait(630);
          }
        }finally{scope.classList.remove('confirmed');}
      }else if(!cabinet.classList.contains('tracking-mode') || c===4){
        monitor('Radar contact',number+' / 3',number===2?'TWO SIGNALS LOCKED':'SIGNAL LOGGED');
      }
      if(!quick)playAnim($('radar'),[{boxShadow:'0 0 1cqw #d9ff60'},{boxShadow:'0 0 0 transparent'}],{duration:480});
    }
    const timing=c=>quick?80:1650+c*255+scans.slice(0,c+1).reduce((sum,scan)=>sum+(scan?.hold??0),0);
    audio.play('motor',timing(4)/1000);
    if(r.free)audio.play(r.enhanced?'double-scan':'scan');
    await Promise.all(columns.map(async(reel,c)=>{
      const final=preview[c].map((id,row)=>tile(id,s.stake,r.enhanced,r.variants[c*3+row]));
      await spinReel(reel,final,s.stake,timing(c));audio.play('stop',c);
      let confirmation;
      if(clearScan){
        clearScan();clearScan=null;
        $('mission').textContent=idleMission;
        monitor('Scanning','•••','REELS ACTIVE');
        log(r.free?'Containment scan in progress…':'Patrol scan in progress…');
        const scan=scans[c];
        if(scan){
          const row=scan.row??preview[c].indexOf(scan.wanted);
          if(preview[c][row]===scan.wanted)confirmation=confirmScan(reel,row,scan.kind);
        }
      }
      if(scans[c+1])clearScan=showReelScan(scans[c+1],columns[c+1]);
      if(preview[c].includes('ufo'))await registerContact(c);
      await confirmation;
    }));
    if(r.encounter){
      await showEncounter(r,s.stake);
      if(r.encounter.type==='formation'){
        await registerContact(r.encounter.changes[0].c);
      }
    }
    board(r.grid,s.stake,r.enhanced,r.winners,r.variants);
  }
  function beam(from,to,duration){
    const beam=document.createElement('i');
    const dx=to[0]-from[0],dy=to[1]-from[1];
    beam.className='tractor-beam';beam.style.left=from[0]+'px';beam.style.top=from[1]+'px';
    beam.style.width=Math.hypot(dx,dy)+'px';beam.style.rotate=Math.atan2(dy,dx)+'rad';
    $('effects').append(beam);
    playAnim(beam,[{opacity:0,transform:'scaleX(0)'},{opacity:.9,transform:'scaleX(1)',offset:.25},{opacity:0}],
      {duration}).then(()=>beam.remove());
  }
  async function retrieve(tileEl,id,agent,index,award,onArrival){
    const j=speciesById[id].family, inBreach=cabinet.classList.contains('bonus');
    const live=inBreach?tileEl.querySelector('.creature'):tileEl;
    if(!reduced.matches)await wait(index*190);
    audio.play('creature',j);
    if(reduced.matches){scanSpecimen(id);onArrival(j,award);return;}
    const from=center(live), target=center(agent), readout=center($('read-value'));
    const dx=target[0]-from[0], dy=target[1]-from[1];
    tileEl.classList.add('caught');agent.classList.add('extracting');
    const tilt=[-14,17,-10][j];
    await playAnim(live,[{transform:'scale(1)'},{transform:'translateY(7%) scale(1.12,.82)',offset:.25},
      {transform:'translateY(-14%) rotate('+tilt+'deg) scale(.92,1.15)',offset:.54},
      {transform:'translateY(-4%) rotate('+(-tilt/2)+'deg) scale(1.08)'}],{duration:520});
    const flyer=creature(id), size=live.getBoundingClientRect().width*(inBreach?1:.55);
    flyer.classList.add('flying-creature');flyer.style.left=from[0]-size/2+'px';
    flyer.style.top=from[1]-size/2+'px';flyer.style.width=size+'px';
    $('effects').append(flyer);if(inBreach)live.style.opacity='0';
    burst(...from,9);beam(target,from,610);audio.play('beam');
    await playAnim(flyer,[{transform:'scale(1.08)'},
      {transform:'translate('+dx*.28+'px,'+(dy*.28-size*.45)+'px) rotate('+tilt+'deg) scale(1.23)',offset:.42},
      {transform:'translate('+dx+'px,'+dy+'px) rotate('+(-tilt)+'deg) scale(.12)',opacity:.15}],
      {duration:620,easing:'cubic-bezier(.34,0,.75,1)'});
    flyer.remove();scanSpecimen(id);burst(...target,10);audio.play('filed');
    const token=document.createElement('b');token.className='sample-flight';token.textContent='+'+award;
    token.style.left=target[0]+'px';token.style.top=target[1]+'px';$('effects').append(token);
    await playAnim(token,[{transform:'translate(-50%,-50%)'},
      {transform:'translate('+(readout[0]-target[0])+'px,'+(readout[1]-target[1])+'px) scale(.45)',opacity:.1}],
      {duration:380,easing:'ease-in'});token.remove();onArrival(j,award);
  }
  async function firstCapture(entry){
    const reveal=document.createElement('div');
    reveal.className='discovery severity-'+entry.damage.split(' ')[0];
    const portrait=document.createElement('div');portrait.className='discovery-portrait';
    portrait.append(creature(entry.id));
    const record=document.createElement('div');
    record.innerHTML='<small>First capture · '+entry.rarity+'</small><strong>'+entry.name+'</strong><b>Damage '+entry.damage+'</b><p>'+entry.incident+'</p>';
    reveal.append(portrait,record);$('effects').append(reveal);
    log('First capture. '+entry.name+'. Damage '+entry.damage+'. '+entry.incident);
    audio.play('discovery',entry.rank);
    try{
      if(reduced.matches){await wait(1450);return;}
      await playAnim(reveal,[{opacity:0,transform:'translateY(12%) scale(.94)'},{opacity:1,transform:'none'}],{duration:250,easing:'ease-out'});
      await wait(entry.rank?1700:1250);
      await playAnim(reveal,[{opacity:1},{opacity:0,transform:'translateY(-6%)'}],{duration:220});
    }finally{reveal.remove();}
  }
  const mugshotMotion={
    prong:'translateY(-2%) scale(1.07,1.03)',moth:'rotate(-3deg) scale(1.055)',
    sprout:'translateY(-3%) rotate(2deg) scale(1.045)',ink:'translateY(-2%) scale(.98,1.10)',
    grey:'rotate(2deg) scale(1.075,1.03)'
  };
  async function reactToLine(tileEl,id,reel){
    if(reduced.matches)return;
    const face=document.createElement('div');
    face.className='mugshot-reaction';skin(face,id);tileEl.append(face);
    try{
      await playAnim(face,[{transform:'none',opacity:0},{transform:mugshotMotion[id],opacity:1,offset:.36},
        {transform:mugshotMotion[id],opacity:.86,offset:.55},{transform:'none',opacity:0}],
        {duration:640,delay:reel*85,easing:'ease-in-out',fill:'backwards'});
    }finally{face.remove();}
  }
  async function tractorPasses(r,stake){
    let grid=r.grid,locked=0;
    const agentRow=grid[3].indexOf('agent');
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 500 300');svg.setAttribute('preserveAspectRatio','none');
    svg.setAttribute('class','lock-beams');svg.setAttribute('aria-hidden','true');
    $('reels').append(svg);cabinet.classList.add('tractor-active');
    $('reels').querySelectorAll('.win').forEach(el=>el.classList.remove('win'));
    columns[3].firstChild.children[agentRow].classList.add('tractor-agent');
    function latch(c,row,added){
      const slot=columns[c].firstChild.children[row];
      slot.classList.add('jar-held');locked++;
      const ray=document.createElementNS(svg.namespaceURI,'line');
      ray.setAttribute('x1',350);ray.setAttribute('y1',agentRow*100+50);
      ray.setAttribute('x2',c*100+50);ray.setAttribute('y2',row*100+50);
      svg.append(ray);svg.style.setProperty('--beam-width',1+locked*.42);
      svg.style.setProperty('--beam-speed',(1.05-locked*.15)+'s');
      monitor('Tractor lock',locked+'/4','JARS HELD');
      if(added){
        audio.play('jar-latch',locked);burst(...center(slot),6+locked*4);
        log(locked===4?'All four jar reels locked.':locked+' jars locked. Another free rescan earned.');
      }
    }
    try{
      for(const [c,col] of grid.entries()){
        const row=col.findIndex(id=>H.jars.includes(id));
        if(row>=0)latch(c,row,false);
      }
      audio.play('tractor-arm');$('mode').textContent='Tractor lock';
      log('Agent holding '+locked+' of 4 jar reels. Open reels rescan for free.');
      $('mission').textContent='Agent holding jars';
      if(!reduced.matches)await wait(520);
      for(const [i,next] of r.tractor.passes.entries()){
        $('mission').textContent='Rescan '+(i+1);
        const open=[0,1,2,4].filter(c=>!grid[c].some(id=>H.jars.includes(id)));
        if(!reduced.matches)audio.play('motor',.95);
        await Promise.all(open.map(async(c,index)=>{
          const faces=next[c].map((id,row)=>tile(id,stake,r.enhanced,r.variants[c*3+row]));
          await spinReel(columns[c],faces,stake,reduced.matches?70:900+index*240);
          const row=next[c].findIndex(id=>H.jars.includes(id));
          if(row>=0)latch(c,row,true);
          else audio.play('stop',c);
        }));
        grid=next;
        if(!reduced.matches)await wait(330);
      }
      $('mission').textContent='Collect all jars';audio.play('tractor-release',locked);
      log('Tractor sweep complete. Retrieving '+locked+' jars.');
      if(!reduced.matches)await wait(340);
    }finally{
      svg.remove();cabinet.classList.remove('tractor-active');
      $('reels').querySelectorAll('.jar-held,.tractor-agent').forEach(el=>el.classList.remove('jar-held','tractor-agent'));
    }
    return grid;
  }
  async function celebrate(r,s,openingBalance){
    if(r.lineWins.length){
      const reacted=new Set(),voices=new Set(),steps=new Set(),reactions=[];
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('class','pay-trace');if(!reduced.matches)$('effects').append(svg);
      for(const index of r.lineWins){
        const line=H.lines[index],symbol=r.grid[0][line[0]],points=[];
        if(mugshotMotion[symbol] && !voices.has(symbol)){
          voices.add(symbol);audio.play('alien-line',symbol);
        }
        for(let c=0;c<5 && r.grid[c][line[c]]===symbol;c++){
          const slot=columns[c].firstChild.children[line[c]];
          points.push(center(slot).join(','));
          if(mugshotMotion[symbol] && !reacted.has(slot)){
            reacted.add(slot);reactions.push(reactToLine(slot,symbol,c));
            if(!steps.has(c)){steps.add(c);audio.play('line-step',c);}
          }
        }
        if(voices.size===1 && mugshotMotion[symbol])monitor(names[symbol]+' line',points.length,'MATCHED');
        const path=document.createElementNS(svg.namespaceURI,'polyline');
        path.setAttribute('points',points.join(' '));path.setAttribute('pathLength','1');svg.append(path);
      }
      if(!reduced.matches)await Promise.all([wait(600),...reactions]);
      svg.remove();
    }
    if(r.bounty){
      const catchGrid=r.tractor?await tractorPasses(r,s.stake):r.grid;
      let recovered=0,mask=r.priorMask;
      monitor('Jar bounty','0','RETRIEVING');
      const onArrival=(family,award)=>{
        recovered+=award;
        monitor('Jar bounty',format(recovered),'TOKENS');
        if(r.free){mask|=1<<family;familyTrail(mask);}
      };
      const flights=[],agent=columns[3].querySelector('.agent');
      for(let c=0;c<5;c++)catchGrid[c].forEach((id,row)=>{
        const j=H.jars.indexOf(id);if(j<0)return;
        flights.push(retrieve(columns[c].firstChild.children[row],r.variants[c*3+row]??id,agent,flights.length,H.values[j]*s.stake*(r.enhanced?2:1),onArrival));
      });
      await Promise.all(flights);burst(...center($('read-value')),32);
      for(const id of r.discoveries)await firstCapture(speciesById[id]);
    }
    if(r.payout)audio.play('win');
    else if(!r.sightings)audio.play('clear');
    if(r.payout && !reduced.matches){
      monitor('Spin award','0','tokens');
      const duration=r.payout>=s.stake*10?650:360,begin=performance.now();
      await new Promise(done=>{function tick(t){const pct=Math.min(1,(t-begin)/duration),n=Math.round(r.payout*(1-(1-pct)**3));
        $('read-value').textContent=format(n);$('balance').textContent=format(openingBalance+n);
        if(pct<1)requestAnimationFrame(tick);else done();}requestAnimationFrame(tick);});
    }
    if(r.rankUp){
      const rank=H.radarRanks[H.radarRank(s.contacts)];
      audio.play('case');await announce('Radar upgraded',rank.name,'UFO chance per scan reel '+Math.round(rank.ufo*100)+'%');
    }
    if(r.triggered || r.caseClosed || r.finished){
      if(r.triggered)await changeScene(true,'Quarantine bay sealed · 8 free spins');
      if(r.caseClosed){audio.play('case');await announce('Three families recovered','Case closed','+2 double-bounty spins');}
      if(r.finished)await changeScene(false,format(s.featureTotal)+' tokens recovered');
    } else if(r.payout>=s.stake*15)await announce('Bureau commendation','Major recovery',format(r.payout)+' tokens');
  }
  async function patrol(fromBatch=false){
    if(portraitPlay.matches||busy||dialog.open||(batch && fromBatch!==true))return;
    audio.unlock();audio.play('switch');busy=true;meters();
    try{
      let r=null,openingBalance=0;
      await lock(()=>{
        if(portraitPlay.matches)return;
        if(!practice)reload();
        const s=current();
        if(fromBatch===true && (batch.stopped||document.hidden||s.remaining||s.balance<s.stake||s.stake!==batch.stake))return;
        if(!s.remaining && practice){practice=null;reload();return;}
        if(!s.remaining && s.balance<5){s.balance=1240;save();return;}
        // A repeatable four-jar example for the explicitly selected practice drill.
        let demoSeed=10066;
        const demoDraw=()=>((demoSeed=(Math.imul(demoSeed,1664525)+1013904223)>>>0)/4294967296);
        r=H.spin(s,practice?.tractorDrill?demoDraw:random);
        if(!r)return;
        r.stake=s.stake;openingBalance=s.balance-r.payout;
        if(!practice)save();
      });
      if(!r){restore();return;}
      const s=current();$('balance').textContent=format(openingBalance);log(r.free?'Containment scan in progress…':'Patrol scan in progress…');monitor('Scanning','•••','REELS ACTIVE');
      await roll(r,s);await celebrate(r,s,openingBalance);
      return r;
    } finally {busy=false;if(!practice)reload();restore();}
  }
  async function changeStake(direction){
    if(busy||batch||practice)return;
    audio.unlock();audio.play('stake',direction);
    await lock(()=>{
      reload();const next=stakeOptions[stakeOptions.indexOf(state.stake)+direction];
      if(next && next<=state.balance && !state.remaining){state.stake=next;save();}
    });restore();
  }
  function openPaper(title,body){
    if(busy||batch)return;
    dialog.classList.remove('archive');
    audio.unlock();audio.play('switch');
    $('paper').innerHTML='<h2>'+title+'</h2>'+body;
    if(!dialog.open)dialog.showModal();
    dialog.scrollTop=0;$('close').focus();
  }
  function fieldManual(){
    openPaper('Field manual','<p>Spin five reels using free arcade tokens. Three or more matching mugshots or tools from the left pay on any of ten fixed lines.</p><h3>Line awards</h3><p>Three pay 2× your stake, four pay 8×, and five pay 25×. Each line pays its longest match.</p><div class="paylines" aria-label="Ten winning line patterns"></div><h3>Patrol bounties</h3><p>On patrol, an agent pays the value of every specimen jar on the same spin. Case-file discoveries and family rewards are earned during Containment Breach.</p><h3>Containment Breach</h3><p>UFOs on reels 1, 3 and 5 award eight free spins at the triggering stake. Agents and specimen jars appear more often here. When they land together, the agent collects every jar. Their tags show the token amounts.</p><h3>Tractor Lock</h3><p>On patrol or in a breach, one in three agent catches with an open jar reel and no UFO activates Tractor Lock. The agent and jar reels stay put. Each open reel has a 22% chance to land a jar per free rescan. Every pass that adds a jar starts another until all four are held or a pass comes up empty. The agent collects the whole catch once. Line awards use the opening spin.</p><h3>Close the case</h3><p>Capture all three bounty families in one breach to earn two extra spins. Jar values double during those two spins. Rare family members become available at higher radar ranks. Every species you capture gets its own incident record in the case file.</p><h3>Patrol encounters</h3><p>A visiting saucer can rewrite three symbols to complete a line or beam a UFO down to replace a reel symbol. A Sprout or Inkling can turn the tile beside it into a match. Line awards and UFO contacts use the final reel faces.</p><h3>Patrol odds</h3><p>Long-run token return 96.7%, including bonus awards. About one in seven paid spins pays a line award. Each result is drawn before the reels move.</p><small>Space spins · Escape closes this manual. Progress saves in this browser.</small>'
      +(practice?'<br><button class="action" id="drill">Leave drill</button>':'<br><button class="action" id="drill">Try a bonus drill</button><button class="action" id="tractor-drill">Try Tractor Lock</button><p><small>Drills use a separate practice wallet. Tractor Lock demonstrates a four-jar catch.</small></p>'));
    H.lines.forEach((line,i)=>{
      const el=document.createElement('div');el.className='pattern';el.title='Line '+(i+1);
      for(let r=0;r<3;r++)for(let c=0;c<5;c++){const dot=document.createElement('i');if(line[c]===r)dot.className='on';el.append(dot);}
      document.querySelector('.paylines').append(el);
    });
    async function drill(tractorDemo){
      const entering=!practice;audio.unlock();busy=true;
      if(practice){practice=null;reload();}
      else {practice=H.newGame();practice.remaining=tractorDemo?1:8;practice.tractorDrill=tractorDemo;practice.practice=true;practice.breachStats={specimens:0,bestCatch:0};practice.stake=state.stake;practice.contacts=state.contacts;practice.featureRank=H.radarRank(state.contacts);practice.featureAgent=H.radarRanks[practice.featureRank].agent;}
      dialog.close();$('batch').disabled=$('spin').disabled=$('manual').disabled=$('files').disabled=$('up').disabled=$('down').disabled=true;
      try{
        if(entering)await changeScene(true,tractorDemo?'Tractor Lock · training demonstration':'Training drill · 8 free spins');
        else if(!state.remaining)await changeScene(false,'Training drill complete');
      }finally{busy=false;restore();$('spin').focus();}
    }
    $('drill').onclick=()=>drill(false);
    if($('tractor-drill'))$('tractor-drill').onclick=()=>drill(true);
  }
  const fieldNotes={
    green:'One eye and two curled feelers.',
    pink:'One eye above a skirt of curling tentacles.',
    amber:'Two slit pupils, a crested head and a curled tail.',
    arc:'A single eye between broad, veined wings.',
    siren:'A bell-shaped head over long, trailing tendrils.',
    void:'A peaked shell above four heavy feet.'
  };
  function shuffled(items){
    const deck=[...items];
    for(let i=deck.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [deck[i],deck[j]]=[deck[j],deck[i]];
    }
    return deck;
  }
  function evidenceLab(){
    const pool=H.catalog.filter(entry=>entry.rank===0 || H.captured(current(),entry)>0);
    const subjects=shuffled(pool).slice(0,3);
    let index=0,score=0;
    openPaper('Evidence lab','<div class="lab-heading"><b id="plate-id"></b><span>Specimen identification</span></div><div class="lab-work"><div class="lab-plate"></div><div><p id="lab-note"></p><div class="lab-lineup"></div></div></div><p id="lab-result" role="status"></p><div class="lab-actions"><button class="action" id="lab-next" hidden></button><button class="action" id="lab-back">Case file</button></div>');
    dialog.classList.add('archive');
    const plate=dialog.querySelector('.lab-plate'),lineup=dialog.querySelector('.lab-lineup');
    const next=$('lab-next');
    function showPlate(){
      const subject=subjects[index];
      const views=['Silhouette','Detail scan','Thermal scan'];
      $('plate-id').textContent=(index+1)+' / '+subjects.length+' · '+views[index];
      $('lab-note').textContent=fieldNotes[subject.id]+' Identify the scan.';
      $('lab-result').textContent='';
      plate.dataset.view=String(index);
      plate.classList.remove('identified');
      plate.replaceChildren(creature(subject.id));
      lineup.replaceChildren();next.hidden=true;
      const others=shuffled(pool.filter(entry=>entry!==subject)).slice(0,2);
      for(const entry of shuffled([subject,...others])){
        const button=document.createElement('button');
        button.type='button';
        button.append(creature(entry.id),document.createTextNode(entry.name));
        lineup.append(button);
        button.onclick=()=>{
          if(button.disabled)return;
          const correct=entry===subject;
          score+=Number(correct);
          for(const option of lineup.children){
            option.disabled=true;
            if(option.textContent===subject.name)option.classList.add('identified');
          }
          plate.classList.add('identified');
          audio.play(correct?'filed':'close');
          const final=index===subjects.length-1;
          $('lab-result').textContent=(correct?'Confirmed. ':'Identified as '+subject.name+'. ')+(final?'Assignment complete. '+score+' of 3 correct.':subject.name+' · '+subject.damage+' damage.');
          next.hidden=false;next.textContent=final?'New assignment':'Next plate';
          next.focus();
        };
      }
      audio.play('scan');lineup.firstChild.focus();
    }
    next.onclick=()=>{if(++index<subjects.length)showPlate();else evidenceLab();};
    $('lab-back').onclick=()=>{files();$('open-lab').focus();};
    showPlate();
  }
  function files(){
    const s=current(),title=practice?'Training case file':'Alien case file';
    const found=H.catalog.filter(entry=>H.captured(s,entry)>0).length;
    const breachStatus=s.remaining?' · '+[1,2,4].filter(bit=>s.mask&bit).length+'/3 families this breach':'';
    openPaper(title,'<div class="archive-progress"><strong>'+found+' / '+H.catalog.length+' species filed</strong><progress max="'+H.catalog.length+'" value="'+found+'" aria-label="Species collection"></progress></div><p>'+s.captures.reduce((a,b)=>a+b,0)+' specimens collected · '+s.cases+' '+(s.cases===1?'case':'cases')+' closed'+breachStatus+'</p><div class="case-grid"></div>');
    dialog.classList.add('archive');
    const grid=$('paper').querySelector('.case-grid');
    const lab=document.createElement('button');
    lab.id='open-lab';lab.className='action';lab.textContent='Evidence lab · Identify 3 scans';
    lab.onclick=evidenceLab;grid.before(lab);
    if(s.lastDebrief){
      const {total,mask,specimens,bestCatch}=s.lastDebrief;
      const debrief=document.createElement('details');debrief.className='clearance';
      const heading=document.createElement('summary');heading.textContent='Last breach · '+format(total)+' tokens';
      const info=document.createElement('p');
      const families=H.species.filter((_,i)=>mask&(1<<i));
      info.textContent=(families.length?families.join(', '):'No families filed')+'.'+(specimens!=null?' '+specimens+' specimens recovered. Largest single collect '+format(bestCatch)+' tokens.':'');
      debrief.append(heading,info);grid.before(debrief);
    }
    for(const entry of H.catalog){
      const count=H.captured(s,entry),tier=H.radarRanks[entry.rank],locked=H.radarRank(s.contacts)<entry.rank;
      const card=document.createElement('details');
      card.className='case-card '+(count?'catalogued':locked?'locked':'available');
      const summary=document.createElement('summary');
      const status=count?count+' captured':locked?tier.name+' · '+tier.contacts+' UFOs':'Awaiting capture';
      summary.innerHTML='<span class="case-art"></span><small>'+entry.rarity+'</small><strong>'+entry.name+'</strong><span class="file-status">'+status+'</span>';
      summary.querySelector('.case-art').append(creature(entry.id));
      const info=document.createElement('div');info.className='incident';
      info.innerHTML='<b>Damage '+entry.damage+'</b><p>'+(count?entry.incident:locked?'Requires '+tier.name+' radar clearance.':'Capture this specimen with an agent to recover its incident report.')+'</p><small>'+H.species[entry.family]+' family</small>';
      card.append(summary,info);grid.append(card);
    }
    const dossier=document.createElement('details');dossier.className='clearance';
    dossier.innerHTML='<summary>Radar clearance · '+s.contacts+' UFO contacts</summary><p>Every UFO earns one point. New radar ranks take effect on the next paid spin. More frequent breaches have a lower chance of an agent on each free spin.</p>';
    for(const [i,tier] of H.radarRanks.entries()){
      const row=document.createElement('p');row.className='rank-row';
      const {rewrite,formation,flip}=H.encounters;
      const breachChance=(1-rewrite-formation-flip)*tier.ufo**3+formation*tier.ufo**2;
      row.textContent=tier.name+' · '+tier.contacts+' points · 1 breach in '+Math.round(1/breachChance)+' spins on average';
      if(i===H.radarRank(s.contacts))row.classList.add('active');
      dossier.append(row);
    }
    $('paper').append(dossier);
  }
  $('spin').onclick=()=>patrol();$('batch').onclick=runBatch;
  $('up').onclick=()=>changeStake(1);$('down').onclick=()=>changeStake(-1);
  $('files').onclick=files;$('manual').onclick=fieldManual;$('close').onclick=()=>dialog.close();
  dialog.onclick=e=>{if(e.target===dialog)dialog.close();};
  dialog.addEventListener('close',()=>audio.play('close'));
  $('sound').onclick=()=>{sound=!sound;try{localStorage.setItem('alien-hunter.sound',sound?'on':'off');}catch{}audio.setEnabled(sound);audio.unlock();audio.play('switch');soundControl();};
  document.addEventListener('keydown',e=>{
    if(e.code==='Space' && !e.repeat && !dialog.open && (document.activeElement===document.body || document.activeElement===$('spin'))){
      e.preventDefault();if(!$('spin').disabled)patrol();
    }
  });
  window.addEventListener('storage',e=>{if(e.key===slotKey&&!busy&&!practice){reload();restore();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopBatch();});
  function syncOrientation(){
    document.querySelector('main').inert=portraitPlay.matches;
    if(portraitPlay.matches){
      stopBatch();
      if(dialog.open)dialog.close();
    }
  }
  portraitPlay.addEventListener('change',syncOrientation);
  syncOrientation();
  scanSpecimen('green');restore();
})();


