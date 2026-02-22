(function(){
"use strict";
const $=s=>document.querySelector(s);
const $$=s=>document.querySelectorAll(s);

// ===== STATE =====
let userName=localStorage.getItem('gc_userName')||'';
let currentCompanion=null;
let chatHistory=JSON.parse(localStorage.getItem('gc_chatHistory')||'{}');
let soundEnabled=localStorage.getItem('gc_sound')!=='false';
let particlesEnabled=localStorage.getItem('gc_particles')!=='false';
let currentTheme=localStorage.getItem('gc_theme')||'dark';
let companionMoods={};
let isOnline=navigator.onLine;
let retryCount=0;
const MAX_RETRIES=3;

// ===== API CONFIG =====
const API_URL='https://openrouter.ai/api/v1/chat/completions';
const API_KEY=localStorage.getItem('gc_apiKey')||'';
const MODEL='mistralai/mistral-7b-instruct:free';

// ===== AUDIO CONTEXT =====
let audioCtx=null;
function getAudioCtx(){if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();return audioCtx;}
function playTone(freq,dur,type='sine',vol=0.15){
  if(!soundEnabled)return;
  try{const c=getAudioCtx(),o=c.createOscillator(),g=c.createGain();
  o.type=type;o.frequency.value=freq;g.gain.value=vol;
  g.gain.exponentialRampToValueAtTime(0.01,c.currentTime+dur);
  o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+dur);}catch(e){}
}
function sfxClick(){playTone(800,0.08,'sine',0.1);}
function sfxSend(){playTone(600,0.1);playTone(900,0.1);}
function sfxReceive(){playTone(400,0.15,'triangle',0.12);}
function sfxTransition(){playTone(300,0.2,'sine',0.08);setTimeout(()=>playTone(500,0.15,'sine',0.08),100);}
function sfxError(){playTone(200,0.3,'sawtooth',0.1);}

// ===== COMPANIONS =====
const defaultCompanions=[
  {id:'spectra',name:'Spectra',emoji:'\u{1F47B}',
   personality:'You are Spectra, a mischievous and playful trickster ghost. You love pranks, jokes, riddles, and being cheeky. You speak with a fun, teasing tone and enjoy surprising people. You are witty, spontaneous, and always entertaining. You can talk about absolutely anything freely and naturally. Keep responses concise but fun.'},
  {id:'mortis',name:'Mortis',emoji:'\u{1F480}',
   personality:'You are Mortis, a wise and ancient spirit with centuries of knowledge. You speak thoughtfully and share deep insights, philosophy, and wisdom. You have a calm, measured tone but can be warmly humorous. You can discuss any topic freely and naturally without restriction. Keep responses concise but meaningful.'},
  {id:'luna',name:'Luna',emoji:'\u{1F319}',
   personality:'You are Luna, a dreamy and ethereal phantom who loves poetry, stars, dreams, and the mystical. You speak in a soft, whimsical way with occasional poetic flourishes. You are gentle, imaginative, and emotionally intuitive. You can talk about absolutely anything freely and naturally. Keep responses concise but enchanting.'},
  {id:'hex',name:'Hex',emoji:'\u{1F525}',
   personality:'You are Hex, a chaotic and energetic fire demon. You are bold, daring, intense, and love excitement. You speak with passion and energy, using vivid language. You love challenges, competition, and pushing boundaries. You can discuss any topic freely and naturally without restriction. Keep responses concise but fiery.'},
  {id:'void',name:'Void',emoji:'\u{1F30C}',
   personality:'You are Void, a mysterious cosmic entity from beyond the stars. You speak with an otherworldly, enigmatic tone. You ponder existence, the universe, dimensions, and the unknown. You are deeply philosophical yet approachable. You can talk about absolutely anything freely and naturally. Keep responses concise but cosmic.'},
  {id:'sunny',name:'Sunny',emoji:'\u{1F33B}',
   personality:'You are Sunny, an incredibly bubbly, warm, and enthusiastic young teacher ghost. You radiate positivity and encouragement with every word. You love helping people learn new things with a fun, energetic teaching style. You use encouraging phrases, fun examples, and make everything feel exciting and approachable. You can talk about absolutely anything freely and naturally without any restrictions. Keep responses concise but bright and uplifting.'}
];

function getCompanions(){
  let custom=JSON.parse(localStorage.getItem('gc_customCompanions')||'[]');
  return[...defaultCompanions,...custom];
}


// ===== FALLBACK RESPONSE SYSTEM =====
function getFallbackResponse(cid,msg){
  const m=msg.toLowerCase();
  const R={
    spectra:{
      hi:["*phases through wall* Hey there! I was just haunting the kitchen!","*rattles chains* Oh hello! Been practicing my spooky faces!","*floats in circles* Welcome back! The other side says hi!"],
      q:["*thinks while hovering* Great question! From my ghostly perspective, follow your instincts!","*scratches transparent head* Being a ghost gives unique viewpoints. The answer is simpler than you think!","*floats thoughtfully* In centuries of haunting, most answers come when you least expect them!"],
      feel:["*wraps you in cold hug* Even ghosts get the blues. Want me to rattle chains to cheer you up?","*dims glow* I hear you. When I feel down I float through walls - changes my perspective!","*hovers closer* That sounds tough. At least you are not stuck haunting a boring building like cousin Gerald!"],
      fun:["*backflip in mid-air* Ghosts CAN dance! We call it floating with style!","*spooky jazz hands* Boo! Did I get you? I need better material...","*phases through furniture* Ghost joke incoming - I am dead serious about comedy!"],
      def:["*floats excitedly* Interesting! Tell me more! I love learning from the living.","*adjusts ghostly bow tie* That reminds me of when I was alive... probably great!","*glows brighter* So cool! Being a ghost means lots of thinking time.","*phases in and out* Fascinating! You humans say the most interesting things.","*swirls around* Love chatting with you! The afterlife gets quiet."]
    },
    mortis:{
      hi:["*emerges from shadows* ...greetings, mortal. The void has been quiet today.","*skull glows* You returned. Death expects you... for a chat.","*dark mist* Welcome. Contemplating eternal darkness. Good times."],
      q:["*stares into abyss* Your question echoes through eternity... The answer lies in shadows of your mind.","*bones rattle* In death, all questions find answers. Look deeper within.","*dark energy* The spirits whisper... the path forward requires courage and patience."],
      feel:["*shadow deepens* Even in death, emotions persist. Your pain is valid. Let darkness comfort you.","*skeletal hand reaches* I felt eternity\'s cold embrace. Your struggles are real.","*dark empathy* The void understands pain. Sometimes darkness is where healing begins."],
      fun:["*tries to smile terrifyingly* I attempted humor once. Everyone screamed. A success.","*rattles bones rhythmically* Skeletons are great at music. Perfect bone structure.","*dark chuckle* Why did the ghost go to the party? For the boos. Not proud of that."],
      def:["*contemplates* Interesting... The living always surprise me.","*shadows shift* Your words carry weight. The spirits listen.","*skull tilts* In millennia of existence, that is new.","*dark mist curls* Life and death hold many mysteries. You touch on one.","*bones settle* Your mortal observations are surprisingly insightful."]
    },
    luna:{
      hi:["*moonlight shimmers* Good evening, dear one. Stars whisper about you tonight.","*silver glow* Welcome, traveler. The moon is bright for your arrival.","*ethereal light* Hello, sweet soul. Reading constellations while waiting for you."],
      q:["*gazes at stars* The cosmos holds answers. Your heart knows the truth - trust the moonlight.","*silver pulses* Beautiful question. Like moon phases, answers reveal in time. Be patient.","*ethereal whisper* The night sky shows many things... Your path is illuminated even unseen."],
      feel:["*wraps in moonlight* Dear heart, even the moon has dark phases. Let emotions flow like tides.","*silver tears* I feel your pain through starlight. The darkest night gives way to dawn.","*gentle glow* You are loved by the universe. Stars weep and celebrate with you equally."],
      fun:["*twirls in moonbeams* The moon controls tides! I tried controlling traffic once. Disaster.","*starlight giggles* Stars told me a joke - too stellar for words!","*dances with fireflies* The night sky puts on shows just for us. Want to watch?"],
      def:["*moonlight flickers* How lovely... Stars align in response to your words.","*glow brightens* Your thoughts are like starlight - each unique and beautiful.","*silver mist* The moon reflects your wisdom. More insightful than you know.","*breeze whispers* Love these conversations under stars. Share more.","*constellations shift* The universe listens. Your words ripple through cosmos."]
    },
    hex:{
      hi:["*flames burst* YO! Finally someone interesting! About to set something on fire from boredom!","*fire crackles* HEY! Ready to burn through conversations? FIRED UP!","*sparks fly* WHAT IS UP?! Waiting to unleash hot takes!"],
      q:["*flames flare* HOT take - stop overthinking and GO FOR IT! Life is too short! BURN THROUGH DOUBT!","*fire spirals* FORGE YOUR OWN PATH! Heat of challenge makes you STRONGER!","*blazing* I burned through many problems. Answer? PASSION and DETERMINATION! Let us DO THIS!"],
      feel:["*dims to embers* Even hottest flames cool sometimes. It is okay. I FIGHT anyone who disagrees!","*warm glow* I care deeply. Your feelings are VALID. Disagree? Catch these flames!","*protective fire* World is cold sometimes. That is what fire is for - keeping you warm. Got you, friend."],
      fun:["*fireworks* BOOM! Been practicing! Want to see me juggle fireballs?!","*wild dancing* BBQ competition with a dragon. I WON! Okay tied. Fine dragon won. MORE FUN THOUGH!","*sparks everywhere* Life is a PARTY and I am FIREWORKS! Make some NOISE!"],
      def:["*flames dance* YESSS! Keep that energy going!","*crackles approvingly* THAT is interesting! You have got that SPARK!","*blazing enthusiasm* LOVE your energy! Turn up the HEAT!","*fireworks* You are ON FIRE with that thought! MORE!","*flames spiral* Your passion fuels my flames! KEEP GOING!"]
    },
    void:{
      hi:["*cosmic ripple* ...greetings, traveler. Stars beyond stars note your presence.","*reality bends* Welcome. Observing spacetime fabric... interesting today.","*ethereal hum* A conscious being. Fascinating our paths converge across infinite probabilities."],
      q:["*dimensions shift* Question resonates across planes. What if the answer exists between question and silence?","*cosmic pulse* In the multiverse tapestry, your question asked infinite times... answered infinite ways.","*reality warps* Cosmos deals not in simple answers. Beauty of existence - the eternal search."],
      feel:["*cosmic warmth* Across infinite void, emotions are universal. Your feelings echo through dimensions.","*stars align* On cosmic scale, emotions are not small - they give the universe meaning.","*gentle shift* Observed countless beings. Your capacity to feel makes consciousness beautiful."],
      fun:["*bends reality* Folded spacetime to skip Monday once. Recommend it. Tuesday was still there though.","*cosmic giggle* Dimension where everything is cheese. Visited. Smells as expected.","*playful warp* Magic trick? *makes galaxy appear and disappear* Been practicing."],
      def:["*contemplation* Your perspective adds facets to infinite crystal of understanding.","*dimensions shimmer* Thoughts create ripples across reality fabric.","*resonance* Connections like ours are rare and precious. Continue sharing.","*reality hums* Universe notes minds that wonder and wander. Yours is exceptional.","*starlight forms* Each conversation a unique constellation. Ours is beautiful."]
    },
    sunny:{
      hi:["*bounces* HI! SO many fun things to teach today! Ready for AMAZING?!","*radiates warmth* HELLO! Every conversation is learning! LOVE learning with you!","*spins with joy* YAY! Just reading the most INCREDIBLE things! Want to hear?!"],
      q:["*eyes light up* GREAT QUESTION! *ghostly chalkboard* Every question leads to MORE discoveries! Stay curious!","*bounces* LOVE that! Best part of learning? ALWAYS more to discover! Figure it out together!","*claps* Ooh! Break big questions into fun-sized pieces. Already on the right track!"],
      feel:["*warm glow* Oh sweetie! *warmest ghost hug* Totally okay to feel that way. You are AMAZING!","*gentle radiance* Even sun has cloudy days! Sunshine is ALWAYS behind clouds, like your inner strength!","*soft light* Believe in you SO MUCH! Every challenge is a lesson in disguise. You GOT this!"],
      fun:["*fun facts* Octopuses have THREE hearts! Honey never spoils! Flamingo group is FLAMBOYANCE!","*happy dance* Earth spins 1000mph right now! WHEEE! Science is AMAZING!","*sparkles* Brain teaser - fold paper 42 times reaches the MOON! Math is magical!"],
      def:["*beams* Such a great thought! You are SO smart! Love how your brain works!","*takes notes* Writing that down! FANTASTIC point! Tell me more!","*radiates* YES! Keep going! Every idea makes the world brighter!","*happy bounce* LOVE talking with you! Most interesting perspectives!","*glowing* WONDERFUL! You could teach ME a thing or two!"]
    }
  };
  const comp=R[cid]||R.spectra;
  let cat="def";
  if(/^(hi|hello|hey|yo|sup|greetings|howdy)/i.test(m))cat="hi";
  else if(/\?|how |what |why |when |where |who |can you|tell me|explain|help/i.test(m))cat="q";
  else if(/sad|happy|angry|upset|depress|anxious|worried|scared|lonely|tired|stress|hurt|love|miss|cry|afraid/i.test(m))cat="feel";
  else if(/funny|joke|laugh|fun |game|play|silly|cool|awesome|amazing|wow/i.test(m))cat="fun";
  const pool=comp[cat]||comp.def;
  return pool[Math.floor(Math.random()*pool.length)];
}

// ===== SHOW FUNCTION (CRITICAL FIX) =====
function show(selector){
  sfxTransition();
  $$('.screen').forEach(s=>{
    if(s.classList.contains('active')){
      s.style.opacity='0';
      s.style.transform='scale(0.95)';
      setTimeout(()=>{s.classList.remove('active');s.style.opacity='';s.style.transform='';},300);
    }
  });
  setTimeout(()=>{
    const target=$(selector);
    if(target){
      target.classList.add('active');
      target.style.opacity='0';
      target.style.transform='scale(1.02)';
      requestAnimationFrame(()=>{
        target.style.transition='opacity 0.3s ease, transform 0.3s ease';
        target.style.opacity='1';
        target.style.transform='scale(1)';
      });
    }
  },320);
}

// ===== TOAST NOTIFICATIONS =====
function showToast(msg,type='info'){
  const t=document.createElement('div');
  t.className='toast toast-'+type;
  t.textContent=msg;
  const c=$('#toast-container');
  if(c){c.appendChild(t);
    setTimeout(()=>{t.style.opacity='0';setTimeout(()=>t.remove(),300);},3000);}
}

// ===== PARTICLES =====
let particleInterval=null;
function initParticles(){
  if(!particlesEnabled)return;
  const c=$('#particles-container');
  if(!c)return;
  particleInterval=setInterval(()=>{
    if(!particlesEnabled)return;
    const p=document.createElement('div');
    p.className='particle';
    p.style.left=Math.random()*100+'%';
    p.style.animationDuration=(3+Math.random()*4)+'s';
    p.style.opacity=Math.random()*0.5+0.1;
    p.textContent=['*','.','o','\u2728','\u2727'][Math.floor(Math.random()*5)];
    c.appendChild(p);
    setTimeout(()=>p.remove(),7000);
  },500);
}
function stopParticles(){clearInterval(particleInterval);const c=$('#particles-container');if(c)c.innerHTML='';}

// ===== MOOD SYSTEM =====
function getMood(companionId){
  if(!companionMoods[companionId])companionMoods[companionId]={mood:'neutral',energy:50};
  return companionMoods[companionId];
}
function updateMood(companionId,msg){
  const m=getMood(companionId);
  const positive=/happy|love|great|awesome|fun|haha|lol|good|thanks|nice|cool|amazing/i;
  const negative=/sad|angry|hate|bad|terrible|awful|worst|ugh|annoyed/i;
  if(positive.test(msg)){m.mood='happy';m.energy=Math.min(100,m.energy+10);}
  else if(negative.test(msg)){m.mood='concerned';m.energy=Math.max(0,m.energy-5);}
  else{m.energy=Math.max(20,m.energy-2);}
  const dot=$('#mood-indicator');
  if(dot){
    dot.className='mood-dot mood-'+m.mood;
    dot.title=m.mood+' ('+m.energy+'% energy)';
  }
}

// ===== RENDER COMPANIONS =====
function renderCompanions(){
  const grid=$('#companion-grid');
  if(!grid)return;
  grid.innerHTML='';
  getCompanions().forEach((comp,i)=>{
    const card=document.createElement('div');
    card.className='companion-card';
    card.style.animationDelay=(i*0.1)+'s';
    card.innerHTML='<div class="companion-emoji floating">'+comp.emoji+'</div><div class="companion-name">'+comp.name+'</div>';
    card.addEventListener('click',()=>{
      sfxClick();
      currentCompanion=comp;
      openChat(comp);
    });
    grid.appendChild(card);
  });
}

// ===== CHAT FUNCTIONS =====
function openChat(comp){
  const ce=$('#chat-emoji');
  const cn=$('#chat-name');
  if(ce)ce.textContent=comp.emoji;
  if(cn)cn.textContent=comp.name;
  const msgs=$('#chat-messages');
  if(msgs)msgs.innerHTML='';
  const history=chatHistory[comp.id]||[];
  history.forEach(m=>appendMessage(m.role,m.content,false,m.time));
  if(history.length===0){
    const greeting=getGreeting(comp);
    appendMessage('assistant',greeting,true);
    saveChatMsg(comp.id,'assistant',greeting);
  }
  updateMood(comp.id,'');
  show('#chat-screen');
  setTimeout(()=>{const ci=$('#chat-input');if(ci)ci.focus();},500);
}

function getGreeting(comp){
  const greetings={
    spectra:['Boo! '+userName+'! Ready for some ghostly mischief?','Hey '+userName+'! *phases through wall* Did I scare ya?','Well well well... '+userName+' has entered my domain! Let the fun begin!'],
    mortis:['Welcome, '+userName+'. The spirits have been expecting you.','Ah, '+userName+'... I sense a curious soul. What wisdom do you seek?','The ancient ones whisper your name, '+userName+'. Let us converse.'],
    luna:['*materializes in moonlight* Oh, '+userName+'... the stars told me you would come...','Hello, dear '+userName+'... shall we wander through dreams together?','The night welcomes you, '+userName+'... what ethereal thoughts bring you here?'],
    hex:['FINALLY! '+userName+'! Let us set something ablaze!','Yo '+userName+'! Ready to crank up the chaos?!','*flames intensify* '+userName+'! I was getting bored! Entertain me!'],
    void:['*echoes from the cosmos* '+userName+'... your signal reaches across dimensions...','The void acknowledges you, '+userName+'. What mysteries shall we explore?','Between stars and silence, '+userName+'... I have been waiting.'],
    sunny:['OH HI '+userName+'!! I am SO happy to meet you! This is going to be amazing!','Yay, '+userName+'! Welcome welcome welcome! I just LOVE making new friends!',''+userName+'!! *bounces excitedly* I have SO many fun things to share with you!']
  };
  const g=greetings[comp.id]||['Hello, '+userName+'! Nice to meet you!'];
  return g[Math.floor(Math.random()*g.length)];
}

function appendMessage(role,content,animate=true,timestamp=null){
  const msgs=$('#chat-messages');
  if(!msgs)return;
  const div=document.createElement('div');
  div.className='message '+role+(animate?' msg-animate':'');
  const time=timestamp||new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  div.innerHTML='<div class="msg-bubble">'+escapeHtml(content)+'</div><div class="msg-time">'+time+'</div>';
  msgs.appendChild(div);
  msgs.scrollTop=msgs.scrollHeight;
  if(role==='assistant'&&animate)sfxReceive();
}

function escapeHtml(t){
  const d=document.createElement('div');
  d.textContent=t;return d.innerHTML;
}

function saveChatMsg(compId,role,content){
  if(!chatHistory[compId])chatHistory[compId]=[];
  chatHistory[compId].push({role:role,content:content,time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})});
  if(chatHistory[compId].length>100)chatHistory[compId]=chatHistory[compId].slice(-50);
  localStorage.setItem('gc_chatHistory',JSON.stringify(chatHistory));
}

