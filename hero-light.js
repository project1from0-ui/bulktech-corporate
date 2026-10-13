/* Light is composited from the existing artwork; no simulated body motion. */
(() => {
  const scene=document.querySelector('.scene-opening');
  const image=scene.querySelector('img');
  const canvas=document.querySelector('.hero-light');
  const ctx=canvas.getContext('2d');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  if(!ctx)return;
  const mask=document.createElement('canvas'),beam=document.createElement('canvas');
  const m=mask.getContext('2d',{willReadFrequently:true}),b=beam.getContext('2d');
  let ready=false,frame=0,last=0,elapsed=0,previous=0,points=[],routes=[];
  function prepare(){
    if(!image.naturalWidth)return;
    mask.width=beam.width=1000;
    mask.height=beam.height=Math.round(1000*image.naturalHeight/image.naturalWidth);
    m.drawImage(image,0,0,mask.width,mask.height);
    const pixels=m.getImageData(0,0,mask.width,mask.height);
    for(let y=0;y<mask.height;y++)for(let x=0;x<mask.width;x++){
      const i=(y*mask.width+x)*4;
      const l=(pixels.data[i]+pixels.data[i+1]+pixels.data[i+2])/3;
      const edge=Math.min(1,Math.max(0,(x/mask.width-.32)*8))*Math.min(1,Math.max(0,(.91-y/mask.height)*12));
      pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=240;
      pixels.data[i+3]=Math.pow(Math.min(1,Math.max(0,(l-38)/155)),.85)*255*edge;
      if(x%9===0&&y%9===0&&l>150&&x>mask.width*.40&&y<mask.height*.82)points.push([x,y]);
    }
    // Trace connected bright features of the artwork, rather than arbitrary lines.
    const candidates=points.slice();
    const stride=Math.max(1,Math.floor(candidates.length/72));
    routes=candidates.filter((_,i)=>i%stride===0).slice(0,72).map((start,index)=>{
      const route=[start],used=new Set([start]);
      const dy=index%2?9:-9,dx=index%3===0?6:-3;
      for(let step=0;step<14;step++){
        const lastPoint=route[route.length-1];let best=null,score=Infinity;
        for(const next of candidates){
          if(used.has(next))continue;
          const distance=Math.hypot(next[0]-lastPoint[0],next[1]-lastPoint[1]);
          if(distance>21)continue;
          const cost=Math.hypot(next[0]-lastPoint[0]-dx,next[1]-lastPoint[1]-dy);
          if(cost<score){best=next;score=cost;}
        }
        if(!best)break;route.push(best);used.add(best);
      }
      return route;
    }).filter(route=>route.length>4);
    points=[]; // Release sampled candidates once body routes have been prepared.
    m.putImageData(pixels,0,0);ready=true;update();
  }
  function active(){return ready&&!reduced.matches&&!document.hidden&&Number(getComputedStyle(scene).opacity)>.02;}
  function draw(now){
    frame=0;if(!active()){previous=0;return;}
    frame=requestAnimationFrame(draw);
    if(now-last<32)return;last=now;
    elapsed+=previous?Math.min(60,now-previous):0;previous=now;
    const time=elapsed/1000,box=scene.getBoundingClientRect(),rect=image.getBoundingClientRect();
    const dpr=Math.min(devicePixelRatio||1,1.5),w=Math.round(box.width*dpr),h=Math.round(box.height*dpr);
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,box.width,box.height);
    const scale=Math.max(rect.width/mask.width,rect.height/mask.height);
    const pos=getComputedStyle(image).objectPosition.split(' ').map(parseFloat);
    const ox=rect.left-box.left+(rect.width-mask.width*scale)*(pos[0]/100);
    const oy=rect.top-box.top+(rect.height-mask.height*scale)*((pos[1]||50)/100);
    b.clearRect(0,0,beam.width,beam.height);b.globalCompositeOperation='source-over';b.drawImage(mask,0,0);
    // Begin on the body immediately; a five-second pass remains visible at rest.
    const cycle=((time+1.6)%5.5)/5.5,center=280+cycle*800;
    const gradient=b.createLinearGradient(center-100,0,center+100,mask.height*.22);
    gradient.addColorStop(0,'transparent');gradient.addColorStop(.3,'rgba(255,255,255,.3)');gradient.addColorStop(.5,'white');gradient.addColorStop(.65,'rgba(255,255,255,.5)');gradient.addColorStop(1,'transparent');
    b.globalCompositeOperation='destination-in';b.fillStyle=gradient;b.fillRect(0,0,beam.width,beam.height);
    ctx.globalAlpha=1;ctx.drawImage(beam,ox,oy,mask.width*scale,mask.height*scale);
    ctx.save();ctx.globalAlpha=.65;ctx.filter='blur(7px)';ctx.drawImage(beam,ox,oy,mask.width*scale,mask.height*scale);ctx.restore();
    routes.forEach((route,i)=>{
      const phase=(time*(.24+(i%4)*.018)+i*.137)%1;
      const progress=phase*(route.length-1),segment=Math.floor(progress),fraction=progress-segment;
      const a=route[segment],next=route[Math.min(segment+1,route.length-1)];
      const px=a[0]+(next[0]-a[0])*fraction,py=a[1]+(next[1]-a[1])*fraction;
      const fade=Math.sin(phase*Math.PI);
      ctx.globalAlpha=fade*.68;ctx.strokeStyle='#e5f3ed';ctx.lineWidth=.8*Math.min(scale,1.5);
      ctx.beginPath();
      const tailStart=Math.max(0,segment-2);
      for(let k=tailStart;k<=segment;k++){
        const x=ox+route[k][0]*scale,y=oy+route[k][1]*scale;
        if(k===tailStart)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      }
      ctx.lineTo(ox+px*scale,oy+py*scale);ctx.stroke();
      ctx.globalAlpha=fade;ctx.fillStyle='#f3fff8';
      ctx.beginPath();ctx.arc(ox+px*scale,oy+py*scale,1.3*Math.min(scale,1.7),0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=fade*.12;ctx.beginPath();ctx.arc(ox+px*scale,oy+py*scale,4*Math.min(scale,1.7),0,Math.PI*2);ctx.fill();
    });
    ctx.globalAlpha=1;
  }
  function update(){
    const running=active();
    if(running&&!frame){previous=0;frame=requestAnimationFrame(draw);}
    if(!running){cancelAnimationFrame(frame);frame=0;previous=0;ctx.clearRect(0,0,canvas.width,canvas.height);}
  }
  new MutationObserver(update).observe(scene,{attributes:true,attributeFilter:['style']});
  document.addEventListener('visibilitychange',update);reduced.addEventListener('change',update);
  window.addEventListener('scroll',update,{passive:true});window.addEventListener('resize',update,{passive:true});
  if(image.complete)prepare();else image.addEventListener('load',prepare,{once:true});
})();
