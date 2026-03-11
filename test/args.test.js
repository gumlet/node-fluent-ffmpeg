/*jshint node:true*/
/*global describe,it,before*/
import { expect, describe, it, beforeAll } from 'vitest';

import Ffmpeg from '../index.js';
import utils from '../lib/utils.js';
import path from 'node:path';
import fs from 'node:fs';
import { strict as assert } from 'node:assert';
import testhelper from './helpers.js';
import util from 'node:util';
const __dirname = import.meta.dirname;
const exec = util.promisify(require('node:child_process').exec);

Ffmpeg.prototype._test_getArgs = function (callback) {
  var args;

  try {
    args = this._getArguments();
  } catch (e) {
    return callback(null, e);
  }

  callback(args);
};

Ffmpeg.prototype._test_getSizeFilters = function () {
  return utils.makeFilterStrings(this._currentOutput.sizeFilters.get())
    .concat(this._currentOutput.videoFilters.get());
};


describe('Command', () => {
  let testfile, testfilewide;
  beforeAll(async () => {
    // check for ffmpeg installation
    testfile = path.join(__dirname, 'assets', 'testvideo-43.avi');
    testfilewide = path.join(__dirname, 'assets', 'testvideo-169.avi');
    await exec(testhelper.getFfmpegCheck());
    await fs.promises.access(testfile, fs.constants.F_OK);
  });

  describe('Constructor', () => {
    it('should enable calling the constructor without new', () => {
      expect(Ffmpeg()).toBeInstanceOf(Ffmpeg);
    });
  });

  describe('usingPreset', () => {
    it('should properly generate the command for the requested preset', () => {
      return new Promise((resolve) => {
        new Ffmpeg({ source: testfile, logger: testhelper.logger })
          .usingPreset('podcast')
          ._test_getArgs((args, err) => {
            testhelper.logArgError(err);
            assert.ok(!err);

            expect(args.length).toBe(42);
            resolve();
          });
      });
    });

    it('should properly generate the command for the requested preset in custom folder', () => {
      return new Promise((resolve) => {
        new Ffmpeg({ source: testfile, nolog: true, preset: path.join(__dirname, 'assets', 'presets') })
          .usingPreset('custompreset')
          ._test_getArgs((args) => {
            expect(args.length).toBe(42);
            resolve();
          });
      });
    });

    it('should allow using functions as presets', () => {
      return new Promise((resolve) => {
        var presetArg;

        function presetFunc(command) {
          presetArg = command;
          command.withVideoCodec('libx264');
          command.withAudioFrequency(22050);
        }

        var cmd = new Ffmpeg({ source: testfile, logger: testhelper.logger });

        cmd
          .usingPreset(presetFunc)
          ._test_getArgs((args, err) => {
            testhelper.logArgError(err);
            assert.ok(!err);

            expect(presetArg).toEqual(cmd);
            expect(args.join(' ')).toContain('-vcodec libx264');
            expect(args.join(' ')).toContain('-ar 22050');
            resolve();
          });
      });
    });

    it('should throw an exception when a preset is not found', () => {
      expect(() => {
        new Ffmpeg({ source: testfile, logger: testhelper.logger })
          .usingPreset('NOTFOUND');
      }).toThrow(/preset could not be loaded/);
    });

    it('should throw an exception when a preset has no load function', () => {
      expect(() => {
        new Ffmpeg({ presets: '../../lib' }).usingPreset('utils');
      }).toThrow(/has no load\(\) function/);
    });
  });

  describe('withNoVideo', () => {
    it('should apply the skip video argument', () => {
      return new Promise((resolve) => {
        new Ffmpeg({ source: testfile, logger: testhelper.logger })
          .withNoVideo()
          ._test_getArgs((args, err) => {
            testhelper.logArgError(err);
            assert.ok(!err);
            expect(args).toContain('-vn');
            resolve();
          });
      });
    });
    it('should skip any video transformation options', () => {
      return new Promise((resolve) => {
        new Ffmpeg({ source: testfile, logger: testhelper.logger })
          .withSize('320x?')
          .withNoVideo()
          .withAudioBitrate('256k')
          ._test_getArgs((args, err) => {
            testhelper.logArgError(err);
            assert.ok(!err);
            expect(args).toContain('-vn');
            expect(args).not.toContain('-s');
            expect(args).toContain('-b:a');
            resolve();
          });
      });
    });
  });

  describe('withNoAudio', () => {
    it('should apply the skip audio argument', () => {
      return new Promise((resolve) => {
        new Ffmpeg({ source: testfile, logger: testhelper.logger })
          .withNoAudio()
          ._test_getArgs((args, err) => {
            testhelper.logArgError(err);
            assert.ok(!err);

            expect(args).toContain('-an');
            resolve();
          });
      });
    });
    it('should skip any audio transformation options', () => {
      return new Promise((resolve) => {
        new Ffmpeg({ source: testfile, logger: testhelper.logger })
          .withAudioChannels(2)
          .withNoAudio()
          .withSize('320x?')
          ._test_getArgs((args, err) => {
            testhelper.logArgError(err);
            assert.ok(!err);

            expect(args).toContain('-an');
            expect(args).not.toContain('-ac');
            expect(args).toContain('scale=w=320:h=trunc(ow/a/2)*2');
            resolve();
          });
      });
    });
  });

  describe('withVideoBitrate', () => {
    it('should apply default bitrate argument by default', () => {
      return new Promise((resolve) => {
        new Ffmpeg({ source: testfile, logger: testhelper.logger })
          .withVideoBitrate('256k')
          ._test_getArgs((args, err) => {
            testhelper.logArgError(err);
            assert.ok(!err);

            expect(args).toContain('-b:v');
            resolve();
          });
      });
    });
    it('should apply additional bitrate arguments for constant bitrate', () => {
      return new Promise((resolve) => {
        new Ffmpeg({ source: testfile, logger: testhelper.logger })
          .withVideoBitrate('256k', true)
          ._test_getArgs((args, err) => {
            testhelper.logArgError(err);
            assert.ok(!err);

            expect(args).toContain('-b:v');
            expect(args).toContain('-maxrate');
            expect(args).toContain('-minrate');
            expect(args).toContain('-bufsize');
            resolve();
          });
      });
    });
  });

  describe('withMultiFile', () => {
    it('should allow image2 multi-file input format', () => {
      return new Promise((resolve) => {
        new Ffmpeg({ source: 'image-%05d.png', logger: testhelper.logger })
          ._test_getArgs((args, err) => {
            testhelper.logArgError(err);
            assert.ok(!err);

            expect(args).toContain('-i');
            expect(args).toContain('image-%05d.png');
            resolve();
          });
      });
    });
  });

  describe('withFps', () => {
    it('should apply the rate argument', () => {
      return new Promise((resolve) => {
        new Ffmpeg({ source: testfile, logger: testhelper.logger })
          .withFps(27.77)
          ._test_getArgs((args, err) => {
            testhelper.logArgError(err);
            assert.ok(!err);

            expect(args).toContain('-r');
            expect(args).toContain(27.77);
            resolve();
          });
      });
    });
  });

  describe('withInputFPS', () => {
    it('should apply the rate argument', () => {
      return new Promise((resolve) => {
        new Ffmpeg({ source: testfile, logger: testhelper.logger })
          .withInputFPS(27.77)
          ._test_getArgs((args, err) => {
            testhelper.logArgError(err);
            assert.ok(!err);

            expect(args).toContain('-r');
            expect(args).toContain(27.77);
            resolve();
          });
      });
    });
  });

  describe('native', () => {
    it('should apply the native framerate argument', () => {
      return new Promise((resolve) => {
        new Ffmpeg({ source: testfile, logger: testhelper.logger })
          .native()
          ._test_getArgs((args, err) => {
            testhelper.logArgError(err);
            assert.ok(!err);

            expect(args).toContain('-re');
            resolve();
          });
      });
    });
  });

  describe('addingAdditionalInput', () => {
    it('should allow for additional inputs', () => {
      return new Promise((resolve) => {
        new Ffmpeg({ source: testfile, logger: testhelper.logger })
          .addInput('soundtrack.mp3')
          ._test_getArgs((args, err) => {
            testhelper.logArgError(err);
            assert.ok(!err);

            expect(args).toContain('-i');
            expect(args).toContain('soundtrack.mp3');
            resolve();
          });
      });
    });

    it('should fail to add invalid inputs', () => {
      expect(() => {
        new Ffmpeg().addInput({});
      }).to.throw(/Invalid input/);
    });

    it('should refuse to add more than 1 input stream', () => {
      var stream1 = fs.createReadStream(testfile);
      var stream2 = fs.createReadStream(testfilewide);
      var command = new Ffmpeg().addInput(stream1);

      expect(() => command.addInput(stream2)).to.throw(/Only one input stream is supported/)
    });

    it('should fail on input-related options when no input was added', () => {
      expect(() => {
        new Ffmpeg().inputFormat('avi');
      }).to.throw(/No input specified/);

      expect(() => {
        new Ffmpeg().inputFps(24);
      }).to.throw(/No input specified/);

      expect(() => {
        new Ffmpeg().seekInput(1);
      }).to.throw(/No input specified/);

      expect(() => {
        new Ffmpeg().loop();
      }).to.throw(/No input specified/);

      expect(() => {
        new Ffmpeg().inputOptions('-anoption');
      }).to.throw(/No input specified/);
    });
  });

  describe('withVideoCodec', () => {
    it('should apply the video codec argument', () => {
      return new Promise((resolve) => {
        new Ffmpeg({ source: testfile, logger: testhelper.logger })
          .withVideoCodec('libx264')
          ._test_getArgs((args, err) => {
            testhelper.logArgError(err);
            assert.ok(!err);

            expect(args).toContain('-vcodec');
            expect(args).toContain('libx264');
            resolve();
          });
      });
    });
  });

  describe('withVideoFilter', () => {
    it('should apply the video filter argument', () => {
      return new Promise((resolve) => {
        new Ffmpeg({ source: testfile, logger: testhelper.logger })
          .withVideoFilter('scale=123:456')
          .withVideoFilter('pad=1230:4560:100:100:yellow')
          .withVideoFilter('multiple=1', 'filters=2')
          ._test_getArgs((args, err) => {
            testhelper.logArgError(err);
            assert.ok(!err);

            expect(args).toContain('-filter:v');
            expect(args).toContain('scale=123:456,pad=1230:4560:100:100:yellow,multiple=1,filters=2');
            resolve();
          });
      });
    });

    it('should accept filter arrays', () => {
      return new Promise((resolve) => {
        new Ffmpeg({ source: testfile, logger: testhelper.logger })
          .withVideoFilter(['multiple=1', 'filters=2'])
          ._test_getArgs((args, err) => {
            testhelper.logArgError(err);
            assert.ok(!err);

            expect(args).toContain('-filter:v');
            expect(args).toContain('multiple=1,filters=2');
            resolve();
          });
      });
    });

    it('should enable using filter objects', () => {
      return new Promise((resolve) => {
        new Ffmpeg({ source: testfile, logger: testhelper.logger })
          .withVideoFilter(
            {
              filter: 'option_string',
              options: 'opt1=value1:opt2=value2'
            },
            {
              filter: 'unnamed_options',
              options: ['opt1', 'opt2']
            },
            {
              filter: 'named_options',
              options: {
                opt1: 'value1',
                opt2: 'value2'
              }
            }
          )
          ._test_getArgs((args, err) => {
            testhelper.logArgError(err);
            assert.ok(!err);

            expect(args).toContain('-filter:v');
            expect(args).toContain('option_string=opt1=value1:opt2=value2,unnamed_options=opt1:opt2,named_options=opt1=value1:opt2=value2');
            resolve();
          });
      });
    });
  });

  describe('withAudioBitrate', () => {
    it('should apply the audio bitrate argument', () => {
      return new Promise((resolve) => {
        new Ffmpeg({ source: testfile, logger: testhelper.logger })
          .withAudioBitrate(256)
          ._test_getArgs((args, err) => {
            testhelper.logArgError(err);
            assert.ok(!err);

            expect(args).toContain('-b:a');
            expect(args).toContain('256k');
            resolve();
          });
      });
    });
  });

  describe('loop', () => {
    it('should add the -loop 1 argument', () => {
      return new Promise((resolve, reject) => {
        new Ffmpeg({ source: testfile, logger: testhelper.logger })
          .loop()
          ._test_getArgs((args, err) => {
            testhelper.logArgError(err);
            assert.ok(!err);

            if (args.indexOf('-loop') !== -1 || args.indexOf('-loop_output') !== -1) {
              // everything is good
            }
            else {
              reject(new Error('args should contain loop or loop_output'));
            }
            resolve();
          });
      });
    });
    it('should add the -loop 1 and a time argument (seconds)', () => {
      return new Promise((resolve, reject) => {
        new Ffmpeg({ source: testfile, logger: testhelper.logger })
          .loop(120)
          ._test_getArgs((args, err) => {
            testhelper.logArgError(err);
            assert.ok(!err);

            if (args.indexOf('-loop') !== -1 || args.indexOf('-loop_output') !== -1) {
              expect(args).toContain('-t');
              expect(args).toContain(120);
            }
            else {
              reject(new Error('args should contain loop or loop_output'));
            }
            resolve();
          });
      });
    });
    it('should add the -loop 1 and a time argument (timemark)', () => {
      return new Promise((resolve, reject) => {
        new Ffmpeg({ source: testfile, logger: testhelper.logger })
          .loop('00:06:46.81')
          ._test_getArgs((args, err) => {
            testhelper.logArgError(err);
            assert.ok(!err);

            if (args.indexOf('-loop') !== -1 || args.indexOf('-loop_output') !== -1) {
              expect(args).toContain('-t');
              expect(args).toContain('00:06:46.81');
            }
            else {
              reject(new Error('args should contain loop or loop_output'));
            }
            resolve();
          });
      });
    });
  });

  describe('takeFrames', () => {
    it('should add the -vframes argument', () => {
      return new Promise((resolve) => {
        new Ffmpeg({ source: testfile, logger: testhelper.logger })
          .takeFrames(250)
          ._test_getArgs((args, err) => {
            testhelper.logArgError(err);
            assert.ok(!err);

            expect(args).toContain('-vframes');
            expect(args).toContain(250);
            resolve();
          });
      });
    });
  });

  describe('withAudioCodec', () => {
    it('should apply the audio codec argument', () => {
      return new Promise((resolve) => {
        new Ffmpeg({ source: testfile, logger: testhelper.logger })
          .withAudioCodec('mp3')
          ._test_getArgs((args, err) => {
            testhelper.logArgError(err);
            assert.ok(!err);

            expect(args).toContain('-acodec');
            expect(args).toContain('mp3');
            resolve();
          });
      });
    });
  });

  describe('withAudioFilter', () => {
    it('should apply the audio filter argument', () => {
      return new Promise((resolve) => {
        new Ffmpeg({ source: testfile, logger: testhelper.logger })
          .withAudioFilter('silencedetect=n=-50dB:d=5')
          .withAudioFilter('volume=0.5')
          .withAudioFilter('multiple=1', 'filters=2')
          ._test_getArgs((args, err) => {
            testhelper.logArgError(err);
            assert.ok(!err);

            expect(args).toContain('-filter:a');
            expect(args).toContain('silencedetect=n=-50dB:d=5,volume=0.5,multiple=1,filters=2');
            resolve();
          });
      });
    });

    it('should accept filter arrays', () => {
      return new Promise((resolve) => {
        new Ffmpeg({ source: testfile, logger: testhelper.logger })
          .withAudioFilter(['multiple=1', 'filters=2'])
          ._test_getArgs((args, err) => {
            testhelper.logArgError(err);
            assert.ok(!err);

            expect(args).toContain('-filter:a');
            expect(args).toContain('multiple=1,filters=2');
            resolve();
          });
      });
    });

    it('should enable using filter objects', () => {
      return new Promise((resolve) => {
        new Ffmpeg({ source: testfile, logger: testhelper.logger })
          .withAudioFilter(
            {
              filter: 'option_string',
              options: 'opt1=value1:opt2=value2'
            },
            {
              filter: 'unnamed_options',
              options: ['opt1', 'opt2']
            },
            {
              filter: 'named_options',
              options: {
                opt1: 'value1',
                opt2: 'value2'
              }
            }
          )
          ._test_getArgs((args, err) => {
            testhelper.logArgError(err);
            assert.ok(!err);

            expect(args).toContain('-filter:a');
            expect(args).toContain('option_string=opt1=value1:opt2=value2,unnamed_options=opt1:opt2,named_options=opt1=value1:opt2=value2');
            resolve();
          });
      });
    });
  });

  describe('withAudioChannels', () => {
    it('should apply the audio channels argument', () => {
      return new Promise((resolve) => {
        new Ffmpeg({ source: testfile, logger: testhelper.logger })
          .withAudioChannels(1)
          ._test_getArgs((args, err) => {
            testhelper.logArgError(err);
            assert.ok(!err);

            expect(args).toContain('-ac');
            expect(args).toContain(1);
            resolve();
          });
      });
    });
  });

  describe('withAudioFrequency', () => {
    it('should apply the audio frequency argument', () => {
      return new Promise((resolve) => {
        new Ffmpeg({ source: testfile, logger: testhelper.logger })
          .withAudioFrequency(22500)
          ._test_getArgs((args, err) => {
            testhelper.logArgError(err);
            assert.ok(!err);

            expect(args).toContain('-ar');
            expect(args).toContain(22500);
            resolve();
          });
      });
    });
  });

  describe('withAudioQuality', () => {
    it('should apply the audio quality argument', () => {
      return new Promise((resolve) => {
        new Ffmpeg({ source: testfile, logger: testhelper.logger })
          .withAudioQuality(5)
          ._test_getArgs((args, err) => {
            testhelper.logArgError(err);
            assert.ok(!err);

            expect(args).toContain('-aq');
            expect(args).toContain(5);
            resolve();
          });
      });
    });
  });

  describe('setStartTime', () => {
    it('should apply the start time offset argument', () => {
      return new Promise((resolve) => {
        new Ffmpeg({ source: testfile, logger: testhelper.logger })
          .setStartTime('00:00:10')
          ._test_getArgs((args, err) => {
            testhelper.logArgError(err);
            assert.ok(!err);

            expect(args).toContain('-ss');
            expect(args.indexOf('-ss')).toBeLessThan(args.indexOf('-i'));

            expect(args.indexOf('00:00:10')).toBeGreaterThan(args.indexOf('-ss'));
            expect(args.indexOf('00:00:10')).toBeLessThan(args.indexOf('-i'));
            resolve();
          });
      });
    });
  });

  describe('setDuration', () => {
    it('should apply the record duration argument', () => {
      return new Promise((resolve) => {
        new Ffmpeg({ source: testfile, logger: testhelper.logger })
          .setDuration(10)
          ._test_getArgs((args, err) => {
            testhelper.logArgError(err);
            assert.ok(!err);

            expect(args).toContain('-t');
            expect(args).toContain(10);
            resolve();
          });
      });
    });
  });

  describe('addOption(s)', () => {
    it('should apply a single option', () => {
      return new Promise((resolve) => {
        new Ffmpeg({ source: testfile, logger: testhelper.logger })
          .addOption('-ab', '256k')
          ._test_getArgs((args, err) => {
            testhelper.logArgError(err);
            assert.ok(!err);

            expect(args).toContain('-ab');
            expect(args).toContain('256k');
            resolve();
          });
      });
    });
    it('should apply supplied extra options', () => {
      return new Promise((resolve) => {
        new Ffmpeg({ source: testfile, logger: testhelper.logger })
          .addOptions(['-flags', '+loop', '-cmp', '+chroma', '-partitions', '+parti4x4+partp8x8+partb8x8'])
          .addOptions('-single option')
          .addOptions('-multiple', '-options')
          ._test_getArgs((args, err) => {
            testhelper.logArgError(err);
            assert.ok(!err);

            expect(args).toContain('-flags');
            expect(args).toContain('+loop');
            expect(args).toContain('-cmp');
            expect(args).toContain('+chroma');
            expect(args).toContain('-partitions');
            expect(args).toContain('+parti4x4+partp8x8+partb8x8');
            expect(args).toContain('-single');
            expect(args).toContain('option');
            expect(args).toContain('-multiple');
            expect(args).toContain('-options');
            resolve();
          });
      });
    });
    it('should apply a single input option', () => {
      return new Promise((resolve) => {
        new Ffmpeg({ source: testfile, logger: testhelper.logger })
          .addInputOption('-r', '29.97')
          ._test_getArgs((args, err) => {
            testhelper.logArgError(err);
            assert.ok(!err);

            const joined = args.join(' ');
            expect(joined).toContain('-r 29.97')
            expect(joined.indexOf('-r 29.97')).toBeLessThan(joined.indexOf('-i '))
            resolve();
          });
      });
    });
    it('should apply multiple input options', () => {
      return new Promise((resolve) => {
        new Ffmpeg({ source: testfile, logger: testhelper.logger })
          .addInputOptions(['-r 29.97', '-f ogg'])
          .addInputOptions('-single option')
          .addInputOptions('-multiple', '-options')
          ._test_getArgs((args, err) => {
            testhelper.logArgError(err);
            assert.ok(!err);

            const joined = args.join(' ');
            expect(joined.indexOf('-r 29.97')).toBeGreaterThan(-1).and.toBeLessThan(joined.indexOf('-i'));
            expect(joined.indexOf('-f ogg')).toBeGreaterThan(-1).and.toBeLessThan(joined.indexOf('-i'));
            expect(joined.indexOf('-single option')).toBeGreaterThan(-1).and.toBeLessThan(joined.indexOf('-i'));
            expect(joined.indexOf('-multiple')).toBeGreaterThan(-1).and.toBeLessThan(joined.indexOf('-i'));
            expect(joined.indexOf('-options')).toBeGreaterThan(-1).and.toBeLessThan(joined.indexOf('-i'));
            resolve();
          });
      });
    });
  });

  describe('toFormat', () => {
    it('should apply the target format', () => {
      return new Promise((resolve) => {
        new Ffmpeg({ source: testfile, logger: testhelper.logger })
          .toFormat('mp4')
          ._test_getArgs((args, err) => {
            testhelper.logArgError(err);
            assert.ok(!err);

            expect(args).toContain('-f');
            expect(args).toContain('mp4');
            resolve();
          });
      });
    });
  });

  describe('Size calculations', () => {
    it('Should throw an error when an invalid aspect ratio is passed', () => {
      expect(() => {
        new Ffmpeg().aspect('blah');
      }).toThrow(/Invalid aspect ratio/);
    });

    it('Should add scale and setsar filters when keepPixelAspect was called', () => {
      var filters;

      filters = new Ffmpeg({ source: testfile, logger: testhelper.logger })
        .keepPixelAspect(true)
        ._test_getSizeFilters();
      expect(filters).toHaveLength(2);
      expect(filters[0]).toEqual('scale=w=\'if(gt(sar,1),iw*sar,iw)\':h=\'if(lt(sar,1),ih/sar,ih)\'');
      expect(filters[1]).toEqual('setsar=1');
    });

    it('Should throw an error when an invalid size was requested', () => {
      expect(() => {
        new Ffmpeg().withSize('aslkdbasd');
      }).toThrow(/^Invalid size specified/);
    });

    it('Should not add scale filters when withSize was not called', () => {
      expect(new Ffmpeg({ source: testfile, logger: testhelper.logger })
        ._test_getSizeFilters().length).toEqual(0);

      expect(new Ffmpeg({ source: testfile, logger: testhelper.logger })
        .withAspect(4 / 3)
        ._test_getSizeFilters().length).toEqual(0);

      expect(new Ffmpeg({ source: testfile, logger: testhelper.logger })
        .applyAutopadding(true, 'white')
        ._test_getSizeFilters().length).toEqual(0);
    });

    it('Should add proper scale filter when withSize was called with a percent value', () => {
      var filters;

      filters = new Ffmpeg({ source: testfile, logger: testhelper.logger })
        .withSize('42%')
        ._test_getSizeFilters();
      expect(filters).toHaveLength(1);
      expect(filters[0]).toEqual('scale=w=trunc(iw*0.42/2)*2:h=trunc(ih*0.42/2)*2');

      filters = new Ffmpeg({ source: testfile, logger: testhelper.logger })
        .withSize('42%')
        .withAspect(4 / 3)
        ._test_getSizeFilters();
      expect(filters).toHaveLength(1);
      expect(filters[0]).toEqual('scale=w=trunc(iw*0.42/2)*2:h=trunc(ih*0.42/2)*2');

      filters = new Ffmpeg({ source: testfile, logger: testhelper.logger })
        .withSize('42%')
        .applyAutopadding(true, 'white')
        ._test_getSizeFilters();
      expect(filters).toHaveLength(1);
      expect(filters[0]).toEqual('scale=w=trunc(iw*0.42/2)*2:h=trunc(ih*0.42/2)*2');
    });

    it('Should add proper scale filter when withSize was called with a fixed size', () => {
      var filters;

      filters = new Ffmpeg({ source: testfile, logger: testhelper.logger })
        .withSize('100x200')
        ._test_getSizeFilters();
      expect(filters).toHaveLength(1);
      expect(filters[0]).toEqual('scale=w=100:h=200');

      filters = new Ffmpeg({ source: testfile, logger: testhelper.logger })
        .withSize('100x200')
        .withAspect(4 / 3)
        ._test_getSizeFilters();
      expect(filters).toHaveLength(1);
      expect(filters[0]).toEqual('scale=w=100:h=200');
    });

    it('Should add proper scale filter when withSize was called with a "?" and no aspect ratio is specified', () => {
      var filters;

      filters = new Ffmpeg({ source: testfile, logger: testhelper.logger })
        .withSize('100x?')
        ._test_getSizeFilters();
      expect(filters).toHaveLength(1);
      expect(filters[0]).toEqual('scale=w=100:h=trunc(ow/a/2)*2');

      filters = new Ffmpeg({ source: testfile, logger: testhelper.logger })
        .withSize('100x?')
        .applyAutopadding(true, 'white')
        ._test_getSizeFilters();
      expect(filters).toHaveLength(1);
      expect(filters[0]).toEqual('scale=w=100:h=trunc(ow/a/2)*2');

      filters = new Ffmpeg({ source: testfile, logger: testhelper.logger })
        .withSize('?x200')
        ._test_getSizeFilters();
      expect(filters).toHaveLength(1);
      expect(filters[0]).toEqual('scale=w=trunc(oh*a/2)*2:h=200');

      filters = new Ffmpeg({ source: testfile, logger: testhelper.logger })
        .withSize('?x200')
        .applyAutopadding(true, 'white')
        ._test_getSizeFilters();
      expect(filters).toHaveLength(1);
      expect(filters[0]).toEqual('scale=w=trunc(oh*a/2)*2:h=200');
    });

    it('Should add proper scale filter when withSize was called with a "?" and an aspect ratio is specified', () => {
      var filters;

      filters = new Ffmpeg({ source: testfile, logger: testhelper.logger })
        .withSize('100x?')
        .withAspect(0.5)
        ._test_getSizeFilters();
      expect(filters).toHaveLength(1);
      expect(filters[0]).toEqual('scale=w=100:h=200');

      filters = new Ffmpeg({ source: testfile, logger: testhelper.logger })
        .withSize('?x100')
        .withAspect(2)
        ._test_getSizeFilters();
      expect(filters).toHaveLength(1);
      expect(filters[0]).toEqual('scale=w=200:h=100');
    });

    it('Should add scale and pad filters when withSize was called with a "?", aspect ratio and auto padding are specified', () => {
      var filters;

      filters = new Ffmpeg({ source: testfile, logger: testhelper.logger })
        .withSize('100x?')
        .withAspect(0.5)
        .applyAutopadding(true, 'white')
        ._test_getSizeFilters();
      expect(filters).toHaveLength(2);
      expect(filters[0]).toEqual('scale=w=\'if(gt(a,0.5),100,trunc(200*a/2)*2)\':h=\'if(lt(a,0.5),200,trunc(100/a/2)*2)\'');
      expect(filters[1]).toEqual('pad=w=100:h=200:x=\'if(gt(a,0.5),0,(100-iw)/2)\':y=\'if(lt(a,0.5),0,(200-ih)/2)\':color=white');

      filters = new Ffmpeg({ source: testfile, logger: testhelper.logger })
        .withSize('?x100')
        .withAspect(2)
        .applyAutopadding(true, 'white')
        ._test_getSizeFilters();
      expect(filters).toHaveLength(2);
      expect(filters[0]).toEqual('scale=w=\'if(gt(a,2),200,trunc(100*a/2)*2)\':h=\'if(lt(a,2),100,trunc(200/a/2)*2)\'');
      expect(filters[1]).toEqual('pad=w=200:h=100:x=\'if(gt(a,2),0,(200-iw)/2)\':y=\'if(lt(a,2),0,(100-ih)/2)\':color=white');
    });

    it('Should add scale and pad filters when withSize was called with a fixed size and auto padding is specified', () => {
      var filters;

      filters = new Ffmpeg({ source: testfile, logger: testhelper.logger })
        .withSize('100x200')
        .applyAutopadding(true, 'white')
        ._test_getSizeFilters();
      expect(filters).toHaveLength(2);
      expect(filters[0]).toEqual('scale=w=\'if(gt(a,0.5),100,trunc(200*a/2)*2)\':h=\'if(lt(a,0.5),200,trunc(100/a/2)*2)\'');
      expect(filters[1]).toEqual('pad=w=100:h=200:x=\'if(gt(a,0.5),0,(100-iw)/2)\':y=\'if(lt(a,0.5),0,(200-ih)/2)\':color=white');

      filters = new Ffmpeg({ source: testfile, logger: testhelper.logger })
        .withSize('100x200')
        .withAspect(4 / 3)
        .applyAutopadding(true, 'white')
        ._test_getSizeFilters();
      expect(filters).toHaveLength(2);
      expect(filters[0]).toEqual('scale=w=\'if(gt(a,0.5),100,trunc(200*a/2)*2)\':h=\'if(lt(a,0.5),200,trunc(100/a/2)*2)\'');
      expect(filters[1]).toEqual('pad=w=100:h=200:x=\'if(gt(a,0.5),0,(100-iw)/2)\':y=\'if(lt(a,0.5),0,(200-ih)/2)\':color=white');

      filters = new Ffmpeg({ source: testfile, logger: testhelper.logger })
        .withSize('200x100')
        .applyAutopadding(true, 'white')
        ._test_getSizeFilters();
      expect(filters).toHaveLength(2);
      expect(filters[0]).toEqual('scale=w=\'if(gt(a,2),200,trunc(100*a/2)*2)\':h=\'if(lt(a,2),100,trunc(200/a/2)*2)\'');
      expect(filters[1]).toEqual('pad=w=200:h=100:x=\'if(gt(a,2),0,(200-iw)/2)\':y=\'if(lt(a,2),0,(100-ih)/2)\':color=white');

      filters = new Ffmpeg({ source: testfile, logger: testhelper.logger })
        .withSize('200x100')
        .withAspect(4 / 3)
        .applyAutopadding(true, 'white')
        ._test_getSizeFilters();
      expect(filters).toHaveLength(2);
      expect(filters[0]).toEqual('scale=w=\'if(gt(a,2),200,trunc(100*a/2)*2)\':h=\'if(lt(a,2),100,trunc(200/a/2)*2)\'');
      expect(filters[1]).toEqual('pad=w=200:h=100:x=\'if(gt(a,2),0,(200-iw)/2)\':y=\'if(lt(a,2),0,(100-ih)/2)\':color=white');
    });

    it('Should round sizes to multiples of 2', () => {
      var filters;
      var aspect = 102 / 202;

      filters = new Ffmpeg({ source: testfile, logger: testhelper.logger })
        .withSize('101x201')
        ._test_getSizeFilters();
      expect(filters).toHaveLength(1);
      expect(filters[0]).toEqual('scale=w=102:h=202');

      filters = new Ffmpeg({ source: testfile, logger: testhelper.logger })
        .withSize('101x201')
        .applyAutopadding(true, 'white')
        ._test_getSizeFilters();
      expect(filters).toHaveLength(2);
      expect(filters[0]).toEqual(`scale=w='if(gt(a,${aspect}),102,trunc(202*a/2)*2)':h='if(lt(a,${aspect}),202,trunc(102/a/2)*2)'`);
      expect(filters[1]).toEqual(`pad=w=102:h=202:x='if(gt(a,${aspect}),0,(102-iw)/2)':y='if(lt(a,${aspect}),0,(202-ih)/2)':color=white`);

      filters = new Ffmpeg({ source: testfile, logger: testhelper.logger })
        .withSize('101x?')
        .withAspect('1:2')
        ._test_getSizeFilters();
      expect(filters).toHaveLength(1);
      expect(filters[0]).toEqual('scale=w=102:h=202');

      filters = new Ffmpeg({ source: testfile, logger: testhelper.logger })
        .withSize('?x201')
        .withAspect('1:2')
        ._test_getSizeFilters();
      expect(filters).toHaveLength(1);
      expect(filters[0]).toEqual('scale=w=102:h=202');
    });

    it('Should apply autopadding when no boolean argument was passed to applyAutopadding', () => {
      var filters = new Ffmpeg({ source: testfile, logger: testhelper.logger })
        .withSize('100x?')
        .withAspect(0.5)
        .applyAutopadding('white')
        ._test_getSizeFilters();
      expect(filters).toHaveLength(2);
      expect(filters[1]).toEqual('pad=w=100:h=200:x=\'if(gt(a,0.5),0,(100-iw)/2)\':y=\'if(lt(a,0.5),0,(200-ih)/2)\':color=white');
    });

    it('Should default to black padding', () => {
      var filters = new Ffmpeg({ source: testfile, logger: testhelper.logger })
        .withSize('100x?')
        .withAspect(0.5)
        .applyAutopadding()
        ._test_getSizeFilters();
      expect(filters).toHaveLength(2);
      expect(filters[1]).toEqual('pad=w=100:h=200:x=\'if(gt(a,0.5),0,(100-iw)/2)\':y=\'if(lt(a,0.5),0,(200-ih)/2)\':color=black');

      filters = new Ffmpeg({ source: testfile, logger: testhelper.logger })
        .withSize('100x?')
        .withAspect(0.5)
        .applyAutopadding(true)
        ._test_getSizeFilters();
      expect(filters).toHaveLength(2);
      expect(filters[1]).toEqual('pad=w=100:h=200:x=\'if(gt(a,0.5),0,(100-iw)/2)\':y=\'if(lt(a,0.5),0,(200-ih)/2)\':color=black');
    });
  });

  describe('complexFilter', () => {
    it('should generate a complex filter from a single filter', () => {
      var filters = new Ffmpeg()
        .complexFilter('filterstring')
        ._getArguments();

      expect(filters).toHaveLength(2);
      expect(filters[0]).toEqual('-filter_complex');
      expect(filters[1]).toEqual('filterstring');
    });

    it('should generate a complex filter from a filter array', () => {
      var filters = new Ffmpeg()
        .complexFilter(['filter1', 'filter2'])
        ._getArguments();

      expect(filters).toHaveLength(2);
      expect(filters[1]).toEqual('filter1;filter2');
    });

    it('should support filter objects', () => {
      var filters = new Ffmpeg()
        .complexFilter([
          'filter1',
          { filter: 'filter2' }
        ])
        ._getArguments();

      expect(filters).toHaveLength(2);
      expect(filters[1]).toEqual('filter1;filter2');
    });

    it('should support filter options', () => {
      var filters = new Ffmpeg()
        .complexFilter([
          { filter: 'filter1', options: 'optionstring' },
          { filter: 'filter2', options: ['opt1', 'opt2', 'opt3'] },
          { filter: 'filter3', options: { opt1: 'value1', opt2: 'value2' } }
        ])
        ._getArguments();

      expect(filters).toHaveLength(2);
      expect(filters[1]).toEqual('filter1=optionstring;filter2=opt1:opt2:opt3;filter3=opt1=value1:opt2=value2');
    });

    it('should escape filter options with ambiguous characters', () => {
      var filters = new Ffmpeg()
        .complexFilter([
          { filter: 'filter1', options: 'optionstring' },
          { filter: 'filter2', options: ['op,t1', 'op,t2', 'op,t3'] },
          { filter: 'filter3', options: { opt1: 'val,ue1', opt2: 'val,ue2' } }
        ])
        ._getArguments();

      expect(filters).toHaveLength(2);
      expect(filters[1]).toEqual('filter1=optionstring;filter2=\'op,t1\':\'op,t2\':\'op,t3\';filter3=opt1=\'val,ue1\':opt2=\'val,ue2\'');
    });

    it('should support filter input streams', () => {
      var filters = new Ffmpeg()
        .complexFilter([
          { filter: 'filter1', inputs: 'input' },
          { filter: 'filter2', inputs: '[input]' },
          { filter: 'filter3', inputs: ['[input1]', 'input2'] }
        ])
        ._getArguments();

      expect(filters).toHaveLength(2);
      expect(filters[1]).toEqual('[input]filter1;[input]filter2;[input1][input2]filter3');
    });

    it('should support filter output streams', () => {
      var filters = new Ffmpeg()
        .complexFilter([
          { filter: 'filter1', options: 'opt', outputs: 'output' },
          { filter: 'filter2', options: 'opt', outputs: '[output]' },
          { filter: 'filter3', options: 'opt', outputs: ['[output1]', 'output2'] }
        ])
        ._getArguments();

      expect(filters).toHaveLength(2);
      expect(filters[1]).toEqual('filter1=opt[output];filter2=opt[output];filter3=opt[output1][output2]');
    });

    it('should support an additional mapping argument', () => {
      var filters = new Ffmpeg()
        .complexFilter(['filter1', 'filter2'], 'output')
        ._getArguments();

      expect(filters).toHaveLength(4);
      expect(filters[2]).toEqual('-map');
      expect(filters[3]).toEqual('[output]');

      filters = new Ffmpeg()
        .complexFilter(['filter1', 'filter2'], '[output]')
        ._getArguments();

      expect(filters).toHaveLength(4);
      expect(filters[2]).toEqual('-map');
      expect(filters[3]).toEqual('[output]');

      filters = new Ffmpeg()
        .complexFilter(['filter1', 'filter2'], ['[output1]', 'output2'])
        ._getArguments();

      expect(filters).toHaveLength(6);
      expect(filters[2]).toEqual('-map');
      expect(filters[3]).toEqual('[output1]');
      expect(filters[4]).toEqual('-map');
      expect(filters[5]).toEqual('[output2]');
    });

    it('should override any previously set complex filtergraphs', () => {
      var filters = new Ffmpeg()
        .complexFilter(['filter1a', 'filter1b'], 'output1')
        .complexFilter(['filter2a', 'filter2b'], 'output2')
        ._getArguments();

      expect(filters).toHaveLength(4);
      expect(filters[1]).toEqual('filter2a;filter2b');
      expect(filters[2]).toEqual('-map');
      expect(filters[3]).toEqual('[output2]');
    });
  });

  describe('clone', () => {
    it('should return a new FfmpegCommand instance', () => {
      var command = new Ffmpeg({ source: testfile, logger: testhelper.logger });
      var clone = command.clone();

      expect(clone).toBeInstanceOf(Ffmpeg);
      expect(clone).not.toBe(command);
    });

    it('should duplicate FfmpegCommand options at the time of the call', () => {
      return new Promise((resolve) => {
        var command = new Ffmpeg({ source: testfile, logger: testhelper.logger })
          .preset('flashvideo');

        var clone = command.clone();

        command._test_getArgs((originalArgs) => {
          clone._test_getArgs((cloneArgs) => {
            expect(cloneArgs).toHaveLength(originalArgs.length);
            originalArgs.forEach((arg, index) => {
              expect(cloneArgs[index]).toEqual(arg);
            });
            resolve();
          });
        });
      });
    });

    it('should have separate argument lists', () => {
      return new Promise((resolve) => {
        var command = new Ffmpeg({ source: testfile, logger: testhelper.logger })
          .preset('flashvideo');

        var clone = command.clone().audioFrequency(22050);

        command._test_getArgs((originalArgs) => {
          clone._test_getArgs((cloneArgs) => {
            expect(cloneArgs).toHaveLength(originalArgs.length + 2);
            resolve();
          });
        });
      });
    });
  });
});
