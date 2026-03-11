/*jshint node:true*/
/*global describe,it*/
import { expect, describe, it } from 'vitest';

import utils from '../lib/utils.js';

describe('Utilities', () => {

  describe('Argument list helper', () => {
    it('Should add arguments to the list', () => {
      var args = utils.args();

      args('-one');
      args('-two', 'two-param');
      args('-three', 'three-param1', 'three-param2');
      args(['-four', 'four-param', '-five', '-five-param']);

      expect(args.get()).toHaveLength(10);
    });

    it('Should return the argument list', () => {
      var args = utils.args();

      args('-one');
      args('-two', 'two-param');
      args('-three', 'three-param1', 'three-param2');
      args(['-four', 'four-param', '-five', '-five-param']);

      var arr = args.get();
      expect(Array.isArray(arr)).toBe(true);
      expect(arr).toHaveLength(10);
      expect(arr).toContain('-three');
      expect(arr).toContain('four-param');
    });

    it('Should clear the argument list', () => {
      var args = utils.args();

      args('-one');
      args('-two', 'two-param');
      args('-three', 'three-param1', 'three-param2');
      args(['-four', 'four-param', '-five', '-five-param']);
      args.clear();

      expect(args.get()).toHaveLength(0);
    });

    it('Should retrieve arguments from the list', () => {
      var args = utils.args();

      args('-one');
      args('-two', 'two-param');
      args('-three', 'three-param1', 'three-param2');
      args(['-four', 'four-param', '-five', '-five-param']);

      var one = args.find('-one');
      expect(Array.isArray(one)).toBe(true);
      expect(one).toHaveLength(0);

      var two = args.find('-two', 1);
      expect(Array.isArray(two)).toBe(true);
      expect(two).toHaveLength(1);
      expect(two[0]).toBe('two-param');

      var three = args.find('-three', 2);
      expect(Array.isArray(three)).toBe(true);
      expect(three).toHaveLength(2);
      expect(three[0]).toBe('three-param1');
      expect(three[1]).toBe('three-param2');

      var nope = args.find('-nope', 2);
      expect(nope).toBeUndefined();
    });

    it('Should remove arguments from the list', () => {
      var args = utils.args();

      args('-one');
      args('-two', 'two-param');
      args('-three', 'three-param1', 'three-param2');
      args(['-four', 'four-param', '-five', '-five-param']);

      args.remove('-four', 1);
      var arr = args.get();
      expect(arr).toHaveLength(8);
      expect(arr[5]).toBe('three-param2');
      expect(arr[6]).toBe('-five');

      args.remove('-one');
      arr = args.get();
      expect(arr).toHaveLength(7);
      expect(arr[0]).toBe('-two');

      args.remove('-three', 2);
      arr = args.get();
      expect(arr).toHaveLength(4);
      expect(arr[1]).toBe('two-param');
      expect(arr[2]).toBe('-five');
    });
  });

  describe('timemarkToSeconds', () => {
    it('should correctly convert a simple timestamp', () => {
      expect(utils.timemarkToSeconds('00:02:00.00')).toBe(120);
    });
    it('should correctly convert a complex timestamp', () => {
      expect(utils.timemarkToSeconds('00:08:09.10')).toBe(489.1);
    });
    it('should correclty convert a simple float string timestamp', () => {
      expect(utils.timemarkToSeconds('132.44')).toBe(132.44);
    });
    it('should correclty convert a simple float timestamp', () => {
      expect(utils.timemarkToSeconds(132.44)).toBe(132.44);
    });
  });

  describe('Lines ring buffer', () => {
    it('should append lines', () => {
      var ring = utils.linesRing(100);
      ring.append('foo\nbar\nbaz\n');
      ring.append('foo\nbar\nbaz\n');
      expect(ring.get()).toBe('foo\nbar\nbaz\nfoo\nbar\nbaz\n');
    });

    it('should append partial lines', () => {
      var ring = utils.linesRing(100);
      ring.append('foo');
      ring.append('bar\nbaz');
      ring.append('moo');
      expect(ring.get()).toBe('foobar\nbazmoo');
    });

    it('should call line callbacks', () => {
      var lines = [];
      function cb(l) {
        lines.push(l);
      }

      var lines2 = [];
      function cb2(l) {
        lines2.push(l);
      }

      var ring = utils.linesRing(100);
      ring.callback(cb);
      ring.callback(cb2);

      ring.append('foo\nbar\nbaz');
      expect(lines).toHaveLength(2);
      expect(lines[0]).toBe('foo');
      expect(lines[1]).toBe('bar');

      expect(lines2).toHaveLength(2);
      expect(lines2[0]).toBe('foo');
      expect(lines2[1]).toBe('bar');

      ring.append('moo\nmeow\n');
      expect(lines).toHaveLength(4);
      expect(lines[2]).toBe('bazmoo');
      expect(lines[3]).toBe('meow');

      expect(lines2).toHaveLength(4);
      expect(lines2[2]).toBe('bazmoo');
      expect(lines2[3]).toBe('meow');
    });

    it('should close correctly', () => {
      var lines = [];
      function cb(l) {
        lines.push(l);
      }

      var ring = utils.linesRing(100);
      ring.callback(cb);

      ring.append('foo\nbar\nbaz');
      expect(lines).toHaveLength(2);
      expect(lines[0]).toBe('foo');
      expect(lines[1]).toBe('bar');

      ring.close();
      expect(lines).toHaveLength(3);
      expect(lines[2]).toBe('baz');

      ring.append('moo\nmeow\n');
      expect(lines).toHaveLength(3);
      expect(ring.get()).toBe('foo\nbar\nbaz');
    });

    it('should limit lines', () => {
      var ring = utils.linesRing(2);
      ring.append('foo\nbar\nbaz');
      expect(ring.get()).toBe('bar\nbaz');
      ring.append('foo\nbar');
      expect(ring.get()).toBe('bazfoo\nbar');
    });

    it('should allow unlimited lines', () => {
      var ring = utils.linesRing(0);
      ring.append('foo\nbar\nbaz');
      expect(ring.get()).toBe('foo\nbar\nbaz');
      ring.append('foo\nbar');
      expect(ring.get()).toBe('foo\nbar\nbazfoo\nbar');
    });
  });
});
