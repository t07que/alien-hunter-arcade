// Short, gesture-unlocked Web Audio cues. Everything feeds one muteable cabinet mix.
window.CabinetAudio = (() => {
  let ctx, mix, noiseBuffer;
  const voices=new Set();
  let enabled = false;
  function setEnabled(value) {
    enabled = value;
    if (!enabled && ctx) {
      voices.clear();
      ctx.close().catch(() => {});
      ctx = mix = noiseBuffer = null;
    }
  }
  function unlock() {
    if (!enabled) return;
    try {
      if (!ctx) {
        ctx = new AudioContext();
        mix = ctx.createGain();
        mix.gain.value = 0.62;
        const limiter = ctx.createDynamicsCompressor();
        mix.connect(limiter).connect(ctx.destination);
        noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const samples = noiseBuffer.getChannelData(0);
        for (let i=0; i<samples.length; i++) samples[i] = Math.random()*2-1;
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    } catch { setEnabled(false); }
  }
  function voice(source, gain, duration, delay, pan, filter) {
    const t = ctx.currentTime + delay;
    const envelope = ctx.createGain(), stereo = ctx.createStereoPanner();
    const attack = Math.min(.04, duration/6);
    envelope.gain.setValueAtTime(.0001, t);
    envelope.gain.exponentialRampToValueAtTime(gain, t+attack);
    envelope.gain.setValueAtTime(gain*.73, t+duration*.65);
    envelope.gain.exponentialRampToValueAtTime(.0001, t+duration);
    stereo.pan.value = pan;
    if (filter) source.connect(filter).connect(envelope);
    else source.connect(envelope);
    envelope.connect(stereo).connect(mix);
    source.start(t); source.stop(t+duration+.01);
    voices.add(source);
    source.onended = () => {voices.delete(source);source.disconnect(); filter?.disconnect(); envelope.disconnect(); stereo.disconnect();};
  }
  // Only the tape transport calls these, while its modal has control of the cabinet.
  function pausePlayback(paused){
    if(enabled && ctx && ctx.state!=='closed')(paused?ctx.suspend():ctx.resume()).catch(()=>{});
  }
  function stopPlayback(){
    for(const source of voices){source.disconnect();try{source.stop();}catch{}}
    voices.clear();pausePlayback(false);
  }
  function tone(hz,end,duration,gain=.075,delay=0,type='sine',pan=0) {
    const osc = ctx.createOscillator(), t=ctx.currentTime+delay;
    osc.type=type; osc.frequency.setValueAtTime(hz,t);
    osc.frequency.exponentialRampToValueAtTime(end,t+duration);
    voice(osc,gain,duration,delay,pan);
  }
  function noise(hz,end,duration,gain,delay=0,pan=0) {
    const source=ctx.createBufferSource(), filter=ctx.createBiquadFilter(), t=ctx.currentTime+delay;
    source.buffer=noiseBuffer; source.loop=true;
    filter.type='bandpass'; filter.Q.value=1.25;
    filter.frequency.setValueAtTime(hz,t); filter.frequency.exponentialRampToValueAtTime(end,t+duration);
    voice(source,gain,duration,delay,pan,filter);
  }
  function play(name, param=0) {
    if (!enabled || !ctx || ctx.state==='closed' || document.hidden) return;
    switch(name) {
      case 'switch': noise(2200,580,.07,.15); tone(470,620,.08,.05); break;
      case 'flip': noise(3100,560,.17,.16);tone(215,78,.17,.1,.13,'triangle');break;
      case 'line-step': {
        const pitch=[330,392,494,587,660][param];
        tone(pitch,pitch,.12,.042,param*.085,'sine',(param-2)*.3);break;
      }
      case 'close': tone(550,290,.1,.045); break;
      case 'spin-credit': {
        const notes=[392,523,659,880];
        notes.forEach((hz,i)=>tone(hz,hz*1.02,.20,.066,.095*i,'triangle',(i-1.5)*.2));
        tone(176,264,.33,.095);if(param>1)tone(1046,1046,.34,.055,.42);break;
      }
      case 'lock-click': noise(1600,460,.08,.11);tone(740,990,.14,.07,.035,'sine',.32);break;
      case 'tow-charge':
        tone(76,153,.68,.12,0,'triangle');tone(228,456,.60,.048,.07);
        noise(350,1750,.55,.10);break;
      case 'tow-strain':
        tone(168,134,.82,.11,0,'triangle');tone(336,265,.80,.06,.02);
        noise(1800,920,.55,.09,.14);break;
      case 'tow-skid':
        [0,.19,.39,.57].forEach((d,i)=>{const pan=param*(i+1)/5;
          noise(1350+i*180,410,.15,.15,d,pan);tone(680-i*50,225,.17,.045,d,'triangle',pan);});
        break;
      case 'tow-impact':
        noise(900,140,.18,.17);tone(107,47,.36,.15,0,'triangle');tone(430,330,.22,.04,.09);break;
      case 'jar-knock':
        noise(1430,350,.048,.14);tone(240-param*17,88,.15,.12+param*.015,0,'triangle');
        tone(670,590,.15,.038,.018,'sine',-.22);break;
      case 'mimic-scuttle':
        [0,.12,.21,.33,.41,.54,.63].forEach((d,i)=>noise(i%2?2800:1800,480,.055,.1,d,-.55+i*.18));
        break;
      case 'key-clack':
        noise(3400,650,.085,.18);tone(180,420,.13,.067,.05,'triangle');break;
      case 'mimic-protest':
        [0,.17,.38].forEach((d,i)=>{tone(330+i*44,202,.17,.085,d,'triangle',.26);tone(660+i*66,403,.15,.045,d);});break;
      case 'shutter': noise(4200,850,.065,.16);noise(1900,430,.10,.105,.095);break;
      case 'tape-load': noise(2300,390,.17,.14);tone(72,130,.37,.085,.07,'triangle');break;
      case 'tape-eject': noise(620,1730,.16,.13);tone(150,64,.22,.06,.05,'triangle');break;
      case 'tractor-arm':
        noise(340,1950,.36,.12);tone(96,192,.44,.09,0,'triangle');break;
      case 'jar-latch': {
        const hz=[0,294,392,494,659][param];
        noise(2300,530,.085,.13);tone(hz*.75,hz,.19,.09,0,'triangle');
        for(let i=0;i<param;i++)tone(hz*(1+i*.25),hz*(1+i*.25),.16,.042,.10+i*.07);
        break;
      }
      case 'tractor-release':
        tone(196+param*49,98,.43,.10,0,'triangle');noise(2450,480,.32,.11,.08);break;
      case 'stake': tone(param>0?440:660,param>0?660:440,.12,.08,0,'triangle'); break;
      case 'motor':
        noise(250,1700,param,.095); tone(48,85,param,.06,0,'triangle');
        noise(1900,190,.13,.19); break;
      case 'stop': {
        const pan=(param-2)*.36;
        noise(2800,390,.105,.24,0,pan); tone(132+param*14,58,.135,.16,0,'triangle',pan);
        tone(620+param*80,240,.06,.04,.04,'sine',pan); break;
      }
      case 'reel-scan': {
        if(param==='dispatch'){
          noise(2100,1250,.105,.10);
          [0,.22].forEach(d=>tone(540,510,.105,.062,d+.06,'triangle',.4));
        }else{
          const pitches={pair:[350,415],line:[392,494,587,740],contact:[510,680,850],specimen:[310,465,620]}[param];
          pitches.forEach((hz,i)=>tone(hz,hz*1.04,.13,.058,i*.18,'sine',-.25+i*.22));
        }
        break;
      }
      case 'lockdown':
        for(const d of [0,.47]) {tone(320,540,.32,.105,d,'triangle'); tone(400,680,.32,.055,d,'sine');}
        break;
      case 'hatch': noise(2300,180,.42,.28); tone(110,39,.32,.23,0,'triangle'); break;
      case 'release': noise(270,2500,.38,.18); tone(400,600,.28,.065,.08); break;
      case 'scan': tone(155,195,.35,.07,0,'triangle'); tone(870,610,.16,.045,.12); break;
      case 'double-scan':
        tone(165,330,.38,.075,0,'triangle');tone(330,660,.31,.058,.14);
        tone(990,825,.15,.045,.35);break;
      case 'ufo-land':
        if(param===1){tone(600,770,.12,.055);break;}
        if(param===2){tone(540,870,.20,.085);tone(700,1100,.20,.065,.15);break;}
        noise(850,145,.32,.22);tone(104,44,.48,.20,0,'triangle');tone(330,880,.45,.085,.08);break;
      case 'contact':
        if(param===1){tone(880,990,.16,.085);break;}
        if(param===2){[784,1046].forEach((f,i)=>tone(f,f,.17,.075,i*.14));break;}
        [392,494,587,784].forEach((f,i)=>tone(f,f,.35,.085,i*.09,'triangle'));
        tone(98,98,.65,.11);break;
      case 'alien-line':
        if(param==='prong'){tone(180,245,.16,.082,0,'triangle');tone(250,148,.23,.07,.14,'triangle');}
        if(param==='moth'){[830,990,870].forEach((f,i)=>tone(f,f*1.1,.10,.065,i*.09));}
        if(param==='sprout'){tone(620,890,.15,.08);tone(780,1170,.16,.07,.14);}
        if(param==='ink'){[0,.13,.25].forEach((d,i)=>tone(205+i*48,420+i*60,.125,.085,d));}
        if(param==='grey'){tone(470,780,.22,.075);tone(780,620,.25,.07,.19);}
        break;
      case 'discovery': {
        const root=[390,310,240][param];
        [1,1.25,1.5,2].forEach((step,i)=>tone(root*step,root*step,.23,.085,i*.105,'triangle'));
        if(param)tone(root/2,root/3,.58,.12);
        break;
      }
      case 'creature': {
        const pitch=[680,425,920][param];
        tone(pitch,pitch*1.45,.15,.09,0,'sine');tone(pitch*1.5,pitch*.68,.19,.065,.13,'triangle');break;
      }
      case 'beam': noise(600,3100,.49,.13);tone(270,1120,.49,.075);break;
      case 'transport': noise(1900,570,.85,.10);tone(740,280,.76,.078);tone(1110,420,.80,.045,.06,'triangle');break;
      case 'filed': tone(830,830,.08,.075);tone(1240,1240,.15,.055,.07);break;
      case 'win': [392,494,587,784].forEach((f,i)=>tone(f,f,.17,.07,i*.075));break;
      case 'win-counter': tone(520+70*param,610+70*param,.045,.033,0,'triangle');break;
      case 'win-tier': {
        const root=[330,392,440,494,587,659][param];
        [1,1.25,1.5].forEach((step,i)=>tone(root*step,root*step,.15,.055,i*.066,'triangle'));
        break;
      }
      case 'win-banked': {
        const root=330+param*36;
        [1,1.25,1.5,2].forEach((step,i)=>tone(root*step,root*step,.28,.055,i*.075,'sine'));
        break;
      }
      case 'clear': tone(300,230,.13,.04);break;
      case 'case': [330,440,554,660,880].forEach((f,i)=>tone(f,f,.23,.085,i*.12,'triangle'));break;
      case 'all-clear': [660,550,440].forEach((f,i)=>tone(f,f,.24,.085,i*.16));break;
    }
  }
  return {setEnabled,unlock,play,pausePlayback,stopPlayback};
})();
