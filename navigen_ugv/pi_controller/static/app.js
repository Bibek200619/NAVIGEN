"use strict";
let token="", connected=false, armed=false, active=null, sending=false, buzzerDraftDirty=false, cameraFailed=false;
const $=id=>document.getElementById(id);
async function api(path,body){
  const options={headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(800)};
  if(body!==undefined){options.method="POST";options.headers["Content-Type"]="application/json";options.body=JSON.stringify(body);}
  const response=await fetch(path,options);
  if(!response.ok){const data=await response.json();throw Error(data.error||response.statusText);}
  return response;
}
function controls(){document.querySelectorAll("[data-v],#stop").forEach(b=>b.disabled=!connected||!armed);$("release").disabled=!connected||armed;$("buzzerEnabled").disabled=!connected;$("threshold").disabled=!connected;$("saveBuzzer").disabled=!connected;}
function disconnected(error){connected=false;armed=false;active=null;controls();$("mode").textContent="Disconnected";$("status").textContent=error.message;}
async function command(){
  if(!active||!armed||sending)return;
  sending=true;
  try{await api("/api/command",active);}catch(error){disconnected(error);}finally{sending=false;}
}
async function stop(){active=null;if(connected&&armed){try{await api("/api/command",{linear:0,angular:0});}catch(error){disconnected(error);}}}
async function estop(){active=null;armed=false;controls();if(!connected)return;try{await api("/api/estop",{active:true});}catch(error){disconnected(error);}}
$("connect").onclick=async()=>{token=$("token").value.trim();try{await refresh();}catch(error){disconnected(error);}};
$("release").onclick=async()=>{active=null;try{await api("/api/estop",{active:false});}catch(error){$("status").textContent=error.message;}};
$("threshold").oninput=()=>{$("thresholdValue").textContent=`${Number($("threshold").value)} cm`;buzzerDraftDirty=true;};
$("buzzerEnabled").onchange=()=>{buzzerDraftDirty=true;};
$("saveBuzzer").onclick=async()=>{
 try{
  const threshold_cm=Number($("threshold").value),enabled=$("buzzerEnabled").checked;
  await api("/api/buzzer",{enabled,threshold_cm});buzzerDraftDirty=false;
  $("buzzerState").textContent=`Settings sent: ${enabled?"enabled":"disabled"}, threshold ${threshold_cm} cm.`;
 }catch(error){$("buzzerState").textContent=error.message;}
};
$("estop").onclick=estop;$("stop").onclick=stop;
for(const button of document.querySelectorAll("[data-v]")){
 button.onpointerdown=e=>{if(!armed)return;e.preventDefault();button.setPointerCapture(e.pointerId);active={linear:Number(button.dataset.v),angular:Number(button.dataset.w)};command();};
 button.onpointerup=stop;button.onpointercancel=stop;button.onlostpointercapture=stop;
}
const keys={w:[.12,0],s:[-.08,0],a:[0,.35],d:[0,-.35]};
window.onkeydown=e=>{if(e.target.tagName==="INPUT")return;if(e.code==="Space"){e.preventDefault();estop();return;}const pair=keys[e.key.toLowerCase()];if(pair&&armed){e.preventDefault();active={linear:pair[0],angular:pair[1]};command();}};
window.onkeyup=e=>{if(keys[e.key.toLowerCase()])stop();};
window.onblur=estop;
document.addEventListener("visibilitychange",()=>{if(document.hidden)estop();});
async function refresh(){
 const state=await(await api("/api/status")).json();connected=true;armed=state.armed&&!state.estop;if(!armed)active=null;controls();
 $("mode").textContent=(state.mock?"MOCK · ":"")+(armed?"Ready":"E-stop engaged");
 const reasons=state.reasons.map(reason=>{
  if(reason==="controller_unavailable")return state.telemetry&&!state.telemetry.configuration_valid?"ESP8266 motor lockout active":"ESP8266 unavailable";
  if(reason==="camera_stale")return "Camera unavailable";
  if(reason==="command_stale")return "Waiting for drive command";
  if(reason==="estop")return "E-stop engaged";
  return reason.replaceAll("_"," ");
 });
 $("status").textContent=reasons.length?reasons.join(" · "):(active?"Driving":"Ready — hold a control to drive");
 if(state.camera_error&&state.camera_error!=="starting")$("cameraState").textContent=`Camera unavailable: ${state.camera_error}`;
 const telemetry=state.telemetry;
 $("range").textContent=state.ultrasonic_valid&&telemetry?telemetry.ultrasonic_left.toFixed(2)+" m":"—";
 $("rangeState").textContent=!telemetry?"Waiting for ESP8266 telemetry":!state.ultrasonic_valid?"No fresh valid distance reading":`Sensor reading · ${state.telemetry_age_ms} ms old`;
 $("pwm").textContent=telemetry?`${telemetry.left_pwm} / ${telemetry.right_pwm}`:"—";
 if(!buzzerDraftDirty){
  const buzzer=state.buzzer||{enabled:false,threshold_cm:30};
  $("buzzerEnabled").checked=buzzer.enabled;$("threshold").value=String(buzzer.threshold_cm);
  $("thresholdValue").textContent=`${buzzer.threshold_cm} cm`;
 }
 const applied=state.firmware_buzzer;
 if(!telemetry){$("buzzerState").textContent="Waiting for ESP8266 telemetry.";}
 else if(!applied||applied.enabled!==state.buzzer.enabled||applied.threshold_mm!==state.buzzer.threshold_mm){$("buzzerState").textContent="Sending settings to the ESP8266…";}
 else{$("buzzerState").textContent=`${applied.enabled?`Enabled · beeps at or inside ${applied.threshold_cm} cm`:"Disabled"} · applied by ESP8266`;}
 const imu=state.imu;
 if(imu?.available&&imu.sample){
  $("imuRoll").textContent=`${imu.sample.roll_deg.toFixed(1)}°`;
  $("imuPitch").textContent=`${imu.sample.pitch_deg.toFixed(1)}°`;
  $("imuYawRate").textContent=`${imu.sample.gyro_z_dps.toFixed(1)}°/s`;
  $("imuState").textContent=`${imu.model||"MPU sensor"} · ${imu.age_ms} ms old`;
 }else{
  for(const id of ["imuRoll","imuPitch","imuYawRate"])$(id).textContent="—";
  $("imuState").textContent=`${imu?.model||"MPU sensor"} unavailable${imu?.error?`: ${imu.error}`:""}`;
 }
}
async function video(){
 while(true){
  if(connected){try{const blob=await(await api("/api/camera.jpg")).blob();const url=URL.createObjectURL(blob);const old=$("camera").src;$("camera").src=url;if(old.startsWith("blob:"))URL.revokeObjectURL(old);$("cameraState").textContent="Live Pi Camera";cameraFailed=false;}
   catch(error){if(!cameraFailed){cameraFailed=true;await estop();}}}
  await new Promise(resolve=>setTimeout(resolve,cameraFailed?1000:100));
 }
}
setInterval(command,80);
setInterval(async()=>{if(connected){try{await refresh();}catch(error){disconnected(error);}}},250);
controls();video();
