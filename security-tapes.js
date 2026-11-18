// A tape is a small record of settled reel faces, not a new simulation.
window.SecurityTapes=(()=>{
  'use strict';
  const H=window.Hunter,audio=window.CabinetAudio;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const id=n=>'AH-'+String(n).padStart(4,'0');
  const title=t=>t.voids.length?(t.passenger!=null?'Voidback & the stowaway':'Voidback tow'):'The uninvited passenger';
  let playback;
  function trim(tapes){
    let recent=0;
    return tapes.filter(t=>t.kept || ++recent<=6);
  }
  function record(state,r,previous,drill){
    const voids=H.voidbackSlots(r);
    if(!voids.length && !r.passenger)return false;
    const number=(state.tapeSerial??0)+1;
    state.tapeSerial=number;r.tapeNumber=number;
    const tape={number,created:Date.now(),drill,kept:false,
      previous:previous?.tractor?.passes.at(-1)??previous?.grid??H.initialGrid,
      previousVariants:previous?.variants??{},previousStake:previous?.stake??r.stake,previousEnhanced:!!previous?.enhanced,
      grid:r.grid,lines:r.lineWins,passes:r.tractor?.passes??[],
      variants:r.variants,stake:r.stake,free:r.free,enhanced:r.enhanced,bounty:r.bounty,payout:r.payout,
      voids,passenger:r.passenger?.slot??null,revealed:false};
    state.tapes=trim([tape,...(state.tapes??[])]);
    return true;
  }
  function eject(){
    if(!playback)return;
    playback.abort();playback=null;audio.stopPlayback();
  }
  function element(tag,cls,text){
    const el=document.createElement(tag);el.className=cls;
    if(text!=null)el.textContent=text;
    return el;
  }
  function shelf(context){
    eject();
    const {dialog,openPaper,tapes,startDrill,refresh,keep}=context;
    openPaper('Security tapes','<div class="vault-intro"><span class="vhs-mark" aria-hidden="true">VHS</span><p>Run a practice drill to stage an incident and record it.</p></div><div class="drill-select"><button class="incident-drill drill-tow" id="drill-tow"><i></i><span>Run drill</span><strong>Voidback tow</strong></button><button class="incident-drill drill-mimic" id="drill-mimic"><i></i><span>Run drill</span><strong>Uninvited passenger</strong></button></div><h3>Recorded incidents</h3><p id="vault-status"></p><div class="cassette-rack"></div>');
    dialog.classList.add('archive','tape-room');
    dialog.querySelector('#drill-tow').onclick=()=>startDrill('void');
    dialog.querySelector('#drill-mimic').onclick=()=>startDrill('passenger');
    const rack=dialog.querySelector('.cassette-rack'),kept=tapes.filter(t=>t.kept).length;
    dialog.querySelector('#vault-status').textContent=tapes.length?'Six recent recordings are saved automatically. Keep up to six favourites.':'Your first recording will appear here.';
    for(const tape of tapes){
      const row=element('div','cassette-row'),play=element('button','cassette'),label=element('span','tape-label');
      play.setAttribute('aria-label','Play '+title(tape)+' · '+id(tape.number));
      const date=new Date(tape.created);
      label.append(element('small','',id(tape.number)+'  /  '+(tape.drill?'DRILL':'FIELD')+'  /  '+date.toLocaleDateString(undefined,{month:'short',day:'numeric'})),
        element('strong','',title(tape)),element('small','','▶ PLAY   ·   '+tape.payout.toLocaleString()+' TOKENS'));
      const hubs=element('span','tape-hubs');hubs.setAttribute('aria-hidden','true');
      play.append(hubs,label);play.onclick=()=>screen(context,tape);
      const pin=element('button','tape-pin',tape.kept?'Kept ✓':'Keep tape');
      pin.setAttribute('aria-pressed',String(tape.kept));pin.disabled=!tape.kept && kept>=6;
      pin.dataset.number=tape.number;
      pin.onclick=async()=>{
        pin.disabled=true;await keep(tape.number);
        if(dialog.open && pin.isConnected){refresh();dialog.querySelector('[data-number="'+tape.number+'"]')?.focus();}
      };
      row.append(play,pin);rack.append(row);
    }
  }
  function transport(signal,clock){
    let elapsed=0,lastSecond=-1;
    const controller={paused:false,advance};
    function advance(ms,render=()=>{}){
      signal.throwIfAborted();
      return new Promise((resolve,reject)=>{
        let request,played=0,last=performance.now();
        const abort=()=>{cancelAnimationFrame(request);reject(new DOMException('Tape ejected','AbortError'));};
        signal.addEventListener('abort',abort,{once:true});
        function tick(now){
          if(!controller.paused && !document.hidden){
            const delta=Math.min(Math.max(0,now-last),ms-played);
            played+=delta;elapsed+=delta;
            const second=Math.floor(elapsed/1000);
            if(lastSecond!==second){
              lastSecond=second;
              clock.textContent=String(Math.floor(second/60)).padStart(2,'0')+':'+String(second%60).padStart(2,'0');
            }
            render(Math.min(1,played/ms));
          }
          last=now;
          if(played<ms)request=requestAnimationFrame(tick);
          else{signal.removeEventListener('abort',abort);resolve();}
        }
        tick(last);
      });
    }
    return controller;
  }
  async function project(tape,stage,tile,projector,signal,caption){
    const board=stage.querySelector('.tape-board'),key=stage.querySelector('.tape-key');
    const meter=stage.querySelector('.tape-tally');
    const unit=stage.querySelector('.tape-console span');
    const cols=tape.previous.map((col,c)=>{
      const windowEl=element('div','tape-col'),strip=element('div','film-strip');
      strip.append(...col.map((face,row)=>tile(face,tape.previousStake??tape.stake,tape.previousEnhanced,tape.previousVariants?.[c*3+row])));
      windowEl.append(strip);board.append(windowEl);return strip;
    });
    const slot=k=>cols[Math.floor(k/3)].children[k%3];
    const sheet=(c,faces)=>faces.map((face,row)=>tile(face,tape.stake,tape.enhanced,tape.variants[c*3+row]));
    async function roll(grid,reels,land){
      const calm=reduced.matches,run=calm?150:690,stagger=calm?30:125;
      const strips=reels.map(c=>{
        const strip=cols[c],final=sheet(c,grid[c]),extra=calm?0:5+c;
        const passing=Array.from({length:extra},(_,i)=>tile(H.regular[(tape.number+i+c)%H.regular.length],tape.stake));
        strip.prepend(...final,...passing);
        return {c,strip,final,shift:(extra+3)*100/3,landed:false};
      });
      if(!calm)audio.play('motor',(run+stagger*(reels.length-1))/1000);
      await projector.advance(run+stagger*(reels.length-1),progress=>{
        const time=progress*(run+stagger*(reels.length-1));
        strips.forEach((entry,i)=>{
          if(entry.landed)return;
          const t=Math.max(0,Math.min(1,(time-i*stagger)/run));
          entry.strip.style.transform='translateY('+(-entry.shift*(1-t)**2)+'%)';
          if(t>=1-1e-6){
            entry.landed=true;entry.strip.replaceChildren(...entry.final);entry.strip.style.transform='';
            audio.play('stop',entry.c);land?.(entry.c);
          }
        });
      });
    }
    caption('Original reel stops');await roll(tape.grid,[0,1,2,3,4]);
    let grid=tape.grid;
    const agent=slot(9+grid[3].indexOf('agent'));
    if(tape.lines?.length){
      const lineTotal=tape.payout-tape.bounty;
      unit.textContent='Lines';meter.textContent=lineTotal.toLocaleString();
      for(const number of tape.lines){
        const line=H.lines[number],face=grid[0][line[0]];
        for(let c=0;c<5 && grid[c][line[c]]===face;c++)slot(c*3+line[c]).classList.add('win');
      }
      caption('Opening line award · '+lineTotal+' tokens');audio.play('line-step',2);
      await projector.advance(430);board.querySelectorAll('.win').forEach(el=>el.classList.remove('win'));
    }
    if(tape.passes.length){
      unit.textContent='Jars held';
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('class','lock-beams');svg.setAttribute('viewBox','0 0 500 300');svg.setAttribute('preserveAspectRatio','none');
      board.append(svg);let held=0;
      const latch=(c,row,added)=>{
        slot(c*3+row).classList.add('jar-held');held++;
        const ray=document.createElementNS(svg.namespaceURI,'line');
        ray.setAttribute('x1',350);ray.setAttribute('y1',50+100*grid[3].indexOf('agent'));
        ray.setAttribute('x2',50+100*c);ray.setAttribute('y2',50+100*row);svg.append(ray);
        svg.style.setProperty('--beam-width',1+held*.42);svg.style.setProperty('--beam-speed',(1.05-held*.15)+'s');
        meter.textContent=held+'/4';if(added)audio.play('jar-latch',held);
      };
      grid.forEach((col,c)=>{const row=col.findIndex(id=>H.jars.includes(id));if(row>=0)latch(c,row,false);});
      audio.play('tractor-arm');
      for(const [i,next] of tape.passes.entries()){
        caption('Tractor Lock · rescan '+(i+1));
        const open=[0,1,2,4].filter(c=>!grid[c].some(id=>H.jars.includes(id)));
        await roll(next,open,c=>{const row=next[c].findIndex(id=>H.jars.includes(id));if(row>=0)latch(c,row,true);});
        grid=next;await projector.advance(180);
      }
      await projector.advance(220);svg.remove();board.querySelectorAll('.jar-held').forEach(el=>el.classList.remove('jar-held'));
      audio.play('tractor-release',held);
    }
    let total=0;unit.textContent='Bounty';meter.textContent='0';
    const shot={stage,signal,projector,caption};
    const faces=grid.flat();
    const lightJars=faces.flatMap((face,k)=>H.jars.includes(face)&&!tape.voids.includes(k)?[k]:[]);
    for(const k of lightJars.concat(tape.voids)){
      const family=H.jars.indexOf(faces[k]);
      if(tape.voids.includes(k))await IncidentCamera.tow({...shot,source:agent,target:slot(k)});
      else{slot(k).classList.add('film-collect');audio.play('creature',family);await projector.advance(190);}
      total+=H.values[family]*tape.stake*(tape.enhanced?2:1);
      meter.textContent=total.toLocaleString();audio.play('filed');
    }
    unit.textContent='Spin total';meter.textContent=tape.payout.toLocaleString();caption('Recorded spin total · '+tape.payout.toLocaleString()+' tokens');
    await projector.advance(440);
    if(tape.passenger!=null){
      await IncidentCamera.escape({...shot,source:slot(tape.passenger),target:key});
      key.classList.add('key-watching');
      await projector.advance(650);
      if(tape.revealed){
        await IncidentCamera.unmask({...shot,source:key,target:board});
        key.classList.remove('key-watching');
      }else{caption('End of tape. Last seen under the Spin button.');return;}
    }
    caption('End of tape · '+tape.payout.toLocaleString()+' tokens on the original spin.');
  }
  function screen(context,tape){
    eject();const instance=new AbortController();playback=instance;
    const {dialog,openPaper,refresh,tile}=context;
    openPaper(title(tape),'<div class="tape-stage"><div class="camera-line"><b class="play-state">▶ PLAY</b><span class="film-id"></span><time>00:00</time></div><div class="tape-board"></div><div class="tape-console"><span>Bounty</span><b class="tape-tally">0</b><div class="tape-key"><i class="mimic-key"></i></div></div></div><p class="play-caption" role="status"></p><div class="transport-controls"><button class="action" id="pause-tape">Pause</button><button class="action" id="rewind-tape">Replay from start</button><button class="action" id="eject-tape">Eject</button></div>');
    dialog.classList.add('archive','tape-room');
    const stage=dialog.querySelector('.tape-stage'),status=stage.querySelector('.play-state'),pause=dialog.querySelector('#pause-tape');
    stage.classList.toggle('bonus',tape.free);stage.querySelector('.film-id').textContent='CABINET CAM 01   /   '+id(tape.number);
    const projector=transport(instance.signal,stage.querySelector('time'));
    const caption=text=>{dialog.querySelector('.play-caption').textContent=text;};
    pause.onclick=()=>{
      projector.paused=!projector.paused;pause.textContent=projector.paused?'Resume':'Pause';
      audio.pausePlayback(projector.paused);
      stage.classList.toggle('tape-paused',projector.paused);status.textContent=projector.paused?'Ⅱ PAUSE':'▶ PLAY';
    };
    dialog.querySelector('#rewind-tape').onclick=()=>screen(context,tape);
    dialog.querySelector('#eject-tape').onclick=()=>{refresh();audio.play('tape-eject');};pause.focus();
    audio.play('tape-load');
    project(tape,stage,tile,projector,instance.signal,caption).then(()=>{
      if(instance.signal.aborted)return;
      status.textContent='■ END';pause.disabled=true;audio.play('tape-eject');
    }).catch(error=>{
      if(error.name==='AbortError')return;
      console.error(error);caption('This recording could not be played.');pause.disabled=true;
    });
  }
  return {record,trim,shelf,eject};
})();
