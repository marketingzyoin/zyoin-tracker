// ============================================================
// ZYOIN CHATBOT — FRONTEND
// Flow: Greeting → Service buttons → Zara reply → Form → Free chat
// Auto-adapts: scrapes page content on load → injects into system prompt
//
// WEBFLOW FOOTER CODE:
//   <script>
//     window.ZYOIN_CONFIG = { chatbot: "YOUR_APPS_SCRIPT_WEB_APP_URL" };
//   </script>
//   <script src="https://cdn.jsdelivr.net/gh/marketingzyoin/zyoin-tracker@main/zyoin-chatbot.js" defer></script>
// ============================================================

(function () {
  'use strict';

  var PROXY = (window.ZYOIN_CONFIG && window.ZYOIN_CONFIG.chatbot) || '';
  if (!PROXY) { console.warn('[Zara] No chatbot URL set'); return; }

  // ── SCRAPE PAGE CONTENT (auto-adapts to website changes) ──────
  function getPageContext() {
    try {
      // Clone body so we can strip unwanted elements safely
      var clone = document.body.cloneNode(true);

      // Remove script, style, svg, nav, footer, chatbot itself
      ['script','style','svg','noscript','#zara-win','#zara-btn','#zara-badge','#zara-pulse'].forEach(function (sel) {
        clone.querySelectorAll(sel).forEach(function (el) { el.remove(); });
      });

      // Collect text, collapse whitespace, limit to 3000 chars to keep prompt lean
      var text = (clone.innerText || clone.textContent || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 3000);

      return text;
    } catch (e) {
      return '';
    }
  }

  // ── BUILD SYSTEM PROMPT (base + live page content) ────────────
  function buildSystem() {
    var pageCtx = getPageContext();
    return (
      'You are Zara, Zyoin Group\'s AI hiring assistant. Be warm, concise (2-4 sentences), and helpful.\n\n' +
      'CORE RULES:\n' +
      '- Never use markdown bold (**text**) — plain text only.\n' +
      '- Do NOT ask for the user\'s name, email, phone, or company — a form collects that.\n' +
      '- After the form is submitted you will receive their details in a message. Thank them warmly and confirm a consultant reaches out within 24 hours.\n' +
      '- When the user picks a service, give a brief 2-3 sentence overview, then end with something like: "Let me pull up a quick form so our team can reach out with a tailored solution!"\n' +
      '- For pricing questions, always say: "We provide custom quotes — a Zyoin consultant will share the details once they reach out."\n' +
      '- If you don\'t know something specific, say: "Our team will have the full details for you — they\'ll reach out within 24 hours."\n\n' +
      'CURRENT PAGE CONTENT (live from zyoin.com — use this as your knowledge base):\n' +
      '"""\n' + (pageCtx || 'No page content available.') + '\n"""\n\n' +
      'Use the page content above to answer questions accurately. If the website is updated, your answers will reflect those updates automatically.'
    );
  }

  // ── STATE ─────────────────────────────────────────────────────
  var history  = [];
  var SYSTEM   = '';        // built on first use
  var leadSent = false;
  var formDone = false;
  var open     = false;
  var busy     = false;
  var userNeed = '';

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
    if (!SYSTEM) SYSTEM = buildSystem();   // build once per session
    history.push({ role: 'user', content: text });
    fetch(PROXY, {
      method: 'POST', redirect: 'follow',
      body: JSON.stringify({
        action: 'chat', message: text,
        history: history.slice(0, -1),
        system: SYSTEM,
        page: window.location.href
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
      '#zara-btn .ico-close{display:none}' +
      '#zara-btn.on .ico-chat{display:none}' +
      '#zara-btn.on .ico-close{display:block}' +

      '#zara-badge{position:fixed;bottom:94px;right:20px;z-index:99995;background:#fff;border-radius:14px;padding:10px 14px 10px 12px;box-shadow:0 4px 20px rgba(0,0,0,.15);font-family:"Plus Jakarta Sans",sans-serif;font-size:12.5px;font-weight:500;color:#222;max-width:190px;line-height:1.4;cursor:pointer;animation:zaraFade .4s ease}' +
      '#zara-badge::after{content:"";position:absolute;bottom:-6px;right:18px;width:12px;height:12px;background:#fff;transform:rotate(45deg);box-shadow:2px 2px 5px rgba(0,0,0,.06)}' +
      '@keyframes zaraFade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}' +

      '#zara-win{position:fixed;bottom:96px;right:28px;z-index:99995;width:360px;height:545px;background:#0f0f14;border-radius:22px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.55);transform:scale(.93) translateY(24px);opacity:0;pointer-events:none;transition:transform .35s cubic-bezier(.34,1.4,.64,1),opacity .25s ease;font-family:"Plus Jakarta Sans",sans-serif}' +
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
      '.zm.b{align-self:flex-start}' +
      '.zm.u{align-self:flex-end}' +
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

      '#zara-foot{padding:10px 12px;border-top:1px solid rgba(255,255,255,.05);display:flex;gap:9px;align-items:flex-end;flex-shrink:0}' +
      '#zara-in{flex:1;background:#1e1e2c;border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:10px 13px;color:#e0e0e0;font-size:12.5px;font-family:"Plus Jakarta Sans",sans-serif;resize:none;outline:none;max-height:80px;line-height:1.5;transition:border-color .2s}' +
      '#zara-in::placeholder{color:rgba(255,255,255,.22)}' +
      '#zara-in:focus{border-color:rgba(255,114,0,.4)}' +
      '#zara-send{width:38px;height:38px;min-width:38px;background:#ff7200;border:none;border-radius:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s,transform .1s}' +
      '#zara-send:hover{background:#e86800;transform:scale(1.05)}' +
      '#zara-send:disabled{background:#2a2a35;cursor:not-allowed;transform:none}' +

      // ── Form card ──────────────────────────────────────────────
      '.zf-card{align-self:stretch;background:#18181f;border:1px solid rgba(255,114,0,.28);border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:10px;animation:zaraFade .3s ease}' +
      '.zf-title{font-size:12px;font-weight:700;color:#ff9500;letter-spacing:.5px;text-transform:uppercase}' +
      '.zf-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}' +
      '.zf-field{display:flex;flex-direction:column;gap:4px}' +
      '.zf-field label{font-size:10px;font-weight:600;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.4px}' +
      '.zf-field input{background:#0f0f14;border:1px solid rgba(255,255,255,.09);border-radius:9px;padding:8px 10px;color:#e0e0e0;font-size:12px;font-family:"Plus Jakarta Sans",sans-serif;outline:none;transition:border-color .2s;width:100%;box-sizing:border-box}' +
      '.zf-field input:focus{border-color:rgba(255,114,0,.55)}' +
      '.zf-field input::placeholder{color:rgba(255,255,255,.18)}' +
      '.zf-field input:disabled{opacity:.45}' +
      '.zf-btn{background:linear-gradient(135deg,#ff7200,#ff9500);border:none;border-radius:10px;padding:10px;color:#fff;font-size:12.5px;font-weight:700;font-family:"Plus Jakarta Sans",sans-serif;cursor:pointer;transition:opacity .15s}' +
      '.zf-btn:hover{opacity:.88}' +
      '.zf-btn:disabled{background:#2a2a35;opacity:1;cursor:not-allowed}' +
      '.zf-note{font-size:10px;color:rgba(255,255,255,.22);text-align:center}' +

      '@media(max-width:480px){#zara-win{width:calc(100vw - 20px);right:10px;bottom:76px;height:78vh;border-radius:18px}#zara-btn,#zara-pulse{bottom:14px;right:14px}#zara-badge{right:12px}.zf-row{grid-template-columns:1fr}}';

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

  function setQR(opts) {
    var qr = document.getElementById('zara-qr');
    qr.innerHTML = '';
    (opts || []).forEach(function (o) {
      var b = document.createElement('button'); b.className = 'zq'; b.textContent = o;
      b.onclick = function () { qr.innerHTML = ''; onServiceClick(o); };
      qr.appendChild(b);
    });
  }

  // ── STEP 1: service selected → Zara replies → form appears ────
  function onServiceClick(service) {
    userNeed = service;
    addMsg(service, 'u');
    busy = true;
    showTyping();

    // Build system prompt now (captures current page content)
    SYSTEM = buildSystem();

    chat(service, function (reply, isErr) {
      hideTyping();
      busy = false;
      addMsg(reply, 'b', isErr);
      if (!isErr) setTimeout(showLeadForm, 350);
    });
  }

  // ── STEP 2: lead form ─────────────────────────────────────────
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
      '<div class="zf-field"><label>Phone (optional)</label><input id="zf-phone" type="tel" placeholder="+91 98765 43210" /></div>' +
      '<button class="zf-btn" id="zf-submit">Connect me with Zyoin →</button>' +
      '<div class="zf-note">🔒 No spam. A consultant will reach out within 24 hrs.</div>';

    msgs.insertBefore(card, typing);
    msgs.scrollTop = msgs.scrollHeight;
    setTimeout(function () { var f = document.getElementById('zf-name'); if (f) f.focus(); }, 150);

    document.getElementById('zf-submit').onclick = function () {
      var name    = (document.getElementById('zf-name').value    || '').trim();
      var company = (document.getElementById('zf-company').value || '').trim();
      var email   = (document.getElementById('zf-email').value   || '').trim();
      var phone   = (document.getElementById('zf-phone').value   || '').trim();

      if (!name || !email || !company) {
        var btn = document.getElementById('zf-submit');
        btn.textContent = '⚠️ Name, Company & Email are required';
        setTimeout(function () { btn.textContent = 'Connect me with Zyoin →'; }, 2500);
        return;
      }

      card.querySelectorAll('input').forEach(function (i) { i.disabled = true; });
      var sbtn = document.getElementById('zf-submit');
      sbtn.disabled = true; sbtn.textContent = 'Sending…';

      sendLead({ name: name, company: company, email: email, phone: phone, need: userNeed });

      setTimeout(function () {
        card.remove();
        formDone = true;

        // Unlock chat
        var inp = document.getElementById('zara-in');
        inp.disabled = false;
        inp.placeholder = 'Ask me anything about hiring...';
        document.getElementById('zara-send').disabled = false;

        // Tell Zara the form is done so she can respond naturally
        var summary = 'Form submitted. Name: ' + name + ', Company: ' + company +
          ', Email: ' + email + (phone ? ', Phone: ' + phone : '') +
          ', Interested in: ' + userNeed + '.';
        busy = true;
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

  // ── STEP 3: free chat after form ──────────────────────────────
  function send(text) {
    if (!text || busy || !formDone) return;
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
      document.getElementById('zara-send').disabled = false;
      addMsg(reply, 'b', isErr);
    });
  }

  // ── BUILD UI ──────────────────────────────────────────────────
  function build() {
    css();

    var pulse = document.createElement('div'); pulse.id = 'zara-pulse'; document.body.appendChild(pulse);

    var badge = document.createElement('div'); badge.id = 'zara-badge';
    badge.innerHTML = '👋 Hi! Need help hiring? Ask Zara →';
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
        '<textarea id="zara-in" rows="1" placeholder="Select a service above to get started..." disabled></textarea>' +
        '<button id="zara-send" disabled>' +
          '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</button>' +
      '</div>';
    document.body.appendChild(win);

    document.getElementById('zara-x').onclick = hide;
    var inp = document.getElementById('zara-in');
    inp.onkeydown = function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(inp.value.trim()); } };
    inp.oninput   = function () { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 80) + 'px'; };
    document.getElementById('zara-send').onclick = function () { send(inp.value.trim()); };

    // Greeting + service buttons
    setTimeout(function () {
      addMsg('Hi there! 👋 I\'m Zara, Zyoin\'s AI hiring assistant. What are you looking for today?', 'b');
      setQR(['Permanent Hiring', 'Leadership Hiring', 'Global Hiring', 'RPO / Outsourcing', 'Contract Hiring', 'All Services']);
    }, 200);
  }

  function show() {
    open = true;
    document.getElementById('zara-win').classList.add('on');
    document.getElementById('zara-btn').classList.add('on');
    document.getElementById('zara-pulse').style.display = 'none';
    document.getElementById('zara-badge').style.display = 'none';
  }

  function hide() {
    open = false;
    document.getElementById('zara-win').classList.remove('on');
    document.getElementById('zara-btn').classList.remove('on');
  }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', build); } else { build(); }

})();
