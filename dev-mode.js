// Build a test spin before the regular engine evaluates its faces and settles the wallet.
(function(H){
  'use strict';
  const features=[
    {id:'line',name:'Alien line win',group:'Reel effects',note:'Three to five matching aliens animate on a winning line.'},
    {id:'rewrite',name:'UFO line rewrite',group:'Reel effects',note:'A visiting UFO beams in three matching symbols to complete a line.'},
    {id:'formation',name:'UFO beam-in',group:'Reel effects',note:'A saucer replaces an occupied panel with a UFO. On patrol it can also complete a breach.'},
    {id:'flip',name:'Neighbour flip',group:'Reel effects',note:'A Sprout or Inkling reaches across and flips its neighbour.'},
    {id:'contact',name:'Patrol radar contacts',group:'Reel effects',note:'Two UFOs fly into the radar. Each earns a contact toward the next rank.'},
    {id:'collect',name:'Agent jar collection',group:'Captures',note:'An agent lands with specimen jars and collects their token values.'},
    {id:'tractor',name:'Tractor Lock respins',group:'Captures',note:'An agent locks the jars in place. The first rescan lands another jar.'},
    {id:'passenger',name:'Spin-button stowaway',group:'Captures',note:'A four-jar Tractor Lock releases the stowaway. Lift Spin to bank one free spin.'},
    {id:'rare',name:'Rare specimen capture',group:'Captures',breach:true,note:'A boosted patrol opens a breach. Inside, an agent collects a rare species, favouring ones missing from the test case file.'},
    {id:'void',name:'Voidback tow',group:'Captures',breach:true,note:'A boosted patrol opens a breach. On boosted free spins, Voidback pulls the agent across the reels.'},
    {id:'breach',name:'Containment Breach',group:'Bonus rounds',note:'Three UFOs open eight free spins. Boosts inside the breach close the case and stage jar collections.'},
    {id:'case',name:'Case closure & double bounty',group:'Bonus rounds',breach:true,note:'A boosted patrol opens a breach. Collect all three families to earn two extra double-bounty spins.'},
    {id:'trio',name:'Matching trio · +2 spins',group:'Bonus rounds',breach:true,note:'A boosted patrol opens a breach. Three jars from one family pay two extra spins once per breach.'},
    {id:'pair',name:'Rare pair · +1 spin',group:'Bonus rounds',breach:true,note:'A boosted patrol opens a breach. Two rare captures pay one extra spin once per breach.'}
  ];
  const rates=[50,80,100];
  function options(input){
    return {chance:rates.includes(input?.chance)?input.chance:80,
      focus:features.some(f=>f.id===input?.focus)?input.focus:'mix'};
  }
  function newGame(){
    const s=H.newGame();
    s.contacts=H.radarRanks[2].contacts-3;
    s.dev=true;
    return s;
  }
  function pick(list,rng){return list[Math.floor(rng()*list.length)];}
  function choose(state,focus,rng){
    const free=state.remaining>0;
    if(focus==='mix'){
      const pool=features.filter(f=>(free?f.id!=='breach' && !(f.id==='case' && state.enhanced) && !state.pickups?.[f.id]:!f.breach) && f.id!==state.last?.devFeature);
      return pick(pool,rng).id;
    }
    const target=features.find(f=>f.id===focus);
    if(target.breach && !free)return 'breach';
    if(free && (focus==='breach' || focus==='case'))return state.enhanced?'collect':'case';
    return focus;
  }
  function plan(state,config,rng){
    if(rng()*100>=config.chance)return null;
    const feature=choose(state,config.focus,rng);
    const grid=H.regularGrid(rng),variants={},stage={feature,grid,variants};
    const row=()=>Math.floor(rng()*3);
    if(feature==='line'){
      const line=pick(H.lines,rng),face=pick(['prong','moth','sprout','ink','grey'],rng);
      const length=3+row();
      for(let c=0;c<length;c++)grid[c][line[c]]=face;
      return stage;
    }
    if(['rewrite','formation','flip'].includes(feature)){
      stage.encounter=H.applyEncounter(grid,rng,feature);
      if(feature==='formation' && !state.remaining){
        const target=stage.encounter.changes[0].c;
        for(const c of [0,2,4])if(c!==target && rng()<.35)grid[c][row()]='ufo';
      }
      return stage;
    }
    if(feature==='breach' || feature==='contact'){
      const reels=[0,2,4];
      if(feature==='contact')reels.splice(Math.floor(rng()*3),1);
      for(const c of reels)grid[c][row()]='ufo';
      return stage;
    }
    grid[3][row()]='agent';
    const open=[0,1,2,4];
    const jar=(family,variant)=>{
      const c=open.splice(Math.floor(rng()*open.length),1)[0],r=row();
      grid[c][r]=H.jars[family];
      if(variant)variants[c*3+r]=variant;
    };
    if(feature==='case'){
      H.jars.forEach((_,family)=>jar(family));
    }else if(feature==='trio'){
      const family=row();for(let i=0;i<3;i++)jar(family);
    }else if(feature==='void' || feature==='rare' || feature==='pair'){
      const rares=H.catalog.filter(entry=>entry.rank>0 && entry.rank<=H.radarRank(state.contacts));
      const unfiled=rares.filter(entry=>!H.captured(state,entry));
      const species=feature==='void'?H.catalog.find(entry=>entry.id==='void'):pick(unfiled.length?unfiled:rares,rng);
      jar(species.family,species.id);
      if(feature==='pair'){const another=pick(rares,rng);jar(another.family,another.id);}
    }else{
      const lock=feature==='tractor' || feature==='passenger';
      if(lock)stage.lock=feature;
      const count=1+Math.floor(rng()*(lock?2:4));
      for(let i=0;i<count;i++)jar(row());
    }
    return stage;
  }
  const api={features,rates,options,newGame,plan};
  if(typeof module!=='undefined' && module.exports)module.exports=api;
  else window.HunterDev=api;
})(typeof module!=='undefined' && module.exports?require('./engine.js'):window.Hunter);