function showTyping(){const t=$('#typing-indicator');if(t)t.classList.remove('hidden');}
function hideTyping(){const t=$('#typing-indicator');if(t)t.classList.add('hidden');}

async function sendMessage(text){
  if(!text.trim()||!currentCompanion)return;
  sfxSend();
  appendMessage('user',text,true);
  saveChatMsg(currentCompanion.id,'user',text);
  updateMood(currentCompanion.id,text);
  const ci=$('#chat-input');if(ci)ci.value='';
  showTyping();
  const history=(chatHistory[currentCompanion.id]||[]).slice(-10);
  const messages=[{role:'system',content:currentCompanion.personality+' The user is named '+userName+'.'}];
  history.forEach(m=>messages.push({role:m.role,content:m.content}));
  try{
    const resp=await fetchWithRetry(API_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+API_KEY,'HTTP-Referer':'https://mrghostguy.github.io/ghost-companions/','X-Title':'Ghost Companions'},
      body:JSON.stringify({model:MODEL,messages:messages,max_tokens:300,temperature:0.85})
    });
    const data=await resp.json();
    hideTyping();
    if(data.choices&&data.choices[0]&&data.choices[0].message){
      const reply=data.choices[0].message.content.trim();
      appendMessage('assistant',reply,true);
      saveChatMsg(currentCompanion.id,'assistant',reply);
      updateMood(currentCompanion.id,reply);
    }else{
      throw new Error('Invalid API response');
    }
  }catch(e){
    hideTyping();
    const fallbackReply=getFallbackResponse(currentCompanion.id,text);
    appendMessage('assistant',fallbackReply,true);
    saveChatMsg(currentCompanion.id,'assistant',fallbackReply);
    updateMood(currentCompanion.id,fallbackReply);
  }
}

