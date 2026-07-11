const http = require('http');
http.get('http://localhost:10082/', res => {
  let d='';
  res.on('data', c=> d += c);
  res.on('end', ()=>{
    console.log('LENGTH:' + d.length);
    console.log('HAS_NAV:' + (d.indexOf('<ul class="nav-links"')>-1));
    console.log('HAS_DOC:' + (d.indexOf('id="documentation"')>-1));
  });
}).on('error', e => console.error('ERR:' + e.message));
