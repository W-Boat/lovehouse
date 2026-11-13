import http from 'node:http';
import {WebSocketServer} from 'ws';
import {RoomService} from './rooms.mjs';
import {pathToFileURL} from 'node:url';
export function createOnlineServer({origins=(process.env.ALLOWED_ORIGINS||'').split(',').filter(Boolean)}={}){
 const service=new RoomService();const server=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.writeHead(req.url==='/health'?200:404);res.end(JSON.stringify(req.url==='/health'?{ok:true,protocol:1}:{error:'Not found'}))});
 const sockets=new WebSocketServer({noServer:true,maxPayload:2100000});
 server.on('upgrade',(req,socket,head)=>{if(req.url!=='/online'||(origins.length&&!origins.includes(req.headers.origin))){socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');return}sockets.handleUpgrade(req,socket,head,ws=>sockets.emit('connection',ws,req))});
 sockets.on('connection',ws=>{let alive=true;const send=data=>{if(ws.readyState===1)ws.send(JSON.stringify(data))};ws.on('pong',()=>alive=true);ws.on('message',raw=>{try{service.receive(ws,JSON.parse(raw.toString()),send)}catch{send({type:'error',code:'INVALID',message:'消息无法解析'})}});ws.on('close',()=>service.disconnect(ws));ws.on('error',()=>{});ws.pulse=()=>{if(!alive)return ws.terminate();alive=false;ws.ping()}});
 const timer=setInterval(()=>{service.sweep();for(const ws of sockets.clients)ws.pulse()},30000);timer.unref();server.on('close',()=>{clearInterval(timer);for(const ws of sockets.clients)ws.terminate();sockets.close()});return{server,service,sockets};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const{server}=createOnlineServer();server.listen(Number(process.env.PORT||8787),process.env.HOST||'0.0.0.0',()=>console.log('Lovehouse online server ready'))}
