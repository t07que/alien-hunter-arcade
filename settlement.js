// Show settled awards. Counting, skipping and replaying use no wallet operations.
window.CabinetAwards=(()=>{
  'use strict';
  const $=id=>document.getElementById(id),audio=window.CabinetAudio;
  const format=new Intl.NumberFormat('en-GB');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const receipt=$('spin-receipt'),cabinet=$('cabinet'),reels=$('reels'),screen=$('win-dialog');
  const tiers=[
    {multiple:0,name:'Bounty recovered'}, {multiple:5,name:'Nice haul!'},
    {multiple:15,name:'Big win!'}, {multiple:35,name:'Huge win!'},
    {multiple:75,name:'Massive win!'}, {multiple:150,name:'Legendary haul!'}
  ];
  const encounters={formation:'UFO beam-in',rewrite:'UFO line rewrite',flip:'Neighbour flip'};
  let timer,active,frame,portrait=false;

  function remember(label,amount){
    $('last-award').hidden=amount==null;
    if(amount==null)return;
    $('last-award-title').textContent=label;
    $('last-award-number').textContent=format.format(amount);
  }
  function clear(){clearTimeout(timer);receipt.hidden=true;}
  function place(){
    if(receipt.hidden)return;
    const a=cabinet.getBoundingClientRect(),b=reels.getBoundingClientRect();
    receipt.style.left=(b.left-a.left+b.width/2)+'px';
    receipt.style.top=(b.top-a.top+b.height*.53)+'px';
    receipt.style.width=Math.min(b.width*.84,620)+'px';
  }
  const resize=new ResizeObserver(place);resize.observe(reels);resize.observe(cabinet);
  function flash(title,total,detail){
    clear();$('receipt-heading').textContent=title;
    $('receipt-number').textContent=format.format(total);$('receipt-detail').textContent=detail;
    receipt.classList.toggle('empty',total===0);receipt.hidden=false;place();
    timer=setTimeout(clear,total>0?1950:1450);
  }
  function spin(r,s){
    const title=r.passenger?.found?'Button Mimic':window.Hunter.voidbackSlots(r).length?'Voidback tow':r.tractor?'Tractor Lock':
      r.triggered?'Breach unlocked':r.encounter?encounters[r.encounter.type]:r.spinAwards?.length?'Breach pickups':
      r.bounty?'Agent collection':r.lineWins.length?'Winning lines':r.sightings?'Radar contact':r.free?'Free spin':'Patrol';
    const detail=[];
    if(r.bounty && r.payout>r.bounty)detail.push(format.format(r.payout-r.bounty)+' in lines',format.format(r.bounty)+' in jars');
    if(r.triggered)detail.push('8 free spins awarded');
    else if(r.passenger)detail.push(r.passenger.found?'+1 free spin banked':'Lift Spin for +1 free spin');
    else if(r.spinAwards?.length)detail.push('+'+r.spinAwards.reduce((sum,a)=>sum+a.spins,0)+' free spins earned');
    if(r.free && !r.finished)detail.push('Breach so far '+format.format(s.featureTotal));
    flash(title+(r.passenger?.found?' · original spin':' · spin total'),r.payout,detail.join(' · '));
  }
  function patrol(r){
    const {spins,total}=r.patrolRun,details=[spins+' '+(spins===1?'spin':'spins')+' played','Last spin '+format.format(r.payout)];
    if(r.triggered)details.push('8 free spins awarded');
    else if(r.passenger)details.push('Lift Spin for +1 free spin');
    remember('Patrol total',total);flash('Patrol total',total,details.join(' · '));
  }

  function showNumber(value,instant=false){
    const a=active;
    const tier=value===0?-1:tiers.findLastIndex(t=>t.multiple===0 || (a.stake>0 && value>=t.multiple*a.stake));
    if(value!==a.displayed){$('win-value').textContent=format.format(value);a.displayed=value;}
    screen.style.setProperty('--gauge',String(a.total?value/a.total:0));
    if(tier!==a.tier){
      a.tier=tier;screen.dataset.tier=String(Math.max(0,tier));
      $('win-comment').textContent=tier>=0?tiers[tier].name:a.total?'Counting the haul…':'Sweep complete';
      if(tier>=0 && !instant)audio.play('win-tier',tier);
    }
  }
  function finish(){
    if(!active || active.done)return;
    cancelAnimationFrame(frame);
    showNumber(active.total,true);active.done=true;
    $('win-control').textContent='Continue';
    $('win-speech').textContent=$('win-comment').textContent+' '+format.format(active.total)+' tokens won.';
    if(active.total)audio.play('win-banked',Math.max(0,active.tier));
  }
  function tick(now){
    const a=active;if(!a||a.done)return;
    if(!document.hidden && !portrait && a.previous!=null)a.elapsed+=Math.min(now-a.previous,120);
    a.previous=now;
    const i=a.stops.findIndex(stop=>stop.time>a.elapsed);
    if(i===-1){finish();return;}
    const from=a.stops[i-1],to=a.stops[i],p=(a.elapsed-from.time)/(to.time-from.time);
    const n=Math.floor(from.value+(to.value-from.value)*p);
    if(n!==a.displayed && a.elapsed-a.lastTick>=155 && !document.hidden && !portrait){
      audio.play('win-counter',Math.max(0,a.tier));a.lastTick=a.elapsed;
    }
    showNumber(n);frame=requestAnimationFrame(tick);
  }
  function total({title,total,stake,detail},acknowledge){
    if(active)return;
    clear();
    const stops=[{value:0,time:0}];
    // Give each reached tier reading time, even when the last segment is large.
    const thresholds=stake>0?tiers.slice(1).map(t=>stake*t.multiple):[];
    for(const n of [1,...thresholds,total]){
      const last=stops.at(-1);
      if(n>last.value && n<=total)stops.push({value:n,time:last.time+(n===1?170:Math.min(900,420+65*Math.log2(1+n-last.value)))});
    }
    active={total,stake,stops,acknowledge,elapsed:0,previous:null,lastTick:0,displayed:null,tier:null,done:false};
    $('win-scope').textContent=title;$('win-detail').textContent=detail;
    $('win-speech').textContent=total?'Counting the token award.':'';
    $('win-control').textContent='Show total';showNumber(0,true);
    screen.showModal();$('win-control').focus({preventScroll:true});
    if(reduced.matches || !total)finish();else frame=requestAnimationFrame(tick);
  }
  $('win-control').onclick=()=>{if(active?.done)screen.close();else finish();};
  screen.addEventListener('cancel',e=>{if(active && !active.done){e.preventDefault();finish();}});
  screen.addEventListener('close',()=>{
    cancelAnimationFrame(frame);const callback=active?.acknowledge;active=null;callback?.();
  });
  function orientation(blocked){portrait=blocked;if(active)active.previous=null;}
  document.addEventListener('visibilitychange',()=>{if(active)active.previous=null;});
  reduced.addEventListener('change',()=>{if(reduced.matches)finish();});
  return {remember,clear,spin,patrol,total,orientation};
})();
