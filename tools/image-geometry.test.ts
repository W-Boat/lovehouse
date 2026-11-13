import test from 'node:test';
import assert from 'node:assert/strict';
import {imageSize,normalizedCrop,coverCrop,ceremonyCanvasHeight} from '../src/image-geometry';
import art from '../content/ceremony-art.json';
test('cake crop and wick anchors survive export resizing',()=>{
 for(const [width,height]of [[1536,1024],[768,512],[384,256]]){
  const crop=normalizedCrop({width,height},art.crop);
  assert.ok(crop.x>=0&&crop.y>=0&&crop.x+crop.w<=width&&crop.y+crop.h<=height);
  assert.ok(Math.abs(crop.w/crop.h-art.aspect)<1e-9);
  for(const [x,y]of art.wicks)assert.ok(x>0&&x<1&&y>0&&y<1);
 }
 assert.equal(art.wicks.length,5);
 assert.deepEqual(normalizedCrop({width:384,height:256},art.crop),{x:80,y:47.5,w:225,h:200});
});
test('cover crop fills every aspect ratio while staying inside decoded source bounds',()=>{
 for(const source of [{width:768,height:512},{width:1536,height:1024}])for(const [w,h]of [[640,296],[640,180],[640,640],[240,640]]){
  const crop=coverCrop(source,w,h);assert.ok(crop.w>0&&crop.h>0);assert.ok(crop.x>=0&&crop.y>=0);assert.ok(crop.x+crop.w<=source.width+1e-9&&crop.y+crop.h<=source.height+1e-9);assert.ok(Math.abs(crop.w/crop.h-w/h)<1e-9);
 }
 assert.equal(ceremonyCanvasHeight(2560,720),180);
 assert.equal(ceremonyCanvasHeight(844,390),296);
 assert.deepEqual(imageSize({naturalWidth:768,naturalHeight:512,width:100,height:100} as unknown as CanvasImageSource),{width:768,height:512});
});
