var sp = getSpotifyApi(1);
var models = sp.require('sp://import/scripts/api/models');
var views = sp.require('sp://import/scripts/api/views');
var player = models.player;

window.onload = function() {
  var drop_box = document.querySelector('#drop_box');

  drop_box.addEventListener('dragstart', function(e){
    e.dataTransfer.setData('text/html', this.innerHTML);
    e.dataTransfer.effectAllowed = 'copy';
  }, false);

  drop_box.addEventListener('dragenter', function(e){
    if (e.preventDefault) e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    this.classList.add('over');
  }, false);

  drop_box.addEventListener('dragover', function(e){
    if (e.preventDefault) e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    return false;
  }, false);

  drop_box.addEventListener('drop', function(e){
    if (e.preventDefault) e.preventDefault();
    var drop = models.Playlist.fromURI(e.dataTransfer.getData('text'),
      function(playlist) {
        // create shuffled playlist
        var shuffled = random(playlist);
        // add player view
        var player = new views.Player();
        player.track = null;
        player.context = shuffled;
        document.querySelector("#player_html").appendChild(player.node);
        // add playlist view
        var list = new views.List(shuffled, trackFields);
        document.querySelector("#playlist_html").appendChild(list.node);
      });
    this.classList.remove('over');
    var success_message = document.createElement('p');
    success_message.innerHTML = 'Playlist successfully dropped: ' + drop.uri;
    this.appendChild(success_message);
  }, false);
};

function shuffle(playlist) {
  var shuffled = new models.Playlist;
  playlist.tracks
    .map(function(x){ return [x,Math.pow(x.popularity,2)*Math.random()]; })
    .sort(function(x,y){ return y[1]-x[1]; })
    .tap(function(x){ console.log(x[0].popularity + " " + x[1] + " " + x[0].name); })
    .map(function(x){ return x[0]; })
    .forEach(function(x){ shuffled.add(x); });
  return shuffled;
}

/**
 * Return a new playlist choosing (with replacement) tracks from playlist with
 * probability proportional to their popularity.
 */
function random(playlist) {
  var total_pop = playlist.tracks.reduce(function(sum,x){ return sum+x.popularity; }, 0);
  var total_weight = 0;
  var weighted = playlist.tracks
    .map(function(x){ return {track:x, weight:x.popularity/total_pop}; })
    .tap(function(x){ x.weight = (total_weight += x.weight); });
  // Pick elements for the new playlist
  var shuffled = new models.Playlist;
  for (var i=0; i<weighted.length; i++) {
    var index = weighted.bsearch(
        {weight:Math.random()},
        function(x,y){ return compare(x.weight,y.weight); });
    shuffled.add(weighted[index].track);
  }
  return shuffled;
}

function trackFields(track) {
  var fields = views.Track.FIELD.STAR     | views.Track.FIELD.SHARE
             | views.Track.FIELD.NAME     | views.Track.FIELD.ARTIST
             | views.Track.FIELD.DURATION | views.Track.FIELD.ALBUM
             | views.Track.FIELD.POPULARITY;
  return new views.Track(track, fields);
}

/**
 * Equivalent to Array.forEach, but also returns the array for chaining.
 */
Array.prototype.tap = function(f) { this.forEach(f); return this; }

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
    if (opt_comp(this[mid],value) == 0) {
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
}
