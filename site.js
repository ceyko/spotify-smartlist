"use strict";

var sp = getSpotifyApi(1);
var models = sp.require('sp://import/scripts/api/models');
var views = sp.require('sp://import/scripts/api/views');
var player = models.player;


$(document).ready(function() {
  /** 
   * Setup #drop_box's handlers: highlight on drag, create playlist on drop.
   */
  $('#dropbox')
    .on('dragenter dragover', function(e) {
      e.originalEvent.dataTransfer.dropEffect = 'copy'; // allow drop
      $(this).addClass('over');
      return false;
    })
    .on('dragleave drop', function(e) {
      $(this).removeClass('over');
      return false;
    })
    .on('drop', function(e) {
      var uri = e.originalEvent.dataTransfer.getData('text');
      var playlist = models.Playlist.fromURI(uri);

      // create slider
      $('#smart-slider').slider({
        min: 0,
        max: 4,
        value: 2,
        // large enough step to easily click on min or max
        step: 0.25,
        // re-shuffle the playlist whenever slider moves
        change: function(e,ui) { create_smartlist(playlist); },
        animate: 'fast'
      });

      // wait until slider is created as we use its current value
      create_smartlist(playlist);

      // show slider and player and hide text
      $('#dropbox-text').css('display','none');
      $('#smart-player').css('display','block');
      $('#smart-slider-container').css('display','block');

      return false;
    });
});


/**
 * Create a randomized playlist and add it to the DOM.
 */
function create_smartlist(playlist) {
  // create shuffled playlist
  var shuffled = random_no_replacement(playlist);
  // add player view
  var player = new views.Player();
  player.track = null;
  player.context = shuffled;
  $("#smart-player").empty().append(player.node);
  // add playlist view
  var list = new views.List(shuffled, trackFields);
  $("#smart-playlist").empty().append(list.node);
}

/**
 * Return a new playlist shuffling tracks in order of a random variable chosen
 * proportionally to popularity.
 */
function shuffle(playlist) {
  var shuffled = new models.Playlist();
  shuffled.add(weighted(playlist.tracks.map(function(x){ return new Track(x); }))
    .sort(function(x,y){ return compare(y.weight,x.weight); }) // reverse order
    .map(function(x){ return x.track; }));
  return shuffled;
}

/**
 * Return a new playlist choosing (with replacement) tracks from playlist with
 * probability proportional to their popularity.
 */
function random(playlist) {
  var tracks = weighted(playlist.tracks.map(function(x){ return new Track(x); }));
  // Pick elements for the new playlist
  var shuffled = new models.Playlist();
  var comp_ranges = function(x,y){ return compare(x.range,y.range); };
  for (var i=0; i<tracks.length; i++) {
    var index = tracks.bsearch(
        {range:Math.random()},
        comp_ranges);
    shuffled.add(tracks[index].track);
  }
  return shuffled;
}

/**
 * Return a new playlist choosing (without replacement) tracks from playlist
 * with probability proportional to their popularity.
 */
function random_no_replacement(playlist) {
  // We can find the optimal value for the max number of fails before
  // re-weighing by plotting max_fails vs time_elapsed vs playlist_length, but
  // unless we have playlists a few orders of magnitude larger than 1000 it
  // doesn't really matter. Choosing 2 seemed like a good tradeoff.
  var max_fails = 2;
  var num_fails = 0;
  var tracks = weighted(playlist.tracks.map(function(x){ return new Track(x); }));

  // pick elements until we've chosen all tracks
  var shuffled = new models.Playlist();
  var comp_ranges = function(x,y){ return compare(x.range,y.range); };
  var unselected = function(x){ return !x.selected; };
  while (shuffled.length < playlist.length) {
    // pick a random track
    var index = tracks.bsearch(
        {range:Math.random()},
        comp_ranges);
    // add track if not previously added
    if (!tracks[index].selected) {
      tracks[index].selected = true;
      shuffled.add(tracks[index].track);
    }
    // remove all selected tracks and re-weight if we've failed enough times
    else if (++num_fails >= max_fails) {
      num_fails = 0;
      tracks = weighted(tracks.filter(unselected));
    }
  }

  return shuffled;
}

