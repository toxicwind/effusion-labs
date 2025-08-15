import { fetchMarkdown } from '../../lib/markdownGateway.js';

class BrowserEngine{
  static async create(url){
    return fetchMarkdown(url);
  }
  static async fromState(url){
    return BrowserEngine.create(url);
  }
}

export { BrowserEngine };
