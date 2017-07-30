var Loader = function(AppData, options)
{
  // Called when country boundary json is loaded
  // We dont show this as a map just use it for group boundary box
  function onCountry(json) {
    console.log('country');
    var country = json.features[0].id;
    AppData.bbox.country[country] = turf.envelope(json);
    console.log('' + country + ' bbox=' + JSON.stringify(AppData.bbox.country));
  }

  // Called when states boundary json is loaded
  // Add one layer per state so we can change colours
  // Also compute each bounding box
  function onStates(json) {
    console.log('states');
    var item = L.geoJson(json, {
      onEachFeature: function (feature, layer) { // called once for each state
        var state = StateCode[feature.properties.STATE_CODE];
        console.log('Loaded: ' + state);
        // Scale so we zoom closer
        var bbox = turf.envelope(feature);           // return Feature<Polygon>:
        var poly = turf.transformScale(bbox, 0.7);   //        console.log(JSON.stringify(poly));
        bbox = turf.envelope(poly);                  //console.log(JSON.stringify(bbox));

        AppData.stateLayers[feature.properties.STATE_CODE] = layer;
        AppData.bbox.state[feature.properties.STATE_CODE] = bbox;
        layer.on(AppData.featureOnState);
      },
      style : function (feature) { return Styles['states']; }
    });
    AppData.statesItem = item;
    AppData.map.addLayer(AppData.statesItem);
  }

  // Called when regions boundary json is loaded
  // Add one layer per state so we can change colours
  // Also compute each bounding box
  function onRegions(json) {
    console.log('onRegions');

    AppData.regionsList = {};
    var item = L.geoJson(json, {
      onEachFeature: function (feature, layer) {
        var listItem = {
          feature: feature,
          dollars: +0,
          marker: null,
        };

        var region = feature.properties.REGION; // from data.sa
        region = region.replace(/\s+/g,' '); // Fix wierd whitespace issues

        var bbox = turf.envelope(feature); // return Feature<Polygon>:

        // Create a marker in the middle of the region
        var pp = turf.centroid(feature);
        var pp = [pp.geometry.coordinates[1], pp.geometry.coordinates[0]]; // WTAF - turf points are backwards relative to what leaflet needs
        var marker = L.marker(pp, { title: region, zIndexOffset: 1000});
        marker.bindTooltip(region, { permanent: true });
        // console.log('v=' + region + ' marker=' + JSON.stringify(marker.toGeoJSON()));

        listItem.marker = marker;
        AppData.regionsList[region] = listItem;
        AppData.regionLayers[region] = layer;
        AppData.bbox.region[region] = bbox;
        layer.on(AppData.featureOnRegion);
      },
      style : function (feature) { return Styles['regions']; }
    });
    AppData.regionsItem = item;
    console.log('IMPORTED regionsList.count=' + _.size(AppData.regionsList));
  }

  function onGrantsPerRegion(csv) {
    console.log('onGrantsPerRegion csv.length=' + csv.length);

    AppData.grantsPerRegion = {}
    csv.forEach(function(row) {
      AppData.grantsPerRegion[row.region] = row.total;
    });
    console.log('IMPORTED grantsPerRegion=' + JSON.stringify(AppData.grantsPerRegion));
  }

  function onGrantsDollars(csv) {
    console.log('onGrantsDollars regions.length=' + _.size(AppData.regionsList) + ', csv.length=' + csv.length);

    var item = {}
    csv.forEach(function(row) {
      var grantRegionName= row['Region'];
      grantRegionName = grantRegionName.replace(/\s+/g,' '); // Fix wierd whitespace issues

      var amount = row['Amount'];
      amount = Number(amount.replace(/[^0-9\.-]+/g,""));

      // Remap the keys: Organisation Name	Project Title	Project Description	Region	Amount
      item.name = row['Organisation Name'];
      item.project = row['Project Title'];
      item.description = row['Project Description'];
      item.region = grantRegionName;

      // FIXME: This region needs to map supersets
      // e.g. 'Whole of metropolitan area' ==> [ 'Eastern Adelaide', 'Northern Adelaide']
      // Temporary hack
      item.regionSet = [ grantRegionName ];

      if (!Object.keys(AppData.regionsList).includes(grantRegionName)) {
        // console.log('Grants region not found in regions list, will need mapping. "' + grantRegionName + '"');
        AppData.regionsList[grantRegionName] = { dollars: +0, feature: null, marker: null };
      } else {
        // console.log('Grants region found in regions list ' + grantRegionName);
      }
      AppData.regionsList[grantRegionName].dollars += +amount;
    });
  }

    // Next one is CC0 license
    var p1 = new Promise(function(resolve, reject) { d3.json('assets/AUS.geo.json', function(json) { onCountry(json); resolve(); }); });
    var p2 = new Promise(function(resolve, reject) { d3.json('assets/au-states.geojson', function(json) { onStates(json); resolve(); }); });
    var p3 = new Promise(function(resolve, reject) { d3.json('assets/SAGovtRegions.geojson', function(json) { onRegions(json); resolve(); }); });

    Promise.all([p1, p2, p3]).then(function() {
      // Depends on sagovregion geo
      var p4 = new Promise(function(resolve, reject) { d3.csv('assets/grants_per_region.csv', function(csv) { onGrantsPerRegion(csv); resolve(); }); });
      var p5 = new Promise(function(resolve, reject) { d3.csv('assets/grants-sa-funded-projects-2016-2017.csv', function(csv) { onGrantsDollars(csv); resolve(); }); });

      Promise.all([p4, p5]).then(function() {
        console.log('All data loaded');
        if (options) { options.onDataLoaded(); }
      });
    });

}
