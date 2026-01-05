using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using System.Collections.Concurrent;

namespace MapAppMVC.Controllers
{
    [ApiController]
    [Route("api/map")]
    public class MapController : ControllerBase
    {
        private static readonly ConcurrentDictionary<string, CircleResponse> _circles = new();
        private static readonly ConcurrentDictionary<string, IconResponse> _icons = new();
        private static readonly ConcurrentDictionary<string, PolygonResponse> _polygons = new();

        private static readonly Random _rng = new();
        private readonly ILogger<MapController> _log;

        private record IconPreset(string Name, string Glyph, int Size, string Baseline);

        private static readonly IconPreset[] _extraIconPresets = new[]
        {
    // Pins / markers / flags (bottom anchored)
    new IconPreset("MapMarker",        "\uf041", 30, "bottom"),
    new IconPreset("LocationDot",      "\uf3c5", 30, "bottom"),
    new IconPreset("Thumbtack",        "\uf08d", 28, "bottom"),
    new IconPreset("Flag",             "\uf024", 28, "bottom"),
    new IconPreset("FlagCheckered",    "\uf11e", 28, "bottom"),

    // Mobile (centered)
    new IconPreset("MobileScreen",     "\uf3cd", 26, "middle"),
    new IconPreset("Phone",            "\uf095", 26, "middle"),
    new IconPreset("Tablet",           "\uf3fa", 26, "middle"),

    // Office (centered)
    new IconPreset("Briefcase",        "\uf0b1", 26, "middle"),
    new IconPreset("Clipboard",        "\uf328", 26, "middle"),
    new IconPreset("FileLines",        "\uf15c", 26, "middle"),
    new IconPreset("Envelope",         "\uf0e0", 26, "middle"),
    new IconPreset("Fax",              "\uf1ac", 26, "middle"),

    // Architecture (centered)
    new IconPreset("Building",         "\uf1ad", 26, "middle"),
    new IconPreset("Landmark",         "\uf66f", 26, "middle"),
    new IconPreset("Archway",          "\uf557", 26, "middle"),
    new IconPreset("City",             "\uf64f", 26, "middle"),
    new IconPreset("Monument",         "\uf5a6", 26, "middle"),

    // POI-ish (centered)
    new IconPreset("CircleInfo",       "\uf05a", 26, "middle"),
    new IconPreset("CircleExclamation","\uf06a", 26, "middle"),
};

        private static string RandomVividRgba(double a = 0.85)
        {
            // sichtbar, nicht “alles schwarz”
            int r = 40 + _rng.Next(200);
            int g = 40 + _rng.Next(200);
            int b = 40 + _rng.Next(200);
            return $"rgba({r},{g},{b},{a.ToString(System.Globalization.CultureInfo.InvariantCulture)})";
        }

        private static string SafeText(string? s)
        {
            if (string.IsNullOrWhiteSpace(s)) return "Marker";
            // keine Zeichen, die HTML/Attribute Stress machen
            return s.Replace("<", "").Replace(">", "").Replace("\"", "").Replace("'", "").Replace("&", "");
        }

        public MapController(ILogger<MapController> log)
        {
            _log = log;
        }

