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
const API_KEY='sk-or-v1-e484041272b9429afd29b9918e139aborea4860e8f01a04c58e8a5577fa72b3e';
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
    const errMsg='*static crackle* The spectral connection is unstable... ('+e.message+')';
    appendMessage('assistant',errMsg,true);
    showToast('Connection error - check your internet','error');
    sfxError();
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

document.addEventListener('DOMContentLoaded',init);
})();
