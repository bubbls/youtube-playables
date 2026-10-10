var container = document.querySelector("#unity-container");
var canvas = document.querySelector("#unity-canvas");
var loadingBar = document.querySelector("#unity-loading-bar");
var progressBarFull = document.querySelector("#unity-progress-bar-full");
var fullscreenButton = document.querySelector("#unity-fullscreen-button");
var fullscreenOverlayButton = document.querySelector("#unity-overlay-fullscreen-button");
var quitcanvas = document.querySelector("#quit-canvas");
var warningBanner = document.querySelector("#unity-warning");

var clickedFake = false;
var playBtnClicked = false;
var fakePreloadComplete = false;
var firstFrameSent = false;
var gameReady = false;
var internetSpeed = 0;
var animateBarInterval = 0;
var animateTxtInterval = 0;


// useless
function onGameResize(){}
function unityShowBanner(msg, type) {}

// 1st frame & game ready

function sharedSendFirstFrame(){
  if( firstFrameSent == true )
    return;

  ytgame.game.firstFrameReady();
  firstFrameSent = true;
  console.log("******js:SendFirstFrameReady");
}

function sharedSendGameReady(){
  if( gameReady == true )
    return;

  ytgame.game.gameReady();
  gameReady = true;
  console.log("******js:SendGameReady");
}


// animation


function displayText(progress){
  const texts = [
    "Init Fonts.", 
    "Gather the crew..", 
    "Get some fancy swim suits...", 
    "Beware of Sharks.", 
    "Blow up Floaties..", 
    "Clean pool..."
  ]; 

  if( progress < 15){
    document.querySelector("#carroutxt").innerHTML = texts[0];
  }
  else if( progress < 30){
    document.querySelector("#carroutxt").innerHTML = texts[1];
  }
  else if( progress < 45){
    document.querySelector("#carroutxt").innerHTML = texts[2];
  }
  else if( progress < 60){
    document.querySelector("#carroutxt").innerHTML = texts[3];
  }
  else if( progress < 75){
    document.querySelector("#carroutxt").innerHTML = texts[4];
  }
  else{
    document.querySelector("#carroutxt").innerHTML = texts[5];
  }
}

function animateLoadingBar(duringTime){
  var start = Date.now();
  animateBarInterval = setInterval(() => {
    const elapsed = Date.now() - start; 
    const progress = Math.round( elapsed / duringTime * 100);
    document.querySelector("#unity-progress-bar-full").style.width = progress + "%";
  }, 20);
}

function stopAnimate(){
  document.querySelector("#unity-progress-bar-full").style.width = "100%";
  clearInterval(animateBarInterval);
}


// preload wasm & data then start unity

async function preloadWasmScreen(){
    internetSpeed = await measureSpeedInTime(config.frameworkUrl);
    sharedSendFirstFrame();
    document.querySelector("#carroutxt").style.display = "none";
    document.querySelector("#playBtn").style.display = "none";
    const time = await getLoadTime(config.codeUrl, internetSpeed);
    console.log("temps estimé:"+time);

    animateLoadingBar(time);

   
    preloadFile(
        config.codeUrl, 
        ()=>{
            console.warn("error while loading file: "+config.codeUrl);
        }, 
        (buffer)=>{
          config.wasmBinary = buffer;
          stopAnimate();
          onPreloadWasmComplete();
        }
    ); 
}

async function onPreloadWasmComplete(){
    // sharedSendGameReady();
    const time = await getLoadTime(config.dataUrl, internetSpeed);
    console.log("temps estimé:"+time);

    document.querySelector("#unity-loading-bar").removeAttribute("class");
    document.querySelector("#unity-loading-bar").setAttribute("class", "unity-preload-2");
    document.querySelector("#unity-progress-bar-empty").style.display = "none";
    document.querySelector("#playBtn").style.display = "block";
    document.querySelector("#playBtn").addEventListener( "click", onPlayClicked);

    startUnityGame();
}

function onPlayClicked(){
  document.querySelector("#playBtn").removeEventListener( "click", onPlayClicked);
    document.querySelector("#unity-progress-bar-empty").style.display = "block";
    document.querySelector("#carroutxt").style.display = "block";
    document.querySelector("#playBtn").style.display = "none";
    console.log("onPlayClicked");
    playBtnClicked = true;

    if( fakePreloadComplete == true )
      hideScreen();
}

function hideScreen(){
  if( playBtnClicked == true ){
    document.querySelector("#unity-loading-bar").style.display = "none";
  }
}

