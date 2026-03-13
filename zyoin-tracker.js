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

const p=document.createElement("div");

p.style.cssText="position:fixed;bottom:20px;right:20px;background:#111;color:#fff;padding:20px;width:300px;border-radius:10px;z-index:99999;font-family:sans-serif";

p.innerHTML=`<h3>Talk to Zyoin</h3>
<input id="zname" placeholder="Name" style="width:100%;margin:5px 0;padding:8px">
<input id="zemail" placeholder="Work Email" style="width:100%;margin:5px 0;padding:8px">
<input id="zphone" placeholder="Phone" style="width:100%;margin:5px 0;padding:8px">
<button id="zbtn" style="width:100%;padding:10px;margin-top:5px">Submit</button>`;

document.body.appendChild(p);

document.getElementById("zbtn").onclick=function(){

V.name=document.getElementById("zname").value;
V.email=document.getElementById("zemail").value;
V.phone=document.getElementById("zphone").value;

localStorage.setItem(CFG.submittedKey,true);

send();

p.innerHTML="Thanks! We'll contact you.";

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
