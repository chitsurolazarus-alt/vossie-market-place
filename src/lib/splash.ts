// Runs before first paint (inlined in <head>). See components/Splash.tsx.
export const SPLASH_INIT_SCRIPT = `(function(){try{var s=(window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true;if(s&&!sessionStorage.getItem('hh_splash'))document.documentElement.setAttribute('data-splash','1');}catch(e){}})();`;
