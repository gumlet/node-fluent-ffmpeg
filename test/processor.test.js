/*jshint node:true*/
/*global describe,it,before,after,beforeEach,afterEach*/
import { expect, describe, it, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';

import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import FfmpegCommand from '../index.js';
import fs from 'node:fs';
import { strict as assert } from 'node:assert';
import { platform } from 'node:os';
import { exec, spawn } from 'node:child_process';
import async from 'async';
import { Readable, Writable, PassThrough} from 'node:stream';
import testhelper from './helpers.js';


const testHTTP = 'http://127.0.0.1:8090/test.mpg';
const testRTSP = 'rtsp://127.0.0.1:5540/test-rtp.mpg';
const testRTPOut = 'rtp://127.0.0.1:5540/input.mpg';


/*****************************************************************

              IMPORTANT NOTE ABOUT PROCESSOR TESTS

 To ensure tests run reliably, you should do the following:

 * Any input file you use must be tested for existence before
   running the tests.  Use the 'prerequisite' function below and
   add any new file there.

 * FfmpegCommands should be created using 'this.getCommand(args)'
   in the test definition, not using 'new Ffmpegcommand(args)'.
   This enables ensuring the command is finished before starting
   the next test.

 * Any file your test is expected to create should have their full
   path pushed to the 'this.files' array in the test definition,
   and your test should *not* remove them on completion.  The
   cleanup hook will check all those files for existence and remove
   them.

 * Same thing with directories in the 'this.dirs' array.

 * If you use intervals or timeouts, please ensure they have been
   canceled (for intervals) or called (for timeouts) before
   calling the test 'done()' callback.

 Not abiding by those rules is BAD.  You have been warned :)

 *****************************************************************/


describe('Processor', () => {
  // check prerequisites once before all tests
  let testdir, testfileName, testfile, testfilewide, testfilebig, testfilespecial, testfileaudio1, testfileaudio2, testfileaudio3;
  let processes, outputs, files, dirs;
  let getCommand, saveOutput;
  beforeAll(function prerequisites() {
    // check for ffmpeg installation
    testdir = path.join(__dirname, 'assets');
    testfileName = 'testvideo-43.avi';
    testfile = path.join(testdir, testfileName);
    testfilewide = path.join(testdir, 'testvideo-169.avi');
    testfilebig = path.join(testdir, 'testvideo-5m.mpg');
    testfilespecial = path.join(testdir, 'te[s]t_ video \' _ .flv');
    testfileaudio1 = path.join(testdir, 'testaudio-one.wav');
    testfileaudio2 = path.join(testdir, 'testaudio-two.wav');
    testfileaudio3 = path.join(testdir, 'testaudio-three.wav');

    exec(testhelper.getFfmpegCheck(), (err) => {
      if (!err) {
        // check if all test files exist
        async.each([
            testfile,
            testfilewide,
            testfilebig,
            testfilespecial,
            testfileaudio1,
            testfileaudio2,
            testfileaudio3
          ], (file, cb) => {
            fs.access(file, fs.constants.F_OK, (err) => {
              cb(!err ? null : new Error(`test video file does not exist, check path (${file})`));
            });
          }
        );
      } else {
        throw new Error('cannot run test without ffmpeg installed, aborting test...');
      }
    });
  });

  // cleanup helpers before and after all tests
  beforeEach(function setup() {
    processes = [];
    outputs = [];

    // Tests should call this so that created processes are watched
    // for exit and checked during test cleanup
    getCommand = (args) => {
      var cmd = new FfmpegCommand(args);
      cmd.on('start', () => {
        processes.push(cmd.ffmpegProc);

        // Remove process when it exits
        cmd.ffmpegProc.on('exit', () => {
          processes.splice(processes.indexOf(cmd.ffmpegProc), 1);
        });
      });

      return cmd;
    };

    // Tests should call this to display stdout/stderr in case of error
    saveOutput = (stdout, stderr) => {
      outputs.unshift([stdout, stderr]);
    };

    files = [];
    dirs = [];

  });

  afterEach(function cleanup() {

    async.series([
        // Ensure every process has finished
        (cb) => {
          if (processes.length) {
            if (outputs.length) {
              testhelper.logOutput(outputs[0][0], outputs[0][1]);
            }

            throw new Error(`${processes.length} processes still running after "${this.currentTest.title}"`);
            cb();
          } else {
            cb();
          }
        },

        // Ensure all created files are removed
        (cb) => {
          async.each(files, (file, cb) => {
            fs.access(file, fs.constants.F_OK, (err) => {
              if (!err) {
                fs.unlink(file, cb);
              } else {
                if (outputs.length) {
                  testhelper.logOutput(outputs[0][0], outputs[0][1]);
                }

                throw new Error(`Expected created file ${file} by "${this.currentTest.title}"`);
                cb();
              }
            });
          }, cb);
        },

        // Ensure all created dirs are removed
        (cb) => {
          async.each(dirs, (dir, cb) => {
            fs.access(dir, fs.constants.F_OK, (err) => {
              if (!err) {
                fs.rmdir(dir, cb);
              } else {
                if (outputs.length) {
                  testhelper.logOutput(outputs[0][0], outputs[0][1]);
                }

                throw new Error(`Expected created directory ${dir} by "${this.currentTest.title}"`);
                cb();
              }
            });
          }, cb);
        }
      ]
    );
  });

  describe('Process controls', () => {
    // Skip all niceness tests on windows
    var skipNiceness = platform().match(/win(32|64)/);

    var skipRenice = false;

    (skipNiceness ? it.skip : it)('should properly limit niceness', () => {
      getCommand({ source: testfile, logger: testhelper.logger, timeout: 0.02 })
          .renice(100).options.niceness.should.equal(20);
    });

    ((skipNiceness || skipRenice) ? it.skip : it)('should dynamically renice process', {timeout: 60000}, () => {

      var testFile = path.join(__dirname, 'assets', 'testProcessRenice.avi');
      files.push(testFile);

      var ffmpegJob = getCommand({ source: testfilebig, logger: testhelper.logger, timeout: 0.5 })
          .usingPreset('divx');

      var startCalled = false;
      var reniced = false;

      ffmpegJob
          .on('start', () => {
            startCalled = true;
            const pid = ffmpegJob.ffmpegProc.pid;
            setTimeout(() => {
              ffmpegJob.renice(5);

              setTimeout(() => {
                exec(`ps -p ${pid} -o ni=`, (err, stdout) => {
                  assert.ok(!err);
                  parseInt(stdout, 10).should.equal(5);
                  reniced = true;
                });
              }, 100);
            }, 100);

            ffmpegJob.ffmpegProc.on('exit', () => {
              reniced.should.equal(true);
            });
          })
          .on('error', () => {
            reniced.should.equal(true);
            startCalled.should.equal(true);
          })
          .on('end', () => {
            console.log('end was called, expected a timeout');
            assert.ok(false);
          })
          .saveToFile(testFile);
    });

    it('should change the working directory', () => {
      var testFile = path.join(testdir, 'testvideo.avi');
      files.push(testFile);

      getCommand({ source: testfileName, logger: testhelper.logger, cwd: testdir })
        .usingPreset('divx')
        .on('error', (err, stdout, stderr) => {
          testhelper.logError(err, stdout, stderr);
          assert.ok(!err);
        })
        .on('end', () => {
        })
        .saveToFile(testFile);
    });

    it('should kill the process on timeout', () => {
      var testFile = path.join(__dirname, 'assets', 'testProcessKillTimeout.avi');
      files.push(testFile);

      var command = getCommand({ source: testfilebig, logger: testhelper.logger, timeout: 0.1});

      command
          .usingPreset('divx')
          .on('start', () => {
            command.ffmpegProc.on('exit', () => {
            });
          })
          .on('error', (err, stdout, stderr) => {
            saveOutput(stdout, stderr);
            err.message.indexOf('timeout').should.not.equal(-1);
          })
          .on('end', () => {
            console.log('end was called, expected a timeout');
            assert.ok(false);
          })
          .saveToFile(testFile);
    });

    it('should not keep node process running on completion', () => {
      var script = `
        import ffmpeg from './index.js'
        ffmpeg('${testfilebig}', { timeout: 60 })
          .addOption('-t', 1)
          .addOption('-f', 'null')
          .saveToFile('/dev/null');
      `;

      exec(`node -e "${script}"`, { timeout: 1000 });
    });

    it('should kill the process with .kill', () => {
      var testFile = path.join(__dirname, 'assets', 'testProcessKill.avi');
      files.push(testFile);

      var ffmpegJob = getCommand({ source: testfilebig, logger: testhelper.logger })
          .usingPreset('divx');

      var startCalled = false;
      var errorCalled = false;

      ffmpegJob
          .on('start', () => {
            startCalled = true;
            setTimeout(() => { ffmpegJob.kill(); }, 500);
            ffmpegJob.ffmpegProc.on('exit', () => {
              setTimeout(() => {
                errorCalled.should.equal(true);
                done();
              }, 1000);
            });
          })
          .on('error', (err) => {
            err.message.indexOf('ffmpeg was killed with signal SIGKILL').should.not.equal(-1);
            startCalled.should.equal(true);
            errorCalled = true;
          })
          .on('end', () => {
            console.log('end was called, expected an error');
            assert.ok(false);
            done();
          })
          .saveToFile(testFile);
    });

    it('should send the process custom signals with .kill(signal)',{timeout: 60000}, (done) => {

      var testFile = path.join(__dirname, 'assets', 'testProcessKillCustom.avi');
      files.push(testFile);

      var ffmpegJob = getCommand({ source: testfilebig, logger: testhelper.logger, timeout: 2 })
          .usingPreset('divx');

      var startCalled = true;
      var errorCalled = false;
      ffmpegJob
          .on('start', () => {
            startCalled = true;

            setTimeout(() => { ffmpegJob.kill('SIGSTOP'); }, 500);

            ffmpegJob.ffmpegProc.on('exit', () => {
              errorCalled.should.equal(true);
              done();
            });
          })
          .on('error', (err) => {
            startCalled.should.equal(true);
            err.message.indexOf('timeout').should.not.equal(-1);

            errorCalled = true;
            ffmpegJob.kill('SIGCONT');
          })
          .on('end', () => {
            console.log('end was called, expected a timeout');
            assert.ok(false);
            done();
          })
          .saveToFile(testFile);

    });
  });

  describe('Events', () => {
    it('should report codec data through \'codecData\' event', {timeout: 60000}, (done) => {

      var testFile = path.join(__dirname, 'assets', 'testOnCodecData.avi');
      files.push(testFile);

      getCommand({ source: testfilebig, logger: testhelper.logger })
        .on('codecData', (data) => {
          data.should.have.property('audio');
          data.should.have.property('video');
        })
        .usingPreset('divx')
        .on('error', (err, stdout, stderr) => {
          testhelper.logError(err, stdout, stderr);
          assert.ok(!err);
        })
        .on('end', () => {
          done();
        })
        .saveToFile(testFile);
    });

    it('should report codec data through \'codecData\' event on piped inputs',{timeout: 60000}, (done) => {

      var testFile = path.join(__dirname, 'assets', 'testOnCodecData.avi')
      files.push(testFile);

      getCommand({ source: fs.createReadStream(testfilebig), logger: testhelper.logger })
        .on('codecData', (data) => {
          data.should.have.property('audio');
          data.should.have.property('video');
        })
        .usingPreset('divx')
        .on('error', (err, stdout, stderr) => {
          testhelper.logError(err, stdout, stderr);
          assert.ok(!err);
        })
        .on('end', () => {
          done();
        })
        .saveToFile(testFile);
    });

    it('should report codec data through \'codecData\' for multiple inputs',{timeout: 60000}, (done) => {

      var testFile = path.join(__dirname, 'assets', 'testOnCodecData.wav')
      files.push(testFile);

      getCommand({ logger: testhelper.logger })
        .input(testfileaudio1)
        .input(testfileaudio2)
        .on('codecData', (data1, data2) => {
          data1.should.have.property('audio');
          data2.should.have.property('audio');
        })
        .on('error', (err, stdout, stderr) => {
          testhelper.logError(err, stdout, stderr);
          assert.ok(!err);
        })
        .on('end', () => {
          done();
        })
        .mergeToFile(testFile);
    });

    it('should report progress through \'progress\' event',{timeout: 60000}, (done) => {

      var testFile = path.join(__dirname, 'assets', 'testOnProgress.avi');
      var gotProgress = false;

      files.push(testFile);

      getCommand({ source: testfilebig, logger: testhelper.logger })
          .on('progress', () => {
            gotProgress = true;
          })
          .usingPreset('divx')
          .on('error', (err, stdout, stderr) => {
            testhelper.logError(err, stdout, stderr);
            assert.ok(!err);
          })
          .on('end', () => {
            gotProgress.should.equal(true);
            done();
          })
          .saveToFile(testFile);
    });

    it('should report start of ffmpeg process through \'start\' event',{timeout: 60000}, (done) => {

      var testFile = path.join(__dirname, 'assets', 'testStart.avi');
      var startCalled = false;

      files.push(testFile);

      getCommand({ source: testfilebig, logger: testhelper.logger })
          .on('start', (cmdline) => {
            startCalled = true;

            // Only test a subset of command line
            cmdline.indexOf('ffmpeg').should.equal(0);
            cmdline.indexOf('testvideo-5m').should.not.equal(-1);
            cmdline.indexOf('-b:a 128k').should.not.equal(-1);
          })
          .usingPreset('divx')
          .on('error', (err, stdout, stderr) => {
            testhelper.logError(err, stdout, stderr);
            assert.ok(!err);
          })
          .on('end', () => {
            startCalled.should.equal(true);
            done();
          })
          .saveToFile(testFile);
    });

    it('should report output lines through \'stderr\' event',{timeout: 60000}, (done) => {

      var testFile = path.join(__dirname, 'assets', 'testStderr.avi');
      var lines = [];

      files.push(testFile);

      getCommand({ source: testfile, logger: testhelper.logger })
          .on('stderr', (line) => {
            lines.push(line);
          })
          .usingPreset('divx')
          .on('error', (err, stdout, stderr) => {
            testhelper.logError(err, stdout, stderr);
            assert.ok(!err);
          })
          .on('end', () => {
            lines.length.should.above(0);
            lines[0].should.startWith('ffmpeg version');
            lines.filter((l) => l.indexOf('Press [q]') === 0.).length.should.above(0);
            done();
          })
          .saveToFile(testFile);
    });
  });

  describe('Output limiting', () => {
    it('should limit stdout/stderr lines',{timeout: 60000}, (done) => {

      var testFile = path.join(__dirname, 'assets', 'testLimit10.avi');

      files.push(testFile);

      getCommand({ stdoutLines: 10, source: testfile, logger: testhelper.logger })
          .usingPreset('divx')
          .on('error', (err, stdout, stderr) => {
            testhelper.logError(err, stdout, stderr);
            assert.ok(!err);
          })
          .on('end', (stdout, stderr) => {
            stdout.split('\n').length.should.below(11);
            stderr.split('\n').length.should.below(11);
            done();
          })
          .saveToFile(testFile);
    });
  });

  describe('takeScreenshots', () => {
    function testScreenshots(title, name, config, files) {
      it(title, {timeout: 60000}, (done) => {
        var filenamesCalled = false;
        var testFolder = path.join(__dirname, 'assets', 'screenshots_' + name);
        files.forEach((file) => {
          files.push(path.join(testFolder, file));
        });
        dirs.push(testFolder);

        getCommand({ source: testfile, logger: testhelper.logger })
          .on('error', (err, stdout, stderr) => {
            testhelper.logError(err, stdout, stderr);
            assert.ok(!err);
          })
          .on('filenames', (filenames) => {
            filenamesCalled = true;
            filenames.length.should.equal(files.length);
            filenames.forEach((file, index) => {
              file.should.equal(files[index]);
            });
          })
          .on('end', () => {
            filenamesCalled.should.equal(true);
            fs.readdir(testFolder, (err, content) => {
              var tnCount = 0;
              content.forEach((file) => {
                if (file.indexOf('.png') > -1) {
                  tnCount++;
                }
              });
              tnCount.should.equal(files.length);
              files.forEach((file) => {
                content.indexOf(file).should.not.equal(-1);
              });
              done();
            });
          })
          .takeScreenshots(config, testFolder);
      });
    }

    testScreenshots(
      'should take screenshots from a list of number timemarks',
      'timemarks_num',
      { timemarks: [ 0.5, 1 ] },
      ['tn_1.png', 'tn_2.png']
    );

    testScreenshots(
      'should take screenshots from a list of string timemarks',
      'timemarks_string',
      { timemarks: [ '0.5', '1' ] },
      ['tn_1.png', 'tn_2.png']
    );

    testScreenshots(
      'should take screenshots from a list of string timemarks',
      'timemarks_hms',
      { timemarks: [ '00:00:00.500', '00:01' ] },
      ['tn_1.png', 'tn_2.png']
    );

    testScreenshots(
      'should support "timestamps" instead of "timemarks"',
      'timestamps',
      { timestamps: [ 0.5, 1 ] },
      ['tn_1.png', 'tn_2.png']
    );

    testScreenshots(
      'should replace %i with the screenshot index',
      'filename_i',
      { timemarks: [ 0.5, 1 ], filename: 'shot_%i.png' },
      ['shot_1.png', 'shot_2.png']
    );

    testScreenshots(
      'should replace %000i with the padded screenshot index',
      'filename_0i',
      { timemarks: [ 0.5, 1 ], filename: 'shot_%000i.png' },
      ['shot_0001.png', 'shot_0002.png']
    );

    testScreenshots(
      'should replace %s with the screenshot timestamp',
      'filename_s',
      { timemarks: [ 0.5, '40%', 1 ], filename: 'shot_%s.png' },
      ['shot_0.5.png', 'shot_0.8.png', 'shot_1.png']
    );

    testScreenshots(
      'should replace %f with the input filename',
      'filename_f',
      { timemarks: [ 0.5, 1 ], filename: 'shot_%f_%i.png' },
      ['shot_testvideo-43.avi_1.png', 'shot_testvideo-43.avi_2.png']
    );

    testScreenshots(
      'should replace %b with the input basename',
      'filename_b',
      { timemarks: [ 0.5, 1 ], filename: 'shot_%b_%i.png' },
      ['shot_testvideo-43_1.png', 'shot_testvideo-43_2.png']
    );

    testScreenshots(
      'should replace %r with the output resolution',
      'filename_r',
      { timemarks: [ 0.5, 1 ], filename: 'shot_%r_%i.png' },
      ['shot_1024x768_1.png', 'shot_1024x768_2.png']
    );

    testScreenshots(
      'should replace %w and %h with the output resolution',
      'filename_wh',
      { timemarks: [ 0.5, 1 ], filename: 'shot_%wx%h_%i.png' },
      ['shot_1024x768_1.png', 'shot_1024x768_2.png']
    );

    testScreenshots(
      'should automatically add %i when no variable replacement is present',
      'filename_add_i',
      { timemarks: [ 0.5, 1 ], filename: 'shot_%b.png' },
      ['shot_testvideo-43_1.png', 'shot_testvideo-43_2.png']
    );

    testScreenshots(
      'should automatically compute timestamps from the "count" option',
      'count',
      { count: 3, filename: 'shot_%s.png' },
      ['shot_0.5.png', 'shot_1.png', 'shot_1.5.png']
    );

    testScreenshots(
      'should enable setting screenshot size',
      'size',
      { count: 3, filename: 'shot_%r.png', size: '150x?' },
      ['shot_150x112_1.png', 'shot_150x112_2.png', 'shot_150x112_3.png']
    );

    testScreenshots(
      'a single screenshot should not have a _1 file name suffix',
      'no_suffix',
      { timemarks: [ 0.5 ] },
      ['tn.png']
    );
  });

  describe('saveToFile', () => {
    it('should save the output file properly to disk', (done) => {
      var testFile = path.join(__dirname, 'assets', 'testConvertToFile.avi');
      files.push(testFile);

      getCommand({ source: testfile, logger: testhelper.logger })
        .usingPreset('divx')
        .on('error', (err, stdout, stderr) => {
          testhelper.logError(err, stdout, stderr);
          assert.ok(!err);
        })
        .on('end', () => {
          fs.access(testFile, fs.constants.F_OK, (err) => {
            assert.ok(!err);
            // check filesize to make sure conversion actually worked
            fs.stat(testFile, (err, stats) => {
              assert.ok(!err && stats);

              stats.size.should.above(0);
              stats.isFile().should.equal(true);

              done();
            });
          });
        })
        .saveToFile(testFile);
    });

    it('should save an output file with special characters properly to disk', (done) => {
      var testFile = path.join(__dirname, 'assets', 'te[s]t video \' " .avi');
      files.push(testFile);

      this.getCommand({ source: testfile, logger: testhelper.logger })
        .usingPreset('divx')
        .on('error', (err, stdout, stderr) => {
          testhelper.logError(err, stdout, stderr);
          assert.ok(!err);
        })
        .on('end', () => {
          done();
        })
        .saveToFile(testFile);
    });

    it('should save output files with special characters', (done) => {
      var testFile = path.join(__dirname, 'assets', '[test "special \' char*cters \n.avi');
      files.push(testFile);

      getCommand({ source: testfile, logger: testhelper.logger })
        .usingPreset('divx')
        .on('error', (err, stdout, stderr) => {
          testhelper.logError(err, stdout, stderr);
          assert.ok(!err);
        })
        .on('end', () => {
          fs.access(testFile, fs.constants.F_OK, (err) => {
            assert.ok(!err);
            // check filesize to make sure conversion actually worked
            fs.stat(testFile, (err, stats) => {
              assert.ok(!err && stats);
              stats.size.should.above(0);
              stats.isFile().should.equal(true);

              done();
            });
          });
        })
        .saveToFile(testFile);
    });

    it('should accept a stream as its source', (done) => {
      var testFile = path.join(__dirname, 'assets', 'testConvertFromStreamToFile.avi');
      files.push(testFile);

      var instream = fs.createReadStream(testfile);
      getCommand({ source: instream, logger: testhelper.logger })
        .usingPreset('divx')
        .on('error', (err, stdout, stderr) => {
          testhelper.logError(err, stdout, stderr);
          assert.ok(!err);
        })
        .on('end', () => {
          fs.access(testFile, fs.constants.F_OK, (err) => {
            assert.ok(!err);
            // check filesize to make sure conversion actually worked
            fs.stat(testFile, (err, stats) => {
              assert.ok(!err && stats);
              stats.size.should.above(0);
              stats.isFile().should.equal(true);

              done();
            });
          });
        })
        .saveToFile(testFile);
    });

    it('should pass input stream errors through to error handler', (done) => {
      var testFile = path.join(__dirname, 'assets', 'testConvertFromStream.avi')

		const readError = new Error('Read Error')
      const instream = new Readable({
        read() {
  		    process.nextTick(() => this.emit('error', readError))
		  }
      })

      const command = getCommand({ source: instream, logger: testhelper.logger })

      let startCalled = false

      command
          .usingPreset('divx')
          .on('start', () => {
          	startCalled = true
            command.ffmpegProc.on('exit', () => {
            	fs.access(testFile, fs.constants.F_OK, (err) => {
            		assert.ok(err);
						done()
            	})
            })
          })
          .on('error', (err, stdout, stderr) => {
            this.saveOutput(stdout, stderr)
            startCalled.should.be.true()
            assert.ok(err)
            err.message.indexOf('Input stream error: ').should.equal(0)
			   assert.strictEqual(err.inputStreamError, readError)
          })
          .on('end', (stdout, stderr) => {
            testhelper.logOutput(stdout, stderr)
            console.log('end was called, expected a error')
            assert.ok(false)
            done()
          })
          .saveToFile(testFile)
    })
  });

  describe('mergeToFile', () => {

    it('should merge multiple files', (done) => {
      var testFile = path.join(__dirname, 'assets', 'testMergeAddOption.wav');
      files.push(testFile);

      getCommand({source: testfileaudio1, logger: testhelper.logger})
        .on('error', (err, stdout, stderr) => {
          testhelper.logError(err, stdout, stderr);
          assert.ok(!err);
        })
        .on('end', () => {
          fs.access(testFile, fs.constants.F_OK, (err) => {
            assert.ok(!err);
            // check filesize to make sure conversion actually worked
            fs.stat(testFile, (err, stats) => {
              assert.ok(!err && stats);
              stats.size.should.above(0);
              stats.isFile().should.equal(true);

              done();
            });
          });
        })
        .mergeAdd(testfileaudio2)
        .mergeAdd(testfileaudio3)
        .mergeToFile(testFile);
    });
  });

  describe('writeToStream', () => {
    it('should save the output file properly to disk using a stream', (done) => {
      var testFile = path.join(__dirname, 'assets', 'testConvertToStream.avi');
      files.push(testFile);

      var outstream = fs.createWriteStream(testFile);
      getCommand({ source: testfile, logger: testhelper.logger })
        .usingPreset('divx')
        .on('error', (err, stdout, stderr) => {
          testhelper.logError(err, stdout, stderr);
          assert.ok(!err);
        })
        .on('end', (stdout, stderr) => {
          fs.access(testFile, fs.constants.F_OK, (err) => {
            if (err) {
              console.log(stderr);
            }

            assert.ok(!err);

            // check filesize to make sure conversion actually worked
            fs.stat(testFile, (err, stats) => {
              assert.ok(!err && stats);
              stats.size.should.above(0);
              stats.isFile().should.equal(true);

              done();
            });
          });
        })
        .writeToStream(outstream, {end:true});
    });

    it('should accept a stream as its source', (done) => {
      var testFile = path.join(__dirname, 'assets', 'testConvertFromStreamToStream.avi');
      files.push(testFile);

      var instream = fs.createReadStream(testfile);
      var outstream = fs.createWriteStream(testFile);

      getCommand({ source: instream, logger: testhelper.logger })
        .usingPreset('divx')
        .on('error', (err, stdout, stderr) => {
          testhelper.logError(err, stdout, stderr);
          assert.ok(!err);
        })
        .on('end', (stdout, stderr) => {
          fs.access(testFile, fs.constants.F_OK, (err) => {
            if (err) {
              console.log(stderr);
            }

            assert.ok(!err);
            // check filesize to make sure conversion actually worked
            fs.stat(testFile, (err, stats) => {
              assert.ok(!err && stats);
              stats.size.should.above(0);
              stats.isFile().should.equal(true);

              done();
            });
          });
        })
        .writeToStream(outstream);
    });

    (process.version.match(/v0\.8\./) ? it.skip : it)('should return a PassThrough stream when called with no arguments on node >=0.10', (done) => {
      var testFile = path.join(__dirname, 'assets', 'testConvertToStream.avi');
      files.push(testFile);

      var outstream = fs.createWriteStream(testFile);
      var command = getCommand({ source: testfile, logger: testhelper.logger });

      command
        .usingPreset('divx')
        .on('error', (err, stdout, stderr) => {
          testhelper.logError(err, stdout, stderr);
          assert.ok(!err);
        })
        .on('end', (stdout, stderr) => {
          fs.access(testFile, fs.constants.F_OK, (err) => {
            if (err) {
              console.log(stderr);
            }

            assert.ok(!err);

            // check filesize to make sure conversion actually worked
            fs.stat(testFile, (err, stats) => {
              assert.ok(!err && stats);
              stats.size.should.above(0);
              stats.isFile().should.equal(true);

              done();
            });
          });
        });

      var passthrough = command.writeToStream({end: true});

      passthrough.should.instanceof(PassThrough);
      passthrough.pipe(outstream);
    });

    (process.version.match(/v0\.8\./) ? it : it.skip)('should throw an error when called with no arguments on node 0.8', () => {
      (() => {
        new FfmpegCommand().writeToStream({end: true});
      }).should.throw(/PassThrough stream is not supported on node v0.8/);
    });

    it('should pass output stream errors through to error handler', (done) => {

		const writeError = new Error('Write Error')
      const outstream = new Writable({
        write(chunk, encoding, callback) {
          callback(writeError)
		  }
      })

      const command = getCommand({ source: testfile, logger: testhelper.logger })

      let startCalled = false

      command
          .usingPreset('divx')
          .on('start', () => {
          	startCalled = true
            command.ffmpegProc.on('exit', () => {
					done()
            })
          })
          .on('error', (err, stdout, stderr) => {
            this.saveOutput(stdout, stderr)
            startCalled.should.be.true()
            assert.ok(err)
            err.message.indexOf('Output stream error: ').should.equal(0)
			   assert.strictEqual(err.outputStreamError, writeError)
          })
          .on('end', (stdout, stderr) => {
            console.log('end was called, expected a error')
            testhelper.logOutput(stdout, stderr)
            assert.ok(false)
            done()
          })
          .writeToStream(outstream)
    })
  });

  describe('Outputs', () => {
    it('should create multiple outputs', {timeout: 30000}, (done) => {

      var testFile1 = path.join(__dirname, 'assets', 'testMultipleOutput1.avi');
      files.push(testFile1);
      var testFile2 = path.join(__dirname, 'assets', 'testMultipleOutput2.avi');
      files.push(testFile2);
      var testFile3 = path.join(__dirname, 'assets', 'testMultipleOutput3.mp4');
      files.push(testFile3);

      getCommand({ source: testfilebig, logger: testhelper.logger })
        .output(testFile1)
        .withAudioCodec('vorbis')
        .withVideoCodec('copy')
        .output(testFile2)
        .withAudioCodec('libmp3lame')
        .withVideoCodec('copy')
        .output(testFile3)
        .withSize('160x120')
        .withAudioCodec('aac')
        .withVideoCodec('libx264')
        .on('error', (err, stdout, stderr) => {
          testhelper.logError(err, stdout, stderr);
          assert.ok(!err);
        })
        .on('end', () => {
          async.map(
            [testFile1, testFile2, testFile3],
            (file, cb) => {
              fs.access(file, fs.constants.F_OK, (err) => {
                assert.ok(!err);

                // check filesize to make sure conversion actually worked
                fs.stat(file, (err, stats) => {
                  assert.ok(!err && stats);
                  stats.size.should.above(0);
                  stats.isFile().should.equal(true);

                  cb(err);
                });
              });
            },
            (err) => {
              testhelper.logError(err);
              assert.ok(!err);
              done();
            }
          );
        })
        .run();
    });
  });

  describe('Inputs', () => {
    it('should take input from a file with special characters', (done) => {
      var testFile = path.join(__dirname, 'assets', 'testSpecialInput.avi');
      files.push(testFile);

      getCommand({ source: testfilespecial, logger: testhelper.logger, timeout: 10 })
        .takeFrames(50)
        .usingPreset('divx')
        .on('error', (err, stdout, stderr) => {
          testhelper.logError(err, stdout, stderr);
          assert.ok(!err);
        })
        .on('end', () => {
          fs.access(testFile, fs.constants.F_OK, (err) => {
            assert.ok(!err);
            // check filesize to make sure conversion actually worked
            fs.stat(testFile, (err, stats) => {
              assert.ok(!err && stats);
              stats.size.should.above(0);
              stats.isFile().should.equal(true);

              done();
            });
          });
        })
        .saveToFile(testFile);
    });
  });

  describe.skip('Remote I/O', {timeout: 60000}, () => {
    var ffserver;

    beforeAll((done) => {
      testhelper.logger.debug('spawning ffserver');
      ffserver = spawn(
        'ffserver',
        ['-d','-f', path.join(__dirname, 'assets', 'ffserver.conf')],
        { cwd: path.join(__dirname, 'assets') }
      );

      // Wait for ffserver to be ready
      var isready = false;
      function ready() {
        if (!isready) {
          testhelper.logger.debug('ffserver is ready');
          isready = true;
          done();
        }
      }

      ffserver.stdout.on('data', (d) => {
        if (d.toString().match(/server started/i)) {
          ready();
        }
      });

      ffserver.stderr.on('data', (d) => {
        if (d.toString().match(/server started/i)) {
          ready();
        }
      });

    });

    beforeEach((done) => {
      setTimeout(done, 5000);
    });

    afterAll((done) => {
      ffserver.kill();
      setTimeout(done, 1000);
    });

    it('should take input from a RTSP stream', (done) => {
      var testFile = path.join(__dirname, 'assets', 'testRTSPInput.avi');
      files.push(testFile);

      getCommand({ source: encodeURI(testRTSP), logger: testhelper.logger, timeout: 0 })
        .takeFrames(10)
        .usingPreset('divx')
        .withSize('320x240')
        .on('error', (err, stdout, stderr) => {
          testhelper.logError(err, stdout, stderr);
          assert.ok(!err);
        })
        .on('end', () => {
          fs.access(testFile, fs.constants.F_OK, (err) => {
            assert.ok(!err);
            // check filesize to make sure conversion actually worked
            fs.stat(testFile, (err, stats) => {
              assert.ok(!err && stats);
              stats.size.should.above(0);
              stats.isFile().should.equal(true);

              done();
            });
          });
        })
        .saveToFile(testFile);
    });

    it('should take input from an URL', (done) => {
      var testFile = path.join(__dirname, 'assets', 'testURLInput.avi');
      files.push(testFile);

      getCommand({ source: testHTTP, logger: testhelper.logger, timeout: 0 })
        .takeFrames(5)
        .usingPreset('divx')
        .withSize('320x240')
        .on('error', (err, stdout, stderr) => {
          testhelper.logError(err, stdout, stderr);
          assert.ok(!err);
        })
        .on('end', () => {
          fs.access(testFile, fs.constants.F_OK, (err) => {
            assert.ok(!err);
            // check filesize to make sure conversion actually worked
            fs.stat(testFile, (err, stats) => {
              assert.ok(!err && stats);
              stats.size.should.above(0);
              stats.isFile().should.equal(true);

              done();
            });
          });
        })
        .saveToFile(testFile);
    });

    it('should output to a RTP stream', (done) => {
      getCommand({ source: testfilebig, logger: testhelper.logger })
        .videoCodec('libx264')
        .audioCodec('copy')
        .on('error', (err, stdout, stderr) => {
          testhelper.logError(err, stdout, stderr);
          assert.ok(!err);
        })
        .on('end', () => {
          done();
        })
        .save(testRTPOut);
    });
  });

  describe('Errors', () => {
    it('should report an error when ffmpeg has been killed',{timeout: 10000}, (done) => {

      var testFile = path.join(__dirname, 'assets', 'testErrorKill.avi');
      files.push(testFile);

      var command = getCommand({ source: this.testfilebig, logger: testhelper.logger });

      command
        .usingPreset('divx')
        .on('start', () => {
          setTimeout(() => {
            command.kill('SIGKILL');
          }, 200);
        })
        .on('error', (err) => {
          err.message.should.match(/ffmpeg was killed with signal SIGKILL/);
          done();
        })
        .on('end', () => {
          assert.ok(false);
        })
        .saveToFile(testFile);
    });

    it('should report ffmpeg errors', (done) => {
      getCommand({ source: this.testfilebig, logger: testhelper.logger })
        .addOption('-invalidoption')
        .on('error', (err) => {
          setTimeout(done, 1000);
          err.message.should.match(/Unrecognized option 'invalidoption'/);
        })
        .saveToFile('/will/not/be/created/anyway');
    });
  });
});
