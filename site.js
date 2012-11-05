Array.prototype.tap = function(f) { this.forEach(f); return this; }

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
        var shuffled = shuffle(playlist);
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

function trackFields(track) {
  var fields = views.Track.FIELD.STAR     | views.Track.FIELD.SHARE
             | views.Track.FIELD.NAME     | views.Track.FIELD.ARTIST
             | views.Track.FIELD.DURATION | views.Track.FIELD.ALBUM
             | views.Track.FIELD.POPULARITY;
  return new views.Track(track, fields);
};