/**
 * Returns a number in (0,1] for the value of the track.
 */
function default_value(track) {
  // min and max for base value
  var min = 1;
  var max = 100;

  // amount to increase distance between tracks of similar value
  // Sliders must have smaller numbers on the left, but less randomness is
  // given by a larger number, so we invert the value.
  var exp = $('#smart-slider').slider('option','max') - $('#smart-slider').slider('value');
  // There's many more values that will give less shuffled arrangements, so we
  // increase the value to make up for that, so the middle of the slider will
  // actually represent a medium amount of randomness.
  exp = Math.pow(exp,3);
  
  // scale value to (0,1]
  var value = Math.max(min, track.popularity);
  return Math.pow(value,exp) / Math.pow(max,exp); 
}

/**
 * Assigns the weight and range to tracks, using the function, value.
 * 
 * @param {Track[]} tracks Array of track objects
 * @param {optional Function} value Optional valuation function: 
 *    models.Track -> Number
 * @return {Track[]} Array of track objects, sorted by range, where the
 *    difference between an element's range and the next element's range is
 *    equal to its weight.
 */
function weighted(tracks, value) {
  value = value || default_value;

  // get the weight of each track
  var total_value = tracks.reduce(function(sum,x){ return sum+value(x.track); }, 0);
  tracks.forEach(function(x){ x.weight = value(x.track)/total_value; });

  // get the range of weights that represent each track
  // subtrack current weight from range so first is 0
  var total_weight = 0;
  tracks.forEach(function(x){ x.range = (total_weight += x.weight) - x.weight; });

  return tracks;
}

function trackFields(track) {
  var fields = views.Track.FIELD.STAR     | views.Track.FIELD.SHARE
             | views.Track.FIELD.NAME     | views.Track.FIELD.ARTIST
             | views.Track.FIELD.DURATION | views.Track.FIELD.ALBUM
             | views.Track.FIELD.POPULARITY;
  return new views.Track(track, fields);
}

/**
 * @constructor Track
 * @param {models.Track} track A spotify track
 * @param {optional Number} weight The value of the track, in range [0,1]
 * @param {optional Number} range The lower bound of the range in [0,1] that
 *    represents this track. The upper bound is the range+weight. Used so a
 *    random number in [0,1] chooses a track with probability proportional to
 *    its weight of the track, in range [0,1].
 */
function Track(track, weight, range) {
  this.track  = track;
  this.weight = weight || 0;
  this.range  = range  || 1;
}

/**
 * Compare two values, returning 0 if equal, -1 if x<y, and 1 otherwise.
 */
function compare(x, y) {
	return x === y ? 0 : x <= y ? -1 : 1;
}

/**
 * Equivalent to Array.forEach, but also returns the array for chaining.
 */
Array.prototype.tap = function(f) { this.forEach(f); return this; };

/**
 * Binary search a sorted array, returning the index of an element equal to or
 * closest to the specified value, choosing the smaller index if between two
 * elements.
 *
 * @param {*} value Value to search for.
 * @param {Function=} opt_comp Optional comparison function.
 */
Array.prototype.bsearch = function(value, opt_comp) {

  // Use default comparator if none specified
  opt_comp = opt_comp || compare;

  var bsearch = function(value, low, high) {
    // Simple (low+high)/2 version will work for all arrays with less than 2^53
    // elements (numbers greater than 2^53 are represented as floating points),
    // but no harm in being safe.
    // Also dont access array outside bounds (ie, when value < all elements).
    var mid = Math.max(0, low + Math.floor((high - low)/2));

    // Return index if we've found value
    if (opt_comp(this[mid],value) === 0) {
      return mid;
    }
    // Return index of greatest element still less than low, or zero if value
    // is smaller than all elements
    if (low >= high) {
      return Math.max(0, (opt_comp(value,this[low]) > 0) ? low : low-1);
    }
    
    // Recurse on new search area
    if (opt_comp(value, this[mid]) < 0) {
      return bsearch.call(this, value, low, mid-1);
    }
    else {
      return bsearch.call(this, value, mid+1, high);
    }
  };

  return bsearch.call(this, value, 0, this.length-1);
};
