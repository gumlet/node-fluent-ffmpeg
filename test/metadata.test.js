/*jshint node:true*/
/*global describe,it,before*/
import { expect, describe, it, beforeAll } from 'vitest';

import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import Ffmpeg from '../index.js';
import fs from 'node:fs';
import { strict as assert } from 'node:assert';
import { exec } from 'node:child_process';
import testhelper from './helpers.js';


describe('Metadata', () => {
  let testfile
  beforeAll(function() {
    // check for ffmpeg installation
    testfile = path.join(__dirname, 'assets', 'testvideo-43.avi');
    exec(testhelper.getFfmpegCheck(), (err) => {
      if (!err) {
        // check if file exists
        fs.access(testfile, fs.constants.F_OK, (err) => {
          if (!err) {
            // all good, file exists and ffmpeg is available
          } else {
            throw new Error(`test video file does not exist, check path (${this.testfile})`);
          }
        });
      } else {
        throw new Error('cannot run test without ffmpeg installed, aborting test...');
      }
    });
  });

  it('should provide an ffprobe entry point', () => {
    expect(Ffmpeg.ffprobe).toBeTypeOf('function');
  });

  it('should return ffprobe data as an object', () => {
    Ffmpeg.ffprobe(testfile, (err, data) => {
      testhelper.logError(err);
      assert.ok(!err);

      expect(data).toBeTypeOf('object')
    });
  });

  it('should provide ffprobe format information', () => {
    Ffmpeg.ffprobe(testfile, (err, data) => {
      testhelper.logError(err);
      assert.ok(!err);

      expect('format' in data).toBe(true);
      expect(typeof data.format).toBe('object');
      expect(Number(data.format.duration)).toBe(2);
      expect(data.format.format_name).toBe('avi');
    });
  });

  it('should provide ffprobe stream information', () => {
    Ffmpeg.ffprobe(testfile, (err, data) => {
      testhelper.logError(err);
      assert.ok(!err);

      expect('streams' in data).toBe(true);
      expect(Array.isArray(data.streams)).toBe(true);
      expect(data.streams.length).toBe(1);
      expect(data.streams[0].codec_type).toBe('video');
      expect(data.streams[0].codec_name).toBe('mpeg4');
      expect(Number(data.streams[0].width)).toBe(1024);
    });
  });

  it('should provide ffprobe stream information with units', () => {
    Ffmpeg.ffprobe(testfile, ['-unit'], (err, data) => {
      testhelper.logError(err);
      assert.ok(!err);

      expect('streams' in data).toBe(true);
      expect(Array.isArray(data.streams)).toBe(true);
      expect(data.streams.length).toBe(1);
      expect(data.streams[0].bit_rate).toBe('322427 bit/s');
    });
  });

  it('should return ffprobe errors', () => {
    Ffmpeg.ffprobe('/path/to/missing/file', (err) => {
      assert.ok(!!err);
    });
  });

  it('should enable calling ffprobe on a command with an input file', () => {
    new Ffmpeg({ source: testfile })
      .ffprobe((err, data) => {
        testhelper.logError(err);
        assert.ok(!err);

        expect(typeof data).toBe('object');
        expect('format' in data).toBe(true);
        expect(typeof data.format).toBe('object');
        expect('streams' in data).toBe(true);
        expect(Array.isArray(data.streams)).toBe(true);
      });
  });

  it('should fail calling ffprobe on a command without input', () => {
    new Ffmpeg().ffprobe((err) => {
      assert.ok(!!err);
      expect(err.message).toMatch(/No input specified/);
    });
  });

  it('should allow calling ffprobe on stream input', () => {
    var stream = fs.createReadStream(testfile);

    new Ffmpeg()
      .addInput(stream)
      .ffprobe((err, data) => {
        assert.ok(!err);
        expect(data.streams.length).toBe(1);
        expect(data.format.filename).toBe('pipe:0');
      });
  });
});