        static MapController()
        {
            // Default region around Ruhrgebiet
            for (int i = 0; i < 600; i++)
            {
                var id = $"c{i + 1}";
                _circles[id] = new CircleResponse
                {
                    Id = id,
                    Lon = 7.45 + _rng.NextDouble() * 2.0 - 1,
                    Lat = 51.51 + _rng.NextDouble() * 2.0 - 1,
                    Radius = 400 + _rng.NextDouble() * 4200,
                    Color = RandomHexA(0.25),
                    Label = $"Circle {i + 1}",
                    Html = $"<b>Circle {i + 1}</b><br/><button type='button' class='btn btn-success btn-sm'>OK</button>",
                    StrokeColor = "rgba(255,255,255,0.65)",
                    StrokeWidth = 6,
                    OutlineColor = "rgba(0,0,0,0.18)",
                    OutlineWidth = 14
                };
                if (_rng.NextDouble() < 0.08)
                {
                    _circles[id].Anim = new AnimResponse { Type = "pulse", Freq = 0.9 };
                }
            }

            var colors = new[] { "#e53227cc", "#1e90ffcc", "#2ecc71cc", "#f39c12cc", "#8e44adcc" };
            for (int i = 0; i < 300; i++)
            {
                var id = $"m{i + 1}";

                //            new IconPreset("MapMarker", "\uf041", 30, "bottom"),
                //new IconPreset("LocationDot", "\uf3c5", 30, "bottom"),
                //new IconPreset("Thumbtack", "\uf08d", 28, "bottom"),
                //new IconPreset("Flag", "\uf024", 28, "bottom"),
                //new IconPreset("FlagCheckered", "\uf11e", 28, "bottom"),

                //// Mobile (centered)
                //new IconPreset("MobileScreen", "\uf3cd", 26, "middle"),
                //new IconPreset("Phone", "\uf095", 26, "middle"),
                //new IconPreset("Tablet", "\uf3fa", 26, "middle"),
                //new IconPreset("Building", "\uf1ad", 26, "middle"),
    //new IconPreset("Landmark", "\uf66f", 26, "middle"),

                // random glyph
                var g = "\uf041";
                switch (_rng.Next() % 10)
                {
                    case 0:g = "\uf341"; break;
                    case 1: g = "\uf3c5"; break;
                    case 2: g = "\uf08d"; break;
                    case 3: g = "\uf024"; break;
                    case 4: g = "\uf11e"; break;
                    case 5: g = "\uf3cd"; break;
                    case 6: g = "\uf095"; break;
                    case 7: g = "\uf3fa"; break;
                    case 8: g = "\uf1ad"; break;
                    case 9: g = "\uf66f"; break;
                }

                

                _icons[id] = new IconResponse
                {
                    Id = id,
                    Lon = 7.45 + _rng.NextDouble() * 2.0 - 1,
                    Lat = 51.51 + _rng.NextDouble() * 2.0 - 1,
                    Html = $"<b>Marker {i + 1}</b><br/><button type='button' class='btn btn-danger btn-sm'>Danger</button>",
                    Fa = new FaStyleResponse { Glyph = g, Size = 18 + (i % 5) * 6, Weight = 900, Fill = colors[i % colors.Length] }
                };

                
                if (_rng.NextDouble() < 0.12)
                {
                    _icons[id].Fa = new FaStyleResponse { Image = "https://storage.e.jimdo.com/cdn-cgi/image/quality=85,fit=scale-down,format=auto,trim=0;0;0;0,width=128,height=128/image/281823853/56cc8507-3d3e-48f5-9dae-0bd009e2b182.png", Scale = 0.9 };
                }
                if (_rng.NextDouble() < 0.10)
                {
                    _icons[id].Anim = new AnimResponse { Type = (_rng.NextDouble() < 0.5) ? "wobble" : "bob" };
                }
            }

            for (int i = 0; i < 160; i++)
            {
                var id = $"p{i + 1}";
                _polygons[id] = RandomPolygon(id, 7.45 + _rng.NextDouble() * 2.0 - 1, 51.51 + _rng.NextDouble() * 2.0 - 1);
            }
        }

        // -------- API --------

        [HttpGet("circles-initial")]
        public ActionResult<IEnumerable<CircleResponse>> GetCirclesInitial([FromQuery] double? lon = null, [FromQuery] double? lat = null, [FromQuery] double km = 25, [FromQuery] int n = 1000, [FromQuery] int debug = 0)
        {
            LogDebug(debug, "circles-initial", lon, lat, km, n);
            var vals = FilterByCenter(_circles.Values, lon, lat, km).Take(Clamp(n, 1, 5000)).ToList();
            return Ok(vals);
        }

