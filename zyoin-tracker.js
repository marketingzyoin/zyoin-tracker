(function(){

/* =========================
CONFIG
========================= */

const CFG={
endpoint:"https://script.google.com/macros/s/AKfycbwM0xeynyrYW2v73ztBXBe5D3ld2ODpjOj00nULpbNB0yt1vIoBvD1H-yLXvIwNHY1a/exec",
visitorKey:"zyoin_vid",
pagesKey:"zyoin_pages",
submittedKey:"zyoin_submitted"
};

/* =========================
STATE
========================= */

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
email:null,
name:null,
phone:null
};

/* =========================
CSS FOR POPUP
========================= */

const css=`
#zyoinPopup{
position:fixed;
bottom:20px;
right:20px;
background:#111;
color:#fff;
padding:20px;
border-radius:10px;
width:300px;
font-family:sans-serif;
z-index:99999;
box-shadow:0 10px 30px rgba(0,0,0,0.4)
}

#zyoinPopup input{
width:100%;
margin:5px 0;
padding:8px;
border-radius:5px;
border:1px solid #444;
background:#222;
color:#fff
}

#zyoinPopup button{
margin-top:8px;
width:100%;
padding:10px;
border:none;
background:#fff;
color:#000;
border-radius:5px;
cursor:pointer
}

#zyoinClose{
position:absolute;
top:5px;
right:10px;
cursor:pointer;
color:#999
}
`;

function injectCSS(){
const s=document.createElement("style");
s.innerHTML=css;
document.head.appendChild(s);
}

/* =========================
VISITOR ID
========================= */

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

/* =========================
PAGE TRACKING
========================= */

function trackPages(){

let pages=JSON.parse(localStorage.getItem(CFG.pagesKey)||"[]");

pages.push(location.pathname);

localStorage.setItem(CFG.pagesKey,JSON.stringify(pages));

V.pages=pages;

}

/* =========================
SCROLL + TIME
========================= */

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

/* =========================
IP DETECTION
========================= */

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

/* =========================
ASN
========================= */

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

/* =========================
LINKEDIN
========================= */

function buildLinkedin(){

if(!V.company) return;

const slug=V.company
.toLowerCase()
.replace(/[^a-z0-9\s]/g,"")
.replace(/\s+/g,"-");

V.linkedin="https://linkedin.com/company/"+slug;

}

/* =========================
POPUP
========================= */

function showPopup(){

if(localStorage.getItem(CFG.submittedKey)==="true") return;

injectCSS();

const p=document.createElement("div");
p.id="zyoinPopup";

p.innerHTML=`
<div id="zyoinClose">✕</div>
<h3>Hiring this quarter?</h3>
<p>Talk to a Zyoin hiring expert.</p>

<input id="zyoinName" placeholder="Name">
<input id="zyoinEmail" placeholder="Work Email">
<input id="zyoinPhone" placeholder="Phone">

<button id="zyoinSubmit">Request Consultation</button>
`;

document.body.appendChild(p);

document.getElementById("zyoinClose").onclick=function(){
p.remove();
};

document.getElementById("zyoinSubmit").onclick=function(){

V.name=document.getElementById("zyoinName").value;
V.email=document.getElementById("zyoinEmail").value;
V.phone=document.getElementById("zyoinPhone").value;

localStorage.setItem(CFG.submittedKey,"true");

send(true);

p.innerHTML="<p>Thanks! Our team will contact you.</p>";

};

}

/* =========================
LEAD SCORE
========================= */

function score(){

let s=0;

if(V.scroll>50) s+=10;
if(V.time>60) s+=10;
if(V.pages.length>=3) s+=15;

if(location.pathname.includes("hiring")) s+=20;

return s;

}

/* =========================
PAYLOAD
========================= */

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
source:"Zyoin Tracker",
slackUrl:CFG.slackUrl
};

}

/* =========================
SEND
========================= */

function send(){

const p=payload();

if(navigator.sendBeacon){

navigator.sendBeacon(CFG.endpoint,JSON.stringify(p));

}else{

fetch(CFG.endpoint,{
method:"POST",
mode:"no-cors",
headers:{"Content-Type":"application/json"},
body:JSON.stringify(p)
});

}

}

/* =========================
INIT
========================= */

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
