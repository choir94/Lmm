// ===== Lamumu Cow Farm – Pixel Field with Idle Animation + Simple Pathing =====
const DAY_SECONDS = 60;          // 60s = 1 day
const BASE_MILK_PRICE = 5;
const FESTIVAL_MULTIPLIER = 1.5;

// movement/animation cadence
const MOVE_INTERVAL_MS = 150;    // movement + frame tick
const STEP_PER_TICK = 0.35;      // % of field per tick (slow walk)
const RETARGET_EVERY_TICKS = 40; // ~6s with 150ms tick

const el = (id) => document.getElementById(id);
const $farm = () => document.getElementById("farm");

const state = {
  day: 1,
  coins: 150,
  feed: 10,
  milk: 0,
  barnLevel: 1,
  barnCap: 3,
  cows: [], // { id,name,hunger,happiness,milkProgress,wateredToday,x,y,tx,ty,frame,ticks }
  secondsLeft: DAY_SECONDS,
  festival: { active:false, daysLeft:0 },
  selectedId: null
};

const COST = { cow:100, feed10:20, upgradeBarn:250 };

function log(msg, mood=""){
  const box = el("log");
  const d = document.createElement("div");
  d.className = `entry ${mood}`;
  d.textContent = `[D${state.day}] ${msg}`;
  box.prepend(d);
}

function save(){ localStorage.setItem("lamumu-cow-farm-pixel", JSON.stringify(state)); }
function load(){
  const raw = localStorage.getItem("lamumu-cow-farm-pixel");
  if(!raw) return;
  try{ Object.assign(state, JSON.parse(raw)); }catch(_){}
  // ensure defaults for older saves
  state.cows.forEach(c=>ensureCowDefaults(c));
}

function fmt(n){ return Math.floor(n).toString(); }
function capacity(){ return state.barnCap; }
function currentMilkPrice(){ return state.festival.active ? Math.floor(BASE_MILK_PRICE*FESTIVAL_MULTIPLIER) : BASE_MILK_PRICE; }

function rand(min,max){ return Math.random()*(max-min)+min; }
function clamp(min,max,v){ return Math.max(min, Math.min(max,v)); }
function perc(n){ return `${n}%`; }

function randomFieldPoint(){
  return { x: 12 + Math.random()*76, y: 14 + Math.random()*78 };
}

function ensureCowDefaults(c){
  if(typeof c.x!=="number" || typeof c.y!=="number"){
    const p = randomFieldPoint(); c.x = p.x; c.y = p.y;
  }
  if(typeof c.tx!=="number" || typeof c.ty!=="number"){
    const t = randomFieldPoint(); c.tx = t.x; c.ty = t.y;
  }
  if(typeof c.frame!=="number") c.frame = 0;
  if(typeof c.ticks!=="number") c.ticks = 0;
}

function newCow(){
  const p = randomFieldPoint();
  const t = randomFieldPoint();
  return {
    id: crypto.randomUUID(),
    name: `Cow #${state.cows.length+1}`,
    hunger: 100,
    happiness: 60,
    milkProgress: 0,
    wateredToday: false,
    x: p.x, y: p.y,
    tx: t.x, ty: t.y,
    frame: 0,
    ticks: 0
  };
}

/* —— Day tick —— */
function tickSecond(){
  state.secondsLeft--;
  if(state.secondsLeft <= 0){
    endOfDay();
    state.secondsLeft = DAY_SECONDS;
  }
  renderClock();
}

function endOfDay(){
  state.cows.forEach(c=>{
    c.hunger = Math.max(0, c.hunger - 20);
    if(c.hunger < 40) c.happiness = Math.max(0, c.happiness - 10);

    const fed = c.hunger >= 60;
    const mood = c.happiness >= 50;
    const water = c.wateredToday;

    let gain = 0;
    if(fed && mood && water) gain = 40;
    else if((fed && mood) || (fed && water) || (mood && water)) gain = 20;
    else if(fed || mood || water) gain = 10;

    c.milkProgress = Math.min(100, c.milkProgress + gain);
    c.wateredToday = false;
  });

  state.day++;

  if(!state.festival.active && Math.random()<0.10){
    state.festival.active = true;
    state.festival.daysLeft = 1;
    log("Lamumu Festival! Milk price x1.5 for a day!", "good");
  }
  if(state.festival.active){
    state.festival.daysLeft--;
    if(state.festival.daysLeft<=0){
      state.festival.active = false;
      log("Festival ended. Milk price back to normal.", "warn");
    }
  }

  render(); save();
}