        [HttpGet("icons-initial")]
        public ActionResult<IEnumerable<IconResponse>> GetIconsInitial([FromQuery] double? lon = null, [FromQuery] double? lat = null, [FromQuery] double km = 25, [FromQuery] int n = 1000, [FromQuery] int debug = 0)
        {
            LogDebug(debug, "icons-initial", lon, lat, km, n);
            var vals = FilterByCenter(_icons.Values, lon, lat, km).Take(Clamp(n, 1, 5000)).ToList();
            return Ok(vals);
        }

        [HttpGet("polygons-initial")]
        public ActionResult<IEnumerable<PolygonResponse>> GetPolygonsInitial([FromQuery] double? lon = null, [FromQuery] double? lat = null, [FromQuery] double km = 25, [FromQuery] int n = 200, [FromQuery] int debug = 0)
        {
            LogDebug(debug, "polygons-initial", lon, lat, km, n);
            var vals = FilterByCenter(_polygons.Values, lon, lat, km).Take(Clamp(n, 1, 2000)).ToList();
            return Ok(vals);
        }

        [HttpGet("circles-delta")]
        public ActionResult<IEnumerable<object>> GetCirclesDelta([FromQuery] double? lon = null, [FromQuery] double? lat = null, [FromQuery] double km = 25, [FromQuery] int n = 10, [FromQuery] int debug = 0)
        {
            LogDebug(debug, "circles-delta", lon, lat, km, n);

            var candidates = FilterByCenter(_circles.Values, lon, lat, km).ToList();
            if (candidates.Count == 0) candidates = _circles.Values.ToList();

            int take = Clamp(n, 1, 80);
            var list = candidates.OrderBy(_ => _rng.Next()).Take(take).ToList();

            foreach (var c in list)
            {
                // mutate a bit
                var delta = (_rng.NextDouble() * 1600) - 800;
                c.Radius = Math.Max(80, c.Radius + delta);

                if (_rng.NextDouble() < 0.25) c.Color = RandomHexA(0.22 + _rng.NextDouble() * 0.25);
                c.Html = $"<b>UPDATE</b> {DateTime.UtcNow:HH:mm:ss}";

                if (_rng.NextDouble() < 0.04) c.Anim = new AnimResponse { Type = "blink" };
                if (_rng.NextDouble() < 0.04) c.Anim = new AnimResponse { Type = "pulse", Freq = 1.0 };
                if (_rng.NextDouble() < 0.02) c.Kill = true;
                else c.Kill = null;
            }

            var updates = list.Select(c => new
            {
                id = c.Id,
                lon = c.Lon,
                lat = c.Lat,
                radius = c.Radius,
                color = c.Color,
                html = c.Html,
                anim = c.Anim,
                Kill = c.Kill,
                strokeColor = c.StrokeColor,
                strokeWidth = c.StrokeWidth,
                outlineColor = c.OutlineColor,
                outlineWidth = c.OutlineWidth
            });
            return Ok(updates);
        }

        [HttpGet("icons-delta")]
        public ActionResult<IEnumerable<object>> GetIconsDelta([FromQuery] double? lon = null, [FromQuery] double? lat = null, [FromQuery] double km = 25, [FromQuery] int n = 10, [FromQuery] int debug = 0)
        {
            LogDebug(debug, "icons-delta", lon, lat, km, n);

            var candidates = FilterByCenter(_icons.Values, lon, lat, km).ToList();
            if (candidates.Count == 0) candidates = _icons.Values.ToList();

            int take = Clamp(n, 1, 80);
            var list = candidates.OrderBy(_ => _rng.Next()).Take(take).ToList();

            foreach (var m in list)
            {
                m.Html = $"<b>UPDATE</b> {DateTime.UtcNow:HH:mm:ss}";
                m.Fa ??= new FaStyleResponse();
                if (m.Fa.Image == null)
                {
                    m.Fa.Fill = RandomHex();
                    if (_rng.NextDouble() < 0.15) m.Fa.Size = 18 + _rng.Next(30);
                }

                if (_rng.NextDouble() < 0.06) m.Anim = new AnimResponse { Type = (_rng.NextDouble() < 0.5) ? "wobble" : "scale" };
                if (_rng.NextDouble() < 0.02) m.Kill = true;
                else m.Kill = null;
            }

            var updates = list.Select(m => new
            {
                id = m.Id,
                lon = m.Lon,
                lat = m.Lat,
                html = m.Html,
                fa = m.Fa == null ? null : new
                {
                    glyph = m.Fa.Glyph,
                    size = m.Fa.Size,
                    weight = m.Fa.Weight,
                    family = m.Fa.Family,
                    fill = m.Fa.Fill,
                    stroke = m.Fa.Stroke,
                    strokeWidth = m.Fa.StrokeWidth,
                    textAlign = m.Fa.TextAlign,
                    textBaseline = m.Fa.TextBaseline,
                    zIndex = m.Fa.ZIndex,
                    image = m.Fa.Image,
                    scale = m.Fa.Scale
                },
                anim = m.Anim,
                Kill = m.Kill
            });
            return Ok(updates);
        }

