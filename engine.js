/* The renderer only reveals results. All awards are settled here from the drawn grid. */
(function () {
  'use strict';

  const regular = ['prong', 'moth', 'sprout', 'ink', 'grey', 'tape', 'badge', 'scanner'];
  const strip = regular.flatMap((symbol,i)=>Array([17,16,15,14,12,10,9,7][i]).fill(symbol));
  const lines = [
    [0,0,0,0,0], [1,1,1,1,1], [2,2,2,2,2],
    [0,1,2,1,0], [2,1,0,1,2], [0,0,1,2,2], [2,2,1,0,0],
    [1,0,0,0,1], [1,2,2,2,1], [0,1,1,1,0]
  ];
  const species = ['Cyclops', 'Coral eye', 'Amberling'];
  const catalog = [
    {id:'green',name:'Cyclops',family:0,rank:0,rarity:'Common',damage:'I · Minor',incident:'Mistook the evidence-room lens caps for eggs. Six cameras missed a shift.'},
    {id:'pink',name:'Coral eye',family:1,rank:0,rarity:'Common',damage:'II · Local',incident:'Plugged a coolant drain with shed tentacles. One holding room flooded.'},
    {id:'amber',name:'Amberling',family:2,rank:0,rarity:'Common',damage:'II · Local',incident:'Nested in the motor pool. Three patrol cars came back with melted tyres.'},
    {id:'arc',name:'Arc Moth',family:0,rank:1,chance:.15,rarity:'Rare',damage:'III · Major',incident:'A single wingbeat tripped the station switchgear. All six platforms went dark.'},
    {id:'siren',name:'Glass Siren',family:1,rank:1,chance:.09,rarity:'Rare',damage:'IV · Severe',incident:'Its distress call cracked every observation window along the east wing.'},
    {id:'void',name:'Voidback',family:2,rank:2,chance:.06,rarity:'Ultra-rare',damage:'V · Critical',incident:'Curled up beneath the freight lift. The floor gave way across two sublevels.'}
  ];
  const rareFamilies=catalog.slice(3);
  function captured(state,entry){
    const rare=state.rareCaptures?.[rareFamilies[entry.family].id]??0;
    return entry.rank?rare:state.captures[entry.family]-rare;
  }
  const pay = [0,0,0,2,8,25];
  // Agent frequency is tuned per radar rank for a 96.7% target return, including
  // pickup extensions, double bounties, and the Button Mimic's free spins.
  const radarRanks = [
    {name:'Patrol', contacts:0, ufo:.18, agent:.3132},
    {name:'Wideband', contacts:8, ufo:.19, agent:.2761},
    {name:'Deep scan', contacts:24, ufo:.20, agent:.2461}
  ];
  function radarRank(contacts=0) {
    return contacts>=radarRanks[2].contacts?2:contacts>=radarRanks[1].contacts?1:0;
  }
  const initialGrid = [
    ['prong','badge','ink'], ['tape','sprout','scanner'], ['green','scanner','badge'],
    ['grey','pink','blue'], ['moth','tape','grey']
  ];
  function newGame() {
    return {version:1, balance:1240, stake:5, remaining:0, enhanced:false, mask:0,
      captures:[0,0,0], rareCaptures:{}, cases:0, featureTotal:0, contacts:0, featureRank:0, practice:false, last:null};
  }
  function regularGrid(rng) {
    return Array.from({length:5}, () => Array.from({length:3},
      () => strip[Math.floor(rng() * strip.length)]));
  }
  function draw(free, rng = Math.random, rank=0, variants, clearance=rank, agentChance=radarRanks[rank].agent) {
    const grid=regularGrid(rng);
    for (let reel=0; reel<5; reel++) {
      if (free) {
        if (reel === 3 && rng() < agentChance) grid[reel][Math.floor(rng()*3)] = 'agent';
        if (reel !== 3 && rng() < 0.55) {
          placeJar(grid[reel],reel,rng,variants,clearance);
        }
      } else if (reel % 2 === 0 && rng() < radarRanks[rank].ufo) {
        grid[reel][Math.floor(rng()*3)] = 'ufo';
      }
    }
    return grid;
  }
  const jars = ['green','pink','amber'];
  const values = [3,5,8];
  function rareCatchCount(r){
    if(!r?.free || !r.bounty)return 0;
    const grid=r.tractor?.passes.at(-1)??r.grid;
    return grid.flat().filter((id,k)=>jars.includes(id) && r.variants?.[k]).length;
  }
  function pickupProgress(s){
    if(s.pickups)return s.pickups;
    const last=s.last?.free?s.last:null;
    return {families:jars.map((_,i)=>Math.max(s.mask&(1<<i)?1:0,last?.caught?.[i]??0)),
      rares:rareCatchCount(last),trio:false,pair:false,extra:0};
  }
  function doubleLeft(s){return s.doubleSpins??(s.enhanced?Math.min(2,s.remaining):0);}
  function doubleBounty(s){return s.remaining>0 && s.remaining<=doubleLeft(s);}
  function honourMimics(s){
    const owed=(s.mimicsFound??0)-(s.mimicPaid??0);
    if(owed>0){s.patrolSpins=(s.patrolSpins??0)+owed;s.mimicPaid=s.mimicsFound;}
    return s;
  }
  function claimPassenger(s){
    const r=s.last,p=r?.passenger;
    if(!p || p.found)return null;
    honourMimics(s);
    const before=r.free?s.remaining:(s.patrolSpins??0);
    if(r.free){s.remaining++;s.pickups=pickupProgress(s);s.pickups.extra++;}
    else s.patrolSpins=before+1;
    s.mimicsFound=(s.mimicsFound??0)+1;s.mimicPaid=(s.mimicPaid??0)+1;p.found=true;
    p.reward={kind:r.free?'breach':'patrol',spins:1,before,after:before+1};
    return p.reward;
  }
  function placeJar(column,c,rng,variants,clearance){
    const row=Math.floor(rng()*3),draw=rng()*3,family=Math.floor(draw);
    column[row]=jars[family];
    const rare=rareFamilies[family];
    if(variants && clearance>=rare.rank && draw-family<rare.chance)variants[c*3+row]=rare.id;
  }
  function tractorLock(result,state,rng,variants,requestedLock){
    if(!result.bounty || result.sightings)return;
    let grid=result.grid;
    const openReels=()=>[0,1,2,4].filter(c=>!grid[c].some(id=>jars.includes(id)));
    let open=openReels();
    if(!open.length || (!requestedLock && rng()>=1/3))return;
    const passes=[];
    while(open.length){
      const next=grid.slice();
      const addJar=requestedLock==='passenger'||(requestedLock==='tractor' && !passes.length);
      const guaranteedReel=addJar?open[Math.floor(rng()*open.length)]:-1;
      for(const c of open){
        next[c]=Array.from({length:3},()=>strip[Math.floor(rng()*strip.length)]);
        if(c===guaranteedReel || rng()<.22)placeJar(next[c],c,rng,result.free?variants:null,radarRank(state.contacts));
      }
      grid=next;
      passes.push(grid);
      const remaining=openReels();
      if(remaining.length===open.length)break;
      open=remaining;
    }
    result.tractor={passes};
    const catchResult=evaluate(grid,state,result.free);
    result.payout+=catchResult.bounty-result.bounty;
    result.bounty=catchResult.bounty;
    result.caught=catchResult.caught;
    if(!open.length && (requestedLock==='passenger' || !state.mimicsFound || rng()<1/3)){
      const previous=passes.at(-2)??result.grid;
      const c=[4,2,1,0].find(reel=>!previous[reel].some(id=>jars.includes(id)));
      result.passenger={slot:c*3+grid[c].findIndex(id=>jars.includes(id)),found:false};
    }
  }
  function voidbackSlots(result){
    if(!result.free || !result.bounty)return [];
    const grid=result.tractor?.passes.at(-1)??result.grid;
    return grid.flat().flatMap((id,k)=>id==='amber' && result.variants[k]==='void'?[k]:[]);
  }
  function patrolSamples(grid,rng){
    for(let c=0;c<grid.length;c++){
      const collector=c===3;
      const appearanceChance=collector ? 0.06 : 0.10;
      if(rng()>=appearanceChance)continue;
      const row=Math.floor(rng()*3);
      if(grid[c][row]==='ufo')continue;
      grid[c][row]=collector?'agent':jars[Math.floor(rng()*jars.length)];
    }
  }
  const encounters={rewrite:.008,formation:.022,flip:.014};
  function visit(grid,rng){
    const roll=rng();
    const ufoEvents=encounters.rewrite+encounters.formation;
    if(roll>=ufoEvents+encounters.flip)return null;
    return applyEncounter(grid,rng,roll<encounters.rewrite?'rewrite':roll<ufoEvents?'formation':'flip');
  }
  function applyEncounter(grid,rng,type){
    const regularSymbol=()=>strip[Math.floor(rng()*strip.length)];
    if(type!=='formation'){
      for(const col of grid)for(let row=0;row<3;row++)if(col[row]==='ufo')col[row]=regularSymbol();
      if(type==='flip'){
        const left=Math.floor(rng()*4),row=Math.floor(rng()*3),rightward=rng()<.5;
        const source=rightward?left:left+1,c=rightward?left+1:left;
        const subject=rng()<.5?'sprout':'ink',old=grid[c][row];
        const before=old===subject?'tape':old;
        grid[source][row]=grid[c][row]=subject;
        return {type:'flip',source,changes:[{c,row,before}]};
      }
      const line=lines[Math.floor(rng()*lines.length)],symbol=regularSymbol();
      const changes=[];
      for(let c=0;c<3;c++){
        const row=line[c],old=grid[c][row];
        const before=old===symbol?regular[(regular.indexOf(symbol)+1)%regular.length]:old;
        changes.push({c,row,before});grid[c][row]=symbol;
      }
      return {type:'rewrite',changes};
    }
    const c=Math.floor(rng()*3)*2,row=Math.floor(rng()*3);
    const old=grid[c].indexOf('ufo');
    if(old>=0)grid[c][old]=regularSymbol();
    const before=grid[c][row];
    grid[c][row]='ufo';
    return {type:'formation',changes:[{c,row,before}]};
  }
  function evaluate(grid, state, free) {
    let payout=0, ufos=0, hasAgent=false, bounty=0;
    const doubled=free && doubleBounty(state);
    const winners=[], lineWins=[], caught=[0,0,0];
    const add=(c,r)=>{ const key=c*3+r; if(!winners.includes(key)) winners.push(key); };
    for (let i=0;i<lines.length;i++) {
      const line=lines[i], symbol=grid[0][line[0]];
      if (!regular.includes(symbol)) continue;
      let length=1;
      while (length<5 && grid[length][line[length]]===symbol) length++;
      if (length<3) continue;
      payout += pay[length]*state.stake;
      lineWins.push(i);
      for(let c=0;c<length;c++) add(c,line[c]);
    }
    for (const column of grid) {
      if(column.includes('ufo')) ufos++;
      if(column.includes('agent')) hasAgent=true;
    }
    const triggered = !free && ufos===3;
    for(let c=0;c<5;c++) for(let r=0;r<3;r++) {
      const s=grid[c][r], j=jars.indexOf(s);
      if(triggered && s==='ufo') add(c,r);
      if(hasAgent && j>=0) {
        if(free)caught[j]++;
        bounty+=state.stake*values[j]*(doubled?2:1);
        add(c,r);
      }
    }
    if(bounty) for(let r=0;r<3;r++) if(grid[3][r]==='agent') add(3,r);
    return {grid,winners,lineWins,caught,bounty,payout:payout+bounty,triggered,free,
      priorMask:state.mask,enhanced:doubled,sightings:ufos,caseClosed:false,finished:false};
  }
  function spin(state,rng=Math.random,staged=null) {
    if(state.last?.passenger && !state.last.passenger.found)return null;
    honourMimics(state);
    const free=state.remaining>0;
    const pass=!free && state.patrolSpins>0;
    if(!free && !pass && state.balance<state.stake) return null;
    const rank=free?(state.featureRank??0):radarRank(state.contacts);
    const variants=staged?.variants??{};
    // Breaches saved before encounters shipped used this earlier agent paytable.
    const agentChance=free?(state.featureAgent??[.52655236,.46000558,.40536657][rank]):radarRanks[rank].agent;
    const grid=staged?.grid??draw(free,rng,rank,variants,radarRank(state.contacts),agentChance);
    const encounter=staged?(staged.encounter??null):(free?null:visit(grid,rng));
    if(!staged && !free && !encounter)patrolSamples(grid,rng);
    const result=evaluate(grid,state,free);
    tractorLock(result,state,rng,variants,staged?.lock);
    if(staged)result.devFeature=staged.feature;
    result.encounter=encounter;
    result.variants=variants;
    result.discoveries=[];
    state.contacts=(state.contacts??0)+result.sightings;
    result.rankUp=!free && radarRank(state.contacts)>rank;
    if(pass){state.patrolSpins--;result.patrolFree=true;}
    state.balance += result.payout-(free||pass?0:state.stake);
    if(result.triggered) {
      state.remaining=8; state.mask=0; state.enhanced=false; state.featureTotal=0; state.featureRank=rank;
      state.featureAgent=radarRanks[rank].agent;
      state.breachStats={specimens:0,bestCatch:0};
      state.doubleSpins=0;
      state.pickups={families:[0,0,0],rares:0,trio:false,pair:false,extra:0};
    } else if(free) {
      const progress=pickupProgress(state);state.pickups=progress;
      state.doubleSpins=Math.max(0,doubleLeft(state)-(result.enhanced?1:0));
      state.remaining--;
      result.spinsAfterUse=state.remaining;result.spinAwards=[];
      state.featureTotal+=result.payout;
      if(state.breachStats){
        state.breachStats.specimens+=result.caught.reduce((sum,n)=>sum+n,0);
        state.breachStats.bestCatch=Math.max(state.breachStats.bestCatch,result.bounty);
      }
      if(result.bounty){
        state.rareCaptures??={};
        const catchGrid=result.tractor?.passes.at(-1)??grid;
        const ids=catchGrid.flat().map((id,k)=>variants[k]??id);
        for(const entry of catalog){
          const count=ids.filter(id=>id===entry.id).length;
          if(!count)continue;
          if(captured(state,entry)===0)result.discoveries.push(entry.id);
          if(entry.rank)state.rareCaptures[entry.id]=(state.rareCaptures[entry.id]??0)+count;
        }
      }
      result.caught.forEach((count,i)=>{
        state.captures[i]+=count;
        progress.families[i]+=count;
        if(count) state.mask |= (1<<i);
      });
      if(state.mask===7 && !state.enhanced) {
        state.enhanced=true;state.doubleSpins+=2;state.cases++;result.caseClosed=true;
        result.spinAwards.push({id:'case',spins:2});
      }
      const trio=progress.families.findIndex(n=>n>=3);
      if(!progress.trio && trio>=0){progress.trio=true;result.spinAwards.push({id:'trio',family:trio,spins:2});}
      progress.rares+=rareCatchCount(result);
      if(!progress.pair && progress.rares>=2){progress.pair=true;result.spinAwards.push({id:'pair',spins:1});}
      for(const award of result.spinAwards){state.remaining+=award.spins;progress.extra+=award.spins;}
      result.finished=state.remaining===0 && !result.passenger;
      if(result.finished)state.lastDebrief={...state.breachStats,total:state.featureTotal,mask:state.mask,extra:progress.extra};
    }
    state.last=result;
    return result;
  }
  const api={newGame,draw,regularGrid,applyEncounter,evaluate,spin,claimPassenger,honourMimics,pickupProgress,doubleBounty,voidbackSlots,regular,lines,species,initialGrid,jars,values,pay,radarRanks,radarRank,catalog,captured,encounters};
  if(typeof module!=='undefined' && module.exports) module.exports=api;
  else window.Hunter=api;
})();
