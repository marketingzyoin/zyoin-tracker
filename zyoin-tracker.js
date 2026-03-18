// ============================================================
// ZYOIN VISITOR TRACKER v5.1
// Paste into Webflow: Site Settings → Custom Code → Head
//
// ⚠ REPLACE BOTH URLS BEFORE PASTING:
//   Line 8:  PASTE_YOUR_APPS_SCRIPT_URL_HERE
//   Line 9:  PASTE_YOUR_SLACK_WEBHOOK_URL_HERE
// ============================================================
(function(){

// URLs are set in Webflow Head Code via window.ZYOIN_CONFIG — not stored here
var SHEETS = (window.ZYOIN_CONFIG && window.ZYOIN_CONFIG.sheets) || '';
var SLACK  = (window.ZYOIN_CONFIG && window.ZYOIN_CONFIG.slack)  || '';
// Enrichment API keys — safe to store here (read-only, public-facing keys)
var HUNTER     = (window.ZYOIN_CONFIG && window.ZYOIN_CONFIG.hunter)     || '';
var ABSTRACT   = (window.ZYOIN_CONFIG && window.ZYOIN_CONFIG.abstract)   || '';
var ABSTRACTIP = (window.ZYOIN_CONFIG && window.ZYOIN_CONFIG.abstractip) || '';
var TECHCHECK  = (window.ZYOIN_CONFIG && window.ZYOIN_CONFIG.techcheck)  || '';

// ── BLOCKED IPs ──────────────────────────────────────────────
// Add your office/team IPs here — tracker will silently exit for these.
// To find your IP: visit https://ipinfo.io and copy the IP shown.
var BLOCKED_IPS = [
  '157.20.14.76',   // replace with your actual office IP
  // '103.x.x.x', // add more IPs as needed
];

// ── BLOCKED IPs ──────────────────────────────────────────────
// Add your office/team IPs here — tracker will silently exit for these.
// To find your IP: visit https://ipinfo.io and copy the IP shown.
var BLOCKED_IPS = [
  '157.20.14.76',   // replace with your actual office IP
  // '103.x.x.x', // add more IPs as needed
];

// ── TRACKED PAGES ────────────────────────────────────────────
var TIER1 = ['/permanent-hiring','/leadership-hiring','/global-hiring','/contact-us','/hire-talent'];
var TIER2 = ['/rpo','/contract-hiring','/managed-recruitment-service','/talent-intelligence','/hire-meetups'];
var TIER3 = ['/payroll-processing','/hr-outsourcing','/about-us'];

// ── SCORING THRESHOLDS ───────────────────────────────────────
var MIN_SCORE = {1:10, 2:40, 3:60};
var MIN_WAIT  = {1:8000,  2:15000, 3:25000};  // ms before first auto-send attempt
var MAX_WAIT  = {1:20000, 2:40000, 3:60000};  // ms before forced send

// ── LISTS ────────────────────────────────────────────────────
var RESIDENTIAL = ['airtel','jio','bsnl','vodafone',' vi ','idea','hathway',
  'act fibernet','you broadband','tikona','comcast','spectrum','verizon','gtpl'];
var JOB_PAGES = ['/careers','/jobs','/apply','/job-openings','/current-openings',
  '/work-with-us','/join-us','/vacancies'];
var JOB_REFS  = ['naukri.com','indeed.com','linkedin.com/jobs','shine.com','monster.com',
  'glassdoor.com','foundit.in','freshersworld.com','internshala.com','iimjobs.com'];
var JOB_UTMS  = ['job','career','apply','hiring','vacancy','fresher','placement'];
var FREE_MAIL = ['gmail.com','yahoo.com','yahoo.in','yahoo.co.in','hotmail.com',
  'outlook.com','live.com','rediffmail.com','icloud.com','protonmail.com','aol.com','ymail.com'];

// ── STATE ────────────────────────────────────────────────────
var D = {
  company:'', city:'', country:'', network:'Unknown',
  linkedin:'', website:'', logo:'', residential:false, isp:'',
  name:'', email:'', phone:'', coForm:'',
  time:0, scroll:0, cta:false, form:false,
  page:'', pages:[], ref:'', utm:'',
  returning:false, visits:1,
  score:0, quality:'',
  tier:1, sent:false, enrichedDomain:'', companyVerified:false, blocked:false,
  // Device & identity
  visitorId:'', timezone:'', screenW:0, screenH:0, lang:'',
};

// ── STORAGE ──────────────────────────────────────────────────
function get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
function set(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }

// ── VISITOR FINGERPRINT ──────────────────────────────────────
// Stable ID built from device signals — persists across sessions
// Lets you link multiple visits from the same person in the sheet
function getVisitorId(){
  var stored = get('zyoin_vid');
  if(stored) return stored;
  var raw = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    Intl.DateTimeFormat().resolvedOptions().timeZone
  ].join('|');
  // Simple hash → base64 → 16 chars
  var id = btoa(raw).replace(/[^a-zA-Z0-9]/g,'').substring(0,16);
  set('zyoin_vid', id);
  return id;
}

// ── HELPERS ──────────────────────────────────────────────────
function getTier(){
  var p = window.location.pathname.toLowerCase().replace(/\/$/,'');
  if(TIER1.some(function(x){ return p.indexOf(x)>-1; })) return 1;
  if(TIER2.some(function(x){ return p.indexOf(x)>-1; })) return 2;
  if(TIER3.some(function(x){ return p.indexOf(x)>-1; })) return 3;
  return 0;
}
function isJobSeeker(){
  var p = window.location.pathname.toLowerCase();
  var r = (document.referrer||'').toLowerCase();
  var u = window.location.search.toLowerCase();
  if(get('zyoin_js')==='1') return true;
  if(JOB_PAGES.some(function(x){ return p.indexOf(x)>-1; })) return true;
  if(JOB_REFS.some(function(x){  return r.indexOf(x)>-1; })) return true;
  if(JOB_UTMS.some(function(x){  return u.indexOf(x)>-1; })) return true;
  return false;
}
function isWorkEmail(e){
  if(!e || e.indexOf('@')<0) return false;
  var d = e.split('@')[1].toLowerCase();
  return !FREE_MAIL.some(function(f){ return d===f; });
}
function hasSubmitted(){ return get('zyoin_sub')==='1'; }
function markSubmitted(){
  set('zyoin_sub','1');
  if(D.name)  set('zyoin_name',  D.name);
  if(D.email) set('zyoin_email', D.email);
  if(D.phone) set('zyoin_phone', D.phone);
}

// ── EMAIL-DOMAIN ENRICHMENT ─────────────────────────────────
// Called whenever a work email is captured (form, popup, or blur capture).
// Extracts domain → Clearbit → real name + website + logo
//                → Brandfetch → real LinkedIn URL
// This is the most reliable way to get company data without asking for it.
function enrichFromEmail(email){
  if(!email || email.indexOf('@') < 0) return Promise.resolve();
  var domain = email.split('@')[1].toLowerCase();
  if(FREE_MAIL.some(function(f){ return domain === f; })){
    console.log('[Zyoin] free email domain — skipping enrichment, not a work email');
    return Promise.resolve();
  }
  if(D.enrichedDomain === domain) return Promise.resolve();
  D.enrichedDomain = domain;
  console.log('[Zyoin] enriching from domain:', domain);

  // ── Hunter Company Enrichment (primary — requires API key) ──
  if(HUNTER){
    console.log('[Zyoin] trying Hunter for:', domain);
    return fetch('https://api.hunter.io/v2/companies/find?domain=' + encodeURIComponent(domain) + '&api_key=' + HUNTER)
      .then(function(r){ return r.json(); })
      .then(function(res){
        console.log('[Zyoin] Hunter response:', JSON.stringify(res).slice(0,200));
        var co = res.data;
        if(!co || !co.name){
          console.log('[Zyoin] Hunter: no data → trying Clearbit');
          return enrichFallback(domain);
        }
        if(co.name && !D.coForm){ D.company = co.name; D.companyVerified = true; }
        if(co.website || co.domain){
          D.website = co.website || ('https://' + co.domain);
        }
        if(co.linkedin && co.linkedin.handle){
          var handle = co.linkedin.handle.replace(/^\/?(company\/)?/,'');
          D.linkedin = 'https://www.linkedin.com/company/' + handle;
        } else if(co.linkedin && typeof co.linkedin === 'string' && co.linkedin.indexOf('linkedin') > -1){
          D.linkedin = co.linkedin.indexOf('http') === 0 ? co.linkedin : 'https://' + co.linkedin;
        }
        var logoD = co.domain || domain;
        D.logo = 'https://logo.clearbit.com/' + logoD;
        console.log('[Zyoin] ✅ Hunter success — company:', D.company, '| linkedin:', D.linkedin, '| website:', D.website);
      })
      .catch(function(err){
        console.log('[Zyoin] ❌ Hunter failed:', err.message || err);
        return enrichFallback(domain);
      });
  }

  // ── No Hunter key — fall back to Clearbit + Brandfetch ──────
  return enrichFallback(domain);
}

// ── ENRICHMENT WATERFALL ────────────────────────────────────
// Tries each source in order until company name is found.
// Clearbit (free) → AbstractAPI → TechnologyChecker → Brandfetch → slug
// Stops as soon as company + linkedin + website are all found
function isEnriched(){
  return !!(D.company && D.companyVerified && D.linkedin && D.website);
}
function enrichFallback(domain){
  if(isEnriched()) return Promise.resolve();
  // Step 1: Clearbit autocomplete (free, no key)
  console.log('[Zyoin] trying Clearbit for:', domain);
  return fetch('https://autocomplete.clearbit.com/v1/companies/suggest?query=' + encodeURIComponent(domain))
    .then(function(r){ return r.json(); })
    .then(function(data){
      var co = null;
      if(data && data.length){
        for(var i=0; i<data.length; i++){
          if(data[i].domain && data[i].domain.toLowerCase() === domain){ co=data[i]; break; }
        }
        if(!co) co = data[0];
      }
      if(co && co.name){
        if(!D.coForm){ D.company = co.name; D.companyVerified = true; }
        if(co.domain){
          D.website = 'https://' + co.domain;
          D.logo    = 'https://logo.clearbit.com/' + co.domain;
        }
        console.log('[Zyoin] ✅ Clearbit success — company:', D.company, '| website:', D.website);
        return fetchLinkedIn(co.domain || domain, D.company);
      }
      // Already have everything from Clearbit — stop here
      if(isEnriched()) return;
      // Still missing LinkedIn or other fields — try next source
      if(ABSTRACT) return enrichAbstract(domain);
      if(TECHCHECK) return enrichTechCheck(domain);
      return fetchLinkedIn(domain, D.company);
    })
    .catch(function(){
      if(ABSTRACT) return enrichAbstract(domain);
      if(TECHCHECK) return enrichTechCheck(domain);
      return fetchLinkedIn(domain, D.company);
    });
}

// AbstractAPI — only called if Clearbit didn't get everything
function enrichAbstract(domain){
  if(isEnriched()) return Promise.resolve();
  console.log('[Zyoin] trying AbstractAPI for:', domain);
  return fetch('https://companyenrichment.abstractapi.com/v1/?api_key=' + ABSTRACT + '&domain=' + encodeURIComponent(domain))
    .then(function(r){ return r.json(); })
    .then(function(co){
      console.log('[Zyoin] AbstractAPI response:', JSON.stringify(co).slice(0,200));
      if(co && co.name){
        console.log('[Zyoin] ✅ AbstractAPI success — company:', co.name);
        if(!D.coForm){ D.company = co.name; D.companyVerified = true; }
        if(co.domain) D.website = 'https://' + co.domain;
        if(co.linkedin_url) D.linkedin = co.linkedin_url.indexOf('http') === 0 ? co.linkedin_url : 'https://' + co.linkedin_url;
        D.logo = 'https://logo.clearbit.com/' + domain;
        console.log('[Zyoin] AbstractAPI:', D.company, D.linkedin);
        if(!D.linkedin) return fetchLinkedIn(domain, D.company);
      } else {
        if(TECHCHECK) return enrichTechCheck(domain);
        return fetchLinkedIn(domain, D.company);
      }
    })
    .catch(function(){
      if(TECHCHECK) return enrichTechCheck(domain);
      return fetchLinkedIn(domain, D.company);
    });
}

// TechnologyChecker — only called if previous sources didn't complete
function enrichTechCheck(domain){
  if(isEnriched()) return Promise.resolve();
  console.log('[Zyoin] trying TechnologyChecker for:', domain);
  return fetch('https://api.technologychecker.io/v1/company?domain=' + encodeURIComponent(domain), {
    headers: { 'Authorization': 'Bearer ' + TECHCHECK }
  })
    .then(function(r){ return r.json(); })
    .then(function(res){
      console.log('[Zyoin] TechCheck response:', JSON.stringify(res).slice(0,200));
      var co = Array.isArray(res) ? res[0] : res;
      if(co && co.name){
        console.log('[Zyoin] ✅ TechCheck success — company:', co.name);
        if(!D.coForm){ D.company = co.name; D.companyVerified = true; }
        if(co.website) D.website = co.website.indexOf('http') === 0 ? co.website : 'https://' + co.website;
        if(co.linkedin_url) D.linkedin = co.linkedin_url.indexOf('http') === 0 ? co.linkedin_url : 'https://' + co.linkedin_url;
        D.logo = 'https://logo.clearbit.com/' + domain;
        console.log('[Zyoin] TechCheck:', D.company, D.linkedin);
        if(!D.linkedin) return fetchLinkedIn(domain, D.company);
      } else {
        return fetchLinkedIn(domain, D.company);
      }
    })
    .catch(function(){ return fetchLinkedIn(domain, D.company); });
}

// ── COMPANY ENRICHMENT ──────────────────────────────────────
// Step 1 — Clearbit autocomplete: real name, domain, logo (no key, instant)
// Step 2 — Brandfetch: real LinkedIn URL using domain (no key, free tier)
function enrichCompany(name){
  if(!name || name.length < 2) return;
  var q = encodeURIComponent(name.trim());

  fetch('https://autocomplete.clearbit.com/v1/companies/suggest?query=' + q)
    .then(function(r){ return r.json(); })
    .then(function(data){
      if(!data || !data.length) return;
      var co = data[0];

      // ── Real name ───────────────────────────────────────────
      if(co.name) D.company = co.name;

      // ── Real website ────────────────────────────────────────
      if(co.domain){
        D.website = 'https://' + co.domain;
        D.logo    = 'https://logo.clearbit.com/' + co.domain;
        // Step 2: use domain to get real LinkedIn via Brandfetch
        fetchLinkedIn(co.domain, co.name);
      }

      console.log('[Zyoin] Clearbit:', D.company, D.website);
    })
    .catch(function(){});
}

// Fetch real LinkedIn company URL via Brandfetch (free, no key required)
function fetchLinkedIn(domain, companyName){
  // Brandfetch requires registration — use slug fallback directly
  fallbackLinkedIn(companyName || D.company);
  return Promise.resolve();
}

// Last resort: build slug from company name (better than nothing)
function fallbackLinkedIn(name){
  if(!name) return;
  var slug = name.toLowerCase()
    .replace(/\s+(pvt\.?|ltd\.?|limited|inc\.?|llc|private|public|technologies|solutions|services|group|india|global)\.?\s*/gi,' ')
    .trim()
    .replace(/[^a-z0-9 ]/g,'')
    .replace(/\s+/g,'-')
    .replace(/-+/g,'-');
  D.linkedin = 'https://www.linkedin.com/company/' + slug;
  console.log('[Zyoin] LinkedIn (slug fallback):', D.linkedin);
}

// ── ABSTRACT IP INTELLIGENCE ─────────────────────────────────
// Uses AbstractAPI IP Intelligence to get better company data from IP
// especially useful for visitors who never fill the form
function enrichFromIP(ip){
  if(!ip || !ABSTRACTIP) return;
  fetch('https://ipgeolocation.abstractapi.com/v1/?api_key=' + ABSTRACTIP + '&ip_address=' + ip)
    .then(function(r){ return r.json(); })
    .then(function(d){
      // Only use if we got a real org/company (not residential)
      var org = (d.connection && d.connection.organization_name) || '';
      var isp = (d.connection && d.connection.isp_name) || '';
      var name = org || isp || '';
      if(!name) return;
      var chk = name.toLowerCase();
      var res = RESIDENTIAL.some(function(s){ return chk.indexOf(s) > -1; });
      if(res) return; // skip residential ISPs
      // AbstractAPI gives better org names than ipinfo for many Indian companies
      if(!D.coForm && !D.companyVerified){
        D.company = name;
        D.isp     = name;
        enrichCompany(name); // try Clearbit to clean up the name
      }
      // Better city/country if we didn't get it from ipinfo
      if(!D.city    && d.city)    D.city    = d.city;
      if(!D.country && d.country) D.country = d.country;
      console.log('[Zyoin] AbstractIP:', name, D.city, D.country);
    })
    .catch(function(){});
}

// ── IP LOOKUP ────────────────────────────────────────────────
// Primary: ipinfo.io (reliable, no CORS issues)
// Fallback: Abstract API (free, no key needed, CORS-friendly)
// ip-api.com removed — returns 403 Forbidden from browser requests
function getIP(){
  function checkBlocked(ip){
    if(BLOCKED_IPS.indexOf(ip) > -1){
      console.log('[Zyoin] blocked IP — tracking disabled');
      D.blocked = true;
      return true;
    }
    return false;
  }

  function apply(org, city, country){
    var raw = (org||'').replace(/^AS\d+\s*/,'').trim();
    var chk = raw.toLowerCase();
    var res = RESIDENTIAL.some(function(s){ return chk.indexOf(s)>-1; });
    D.city        = city    || D.city    || '';
    D.country     = country || D.country || '';
    D.residential = res;
    D.network     = res ? 'Residential / WFH' : (raw ? 'Corporate Network' : 'Unknown');
    D.isp         = raw; // always store raw ISP name
    // Use org name as company baseline — better than blank.
    // Will be upgraded to real company name if visitor fills work email.
    if(raw && !res){
      D.company = raw;
      // Try Clearbit to clean up the ISP org name into a real company
      enrichCompany(raw);
    }
  }

  return fetch('https://ipinfo.io/json')
    .then(function(r){ return r.json(); })
    .then(function(d){
      if(checkBlocked(d.ip)) return Promise.reject('blocked');
      apply(d.org, d.city, d.country);
    })
    .catch(function(){
      // Fallback: ipapi.co — free, CORS-friendly, no key required
      return fetch('https://ipapi.co/json/')
        .then(function(r){ return r.json(); })
        .then(function(d){
          if(checkBlocked(d.ip)) return Promise.reject('blocked');
          apply(d.org, d.city, d.country_name);
        })
        .catch(function(){ console.log('[Zyoin] IP lookup failed'); });
    });
}

// ── SESSION ──────────────────────────────────────────────────
function initSession(){
  var q   = new URLSearchParams(window.location.search);
  D.utm   = q.get('utm_source') || '';
  D.ref   = document.referrer  || 'Direct';
  D.page  = window.location.pathname;
  var pg  = JSON.parse(get('zyoin_pages')||'[]');
  if(pg.indexOf(D.page) < 0) pg.push(D.page);
  set('zyoin_pages', JSON.stringify(pg));
  D.pages = pg;
  var cnt = parseInt(get('zyoin_visits')||'0') + 1;
  set('zyoin_visits', String(cnt));
  D.visits    = cnt;
  D.returning = cnt > 1;
  // Recall details from previous visits
  D.name  = get('zyoin_name')  || '';
  D.email = get('zyoin_email') || '';
  D.phone = get('zyoin_phone') || '';
  // Device & identity signals
  D.visitorId = getVisitorId();
  D.timezone  = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  D.screenW   = screen.width  || 0;
  D.screenH   = screen.height || 0;
  D.lang      = navigator.language || '';
}

// ── BEHAVIOUR ────────────────────────────────────────────────
function initBehaviour(){
  // Store t0 in localStorage so timer starts at real page load,
  // not delayed by IP lookup or setTimeout
  var stored = parseInt(get('zyoin_t0')||'0');
  var now    = Date.now();
  var t0     = (stored && now - stored < 3600000) ? stored : now;
  if(!stored || now - stored >= 3600000) set('zyoin_t0', String(now));

  window.addEventListener('scroll', function(){
    var h = document.body.scrollHeight - window.innerHeight;
    if(h > 0) D.scroll = Math.max(D.scroll, Math.round(window.scrollY / h * 100));
  }, {passive:true});
  setInterval(function(){ D.time = Math.round((Date.now() - t0) / 1000); }, 1000);
}

// ── FORM CAPTURE ─────────────────────────────────────────────
function initCapture(){
  // Silently capture data as visitor types into any form on the page
  document.addEventListener('blur', function(e){
    var el  = e.target;
    if(!/INPUT|TEXTAREA/.test(el.tagName)) return;
    var fn  = ((el.name||'') + (el.placeholder||'') + (el.id||'')).toLowerCase();
    var val = (el.value||'').trim();
    if(!val) return;
    var changed = false;
    if(el.type==='email' || fn.indexOf('email')>-1){
      if(val.indexOf('@')>-1 && val !== D.email){
        D.email = val;
        // Wait for enrichment then send — so company/linkedin/website are ready
        enrichFromEmail(val).then(function(){ sendUpdate(); });
        changed = false; // handled above, don't double-send below
      }
    }
    if(fn.indexOf('name')>-1 && fn.indexOf('company')<0 && fn.indexOf('last')<0){
      if(val !== D.name){ D.name = val; changed = true; }
    }
    if(el.type==='tel' || fn.indexOf('phone')>-1 || fn.indexOf('mobile')>-1){
      if(val !== D.phone){ D.phone = val; changed = true; }
    }
    if(fn.indexOf('company')>-1 || fn.indexOf('organisation')>-1){
      if(val !== D.coForm){
        D.coForm=val; D.company=val; D.companyVerified=true; changed=true;
        enrichCompany(val);
      }
    }
    // Send update immediately on every field capture — upserts existing row
    if(changed) sendUpdate();
  }, true);

  // Track CTA clicks
  document.addEventListener('click', function(e){
    var el = e.target.closest && e.target.closest('a,button');
    if(!el) return;
    var t = (el.innerText||'').toLowerCase();
    ['contact','hire','get started','know more','talk to us','book','schedule','enquire']
      .forEach(function(w){ if(t.indexOf(w)>-1) D.cta=true; });
  });

  // Native Webflow form submit
  document.addEventListener('submit', function(){
    D.form = true;
    markSubmitted();
    if(isWorkEmail(D.email)){
      // Wait for enrichment to complete so company/linkedin/website are populated
      enrichFromEmail(D.email).then(function(){ sendData(D.tier, true); });
    }
  }, true);
}

// ── SCORING ──────────────────────────────────────────────────
function calcScore(tier){
  var s = 0;
  if(tier===1)      s += 35;
  else if(tier===2) s += 20;
  else              s += 5;
  if(D.residential)        s -= 20;  // WFH/home ISP penalty
  if(D.email)              s += 40;
  if(D.name)               s += 15;
  if(D.phone)              s += 15;
  if(D.form)               s += 35;
  if(D.cta)                s += 25;
  if(D.time > 60)          s += 10;
  if(D.time > 180)         s += 10;
  if(D.scroll > 50)        s += 8;
  if(D.scroll > 80)        s += 8;
  if(D.returning)          s += 20;
  if(D.visits >= 3)        s += 15;
  if(D.pages.length >= 3)  s += 12;
  if(D.utm)                s += 8;
  D.score   = s;
  D.quality = s>=80 ? '🔥 Hot Lead' : s>=50 ? '♨️ Warm Lead' : s>=30 ? '❄️ Cold Lead' : '👻 Lurker';
  return s;
}

// ── PAYLOAD BUILDER ──────────────────────────────────────────
function buildPayload(t, fromForm, isUpdate){
  var s = calcScore(t);
  return {
    visitDate:       (function(){
      var d = new Date();
      var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
    })(),
    visitDay:        ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()],
    name:            D.name,
    email:           D.email,
    phone:           D.phone,
    company:         D.coForm || D.company,
    linkedinUrl:     D.linkedin,
    websiteUrl:      D.website,
    logoUrl:         D.logo,
    isp:             D.isp || '',
    city:            D.city,
    country:         D.country,
    networkType:     D.network,
    currentPage:     D.page,
    pageTier:        'Tier ' + t,
    pagesVisited:    D.pages.join(' → '),
    referrer:        D.ref,
    utmSource:       D.utm,
    timeOnPage:      D.time + 's',
    scrollDepth:     D.scroll + '%',
    clickedCTA:      D.cta,
    filledForm:      D.form || fromForm,
    returnVisitor:   D.returning,
    visitCount:      D.visits,
    engagementScore: s,
    leadQuality:     D.quality,
    source:          'Zyoin Tracker v5.2',
    slackUrl:        SLACK,
    visitorId:       D.visitorId,
    timezone:        D.timezone,
    screenSize:      D.screenW + 'x' + D.screenH,
    language:        D.lang,
    isUpdate:        isUpdate, // tells Apps Script to upsert not append
  };
}

