import jsQR from 'jsqr';
export interface CameraHandle{ stop:()=>void }
const rafSet=(cb:()=>void)=>typeof requestAnimationFrame==='function'?requestAnimationFrame(cb):(setTimeout(cb,16) as unknown as number);
const rafClear=(id:number)=>{ if(typeof cancelAnimationFrame==='function') cancelAnimationFrame(id); else clearTimeout(id); };
/** Camera lifecycle: caller owns the handle. stop() stops every track and cancels
 *  animation work; a permission promise resolving after stop() has its tracks
 *  stopped immediately. Decode is injectable for mocked-media tests. */
export function acquireCamera(opts:{ video:HTMLVideoElement|null; onCode:(raw:string)=>void; onError:(msg:string)=>void; getStream?:(c:any)=>Promise<MediaStream>; decode?:(v:any)=>string|null }):CameraHandle{
  let stopped=false; let stream:MediaStream|null=null; let raf=0;
  const stop=()=>{ stopped=true; rafClear(raf); stream?.getTracks().forEach(t=>t.stop()); stream=null; if(opts.video) opts.video.srcObject=null; };
  const decode=opts.decode||((v:any)=>{ if(!v?.videoWidth) return null; const cv=document.createElement('canvas'); cv.width=v.videoWidth; cv.height=v.videoHeight; const cx=cv.getContext('2d'); if(!cx) return null; cx.drawImage(v,0,0); const d=cx.getImageData(0,0,cv.width,cv.height); const q=jsQR(d.data,cv.width,cv.height); return q?.data||null; });
  (async()=>{ try{ const get=opts.getStream||((c:any)=>navigator.mediaDevices.getUserMedia(c)); const s=await get({video:{facingMode:'environment'}}); if(stopped){ s.getTracks().forEach(t=>t.stop()); return; } stream=s; const v=opts.video; if(!v){ stop(); return; } v.srcObject=s; await v.play(); if(stopped){ stop(); return; } const tick=()=>{ if(stopped||!stream) return; const raw=decode(v); if(raw){ const r=raw; stop(); opts.onCode(r); return; } raf=rafSet(tick); }; tick(); }catch{ if(!stopped) opts.onError('Camera unavailable or permission denied. Upload a QR image or type the code instead.'); } })();
  return { stop };
}