        [HttpGet("polygons-delta")]
        public ActionResult<IEnumerable<object>> GetPolygonsDelta([FromQuery] double? lon = null, [FromQuery] double? lat = null, [FromQuery] double km = 25, [FromQuery] int n = 6, [FromQuery] int debug = 0)
        {
            LogDebug(debug, "polygons-delta", lon, lat, km, n);

            var candidates = FilterByCenter(_polygons.Values, lon, lat, km).ToList();
            if (candidates.Count == 0) candidates = _polygons.Values.ToList();

            int take = Clamp(n, 1, 20);
            var list = candidates.OrderBy(_ => _rng.Next()).Take(take).ToList();
            var updates = new List<object>();

            foreach (var p in list)
            {
                if (_rng.NextDouble() < 0.12)
                {
                    updates.Add(new { id = p.Id, Kill = true });
                    _polygons.TryRemove(p.Id, out _);
                    continue;
                }

                // regenerate around polygon center
                var centerLon = p.Coords.Average(c => c[0]);
                var centerLat = p.Coords.Average(c => c[1]);
                var np = RandomPolygon(p.Id, centerLon, centerLat);
                // vary stroke
                np.StrokeWidth = 2 + _rng.Next(6);
                np.StrokeColor = (_rng.NextDouble() < 0.5) ? "rgba(30,144,255,0.85)" : "rgba(255,105,180,0.8)";
                if (_rng.NextDouble() < 0.18) np.Anim = new AnimResponse { Type = "blink" };

                _polygons[p.Id] = np;

                updates.Add(new
                {
                    id = np.Id,
                    coords = np.Coords,
                    color = np.Color,
                    html = $"<b>UPDATE {np.Id}</b>",
                    strokeColor = np.StrokeColor,
                    strokeWidth = np.StrokeWidth,
                    outlineColor = np.OutlineColor,
                    outlineWidth = np.OutlineWidth,
                    anim = np.Anim
                });
            }

            return Ok(updates);
        }

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
                Fa = req.Fa ?? new FaStyleResponse { Glyph = "\uf041", Size = 28, Weight = 900, Fill = "#e5322766" }
            };

            // RAndom Icons
            


