/*jshint node:true*/
/*global describe,it,beforeEach,afterEach,after*/
import { expect, describe, it, beforeEach, afterEach, afterAll } from 'vitest';

import Ffmpeg from '../index.js';
import path from 'node:path';
import { strict as assert } from 'node:assert';
import testhelper from './helpers.js';
import async from 'async';
import { platform } from 'node:os';

// delimiter fallback for node 0.8
const PATH_DELIMITER = path.delimiter || (platform().match(/win(32|64)/) ? ';' : ':');


describe('Capabilities', () => {
  describe('ffmpeg capabilities', () => {
    it('should enable querying for available codecs', () => {
      return new Promise((resolve, reject) => {
      new Ffmpeg({ source: '' }).getAvailableCodecs((err, codecs) => {
        testhelper.logError(err);
        if(err) reject(err)

        expect(typeof codecs).toBe('object');
        expect(Object.keys(codecs).length).not.toBe(0);

        expect('pcm_s16le' in codecs).toBe(true);
        expect('type' in codecs.pcm_s16le).toBe(true);
        expect(typeof codecs.pcm_s16le.type).toBe('string');
        expect('description' in codecs.pcm_s16le).toBe(true);
        expect(typeof codecs.pcm_s16le.description).toBe('string');
        expect('canEncode' in codecs.pcm_s16le).toBe(true);
        expect(typeof codecs.pcm_s16le.canEncode).toBe('boolean');
        expect('canDecode' in codecs.pcm_s16le).toBe(true);
        expect(typeof codecs.pcm_s16le.canDecode).toBe('boolean');
        resolve()
      });
    })
    });

    it('should enable querying for available encoders', () => {
      return new Promise((resolve, reject) => {
      new Ffmpeg({ source: '' }).getAvailableEncoders((err, encoders) => {
        testhelper.logError(err);
        if(err) reject(err)

        expect(typeof encoders).toBe('object');
        expect(Object.keys(encoders).length).not.toBe(0);

        expect('pcm_s16le' in encoders).toBe(true);
        expect('type' in encoders.pcm_s16le).toBe(true);
        expect(typeof encoders.pcm_s16le.type).toBe('string');
        expect('description' in encoders.pcm_s16le).toBe(true);
        expect(typeof encoders.pcm_s16le.description).toBe('string');
        expect('experimental' in encoders.pcm_s16le).toBe(true);
        expect(typeof encoders.pcm_s16le.experimental).toBe('boolean');
        resolve()

      });
    })
    });

    it('should enable querying for available formats', () => {
      return new Promise((resolve, reject) => {
      new Ffmpeg({ source: '' }).getAvailableFormats((err, formats) => {
        testhelper.logError(err);
        if(err) reject(err)

        expect(typeof formats).toBe('object');
        expect(Object.keys(formats).length).not.toBe(0);

        expect('wav' in formats).toBe(true);
        expect('description' in formats.wav).toBe(true);
        expect(typeof formats.wav.description).toBe('string');
        expect('canMux' in formats.wav).toBe(true);
        expect(typeof formats.wav.canMux).toBe('boolean');
        expect('canDemux' in formats.wav).toBe(true);
        expect(typeof formats.wav.canDemux).toBe('boolean');
        resolve()
      });
    })
    });

    it('should enable querying for available filters', () => {
      return new Promise((resolve, reject) => {
      new Ffmpeg({ source: '' }).getAvailableFilters((err, filters) => {
        testhelper.logError(err);
        if(err) reject(err)

        expect(typeof filters).toBe('object');
        expect(Object.keys(filters).length).not.toBe(0);

        expect('anull' in filters).toBe(true);
        expect('description' in filters.anull).toBe(true);
        expect(typeof filters.anull.description).toBe('string');
        expect('input' in filters.anull).toBe(true);
        expect(typeof filters.anull.input).toBe('string');
        expect('output' in filters.anull).toBe(true);
        expect(typeof filters.anull.output).toBe('string');
        expect('multipleInputs' in filters.anull).toBe(true);
        expect(typeof filters.anull.multipleInputs).toBe('boolean');
        expect('multipleOutputs' in filters.anull).toBe(true);
        expect(typeof filters.anull.multipleOutputs).toBe('boolean');
        resolve()
      });
    })
    });

    it('should enable querying capabilities without instanciating a command', () => {
      return new Promise((resolve, reject) => {
      Ffmpeg.getAvailableCodecs((err, codecs) => {
        testhelper.logError(err);
        if(err) reject(err);

        expect(typeof codecs).toBe('object');
        expect(Object.keys(codecs).length).not.toBe(0);

        Ffmpeg.getAvailableFilters((err, filters) => {
          testhelper.logError(err);
          assert.ok(!err);

          expect(filters).toBeTypeOf('object');
          expect(Object.keys(filters).length).not.toBe(0);

          Ffmpeg.getAvailableFormats((err, formats) => {
            testhelper.logError(err);
            assert.ok(!err);

            expect(typeof formats).toBe('object');
            expect(Object.keys(formats).length).not.toBe(0);
            resolve()
          });
        });
      });
    })
    });

    it('should enable checking command arguments for available codecs, formats and encoders', () => {
      return new Promise((resolve, reject) => {
      async.waterfall([
        // Check with everything available
        (cb) => {
          new Ffmpeg('/path/to/file.avi')
            .fromFormat('avi')
            .audioCodec('pcm_u16le')
            .videoCodec('png')
            .toFormat('mp4')
            ._checkCapabilities(cb);
        },

        // Invalid input format
        (cb) => {
          new Ffmpeg('/path/to/file.avi')
            .fromFormat('invalid-input-format')
            .audioCodec('pcm_u16le')
            .videoCodec('png')
            .toFormat('mp4')
            ._checkCapabilities((err) => {
              assert.ok(!!err);
              expect(err.message).toMatch(/Input format invalid-input-format is not available/);

              cb();
            });
        },

        // Invalid output format
        (cb) => {
          new Ffmpeg('/path/to/file.avi')
            .fromFormat('avi')
            .audioCodec('pcm_u16le')
            .videoCodec('png')
            .toFormat('invalid-output-format')
            ._checkCapabilities((err) => {
              assert.ok(!!err);
              expect(err.message).toMatch(/Output format invalid-output-format is not available/);

              cb();
            });
        },

        // Invalid audio codec
        (cb) => {
          new Ffmpeg('/path/to/file.avi')
            .fromFormat('avi')
            .audioCodec('invalid-audio-codec')
            .videoCodec('png')
            .toFormat('mp4')
            ._checkCapabilities((err) => {
              assert.ok(!!err);
              expect(err.message).toMatch(/Audio codec invalid-audio-codec is not available/);

              cb();
            });
        },

        // Invalid video codec
        (cb) => {
          new Ffmpeg('/path/to/file.avi')
            .fromFormat('avi')
            .audioCodec('pcm_u16le')
            .videoCodec('invalid-video-codec')
            .toFormat('mp4')
            ._checkCapabilities((err) => {
              assert.ok(!!err);
              expect(err.message).toMatch(/Video codec invalid-video-codec is not available/);

              cb();
            });
        },

        // Invalid audio encoder
        (cb) => {
          new Ffmpeg('/path/to/file.avi')
            .fromFormat('avi')
            // Valid codec, but not a valid encoder for audio
            .audioCodec('png')
            .videoCodec('png')
            .toFormat('mp4')
            ._checkCapabilities((err) => {
              assert.ok(!!err);
              expect(err.message).toMatch(/Audio codec png is not available/);

              cb();
            });
        },

        // Invalid video encoder
        (cb) => {
          new Ffmpeg('/path/to/file.avi')
            .fromFormat('avi')
            .audioCodec('pcm_u16le')
            // Valid codec, but not a valid encoder for video
            .videoCodec('pcm_u16le')
            .toFormat('mp4')
            ._checkCapabilities((err) => {
              assert.ok(!!err);
              expect(err.message).toMatch(/Video codec pcm_u16le is not available/);

              cb();
            });
        }
      ], (err) => {
        testhelper.logError(err);
        assert.ok(!err);
        resolve()
      });
    })
    });

    it('should check capabilities before running a command', () => {
      return new Promise((resolve, reject) => {
      new Ffmpeg('/path/to/file.avi')
        .on('error', (err) => {
          expect(err.message).toMatch(/Output format invalid-output-format is not available/);
          resolve()
        })
        .toFormat('invalid-output-format')
        .saveToFile('/tmp/will-not-be-created.mp4');
      })
    });
  });

  describe('ffmpeg path', () => {
    var FFMPEG_PATH;
    var ALT_FFMPEG_PATH;
    var skipAltTest = false;

    // Only test with FFMPEG_PATH when we actually have an alternative path
    if (process.env.ALT_FFMPEG_PATH) {
      ALT_FFMPEG_PATH = process.env.ALT_FFMPEG_PATH;
    } else {
      skipAltTest = true;
    }

    beforeEach(() => {
      // Save environment before each test
      FFMPEG_PATH = process.env.FFMPEG_PATH;
    });

    afterEach(() => {
      // Restore environment after each test
      process.env.FFMPEG_PATH = FFMPEG_PATH;
    });

    afterAll(() => {
      // Forget paths after all tests
      (new Ffmpeg())._forgetPaths();
    });

    it('should allow manual definition of ffmpeg binary path', () => {
      var ff = new Ffmpeg();

      ff.setFfmpegPath('/doom/di/dom');
      return new Promise((resolve) => {
      ff._getFfmpegPath((err, ffmpeg) => {
        testhelper.logError(err);
        assert.ok(!err);

        expect(ffmpeg).toBe('/doom/di/dom');
        resolve()
      });
    })
    });

    it('should allow static manual definition of ffmpeg binary path', () => {
      var ff = new Ffmpeg();

      Ffmpeg.setFfmpegPath('/doom/di/dom2');
      return new Promise((resolve) => {
      ff._getFfmpegPath((err, ffmpeg) => {
        testhelper.logError(err);
        assert.ok(!err);

        expect(ffmpeg).toBe('/doom/di/dom2');
        resolve()
      });
    })
    });

    it('should look for ffmpeg in the PATH if FFMPEG_PATH is not defined', () => {
      var ff = new Ffmpeg();

      delete process.env.FFMPEG_PATH;

      ff._forgetPaths();
      return new Promise((resolve) => {
      ff._getFfmpegPath((err, ffmpeg) => {
        testhelper.logError(err);
        assert.ok(!err);

        expect(typeof ffmpeg).toBe('string');
        expect(ffmpeg.length).toBeGreaterThan(0);

        var paths = process.env.PATH.split(PATH_DELIMITER);
        expect(paths.indexOf(path.dirname(ffmpeg))).toBeGreaterThan(-1);
        resolve()
      });
    })
    });

    (skipAltTest ? it.skip : it)('should use FFMPEG_PATH if defined and valid', () => {
      var ff = new Ffmpeg();

      process.env.FFMPEG_PATH = ALT_FFMPEG_PATH;

      ff._forgetPaths();
      return new Promise((resolve) => {
      ff._getFfmpegPath((err, ffmpeg) => {
        testhelper.logError(err);
        assert.ok(!err);

        expect(ffmpeg).toBe(ALT_FFMPEG_PATH);
        resolve()
      });
    })
    });

    it('should fall back to searching in the PATH if FFMPEG_PATH is invalid', () => {
      var ff = new Ffmpeg();

      process.env.FFMPEG_PATH = '/nope/not-here/nothing-to-see-here';

      ff._forgetPaths();
      return new Promise((resolve) => {
      ff._getFfmpegPath((err, ffmpeg) => {
        testhelper.logError(err);
        assert.ok(!err);

        expect(typeof ffmpeg).toBe('string');
        expect(ffmpeg.length).toBeGreaterThan(0);

        var paths = process.env.PATH.split(PATH_DELIMITER);
        expect(paths.indexOf(path.dirname(ffmpeg))).toBeGreaterThan(-1);
        resolve()
      });
    })
    });

    it('should remember ffmpeg path', () => {
      var ff = new Ffmpeg();

      delete process.env.FFMPEG_PATH;

      ff._forgetPaths();
      return new Promise((resolve) => {
      ff._getFfmpegPath((err, ffmpeg) => {
        testhelper.logError(err);
        assert.ok(!err);

        expect(typeof ffmpeg).toBe('string');
        expect(ffmpeg.length).toBeGreaterThan(0);

        // Just check that the callback is actually called synchronously
        // (which indicates no which call was made)
        var after = 0;
        ff._getFfmpegPath((err, ffmpeg) => {
          testhelper.logError(err);
          assert.ok(!err);

          expect(typeof ffmpeg).toBe('string');
          expect(ffmpeg.length).toBeGreaterThan(0);
          expect(after).toBe(0);
          resolve()
        });

        after = 1;
      });
    })
    });
  });

  describe('ffprobe path', () => {
    var FFPROBE_PATH;
    var ALT_FFPROBE_PATH;
    var skipAltTest = false;

    // Only test with FFPROBE_PATH when we actually have an alternative path
    if (process.env.ALT_FFPROBE_PATH) {
      ALT_FFPROBE_PATH = process.env.ALT_FFPROBE_PATH;
    } else {
      skipAltTest = true;
    }

    beforeEach(() => {
      // Save environment before each test
      FFPROBE_PATH = process.env.FFPROBE_PATH;
    });

    afterEach(() => {
      // Restore environment after each test
      process.env.FFPROBE_PATH = FFPROBE_PATH;
    });

    afterAll(() => {
      // Forget paths after all tests
      (new Ffmpeg())._forgetPaths();
    });

    it('should allow manual definition of ffprobe binary path', () => {
      var ff = new Ffmpeg();

      ff.setFfprobePath('/doom/di/dom');
      return new Promise((resolve) => {
      ff._getFfprobePath((err, ffprobe) => {
        testhelper.logError(err);
        assert.ok(!err);

        expect(ffprobe).toBe('/doom/di/dom');
        resolve()
      });
    })
    });

    it('should allow static manual definition of ffprobe binary path', () => {
      var ff = new Ffmpeg();

      Ffmpeg.setFfprobePath('/doom/di/dom2');
      return new Promise((resolve) => {
      ff._getFfprobePath((err, ffprobe) => {
        testhelper.logError(err);
        assert.ok(!err);

        expect(ffprobe).toBe('/doom/di/dom2');
        resolve()
      });
    })
    });

    it('should look for ffprobe in the PATH if FFPROBE_PATH is not defined', () => {
      var ff = new Ffmpeg();

      delete process.env.FFPROBE_PATH;

      ff._forgetPaths();
      return new Promise((resolve) => {
      ff._getFfprobePath((err, ffprobe) => {
        testhelper.logError(err);
        assert.ok(!err);

        expect(typeof ffprobe).toBe('string');
        expect(ffprobe.length).toBeGreaterThan(0);

        var paths = process.env.PATH.split(PATH_DELIMITER);
        expect(paths.indexOf(path.dirname(ffprobe))).toBeGreaterThan(-1);
        resolve()
      });
    })
    });

    (skipAltTest ? it.skip : it)('should use FFPROBE_PATH if defined and valid', () => {
      var ff = new Ffmpeg();

      process.env.FFPROBE_PATH = ALT_FFPROBE_PATH;

      ff._forgetPaths();
      return new Promise((resolve) => {
      ff._getFfprobePath((err, ffprobe) => {
        testhelper.logError(err);
        assert.ok(!err);

        expect(ffprobe).toBe(ALT_FFPROBE_PATH);
        resolve()
      });
    })
    });

    it('should fall back to searching in the PATH if FFPROBE_PATH is invalid', () => {
      var ff = new Ffmpeg();

      process.env.FFPROBE_PATH = '/nope/not-here/nothing-to-see-here';

      ff._forgetPaths();
      return new Promise((resolve) => {
      ff._getFfprobePath((err, ffprobe) => {
        testhelper.logError(err);
        assert.ok(!err);

        expect(typeof ffprobe).toBe('string');
        expect(ffprobe.length).toBeGreaterThan(0);

        var paths = process.env.PATH.split(PATH_DELIMITER);
        expect(paths.indexOf(path.dirname(ffprobe))).toBeGreaterThan(-1);
        resolve()
      });
    })
    });

    it('should remember ffprobe path', () => {
      var ff = new Ffmpeg();

      delete process.env.FFPROBE_PATH;

      ff._forgetPaths();
      return new Promise((resolve) => {
      ff._getFfprobePath((err, ffprobe) => {
        testhelper.logError(err);
        assert.ok(!err);

        expect(typeof ffprobe).toBe('string');
        expect(ffprobe.length).toBeGreaterThan(0);

        // Just check that the callback is actually called synchronously
        // (which indicates no which call was made)
        var after = 0;
        ff._getFfprobePath((err, ffprobe) => {
          testhelper.logError(err);
          assert.ok(!err);

          expect(typeof ffprobe).toBe('string');
          expect(ffprobe.length).toBeGreaterThan(0);
          expect(after).toBe(0);

          resolve()
        });

        after = 1;
      });
    })
    });
  });

  describe('flvtool path', () => {
    var FLVTOOL2_PATH;
    var ALT_FLVTOOL_PATH;
    var skipAltTest = false;
    var skipTest = false;
    
    if (process.env.FLVTOOL2_PRESENT === 'no') {
      skipTest = true;
    }

    // Only test with FLVTOOL2_PATH when we actually have an alternative path
    if (process.env.ALT_FLVTOOL_PATH) {
      ALT_FLVTOOL_PATH = process.env.ALT_FLVTOOL_PATH;
    } else {
      skipAltTest = true;
    }

    beforeEach(() => {
      // Save environment before each test
      FLVTOOL2_PATH = process.env.FLVTOOL2_PATH;
    });

    afterEach(() => {
      // Restore environment after each test
      process.env.FLVTOOL2_PATH = FLVTOOL2_PATH;
    });

    afterAll(() => {
      // Forget paths after all tests
      (new Ffmpeg())._forgetPaths();
    });

    (skipTest ? it.skip : it)('should allow manual definition of fflvtool binary path', () => {
      var ff = new Ffmpeg();

      ff.setFlvtoolPath('/doom/di/dom');
      return new Promise((resolve) => {
      ff._getFlvtoolPath((err, fflvtool) => {
        testhelper.logError(err);
        expect(err).toBeNull();

        expect(fflvtool).toBe('/doom/di/dom');
        resolve()
      });
    })
    });

    (skipTest ? it.skip : it)('should allow static manual definition of fflvtool binary path', () => {
      var ff = new Ffmpeg();

      Ffmpeg.setFlvtoolPath('/doom/di/dom2');
      return new Promise((resolve) => {
      ff._getFlvtoolPath((err, fflvtool) => {
        testhelper.logError(err);
        expect(err).toBeNull();
        expect(fflvtool).toBe('/doom/di/dom2')
        resolve()
      });
    });
    });

    (skipTest ? it.skip : it)('should look for fflvtool in the PATH if FLVTOOL2_PATH is not defined', () => {
      var ff = new Ffmpeg();

      delete process.env.FLVTOOL2_PATH;
      return new Promise((resolve) => {
        ff._forgetPaths();
        ff._getFlvtoolPath((err, fflvtool) => {
        testhelper.logError(err);
        expect(err).toBeNull();

        expect(typeof fflvtool).toBe('string');
        expect(fflvtool).toHaveLengthGreaterThan(0);

        var paths = process.env.PATH.split(PATH_DELIMITER);
        expect(paths).toContain(path.dirname(fflvtool))
        resolve()
      });
    })
    });

    (skipTest || skipAltTest ? it.skip : it)('should use FLVTOOL2_PATH if defined and valid', () => {
      var ff = new Ffmpeg();

      process.env.FLVTOOL2_PATH = ALT_FLVTOOL_PATH;

      return new Promise((resolve) => {
        ff._forgetPaths();
        ff._getFlvtoolPath((err, fflvtool) => {
        testhelper.logError(err);
        expect(err).toBeNull();

        expect(fflvtool).toBe(ALT_FLVTOOL_PATH);
        resolve()
      });
    })
    });

    (skipTest ? it.skip : it)('should fall back to searching in the PATH if FLVTOOL2_PATH is invalid', () => {
      var ff = new Ffmpeg();

      process.env.FLVTOOL2_PATH = '/nope/not-here/nothing-to-see-here';

      ff._forgetPaths();
      return new Promise((resolve) => {
      ff._getFlvtoolPath((err, fflvtool) => {
        testhelper.logError(err);
        expect(err).toBeNull();

        expect(typeof fflvtool).toBe('string');
        expect(fflvtool).toHaveLengthGreaterThan(0);

        var paths = process.env.PATH.split(PATH_DELIMITER);
        expect(paths).toContain(path.dirname(fflvtool));
        resolve()
      });
    })
    });

    (skipTest ? it.skip : it)('should remember fflvtool path', () => {
      var ff = new Ffmpeg();

      delete process.env.FLVTOOL2_PATH;

      ff._forgetPaths();
      return new Promise((resolve) => {
      ff._getFlvtoolPath((err, fflvtool) => {
        testhelper.logError(err);
        expect(err).toBeNull();

        expect(typeof fflvtool).toBe('string');
        expect(fflvtool).toHaveLengthGreaterThan(0);

        // Just check that the callback is actually called synchronously
        // (which indicates no which call was made)
        var after = 0;
        ff._getFlvtoolPath((err, fflvtool) => {
          testhelper.logError(err);
          expect(err).toBeNull();

          expect(typeof fflvtool).toBe('string');
          expect(fflvtool).toHaveLengthGreaterThan(0);
          expect(after).toBe(0);

          resolve()
        });

        after = 1;
      });
    })
    });
  });

});