// ── SEND UPDATE (upsert — updates existing row for this visitor) ──
// Called on every blur capture. Apps Script finds the row by visitorId
// and updates it in place. No duplicate rows ever created.
function sendUpdate(){
  if(!D.name && !D.email && !D.phone) return; // nothing worth sending yet
  // Sheet captures everyone — Slack filter handled in Apps Script
  var body = JSON.stringify(buildPayload(D.tier || 1, false, true));
  try{
    var x = new XMLHttpRequest();
    x.open('POST', SHEETS, true);
    x.setRequestHeader('Content-Type','text/plain;charset=UTF-8');
    x.onload = function(){ console.log('[Zyoin] update:', x.status); };
    x.send(body);
  }catch(e){}
}

// ── SEND ─────────────────────────────────────────────────────
function sendData(tier, fromForm){
  var t  = tier > 0 ? tier : 1;
  var s  = calcScore(t);
  var ms = MIN_SCORE[t] || 10;

  console.log('[Zyoin] send tier='+t+' score='+s+' min='+ms+' fromForm='+fromForm);
  if(D.blocked){ console.log('[Zyoin] blocked IP — data not sent'); return; }
  // Sheet captures everyone including free emails — Slack filters in Apps Script
  if(s < ms){ console.log('[Zyoin] score too low, skipping'); return; }
  if(!fromForm && D.sent){ console.log('[Zyoin] already sent, skipping'); return; }
  if(!fromForm) D.sent = true;

  var body = JSON.stringify(buildPayload(t, fromForm, false));;

  try {
    var x = new XMLHttpRequest();
    x.open('POST', SHEETS, true);
    x.setRequestHeader('Content-Type', 'text/plain;charset=UTF-8');
    x.onload  = function(){ console.log('[Zyoin] response:', x.status, x.responseText.slice(0,100)); };
    x.onerror = function(){ console.log('[Zyoin] XHR error — check Apps Script URL'); };
    x.send(body);
  } catch(e){
    try{ navigator.sendBeacon(SHEETS, new Blob([body], {type:'text/plain'})); }catch(e2){}
  }
}

