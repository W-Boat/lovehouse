/** No public third-party server is contacted until the player chooses Connect. */
export function serverAddress(value:string,pageUrl:string,defaultServer=''){
 const page=new URL(pageUrl),input=value.trim()||defaultServer.trim();
 if(!input&&page.protocol!=='http:'&&page.protocol!=='https:')throw Error('客户端请先填写联机服务器地址');
 const url=new URL(input||'/online',page);
 if(url.protocol==='https:')url.protocol='wss:';
 else if(url.protocol==='http:')url.protocol='ws:';
 if(!['ws:','wss:'].includes(url.protocol))throw Error('服务器地址需要使用 ws、wss、http 或 https');
 if(url.username||url.password||url.hash)throw Error('服务器地址不能包含账号、密码或片段');
 if(page.protocol==='https:'&&url.protocol!=='wss:')throw Error('当前网页需要安全的 wss 联机地址');
 if(!url.pathname||url.pathname==='/')url.pathname='/online';
 return url.href;
}
