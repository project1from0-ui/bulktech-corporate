/* Art-directed movement of the concept imagery; no camera or inference is used. */
(() => {
  const canvas = document.querySelector('.capture-motion');
  if (!canvas) return;
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: true, depth: false, powerPreference: 'low-power' });
  if (!gl) return;
  const width = 1672, height = 941;
  const rawSource = {
    hip: [1180,612], neck: [1108,290], head: [1104,202], crown: [1136,126],
    shoulder: [1150,347], elbow: [1090,460], hand: [1017,352],
    knee: [943,591], ankle: [920,815], toe: [836,870],
    backKnee: [1285,807], backAnkle: [1492,778], backToe: [1520,851]
  };
  const source=Object.fromEntries(Object.entries(rawSource).map(([key,p])=>[key,[p[0]*.83+164,p[1]*.83+10]]));
  const boneDefs = [
    ['hip','neck',78],['neck','head',60],['head','crown',54],
    ['shoulder','elbow',34],['elbow','hand',29],
    ['hip','knee',51],['knee','ankle',34],['ankle','toe',31],
    ['hip','backKnee',43],['backKnee','backAnkle',33],['backAnkle','backToe',30]
  ];
  const clamp = n => Math.min(1,Math.max(0,n));
  const smooth = n => { const t=clamp(n); return t*t*(3-2*t); };
  function distance(p,a,b) {
    const dx=b[0]-a[0],dy=b[1]-a[1];
    const t=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy));
    return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
  }
  function kneeAt(hip, ankle, original, originalHip) {
    const a=Math.hypot(original[0]-originalHip[0],original[1]-originalHip[1]);
    const b=Math.hypot(ankle[0]-original[0],ankle[1]-original[1]);
    const vx=ankle[0]-hip[0],vy=ankle[1]-hip[1],d=Math.hypot(vx,vy);
    const along=(a*a-b*b+d*d)/(2*d), perpendicular=Math.sqrt(Math.max(0,a*a-along*along));
    const sign=((ankle[0]-originalHip[0])*(original[1]-originalHip[1])-(ankle[1]-originalHip[1])*(original[0]-originalHip[0]))>0?1:-1;
    return [hip[0]+vx/d*along-vy/d*perpendicular*sign,hip[1]+vy/d*along+vx/d*perpendicular*sign];
  }
  function poseAt(amount) {
    const pose={}; Object.entries(source).forEach(([key,value])=>pose[key]=value.slice());
    const dx=-7*amount,dy=-43*amount;
    ['hip','neck','head','crown','shoulder','elbow','hand'].forEach(key=>{pose[key][0]+=dx;pose[key][1]+=dy;});
    pose.knee=kneeAt(pose.hip,pose.ankle,source.knee,source.hip);
    pose.backKnee=kneeAt(pose.hip,pose.backAnkle,source.backKnee,source.hip);
    return pose;
  }
  const cols=96,rows=54,vertices=[],weights=[],uvs=[],field=[],indices=[];
  for(let row=0;row<=rows;row++) for(let col=0;col<=cols;col++) {
    const p=[col/cols*width*.83+164,row/rows*height*.83+10]; vertices.push(p);uvs.push(col/cols,row/rows);
    const raw=boneDefs.map(([a,b,r])=>Math.exp(-Math.pow(distance(p,source[a],source[b])/27,2)) + 1e-16);
    const strongest=Math.max(...raw);
    // The background is a separate still plate; only the isolated person is skinned.
    const still=0;
    const total=raw.reduce((a,b)=>a+b,still);
    weights.push([still/total,...raw.map(w=>w/total)]);field.push(smooth(strongest*1.9));
  }
  for(let row=0;row<rows;row++) for(let col=0;col<cols;col++) {
    const a=row*(cols+1)+col,b=a+1,c=a+cols+1,d=c+1;
    indices.push(a,c,b,b,c,d);
  }
  function shader(type,sourceText){const s=gl.createShader(type);gl.shaderSource(s,sourceText);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error('Visual shader could not compile');return s;}
  let program;
  try {
    program=gl.createProgram();
    gl.attachShader(program,shader(gl.VERTEX_SHADER,`
      attribute vec2 a_position;attribute vec2 a_uv;attribute float a_field;
      varying vec2 v_uv;varying float v_field;
      void main(){v_uv=a_uv;v_field=a_field;gl_Position=vec4(a_position.x*2.0-1.0,1.0-a_position.y*2.0,0.0,1.0);}`));
    gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`
      precision mediump float;varying vec2 v_uv;varying float v_field;
      uniform sampler2D u_photo;uniform sampler2D u_data;
      uniform float u_scan;uniform float u_release;
      void main(){
        vec4 samplePhoto=texture2D(u_photo,v_uv);
        vec3 photo=samplePhoto.rgb;
        vec3 data=texture2D(u_data,v_uv).rgb*.86;
        float grey=dot(photo,vec3(.2126,.7152,.0722));
        photo=mix(vec3(grey),photo,.10)*.73;
        float boundary=mix(-.12,1.12,u_scan);
        float reveal=(1.0-smoothstep(boundary-.025,boundary+.025,v_uv.y));
        float amount=reveal*(1.0-u_release*.76);
        vec3 color=mix(photo,data,amount);
        float edge=exp(-pow((v_uv.y-boundary)*95.0,2.0))*v_field;
        color+=vec3(.75,.9,.85)*edge*.09*(1.0-u_release);
        gl_FragColor=vec4(color,samplePhoto.a);
      }`));
    gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))return;
  } catch {return;}
  gl.useProgram(program);
  function attribute(name,data,size,usage=gl.STATIC_DRAW){const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,usage);const location=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,0,0);return buffer;}
  const positions=new Float32Array(vertices.length*2);
  const positionBuffer=attribute('a_position',positions,2,gl.DYNAMIC_DRAW);
  attribute('a_uv',new Float32Array(uvs),2);attribute('a_field',new Float32Array(field),1);
  const indexBuffer=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);
  const scanUniform=gl.getUniformLocation(program,'u_scan'),releaseUniform=gl.getUniformLocation(program,'u_release');
  const textures=[];
  function loadTexture(selector,slot){
    const image=new Image();image.src=selector;
    return new Promise(resolve=>{
      const load=()=>{
        if(!image.naturalWidth){resolve(false);return;}
        const texture=gl.createTexture();textures.push(texture);
        gl.activeTexture(gl.TEXTURE0+slot);gl.bindTexture(gl.TEXTURE_2D,texture);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
        gl.uniform1i(gl.getUniformLocation(program,slot?'u_data':'u_photo'),slot);resolve(true);
      };
      if(image.complete)load();else {image.addEventListener('load',load,{once:true});image.addEventListener('error',()=>resolve(false),{once:true});}
    });
  }
  let ready=false,lost=false;
  function resize(){const targetWidth=Math.min(2200,Math.round(canvas.getBoundingClientRect().width*Math.min(devicePixelRatio||1,1.6)));const targetHeight=Math.round(targetWidth*height/width);if(canvas.width!==targetWidth||canvas.height!==targetHeight){canvas.width=targetWidth;canvas.height=targetHeight;gl.viewport(0,0,targetWidth,targetHeight);}}
  function render({amount=0,scan=0,release=0}) {
    if(!ready||lost)return null;
    const pose=poseAt(amount);
    const matrices=boneDefs.map(([a,b])=>{
      const s=source[a],e=source[b],p=pose[a],q=pose[b];
      const angle=Math.atan2(q[1]-p[1],q[0]-p[0])-Math.atan2(e[1]-s[1],e[0]-s[0]);
      const c=Math.cos(angle),sn=Math.sin(angle);
      return [c,-sn,sn,c,p[0]-c*s[0]+sn*s[1],p[1]-sn*s[0]-c*s[1]];
    });
    for(let i=0;i<vertices.length;i++) {
      const p=vertices[i],w=weights[i];let x=p[0]*w[0],y=p[1]*w[0];
      for(let j=0;j<matrices.length;j++){const m=matrices[j],weight=w[j+1];x+=(m[0]*p[0]+m[1]*p[1]+m[4])*weight;y+=(m[2]*p[0]+m[3]*p[1]+m[5])*weight;}
      positions[i*2]=x/width;positions[i*2+1]=y/height;
    }
    resize();gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,positionBuffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,positions);
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.uniform1f(scanUniform,scan);gl.uniform1f(releaseUniform,release);gl.drawElements(gl.TRIANGLES,indices.length,gl.UNSIGNED_SHORT,0);
    return pose;
  }
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;ready=false;canvas.parentElement.classList.remove('has-motion-map');window.dispatchEvent(new Event('bulk-motion-lost'));});
  // Images remain the durable fallback if WebGL is unavailable or its context is lost.
  Promise.all([loadTexture('assets/capture-person-v2.webp',0),loadTexture('assets/capture-person-analysis-v2.webp',1)]).then(loaded=>{
    if(lost||gl.isContextLost()||!loaded.every(Boolean))return;
    ready=true;render({});canvas.parentElement.classList.add('has-motion-map');window.dispatchEvent(new Event('bulk-motion-ready'));
  });
  window.BULKMotion={render,get ready(){return ready&&!lost;},poseAt};
})();
