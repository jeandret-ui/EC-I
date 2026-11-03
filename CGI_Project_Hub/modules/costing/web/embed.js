/* CGI Project Hub: costing / quote register shown inside the hub (?embed=1&code=...&view=...) */
(function(){
  const q=new URLSearchParams(location.search);
  if(!q.get('embed'))return;
  document.documentElement.classList.add('embed');document.addEventListener('DOMContentLoaded',()=>document.body.classList.add('embed'));
  if(document.body)document.body.classList.add('embed');
  window.embedBoot=async function(){
    const code=(q.get('code')||'').trim().toUpperCase(),view=q.get('view');
    try{
      if(code&&String(P?.settings?.project_no||'').toUpperCase()!==code){
        const g=(projectIndex||[]).find(x=>String(x.code||'').toUpperCase()===code);
        if(g&&g.documents.length){P=await api('api/project?'+new URLSearchParams({id:g.documents[0].id}));CAT=P.catalogue||META.catalogue}
        else if(g){await selectProject(g)}
        else{P=await api('api/new',{name:q.get('name')||code,project_name:q.get('name')||code,project_no:code,client:q.get('client')||''});CAT=P.catalogue||META.catalogue;await refreshProjects()}
      }
    }catch(e){console.error(e)}
    if(view){page=view;if(['sheet','catalogue','markup','payments','backup','quote','audit'].includes(view))otherOpen=true}
  };
  window.addEventListener('message',e=>{if(e.data&&e.data.type==='costing-nav'&&typeof navigate==='function')navigate(e.data.view)});
  const st=document.createElement('style');
  st.textContent=`body.embed aside .brand,body.embed .project-selector,body.embed .sidebar-bottom,body.embed footer{display:none!important}
  body.embed aside{width:196px!important;padding:14px 10px!important;background:#0e2b4d!important}
  body.embed .shell{margin-left:196px!important}
  body.embed header{min-height:58px;padding-top:10px;padding-bottom:10px}
  @media(max-width:860px){body.embed aside{position:static!important;width:auto!important}body.embed .shell{margin-left:0!important}}`;
  document.head.appendChild(st);
})();
