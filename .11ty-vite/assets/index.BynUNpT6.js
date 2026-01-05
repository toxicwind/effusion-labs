import"./app.CL1t7Pkj.js";const t=document.getElementById("companyFilterDT"),o=document.getElementById("companyListDT");t&&o&&t.addEventListener("input",()=>{const e=t.value.trim().toLowerCase();for(const n of o.children){const i=n.querySelector(".card-title")?.textContent?.toLowerCase()||"";n.style.display=!e||i.includes(e)?"":"none"}});
//# sourceMappingURL=index.BynUNpT6.js.map