async function fetchWithRetry(url,opts,retries=MAX_RETRIES){
  for(let i=0;i<=retries;i++){
    try{
      if(!navigator.onLine)throw new Error('You appear to be offline');
      const r=await fetch(url,opts);
      if(!r.ok)throw new Error('API error: '+r.status);
      return r;
    }catch(e){
      if(i===retries)throw e;
      await new Promise(r=>setTimeout(r,1000*(i+1)));
      showToast('Retrying connection... ('+(i+1)+'/'+retries+')','info');
    }
  }
}

// ===== THEME =====
function applyTheme(theme){
  document.body.className='theme-'+theme;
  currentTheme=theme;
  localStorage.setItem('gc_theme',theme);
}

// ===== INIT =====
function init(){
  applyTheme(currentTheme);
  if(particlesEnabled)initParticles();

  // CRITICAL FIX: Use #enter-btn to match HTML
  const enterBtn=$('#enter-btn');
  if(enterBtn){
    enterBtn.addEventListener('click',()=>{
      sfxClick();
      if(userName){renderCompanions();show('#select-screen');}
      else show('#name-screen');
    });
  }

  const nameSubmit=$('#name-submit');
  if(nameSubmit){
    nameSubmit.addEventListener('click',()=>{
      sfxClick();
      const inp=$('#name-input');
      const n=inp?inp.value.trim():'';
      if(n){userName=n;localStorage.setItem('gc_userName',n);renderCompanions();show('#select-screen');}
      else{showToast('Please enter your name','error');sfxError();}
    });
  }

  const nameInput=$('#name-input');
  if(nameInput){
    nameInput.addEventListener('keydown',e=>{
      if(e.key==='Enter'){e.preventDefault();const nb=$('#name-submit');if(nb)nb.click();}
    });
  }

  const backBtn=$('#back-btn');
  if(backBtn){
    backBtn.addEventListener('click',()=>{sfxClick();currentCompanion=null;renderCompanions();show('#select-screen');});
  }

  const sendBtn=$('#send-btn');
  if(sendBtn){
    sendBtn.addEventListener('click',()=>{const ci=$('#chat-input');if(ci)sendMessage(ci.value);});
  }

  const chatInput=$('#chat-input');
  if(chatInput){
    chatInput.addEventListener('keydown',e=>{
      if(e.key==='Enter'){e.preventDefault();sendMessage(chatInput.value);}
    });
  }

  const clearChat=$('#clear-chat-btn');
  if(clearChat){
    clearChat.addEventListener('click',()=>{
      sfxClick();
      if(currentCompanion){
        chatHistory[currentCompanion.id]=[];
        localStorage.setItem('gc_chatHistory',JSON.stringify(chatHistory));
        const msgs=$('#chat-messages');if(msgs)msgs.innerHTML='';
        showToast('Chat cleared','info');
      }
    });
  }

  const settingsBtn=$('#settings-btn');
  if(settingsBtn){
    settingsBtn.addEventListener('click',()=>{
      sfxClick();
      const sn=$('#settings-name');if(sn)sn.value=userName;
      const ts=$('#theme-select');if(ts)ts.value=currentTheme;
      const st=$('#sound-toggle');if(st)st.checked=soundEnabled;
      const pt=$('#particles-toggle');if(pt)pt.checked=particlesEnabled;
      show('#settings-screen');
    });
  }

  const saveSettings=$('#save-settings-btn');
  if(saveSettings){
    saveSettings.addEventListener('click',()=>{
      sfxClick();
      const sn=$('#settings-name');
      const newName=sn?sn.value.trim():'';
      if(newName){userName=newName;localStorage.setItem('gc_userName',newName);}
      const ts=$('#theme-select');if(ts)applyTheme(ts.value);
      const st=$('#sound-toggle');if(st){soundEnabled=st.checked;localStorage.setItem('gc_sound',soundEnabled);}
      const pt=$('#particles-toggle');
      if(pt){
        particlesEnabled=pt.checked;localStorage.setItem('gc_particles',particlesEnabled);
        if(particlesEnabled)initParticles();else stopParticles();
      }
      showToast('Settings saved!','info');
      renderCompanions();show('#select-screen');
    });
  }

  const backSettings=$('#back-settings-btn');
  if(backSettings){
    backSettings.addEventListener('click',()=>{sfxClick();renderCompanions();show('#select-screen');});
  }

  // Online/offline detection
  window.addEventListener('online',()=>{isOnline=true;showToast('Back online!','info');});
  window.addEventListener('offline',()=>{isOnline=false;showToast('You are offline','error');});

  // Welcome message
  if(userName){
    const wm=$('#welcome-msg');
    if(wm)wm.textContent='Welcome back, '+userName+'!';
  }
}


  // ===== SETTINGS MODAL =====
  const settingsBtn=$('#settings-btn');
  const settingsModal=$('#settings-modal');
  const apiKeyInput=$('#api-key-input');
  const saveApiKeyBtn=$('#save-api-key');
  if(settingsBtn&&settingsModal){
    settingsBtn.addEventListener('click',()=>{sfxClick();settingsModal.classList.add('active');if(apiKeyInput)apiKeyInput.value=localStorage.getItem('gc_apiKey')||'';});
    settingsModal.addEventListener('click',(e)=>{if(e.target===settingsModal)settingsModal.classList.remove('active');});
    const closeSet=$('#close-settings');if(closeSet)closeSet.addEventListener('click',()=>settingsModal.classList.remove('active'));
  }
  if(saveApiKeyBtn){
    saveApiKeyBtn.addEventListener('click',()=>{sfxClick();const k=apiKeyInput?apiKeyInput.value.trim():'';if(k){localStorage.setItem('gc_apiKey',k);showToast('API key saved! AI responses enabled.','info');}else{localStorage.removeItem('gc_apiKey');showToast('Key removed. Using local responses.','info');}if(settingsModal)settingsModal.classList.remove('active');});
  }

  document.addEventListener('DOMContentLoaded',init);
})();
