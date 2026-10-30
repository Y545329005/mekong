// Approved hero-motion preview v3; production lifecycle is managed by React.
/** Dependency-free background. API: setSpeed(number), setPaused(boolean), destroy(). */
  export class ComputeSpaceBackground {
    constructor(container, options = {}) {
      this.container = container;
      this.canvas = container.querySelector('canvas');
      this.ctx = this.canvas.getContext('2d', { alpha: false });
      this.speed = options.speed ?? 1;
      this.time = 0;
      this.paused = false;
      this.frame = 0;
      this.last = 0;
      this.pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
      this.motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
      this.reduced = this.motionQuery.matches;
      this.seed = 52719;
      this.period = 24;
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.onVisibility = () => this.syncAnimation();
      this.onMotion = event => { this.reduced = event.matches; this.syncAnimation(); this.container.dispatchEvent(new CustomEvent('motionchange', { detail: this.reduced })); };
      this.onPointer = event => {
        if (event.pointerType === 'touch') return;
        const rect = this.container.getBoundingClientRect();
        this.pointer.targetX = ((event.clientX - rect.left) / rect.width - .5) * 2;
        this.pointer.targetY = ((event.clientY - rect.top) / rect.height - .5) * 2;
      };
      this.onPointerLeave = () => { this.pointer.targetX = 0; this.pointer.targetY = 0; };
      this.tick = this.tick.bind(this);
      this.buildNetwork();
      this.buildSprites();
      this.resizeObserver.observe(container);
      container.addEventListener('pointermove', this.onPointer, { passive: true });
      container.addEventListener('pointerleave', this.onPointerLeave);
      document.addEventListener('visibilitychange', this.onVisibility);
      this.motionQuery.addEventListener('change', this.onMotion);
      this.resize();
      this.syncAnimation();
    }

    random() {
      this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
      return this.seed / 4294967296;
    }

    completeMeshCells(links) {
      // Walk the existing spherical cells; retain all four-sided cells as drawn.
      const nodes=this.nodes,neighbors=new Map();
      for(const {a,b} of links.values()){
        if(!neighbors.has(a))neighbors.set(a,[]);
        if(!neighbors.has(b))neighbors.set(b,[]);
        neighbors.get(a).push(b);neighbors.get(b).push(a);
      }
      const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
      const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
      const unit=p=>{const l=Math.hypot(p.x,p.y,p.z);return {x:p.x/l,y:p.y/l,z:p.z/l};};
      for(const [i,list] of neighbors){
        const normal=nodes[i],ref=Math.abs(normal.y)<.9?{x:0,y:1,z:0}:{x:1,y:0,z:0};
        const u=unit(cross(normal,ref)),v=cross(normal,u);
        const angle=j=>Math.atan2(dot(nodes[j],v),dot(nodes[j],u));
        list.sort((a,b)=>angle(a)-angle(b));
      }
      const visited=new Set(),cells=[];
      for(const [i,list] of neighbors)for(const j of list){
        if(visited.has(i+':'+j))continue;
        let a=i,b=j;const cell=[];
        for(let steps=0;steps<neighbors.size*2;steps++){
          const key=a+':'+b;if(visited.has(key))break;
          visited.add(key);cell.push(a);
          const next=neighbors.get(b),c=next[(next.indexOf(a)+1)%next.length];a=b;b=c;
        }
        if(cell.length>=6)cells.push(cell);
      }
      for(const cell of cells){
        const center=unit(cell.reduce((sum,i)=>({x:sum.x+nodes[i].x,y:sum.y+nodes[i].y,z:sum.z+nodes[i].z}),{x:0,y:0,z:0}));
        const u=unit(cross(center,Math.abs(center.y)<.9?{x:0,y:1,z:0}:{x:1,y:0,z:0})),v=cross(center,u);
        const polygon=cell.map(i=>({x:dot(nodes[i],u),y:dot(nodes[i],v)}));
        const inside=point=>{
          let result=false;
          for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
            const a=polygon[i],b=polygon[j];
            if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)result=!result;
          }
          return result;
        };
        let best=null;
        // Three boundary segments on one side yield a four-sided cell after repair.
        for(let i=0;i<cell.length;i++){
          const j=(i+3)%cell.length,a=Math.min(cell[i],cell[j]),b=Math.max(cell[i],cell[j]);
          if(links.has(a+':'+b))continue;
          const midpoint={x:(polygon[i].x+polygon[j].x)/2,y:(polygon[i].y+polygon[j].y)/2};
          if(!inside(midpoint))continue;
          const length=(nodes[a].x-nodes[b].x)**2+(nodes[a].y-nodes[b].y)**2+(nodes[a].z-nodes[b].z)**2;
          if(!best||length<best.length)best={a,b,length};
        }
        if(best)links.set(best.a+':'+best.b,{a:best.a,b:best.b,cluster:false});
      }
    }

    buildNetwork() {
      this.nodes=[];
      const golden=Math.PI*(3-Math.sqrt(5));
      for(let i=0;i<230;i++){
        const y=1-i/229*2,r=Math.sqrt(1-y*y),a=i*golden;
        this.nodes.push({x:Math.cos(a)*r,y,z:Math.sin(a)*r,glow:this.random()*.8,phase:this.random()*Math.PI*2,cluster:-1});
      }
      const locations=[[1,104],[36,140],[37,127],[19,73],[50,9],[38,-78],[45,-122],[-23,-46],[-34,151]];
      this.hubs=[];
      locations.forEach(([lat,lon],cluster)=>{
        const a=lat*Math.PI/180,b=(lon-100)*Math.PI/180;
        const p={x:Math.cos(a)*Math.sin(b),y:-Math.sin(a),z:Math.cos(a)*Math.cos(b),cluster,glow:1,phase:this.random()*Math.PI*2,hub:true};
        this.hubs.push(this.nodes.length);this.nodes.push(p);
        const u={x:Math.cos(b),y:0,z:-Math.sin(b)};
        const v={x:Math.sin(a)*Math.sin(b),y:Math.cos(a),z:Math.sin(a)*Math.cos(b)};
        // Soft, uneven regional density. Local points are not joined into symbols.
        const count=13+cluster%5;
        const normal=()=>this.random()+this.random()+this.random()+this.random()-2;
        for(let j=0;j<count;j++){
          const dx=normal()*(.10+(cluster%3)*.012),dy=normal()*(.075+(cluster%2)*.015);
          let x=p.x+u.x*dx+v.x*dy,y=p.y+v.y*dy,z=p.z+u.z*dx+v.z*dy;
          const length=Math.hypot(x,y,z);x/=length;y/=length;z/=length;
          this.nodes.push({x,y,z,cluster,glow:.35+this.random()*.45,phase:this.random()*Math.PI*2});
        }
      });
      const links=new Map();
      // Keep the globe mesh separate from the unconnected regional light fields.
      const mesh=this.nodes.map((p,i)=>({p,i})).filter(({p})=>p.cluster<0);
      mesh.forEach(({p,i})=>{
        const neighbors=mesh.map(({p:q,i:j})=>({j,d:(p.x-q.x)**2+(p.y-q.y)**2+(p.z-q.z)**2})).filter(q=>q.j!==i).sort((a,b)=>a.d-b.d).slice(0,3);
        neighbors.forEach(q=>{const a=Math.min(i,q.j),b=Math.max(i,q.j);links.set(a+':'+b,{a,b,cluster:false});});
      });
      this.completeMeshCells(links);
      this.links=[...links.values()];
      this.packets=Array.from({length:31},(_,i)=>({edge:Math.floor(this.random()*this.links.length),progress:this.random(),cycles:i%3+1}));
      this.routes=[[0,1],[0,3],[1,2],[0,8],[3,4],[4,5],[5,6],[5,7],[1,6],[2,7],[3,8]].map(([a,b],i)=>({a:this.nodes[this.hubs[a]],b:this.nodes[this.hubs[b]],phase:i/11,teal:i%3===0}));
      this.stars=Array.from({length:155},()=>({x:this.random(),y:this.random(),depth:this.random(),phase:this.random()*Math.PI*2}));
      this.dust=[];
      this.projected=this.nodes.map(()=>({x:0,y:0,z:0,scale:1}));
    }

    buildSprites() {
      this.glowSprite = document.createElement('canvas');
      this.glowSprite.width = this.glowSprite.height = 64;
      const ctx = this.glowSprite.getContext('2d');
      const glow = ctx.createRadialGradient(32,32,0,32,32,32);
      glow.addColorStop(0,'rgba(229,250,255,1)');
      glow.addColorStop(.08,'rgba(184,239,255,.9)');
      glow.addColorStop(.25,'rgba(97,202,239,.35)');
      glow.addColorStop(1,'rgba(64,153,222,0)');
      ctx.filter='brightness(120%)';
      ctx.fillStyle = glow;
      ctx.fillRect(0,0,64,64);
    }

    resize() {
      const rect = this.container.getBoundingClientRect();
      this.width = Math.max(1, rect.width);
      this.height = Math.max(1, rect.height);
      this.mobile = this.width < 800;
      this.dpr = Math.min(devicePixelRatio || 1, this.mobile ? 1.5 : 2);
      this.canvas.width = Math.round(this.width * this.dpr);
      this.canvas.height = Math.round(this.height * this.dpr);
      this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
      this.radius = this.mobile ? Math.min(this.width*.65, this.height*.31) : Math.min(this.width*.285, this.height*.425);
      this.centerX = this.width * (this.mobile ? .78 : .735);
      this.centerY = this.height * (this.mobile ? .66 : .49);
      this.createAtmosphere();
      this.draw();
    }

    createAtmosphere() {
      this.atmosphere = document.createElement('canvas');
      this.atmosphere.width = Math.round(this.width * this.dpr);
      this.atmosphere.height = Math.round(this.height * this.dpr);
      const ctx = this.atmosphere.getContext('2d');
      ctx.scale(this.dpr, this.dpr);
      ctx.fillStyle = '#050c13';
      ctx.fillRect(0,0,this.width,this.height);
      const haze = ctx.createRadialGradient(this.centerX, this.centerY, this.radius*.25, this.centerX, this.centerY, this.radius*1.75);
      haze.addColorStop(0,'rgba(13,39,54,.6)');
      haze.addColorStop(.45,'rgba(10,35,49,.22)');
      haze.addColorStop(.74,'rgba(9,26,39,.13)');
      haze.addColorStop(1,'rgba(5,12,19,0)');
      ctx.fillStyle = haze;
      ctx.fillRect(0,0,this.width,this.height);
      const halo = ctx.createRadialGradient(this.centerX, this.centerY, this.radius*.91, this.centerX, this.centerY, this.radius*1.15);
      halo.addColorStop(0,'rgba(45,119,151,0)');
      halo.addColorStop(.48,'rgba(41,117,151,.065)');
      halo.addColorStop(1,'rgba(25,83,130,0)');
      ctx.fillStyle=halo;
      ctx.fillRect(0,0,this.width,this.height);
    }

    project(x,y,z, offset = 1) {
      const phase=this.time/this.period*Math.PI*2;
      const rot=.12+Math.sin(phase)*.115;
      const cos = Math.cos(rot), sin = Math.sin(rot);
      const rx = x*cos - z*sin, rz = x*sin + z*cos;
      const tilt = -.12+Math.cos(phase)*.012;
      const ty = y*Math.cos(tilt) - rz*Math.sin(tilt);
      const tz = y*Math.sin(tilt) + rz*Math.cos(tilt);
      const scale = 3.6 / (3.6 - tz);
      return { x: this.centerX + rx*this.radius*scale*offset, y: this.centerY + ty*this.radius*scale*offset, z: tz, scale };
    }

    glow(x,y,r,alpha) {
      const previousAlpha = this.ctx.globalAlpha;
      this.ctx.globalAlpha = alpha;
      this.ctx.drawImage(this.glowSprite,x-r,y-r,r*2,r*2);
      this.ctx.globalAlpha = previousAlpha;
    }

    drawStars() {
      const ctx=this.ctx,phase=this.time/this.period*Math.PI*2;
      for(const s of this.stars){
        const x=s.x*this.width+Math.sin(phase+s.phase)*1.3,y=s.y*this.height;
        const alpha=(.04+s.depth*.17)*(.85+Math.sin(phase+s.phase)*.15);
        ctx.fillStyle=`rgba(151,185,203,${alpha})`;
        ctx.fillRect(x,y,s.depth>.97?1.1:.65,s.depth>.97?1.1:.65);
      }
    }

    orbitPoint(angle, ring) {
      const x=Math.cos(angle)*ring.r;
      const z=Math.sin(angle)*ring.r;
      const y=Math.sin(angle)*ring.tilt;
      const ca=Math.cos(ring.roll),sa=Math.sin(ring.roll);
      return this.project(x*ca-y*sa,x*sa+y*ca,z);
    }

    drawOrbits(front) {
      const ctx=this.ctx;
      const ring={r:1.19,tilt:.38,roll:-.29};
      ctx.beginPath();let active=false;
      for(let i=0;i<=180;i++){
        const p=this.orbitPoint(i/180*Math.PI*2,ring);
        if((p.z>0)===front){if(active)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);active=true;}else active=false;
      }
      ctx.strokeStyle=`rgba(121,204,230,${front?.075:.025})`;ctx.lineWidth=.6;ctx.stroke();
    }

    routePoint(route,t){
      const dot=Math.max(-.9999,Math.min(.9999,route.a.x*route.b.x+route.a.y*route.b.y+route.a.z*route.b.z));
      const angle=Math.acos(dot),den=Math.sin(angle),a=Math.sin((1-t)*angle)/den,b=Math.sin(t*angle)/den,lift=1+.15*Math.sin(Math.PI*t);
      return this.project((route.a.x*a+route.b.x*b)*lift,(route.a.y*a+route.b.y*b)*lift,(route.a.z*a+route.b.z*b)*lift);
    }

    drawRoutes(){
      const ctx=this.ctx,phase=this.time/this.period;
      this.routes.forEach(route=>{
        const progress=(phase*2+route.phase)%1,pulse=Math.pow(Math.sin(progress*Math.PI),2),color=route.teal?'108,244,220':'184,255,255';
        ctx.beginPath();let active=false;
        for(let i=0;i<=56;i++){
          const p=this.routePoint(route,i/56);
          if(p.z>-.12){if(active)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);active=true;}else active=false;
        }
        ctx.strokeStyle=`rgba(${color},${.04+pulse*.085})`;ctx.lineWidth=.8;ctx.stroke();
        let previous=this.routePoint(route,Math.max(0,progress-.09));
        for(let i=1;i<=12;i++){
          const t=Math.max(0,progress-.09)+Math.min(.09,progress)*i/12,p=this.routePoint(route,t);
          if(p.z>-.08){ctx.beginPath();ctx.moveTo(previous.x,previous.y);ctx.lineTo(p.x,p.y);ctx.strokeStyle=`rgba(${color},${i/12*pulse*.68})`;ctx.lineWidth=1.3;ctx.stroke();}previous=p;
        }
        const head=this.routePoint(route,progress);
        if(head.z>-.08)this.glow(head.x,head.y,7,pulse*.65);
      });
    }

    drawNetwork() {
      const ctx=this.ctx;
      for(let i=0;i<this.nodes.length;i++) {
        const n=this.nodes[i];
        this.projected[i]=this.project(n.x,n.y,n.z);
      }
      // Batch by depth to keep the globe translucent and the foreground crisp.
      for(let band=0;band<5;band++) {
        ctx.beginPath();
        for(const edge of this.links) {
          const a=this.projected[edge.a],b=this.projected[edge.b];
          const depth=(a.z+b.z)*.5;
          const bucket=Math.min(4,Math.max(0,Math.floor((depth+1)*2.5)));
          if(bucket!==band)continue;
          ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
        }
        ctx.strokeStyle=`rgba(124,217,251,${[.016,.027,.055,.09,.15][band]})`;
        ctx.lineWidth=[.45,.45,.55,.6,.7][band];
        ctx.stroke();
      }
      for(let i=0;i<this.nodes.length;i++) {
        const p=this.projected[i],node=this.nodes[i];
        const depth=(p.z+1)*.5;
        let traffic=0;
        if(node.hub){
          const phase=this.time/this.period;
          for(const route of this.routes){
            if(route.a!==node&&route.b!==node)continue;
            const progress=(phase*2+route.phase)%1,target=route.a===node?.08:.92;
            let distance=Math.abs(progress-target);distance=Math.min(distance,1-distance);
            traffic=Math.max(traffic,Math.exp(-Math.pow(distance/.105,2)));
          }
        }
        const alpha=node.hub?.25+depth*(.32+traffic*.22):node.cluster>=0?.12+depth*.29:.1+depth*.4;
        const r=(node.hub?1.15+traffic*.28:node.cluster>=0?.42+node.glow*.22:.58)*p.scale;
        ctx.fillStyle=`rgba(212,255,255,${alpha})`;
        ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();
        if(node.hub&&p.z>-.2){
          this.glow(p.x,p.y,10*p.scale,(.17+traffic*.18)*depth);
          this.glow(p.x,p.y,33*p.scale,.035*depth);
        }
      }
      ctx.globalAlpha=1;
      for(const packet of this.packets) {
        const progress=(packet.progress+this.time/this.period*packet.cycles)%1;
        const edge=this.links[packet.edge];
        const a=this.projected[edge.a],b=this.projected[edge.b];
        const depth=(a.z+b.z)*.5;
        if(depth<-.25)continue;
        const alpha=Math.sin(progress*Math.PI)*(.2+depth*.27)*1.25;
        const x=a.x+(b.x-a.x)*progress,y=a.y+(b.y-a.y)*progress;
        const tail=Math.max(0,progress-.19);
        const gradient=ctx.createLinearGradient(a.x+(b.x-a.x)*tail,a.y+(b.y-a.y)*tail,x+.01,y+.01);
        gradient.addColorStop(0,'rgba(150,255,255,0)');
        gradient.addColorStop(1,`rgba(236,255,255,${alpha})`);
        ctx.strokeStyle=gradient;ctx.lineWidth=1.2;
        ctx.beginPath();ctx.moveTo(a.x+(b.x-a.x)*tail,a.y+(b.y-a.y)*tail);ctx.lineTo(x,y);ctx.stroke();
        this.glow(x,y,6,alpha*.9);
      }
      ctx.globalAlpha=1;
    }

    draw() {
      if(!this.ctx || !this.atmosphere) return;
      const ctx=this.ctx;
      ctx.globalAlpha=1;
      ctx.drawImage(this.atmosphere,0,0,this.width,this.height);
      this.drawStars();
      // Offline video export only: another 20% over the approved sphere brightness.
      ctx.filter='brightness(120%)';
      this.drawOrbits(false);

      this.drawNetwork();
      this.drawRoutes();
      this.drawOrbits(true);
      ctx.filter='none';

      // Preserve contrast for website content on the left, without a hard edge.
      const shade=ctx.createLinearGradient(0,0,this.width*.57,0);
      shade.addColorStop(0,'rgba(5,12,19,.7)');
      shade.addColorStop(.72,'rgba(5,12,19,.35)');
      shade.addColorStop(1,'rgba(5,12,19,0)');
      ctx.fillStyle=shade;ctx.fillRect(0,0,this.width,this.height);
    }

    tick(timestamp) {
      this.frame=0;
      if(this.paused || this.reduced || document.hidden) return;
      const dt=this.last?Math.min((timestamp-this.last)/1000,.05):0;
      this.last=timestamp;
      this.time=(this.time+dt*this.speed)%this.period;
      const ease=1-Math.exp(-dt*2.5);
      this.pointer.x+=(this.pointer.targetX-this.pointer.x)*ease;
      this.pointer.y+=(this.pointer.targetY-this.pointer.y)*ease;
      this.draw();
      this.frame=requestAnimationFrame(this.tick);
    }

    syncAnimation() {
      if(this.frame) cancelAnimationFrame(this.frame);
      this.frame=0;
      this.last=0;
      if(!this.paused && !this.reduced && !document.hidden) this.frame=requestAnimationFrame(this.tick);
      else this.draw();
    }

    setPaused(value) { this.paused=Boolean(value);this.syncAnimation(); }
    setSpeed(value) { if(Number.isFinite(value))this.speed=Math.max(0,Math.min(3,value)); }
    destroy() {
      cancelAnimationFrame(this.frame);
      this.resizeObserver.disconnect();
      this.container.removeEventListener('pointermove',this.onPointer);
      this.container.removeEventListener('pointerleave',this.onPointerLeave);
      document.removeEventListener('visibilitychange',this.onVisibility);
      this.motionQuery.removeEventListener('change',this.onMotion);
    }
  }
