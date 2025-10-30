using Microsoft.AspNetCore.Mvc;
using System.Collections.Concurrent;

namespace MapAppMVC.Controllers
{
    /// <summary>
    /// Datengebende Funktionen für das MapControl
    /// Aktuell als Rest-API implementiert
    /// Todo: Überlegen, ob Ajax call zu klassischem Controller sinnvoller ist
    /// </summary>
    [ApiController]
    [Route("api/map")]
    public class MapController : ControllerBase
    {
        #region Attributes
        private static readonly ConcurrentDictionary<string, CircleResponse> _circles = new();
        private static readonly ConcurrentDictionary<string, IconResponse> _icons = new();
        private static readonly ConcurrentDictionary<string, PolygonResponse> _polygons = new(); 

        private static readonly Random _rng = new();
        #endregion

        #region Constructor Initialization
        static MapController()
        {
            // Initialdaten
            for (int i = 0; i < 200; i++)
            {
                var id = $"c{i + 1}";
                string RandomHex() => $"#{_rng.Next(0x1000000):X8}";
                _circles[id] = new CircleResponse
                {
                    Id = id,
                    Lon = 7.45 + _rng.NextDouble() * 2.0-1,
                    Lat = 51.51 + _rng.NextDouble() * 2.0 -1,
                    // Radius in Meter 
                    Radius = 1000 + _rng.NextDouble() * 2000,
                    Color = RandomHex(),
                    Label = $"Circle {i + 1}",
                    Html = $"<b>CircleMarker {i + 1}</b><br/><button type='button' class='btn btn-success'>Success</button>",

                };
            }
            var colors = new[] { "#e5322755", "#1e90ff88", "#2ecc7188", "#f39c1266", "#8e44adaa" };
            for (int i = 0; i < 200; i++)
            {
                var id = $"m{i + 1}";
                _icons[id] = new IconResponse
                {
                    Id = id,
                    Lon = 7.45 + _rng.NextDouble() * 2.0 - 1,
                    Lat = 51.51 + _rng.NextDouble() * 2.0 - 1,
                    Html = $"<b>Marker {i + 1}</b><br/><button type='button' class='btn btn-danger'>Danger</button>",
                    Fa = new FaStyleResponse { Glyph = "\uf041", Size = 28, Weight = 900, Fill = colors[i % colors.Length] }
                };

                // random Fa, falls nicht angegeben (roter Marker
                if (_rng.NextDouble() < 0.1)
                {
                    _icons[id].Fa = new FaStyleResponse { Image = "https://storage.e.jimdo.com/cdn-cgi/image/quality=85,fit=scale-down,format=auto,trim=0;0;0;0,width=128,height=128/image/281823853/56cc8507-3d3e-48f5-9dae-0bd009e2b182.png", Scale = 1.0 };
                }
                else
                {
                    _icons[id].Fa = new FaStyleResponse { Glyph = "\uf041", Size = 28, Weight = 900, Fill = colors[i % colors.Length] };
                }
            }
            for (int i = 0; i < 200; i++)
            {
                var id = $"p{i + 1}";
                _polygons[id] = RandomPolygon(id, 7.45 + _rng.NextDouble() * 2.0 - 1, 51.51 + _rng.NextDouble() * 2.0 - 1);
            }
        }

        private static PolygonResponse RandomPolygon(string id, double lon, double lat)
        {
            int verts = 4 + _rng.Next(13); // 4..16
            double baseR = 0.02 + _rng.NextDouble() * 0.08; // ~einfacher Kreisradius in Grad
            var coords = new List<double[]>();
            for (int i = 0; i < verts; i++)
            {
                double a = (Math.PI * 2.0) * i / verts;
                double jitter = 0.4 + _rng.NextDouble() * 0.8; // 0.4..1.2
                double dx = Math.Cos(a) * baseR * jitter;
                double dy = Math.Sin(a) * baseR * jitter;
                coords.Add(new[] { lon + dx, lat + dy });
            }
            var colors = new[] { "#ffa50055", "#00cc8877", "#1e90ff66", "#ff69b466", "#8e44ad55" };
            return new PolygonResponse
            {
                Id = id,
                Coords = coords,
                Color = colors[_rng.Next(colors.Length)],
                Label = $"Poly {id}",
                Html = $"<b>Polygon {id}</b>"
            };
        }
        #endregion    

        #region Data provider map control

        [HttpGet("circles-initial")]
        public ActionResult<IEnumerable<CircleResponse>> GetCirclesInitial()
            => Ok(_circles.Values);

        [HttpGet("icons-initial")]
        public ActionResult<IEnumerable<IconResponse>> GetIconsInitial()
            => Ok(_icons.Values);

        // Liefert N zufällig geänderte Kreise: nur {id, radius} (Teilupdate)
        [HttpGet("circles-delta")]
        public ActionResult<IEnumerable<object>> GetCirclesDelta([FromQuery] int n = 2)
        {
            var list = _circles.Values.OrderBy(_ => _rng.Next()).Take(Math.Clamp(n, 1, 3)).ToList();
            foreach (var c in list)
            {
                var delta = (int)(_rng.NextDouble() * 2000) - 1000; // -400..+400
                var newRadius = Math.Max(500, c.Radius + delta);
                c.Radius = newRadius;

                c.Html = "<b>UPDATE</b>" + (_rng.NextDouble()) as string;

                if (_rng.NextDouble() < 0.1)
                {
                    c.Kill = true;
                }

            } 
            // Nur die geänderten Felder zurückgeben
            var updates = list.Select(c => new { id = c.Id, radius = c.Radius , html= c.Html });
            return Ok(updates);
        }

