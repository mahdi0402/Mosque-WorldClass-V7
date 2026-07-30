const names={Fajr:"الفجر",Sunrise:"الشروق",Dhuhr:"الظهر",Asr:"العصر",Maghrib:"المغرب",Isha:"العشاء"};
const order=["Fajr","Sunrise","Dhuhr","Asr","Maghrib","Isha"];
let state=null;
const el=id=>document.getElementById(id);
function seconds(t){const [h,m]=t.split(":").map(Number);return h*3600+m*60}
function render(s){state=s;el("mosqueName").textContent=s.name;el("city").textContent=s.city;el("announcement").textContent=s.announcement;order.forEach(k=>{const n=el("time-"+k);if(n)n.textContent=s.timings[k];const iq=el("iq-"+k);if(iq&&s.iqamahOffsets?.[k]!=null)iq.textContent=`الإقامة بعد ${s.iqamahOffsets[k]} دقيقة`});updateNext()}
function updateClock(){const d=new Date();el("clock").textContent=d.toLocaleTimeString("ar-EG",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false});el("date").textContent=d.toLocaleDateString("ar-EG",{weekday:"long",year:"numeric",month:"long",day:"numeric"});el("hijri").textContent=new Intl.DateTimeFormat("ar-SA-u-ca-islamic",{day:"numeric",month:"long",year:"numeric"}).format(d)}
function updateNext(){if(!state)return;const d=new Date(),now=d.getHours()*3600+d.getMinutes()*60+d.getSeconds();let key=order.find(k=>seconds(state.timings[k])>now);let extra=0;if(!key){key="Fajr";extra=86400}const diff=seconds(state.timings[key])+extra-now;el("nextName").textContent=names[key];el("nextTime").textContent=state.timings[key];el("countdown").textContent=[Math.floor(diff/3600),Math.floor(diff%3600/60),diff%60].map(n=>String(n).padStart(2,"0")).join(":");document.querySelectorAll(".prayer").forEach(x=>x.classList.toggle("active",x.dataset.key===key));const pct=now/86400*100;if(el("dayProgress"))el("dayProgress").style.width=pct+"%";if(el("progressText"))el("progressText").textContent=Math.round(pct)+"%"}
fetch("/api/state").then(r=>r.json()).then(render).catch(console.error);
const socket=io();socket.on("stateUpdate",render);
updateClock();setInterval(()=>{updateClock();updateNext()},1000);
