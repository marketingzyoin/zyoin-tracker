// ============================================================
// ZYOIN CHATBOT — FRONTEND v5
//
// FLOW:
// 1. Two tabs: "I'm Hiring" / "Looking for a Job"
// 2. Job seekers → warm message + redirect button to Contact Us
// 3. Hiring → service buttons + free chat → after 2-3 messages form appears
// 4. Form: Name, Company, Email, Phone (ALL mandatory) → free chat unlocks
//
// WEBFLOW FOOTER CODE:
//   <script>
//     window.ZYOIN_CONFIG = {
//       chatbot: "YOUR_APPS_SCRIPT_WEB_APP_URL",
//       contactUrl: "/contact"   // your contact us page path
//     };
//   </script>
//   <script src="https://cdn.jsdelivr.net/gh/marketingzyoin/zyoin-tracker@main/zyoin-chatbot.js" defer></script>
// ============================================================

(function () {
  'use strict';

  var PROXY      = (window.ZYOIN_CONFIG && window.ZYOIN_CONFIG.chatbot)    || '';
  var CONTACT_URL= (window.ZYOIN_CONFIG && window.ZYOIN_CONFIG.contactUrl) || '/contact-us';

  if (!PROXY) { console.warn('[Zara] No chatbot URL set'); return; }

  // ── PAGE SCRAPER (auto-adapts to website changes) ─────────────
  function getPageContext() {
    try {
      var clone = document.body.cloneNode(true);
      ['script','style','svg','noscript','#zara-win','#zara-btn','#zara-badge','#zara-pulse']
        .forEach(function (s) { clone.querySelectorAll(s).forEach(function (el) { el.remove(); }); });
      return (clone.innerText || clone.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 3000);
    } catch (e) { return ''; }
  }

  function buildSystem() {
    return (
      'You are Zara, Zyoin Group\'s AI hiring assistant. Be warm, concise (2-4 sentences), helpful.\n\n' +
      'RULES:\n' +
      '- Never use markdown bold (**text**) — plain text only.\n' +
      '- Do NOT ask for name, email, phone, or company — a form collects that automatically.\n' +
      '- When user asks about a service, give a brief helpful 2-3 sentence overview.\n' +
      '- After the form is submitted you receive their details. Thank them warmly, confirm a consultant reaches out within 24 hours.\n' +
      '- For pricing: custom quotes only, consultant will share details.\n' +
      '- Always answer questions about hiring freely — the form will appear on its own after a few messages.\n\n' +
      'CURRENT WEBSITE CONTENT (live — reflects latest site updates automatically):\n"""\n' +
      getPageContext() +
      '\n"""\n'
    );
  }

  // ── STATE ─────────────────────────────────────────────────────
  var history    = [];
  var SYSTEM     = '';
  var leadSent   = false;
  var formShown  = false;
  var formDone   = false;
  var open       = false;
  var busy       = false;
  var userNeed   = '';
  var msgCount   = 0;   // counts Zara replies — form shows after 2

  // ── SEND LEAD ─────────────────────────────────────────────────
  function sendLead(data) {
    if (leadSent) return;
    leadSent = true;
    fetch(PROXY, {
      method: 'POST', redirect: 'follow',
      body: JSON.stringify({
        action: 'lead', name: data.name, email: data.email,
        phone: data.phone, company: data.company, need: data.need || userNeed,
        page: window.location.href, time: new Date().toISOString()
      })
    }).catch(function () {});
  }

  // ── CHAT ──────────────────────────────────────────────────────
  function chat(text, onDone) {
    if (!SYSTEM) SYSTEM = buildSystem();
    history.push({ role: 'user', content: text });
    fetch(PROXY, {
      method: 'POST', redirect: 'follow',
      body: JSON.stringify({
        action: 'chat', message: text,
        history: history.slice(0, -1),
        system: SYSTEM, page: window.location.href
      })
    })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (raw) {
        var d = JSON.parse(raw);
        if (d.error) throw new Error(d.error);
        var reply = d.reply || '';
        history.push({ role: 'assistant', content: reply });
        onDone(reply, false);
      })
      .catch(function (err) {
        history.pop();
        console.error('[Zara]', err);
        onDone('Sorry, something went wrong. Please email us at info@zyoin.com', true);
      });
  }

  // ── CSS ───────────────────────────────────────────────────────
  function css() {
    if (document.getElementById('zara-css')) return;
    var s = document.createElement('style');
    s.id = 'zara-css';
    s.textContent =
      '@import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap");' +

      '#zara-pulse{position:fixed;bottom:28px;right:28px;z-index:99994;width:56px;height:56px;border-radius:50%;background:rgba(255,114,0,.25);animation:zaraPulse 2s ease-out infinite;pointer-events:none}' +
      '@keyframes zaraPulse{0%{transform:scale(1);opacity:.8}100%{transform:scale(1.8);opacity:0}}' +

      '#zara-btn{position:fixed;bottom:28px;right:28px;z-index:99996;width:56px;height:56px;border-radius:50%;background:#ff7200;border:none;cursor:pointer;box-shadow:0 4px 24px rgba(255,114,0,.5);transition:transform .2s,box-shadow .2s;display:flex;align-items:center;justify-content:center}' +
      '#zara-btn:hover{transform:scale(1.08)}' +
      '#zara-btn .ico-close{display:none}#zara-btn.on .ico-chat{display:none}#zara-btn.on .ico-close{display:block}' +

      '#zara-badge{position:fixed;bottom:94px;right:20px;z-index:99995;background:#fff;border-radius:14px;padding:10px 14px 10px 12px;box-shadow:0 4px 20px rgba(0,0,0,.15);font-family:"Plus Jakarta Sans",sans-serif;font-size:12.5px;font-weight:500;color:#222;max-width:190px;line-height:1.4;cursor:pointer;animation:zaraFade .4s ease}' +
      '#zara-badge::after{content:"";position:absolute;bottom:-6px;right:18px;width:12px;height:12px;background:#fff;transform:rotate(45deg);box-shadow:2px 2px 5px rgba(0,0,0,.06)}' +
      '@keyframes zaraFade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}' +

      '#zara-win{position:fixed;bottom:96px;right:28px;z-index:99995;width:360px;height:550px;background:#0f0f14;border-radius:22px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.55);transform:scale(.93) translateY(24px);opacity:0;pointer-events:none;transition:transform .35s cubic-bezier(.34,1.4,.64,1),opacity .25s ease;font-family:"Plus Jakarta Sans",sans-serif}' +
      '#zara-win.on{transform:scale(1) translateY(0);opacity:1;pointer-events:all}' +

      '#zara-hd{background:#18181f;padding:15px 16px;display:flex;align-items:center;gap:11px;border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0}' +
      '#zara-av{width:40px;height:40px;background:linear-gradient(135deg,#ff7200,#ffaa00);border-radius:13px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}' +
      '#zara-hd-name{font-size:13.5px;font-weight:700;color:#fff;line-height:1.2}' +
      '#zara-hd-status{font-size:11px;color:#4ade80;display:flex;align-items:center;gap:4px;margin-top:1px}' +
      '#zara-dot{width:6px;height:6px;background:#4ade80;border-radius:50%;animation:zaraBlink 2s infinite}' +
      '@keyframes zaraBlink{0%,100%{opacity:1}50%{opacity:.3}}' +
      '#zara-x{margin-left:auto;background:none;border:none;color:rgba(255,255,255,.4);cursor:pointer;font-size:20px;line-height:1;padding:2px 4px;transition:color .15s}' +
      '#zara-x:hover{color:#fff}' +

      '#zara-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:9px}' +
      '#zara-msgs::-webkit-scrollbar{width:3px}' +
      '#zara-msgs::-webkit-scrollbar-thumb{background:rgba(255,255,255,.12);border-radius:10px}' +
      '.zm{max-width:84%;display:flex;flex-direction:column;gap:3px}' +
      '.zm.b{align-self:flex-start}.zm.u{align-self:flex-end}' +
      '.zm-b{padding:10px 13px;border-radius:15px;font-size:12.5px;line-height:1.6;word-break:break-word}' +
      '.zm.b .zm-b{background:#1e1e2c;color:#ddd;border-bottom-left-radius:4px}' +
      '.zm.u .zm-b{background:#ff7200;color:#fff;border-bottom-right-radius:4px}' +
      '.zm-b.err{background:#2a1a1a;color:#f87171}' +
      '.zm-t{font-size:10px;color:rgba(255,255,255,.2);padding:0 4px}' +
      '.zm.u .zm-t{text-align:right}' +

      '#zara-typing{align-self:flex-start;background:#1e1e2c;border-radius:15px;border-bottom-left-radius:4px;padding:11px 15px;display:none;gap:4px;align-items:center}' +
      '#zara-typing.on{display:flex}' +
      '.zt{width:6px;height:6px;background:rgba(255,255,255,.35);border-radius:50%;animation:zaraJump .8s infinite}' +
      '.zt:nth-child(2){animation-delay:.13s}.zt:nth-child(3){animation-delay:.26s}' +
      '@keyframes zaraJump{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}' +

      '#zara-qr{padding:0 14px 10px;display:flex;flex-wrap:wrap;gap:6px;flex-shrink:0}' +
      '.zq{background:transparent;border:1px solid rgba(255,114,0,.45);color:#ff9500;border-radius:20px;padding:5px 12px;font-size:11.5px;font-weight:600;cursor:pointer;font-family:"Plus Jakarta Sans",sans-serif;transition:all .15s}' +
      '.zq:hover{background:#ff7200;color:#fff;border-color:#ff7200}' +
      '.zq.intent{font-size:12px;padding:7px 16px}' +

      '#zara-foot{padding:10px 12px;border-top:1px solid rgba(255,255,255,.05);display:flex;gap:9px;align-items:flex-end;flex-shrink:0}' +
      '#zara-in{flex:1;background:#1e1e2c;border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:10px 13px;color:#e0e0e0;font-size:12.5px;font-family:"Plus Jakarta Sans",sans-serif;resize:none;outline:none;max-height:80px;line-height:1.5;transition:border-color .2s}' +
      '#zara-in::placeholder{color:rgba(255,255,255,.22)}' +
      '#zara-in:focus{border-color:rgba(255,114,0,.4)}' +
      '#zara-in:disabled{opacity:.4;cursor:not-allowed}' +
      '#zara-send{width:38px;height:38px;min-width:38px;background:#ff7200;border:none;border-radius:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s,transform .1s}' +
      '#zara-send:hover{background:#e86800;transform:scale(1.05)}' +
      '#zara-send:disabled{background:#2a2a35;cursor:not-allowed;transform:none}' +

      // ── redirect button ─────────────────────────────────────
      '.zara-cta{display:inline-block;background:#ff7200;color:#fff;text-decoration:none;padding:9px 16px;border-radius:11px;font-size:12.5px;font-weight:700;font-family:"Plus Jakarta Sans",sans-serif;margin-top:2px;align-self:flex-start;transition:background .15s}' +
      '.zara-cta:hover{background:#e86800}' +

      // ── form card ───────────────────────────────────────────
      '.zf-card{align-self:stretch;background:#18181f;border:1px solid rgba(255,114,0,.28);border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:10px;animation:zaraFade .3s ease}' +
      '.zf-title{font-size:12px;font-weight:700;color:#ff9500;letter-spacing:.5px;text-transform:uppercase}' +
      '.zf-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}' +
      '.zf-field{display:flex;flex-direction:column;gap:4px}' +
      '.zf-field label{font-size:10px;font-weight:600;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.4px}' +
      '.zf-field input{background:#0f0f14;border:1px solid rgba(255,255,255,.09);border-radius:9px;padding:8px 10px;color:#e0e0e0;font-size:12px;font-family:"Plus Jakarta Sans",sans-serif;outline:none;transition:border-color .2s;width:100%;box-sizing:border-box}' +
      '.zf-field input:focus{border-color:rgba(255,114,0,.55)}' +
      '.zf-field input::placeholder{color:rgba(255,255,255,.18)}' +
      '.zf-field input:disabled{opacity:.45}' +
      '.zf-field input.zf-err{border-color:rgba(248,113,113,.7)!important}' +
      '.zf-btn{background:linear-gradient(135deg,#ff7200,#ff9500);border:none;border-radius:10px;padding:10px;color:#fff;font-size:12.5px;font-weight:700;font-family:"Plus Jakarta Sans",sans-serif;cursor:pointer;transition:opacity .15s}' +
      '.zf-btn:hover{opacity:.88}' +
      '.zf-btn:disabled{background:#2a2a35;opacity:1;cursor:not-allowed}' +
      '.zf-note{font-size:10px;color:rgba(255,255,255,.22);text-align:center}' +

      '@media(max-width:480px){#zara-win{width:calc(100vw - 20px);right:10px;bottom:76px;height:82vh;border-radius:18px}#zara-btn,#zara-pulse{bottom:14px;right:14px}#zara-badge{right:12px}.zf-row{grid-template-columns:1fr}}';

    document.head.appendChild(s);
  }

  // ── HELPERS ───────────────────────────────────────────────────
  function now() {
    var d = new Date(), h = d.getHours(), m = d.getMinutes(), ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return h + ':' + (m < 10 ? '0' : '') + m + ' ' + ap;
  }

  function addMsg(text, who, isErr) {
    var msgs   = document.getElementById('zara-msgs');
    var typing = document.getElementById('zara-typing');
    var div    = document.createElement('div');
    div.className = 'zm ' + who;
    div.innerHTML =
      '<div class="zm-b' + (isErr ? ' err' : '') + '">' + text.replace(/\n/g, '<br>') + '</div>' +
      '<div class="zm-t">' + now() + '</div>';
    msgs.insertBefore(div, typing);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function showTyping() { document.getElementById('zara-typing').classList.add('on'); document.getElementById('zara-msgs').scrollTop = 9999; }
  function hideTyping()  { document.getElementById('zara-typing').classList.remove('on'); }
  function lockInput(ph) {
    var i = document.getElementById('zara-in');
    i.disabled = true; i.placeholder = ph || 'Please fill in your details above...';
    document.getElementById('zara-send').disabled = true;
  }
  function unlockInput() {
    var i = document.getElementById('zara-in');
    i.disabled = false; i.placeholder = 'Ask me anything about hiring...';
    document.getElementById('zara-send').disabled = false;
  }

  function setQR(opts, cls) {
    var qr = document.getElementById('zara-qr');
    qr.innerHTML = '';
    (opts || []).forEach(function (o) {
      var b = document.createElement('button');
      b.className = 'zq' + (cls ? ' ' + cls : '');
      b.textContent = o;
      b.onclick = function () { qr.innerHTML = ''; handleChat(o); };
      qr.appendChild(b);
    });
  }

  // ── STEP 0: Intent selection ───────────────────────────────────
  function showIntentButtons() {
    var qr = document.getElementById('zara-qr');
    qr.innerHTML = '';

    var hiring = document.createElement('button');
    hiring.className = 'zq intent'; hiring.textContent = '🏢 I\'m Hiring';
    hiring.onclick = function () { qr.innerHTML = ''; onHiring(); };

    var seeker = document.createElement('button');
    seeker.className = 'zq intent'; seeker.textContent = '👤 Looking for a Job';
    seeker.onclick = function () { qr.innerHTML = ''; onJobSeeker(); };

    qr.appendChild(hiring);
    qr.appendChild(seeker);
  }

  // ── JOB SEEKER: warm message + redirect ───────────────────────
  function onJobSeeker() {
    addMsg('Looking for a Job', 'u');
    var msgs   = document.getElementById('zara-msgs');
    var typing = document.getElementById('zara-typing');

    var msg = document.createElement('div');
    msg.className = 'zm b';
    msg.innerHTML =
      '<div class="zm-b">We\'d love to help you find your next role! 🚀 Our team connects talented professionals with top companies across India and globally. Head over to our Contact Us page and someone will reach out to match you with the right opportunity.</div>' +
      '<div class="zm-t">' + now() + '</div>';
    msgs.insertBefore(msg, typing);

    var link = document.createElement('a');
    link.className = 'zara-cta';
    link.href = CONTACT_URL;
    link.textContent = 'Go to Contact Us →';
    msgs.insertBefore(link, typing);
    msgs.scrollTop = msgs.scrollHeight;
  }

  // ── HIRING: show service buttons ──────────────────────────────
  function onHiring() {
    addMsg('I\'m Hiring', 'u');
    addMsg('Great! What kind of hiring are you looking for? You can also just type your question below.', 'b');
    setQR(['Permanent Hiring', 'Leadership Hiring', 'Global Hiring', 'RPO / Outsourcing', 'Contract Hiring', 'All Services']);
  }

  // ── CHAT HANDLER ──────────────────────────────────────────────
  function handleChat(text) {
    if (!text || busy) return;
    if (!userNeed) userNeed = text;
    SYSTEM = buildSystem();

    var inp = document.getElementById('zara-in');
    if (inp) { inp.value = ''; inp.style.height = 'auto'; }
    document.getElementById('zara-qr').innerHTML = '';
    addMsg(text, 'u');

    busy = true;
    document.getElementById('zara-send').disabled = true;
    showTyping();

    chat(text, function (reply, isErr) {
      hideTyping();
      busy = false;
      addMsg(reply, 'b', isErr);
      msgCount++;

      if (!isErr && !formShown && msgCount >= 2) {
        // Show form after 2 Zara replies
        formShown = true;
        lockInput('Please fill in your details above...');
        setTimeout(showLeadForm, 400);
      } else if (!formShown) {
        // Still chatting freely before form
        document.getElementById('zara-send').disabled = false;
      } else if (formDone) {
        document.getElementById('zara-send').disabled = false;
      }
      // if formShown but not done → keep locked (form is on screen)
    });
  }

  // ── LEAD FORM (all 4 fields mandatory) ───────────────────────
  function showLeadForm() {
    var msgs   = document.getElementById('zara-msgs');
    var typing = document.getElementById('zara-typing');

    var card = document.createElement('div');
    card.className = 'zf-card';
    card.innerHTML =
      '<div class="zf-title">📋 Your Details</div>' +
      '<div class="zf-row">' +
        '<div class="zf-field"><label>Full Name *</label><input id="zf-name" type="text" placeholder="Rahul Sharma" /></div>' +
        '<div class="zf-field"><label>Company *</label><input id="zf-company" type="text" placeholder="Acme Corp" /></div>' +
      '</div>' +
      '<div class="zf-field"><label>Work Email *</label><input id="zf-email" type="email" placeholder="rahul@company.com" /></div>' +
      '<div class="zf-field"><label>Phone *</label><input id="zf-phone" type="tel" placeholder="+91 98765 43210" /></div>' +
      '<button class="zf-btn" id="zf-submit">Connect me with Zyoin →</button>' +
      '<div class="zf-note">🔒 No spam. A consultant will reach out within 24 hrs.</div>';

    msgs.insertBefore(card, typing);
    msgs.scrollTop = msgs.scrollHeight;
    setTimeout(function () { var f = document.getElementById('zf-name'); if (f) f.focus(); }, 150);

    document.getElementById('zf-submit').onclick = function () {
      var fields = {
        name:    document.getElementById('zf-name'),
        company: document.getElementById('zf-company'),
        email:   document.getElementById('zf-email'),
        phone:   document.getElementById('zf-phone')
      };

      var valid = true;
      Object.keys(fields).forEach(function (k) {
        var v = (fields[k].value || '').trim();
        if (!v) { fields[k].classList.add('zf-err'); valid = false; }
        else fields[k].classList.remove('zf-err');
      });
      if (fields.email.value && !/\S+@\S+\.\S+/.test(fields.email.value)) {
        fields.email.classList.add('zf-err'); valid = false;
      }

      if (!valid) {
        var sbtn = document.getElementById('zf-submit');
        sbtn.textContent = '⚠️ All fields are required';
        setTimeout(function () { sbtn.textContent = 'Connect me with Zyoin →'; }, 2500);
        return;
      }

      var name    = fields.name.value.trim();
      var company = fields.company.value.trim();
      var email   = fields.email.value.trim();
      var phone   = fields.phone.value.trim();

      Object.keys(fields).forEach(function (k) { fields[k].disabled = true; });
      var sbtn = document.getElementById('zf-submit');
      sbtn.disabled = true; sbtn.textContent = 'Sending…';

      sendLead({ name: name, company: company, email: email, phone: phone, need: userNeed });

      setTimeout(function () {
        card.remove();
        formDone = true;
        unlockInput();

        var summary = 'Form submitted. Name: ' + name + ', Company: ' + company +
          ', Email: ' + email + ', Phone: ' + phone + ', Interested in: ' + userNeed + '.';
        busy = true;
        document.getElementById('zara-send').disabled = true;
        showTyping();

        chat(summary, function (reply, isErr) {
          hideTyping();
          busy = false;
          document.getElementById('zara-send').disabled = false;
          addMsg(reply, 'b', isErr);
        });
      }, 400);
    };
  }

  // ── SEND (free chat via input box) ────────────────────────────
  function send(text) {
    if (!text || busy) return;
    // Block if form is visible but not yet submitted
    if (formShown && !formDone) return;
    handleChat(text);
  }

  // ── BUILD UI ──────────────────────────────────────────────────
  function build() {
    css();

    var pulse = document.createElement('div'); pulse.id = 'zara-pulse'; document.body.appendChild(pulse);

    var badge = document.createElement('div'); badge.id = 'zara-badge';
    badge.innerHTML = '👋 Hiring or job hunting? Ask Zara →';
    badge.onclick = function () { show(); badge.style.display = 'none'; };
    document.body.appendChild(badge);
    setTimeout(function () {
      if (badge.parentNode) {
        badge.style.transition = 'opacity .4s'; badge.style.opacity = '0';
        setTimeout(function () { badge.style.display = 'none'; }, 400);
      }
    }, 6000);

    var btn = document.createElement('button'); btn.id = 'zara-btn';
    btn.innerHTML =
      '<svg class="ico-chat" width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '<svg class="ico-close" width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>';
    btn.onclick = function () { open ? hide() : show(); };
    document.body.appendChild(btn);

    var win = document.createElement('div'); win.id = 'zara-win';
    win.innerHTML =
      '<div id="zara-hd">' +
        '<div id="zara-av">⚡</div>' +
        '<div>' +
          '<div id="zara-hd-name">Zara · Zyoin AI</div>' +
          '<div id="zara-hd-status"><span id="zara-dot"></span>Online · replies instantly</div>' +
        '</div>' +
        '<button id="zara-x">✕</button>' +
      '</div>' +
      '<div id="zara-msgs"><div id="zara-typing"><div class="zt"></div><div class="zt"></div><div class="zt"></div></div></div>' +
      '<div id="zara-qr"></div>' +
      '<div id="zara-foot">' +
        '<textarea id="zara-in" rows="1" placeholder="Ask me anything or pick an option above..."></textarea>' +
        '<button id="zara-send">' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</button>' +
      '</div>';
    document.body.appendChild(win);

    document.getElementById('zara-x').onclick = hide;
    var inp = document.getElementById('zara-in');
    inp.onkeydown = function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(inp.value.trim()); }
    };
    inp.oninput = function () { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 80) + 'px'; };
    document.getElementById('zara-send').onclick = function () { send(inp.value.trim()); };

    // Greeting
    setTimeout(function () {
      addMsg('Hi there! 👋 I\'m Zara, Zyoin\'s AI assistant. Are you looking to hire, or are you a job seeker?', 'b');
      showIntentButtons();
    }, 200);
  }

  function show() {
    open = true;
    document.getElementById('zara-win').classList.add('on');
    document.getElementById('zara-btn').classList.add('on');
    document.getElementById('zara-pulse').style.display = 'none';
    document.getElementById('zara-badge').style.display = 'none';
    setTimeout(function () { var i = document.getElementById('zara-in'); if (i && !i.disabled) i.focus(); }, 300);
  }

  function hide() {
    open = false;
    document.getElementById('zara-win').classList.remove('on');
    document.getElementById('zara-btn').classList.remove('on');
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', build); } else { build(); }

})();
