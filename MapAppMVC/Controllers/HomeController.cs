using MapAppMVC.Models;
using Microsoft.AspNetCore.Mvc;
using System.Diagnostics;

namespace MapAppMVC.Controllers
{
    /// <summary>
    /// Demo Controller f�r MapControl
    /// Liefert die Main-View
    /// </summary>
    public class HomeController : Controller
    {
        #region Attributes
        private readonly ILogger<HomeController> _logger;
        #endregion

        #region Constructor Initialization
        public HomeController(ILogger<HomeController> logger)
        {
            _logger = logger;
        }
        #endregion

        #region ControllerViews
        public IActionResult Index()
        {
            return RedirectToAction("MapDemo");
        }

        public IActionResult MapDemo()
        {
            return View();
        }
        public IActionResult Privacy()
        {
            return View();
        }

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error()
        {
            return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
        }
        #endregion
    }
}
