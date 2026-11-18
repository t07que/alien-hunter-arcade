// The cabinet and the evidence player use the same shots. Coordinates come from
// the actual reel faces and Spin key on each surface, including after rotation.
window.IncidentCamera=(()=>{
  'use strict';
  const audio=window.CabinetAudio;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const mix=(a,b,n)=>a+(b-a)*n;
  function ramp(t,from,to){
    const n=Math.max(0,Math.min(1,(t-from)/(to-from)));
    return n*n*(3-2*n);
  }
  function pose(el,x,y,size,angle=0,flip=1,opacity=1){
    el.style.width=size+'px';
    el.style.transform='translate3d('+x+'px,'+y+'px,0) translate(-50%,-50%) rotate('+angle+'deg) scaleX('+flip+')';
    el.style.opacity=opacity;
  }
  async function shot({stage,source,target,signal,caption,projector},duration,markup,beats,setup){
    signal?.throwIfAborted();
    const layer=document.createElement('div');
    layer.className='incident-shot';
    layer.setAttribute('aria-hidden','true');layer.innerHTML=markup;
    stage.append(layer);
    let geometry;
    function measure(){
      const bounds=layer.getBoundingClientRect();
      const point=el=>{
        const b=el.getBoundingClientRect();
        return {x:b.left-bounds.left+b.width/2,y:b.top-bounds.top+b.height/2,w:b.width,h:b.height};
      };
      geometry={a:point(source),b:point(target),w:bounds.width,h:bounds.height};
    }
    const observer=new ResizeObserver(measure);
    observer.observe(stage);observer.observe(source);observer.observe(target);measure();
    let frame;
    try{
      const draw=setup(layer);
      const calm=reduced.matches,ms=calm?Math.min(duration,1400):duration;
      let nextBeat=0;
      function render(t){
        while(nextBeat<beats.length && beats[nextBeat][0]<=t){
          const [at,sound,line,param]=beats[nextBeat++];
          if(sound && t-at<.14)audio.play(sound,param);
          if(line)caption(line);
        }
        // Reduced motion uses three composed stills, including the destination.
        draw(calm?(t<.34?.10:t<.68?.49:.84):t,geometry,calm);
      }
      if(projector)await projector.advance(ms,render);
      else await new Promise(resolve=>{
        const start=performance.now();
        function tick(now){
          const t=Math.min(1,(now-start)/ms);render(t);
          if(t<1)frame=requestAnimationFrame(tick);else resolve();
        }
        tick(start);
      });
    }finally{cancelAnimationFrame(frame);observer.disconnect();layer.remove();}
  }
  async function tow(options){
    const {source,target}=options;
    source.classList.add('agent-out');target.classList.add('heavy-specimen');
    try{
      await shot(options,3550,
        '<svg class="tow-cable" width="100%" height="100%"><path class="cable-halo"/><path class="cable-core"/></svg><div class="film-prop tow-shell creature species-void"></div><div class="film-prop skid-agent"></div><div class="skid-sparks"><i></i><i></i><i></i></div>',
        [[0,'tow-charge','Tractor beam engaged.'],[.21,'tow-strain','Mass limit exceeded.'],[.44,'tow-skid','The agent is losing his footing!',target.getBoundingClientRect().left<source.getBoundingClientRect().left?-1:1],[.70,'tow-impact','Agent off reel. Voidback moved zero metres.'],[.88,'shutter','Evidence photograph filed.']],
        layer=>{
          const actor=layer.querySelector('.skid-agent'),shell=layer.querySelector('.tow-shell');
          const paths=layer.querySelectorAll('path'),sparks=layer.querySelector('.skid-sparks');
          return (t,{a,b,h},calm)=>{
            const dir=b.x<a.x?1:-1,travel=ramp(t,.40,.70);
            const strain=Math.sin(Math.PI*ramp(t,.12,.43));
            const bounce=Math.sin(Math.PI*ramp(t,.70,.83));
            const size=Math.min(a.w*1.12,a.h*1.39);
            const rock=Math.min(b.w*.96,b.h*1.04);
            const jitter=calm?0:Math.sin(t*155)*strain*size*.018;
            const x=mix(a.x,b.x+dir*size*.45,travel)+dir*(size*.10*strain+size*.13*bounce)+jitter;
            const y=Math.min(h-size*.53-2,mix(a.y,b.y,travel)-size*.13*Math.sin(travel*Math.PI));
            const fade=calm?1:1-ramp(t,.92,1);
            pose(actor,x,y,size,dir*(strain*9-Math.sin(travel*Math.PI)*16+bounce*9),dir,fade);
            pose(shell,b.x,b.y,rock*(1+.13*ramp(t,.08,.32)),calm?0:dir*bounce*2,1,fade);
            const hx=x-dir*size*.4,hy=y-size*.16;
            const bx=b.x+dir*rock*.20,by=b.y-rock*.08;
            const slack=(1-ramp(t,.04,.26))*size*.38+bounce*size*.32;
            const cable='M '+hx+' '+hy+' Q '+(hx+bx)/2+' '+((hy+by)/2+slack)+' '+bx+' '+by;
            for(const path of paths){path.setAttribute('d',cable);path.style.opacity=fade;}
            pose(sparks,x-dir*size*.24,y+size*.4,size*.52,0,dir,calm?0:Math.sin(travel*Math.PI));
          };
        });
    }finally{source.classList.remove('agent-out');target.classList.remove('heavy-specimen');}
  }
  async function escape(options){
    const {source,target}=options;
    source.classList.add('knocking-jar');
    try{
      await shot(options,3200,
        '<div class="film-prop knocking-ring"></div><div class="film-prop mimic-sprite"></div>',
        [[.09,'jar-knock','Something knocked from inside the last jar.',0],[.23,'jar-knock',null,1],[.40,'jar-knock','There it goes!',2],[.49,'mimic-scuttle',null],[.83,'key-clack','It slipped under the Spin button.']],
        layer=>{
          const actor=layer.querySelector('.mimic-sprite'),ring=layer.querySelector('.knocking-ring');
          return (t,{a,b},calm)=>{
            const scurry=ramp(t,.46,.88),hop=calm?0:Math.abs(Math.sin(scurry*Math.PI*3));
            const size=Math.min(a.w*.7,a.h*.84);
            const x=mix(a.x,b.x,scurry),y=mix(a.y,b.y,scurry)-size*(Math.sin(scurry*Math.PI)*.7+hop*.22);
            const scale=(.25+.75*ramp(t,.36,.48))*(1-.8*ramp(t,.79,.89));
            pose(actor,x,y,size*scale,calm?0:Math.sin(scurry*Math.PI*6)*12,1,ramp(t,.34,.43)*(1-ramp(t,.83,.90)));
            const since=t-(t>=.40?.40:t>=.23?.23:.09),pulse=Math.max(0,Math.min(1,since/.13));
            pose(ring,a.x,a.y,size*(.8+pulse*.75),0,1,calm||since<0?0:1-pulse);
            source.style.setProperty('--knock-angle',(calm?0:Math.sin(pulse*Math.PI*4)*(1-pulse)*5)+'deg');
            target.classList.toggle('key-rattle',t>.77);
          };
        });
    }finally{source.classList.remove('knocking-jar');source.style.removeProperty('--knock-angle');target.classList.remove('key-rattle');}
  }
  async function unmask(options){
    const key=options.source;
    key.classList.add('key-open');
    try{
      await shot(options,2450,
        '<div class="film-prop mimic-sprite"></div><div class="evidence-stamp">BUTTON MIMIC</div>',
        [[0,'key-clack','Control cover released.'],[.29,'mimic-protest','The Spin button has teeth.'],[.64,'shutter','Button Mimic identified. One bent return spring.']],
        layer=>{
          const actor=layer.querySelector('.mimic-sprite'),stamp=layer.querySelector('.evidence-stamp');
          return (t,{a,b,w,h},calm)=>{
            const jump=ramp(t,.06,.41),size=Math.min(w*.25,h*.52);
            const x=mix(a.x,b.x,jump),y=mix(a.y,b.y,jump)-(calm?0:Math.sin(jump*Math.PI)*size*.40);
            const recoil=Math.sin(Math.PI*ramp(t,.39,.55));
            pose(actor,x,y,size*(.18+jump*.82),calm?0:recoil*9,1,1-ramp(t,.91,1));
            stamp.style.left=b.x+'px';stamp.style.top=(b.y+size*.48)+'px';
            stamp.style.opacity=ramp(t,.64,.68)*(1-ramp(t,.91,1));
          };
        });
    }finally{key.classList.remove('key-open');}
  }
  return {tow,escape,unmask};
})();
