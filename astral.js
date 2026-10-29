// Cursor-responsive star depth. No custom cursor or input interception.
const canvas = document.querySelector('#astral-dust');
const context = canvas.getContext('2d');
const aura = document.querySelector('.cursor-aura');
const sky = document.querySelector('.galaxy-atmosphere');
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const fine = matchMedia('(pointer: fine)');
let frame = 0, width = 0, height = 0, previous = 0;
let pointer = {x:0,y:0}, drift = {x:0,y:0};
const stars = Array.from({length:65},(_,i)=>({x:((i*73.137)%100)/100,y:((i*37.719)%100)/100,z:.3+(i%7)/10,r:.5+(i%3)*.4}));
function draw(time=0){
  frame=0;
  if(time-previous<32 && !reduce.matches){frame=requestAnimationFrame(draw);return;}
  previous=time; drift.x+=(pointer.x-drift.x)*.045;drift.y+=(pointer.y-drift.y)*.045;
  context.clearRect(0,0,width,height);
  for(const star of stars){
    const x=star.x*width+drift.x*star.z*22,y=star.y*height+drift.y*star.z*16;
    context.beginPath();context.arc(x,y,star.r,0,Math.PI*2);
    context.fillStyle=`rgba(239,211,180,${.2+star.z*.35})`;context.fill();
    const px=(pointer.x+.5)*width,py=(pointer.y+.5)*height;
    if(fine.matches&&!reduce.matches&&Math.hypot(x-px,y-py)<115){context.beginPath();context.moveTo(x,y);context.lineTo(px,py);context.strokeStyle='rgba(241,172,117,.07)';context.stroke();}
  }
  if(!reduce.matches&&!document.hidden&&Math.abs(pointer.x-drift.x)+Math.abs(pointer.y-drift.y)>.001)frame=requestAnimationFrame(draw);
}
function schedule(){if(!frame&&!document.hidden)frame=requestAnimationFrame(draw);}
function resize(){width=innerWidth;height=innerHeight;const scale=Math.min(devicePixelRatio,1.5);canvas.width=width*scale;canvas.height=height*scale;context.setTransform(scale,0,0,scale,0,0);schedule();}
if(context){
  window.addEventListener('resize',resize,{passive:true});
  window.addEventListener('pointermove',event=>{if(!fine.matches||reduce.matches)return;pointer={x:event.clientX/width-.5,y:event.clientY/height-.5};aura.style.opacity='1';aura.style.transform=`translate(${event.clientX}px,${event.clientY}px)`;sky.style.setProperty('--sky-x',`${pointer.x*-12}px`);sky.style.setProperty('--sky-y',`${pointer.y*-10}px`);schedule();},{passive:true});
  document.addEventListener('visibilitychange',()=>{cancelAnimationFrame(frame);frame=0;if(!document.hidden)schedule();});
  reduce.addEventListener('change',()=>{pointer={x:0,y:0};drift={x:0,y:0};aura.style.opacity='0';schedule();});
  window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);frame=0;});
  window.addEventListener('pageshow',schedule);resize();
}

// A seeded spiral galaxy, rendered at 30fps only while visible.
const galaxyHost = document.querySelector('.orbital-scene');
const galaxy = document.createElement('canvas');
galaxy.className='galaxy-canvas';galaxy.setAttribute('aria-hidden','true');galaxyHost.append(galaxy);
const g=galaxy.getContext('2d');
if(g){
  let gw=0,gh=0,gframe=0,last=0,angle=0,visible=false;
  let seed=1419;
  const random=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
  const particles=Array.from({length:1800},(_,i)=>{
    const radius=Math.pow(random(),.72),arm=i%3;
    return {radius,theta:arm*Math.PI*2/3+radius*5.5+(random()-.5)*.62,scatter:(random()-.5)*.1,size:.45+random()*1.05,alpha:.3+random()*.65};
  });
  function paint(time){
    gframe=0;
    if(!reduce.matches&&time-last<33){gframe=requestAnimationFrame(paint);return;}
    if(!reduce.matches)angle+=.00065;
    last=time;g.clearRect(0,0,gw,gh);
    const cx=gw*.54+drift.x*22,cy=gh*.5+drift.y*16,scale=Math.min(gw,gh)*.46;
    const glow=g.createRadialGradient(cx,cy,0,cx,cy,scale*.55);glow.addColorStop(0,'#ffe6ce66');glow.addColorStop(.18,'#eeb8be22');glow.addColorStop(1,'#b375d000');g.fillStyle=glow;g.fillRect(0,0,gw,gh);
    const count=innerWidth<641?1000:particles.length;
    for(let i=0;i<count;i++){
      const p=particles[i],a=p.theta+angle,r=p.radius*scale;
      const x=Math.cos(a)*r,y=Math.sin(a)*r*.78+p.scatter*scale;
      const tilt=-.48,px=cx+x*Math.cos(tilt)-y*Math.sin(tilt),py=cy+x*Math.sin(tilt)+y*Math.cos(tilt);
      g.fillStyle=p.radius<.2?`rgba(255,223,194,${p.alpha})`:p.radius<.57?`rgba(242,144,151,${p.alpha})`:`rgba(155,117,231,${p.alpha})`;
      g.fillRect(px,py,p.size,p.size);
    }
    if(visible&&!document.hidden&&!reduce.matches)gframe=requestAnimationFrame(paint);
  }
  function run(){cancelAnimationFrame(gframe);gframe=0;if(!document.hidden&&(visible||reduce.matches))gframe=requestAnimationFrame(paint);}
  const size=new ResizeObserver(()=>{const bounds=galaxyHost.getBoundingClientRect();gw=bounds.width;gh=bounds.height;const dpr=Math.min(devicePixelRatio,1.5);galaxy.width=gw*dpr;galaxy.height=gh*dpr;g.setTransform(dpr,0,0,dpr,0,0);run();});size.observe(galaxyHost);
  const visibility=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;run();});visibility.observe(galaxyHost);
  document.addEventListener('visibilitychange',run);reduce.addEventListener('change',run);
  window.addEventListener('pagehide',()=>cancelAnimationFrame(gframe));window.addEventListener('pageshow',run);
}
