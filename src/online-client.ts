import {serverAddress} from './online-address';
export type ConnectionState='offline'|'connecting'|'connected'|'reconnecting'|'error';
type Envelope={type:string;[key:string]:unknown};
type Entry={type:'create';name:string;appearance?:unknown}|{type:'join';roomId:string;name:string;appearance?:unknown};
/** Transport owns sockets and retry timers. It never changes game coordinates. */
export class OnlineClient{
 private socket?:WebSocket;private generation=0;private timer?:ReturnType<typeof setTimeout>;
 private address='';private entry?:Entry;private retries=0;private closed=true;
 private credentials?:{roomId:string;token:string};
 state:ConnectionState='offline';
 constructor(private receive:(message:Envelope)=>void,private changed:(state:ConnectionState,message?:string)=>void,private Socket:typeof WebSocket=WebSocket){}
 connect(address:string,entry:Entry,pageUrl=location.href,defaultServer=''){
  const target=serverAddress(address,pageUrl,defaultServer);
  this.disconnect();this.address=target;this.entry=entry;this.credentials=undefined;this.retries=0;this.closed=false;this.open();
 }
 private status(value:ConnectionState,message?:string){this.state=value;this.changed(value,message)}
 private open(){
  if(this.closed)return;const generation=++this.generation;
  this.status(this.retries?'reconnecting':'connecting');
  let socket:WebSocket;
  try{socket=new this.Socket(this.address)}catch{this.status('error','无法打开联机连接');return}
  this.socket=socket;
  socket.onopen=()=>{if(generation!==this.generation||this.closed)return;socket.send(JSON.stringify(this.credentials?{type:'resume',...this.credentials}:this.entry))};
  socket.onmessage=event=>{
   if(generation!==this.generation||this.closed||typeof event.data!=='string'||event.data.length>2500000)return;
   let message:Envelope;try{message=JSON.parse(event.data)}catch{return}
   if(!message||typeof message.type!=='string')return;
   if(message.type==='welcome'){
    if(typeof message.roomId!=='string'||typeof message.token!=='string')return;
    this.credentials={roomId:message.roomId,token:message.token};this.retries=0;this.status('connected');
   }
   if(message.type==='error'&&this.state!=='connected'){
    this.closed=true;this.status('error',typeof message.message==='string'?message.message:'未能加入房间');socket.close();
   }
   this.receive(message);
  };
  socket.onerror=()=>{/* close supplies the single retry path */};
  socket.onclose=()=>{
   if(generation!==this.generation||this.closed)return;
   if(!this.credentials||this.retries>=6){this.status('error','联机连接中断，请重新连接');return}
   this.status('reconnecting','连接中断，正在尝试回到房间');
   this.timer=setTimeout(()=>{this.timer=undefined;this.open()},Math.min(8000,500*2**this.retries++));
  };
 }
 send(message:Envelope){
  if(this.state!=='connected'||this.socket?.readyState!==1)return false;
  this.socket.send(JSON.stringify(message));return true;
 }
 disconnect(){
  this.closed=true;++this.generation;if(this.timer)clearTimeout(this.timer);this.timer=undefined;
  const socket=this.socket;this.socket=undefined;
  if(socket?.readyState===1)socket.send(JSON.stringify({type:'leave'}));
  socket?.close();this.credentials=undefined;this.status('offline');
 }
}
