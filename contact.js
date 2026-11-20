(() => {
  const t = (ja, en) => window.BULKLanguage?.t(ja, en) || ja;
  const forms = [...document.querySelectorAll('[data-form-kind]')];
  let configPromise, scriptPromise;
  const errors = {
    unavailable: ['現在フォームを利用できません。時間をおいて再度お試しください。', 'The form is unavailable. Please try again later.'],
    invalid: ['入力内容と同意をご確認ください。', 'Please check your entries and consent.'],
    verification: ['安全確認をやり直して、再度送信してください。', 'Please complete the security check again and retry.'],
    busy: ['現在受付が混み合っています。時間をおいて再度お試しください。', 'We are receiving many requests. Please try again later.'],
    unknown: ['送信結果を確認できません。重複を避けるため再送せず、nakao@bulktech.co.jp へ受付状況をお問い合わせください。入力内容はこの画面に保持しています。', 'The result is unconfirmed. To avoid a duplicate, do not resubmit. Contact nakao@bulktech.co.jp to check its status. Your entries remain on this page.']
  };
  function config() {
    if (!configPromise) configPromise = fetch('/api/form-config', { credentials: 'same-origin' }).then(async response => {
      if (!response.ok) throw new Error('unavailable');
      const value = await response.json(); if (!value.siteKey) throw new Error('unavailable'); return value;
    }).catch(error => { configPromise = null; throw error; });
    return configPromise;
  }
  function script() {
    if (!scriptPromise) scriptPromise = new Promise((resolve, reject) => {
      if (window.turnstile) { resolve(); return; }
      const element = document.createElement('script');
      element.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; element.async = true;
      element.onload = resolve; element.onerror = () => { element.remove(); scriptPromise = null; reject(new Error('unavailable')); };
      document.head.append(element);
    });
    return scriptPromise;
  }
  for (const form of forms) {
    const status = form.querySelector('.form-status'), button = form.querySelector('[type=submit]');
    let widget, token = '', pending = false, uncertain = false, initializing = false, createdAt = Date.now(), id = crypto.randomUUID(), state = '', receipt = '', lastPayload = '';
    function announce(code) {
      state = code; status.dataset.error = String(Boolean(errors[code]));
      status.textContent = errors[code] ? t(...errors[code]) : code === 'sending' ? t('送信中です…', 'Sending…') : code === 'accepted' ? t(`送信を受け付けました。受付番号：${receipt}`, `Your submission was accepted. Reference: ${receipt}`) : code === 'checking' ? t('安全確認を読み込んでいます…', 'Loading security check…') : '';
    }
    async function initialize() {
      if (widget !== undefined || initializing) return;
      initializing = true; announce('checking');
      try {
        const settings = await config(); await script();
        widget = window.turnstile.render(form.querySelector('.form-challenge'), {
          sitekey: settings.siteKey, action: form.dataset.formKind, theme: 'dark', size: 'compact', language: 'auto',
          callback: value => { token = value; button.disabled = pending || uncertain; if (!pending && !uncertain && state !== 'accepted') announce(''); },
          'expired-callback': () => { token = ''; button.disabled = true; if (!uncertain) announce('verification'); },
          'error-callback': () => { token = ''; button.disabled = true; if (!uncertain) announce('verification'); }
        });
      } catch { announce('unavailable'); } finally { initializing = false; }
    }
    form.addEventListener('focusin', initialize);
    form.addEventListener('input', () => { if (state === 'accepted') announce(''); });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (pending || uncertain || !form.reportValidity()) return;
      if (!token) { announce('verification'); await initialize(); return; }
      const fields = new FormData(form);
      const payload = { kind: form.dataset.formKind, email: String(fields.get('email') || '').trim(), consent: fields.get('consent') === 'on', website: String(fields.get('website') || ''), token, requestId: id, createdAt };
      if (payload.kind === 'contact') Object.assign(payload, { name: String(fields.get('name') || '').trim(), company: String(fields.get('company') || '').trim(), type: String(fields.get('type') || ''), message: String(fields.get('message') || '').trim() });
      const signature = JSON.stringify({ ...payload, token: '', requestId: '', createdAt: 0 });
      if (!lastPayload) createdAt = Date.now();
      else if (signature !== lastPayload) { id = crypto.randomUUID(); createdAt = Date.now(); }
      lastPayload = signature; payload.requestId = id; payload.createdAt = createdAt;
      pending = true; button.disabled = true; form.querySelectorAll('input,select,textarea').forEach(field => field.disabled = true); form.setAttribute('aria-busy', 'true'); announce('sending');
      try {
        const response = await fetch('/api/contact', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(30000) });
        const value = await response.json();
        if (!response.ok || value.code !== 'accepted' || !/^BULK-[A-F0-9]{20}$/.test(value.receipt || '')) throw new Error(errors[value.code] ? value.code : 'unknown');
        receipt = value.receipt; form.reset(); id = crypto.randomUUID(); createdAt = Date.now(); lastPayload = ''; announce('accepted');
      } catch (error) { const code = errors[error.message] ? error.message : 'unknown'; uncertain = code === 'unknown'; announce(code); }
      finally { pending = false; token = ''; button.disabled = true; form.querySelectorAll('input,select,textarea').forEach(field => field.disabled = false); form.removeAttribute('aria-busy'); if (widget !== undefined) window.turnstile.reset(widget); }
    });
    window.addEventListener('bulk-language-change', () => announce(state));
    if (form.dataset.formKind === 'waitlist') {
      window.addEventListener('bulk-waitlist-open', initialize);
      if (form.closest('dialog').open) initialize();
    } else {
      const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { initialize(); observer.disconnect(); } }, { rootMargin: '150px' }); observer.observe(form);
    }
  }
})();
