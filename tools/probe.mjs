import fs from 'fs';
const out=[];
for (const p of ['/', '/rooms', '/index.html', '/index', '/admin', '/admin/', '/foo', '/admin/magic/test123', '/booking']) {
  const r = await fetch('https://horizon-br6n.vercel.app'+p, {redirect:'manual'});
  out.push({p, status:r.status, loc:r.headers.get('location'), xvc:r.headers.get('x-vercel-error'), cache:r.headers.get('x-vercel-cache'), len:(await r.text()).length});
}
const dir=process.env.OUT||'probe'; fs.mkdirSync(dir,{recursive:true}); fs.writeFileSync(dir+'/probe.json', JSON.stringify(out,null,1));