/* —— Movement + Idle Animation —— */
function moveAndAnimateTick(){
  state.cows.forEach(c=>{
    ensureCowDefaults(c);
    c.ticks++;

    // Every few seconds, choose a new target
    if(c.ticks % RETARGET_EVERY_TICKS === 0){
      const t = randomFieldPoint(); c.tx = t.x; c.ty = t.y;
    }

    // Move toward target
    const dx = c.tx - c.x;
    const dy = c.ty - c.y;
    const dist = Math.hypot(dx, dy);
    if(dist > 0.2){
      const ux = dx / dist, uy = dy / dist;
      c.x = clamp(8, 92, c.x + ux * STEP_PER_TICK);
      c.y = clamp(10, 90, c.y + uy * STEP_PER_TICK);
    }

    // 3-frame idle/walk cycle
    c.frame = (c.frame + 1) % 3;
  });

  // re-render sprites only (cheap)
  renderField();
  // also update selected preview sprite frame
  renderSelected();
}

/* —— Actions —— */
function buyCow(){
  if(state.cows.length >= capacity()){ log("Barn is full. Upgrade first!", "warn"); return; }
  if(state.coins < COST.cow){ log("Not enough coins to buy a cow.", "bad"); return; }
  state.coins -= COST.cow;
  const c = newCow();
  state.cows.push(c);
  log(`Bought a new cow: ${c.name} 🐄`, "good");
  render(); save();
}
function buyFeed(){
  if(state.coins < COST.feed10){ log("Not enough coins for feed x10.", "bad"); return; }
  state.coins -= COST.feed10; state.feed += 10;
  log("Bought 10 feed.", "good"); render(); save();
}
function feedAll(){
  const need = state.cows.length;
  if(need === 0){ log("No cows to feed.", "warn"); return; }
  if(state.feed < need){ log("Not enough feed for all cows.", "bad"); return; }
  state.feed -= need;
  state.cows.forEach(c=>{
    c.hunger = Math.min(100, c.hunger + 30);
    c.happiness = Math.min(100, c.happiness + 5);
  });
  log("Fed all cows. +30 hunger, +5 happiness.");
  render(); save();
}
function waterAll(){
  if(state.cows.length === 0){ log("No cows to water.", "warn"); return; }
  state.cows.forEach(c=> c.wateredToday = true);
  log("Watered all cows. Hydration secured!");
  render(); save();
}
function milkAll(){
  let gained=0;
  state.cows.forEach(c=>{
    if(c.milkProgress >= 100){
      gained++;
      c.milkProgress = 0;
      c.happiness = Math.max(0, c.happiness - 5);
    }
  });
  if(gained===0){ log("No cows ready for milking.", "warn"); return; }
  state.milk += gained;
  log(`Milked ${gained} bottle(s) of milk. 🥛`, "good");
  render(); save();
}
function sellMilk(){
  if(state.milk<=0){ log("No milk to sell.", "warn"); return; }
  const price = currentMilkPrice();
  const income = state.milk * price;
  state.coins += income;
  log(`Sold ${state.milk} milk for ${income} coins (price ${price}).`, "good");
  state.milk = 0;
  render(); save();
}
function upgradeBarn(){
  if(state.coins < COST.upgradeBarn){ log("Not enough coins to upgrade barn.", "bad"); return; }
  state.coins -= COST.upgradeBarn;
  state.barnLevel += 1;
  state.barnCap += 2;
  log(`Barn upgraded to Lv.${state.barnLevel}. Capacity now ${state.barnCap}.`, "good");
  render(); save();
}
function resetGame(){
  if(!confirm("Reset save and start over?")) return;
  localStorage.removeItem("lamumu-cow-farm-pixel");
  location.reload();
}

/* —— Render —— */
function renderClock(){
  const mm = String(Math.floor(state.secondsLeft/60)).padStart(2,"0");
  const ss = String(state.secondsLeft%60).padStart(2,"0");
  el("clock").textContent = `${mm}:${ss}`;
}

