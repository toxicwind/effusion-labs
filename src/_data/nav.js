const { CONTENT_AREAS } = require("../../lib/constants");

const areaLinks = CONTENT_AREAS.map((a) => ({
  title: a.charAt(0).toUpperCase() + a.slice(1),
  url: `/${a}/`,
}));

module.exports = [
  { title: "Showcase", url: "/" },
  ...areaLinks,
  { title: "Map", url: "/map/" },
];
