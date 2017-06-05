
using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;

namespace FunWithVSCode.Controllers
{
    public class RootController : Controller
    {
      public IActionResult Index()
      {
      //TODO: implement the Index method
      
        return View();
      }


      [HttpGet]
      public IActionResult Contact()
      {
        //TODO: implement the Contact method
      
        return View();
      }

      [HttpGet]
      public async Task<IActionResult> About()
      {
        
      
        // TODO Remove
        await Task.Yield();
      
        return View();
      }
    }
}