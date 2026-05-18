function f(e){return e.replace(/\s+/g," ").trim()}function u(e){const t=e.querySelector("main")||e.querySelector("article")||e.querySelector("#privacy")||e.body;return f(t.innerText||"").slice(0,12e3)}function p(e,t){const n=`${e} ${t.title}`.toLowerCase();return n.includes("privacy")||n.includes("policy")}function y(e){return Array.from(e.querySelectorAll("a")).filter(t=>t.textContent&&t.textContent.toLowerCase().includes("privacy")).slice(0,6).map(t=>t.href)}const g=[{name:"Google Analytics",match:/google-analytics|gtag\/js|analytics\.google/},{name:"Google Tag Manager",match:/googletagmanager/},{name:"Meta Pixel",match:/connect\.facebook\.net|fbq\(/},{name:"TikTok Pixel",match:/tiktok\.com|ttq\(/},{name:"Twitter Pixel",match:/static\.ads-twitter\.com|twttr/},{name:"LinkedIn Insight",match:/linkedin\.com\/li/},{name:"Hotjar",match:/hotjar/}];function d(e){const n=Array.from(e.querySelectorAll("script")).map(i=>i.src||i.textContent||"").join(" "),o=[];return g.forEach(i=>{i.match.test(n)&&!o.includes(i.name)&&o.push(i.name)}),o}const x=["camera","microphone","location","contacts","notifications","bluetooth","calendar"];function m(e){var n;const t=(((n=e.body)==null?void 0:n.innerText)||"").toLowerCase();return x.filter(o=>t.includes(o))}const l="psa-warning-banner";function c(e,t){if(document.getElementById(l))return;const n=document.createElement("div");n.id=l,n.style.cssText=`
    position: fixed;
    right: 18px;
    bottom: 18px;
    z-index: 2147483647;
    max-width: 320px;
    padding: 14px 16px;
    border-radius: 16px;
    background: ${t==="danger"?"rgba(255, 75, 75, 0.2)":"rgba(46, 242, 255, 0.18)"};
    color: #ffffff;
    border: 1px solid rgba(255,255,255,0.2);
    backdrop-filter: blur(14px);
    font-family: system-ui, sans-serif;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
  `,n.innerHTML=`
    <div style="font-size: 11px; letter-spacing: 0.3em; text-transform: uppercase; opacity: 0.7;">Privacy Shield AI</div>
    <div style="margin-top: 6px; font-size: 14px; font-weight: 600;">${e}</div>
  `,document.body.appendChild(n),setTimeout(()=>n.remove(),12e3)}function h(){return Array.from(document.querySelectorAll("form")).some(t=>t.querySelector("input[type='password'], input[type='email']"))}function r(e){const t=u(document),n=d(document),o=m(document);chrome.runtime.sendMessage({type:"PSA_ANALYZE_TEXT",payload:{text:t,url:window.location.href,title:document.title,trackers:n,permissions:o,reason:e}},i=>{var a,s;i!=null&&i.ok&&(((a=i.result)==null?void 0:a.danger_level)==="Dangerous"?c("High-risk privacy terms detected. Review before continuing.","danger"):((s=i.result)==null?void 0:s.danger_level)==="Risky"&&c("Potential privacy risks found. Consider reviewing the policy.","warning"))})}function T(){p(window.location.href,document)?r("policy-page"):h()?(c("Signup/Login detected. Running privacy scan...","warning"),r("signup-form")):y(document).length&&r("policy-link")}chrome.runtime.onMessage.addListener((e,t,n)=>{if((e==null?void 0:e.type)==="PSA_REQUEST_PAGE_CONTEXT"){const o={text:u(document),url:window.location.href,title:document.title,trackers:d(document),permissions:m(document),reason:"manual-scan"};return n({ok:!0,payload:o}),!0}return!1});T();
