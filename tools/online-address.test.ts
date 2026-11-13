import test from 'node:test';
import assert from 'node:assert/strict';
import {serverAddress} from '../src/online-address';
test('online address supports configurable defaults and keeps explicit reverse-proxy paths',()=>{
 assert.equal(serverAddress('','https://cottage.example/birthday/'),'wss://cottage.example/online');
 assert.equal(serverAddress('','https://cottage.example/','https://rooms.example/couple'),'wss://rooms.example/couple');
 assert.equal(serverAddress('wss://rooms.example','https://cottage.example/'),'wss://rooms.example/online');
 assert.equal(serverAddress('http://127.0.0.1:8765','http://example.test/'),'ws://127.0.0.1:8765/online');
});
test('unsafe or unusable server addresses fail before opening any connection',()=>{
 for(const address of ['javascript:alert(1)','file:///hello','wss://user:pass@example.test/','wss://example.test/#token','ws://example.test/'])assert.throws(()=>serverAddress(address,'https://cottage.example/'));
 assert.throws(()=>serverAddress('','tauri://localhost/'));
});