            _icons[id] = icon;
            return CreatedAtAction(nameof(GetIcon), new { id }, icon);
        }

        [HttpGet("icon/{id}")]
        public ActionResult<IconResponse> GetIcon(string id)
            => _icons.TryGetValue(id, out var val) ? Ok(val) : NotFound();

        // -------- helpers --------

        private static int Clamp(int v, int min, int max) => Math.Max(min, Math.Min(max, v));
        private static string RandomHex() => $"#{_rng.Next(0x1000000):X6}";
        private static string RandomHexA(double alpha)
        {
            // rgba fallback
            int r = _rng.Next(256);
            int g = _rng.Next(256);
            int b = _rng.Next(256);
            alpha = Math.Clamp(alpha, 0.05, 0.95);
            return $"rgba({r},{g},{b},{alpha:0.###})";
        }

        private void LogDebug(int debug, string endpoint, double? lon, double? lat, double km, int n)
        {
            if (debug == 1)
            {
                _log.LogInformation("[MapApi] {Endpoint} lon={Lon} lat={Lat} km={Km} n={N}", endpoint, lon, lat, km, n);
            }
        }

        private static IEnumerable<T> FilterByCenter<T>(IEnumerable<T> src, double? lon, double? lat, double km)
        {
            // if (lon == null || lat == null) return src;
            // yield
            if (lon == null || lat == null)
            {
                foreach (var it in src) yield return it;
                yield break;
            }

            var lo = lon.Value; var la = lat.Value;
            km = Math.Max(1, km);

            foreach (var it in src)
            {
                double x, y;
                switch (it)
                {
                    case CircleResponse c: x = c.Lon; y = c.Lat; break;
                    case IconResponse m: x = m.Lon; y = m.Lat; break;
                    case PolygonResponse p:
                        x = p.Coords.Average(a => a[0]);
                        y = p.Coords.Average(a => a[1]);
                        break;
                    default:
                        yield return it;
                        continue;
                }

                if (HaversineKm(la, lo, y, x) <= km) yield return it;
            }
        }

        private static double HaversineKm(double lat1, double lon1, double lat2, double lon2)
        {
            double R = 6371.0;
            double dLat = (lat2 - lat1) * Math.PI / 180.0;
            double dLon = (lon2 - lon1) * Math.PI / 180.0;
            double a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
                     + Math.Cos(lat1 * Math.PI / 180.0) * Math.Cos(lat2 * Math.PI / 180.0)
                     * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
            double c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
            return R * c;
        }

        private static PolygonResponse RandomPolygon(string id, double lon, double lat)
        {
            int verts = 4 + _rng.Next(10); // 4..13
            double baseR = 0.015 + _rng.NextDouble() * 0.05; // ~Grad
            var coords = new List<double[]>();
            for (int i = 0; i < verts; i++)
            {
                double a = (Math.PI * 2.0) * i / verts;
                double jitter = 0.4 + _rng.NextDouble() * 0.8;
                double dx = Math.Cos(a) * baseR * jitter;
                double dy = Math.Sin(a) * baseR * jitter;
                coords.Add(new[] { lon + dx, lat + dy });
            }
            var colors = new[] { "rgba(255,165,0,0.30)", "rgba(0,204,136,0.40)", "rgba(30,144,255,0.30)", "rgba(255,105,180,0.30)", "rgba(142,68,173,0.30)" };
            return new PolygonResponse
            {
                Id = id,
                Coords = coords,
                Color = colors[_rng.Next(colors.Length)],
                Label = $"Poly {id}",
                Html = $"<b>Polygon {id}</b>",
                StrokeColor = "rgba(0,0,0,0.65)",
                StrokeWidth = 3,
                OutlineColor = "rgba(255,255,255,0.35)",
                OutlineWidth = 10
            };
        }
    }

    // DTOs
    public record AnimResponse
    {
        public string? Type { get; set; }
        public double? Freq { get; set; }
    }

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

        public string? StrokeColor { get; set; }
        public double? StrokeWidth { get; set; }
        public string? OutlineColor { get; set; }
        public double? OutlineWidth { get; set; }

        public AnimResponse? Anim { get; set; }
    }

    public record PolygonResponse
    {
        public string Id { get; init; } = default!;
        public List<double[]> Coords { get; set; } = new();
        public string? Color { get; set; }
        public string? Label { get; set; }
        public string? Html { get; set; }
        public bool? Kill { get; set; }

        public string? StrokeColor { get; set; }
        public double? StrokeWidth { get; set; }
        public string? OutlineColor { get; set; }
        public double? OutlineWidth { get; set; }

        public AnimResponse? Anim { get; set; }
    }

    public record IconResponse
    {
        public string Id { get; init; } = default!;
        public double Lon { get; set; }
        public double Lat { get; set; }
        public string? Html { get; set; }
        public FaStyleResponse? Fa { get; set; }
        public bool? Kill { get; set; }
        public AnimResponse? Anim { get; set; }
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
        public string? Image { get; set; }
        public double? Scale { get; set; }
    }
}
