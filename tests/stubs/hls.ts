export default class HlsStub {
  static isSupported() {
    return false;
  }

  static Events = {
    ERROR: 'error',
    MANIFEST_PARSED: 'manifestParsed',
  };

  on() {}
  loadSource() {}
  attachMedia() {}
  destroy() {}
}
