/*
  HELPER FUNCTIONS FOR WEB MAPPING

  Author: Nat Henry
  Created: 22 March 2022

  Description: Functions to facilitate web mapping with Leaflet. Assumes that Leaflet
    (https://unpkg.com/leaflet@1.0.0-rc.2/dist/leaflet.js) has already been sourced.
*/


/*
  Function: Create a leaflet map with one base layer and two overlay layers
*/
function create_choro_map_base(
  map_div_id, ctr = [0,0], bounds = null, minZoom = 0, maxZoom = 20, startZoom = 12, attr_addon = ''
){
  // Create basemap
  var basemap = L.map(
    id = map_div_id,
    options = {
      center: ctr, maxBounds: bounds, minZoom: minZoom, maxZoom: maxZoom, zoomDelta: .5,
      keyboardPanDelta: 40, inertia: 1, zoomControl: false
    }
  ).setView(center = ctr, zoom = startZoom);

  // Attribution needed for the map tile layers, plus an optional add-on
  var attr = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors' +
    ' | Basemap &copy; <a href="https://carto.com/attributions">CARTO</a>' +
    ' | Roads &copy; <a href="http://stamen.com">Stamen</a>' +
    ' (<a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>)' +
    attr_addon;

  // Add map tile layers
  var CartoDB_PositronNoLabels = L.tileLayer(
    urlTemplate = 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
    options = {subdomains: 'abcd', maxZoom: 20, pane: 'tilePane'}
  ).addTo(basemap);
  var Stamen_TonerLines = L.tileLayer(
    urlTemplate = 'https://stamen-tiles-{s}.a.ssl.fastly.net/toner-lines/{z}/{x}/{y}{r}.png',
    options = {subdomains: 'abcd', maxZoom: 20, opacity: 0.3, pane: 'markerPane', zIndex: 1}
  ).addTo(basemap);
  var CartoDB_PositronOnlyLabels = L.tileLayer(
    urlTemplate = 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png',
    options = {attribution: attr, subdomains: 'abcd', maxZoom: 20, pane: 'markerPane', zIndex: 2}
  ).addTo(basemap);

  // Return map template
  return basemap;
}


/*
  Class to simplify choropleth color schemes
  limits_asc, labels, and colors should all have the same length
*/
class ColorScheme {
  constructor(limits_asc, colors, labels, na_color = '#888'){
    this.limits = limits_asc;
    this.colors = colors;
    this.labels = labels;
    this.na_color = na_color;
  }
  // Function to construct inner HTML for a legend based on limits and colors
  legend_html() {
    let innerHTML = '';
    for(const ii in [...Array(this.labels.length).keys()]){
      innerHTML += '<b style="background:' + this.colors[ii] + '"></b> ' + this.labels[ii];
      if(ii < (this.labels.length - 1)){
        innerHTML += '<br/>';
      }
    }
    return innerHTML;
  }
}

class ColorSchemeNumeric extends ColorScheme {
  // Function to get colors based on an arbitrary value
  color_from_value(value){
    let val_color = this.na_color;
    for(const ii in [...Array(this.colors.length).keys()]){
      if(value >= this.limits[ii]){
        val_color = this.colors[ii];
      }
    }
    return val_color;
  }
}

class ColorSchemeCategorical extends ColorScheme {
  // Function to get colors based on an arbitrary value
  color_from_value(value){
    let val_color = this.na_color;
    for(const ii in [...Array(this.colors.length).keys()]){
      if(value == this.limits[ii]){
        val_color = this.colors[ii];
      }
    }
    return val_color;
  }
}


/*
  Function to create a polygon map based on census data

  PARAMETERS:
    map_div_id: ID of the div where the map will be filled
    map_data: Dataset to plot, with at least attributes mid_lat, mid_lon, zoom, and geo
    legend_html: Full inner HTML for the bottom right legend
    style_function: Function to assign geoJSON polygon style based on attributes of
      features in map_data.geo

  RETURNS: Styled map, which has also been added to the proper div
*/
function census_poly_map(map_div_id, map_data, legend_html, style_function){
  // Create the basemap
  var map = create_choro_map_base(
    map_div_id = map_div_id, ctr = [map_data.mid_lat, map_data.mid_lon],
    bounds = [[map_data.min_lat, map_data.min_lon], [map_data.max_lat, map_data.max_lon]],
    minZoom = 10, maxZoom = 16, startZoom = map_data.zoom,
    attr_addon = ' | Data: 2020 US Census'
  );
  // Add legend to bottom right
  var legend = L.control(options = {position: 'bottomright'});
  legend.onAdd = function(map){
    var div = L.DomUtil.create(tagname = 'div', classname = 'leafinfo leaflegend');
    div.innerHTML = legend_html;
    return div;
  }
  legend.addTo(map);
  // Add info box to top right
  var info = L.control(options = {position: 'topright'});
  info.onAdd = function(map){
      this._div = L.DomUtil.create(tagname = 'div', classname = 'leafinfo movebox');
      this.update();
      return this._div;
  };
  info.update = function(pr){
    if(pr == null){
      this._div.innerHTML = '<h4>Hover over a tract for details</h4>';
    } else {
      this._div.innerHTML = (
        '<p style="margin:0px;">Density: '+ pr.pd_lab+'/mi<sup>2</sup></p>' +
        '<p class="smalltext">(rank: '+pr.pd_rank_c+' / '+pr.city_n+' citywide, '+pr.pd_rank+' / 2,246 overall)</p>' +
        '<p>Diversity index: '+pr.di_lab+'</p>' +
        '<p class="smalltext">(rank: '+pr.di_rank_c+' / '+pr.city_n+' citywide, '+pr.di_rank+' / 2,246 overall)</p>' +
        '<p>Most populous census groups:<br/>' +
        '&nbsp;&nbsp;1. '+pr.grp_1+' ('+pr.grp1_prop_lab+')<br/>'+
        '&nbsp;&nbsp;2. '+pr.grp_2+' ('+pr.grp2_prop_lab+')</p>'
      );
    }
  };
  info.addTo(map);
  // Interaction settings
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
  // Add polygon layer
  var largePadding = L.svg(options = {padding: 2.0});
  var data_layer = L.geoJson(
    geojson = map_data.geo,
    options = {
      style: style_function, pane: 'shadowPane', renderer: largePadding,
      onEachFeature: onEachFeature
    }
  ).addTo(map);
  // Return map, which has already been added to div
  return map;
}

