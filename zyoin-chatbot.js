// ============================================================
// ZYOIN CHATBOT — FRONTEND
//
// HOW TO ADD TO WEBFLOW:
// 1. Go to Project Settings → Custom Code → Footer Code
// 2. Paste this block:
//    <script>
//      window.ZYOIN_CONFIG = { chatbot: "YOUR_APPS_SCRIPT_WEB_APP_URL" };
//    </script>
//    <script src="https://cdn.jsdelivr.net/gh/marketingzyoin/zyoin-tracker@main/zyoin-chatbot.js" defer></script>
// ============================================================

(function () {
  'use strict';

  // ── CONFIG ────────────────────────────────────────────────────
  var PROXY = (window.ZYOIN_CONFIG && window.ZYOIN_CONFIG.chatbot) || '';

  if (!PROXY) {
    console.warn('[Zara] No chatbot URL set in window.ZYOIN_CONFIG.chatbot');
    return;
  }

  // ── ZYOIN KNOWLEDGE ───────────────────────────────────────────
  var SYSTEM =
    'You are Zara, Zyoin Group\'s AI hiring assistant. Be warm, concise (2-4 sentences), and helpful.\n\n' +
    'ABOUT ZYOIN:\n' +
    'Zyoin Group is an AI-augmented recruitment company based in India with global reach. We connect businesses with exceptional talent fast.\n\n' +
    'SERVICES:\n' +
    '- Permanent Hiring: Full-time recruitment across all levels\n' +
    '- Leadership Hiring: C-suite, VP, Director executive search\n' +
    '- Global Hiring: International talent across US, UK, Europe, APAC\n' +
    '- RPO: We become your recruitment team\n' +
    '- Contract Hiring: Flexible workforce, short and long term\n' +
    '- Managed Recruitment: Fully managed hiring campaigns\n' +
    '- Talent Intelligence: Market mapping, salary benchmarking\n' +
    '- Hire Meetups: Exclusive events with pre-screened talent\n' +
    '- Payroll Processing: End-to-end payroll management\n' +
    '- HR Outsourcing: Complete HR function outsourcing\n\n' +
    'USPs:\n' +
    '- AI-augmented process, 40% faster time-to-hire\n' +
    '- 95%+ retention at 6 months\n' +
    '- Pan-India + global coverage\n' +
    '- No placement, no fee for permanent hiring\n' +
    '- Dedicated account managers\n\n' +
    'PRICING: Custom quotes only — a consultant will provide details.\n\n' +
    'LEAD CAPTURE:\n' +
    '- After 2-3 messages, when the user shows interest or asks about a service, end your reply with the tag [SHOW_FORM]\n' +
    '- Do NOT ask for details conversationally — the form will handle collection\n' +
    '- Example: "Great choice! Zyoin\'s permanent hiring covers all levels with a 95%+ retention rate. Let me pull up a quick form so our team can reach out to you. [SHOW_FORM]"\n' +
    '- After the form is submitted, the user\'s details will appear in chat. Thank them warmly and confirm a consultant will reach out within 24 hours.';

  // ── STATE ─────────────────────────────────────────────────────
  var history   = [];
  var lead      = { name: '', email: '', phone: '', company: '', need: '' };
  var leadSent  = false;
  var formShown = false;
  var open      = false;
  var busy      = false;

  // ── SEND LEAD TO PROXY ────────────────────────────────────────
  function sendLead(data) {
    if (leadSent) return;
    leadSent = true;
    fetch(PROXY, {
      method:   'POST',
      redirect: 'follow',
      body: JSON.stringify({
        action:  'lead',
        name:    data.name    || '',
        email:   data.email   || '',
        phone:   data.phone   || '',
        company: data.company || '',
        need:    data.need    || lead.need || '',
        page:    window.location.pathname,
        time:    new Date().toISOString()
      })
    }).catch(function () {});
  }

  // ── CALL PROXY ────────────────────────────────────────────────
  function chat(text, onDone) {
    history.push({ role: 'user', content: text });

    fetch(PROXY, {
      method:   'POST',
      redirect: 'follow',
      body: JSON.stringify({
        action:  'chat',
        message: text,
        history: history.slice(0, -1),
        system:  SYSTEM,
        page:    window.location.pathname
      })
    })
      .then(function (res) {
        if (!res.ok) throw new Error('API error ' + res.status);
        return res.text();
      })
      .then(function (raw) {
        var d = JSON.parse(raw);
        if (d.error) throw new Error(d.error);
        var reply = d.reply || '';

        // Check for form trigger tag
        var triggerForm = /\[SHOW_FORM\]/i.test(reply);
        var clean       = reply.replace(/\[SHOW_FORM\]/gi, '').trim();

        history.push({ role: 'assistant', content: clean });
        onDone(clean, false, triggerForm);
      })
      .catch(function (err) {
        history.pop();
        console.error('[Zara] fetch error:', err);
        onDone('Sorry, something went wrong. Please try again or email us at info@zyoin.com', true, false);
      });
  }

  // ── CSS ───────────────────────────────────────────────────────
  function css() {
    if (document.getElementById('zara-css')) return;
    var s = document.createElement('style');
    s.id = 'zara-css';
    s.textContent =
      '@import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap");' +

      // Pulse
      '#zara-pulse{position:fixed;bottom:28px;right:28px;z-index:99994;width:56px;height:56px;border-radius:50%;background:rgba(255,114,0,.25);animation:zaraPulse 2s ease-out infinite;pointer-events:none}' +
      '@keyframes zaraPulse{0%{transform:scale(1);opacity:.8}100%{transform:scale(1.8);opacity:0}}' +

      // Launcher button
      '#zara-btn{position:fixed;bottom:28px;right:28px;z-index:99996;width:56px;height:56px;border-radius:50%;background:#ff7200;border:none;cursor:pointer;box-shadow:0 4px 24px rgba(255,114,0,.5);transition:transform .2s,box-shadow .2s;display:flex;align-items:center;justify-content:center}' +
      '#zara-btn:hover{transform:scale(1.08);box-shadow:0 6px 32px rgba(255,114,0,.65)}' +
      '#zara-btn .ico-close{display:none}' +
      '#zara-btn.on .ico-chat{display:none}' +
      '#zara-btn.on .ico-close{display:block}' +

      // Badge
      '#zara-badge{position:fixed;bottom:94px;right:20px;z-index:99995;background:#fff;border-radius:14px;padding:10px 14px 10px 12px;box-shadow:0 4px 20px rgba(0,0,0,.15);font-family:"Plus Jakarta Sans",sans-serif;font-size:12.5px;font-weight:500;color:#222;max-width:190px;line-height:1.4;cursor:pointer;animation:zaraFade .4s ease}' +
      '#zara-badge::after{content:"";position:absolute;bottom:-6px;right:18px;width:12px;height:12px;background:#fff;transform:rotate(45deg);box-shadow:2px 2px 5px rgba(0,0,0,.06)}' +
      '@keyframes zaraFade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}' +

      // Chat window
      '#zara-win{position:fixed;bottom:96px;right:28px;z-index:99995;width:360px;height:540px;background:#0f0f14;border-radius:22px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.55);transform:scale(.93) translateY(24px);opacity:0;pointer-events:none;transition:transform .35s cubic-bezier(.34,1.4,.64,1),opacity .25s ease;font-family:"Plus Jakarta Sans",sans-serif}' +
      '#zara-win.on{transform:scale(1) translateY(0);opacity:1;pointer-events:all}' +

      // Header
      '#zara-hd{background:#18181f;padding:15px 16px;display:flex;align-items:center;gap:11px;border-bottom:1px solid rgba(255,255,255,.06)}' +
      '#zara-av{width:40px;height:40px;background:linear-gradient(135deg,#ff7200,#ffaa00);border-radius:13px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}' +
      '#zara-hd-name{font-size:13.5px;font-weight:700;color:#fff;line-height:1.2}' +
      '#zara-hd-status{font-size:11px;color:#4ade80;display:flex;align-items:center;gap:4px;margin-top:1px}' +
      '#zara-dot{width:6px;height:6px;background:#4ade80;border-radius:50%;animation:zaraBlink 2s infinite}' +
      '@keyframes zaraBlink{0%,100%{opacity:1}50%{opacity:.3}}' +
      '#zara-x{margin-left:auto;background:none;border:none;color:rgba(255,255,255,.4);cursor:pointer;font-size:20px;line-height:1;padding:2px 4px;transition:color .15s}' +
      '#zara-x:hover{color:#fff}' +

      // Messages
      '#zara-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:9px}' +
      '#zara-msgs::-webkit-scrollbar{width:3px}' +
      '#zara-msgs::-webkit-scrollbar-thumb{background:rgba(255,255,255,.12);border-radius:10px}' +
      '.zm{max-width:84%;display:flex;flex-direction:column;gap:3px}' +
      '.zm.b{align-self:flex-start}' +
      '.zm.u{align-self:flex-end}' +
      '.zm-b{padding:10px 13px;border-radius:15px;font-size:12.5px;line-height:1.6;font-weight:400;word-break:break-word}' +
      '.zm.b .zm-b{background:#1e1e2c;color:#ddd;border-bottom-left-radius:4px}' +
      '.zm.u .zm-b{background:#ff7200;color:#fff;border-bottom-right-radius:4px}' +
      '.zm-b.err{background:#2a1a1a;color:#f87171}' +
      '.zm-t{font-size:10px;color:rgba(255,255,255,.2);padding:0 4px}' +
      '.zm.u .zm-t{text-align:right}' +

      // Typing dots
      '#zara-typing{align-self:flex-start;background:#1e1e2c;border-radius:15px;border-bottom-left-radius:4px;padding:11px 15px;display:none;gap:4px;align-items:center}' +
      '#zara-typing.on{display:flex}' +
      '.zt{width:6px;height:6px;background:rgba(255,255,255,.35);border-radius:50%;animation:zaraJump .8s infinite}' +
      '.zt:nth-child(2){animation-delay:.13s}' +
      '.zt:nth-child(3){animation-delay:.26s}' +
      '@keyframes zaraJump{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}' +

      // Quick replies
      '#zara-qr{padding:0 14px 10px;display:flex;flex-wrap:wrap;gap:6px}' +
      '.zq{background:transparent;border:1px solid rgba(255,114,0,.45);color:#ff9500;border-radius:20px;padding:5px 12px;font-size:11.5px;font-weight:600;cursor:pointer;font-family:"Plus Jakarta Sans",sans-serif;transition:all .15s}' +
      '.zq:hover{background:#ff7200;color:#fff;border-color:#ff7200}' +

      // Input area
      '#zara-foot{padding:10px 12px;border-top:1px solid rgba(255,255,255,.05);display:flex;gap:9px;align-items:flex-end}' +
      '#zara-in{flex:1;background:#1e1e2c;border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:10px 13px;color:#e0e0e0;font-size:12.5px;font-family:"Plus Jakarta Sans",sans-serif;resize:none;outline:none;max-height:80px;line-height:1.5;transition:border-color .2s}' +
      '#zara-in::placeholder{color:rgba(255,255,255,.22)}' +
      '#zara-in:focus{border-color:rgba(255,114,0,.4)}' +
      '#zara-send{width:38px;height:38px;min-width:38px;background:#ff7200;border:none;border-radius:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s,transform .1s}' +
      '#zara-send:hover{background:#e86800;transform:scale(1.05)}' +
      '#zara-send:disabled{background:#2a2a35;cursor:not-allowed;transform:none}' +

      // ── Lead form card ─────────────────────────────────────────
      '.zara-form-card{align-self:flex-start;width:100%;max-width:98%;background:#18181f;border:1px solid rgba(255,114,0,.3);border-radius:16px;padding:14px 14px 12px;display:flex;flex-direction:column;gap:10px;animation:zaraFade .3s ease}' +
      '.zara-form-title{font-size:11.5px;font-weight:700;color:#ff9500;text-transform:uppercase;letter-spacing:.6px}' +
      '.zara-form-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}' +
      '.zara-field{display:flex;flex-direction:column;gap:4px}' +
      '.zara-field label{font-size:10px;color:rgba(255,255,255,.38);font-weight:600;text-transform:uppercase;letter-spacing:.4px}' +
      '.zara-field input{background:#0f0f14;border:1px solid rgba(255,255,255,.09);border-radius:9px;padding:8px 10px;color:#e0e0e0;font-size:12px;font-family:"Plus Jakarta Sans",sans-serif;outline:none;transition:border-color .2s;width:100%;box-sizing:border-box}' +
      '.zara-field input:focus{border-color:rgba(255,114,0,.55)}' +
      '.zara-field input::placeholder{color:rgba(255,255,255,.18)}' +
      '.zara-field input:disabled{opacity:.5}' +
      '.zara-submit{background:linear-gradient(135deg,#ff7200,#ff9500);border:none;border-radius:10px;padding:10px;color:#fff;font-size:12.5px;font-weight:700;font-family:"Plus Jakarta Sans",sans-serif;cursor:pointer;transition:opacity .15s;letter-spacing:.2px}' +
      '.zara-submit:hover{opacity:.9}' +
      '.zara-submit:disabled{background:#2a2a35;cursor:not-allowed;opacity:1}' +
      '.zara-form-note{font-size:10px;color:rgba(255,255,255,.22);text-align:center}' +

      // Mobile
      '@media(max-width:480px){#zara-win{width:calc(100vw - 20px);right:10px;bottom:76px;height:75vh;border-radius:18px}#zara-btn,#zara-pulse{bottom:14px;right:14px}#zara-badge{right:12px}.zara-form-row{grid-template-columns:1fr}}';

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

  function showTyping() {
    document.getElementById('zara-typing').classList.add('on');
    document.getElementById('zara-msgs').scrollTop = 9999;
  }

  function hideTyping() {
    document.getElementById('zara-typing').classList.remove('on');
  }

  function setQR(opts) {
    var qr = document.getElementById('zara-qr');
    qr.innerHTML = '';
    (opts || []).forEach(function (o) {
      var b = document.createElement('button');
      b.className   = 'zq';
      b.textContent = o;
      b.onclick = function () { qr.innerHTML = ''; send(o); };
      qr.appendChild(b);
    });
  }

  // ── INLINE LEAD FORM ──────────────────────────────────────────
  function showLeadForm(needHint) {
    if (formShown) return;
    formShown = true;

    var msgs   = document.getElementById('zara-msgs');
    var typing = document.getElementById('zara-typing');

    var card = document.createElement('div');
    card.className = 'zara-form-card';
    card.innerHTML =
      '<div class="zara-form-title">📋 Quick Details</div>' +
      '<div class="zara-form-row">' +
        '<div class="zara-field"><label>Full Name *</label><input id="zf-name" type="text" placeholder="Rahul Sharma" /></div>' +
        '<div class="zara-field"><label>Company *</label><input id="zf-company" type="text" placeholder="Acme Corp" /></div>' +
      '</div>' +
      '<div class="zara-field"><label>Work Email *</label><input id="zf-email" type="email" placeholder="rahul@company.com" /></div>' +
      '<div class="zara-field"><label>Phone (optional)</label><input id="zf-phone" type="tel" placeholder="+91 98765 43210" /></div>' +
      '<button class="zara-submit" id="zf-submit">Connect me with Zyoin →</button>' +
      '<div class="zara-form-note">🔒 No spam. A consultant will reach out within 24 hrs.</div>';

    msgs.insertBefore(card, typing);
    msgs.scrollTop = msgs.scrollHeight;

    // Focus first field
    setTimeout(function () {
      var f = document.getElementById('zf-name');
      if (f) f.focus();
    }, 200);

    document.getElementById('zf-submit').onclick = function () {
      var name    = document.getElementById('zf-name').value.trim();
      var company = document.getElementById('zf-company').value.trim();
      var email   = document.getElementById('zf-email').value.trim();
      var phone   = document.getElementById('zf-phone').value.trim();

      if (!name || !email || !company) {
        var btn = document.getElementById('zf-submit');
        btn.textContent = '⚠️ Name, Company & Email are required';
        setTimeout(function () { btn.textContent = 'Connect me with Zyoin →'; }, 2500);
        return;
      }

      // Lock the form
      card.querySelectorAll('input').forEach(function (i) { i.disabled = true; });
      var submitBtn        = document.getElementById('zf-submit');
      submitBtn.disabled   = true;
      submitBtn.textContent = 'Sending…';

      var formData = { name: name, company: company, email: email, phone: phone, need: needHint || '' };
      sendLead(formData);

      // Remove form, show user summary, trigger Claude reply
      setTimeout(function () {
        card.remove();
        var summary = 'My details — Name: ' + name + ', Company: ' + company + ', Email: ' + email + (phone ? ', Phone: ' + phone : '') + '.';
        addMsg(summary, 'u');
        busy = true;
        document.getElementById('zara-send').disabled = true;
        showTyping();

        chat(summary, function (reply, isErr) {
          hideTyping();
          busy  = false;
          document.getElementById('zara-send').disabled = false;
          addMsg(reply, 'b', isErr);
        });
      }, 350);
    };
  }

  // ── SEND MESSAGE ──────────────────────────────────────────────
  function send(text) {
    if (!text || busy) return;
    var inp = document.getElementById('zara-in');
    if (inp) { inp.value = ''; inp.style.height = 'auto'; }
    document.getElementById('zara-qr').innerHTML = '';
    addMsg(text, 'u');
    busy = true;
    document.getElementById('zara-send').disabled = true;
    showTyping();

    chat(text, function (reply, isErr, triggerForm) {
      hideTyping();
      busy  = false;
      document.getElementById('zara-send').disabled = false;
      addMsg(reply, 'b', isErr);
      if (triggerForm) showLeadForm(text);
    });
  }

  // ── BUILD UI ──────────────────────────────────────────────────
  function build() {
    css();

    var pulse = document.createElement('div');
    pulse.id  = 'zara-pulse';
    document.body.appendChild(pulse);

    var badge = document.createElement('div');
    badge.id  = 'zara-badge';
    badge.innerHTML = '👋 Hi! Need help hiring? Ask Zara →';
    badge.onclick = function () { show(); badge.style.display = 'none'; };
    document.body.appendChild(badge);
    setTimeout(function () {
      if (badge.parentNode) {
        badge.style.transition = 'opacity .4s';
        badge.style.opacity    = '0';
        setTimeout(function () { badge.style.display = 'none'; }, 400);
      }
    }, 6000);

    var btn = document.createElement('button');
    btn.id  = 'zara-btn';
    btn.innerHTML =
      '<svg class="ico-chat" width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '<svg class="ico-close" width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>';
    btn.onclick = function () { open ? hide() : show(); };
    document.body.appendChild(btn);

    var win = document.createElement('div');
    win.id  = 'zara-win';
    win.innerHTML =
      '<div id="zara-hd">' +
        '<div id="zara-av">⚡</div>' +
        '<div>' +
          '<div id="zara-hd-name">Zara · Zyoin AI</div>' +
          '<div id="zara-hd-status"><span id="zara-dot"></span>Online · replies instantly</div>' +
        '</div>' +
        '<button id="zara-x">✕</button>' +
      '</div>' +
      '<div id="zara-msgs">' +
        '<div id="zara-typing"><div class="zt"></div><div class="zt"></div><div class="zt"></div></div>' +
      '</div>' +
      '<div id="zara-qr"></div>' +
      '<div id="zara-foot">' +
        '<textarea id="zara-in" rows="1" placeholder="Ask me anything about hiring..."></textarea>' +
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
    inp.oninput = function () {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 80) + 'px';
    };
    document.getElementById('zara-send').onclick = function () { send(inp.value.trim()); };

    setTimeout(function () {
      addMsg('Hi there! 👋 I\'m Zara, Zyoin\'s AI hiring assistant. I can answer questions about our services, help you find the right hiring solution, and connect you with our team. What brings you to Zyoin today?', 'b');
      setQR(['Permanent Hiring', 'Leadership Hiring', 'Global Hiring', 'RPO / Outsourcing', 'All Services']);
    }, 200);
  }

  function show() {
    open = true;
    document.getElementById('zara-win').classList.add('on');
    document.getElementById('zara-btn').classList.add('on');
    document.getElementById('zara-pulse').style.display = 'none';
    document.getElementById('zara-badge').style.display = 'none';
    setTimeout(function () { var i = document.getElementById('zara-in'); if (i) i.focus(); }, 300);
  }

  function hide() {
    open = false;
    document.getElementById('zara-win').classList.remove('on');
    document.getElementById('zara-btn').classList.remove('on');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }

})();