// ── CSS ──────────────────────────────────────────────────────
function addCSS(){
  if(document.getElementById('zyoin-css')) return;
  var s = document.createElement('style');
  s.id  = 'zyoin-css';
  s.textContent =
    '@import url("https://fonts.googleapis.com/css2?family=Poppins:wght@600;700&family=Montserrat:wght@400;500;600&display=swap");' +
    '.z-ov{display:none;position:fixed;inset:0;background:rgba(0,0,0,.85);backdrop-filter:blur(8px);z-index:99998;align-items:center;justify-content:center}' +
    '.z-ov.on{display:flex;animation:zFd .2s ease}' +
    '.z-pop{background:#181818;border:1px solid #333;border-radius:20px;padding:32px 28px 26px;width:calc(100% - 32px);max-width:368px;position:relative;box-shadow:0 32px 80px rgba(0,0,0,.8);animation:zPp .28s cubic-bezier(.34,1.5,.64,1)}' +
    '.z-close{position:absolute;top:16px;right:18px;background:#222;border:1px solid #3a3a3a;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;color:#888;font-size:16px;cursor:pointer;transition:.15s;line-height:1;font-family:sans-serif}' +
    '.z-close:hover{background:#2e2e2e;color:#fff}' +
    '.z-badge{display:inline-flex;align-items:center;gap:7px;background:#1e1e1e;border:1px solid #333;border-radius:20px;padding:5px 13px;font-size:10.5px;color:#aaa;letter-spacing:.07em;margin-bottom:16px;font-family:Montserrat,sans-serif;font-weight:600;text-transform:uppercase}' +
    '.z-dot{width:6px;height:6px;background:#4ade80;border-radius:50%;box-shadow:0 0 8px #4ade80;animation:zPls 2s infinite;display:inline-block;flex-shrink:0}' +
    '.z-pop h3{font-family:Poppins,sans-serif;font-size:20px;font-weight:700;color:#fff;line-height:1.28;margin:0 0 10px}' +
    '.z-sub{font-family:Montserrat,sans-serif;font-size:12.5px;color:#999;margin:0 0 22px;line-height:1.65}' +
    '.z-field{width:100%;background:#111;border:1px solid #333;border-radius:9px;padding:11px 14px;font-family:Montserrat,sans-serif;font-size:12.5px;color:#e8e8e8;outline:none;transition:.18s;margin-bottom:10px;display:block;box-sizing:border-box}' +
    '.z-field::placeholder{color:#555}' +
    '.z-field:focus{border-color:#555;box-shadow:0 0 0 3px rgba(255,255,255,.05)}' +
    '.z-field.err{border-color:#e74c3c!important}' +
    '.z-cta{width:100%;background:#fff;color:#000;border:none;border-radius:9px;padding:12px;font-family:Poppins,sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:.15s;margin-top:4px;display:block}' +
    '.z-cta:hover{background:#e8e8e8}' +
    '.z-later{display:block;text-align:center;font-size:11.5px;color:#555;cursor:pointer;margin-top:14px;background:none;border:none;width:100%;font-family:Montserrat,sans-serif;padding:0}' +
    '.z-later:hover{color:#aaa}' +
    '.z-hint{font-family:Montserrat,sans-serif;font-size:11px;color:#555;margin:0 0 14px;text-align:center}' +
    '.z-thanks{text-align:center;padding:12px 0 6px}' +
    '.z-thanks-ic{font-size:28px;margin-bottom:14px}' +
    '.z-thanks h4{font-family:Poppins,sans-serif;font-size:17px;font-weight:700;color:#fff;margin:0 0 8px}' +
    '.z-thanks p{font-family:Montserrat,sans-serif;font-size:12.5px;color:#888;margin:0}' +
    '.z-slide{display:none;position:fixed;bottom:24px;right:24px;width:296px;background:#181818;border:1px solid #333;border-radius:16px;padding:20px;z-index:99997;box-shadow:0 20px 60px rgba(0,0,0,.7)}' +
    '.z-slide.on{display:block;animation:zSl .3s cubic-bezier(.34,1.4,.64,1)}' +
    '.z-slide-close{position:absolute;top:14px;right:16px;background:#222;border:1px solid #333;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;color:#777;font-size:14px;cursor:pointer;transition:.15s;font-family:sans-serif}' +
    '.z-slide-close:hover{background:#2e2e2e;color:#fff}' +
    '.z-colist{position:absolute;top:100%;left:0;right:0;background:#1a1a1a;border:1px solid #333;border-top:none;border-radius:0 0 9px 9px;z-index:9;max-height:180px;overflow-y:auto;display:none}' +
    '.z-colist.open{display:block}' +
    '.z-coit{display:flex;align-items:center;gap:10px;padding:9px 12px;cursor:pointer;border-bottom:1px solid #222;transition:.12s}' +
    '.z-coit:last-child{border-bottom:none}' +
    '.z-coit:hover{background:#252525}' +
    '.z-coit-logo{width:20px;height:20px;border-radius:4px;object-fit:contain;background:#111;flex-shrink:0}' +
    '.z-coit-name{font-family:Montserrat,sans-serif;font-size:12px;color:#ddd}' +
    '.z-coit-domain{font-family:Montserrat,sans-serif;font-size:10.5px;color:#555;margin-left:auto}' +
    '@keyframes zFd{from{opacity:0}to{opacity:1}}' +
    '@keyframes zPp{from{opacity:0;transform:scale(.93) translateY(12px)}to{opacity:1;transform:none}}' +
    '@keyframes zSl{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}' +
    '@keyframes zPls{0%,100%{opacity:1}50%{opacity:.3}}';
  document.head.appendChild(s);
}

