import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
const require=createRequire('C:/Users/qs/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/package.json');
const sharp=require('sharp');
// Delivery-size exports only: keep generated masters, composition and artwork intact.
for(const [source,target,w,h] of [['banner-v4','banner-v4-export',1920,1080],['square-v4','square-v4-export',1440,1440]]){
  await sharp(`output/store/${source}.png`).resize(w,h,{fit:'fill',kernel:'nearest'}).png({compressionLevel:9}).toFile(`output/store/${target}.png`);
}
const metadata={};
for(const name of ['app-icon-v4','banner-v4-export','square-v4-export']){
  const b=readFileSync(`output/store/${name}.png`),m=await sharp(b).metadata();
  metadata[name]={width:m.width,height:m.height,size:b.length,format:m.format};
  if(b.length>4*1024*1024)throw Error('Oversize image: '+name);
}
writeFileSync('output/store/media-v4-metadata.json',JSON.stringify(metadata,null,2)+'\n');
console.log(metadata);
