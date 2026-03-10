/*jshint node:true*/
/*global describe,it,before*/


var Ffmpeg = require('../index'),
  path = require('node:path'),
  fs = require('node:fs'),
  Readable = require('node:stream').Readable,
  assert = require('node:assert'),
  exec = require('node:child_process').exec,
  testhelper = require('./helpers');


describe('Metadata', () => {
  before(function(done) {
    // check for ffmpeg installation
    this.testfile = path.join(__dirname, 'assets', 'testvideo-43.avi');
    exec(testhelper.getFfmpegCheck(), (err) => {
      if (!err) {
        // check if file exists
        fs.exists(this.testfile, (exists) => {
          if (exists) {
            done();
          } else {
            done(new Error('test video file does not exist, check path (' + this.testfile + ')'));
          }
        });
      } else {
        done(new Error('cannot run test without ffmpeg installed, aborting test...'));
      }
    });
  });

  it('should provide an ffprobe entry point', (done) => {
    (typeof Ffmpeg.ffprobe).should.equal('function');
    done();
  });

  it('should return ffprobe data as an object', function(done) {
    Ffmpeg.ffprobe(this.testfile, (err, data) => {
      testhelper.logError(err);
      assert.ok(!err);

      (typeof data).should.equal('object');
      done();
    });
  });

  it('should provide ffprobe format information', function(done) {
    Ffmpeg.ffprobe(this.testfile, (err, data) => {
      testhelper.logError(err);
      assert.ok(!err);

      ('format' in data).should.equal(true);
      (typeof data.format).should.equal('object');
      Number(data.format.duration).should.equal(2);
      data.format.format_name.should.equal('avi');

      done();
    });
  });

  it('should provide ffprobe stream information', function(done) {
    Ffmpeg.ffprobe(this.testfile, (err, data) => {
      testhelper.logError(err);
      assert.ok(!err);

      ('streams' in data).should.equal(true);
      Array.isArray(data.streams).should.equal(true);
      data.streams.length.should.equal(1);
      data.streams[0].codec_type.should.equal('video');
      data.streams[0].codec_name.should.equal('mpeg4');
      Number(data.streams[0].width).should.equal(1024);

      done();
    });
  });

  it('should provide ffprobe stream information with units', function(done) {
    Ffmpeg.ffprobe(this.testfile, ['-unit'], (err, data) => {
      testhelper.logError(err);
      assert.ok(!err);

      ('streams' in data).should.equal(true);
      Array.isArray(data.streams).should.equal(true);
      data.streams.length.should.equal(1);
      data.streams[0].bit_rate.should.equal('322427 bit/s');
      done();
    });
  });

  it('should return ffprobe errors', (done) => {
    Ffmpeg.ffprobe('/path/to/missing/file', (err) => {
      assert.ok(!!err);
      done();
    });
  });

  it('should enable calling ffprobe on a command with an input file', function(done) {
    new Ffmpeg({ source: this.testfile })
      .ffprobe((err, data) => {
        testhelper.logError(err);
        assert.ok(!err);

        (typeof data).should.equal('object');
        ('format' in data).should.equal(true);
        (typeof data.format).should.equal('object');
        ('streams' in data).should.equal(true);
        Array.isArray(data.streams).should.equal(true);

        done();
      });
  });

  it('should fail calling ffprobe on a command without input', (done) => {
    new Ffmpeg().ffprobe((err) => {
      assert.ok(!!err);
      err.message.should.match(/No input specified/);
      done();
    });
  });

  it('should allow calling ffprobe on stream input', function(done) {
    var stream = fs.createReadStream(this.testfile);

    new Ffmpeg()
      .addInput(stream)
      .ffprobe((err, data) => {
        assert.ok(!err);
        data.streams.length.should.equal(1);
        data.format.filename.should.equal('pipe:0');
        done();
      });
  });
});
