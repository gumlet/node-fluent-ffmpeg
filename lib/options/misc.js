/*jshint node:true*/


import path from 'node:path';
import { createRequire } from 'node:module';

/*
 *! Miscellaneous methods
 */

export default (proto) => {
  /**
   * Use preset
   *
   * @method FfmpegCommand#preset
   * @category Miscellaneous
   * @aliases usingPreset
   *
   * @param {String|Function} preset preset name or preset function
   */
  proto.usingPreset =
  proto.preset = function(preset) {
    if (typeof preset === 'function') {
      preset(this);
    } else {
      try {
        const modulePath = path.join(this.options.presets, preset) + '.js';
        const require = createRequire(import.meta.url);
        const module = require(modulePath);

        if (typeof module.load === 'function') {
          module.load(this);
        } else {
          throw new Error(`preset ${modulePath} has no load() function`);
        }
      } catch (err) {
        throw new Error(`preset could not be loaded: ${err.message}`);
      }
    }

    return this;
  };
};