function startUnityGame() {
  var script = document.createElement("script");
  script.src = loaderUrl;
  script.onload = () => {
    sharedSendGameReady();
    createUnityInstance(canvas, config, (progress) => {
      document.querySelector("#unity-progress-bar-full").style.width = 100 * progress + "%";
      displayText(progress * 100);
    }).then((unityInstance) => {
      gameInstance = unityInstance;
      fakePreloadComplete = true;
      setTimeout( 
        ()=>{
          hideScreen();
        }, 
        3000
      );
    }).catch((message) => {
      alert(message);
    });
  };

  document.body.appendChild(script);
}

// file utils

async function getFileSize(url) {
    const headers = new Headers();
    headers.append('Range', 'bytes=0-0');  // Demande seulement le premier octet

    const response = await fetch(url, { headers });

    if (response.ok) {
        // Le serveur doit inclure "Content-Range" dans l'en-tête de la réponse
        const contentRange = response.headers.get('Content-Range');
        if (contentRange) {
            // Le format de Content-Range est "bytes x-y/z" où z est la taille totale
            const totalSize = contentRange.split('/')[1];
            return totalSize;
        } else {
            console.error("Le serveur ne prend pas en charge les requêtes de plage ou ne renvoie pas Content-Range.");
        }
    } else {
        console.error("Erreur lors de la requête.");
    }
}

async function getLoadTime(url, speed){
  const size = await getFileSize(url);
  const estimatedTime = ( size / 1024 ) / speed.speedKbps;
  return estimatedTime * 1000;
}

async function preloadFile(url, failedCallback, completeCallback) {
    
    const start = Date.now();
    const response = await fetch(url);

    if( !response.ok)
      return failedCallback();

    
    const buffer = await response.arrayBuffer();
    // console.log(url+" time taken: "+ (Date.now() - start ), completeCallback);
    completeCallback(buffer); 
}

async function measureSpeedInTime(url) {
    const results = {
      downloadedBytes: 0,
      elapsedSeconds: 0,
      speedKbps: 1000,
      speedMbps: 1,
    }
    const randomizer = "?rand="+Math.round( Math.random() * 1000 )
    const startTime = Date.now();
    const size = await getFileSize(url+randomizer);
    const response = await fetch(url+randomizer);
    if( !response.ok)
      return results;

    await response.arrayBuffer();

    const elapsed = (Date.now() - startTime) / 1000; // en secondes
    const speedKbps = size / 1024 / elapsed;
    const speedMbps = speedKbps / 1024;

    results.downloadedBytes = size;
    results.elapsedSeconds = elapsed;
    results.speedKbps = speedKbps;
    results.speedMbps = speedMbps;

    return results;
}

// youtube

function onPageLoaded() {
  ytgame.game.loadData().then(onYoutubeDataLoaded);
};

function onYoutubeDataLoaded(data) {
  if (data == "") {
    console.log("youtube remote data is empty, use default data instead");
  }
  remoteData = data == "" ? defaultRemoteData : data;
  console.log("******START GAME WITH PRELOADED DATA: " + remoteData);
//   startUnityGame();
  preloadWasmScreen();
}

var buildUrl = "Build";
var loaderUrl = buildUrl + "/aquapark_v1.5.loader.js";

var config = {
    arguments: [],
    dataUrl: buildUrl + "/aquapark_v1.5.data.unityweb",
    frameworkUrl: buildUrl + "/aquapark_v1.5.framework.js.unityweb",
    codeUrl: buildUrl + "/aquapark_v1.5.wasm.unityweb",
    streamingAssetsUrl: new URL("StreamingAssets", document.baseURI).href,
    companyName: "Cassette",
    productName: "Aquapark.io",
    productVersion: "6.14.0",
    showBanner: unityShowBanner,
};


if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
  // Mobile device style: fill the whole browser client area with the game canvas:
  var meta = document.createElement('meta');
  meta.name = 'viewport';
  meta.content = 'width=device-width, height=device-height, initial-scale=1.0, user-scalable=no, shrink-to-fit=yes';
  document.getElementsByTagName('head')[0].appendChild(meta);
  container.className = "unity-mobile";
  canvas.className = "unity-mobile";
} 
else {
  canvas.style.width = "100%";
  canvas.style.height = "100%";
}

loadingBar.style.display = "block";


var unityGameInstance = null;



/*custom unity script*/
var gameInstance = null;
var defaultRemoteData = ``;
var remoteData = "";

window.addEventListener("load", onPageLoaded);
window.addEventListener("resize", onGameResize);