// ── POPUP ────────────────────────────────────────────────────
function buildPopup(){
  addCSS();
  var ov    = document.createElement('div');
  ov.className = 'z-ov';
  var inner = document.createElement('div');
  inner.className = 'z-pop';
  inner.innerHTML =
    '<button class="z-close">&times;</button>' +
    '<div class="z-form">' +
      '<div class="z-badge"><span class="z-dot"></span>Free Consultation</div>' +
      '<h3>Looking to hire<br/>exceptional talent?</h3>' +
      '<p class="z-sub">AI-augmented recruitment built for speed and precision. Drop your details — a Zyoin expert will reach out within 24&nbsp;hours.</p>' +
      '<p class="z-hint">No spam. A real person will reach out.</p>' +
      '<input class="z-field" data-zf="email" type="email" placeholder="Your work email"/>' +
      '<div class="z-extra" style="display:none">' +
        '<input class="z-field" data-zf="name"  type="text" placeholder="Your name"/>' +
        '<input class="z-field" data-zf="phone" type="tel"  placeholder="Phone (optional)"/>' +
      '</div>' +
      '<button class="z-cta">Get a Free Consultation &rarr;</button>' +
      '<button class="z-later">No thanks, I\'ll look around</button>' +
    '</div>' +
    '<div class="z-thanks" style="display:none">' +
      '<div class="z-thanks-ic">&#10022;</div>' +
      '<h4>We\'ll be in touch soon</h4>' +
      '<p>A Zyoin hiring expert will reach out within 24 hours.</p>' +
    '</div>';
  ov.appendChild(inner);
  document.body.appendChild(ov);

  var fEmail = inner.querySelector('[data-zf="email"]');
  var fExtra = inner.querySelector('.z-extra');
  var zForm  = inner.querySelector('.z-form');
  var zTy       = inner.querySelector('.z-thanks');

  // Headline stays generic until email enrichment confirms real company
  // Never personalise on load — IP org name is ISP, not actual company
  if(D.email) fEmail.value = D.email;

  // Email blur: enrich company + reveal name/phone fields
  fEmail.addEventListener('blur', function(){
    var em = fEmail.value.trim();
    if(em && em.indexOf('@') > 0){
      enrichFromEmail(em);
      // No headline personalisation — stays generic
      // Expand name + phone fields (progressive disclosure)
      if(fExtra.style.display === 'none'){
        fExtra.style.display = 'block';
        fExtra.style.animation = 'zFd .3s ease';
        var fN = inner.querySelector('[data-zf="name"]');
        var fP = inner.querySelector('[data-zf="phone"]');
        if(fN && D.name)  fN.value = D.name;
        if(fP && D.phone) fP.value = D.phone;
        if(fN) fN.focus();
      }
    }
  });

  function close(){ ov.classList.remove('on'); }
  ov.addEventListener('click', function(e){ if(e.target===ov) close(); });
  inner.querySelector('.z-close').addEventListener('click',  close);
  inner.querySelector('.z-later').addEventListener('click',  close);
  inner.querySelector('.z-cta').addEventListener('click', function(){
    var em = fEmail.value.trim();
    if(!em || em.indexOf('@') < 0){ fEmail.classList.add('err'); return; }
    fEmail.classList.remove('err');
    var fN = inner.querySelector('[data-zf="name"]');
    var fP = inner.querySelector('[data-zf="phone"]');
    D.name  = (fN ? fN.value.trim() : '') || D.name;
    D.email = em;
    D.phone = (fP ? fP.value.trim() : '') || D.phone;
    D.form  = true;
    enrichFromEmail(em);
    markSubmitted();
    if(isWorkEmail(em)){
      enrichFromEmail(em).then(function(){ sendData(D.tier, true); });
    }
    zForm.style.display = 'none';
    zTy.style.display   = 'block';
    setTimeout(close, 2800);
  });
  return ov;
}

