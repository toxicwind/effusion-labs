(function () {
  "use strict";
  var cards = document.querySelectorAll("[data-tilt]");
  if (!cards.length) return;
  cards.forEach(function (card) {
    card.addEventListener("pointermove", function (e) {
      var rect = card.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      var rx = ((y / rect.height) - 0.5) * -10;
      var ry = ((x / rect.width) - 0.5) * 10;
      card.style.setProperty("--rx", rx + "deg");
      card.style.setProperty("--ry", ry + "deg");
    });
    card.addEventListener("pointerleave", function () {
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
    });
  });
})();
