class BrowserEngine{
  static async create(){
    throw new Error('BrowserEngine removed; use flareClient instead');
  }
  static async fromState(){
    return BrowserEngine.create();
  }
}
export { BrowserEngine };