// ── SLIDE-IN ─────────────────────────────────────────────────
function buildSlideIn(){
  var el = document.createElement('div');
  el.className = 'z-slide';
  el.innerHTML =
    '<button class="z-slide-close">&times;</button>' +
    '<div class="z-sform">' +
      '<div style="width:34px;height:34px;background:#222;border:1px solid #333;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;margin-bottom:12px">&#9889;</div>' +
      '<h4 style="font-family:Poppins,sans-serif;font-size:14px;font-weight:700;color:#fff;margin:0 0 6px;line-height:1.3">Hiring this quarter?</h4>' +
      '<p style="font-family:Montserrat,sans-serif;font-size:12px;color:#888;margin:0 0 14px;line-height:1.55">Drop your work email — a Zyoin expert will reach out within 24 hours.</p>' +
      '<input class="z-field" data-zf="email" type="email" placeholder="your@work.com" style="font-size:12px;padding:10px 12px;margin-bottom:8px"/>' +
      '<button class="z-cta" style="font-size:12px;padding:11px">Get a Free Consultation &rarr;</button>' +
    '</div>' +
    '<div class="z-sthanks z-thanks" style="display:none">' +
      '<div class="z-thanks-ic">&#10022;</div>' +
      '<h4>We\'ll be in touch soon!</h4>' +
      '<p>A Zyoin expert will reach out within 24 hours.</p>' +
    '</div>';
  document.body.appendChild(el);

  var sForm   = el.querySelector('.z-sform');
  var sThanks = el.querySelector('.z-sthanks');
  var sEmail  = el.querySelector('[data-zf="email"]');

  el.querySelector('.z-slide-close').addEventListener('click', function(){ el.classList.remove('on'); });
  el.querySelector('.z-cta').addEventListener('click', function(){
    var em = sEmail.value.trim();
    if(!em || em.indexOf('@') < 0){ sEmail.classList.add('err'); return; }
    D.email = em;
    D.form  = true;
    enrichFromEmail(em); // enrich company from email domain
    markSubmitted();
    if(isWorkEmail(em)){
      enrichFromEmail(em).then(function(){ sendData(D.tier, true); });
    }
    sForm.style.display   = 'none';
    sThanks.style.display = 'block';
    setTimeout(function(){ el.classList.remove('on'); }, 2500);
  });
  return el;
}

