const express = require('express')
const exphbs = require('express-handlebars');
const geo = require('geolib');
const app = express()
const port = 8080
var activities = require('./activities.js')
var config = require('./config.js')
var helpers = {}
helpers.json = function (context) {
    return JSON.stringify(context);
}

var pilotsArray = []
var pilotsObj = {}
async function run() {
    var sectors = await activities.readSectors()
    var parseResults = await activities.parse()
    pilotsArray = parseResults.body
    pilotsObj = parseResults.bodyObj
    app.use('/static', express.static('static'))
    app.use('/api/sector', express.static('vatglasses'))
    app.engine('handlebars', exphbs({ helpers, extname: '.hbs' }));
    app.set('view engine', 'handlebars');
    app.get('/', function (req, res) {
        res.send('Hello World!')
    })

    app.listen(port, () => {
        console.log(`Open for buisness at http://localhost:${port}`)
    })
    function createError(status, message) {
        var err = new Error(message);
        err.status = status;
        return err;
    }

    app.get('/aircraft/:id', function (req, res, next) {
        var id = req.params.id
        var apiUrl = `/aircraft/${req.params.id}`
        res.render("aircraftById", { apiUrl: apiUrl })
    });
    app.get('/map/all', function (req, res, next) {
        res.render("generic", { apiUrl: "/aircraft/", mapboxToken: config.mapboxToken })
    });
    app.get('/map/sector/:id', function (req, res, next) {
        res.render("generic", { apiUrl: `/sector/${req.params.id}`, mapboxToken: config.mapboxToken })
    });
    app.get('/map/all/heat', function (req, res, next) {
        res.render("heat", { apiUrl: "/aircraft/heat" })
    });

    app.get('/api/aircraft', function (req, res, next) {
        var id = req.params.id
        // console.log(parseResults, id, parseResults[id])
        var planes = {
            type: "FeatureCollection",
            features: []
        }

        pilotsArray.forEach((flight) => {
            planes.features.push(activities.convertFlightToGeoJson(flight))
        })
        res.send(planes)

    });
    app.get('/api/aircraft/heat', function (req, res, next) {
        var id = req.params.id
        // console.log(parseResults, id, parseResults[id])
        var planes = []
        pilotsArray.forEach((flight) => {
            flight.log.forEach((point) => {
                planes.push([point.latitude, point.longitude, 0.5])
            })
        })
        res.send(planes)

    });
    app.get('/api/aircraft/:id', function (req, res, next) {
        var id = req.params.id
        // console.log(parseResults, id, parseResults[id])
        if (id in pilotsObj) {
            var pilot = pilotsObj[id]
            var route = activities.convertLogToGeoJson(pilot.log, true)
            res.send(route)
        } else {
            res.send(`Aircraft with id ${id} not found.`)
            // createError(404, `Aircraft with id ${id} not found.`)
        }
        // console.log(results.bodyTable, "hi")
    });
    app.get('/api/user/:cid', function (req, res, next) {
        var planes = {
            type: "FeatureCollection",
            features: []
        }
        pilotsArray.forEach((flight) => {
            if (flight.cid == req.params.cid) {
                planes.features.push(activities.convertLogToGeoJson(flight.log))
            }
        })
        res.send(planes)

    });
    app.get('/api/airport/:icao', function (req, res, next) {
        var planes = {
            type: "FeatureCollection",
            features: []
        }
        pilotsArray.forEach((flight) => {
            if (flight.departure == req.params.icao) {
                var plane = activities.convertLogToGeoJson(flight.log)
                // plane.properties.departure
                planes.features.push(activities.convertLogToGeoJson(flight.log))
            } else if (flight.destination == req.params.icao) {
                planes.features.push(activities.convertLogToGeoJson(flight.log))
            }
        })
        res.send(planes)

    });
    app.get('/api/sector/:id', function (req, res, next) {
        var sector = sectors[req.params.id]
        if (typeof sector === undefined) {
            res.send("error")
        }
        if (sector.top == 0) {
            sector.top = 100000
        }
        // console.log(sector)
        var planesInSector = []
        var geoJson = {
            type: "FeatureCollection",
            features: [
                {
                    type: "Feature",
                    properties: {},
                    geometry: {
                        type: "Polygon",
                        coordinates: [sector.coordinates]
                    },
                }
            ]
        }
        pilotsArray.forEach((flight) => {
            var timeInSector = []
            flight.log.some((point) => {
                if (point.altitude > sector.base && point.altitude < sector.top) {
                    var isInSectorHoriz = geo.isPointInPolygon({ latitude: point.latitude, longitude: point.longitude }, sector.coordinates);
                    if (isInSectorHoriz === true) {
                        console.log(`${flight.callsign} is in sector ${sector.name}`)
                        planesInSector.push({ flight })
                        geoJson.features.push(activities.convertFlightToGeoJson(flight))
                        return
                    }
                }
            })

        })
        res.send(geoJson)

    });

}
run()