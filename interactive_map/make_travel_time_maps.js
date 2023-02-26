/*
  WALKING TIME INTERACTIVE MAP SCRIPT

  CREATED: 23 March 2022
  AUTHOR: Nat Henry
  PURPOSE: Create interactive maps script for 15-minute city blog post. Assumes that the
    following files have already been loaded:
    - 'mapping_functions.js': mapmaking functions based on Leaflet and used in this script
    - 'map_styling.css': CSS themes
    - 'travel_time_data.js': Defines a `travel_time` variable containing prepared
      block-level data
*/

// MAPPING SCRIPT OPTIONS: CHANGE THIS SECTION TO CUSTOMIZE ----------------------------->

// Set all destinations
// The keys correspond to a fields the GeoJSON object as well as the checkbox IDs
// The values correspond to checkbox labels
var destinations = {
  "groceries": 'Supermarkets',
  "libraries": 'Libraries',
  "parks": 'Parks',
  "bus_stops": 'Bus stops to downtown',
  "link_stops": 'Link stations',
  "restaurants": 'Restaurants',
  "cafes": 'Coffee shops',
  "schools_el": 'Elementary schools',
  "schools_mid": 'Middle/junior high schools',
  "schools_high": 'High schools'
};

// Which options should be checked when the page loads?
var map_terms = ['groceries'];

// Travel time color scheme
var ttColorScheme = new ColorSchemeNumeric(
  limits_asc = [0, 5, 10, 15, 20, 25, 30],
  colors = ["#0868ac", "#5aabac", "#abedab", "#fda668", "#dd643c", "#b8432e", "#999999"],
  labels = [
    'Under 5 min', '5 - 10 min', '10 - 15 min', '15 - 20 min', '20 - 25 min',
    '25 - 30 min', 'Over 30 min'
  ]
);


// SHOULD NOT NEED TO CHANGE MUCH BELOW THIS LINE --------------------------------------->

// Function to add checkboxes to a form
function add_option(opt_id, opt_name, target){
  var list_item = document.createElement('li');
  list_item.setAttribute('class', 'blank-list');
  var checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = opt_id;
  checkbox.name = opt_id;
  checkbox.setAttribute('class', 'destcheckbox');
  var lab = document.createElement('label');
  lab.setAttribute('for', opt_id);
  lab.innerHTML = " " + opt_name;
  list_item.appendChild(checkbox);
  list_item.appendChild(lab);
  target.appendChild(list_item);
}

// Create all form checkboxes
var walk_form = document.getElementById('walkselect');
for(dest in destinations){
  add_option(dest, destinations[dest], walk_form);
}

// Set some checkboxes to active at the start
map_terms.forEach((checked_id) => {
  document.getElementById(checked_id).checked = true;
});


// Helper functions to succinctly make and update maps ---------------------------------->

// Function to get all map names to consider based on checked boxes
function get_map_terms(){
  var checked_ids = [];
  for(dest in destinations){
    if(document.getElementById(dest).checked){
      checked_ids.push(dest);
    }
  }
  return(checked_ids)
}

// Function to update overall travel time based on selected destinations
// Displayed travel time is stored in a 'tt' attribute
update_travel_times = function(layer, destinations){
  // Layer must contain a 'feature' key
  if('feature' in layer){
    if(destinations.length == 0){
      // Case: no destinations selected
      layer.feature.properties.tt = 999;
    } else {
      // Case: at least one destination selected
      layer.feature.properties.tt = 0;
      destinations.forEach((destination) => {
        layer.feature.properties.tt = Math.max(
          layer.feature.properties.tt, layer.feature.properties[destination]
        );
      });
    }
  }
  return(layer)
}

// Interaction functions for features
function highlightFeature(e){
  var layer = e.target;
  layer.setStyle(style = {weight: 3});
  if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
    layer.bringToFront();
  }
  info.update(layer.feature.properties);
}
function resetHighlight(e){
  var layer = e.target;
  layer.setStyle(style = {weight: .25});
  info.update();
}
function onEachFeature(feature, layer){
  layer.on({
    mouseover: highlightFeature,
    mouseout: resetHighlight
  });
}


// Create a polygon block map based on travel times ------------------------------------->

// Create the basemap
var walkability_map = create_choro_map_base(
  map_div_id = 'walkability', ctr = [travel_time.mid_lat, travel_time.mid_lon],
  bounds = [[travel_time.min_lat, travel_time.min_lon], [travel_time.max_lat, travel_time.max_lon]],
  minZoom = 11, maxZoom = 16, startZoom = travel_time.zoom,
  attr_addon = ''
);
// Legend text
var tt_legend_html = (
  '<p style="text-align:center; margin:0px 0px 4px 0px; line-height:16px;">' +
  '<strong>Walking time</strong></p>' +
  ttColorScheme.legend_html()
);
// Add legend to bottom right
var legend = L.control(options = {position: 'bottomright'});
legend.onAdd = function(map){
  var div = L.DomUtil.create(tagname = 'div', classname = 'leafinfo leaflegend');
  div.innerHTML = tt_legend_html;
  return div;
}
legend.addTo(walkability_map);

// Define display style for each block
function tt_style(feature) {
  return {
    fillColor: ttColorScheme.color_from_value(feature.properties.tt),
    weight: .25, opacity: 1, color: '#222', fillOpacity: .9
  };
}

// Add info box to top right
var info = L.control(options = {position: 'topright'});
info.onAdd = function(map){
    this._div = L.DomUtil.create(tagname = 'div', classname = 'leafinfo movebox-v2');
    this.update();
    return this._div;
};
// Function for updating info box
info.update = function(feature){
  var tt_label = 0;
  if((feature == null) | (map_terms.length == 0)){
    this._div.innerHTML = '<h4>Select destinations, then<br/>hover over a tract for details</h4>';
  } else {
    this._div.innerHTML = '<h4 style="margin:0px;"><u>Walking time</u></h4>';
    for(d of map_terms){
      // Format walking time
      if(feature[d] < 5){
        tt_label = '<5 min.';
      } else if(feature[d] > 30){
        tt_label = '>30 min.';
      } else {
        tt_label = Math.round(feature[d]) + ' min.';
      }
      // Add to inner div
      this._div.innerHTML += (
        '<p style="margin:0px;">'+ destinations[d] + ': ' + tt_label + '</p>'
      );
    }
  }
};
info.addTo(walkability_map);

// Add polygon layer
var largePadding = L.svg(options = {padding: 2.0});
var data_layer = L.geoJson(
  geojson = travel_time.geo,
  options = {
    style: tt_style, pane: 'shadowPane', renderer: largePadding,
    onEachFeature: onEachFeature
  }
)
data_layer.eachLayer((layer) => update_travel_times(layer, map_terms));
data_layer.setStyle(tt_style);
data_layer.addTo(walkability_map);


// Auto-update maps whenever a checkbox is changed -------------------------------------->

var all_checkboxes = document.querySelectorAll(".destcheckbox").forEach(item =>
  item.addEventListener('input', function(){
    map_terms = get_map_terms();
    data_layer.eachLayer((layer) => update_travel_times(layer, map_terms));
    data_layer.setStyle(tt_style);
  })
);
