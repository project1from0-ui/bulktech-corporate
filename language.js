(() => {
  let lang='ja';
  const translate=(ja,en)=>lang==='en'?en:ja;
  function apply(next,save=false){
    lang=next==='en'?'en':'ja';document.documentElement.lang=lang;
    document.querySelectorAll('[data-ja]').forEach(el=>el.textContent=el.dataset[lang]);
    for(const [suffix,attr] of [['Aria','aria-label'],['Alt','alt']])document.querySelectorAll(`[data-ja-${suffix.toLowerCase()}]`).forEach(el=>el.setAttribute(attr,el.dataset[lang+suffix]));
    document.querySelectorAll('[data-lang]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.lang===lang)));
    const menu=document.querySelector('.menu');menu.setAttribute('aria-label',menu.getAttribute('aria-expanded')==='true'?translate('メニューを閉じる','Close menu'):translate('メニューを開く','Open menu'));
    const title=translate('BULK — 身体の可能性を、解き放つ。','BULK — Unlock human potential.');
    const description=translate('株式会社Bulk Technologiesは、スマートフォンのカメラによる身体動作解析を核に、一人ひとりの運動体験を豊かにする未来を目指しています。','Bulk Technologies explores movement analysis through smartphone cameras to enrich the way people move.');
    document.title=title;document.querySelector('meta[name="description"]').content=description;
    document.querySelector('meta[property="og:title"]').content=title;document.querySelector('meta[property="og:description"]').content=description;document.querySelector('meta[property="og:locale"]').content=lang==='en'?'en_US':'ja_JP';
    document.querySelector('.career-link').href='mailto:info@bulktech.co.jp?subject='+encodeURIComponent(translate('BULK オープン応募','BULK open application'));
    document.querySelector('.waitlist-link').href='mailto:info@bulktech.co.jp?subject='+encodeURIComponent(translate('BULK ウェイティングリスト登録申込み','BULK waiting list registration request'))+'&body='+encodeURIComponent(translate('このメールアドレスでBULKのウェイティングリストへの登録を申し込みます。BULKのサービス利用に関する案内の受信を希望します。','Please add this email address to the BULK waiting list. I would like to receive email updates about access to BULK services.'));
    document.querySelectorAll('.privacy-link').forEach(a=>a.href='privacy.html?lang='+lang);
    document.querySelector('.copy-status').textContent='';
    if(save){try{localStorage.setItem('bulk-language',lang);}catch{}const url=new URL(location.href);url.searchParams.set('lang',lang);history.replaceState(null,'',url);}
    window.dispatchEvent(new Event('resize'));
  }
  window.BULKLanguage={t:translate};
  document.querySelectorAll('[data-lang]').forEach(button=>button.addEventListener('click',()=>apply(button.dataset.lang,true)));
  let initial=new URL(location.href).searchParams.get('lang');if(!['ja','en'].includes(initial)){try{initial=localStorage.getItem('bulk-language');}catch{}}
  apply(initial);
})();
