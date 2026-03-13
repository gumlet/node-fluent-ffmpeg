/*jshint node:true*/


import fs from 'node:fs';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import utils from './utils.js';


/*
 * Useful recipes for commands
 */

export default function recipes(proto) {
  /**
   * Execute ffmpeg command and save output to a file
   *
   * @method FfmpegCommand#save
   * @category Processing
   * @aliases saveToFile
   *
   * @param {String} output file path
   * @return FfmpegCommand
   */
  proto.saveToFile =
  proto.save = function(output) {
    this.output(output).run();
    return this;
  };


  /**
   * Execute ffmpeg command and save output to a stream
   *
   * If 'stream' is not specified, a PassThrough stream is created and returned.
   * 'options' will be used when piping ffmpeg output to the output stream
   * (@see http://nodejs.org/api/stream.html#stream_readable_pipe_destination_options)
   *
   * @method FfmpegCommand#pipe
   * @category Processing
   * @aliases stream,writeToStream
   *
   * @param {stream.Writable} [stream] output stream
   * @param {Object} [options={}] pipe options
   * @return Output stream
   */
  proto.writeToStream =
  proto.pipe =
  proto.stream = function(stream, options) {
    if (stream && !('writable' in stream)) {
      options = stream;
      stream = undefined;
    }

    if (!stream) {
      if (process.version.match(/v0\.8\./)) {
        throw new Error('PassThrough stream is not supported on node v0.8');
      }

      stream = new PassThrough();
    }

    this.output(stream, options).run();
    return stream;
  };


  /**
   * Generate images from a video
   *
   * Note: this method makes the command emit a 'filenames' event with an array of
   * the generated image filenames.
   *
   * @method FfmpegCommand#screenshots
   * @category Processing
   * @aliases takeScreenshots,thumbnail,thumbnails,screenshot
   *
   * @param {Number|Object} [config=1] screenshot count or configuration object with
   *   the following keys:
   * @param {Number} [config.count] number of screenshots to take; using this option
   *   takes screenshots at regular intervals (eg. count=4 would take screens at 20%, 40%,
   *   60% and 80% of the video length).
   * @param {String} [config.folder='.'] output folder
   * @param {String} [config.filename='tn.png'] output filename pattern, may contain the following
   *   tokens:
   *   - '%s': offset in seconds
   *   - '%w': screenshot width
   *   - '%h': screenshot height
   *   - '%r': screenshot resolution (same as '%wx%h')
   *   - '%f': input filename
   *   - '%b': input basename (filename w/o extension)
   *   - '%i': index of screenshot in timemark array (can be zero-padded by using it like `%000i`)
   * @param {Number[]|String[]} [config.timemarks] array of timemarks to take screenshots
   *   at; each timemark may be a number of seconds, a '[[hh:]mm:]ss[.xxx]' string or a
   *   'XX%' string.  Overrides 'count' if present.
   * @param {Number[]|String[]} [config.timestamps] alias for 'timemarks'
   * @param {Boolean} [config.fastSeek] use fast seek (less accurate)
   * @param {String} [config.size] screenshot size, with the same syntax as {@link FfmpegCommand#size}
   * @param {String} [folder] output folder (legacy alias for 'config.folder')
   * @return FfmpegCommand
   */
  proto.takeScreenshots =
  proto.thumbnail =
  proto.thumbnails =
  proto.screenshot =
  proto.screenshots = function(config, folder) {
    var self = this;
    var source = this._currentInput.source;
    config = config || { count: 1 };

    // Accept a number of screenshots instead of a config object
    if (typeof config === 'number') {
      config = {
        count: config
      };
    }

    // Accept a second 'folder' parameter instead of config.folder
    if (!('folder' in config)) {
      config.folder = folder || '.';
    }

    // Accept 'timestamps' instead of 'timemarks'
    if ('timestamps' in config) {
      config.timemarks = config.timestamps;
    }

    // Compute timemarks from count if not present
    if (!('timemarks' in config)) {
      if (!config.count) {
        throw new Error('Cannot take screenshots: neither a count nor a timemark list are specified');
      }

      const interval = 100 / (1 + config.count);
      config.timemarks = [];
      for (let i = 0; i < config.count; i++) {
        config.timemarks.push(`${interval * (i + 1)}%`);
      }
    }

    let fixedSize, fixedWidth, fixedHeight, percentSize;
    // Parse size option
    if ('size' in config) {
      fixedSize = config.size.match(/^(\d+)x(\d+)$/);
      fixedWidth = config.size.match(/^(\d+)x\?$/);
      fixedHeight = config.size.match(/^\?x(\d+)$/);
      percentSize = config.size.match(/^(\d+)%$/);

      if (!fixedSize && !fixedWidth && !fixedHeight && !percentSize) {
        throw new Error(`Invalid size parameter: ${config.size}`);
      }
    }

    // Metadata helper
    var metadata;
    function getMetadata(cb) {
      if (metadata) {
        cb(null, metadata);
      } else {
        self.ffprobe((err, meta) => {
          metadata = meta;
          cb(err, meta);
        });
      }
    }

    new Promise((resolve, reject) => {
      // Compute percent timemarks if any
      const timemarksRegex = /^[\d.]+%$/;
      if (config.timemarks.some((t) => (`${t}`).match(timemarksRegex))) {
        if (typeof source !== 'string') {
          return reject(new Error('Cannot compute screenshot timemarks with an input stream, please specify fixed timemarks'));
        }

        getMetadata((err, meta) => {
          if (err) return reject(err);

          const vstream = meta.streams.reduce((biggest, stream) => {
            if (stream.codec_type === 'video' && stream.width * stream.height > biggest.width * biggest.height) {
              return stream;
            }
            return biggest;
          }, { width: 0, height: 0 });

          if (vstream.width === 0) {
            return reject(new Error('No video stream in input, cannot take screenshots'));
          }

          let duration = Number(vstream.duration);
          if (Number.isNaN(duration)) {
            duration = Number(meta.format.duration);
          }

          if (Number.isNaN(duration)) {
            return reject(new Error('Could not get input duration, please specify fixed timemarks'));
          }

          config.timemarks = config.timemarks.map((mark) => {
            if ((`${mark}`).match(timemarksRegex)) {
              return duration * parseFloat(mark) / 100;
            }
            return mark;
          });

          resolve();
        });
      } else {
        resolve();
      }
    })
      .then(() => {
        // Turn all timemarks into numbers and sort them
        config.timemarks = config.timemarks.map((mark) => utils.timemarkToSeconds(mark)).sort((a, b) => a - b);
      })
      .then(() => {
        // Add '_%i' to pattern when requesting multiple screenshots and no variable token is present
        let pattern = config.filename || 'tn.png';

        if (pattern.indexOf('.') === -1) {
          pattern += '.png';
        }

        if (config.timemarks.length > 1 && !pattern.match(/%(s|0*i)/)) {
          const ext = path.extname(pattern);
          pattern = `${path.join(path.dirname(pattern), path.basename(pattern, ext))}_%i${ext}`;
        }

        return pattern;
      })
      .then((pattern) => {
        // Replace filename tokens (%f, %b) in pattern
        if (pattern.match(/%[bf]/)) {
          if (typeof source !== 'string') {
            throw new Error('Cannot replace %f or %b when using an input stream');
          }

          pattern = pattern
            .replace(/%f/g, path.basename(source))
            .replace(/%b/g, path.basename(source, path.extname(source)));
        }

        return pattern;
      })
      .then((pattern) => {
        // Compute size if needed
        if (pattern.match(/%[whr]/)) {
          if (fixedSize) {
            return [pattern, fixedSize[1], fixedSize[2]];
          }

          return new Promise((resolve, reject) => {
            getMetadata((err, meta) => {
              if (err) {
                return reject(new Error('Could not determine video resolution to replace %w, %h or %r'));
              }

              const vstream = meta.streams.reduce((biggest, stream) => {
                if (stream.codec_type === 'video' && stream.width * stream.height > biggest.width * biggest.height) {
                  return stream;
                }
                return biggest;
              }, { width: 0, height: 0 });

              if (vstream.width === 0) {
                return reject(new Error('No video stream in input, cannot replace %w, %h or %r'));
              }

              let width = vstream.width;
              let height = vstream.height;

              if (fixedWidth) {
                height = height * Number(fixedWidth[1]) / width;
                width = Number(fixedWidth[1]);
              } else if (fixedHeight) {
                width = width * Number(fixedHeight[1]) / height;
                height = Number(fixedHeight[1]);
              } else if (percentSize) {
                width = width * Number(percentSize[1]) / 100;
                height = height * Number(percentSize[1]) / 100;
              }

              resolve([pattern, Math.round(width / 2) * 2, Math.round(height / 2) * 2]);
            });
          });
        }

        return [pattern, -1, -1];
      })
      .then(([pattern, width, height]) => {
        // Replace size tokens (%w, %h, %r) in pattern
        return pattern
          .replace(/%r/g, '%wx%h')
          .replace(/%w/g, width)
          .replace(/%h/g, height);
      })
      .then((pattern) => {
        // Replace variable tokens in pattern (%s, %i) and generate filename list
        const filenames = config.timemarks.map((t, i) => pattern
          .replace(/%s/g, utils.timemarkToSeconds(t))
          .replace(/%(0*)i/g, (match, padding) => {
            const idx = '' + (i + 1);
            return padding.slice(0, Math.max(0, padding.length + 1 - idx.length)) + idx;
          }));

        self.emit('filenames', filenames);
        return filenames;
      })
      .then((filenames) => {
        // Create output directory
        return new Promise((resolve, reject) => {
          fs.access(config.folder, fs.constants.F_OK, (err) => {
            if (err) {
              fs.mkdir(config.folder, (err) => {
                if (err) reject(err);
                else resolve(filenames);
              });
            } else {
              resolve(filenames);
            }
          });
        });
      })
      .then((filenames) => {
        const count = config.timemarks.length;
        const split = {
          filter: 'split',
          options: count,
          outputs: []
        };
        let filters = [split];

        if ('size' in config) {
          // Set size to generate size filters
          self.size(config.size);

          // Get size filters and chain them with 'sizeN' stream names
          const sizeFilters = self._currentOutput.sizeFilters.get().map((f, i) => {
            if (i > 0) {
              f.inputs = `size${i - 1}`;
            }

            f.outputs = `size${i}`;

            return f;
          });

          // Input last size filter output into split filter
          split.inputs = `size${sizeFilters.length - 1}`;

          // Add size filters in front of split filter
          filters = sizeFilters.concat(filters);

          // Remove size filters
          self._currentOutput.sizeFilters.clear();
        }

        let first = 0;
        for (let i = 0; i < count; i++) {
          const stream = `screen${i}`;
          split.outputs.push(stream);

          if (i === 0) {
            first = config.timemarks[i];
            self.seekInput(first);
          }

          self.output(path.join(config.folder, filenames[i]))
            .frames(1)
            .map(stream);

          if (i > 0) {
            self.seek(config.timemarks[i] - first);
          }
        }

        self.complexFilter(filters);
        self.run();
      })
      .catch((err) => self.emit('error', err));

    return this;
  };


  /**
   * Merge (concatenate) inputs to a single file
   *
   * @method FfmpegCommand#concat
   * @category Processing
   * @aliases concatenate,mergeToFile
   *
   * @param {String|Writable} target output file or writable stream
   * @param {Object} [options] pipe options (only used when outputting to a writable stream)
   * @return FfmpegCommand
   */
  proto.mergeToFile =
  proto.concatenate =
  proto.concat = function(target, options) {
    // Find out which streams are present in the first non-stream input
    var fileInput = this._inputs.filter((input) => !input.isStream)[0];
    this.ffprobe(this._inputs.indexOf(fileInput), (err, data) => {
      if (err) {
        return this.emit('error', err);
      }

      const hasAudioStreams = data.streams.some((stream) => stream.codec_type === 'audio');

      const hasVideoStreams = data.streams.some((stream) => stream.codec_type === 'video');

      // Setup concat filter and start processing
      this.output(target, options)
        .complexFilter({
          filter: 'concat',
          options: {
            n: this._inputs.length,
            v: hasVideoStreams ? 1 : 0,
            a: hasAudioStreams ? 1 : 0
          }
        })
        .run();
    });

    return this;
  };
};
