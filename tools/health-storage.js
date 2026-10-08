'use strict';
const path=require('path');
const {createStorage}=require('../server/storage');
const s=createStorage({root:path.join(__dirname,'..'),dataFile:path.join(__dirname,'..','data','db.json')});
const health=s.health();
console.log(JSON.stringify(health,null,2));
process.exit(health.healthy?0:1);
