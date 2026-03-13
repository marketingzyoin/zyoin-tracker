(function(){

const CFG={
endpoint:"https://script.google.com/macros/s/AKfycbwM0xeynyrYW2v73ztBXBe5D3ld2ODpjOj00nULpbNB0yt1vIoBvD1H-yLXvIwNHY1a/exec",
visitorKey:"zyoin_vid",
pagesKey:"zyoin_pages",
submittedKey:"zyoin_submitted"
};

let V={
visitorId:null,
ip:null,
company:null,
city:null,
country:null,
asn:null,
network:null,
linkedin:null,
pages:[],
scroll:0,
time:0,
name:null,
email:null,
phone:null
};

/* Visitor fingerprint */

function fingerprint(){
const raw=[
navigator.userAgent,
navigator.language,
screen.width,
screen.height,
Intl.DateTimeFormat().resolvedOptions().timeZone
].join("|");
return btoa(raw).substring(0,16);
}

function getVisitorId(){
let id=localStorage.getItem(CFG.visitorKey);
if(!id){
id=fingerprint();
localStorage.setItem(CFG.visitorKey,id);
}
return id;
}

/* Page tracking */

function trackPages(){
let pages=JSON.parse(localStorage.getItem(CFG.pagesKey)||"[]");
pages.push(location.pathname);
localStorage.setItem(CFG.pagesKey,JSON.stringify(pages));
V.pages=pages;
}

/* Behaviour */

function behaviour(){

const start=Date.now();

window.addEventListener("scroll",function(){

const h=document.body.scrollHeight-window.innerHeight;

if(h>0){
const p=Math.round(window.scrollY/h*100);
V.scroll=Math.max(V.scroll,p);
}

},{passive:true});

setInterval(function(){
V.time=Math.round((Date.now()-start)/1000);
},5000);

}

/* Company detection */

async function detectIP(){

try{

const r=await fetch("https://ip-api.com/json/?fields=status,org,isp,city,country,query");
const d=await r.json();

if(d.status!=="success") return;

V.ip=d.query;
V.city=d.city;
V.country=d.country;
V.network=d.isp;

if(d.org){
V.company=d.org.replace(/^AS\d+\s+/,"");
buildLinkedin();
}

}catch(e){}

}

async function detectASN(){

try{

const r=await fetch("https://ipinfo.io/json");
const d=await r.json();

V.asn=d.org;

if(!V.company && d.org){
V.company=d.org.replace(/^AS\d+\s+/,"");
buildLinkedin();
}

}catch(e){}

}

function buildLinkedin(){

if(!V.company) return;

const slug=V.company
.toLowerCase()
.replace(/[^a-z0-9\s]/g,"")
.replace(/\s+/g,"-");

V.linkedin="https://linkedin.com/company/"+slug;

}

/* Lead scoring */

function score(){

let s=0;

if(V.scroll>50) s+=10;
if(V.time>60) s+=10;
if(V.pages.length>=3) s+=15;

if(location.pathname.includes("hiring")) s+=20;

return s;

}

/* Popup */

function showPopup(){

if(localStorage.getItem(CFG.submittedKey)) return;

const css = `
#zyoinPopupOverlay{
position:fixed;
inset:0;
background:rgba(0,0,0,0.7);
backdrop-filter:blur(6px);
display:flex;
align-items:center;
justify-content:center;
z-index:999999;
font-family:Inter,system-ui,sans-serif;
}

#zyoinPopup{
background:#111;
color:#fff;
padding:30px;
border-radius:16px;
width:380px;
box-shadow:0 20px 60px rgba(0,0,0,0.5);
animation:popupFade .25s ease;
}

#zyoinPopup h3{
font-size:22px;
margin-bottom:8px;
}

#zyoinPopup p{
font-size:14px;
color:#aaa;
margin-bottom:18px;
line-height:1.5;
}

#zyoinPopup input{
width:100%;
background:#1b1b1b;
border:1px solid #333;
border-radius:8px;
padding:12px;
margin-bottom:10px;
color:#fff;
font-size:14px;
outline:none;
}

#zyoinPopup input::placeholder{
color:#777;
}

#zyoinPopup button{
width:100%;
background:#fff;
color:#000;
border:none;
border-radius:10px;
padding:12px;
font-weight:600;
font-size:14px;
cursor:pointer;
transition:all .2s;
}

#zyoinPopup button:hover{
background:#e8e8e8;
}

#zyoinClose{
position:absolute;
top:18px;
right:20px;
color:#888;
cursor:pointer;
font-size:18px;
}

@keyframes popupFade{
from{opacity:0;transform:scale(.92)}
to{opacity:1;transform:scale(1)}
}
`;

const style=document.createElement("style");
style.innerHTML=css;
document.head.appendChild(style);

const overlay=document.createElement("div");
overlay.id="zyoinPopupOverlay";

overlay.innerHTML=`
<div id="zyoinPopup">

<div id="zyoinClose">✕</div>

<h3>Looking to hire exceptional talent?</h3>

<p>AI-augmented recruitment built for speed and precision.  
Drop your details — a Zyoin expert will reach out within 24 hours.</p>

<input id="zname" placeholder="Your name">
<input id="zemail" placeholder="Work email">
<input id="zphone" placeholder="Company name">

<button id="zbtn">Get a Free Consultation →</button>

</div>
`;

document.body.appendChild(overlay);

document.getElementById("zyoinClose").onclick=function(){
overlay.remove();
};

document.getElementById("zbtn").onclick=function(){

V.name=document.getElementById("zname").value;
V.email=document.getElementById("zemail").value;
V.phone=document.getElementById("zphone").value;

localStorage.setItem(CFG.submittedKey,true);

send();

document.getElementById("zyoinPopup").innerHTML=
"<h3>Thank you</h3><p>Our team will reach out within 24 hours.</p>";

setTimeout(()=>{
overlay.remove();
},2500);

};

}

/* Payload */

function payload(){

return{
timestamp:new Date().toISOString(),
visitorId:V.visitorId,
name:V.name,
email:V.email,
phone:V.phone,
company:V.company,
city:V.city,
country:V.country,
networkType:V.network,
asn:V.asn,
linkedinUrl:V.linkedin,
pagesVisited:V.pages.join(" → "),
currentPage:location.pathname,
timeOnPage:V.time,
scrollDepth:V.scroll,
engagementScore:score(),
source:"Zyoin Tracker"
};

}

/* Send */

function send(){

navigator.sendBeacon(CFG.endpoint,JSON.stringify(payload()));

}

/* Init */

window.addEventListener("load",function(){

setTimeout(async function(){

V.visitorId=getVisitorId();

trackPages();
behaviour();

await detectIP();
await detectASN();

setTimeout(showPopup,45000);
setTimeout(send,60000);

},2000);

});

})();
