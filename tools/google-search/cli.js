#!/usr/bin/env node
import { search } from './index.js';

const query = process.argv.slice(2).join(' ');
if(!query){
  console.error('usage: google-search <query>');
  process.exit(1);
}
const res = await search(query);
console.log(JSON.stringify(res, null, 2));