function renderUI(){
  el("day").textContent = `Day ${state.day}`;
  el("coins").textContent = fmt(state.coins);
  el("feed").textContent = fmt(state.feed);
  el("milk").textContent = fmt(state.milk);
  el("barn").textContent = `Lv.${state.barnLevel}`;
  el("capacity").textContent = state.barnCap;
  el("cowCount").textContent = state.cows.length;
  el("milkPrice").textContent = currentMilkPrice();
  const fest = el("festival");
  fest.textContent = state.festival.active ? "Lamumu Festival!" : "No Event";
  fest.style.color = state.festival.active ? "var(--pink)" : "var(--muted)";
  const banner = document.getElementById("eventBanner");
  banner.hidden = !state.festival.active;
}

function renderField(){
  const farm = $farm();
  // remove old cow sprites
  farm.querySelectorAll(".cow-sprite").forEach(n=>n.remove());

  state.cows.forEach(c=>{
    const d = document.createElement("div");
    d.className = `cow-sprite cow-f${c.frame}`;
    d.style.left = perc(c.x);
    d.style.top = perc(c.y);
    d.dataset.id = c.id;
    if(state.selectedId === c.id) d.classList.add("selected");
    d.addEventListener("click", ()=>{
      state.selectedId = c.id;
      renderSelected();
      // add selection outline
      renderField();
    });
    farm.appendChild(d);
  });
}

function renderSelected(){
  const box = document.getElementById("selectedBox");
  const cow = state.cows.find(x=>x.id===state.selectedId);
  if(!cow){
    box.classList.add("empty");
    box.innerHTML = "Tap a cow on the field to view details.";
    return;
  }
  box.classList.remove("empty");
  box.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
      <div class="cow-sprite cow-f${cow.frame}" style="position:static;transform:none;"></div>
      <div>
        <div style="font-weight:800">${cow.name}</div>
        <small>Pos: ${cow.x.toFixed(1)}%, ${cow.y.toFixed(1)}%</small>
      </div>
    </div>
    <div class="row"><span>Hunger</span><span>${fmt(cow.hunger)}%</span></div>
    <div class="bar"><div class="fill" style="width:${cow.hunger}%"></div></div>
    <div class="row"><span>Happiness</span><span>${fmt(cow.happiness)}%</span></div>
    <div class="bar"><div class="fill" style="width:${cow.happiness}%"></div></div>
    <div class="row"><span>Milk Progress</span><span>${fmt(cow.milkProgress)}%</span></div>
    <div class="bar"><div class="fill" style="width:${cow.milkProgress}%"></div></div>
  `;
}

function render(){
  renderUI();
  renderField();
  renderSelected();
  renderClock();
}

/* —— Modal helpers —— */
function openHowTo(){ el("howtoOverlay").hidden = false; }
function closeHowTo(){ el("howtoOverlay").hidden = true; }

/* —— Init —— */
function init(){
  load(); render();

  // Buttons
  el("buyCow").onclick = buyCow;
  el("buyFeed").onclick = buyFeed;
  el("feedAll").onclick = feedAll;
  el("waterAll").onclick = waterAll;
  el("milkAll").onclick = milkAll;
  el("sellMilk").onclick = sellMilk;
  el("upgradeBarn").onclick = upgradeBarn;
  el("reset").onclick = resetGame;

  // Modal
  el("howToBtn").onclick = openHowTo;
  el("closeHowTo").onclick = closeHowTo;
  el("gotIt").onclick = closeHowTo;
  el("howtoOverlay").addEventListener("click",(e)=>{ if(e.target.id==="howtoOverlay") closeHowTo(); });

  // Day clock
  setInterval(tickSecond, 1000);

  // Movement + animation
  setInterval(moveAndAnimateTick, MOVE_INTERVAL_MS);

  // First-time hint
  if(!localStorage.getItem("lamumu-cow-farm-pixel:firstlog")){
    log("Welcome! Tap Buy Cow, then keep her fed & watered to produce milk.", "good");
    localStorage.setItem("lamumu-cow-farm-pixel:firstlog","1");
    // auto-open how-to on first load
    openHowTo();
  }
}

document.addEventListener("DOMContentLoaded", init);