// ── MAIN ─────────────────────────────────────────────────────
window.addEventListener('load', function(){
  setTimeout(function(){

    var tier = getTier();
    var isJS = isJobSeeker();
    if(isJS) set('zyoin_js','1');

    D.tier = tier > 0 ? tier : 1;

    initSession();
    initCapture();
    initBehaviour();

    getIP().then(function(){
      console.log('[Zyoin] ready — company='+D.company+' city='+D.city+' network='+D.network);

      // ── Popup on ALL pages (unless visitor already submitted) ──
      if(!hasSubmitted()){
        var pop = buildPopup();
        var sli = buildSlideIn();

        // Exit intent — desktop: mouse leaves top; mobile: fast scroll up
        var fired = false;
        var lastY = 0, lastT = 0;
        function firePopup(){
          if(!fired){ fired=true; pop.classList.add('on'); }
        }
        document.addEventListener('mouseleave', function(e){
          if(e.clientY < 50) firePopup();
        });
        // Mobile: detect fast upward scroll (user reaching for back button)
        window.addEventListener('scroll', function(){
          var y = window.scrollY;
          var t = Date.now();
          var speed = (lastY - y) / (t - lastT + 1) * 1000; // px/sec upward
          if(speed > 800 && y < 300) firePopup(); // fast scroll up near top
          lastY = y; lastT = t;
        }, {passive:true});

        // Slide-in after 25 seconds
        // Show slide-in sooner if high-intent (tier 1 or came via UTM/LinkedIn)
        var slideDelay = 25000;
        if(D.tier === 1) slideDelay = 15000;
        if(D.utm || (D.ref && D.ref.indexOf('linkedin') > -1)) slideDelay = 12000;
        setTimeout(function(){ sli.classList.add('on'); }, slideDelay);

        // Show popup sooner for UTM visitors (they have intent)
        if(D.utm || (D.ref && D.ref.indexOf('linkedin') > -1)){
          setTimeout(function(){ if(!fired){ fired=true; pop.classList.add('on'); } }, 8000);
        }
      }

      // ── Auto-tracking on tier pages (non job-seekers only) ────
      if(tier > 0 && !isJS){
        var elapsed = 0;
        var done    = false;
        var minW    = MIN_WAIT[tier];
        var maxW    = MAX_WAIT[tier];
        var minS    = MIN_SCORE[tier];

        var poll = setInterval(function(){
          elapsed += 5000;
          var s = calcScore(tier);
          console.log('[Zyoin] poll '+elapsed+'ms score='+s);
          if(!done && elapsed >= minW && s >= minS){
            done=true; clearInterval(poll); sendData(tier, false);
          } else if(!done && elapsed >= maxW){
            done=true; clearInterval(poll);
            if(s >= minS) sendData(tier, false);
          }
        }, 5000);

        window.addEventListener('beforeunload', function(){
          if(!done){ var s=calcScore(tier); if(s>=minS) sendData(tier,false); }
        });
      }

    });

  }, 1000);
});

})();
