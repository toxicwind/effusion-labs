const { CONTENT_AREAS } = require("../../lib/constants");

const areaLinks = CONTENT_AREAS.map((a) => ({
  title: a.charAt(0).toUpperCase() + a.slice(1),
  url: `/${a}/`,
}));

const nav = [
  { title: "Showcase", url: "/" },
  ...areaLinks,
  { title: "Map", url: "/map/" },
].map((item, idx) => ({ ...item, order: idx + 1 }));

module.exports = nav;