        // Liefert N zufällig geänderte Icons: nur {id, fa:{fill}} (Teilupdate)
        [HttpGet("icons-delta")]
        public ActionResult<IEnumerable<object>> GetIconsDelta([FromQuery] int n = 2)
        {
            string RandomHex() => $"#{_rng.Next(0x1000000):X6}";
            var list = _icons.Values.OrderBy(_ => _rng.Next()).Take(Math.Clamp(n, 1, 3)).ToList();
            foreach (var m in list)
            {
                var fa = m.Fa ??= new FaStyleResponse();
                fa.Fill = RandomHex();
                   
                m.Html = "<b>UPDATE</b>"+ (_rng.NextDouble()) as string;

                // Random kill , wird aber nicht hier aus der liste gelöscht , also kommt später wieder rein
                if (_rng.NextDouble() < 0.1)
                {
                    m.Kill = true;
                }                
            }

            var updates = list.Select(m => new { id = m.Id, fa = new { fill = m.Fa!.Fill } , html = m.Html });
            return Ok(updates);
        }

        // Beispiel: neues Icon anlegen
        [HttpPost("icon")]
        public ActionResult<IconResponse> CreateIcon([FromBody] CreateIconRequest req)
        {
            var id = Guid.NewGuid().ToString("N")[..8];
            var icon = new IconResponse
            {
                Id = id,
                Lon = req.Lon,
                Lat = req.Lat,
                Html = string.IsNullOrWhiteSpace(req.Html) ? "<b>Marker</b>" : req.Html,
                
            };
            icon.Fa = req.Fa ?? new FaStyleResponse { Glyph = "\uf041", Size = 28, Weight = 900, Fill = "#e5322766" };
            _icons[id] = icon;
            return CreatedAtAction(nameof(GetIcon), new { id }, icon);
        }

        [HttpGet("icon/{id}")]
        public ActionResult<IconResponse> GetIcon(string id)
            => _icons.TryGetValue(id, out var val) ? Ok(val) : NotFound();

        [HttpGet("polygons-initial")]
        public ActionResult<IEnumerable<PolygonResponse>> GetPolygonsInitial([FromQuery] int n = 100)
        {
            var vals = _polygons.Values.Take(n).ToList();
            return Ok(vals);
        }

        [HttpGet("polygons-delta")]
        public ActionResult<IEnumerable<object>> GetPolygonsDelta([FromQuery] int n = 2)
        {
            var list = _polygons.Values.OrderBy(_ => _rng.Next()).Take(Math.Clamp(n, 1, 5)).ToList();
            var updates = new List<object>();
            foreach (var p in list)
            {
                if (_rng.NextDouble() < 0.15)
                {
                    // Kill
                    updates.Add(new { id = p.Id, Kill = true });
                    _polygons.TryRemove(p.Id, out _);
                    continue;
                }

                // leichte Formänderung
                var centerLon = p.Coords.Average(c => c[0]);
                var centerLat = p.Coords.Average(c => c[1]);
                var id = p.Id;
                var np = RandomPolygon(id, centerLon, centerLat); // neu erzeugen (einfach halten)
                _polygons[id] = np;

                updates.Add(new
                {
                    id = id,
                    coords = np.Coords,
                    color = np.Color,
                    html = $"<b>UPDATE {id}</b>"
                });
            }
            return Ok(updates);
        }
        #endregion
    }

    #region DTOs
    public record CircleResponse
    {
        public string Id { get; init; } = default!;
        public double Lon { get; set; }
        public double Lat { get; set; }
        public double Radius { get; set; }
        public string? Color { get; set; }
        public string? Label { get; set; }
        public string? Html { get; set; }
        public bool? Kill { get; set; }

    }

    public record PolygonResponse  
    {
        public string Id { get; init; } = default!;
        public List<double[]> Coords { get; set; } = new(); // [ [lon,lat], ... ]
        public string? Color { get; set; }
        public string? Label { get; set; }
        public string? Html { get; set; }
        public bool? Kill { get; set; }
    }
    public record IconResponse
    {
        public string Id { get; init; } = default!;
        public double Lon { get; set; }
        public double Lat { get; set; }
        public string? Html { get; set; }
        public FaStyleResponse? Fa { get; set; }
        public bool?Kill{ get; set; }
    }
    public record CreateIconRequest
    {
        public double Lon { get; init; }
        public double Lat { get; init; }
        public string? Html { get; init; }
        public FaStyleResponse? Fa { get; init; }
    }
    public record FaStyleResponse
    {
        public string? Glyph { get; set; }
        public int? Size { get; set; }
        public int? Weight { get; set; }
        public string? Family { get; set; }
        public string? Fill { get; set; }
        public string? Stroke { get; set; }
        public int? StrokeWidth { get; set; }
        public string? TextAlign { get; set; }
        public string? TextBaseline { get; set; }
        public int? ZIndex { get; set; }
        public string? Image{ get; set; }
        public double? Scale{ get; set; }

    }

    #endregion
}
