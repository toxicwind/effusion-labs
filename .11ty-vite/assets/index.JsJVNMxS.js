import"./app.CL1t7Pkj.js";const t=document.getElementById("companyFilter"),o=document.getElementById("companyList");t&&o&&t.addEventListener("input",()=>{const e=t.value.trim().toLowerCase();for(const n of o.children){const i=n.querySelector(".card-title")?.textContent?.toLowerCase()||"";n.style.display=!e||i.includes(e)?"":"none"}});
//# sourceMappingURL=index.JsJVNMxS.js.map
